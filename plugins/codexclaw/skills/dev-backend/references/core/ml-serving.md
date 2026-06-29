# ML Model Serving

**Last reviewed**: 2026-06-16
**Applies to**: Python (FastAPI 0.115+, vLLM 0.8+, BentoML 1.4+), GPU inference (CUDA 12.x)
**When to read**: ML model deployment, inference API design, GPU worker patterns, change-surface: ML or LLM integration
**Canonical owner**: `dev-backend` — serving architecture, API layer, runtime selection
**Non-goals**: Model training pipelines (→ `dev-data/references/ml-pipeline.md`), evaluation (→ `dev-testing/references/ml-evaluation.md`), prompt/RAG patterns (→ `llm-integration.md`)

---

## §1 Serving Architecture Decisions

| Pattern | Latency | Throughput | When to Use |
|---------|---------|------------|-------------|
| **Online (sync)** | <200ms | Medium | Real-time user-facing: chat, search, classification |
| **Online (async)** | <5s | High | SSE streaming, long generation, multi-step reasoning |
| **Batch** | Minutes–hours | Very high | Bulk scoring, embedding generation, nightly reports |
| **Streaming** | Continuous | Variable | Token-by-token LLM output, real-time audio/video |

### Request Flow Decision

| Client Expectation | Pattern | Implementation |
|--------------------|---------|----------------|
| Response <500ms, single result | Sync endpoint | `POST /predict` → JSON response |
| Response 1–30s, progressive output | SSE streaming | `POST /generate` → `text/event-stream` |
| Response >30s or fire-and-forget | Job queue | `POST /jobs` → 202 + `GET /jobs/{id}` poll |
| Periodic bulk processing | Cron/DAG trigger | Dagster/Airflow → batch inference script |

**Default**: async streaming for LLM, sync for classification/embedding, job queue for >30s tasks.

---

## §2 Runtime Selection 2026

| Runtime | Best For | Latency | Throughput | Status |
|---------|----------|---------|------------|--------|
| **vLLM 0.8+** | General LLM serving, OpenAI-compatible API | Low | High (PagedAttention, continuous batching) | ✅ Default choice |
| **SGLang** | Multi-model orchestration, structured generation | Low | High (RadixAttention) | ✅ Rising — best for constrained decoding |
| **TensorRT-LLM** | Maximum throughput on NVIDIA GPUs | Lowest | Highest | ✅ Production at scale |
| **BentoML 1.4+** | Multi-framework serving, custom pipelines | Medium | Medium | ✅ Good for non-LLM models |
| **Triton Inference Server** | Multi-model, multi-framework ensemble | Low | High | ✅ Enterprise/NVIDIA ecosystem |
| **TGI** | HuggingFace models | Medium | Medium | ⚠️ Maintenance mode — do not adopt for new projects |

### Decision Rule

```
IF   pure LLM serving       → vLLM (default) or SGLang (structured output)
IF   max NVIDIA perf needed  → TensorRT-LLM
IF   mixed model types       → BentoML or Triton
IF   existing TGI deployment → migrate to vLLM at next major version
```

---

## §3 FastAPI + GPU Worker Pattern

### Lifespan Model Loading

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
import torch

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load model ONCE at startup — never per-request
    app.state.model = torch.jit.load("model.pt", map_location="cuda:0")
    app.state.model.eval()
    yield
    # Cleanup on shutdown
    del app.state.model
    torch.cuda.empty_cache()

app = FastAPI(lifespan=lifespan)
```

### SSE Streaming Response

```python
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import asyncio

@app.post("/v1/generate")
async def generate(request: Request, body: GenerateRequest):
    async def stream_tokens():
        async for token in model.generate_stream(body.prompt):
            if await request.is_disconnected():
                break  # Stop GPU work on client disconnect
            yield f"data: {token.model_dump_json()}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        stream_tokens(),
        media_type="text/event-stream",
        headers={"X-Accel-Buffering": "no"},  # Disable nginx buffering
    )
```

### Dynamic Batching

```python
import asyncio
from collections import deque

class BatchProcessor:
    """Collect requests and process in GPU-efficient batches."""

    def __init__(self, model, max_batch: int = 32, max_wait_ms: float = 50):
        self._queue: deque = deque()
        self._model = model
        self._max_batch = max_batch
        self._max_wait_ms = max_wait_ms

    async def predict(self, input_data) -> dict:
        future = asyncio.get_event_loop().create_future()
        self._queue.append((input_data, future))
        if len(self._queue) >= self._max_batch:
            await self._flush()
        else:
            await asyncio.sleep(self._max_wait_ms / 1000)
            if not future.done():
                await self._flush()
        return await future

    async def _flush(self):
        batch = []
        futures = []
        while self._queue and len(batch) < self._max_batch:
            data, fut = self._queue.popleft()
            batch.append(data)
            futures.append(fut)
        if not batch:
            return
        results = await asyncio.to_thread(self._model.predict_batch, batch)
        for fut, result in zip(futures, results):
            if not fut.done():
                fut.set_result(result)
```

---

## §4 Model Versioning & Traffic Control

| Strategy | URL Shape | When to Use |
|----------|-----------|-------------|
| **URL routing** | `/v1/models/gpt4o-mini/generate` | Multi-model serving, explicit selection |
| **Header routing** | `X-Model-Version: 2024-06-01` | A/B testing, gradual rollout |
| **Canary** | 5% → 25% → 100% traffic shift | New model validation |
| **Shadow mode** | Dual inference, compare offline | Pre-production evaluation |

### Canary Deployment Checklist

- [ ] Deploy new model version alongside current
- [ ] Route 5% traffic to new version (load balancer weight)
- [ ] Monitor latency p50/p95/p99, error rate, output quality metrics
- [ ] Compare against baseline for ≥1 hour (or ≥10K requests)
- [ ] If metrics within ±5% of baseline → increase to 25% → 100%
- [ ] If degradation detected → instant rollback (shift weight to 0%)
- [ ] Log both versions' outputs for offline quality comparison

---

## §5 Optimization Techniques

| Technique | Speedup | Quality Impact | When to Use |
|-----------|---------|----------------|-------------|
| **FP16/BF16** | 2× | Negligible | Default for all GPU inference |
| **FP8 (H100+)** | 2× over FP16 | <1% loss | H100/H200 production serving |
| **INT4 (GPTQ/AWQ)** | 4× over FP16 | 1-3% loss | Edge deployment, cost reduction |
| **KV cache optimization** | 1.5-3× throughput | None | vLLM PagedAttention (automatic) |
| **Speculative decoding** | 2-3× latency | None | Long-form generation, draft model available |
| **Continuous batching** | 5-10× throughput | None | vLLM/SGLang (automatic) |

### Quantization Decision Rule

```
IF   H100/H200 available    → FP8 (best speed/quality tradeoff)
IF   A100/A10G available     → FP16/BF16
IF   edge/cost-constrained   → INT4 (AWQ > GPTQ for serving)
IF   embedding model         → FP16 always (quantization hurts retrieval)
```

---

## §6 Anti-Patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| Synchronous GPU inference in request handler | Thread pool exhaustion, p99 spikes | Use `asyncio.to_thread()` or dedicated worker process |
| Model loading per request | 30s+ cold starts, OOM | Lifespan-scoped loading (§3) |
| TGI for new projects | Vendor lock-in, maintenance mode | vLLM or SGLang |
| Lazy model init (first-request loading) | Unpredictable latency, health check lies | Eager loading in lifespan + readiness probe |
| Raw `torch.no_grad()` blocks in endpoints | Memory leaks, no batching | BatchProcessor pattern (§3) or vLLM |
| No client disconnect handling | Wasted GPU cycles | Check `request.is_disconnected()` in stream loop |
| Single-model single-GPU assumption | Cannot scale | Design for model registry + multi-GPU from start |

## Pre-flight Checklist

Before deploying ML serving:

- [ ] Model loaded in `lifespan` — not per-request, not lazy
- [ ] Streaming endpoints handle client disconnect
- [ ] Health check (`/health`) verifies model is loaded and GPU accessible
- [ ] Quantization level documented and benchmarked vs baseline
- [ ] Dynamic batching configured (max batch size + max wait time tuned)
- [ ] Canary deployment plan documented with rollback criteria
- [ ] Resource limits set: GPU memory, max concurrent requests, timeout

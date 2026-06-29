# ML Infrastructure — GPU Clusters, Model Registry, Serving

Last reviewed: 2026-06-16
Applies to: NVIDIA GPU clusters, model serving platforms, MLOps
When to read: ML infrastructure provisioning or model deployment
Canonical owner: dev-devops (infra layer); dev-backend owns API/serving code patterns

---

## §1 GPU Cluster Management

### Node Selection

| GPU | VRAM | Best For | K8s Resource |
|-----|------|----------|-------------|
| A100 (40/80GB) | 40-80GB | Training, large model inference | `nvidia.com/gpu: 1` |
| H100 (80GB) | 80GB | Large-scale training, HPC | `nvidia.com/gpu: 1` |
| L4 (24GB) | 24GB | Inference, cost-efficient | `nvidia.com/gpu: 1` |
| T4 (16GB) | 16GB | Light inference, dev/test | `nvidia.com/gpu: 1` |

### K8s GPU Scheduling

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: model-server
spec:
  template:
    spec:
      containers:
        - name: server
          image: model-server@sha256:abc123
          resources:
            limits:
              nvidia.com/gpu: 1
              memory: "32Gi"
            requests:
              nvidia.com/gpu: 1
              memory: "16Gi"
      nodeSelector:
        accelerator: nvidia-l4
      tolerations:
        - key: nvidia.com/gpu
          operator: Exists
          effect: NoSchedule
```

### Cost Optimization

| Strategy | Detail |
|----------|--------|
| Spot/preemptible | Training workloads (checkpointed) |
| Right-sizing | Match GPU VRAM to model size |
| Time-sharing | NVIDIA MPS for small inference models |
| Autoscaling | Scale-to-zero with KEDA for inference |

---

## §2 Model Registry

### Registry Selection

| Tool | Best For | Key Feature |
|------|----------|-------------|
| MLflow Model Registry | General MLOps | Versioning, staging, lineage |
| Weights & Biases | Experiment tracking + registry | Artifacts, sweeps, reports |
| HuggingFace Hub | Open-source models, LoRA adapters | Model cards, datasets |
| SageMaker Model Registry | AWS-native MLOps | Approval workflows |

### Model Versioning Contract

```
models/
  payments-fraud-detector/
    v1.0.0/
      model.onnx
      config.json
      metrics.json     # eval metrics at registration
      requirements.txt # inference dependencies
    v1.1.0/
      ...
```

| Rule | Detail |
|------|--------|
| SemVer | Major = breaking API change, Minor = improved metrics, Patch = fix |
| Immutable | Once registered, never overwrite — create new version |
| Metrics | Eval metrics recorded at registration time |
| Lineage | Link to training run, dataset version, code commit |

---

## §3 Model Serving Patterns

### Serving Architecture Decision

| Pattern | When | Tool |
|---------|------|------|
| REST/gRPC API | Low-medium throughput, general models | FastAPI, TorchServe, Triton |
| Batch inference | Large dataset, latency-tolerant | Spark, Ray, SageMaker Batch |
| Streaming | Real-time features, event-driven | Kafka + model sidecar |
| Edge inference | Latency-critical, privacy-sensitive | ONNX Runtime, TF Lite, Core ML |

### K8s Serving with Scale-to-Zero

```yaml
# KEDA ScaledObject for inference service
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: model-server-scaler
spec:
  scaleTargetRef:
    name: model-server
  minReplicaCount: 0  # scale to zero when idle
  maxReplicaCount: 10
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://prometheus:9090
        metricName: http_requests_total
        query: rate(http_requests_total{service="model-server"}[2m])
        threshold: "10"
  cooldownPeriod: 300  # 5min before scale-down
```

### Health Checks for Model Servers

```python
# FastAPI model server health
@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": model is not None}

@app.get("/ready")
async def ready():
    # Verify model can actually inference
    try:
        _ = model.predict(dummy_input)
        return {"status": "ready"}
    except Exception as e:
        return JSONResponse({"status": "not_ready", "error": str(e)}, status_code=503)
```

---

## §4 Edge Inference Triage

### Decision: Cloud vs Edge Inference

| Factor | Cloud | Edge |
|--------|-------|------|
| Latency requirement | >100ms acceptable | <50ms required |
| Model size | >1GB | <500MB (quantized) |
| Privacy | Data can leave device | Data must stay on device |
| Connectivity | Reliable network | Intermittent/offline |
| Update frequency | Frequent model updates | Infrequent, versioned |

### Edge Model Optimization Pipeline

```
Full model (PyTorch/TF)
  → Export to ONNX
  → Quantize (INT8/FP16)
  → Optimize (ONNX Runtime, TensorRT, Core ML)
  → Package with inference runtime
  → Deploy to edge device
```

### Runtime Selection

| Runtime | Platform | Best For |
|---------|----------|----------|
| ONNX Runtime | Cross-platform | General inference, web |
| TensorRT | NVIDIA GPU | GPU-optimized inference |
| Core ML | Apple devices | iOS/macOS on-device |
| TF Lite | Mobile/embedded | Android, IoT |

---

## §5 MLOps Platform Patterns

### Training Pipeline

```
Data versioning (DVC/LakeFS)
  → Feature engineering (dbt/Spark)
  → Training (distributed, GPU cluster)
  → Evaluation (automated metrics + human review)
  → Registration (model registry)
  → Deployment (CI/CD → serving infra)
  → Monitoring (data drift, model performance)
```

### Monitoring

| Signal | What to Watch | Alert On |
|--------|---------------|----------|
| Data drift | Feature distribution shift | KL divergence > threshold |
| Model performance | Accuracy, F1, latency | Degradation from baseline |
| Prediction distribution | Output class balance | Unexpected shift |
| Infrastructure | GPU utilization, memory, throughput | Saturation > 90% |

---

## §6 Anti-Patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| GPU always-on for batch | Burning money when idle | Scale-to-zero with KEDA |
| No model versioning | Can't rollback, can't reproduce | Model registry with SemVer |
| Training on spot without checkpoints | Lost hours of compute | Checkpoint every N steps |
| Serving without health checks | Silent model loading failures | `/health` + `/ready` endpoints |
| No data drift monitoring | Silent accuracy degradation | Automated drift detection |
| One-size GPU | Overpaying for inference | Right-size: L4/T4 for inference, A100/H100 for training |

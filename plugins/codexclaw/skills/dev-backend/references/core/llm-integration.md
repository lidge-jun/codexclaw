# LLM Integration Patterns

**Last reviewed**: 2026-07-02
**Applies to**: Python (LangChain 1.x, LlamaIndex 0.12+), TypeScript (Vercel AI SDK 4.x+), any LLM provider
**When to read**: RAG implementation, LLM API integration, structured output, prompt engineering, change-surface: ML or LLM integration
**Canonical owner**: `dev-backend` — integration patterns, API layer, provider abstraction
**Non-goals**: Model serving infrastructure (→ `ml-serving.md`), ML training (→ `dev-data/references/ml-pipeline.md`), security (→ `dev-security/references/llm-supply-chain.md`)

---

## §1 RAG Architecture

### Three-Stage Pipeline

```
Documents → Chunking → Embedding → Vector Store
                                        ↓
Query → Embedding → Hybrid Search → Reranking → Context Assembly → LLM → Response
```

### Chunking Strategy

| Strategy | Chunk Size | When to Use |
|----------|-----------|-------------|
| **Structure-aware** | Follows document headings/sections | Markdown, HTML, code — preserves semantic boundaries |
| **Recursive character** | 512–1024 tokens, 20% overlap | Plain text fallback |
| **Semantic** | Variable (embedding similarity) | Research papers, mixed-topic documents |
| **Parent-child** | Small chunks for retrieval, full sections for context | Best quality, higher storage cost |

**2026 default**: Structure-aware chunking with parent-child retrieval. Fixed-size chunking is a last resort.

### Hybrid Search (Dense + Sparse)

```python
from qdrant_client import QdrantClient, models

# Hybrid search: dense embeddings + sparse BM25
results = client.query_points(
    collection_name="docs",
    prefetch=[
        models.Prefetch(
            query=dense_embedding,      # Dense vector
            using="dense",
            limit=20,
        ),
        models.Prefetch(
            query=sparse_embedding,     # Sparse BM25/SPLADE
            using="sparse",
            limit=20,
        ),
    ],
    query=models.FusionQuery(fusion=models.Fusion.RRF),  # Reciprocal Rank Fusion
    limit=10,
)
```

### Reranking

Always rerank after initial retrieval. Cross-encoder rerankers dramatically improve precision:

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-12-v2")
pairs = [(query, doc.text) for doc in retrieved_docs]
scores = reranker.predict(pairs)
reranked = sorted(zip(retrieved_docs, scores), key=lambda x: x[1], reverse=True)
top_k = [doc for doc, _ in reranked[:5]]
```

---

## §2 Vector DB Selection

| Database | Best For | Hosting | Filtering | 2026 Status |
|----------|----------|---------|-----------|-------------|
| **pgvector** | Existing PostgreSQL, <10M vectors | Self-hosted / managed PG | Full SQL WHERE | ✅ Default for PostgreSQL shops |
| **Qdrant** | Hybrid search, large-scale, filtering | Self-hosted / cloud | Rich payload filters | ✅ Best balance of features |
| **Pinecone** | Managed, zero-ops, rapid prototype | Cloud only | Metadata filters | ✅ Fastest to start |
| **Weaviate** | Multi-modal, GraphQL API | Self-hosted / cloud | GraphQL filters | ✅ Multi-modal leader |
| **ChromaDB** | Local dev, prototyping | Embedded / self-hosted | Basic metadata | ⚠️ Dev only — not production |

### Decision Rule

```
IF   already using PostgreSQL + <5M vectors  → pgvector (simplest)
IF   need hybrid search + filtering at scale → Qdrant
IF   zero-ops + rapid prototype              → Pinecone
IF   multi-modal (text + images)             → Weaviate
```

---

## §3 Framework Selection 2026

### LangChain 1.x

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser

# 2026 default: current stable OpenAI flagship model for higher-capability extraction
llm = ChatOpenAI(model="gpt-5.5", temperature=0)

prompt = ChatPromptTemplate.from_messages([
    ("system", "Extract structured data from the user's message."),
    ("human", "{input}"),
])

chain = prompt | llm | PydanticOutputParser(pydantic_object=ExtractedData)
result = chain.invoke({"input": user_message})
```

### LlamaIndex 0.12 (AgentWorkflow)

```python
from llama_index.core.agent.workflow import AgentWorkflow
from llama_index.core.tools import FunctionTool

# v0.12: AgentWorkflow replaces legacy AgentRunner
def search_docs(query: str) -> str:
    """Search the document index."""
    return index.as_query_engine().query(query).response

agent = AgentWorkflow.from_tools_or_functions(
    tools_or_functions=[FunctionTool.from_defaults(fn=search_docs)],
    llm=llm,
    system_prompt="You are a helpful research assistant.",
)
response = await agent.run(user_msg="Find info about X")
```

### Framework Decision

| Factor | LangChain 1.x | LlamaIndex 0.12+ | Vercel AI SDK 4.x+ |
|--------|---------------|------------------|---------------------|
| **Best for** | Complex chains, multi-step agents | RAG-first, document Q&A | TypeScript/Next.js, streaming UI |
| **Learning curve** | Medium | Low-Medium | Low |
| **Streaming** | LCEL native | AgentWorkflow events | Built-in RSC streaming |
| **Structured output** | PydanticOutputParser | Structured LLM | `generateObject()` |

### Provider Model IDs

Use current provider docs before hard-pinning examples. As of this review, examples should prefer OpenAI `gpt-5.5` for high-capability extraction and Anthropic `claude-sonnet-5` for balanced Claude workloads; reserve higher-cost Claude IDs such as `claude-opus-4-8` for tasks that justify the latency/cost.

---

## §4 Structured Output

| Method | Provider Support | Reliability | When to Use |
|--------|-----------------|-------------|-------------|
| **JSON mode** | OpenAI, Anthropic, Gemini | High | Simple key-value extraction |
| **Function calling** | OpenAI, Anthropic, Gemini | Highest | Complex schemas, tool use |
| **Pydantic + instructor** | Any (wraps function calling) | Highest | Python apps needing validation |
| **Grammar-constrained** | vLLM, SGLang, llama.cpp | Guaranteed | Local models, strict format |

### Pydantic Schema Pattern

```python
import instructor
from pydantic import BaseModel, Field
from openai import OpenAI

class ExtractedEntity(BaseModel):
    name: str = Field(description="Entity name")
    entity_type: str = Field(description="person, org, or location")
    confidence: float = Field(ge=0, le=1)

client = instructor.from_openai(OpenAI())
entities = client.chat.completions.create(
    model="gpt-5.5",
    response_model=list[ExtractedEntity],
    messages=[{"role": "user", "content": text}],
)
# Returns validated Pydantic objects — no parsing needed
```

---

## §5 Prompt Patterns

| Pattern | When to Use | Example Shape |
|---------|-------------|---------------|
| **System/User/Assistant** | All conversations | `system:` role + context, `user:` query |
| **Few-shot** | Classification, extraction, formatting | 2-5 input/output examples in system prompt |
| **Chain-of-thought** | Reasoning, math, multi-step logic | "Think step by step before answering" |
| **Self-consistency** | High-stakes decisions | Sample N responses → majority vote |
| **ReAct** | Tool-using agents | Thought → Action → Observation loop |

### Prompt Template Discipline

```python
# ✅ Good: prompts in separate files, versioned
from pathlib import Path
SYSTEM_PROMPT = (Path(__file__).parent / "prompts" / "extract_v2.md").read_text()

# ❌ Bad: inline multi-line prompt strings
system_prompt = f"""You are a helpful assistant that..."""
```

- Keep prompts in version-controlled `.md` or `.txt` files
- Include prompt version in API response metadata for debugging
- A/B test prompt variants with consistent evaluation metrics

---

## §6 Security

Cross-reference `dev-security/references/llm-supply-chain.md` for the full LLM security guide.

**Minimum inline rules:**

- [ ] Sanitize user input before injecting into prompts — no raw string interpolation
- [ ] Set `max_tokens` limits on all LLM calls to prevent cost runaway
- [ ] Rate limit LLM endpoints (per-user, per-org) — GPU time is expensive
- [ ] Never expose raw model errors to clients — map to application error codes
- [ ] Log prompt/response pairs for audit (redact PII before logging)
- [ ] Validate structured outputs against schema before using in business logic

---

## §7 Anti-Patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| Fixed-size chunking for structured documents | Lost context, bad retrieval | Structure-aware chunking (§1) |
| Dense-only search | Misses keyword matches | Hybrid dense+sparse with RRF (§1) |
| No reranking | Low precision in top-k | Cross-encoder reranker (§1) |
| ChromaDB in production | Data loss, no filtering | pgvector, Qdrant, or Pinecone (§2) |
| Inline prompt strings | Unversioned, untestable | File-based prompts with versioning (§5) |
| Raw user input in prompts | Prompt injection | Input sanitization + guardrails (§6) |
| Unbounded `max_tokens` | Cost explosion | Always set explicit limits |

## Pre-flight Checklist

Before shipping LLM integration:

- [ ] Chunking strategy matches document structure (not fixed-size)
- [ ] Hybrid search configured (dense + sparse + reranking)
- [ ] Vector DB chosen with production filtering support
- [ ] Structured output validated via Pydantic/schema
- [ ] Prompts stored in version-controlled files
- [ ] Security checklist from §6 complete
- [ ] Cost controls: rate limits, max_tokens, budget alerts
- [ ] Fallback behavior defined for LLM provider outages

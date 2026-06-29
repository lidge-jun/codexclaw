# ML Model Evaluation

**Last reviewed**: 2026-06-16
**Applies to**: Python (DeepEval 2.x, RAGAS 0.2+, MLflow 3.x), LLM and classical ML evaluation
**When to read**: Model evaluation strategy, LLM quality gates, CI eval integration, or ML/LLM change surfaces
**Canonical owner**: `dev-testing` — evaluation methodology, CI integration, quality gates
**Non-goals**: Model training (→ `dev-data/references/ml-pipeline.md`), model serving (→ `dev-backend/references/core/ml-serving.md`), prompt design (→ `dev-backend/references/core/llm-integration.md`)

---

## §1 Evaluation Strategy

### Three-Stage Pipeline

| Stage | When | Purpose | Gate |
|-------|------|---------|------|
| **Offline eval** | Pre-deploy | Benchmark on held-out test set | Score ≥ threshold → CI pass |
| **CI gate** | Every PR | Automated regression check | No metric regression > tolerance |
| **Online A/B** | Post-deploy | Real-user impact measurement | Statistical significance → full rollout |

```
Code change → Offline eval (CI) → Deploy canary → Online A/B → Full rollout
                    ↓ fail                          ↓ fail
              Block merge                    Rollback canary
```

**Rule**: No model reaches production without passing all three stages. Offline eval is the minimum; skip online A/B only for non-user-facing models (batch pipelines).

---

## §2 LLM Evaluation

### LLM-as-Judge

Use a stronger model to evaluate a weaker model's output:

```python
from deepeval import evaluate
from deepeval.metrics import (
    AnswerRelevancyMetric,
    FaithfulnessMetric,
    ContextualRelevancyMetric,
)
from deepeval.test_case import LLMTestCase

test_case = LLMTestCase(
    input="What is the refund policy?",
    actual_output=model_response,
    expected_output="Refunds within 30 days of purchase.",
    retrieval_context=[retrieved_chunk_1, retrieved_chunk_2],
)

metrics = [
    AnswerRelevancyMetric(threshold=0.7, model="gpt-4o"),
    FaithfulnessMetric(threshold=0.8, model="gpt-4o"),
    ContextualRelevancyMetric(threshold=0.6, model="gpt-4o"),
]

results = evaluate(test_cases=[test_case], metrics=metrics)
```

### RAG Evaluation (RAGAS)

| Metric | What It Measures | Threshold |
|--------|-----------------|-----------|
| **Faithfulness** | Is the answer grounded in retrieved context? | ≥0.8 |
| **Answer relevancy** | Does the answer address the question? | ≥0.7 |
| **Context precision** | Are retrieved chunks relevant? | ≥0.6 |
| **Context recall** | Are all needed facts retrieved? | ≥0.7 |

```python
from ragas import evaluate as ragas_evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision

dataset = {  # HuggingFace Dataset format
    "question": questions,
    "answer": model_answers,
    "contexts": retrieved_contexts,
    "ground_truth": expected_answers,
}

results = ragas_evaluate(
    dataset=dataset,
    metrics=[faithfulness, answer_relevancy, context_precision],
)
# results → DataFrame with per-sample scores
```

### Evaluation Dataset Management

| Practice | Why |
|----------|-----|
| Curate ≥100 test cases per task | Statistical reliability |
| Include adversarial examples (10-20%) | Probe failure modes |
| Version eval datasets alongside code | Reproducible eval runs |
| Rotate human-reviewed examples quarterly | Prevent eval set overfitting |
| Separate eval set from few-shot examples | No data leakage |

---

## §3 Classical ML Metrics

| Task | Primary Metric | Secondary | When to Use |
|------|---------------|-----------|-------------|
| Binary classification | F1 / PR-AUC | ROC-AUC, precision, recall | Imbalanced classes → PR-AUC |
| Multi-class classification | Macro-F1 | Per-class F1, confusion matrix | Always report per-class |
| Regression | RMSE | MAE, R², MAPE | RMSE for optimization, MAE for interpretation |
| Ranking | NDCG@k | MRR, MAP | Search, recommendations |
| Clustering | Silhouette score | Calinski-Harabasz | When ground truth unavailable |

### Metric Selection Rule

```
IF   classes imbalanced (>10:1)  → PR-AUC + per-class F1 (never accuracy alone)
IF   regression with outliers    → MAE (robust) over RMSE
IF   ranking/retrieval           → NDCG@k where k matches UX (e.g., k=10 for search)
```

---

## §4 CI Integration

### Eval Gate in GitHub Actions

```yaml
# .github/workflows/ml-eval.yml
name: ML Evaluation Gate

on:
  pull_request:
    paths: ["models/**", "prompts/**", "src/ml/**"]

jobs:
  eval:
    runs-on: ubuntu-latest  # or self-hosted GPU runner
    steps:
      - uses: actions/checkout@v4

      - name: Run evaluation suite
        run: |
          python -m pytest tests/eval/ \
            --tb=short \
            -v \
            --junitxml=eval-results.xml

      - name: Check regression
        run: |
          python scripts/check_eval_regression.py \
            --baseline=eval-baseline.json \
            --current=eval-results.json \
            --tolerance=0.02  # Block if any metric drops >2%

      - name: Upload eval report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: eval-report
          path: eval-results/
```

### Regression Detection Pattern

```python
# scripts/check_eval_regression.py
import json, sys

def check_regression(baseline_path: str, current_path: str, tolerance: float):
    baseline = json.loads(open(baseline_path).read())
    current = json.loads(open(current_path).read())

    regressions = []
    for metric, base_val in baseline.items():
        curr_val = current.get(metric, 0)
        if base_val - curr_val > tolerance:
            regressions.append(
                f"{metric}: {base_val:.4f} → {curr_val:.4f} "
                f"(Δ={curr_val - base_val:+.4f}, tolerance={tolerance})"
            )

    if regressions:
        print("❌ Regression detected:")
        for r in regressions:
            print(f"  {r}")
        sys.exit(1)
    else:
        print("✅ All metrics within tolerance")
```

---

## §5 Anti-Patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| Accuracy as sole metric for imbalanced data | 95% accuracy with 0% minority recall | PR-AUC + per-class F1 (§3) |
| No eval dataset versioning | "Scores improved" but eval set changed | Version alongside code (§2) |
| Manual-only LLM evaluation | Inconsistent, slow, not scalable | LLM-as-judge + RAGAS (§2) |
| Same data for few-shot and eval | Inflated scores | Strict separation |
| No regression gate in CI | Silent quality degradation | Automated eval gate (§4) |
| Single-metric threshold | Model good at average, bad at edges | Multi-metric + adversarial cases (§2) |
| Eval only at release | Late discovery of regressions | Eval on every PR touching model/prompt code |

## Pre-flight Checklist

Before merging model or prompt changes:

- [ ] Offline eval run completed with current eval dataset version logged
- [ ] All metrics above configured thresholds (no single-metric pass)
- [ ] Regression check passed (no metric dropped > tolerance vs baseline)
- [ ] Adversarial test cases included (≥10% of eval set)
- [ ] Eval dataset versioned and not overlapping with training/few-shot data
- [ ] CI eval gate configured for paths touching model/prompt code
- [ ] For LLM changes: faithfulness ≥0.8, relevancy ≥0.7 (RAGAS/DeepEval)
- [ ] Eval report artifact uploaded and linked in PR

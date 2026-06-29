# ML Pipeline Engineering

**Last reviewed**: 2026-06-16
**Applies to**: Python (MLflow 3.x, Dagster 1.9+, DVC 3.x), GPU training (PyTorch 2.6+)
**When to read**: ML training pipelines, experiment tracking, feature stores, data versioning, ML or feature-pipeline work
**Canonical owner**: `dev-data` — pipeline orchestration, data versioning, feature engineering
**Non-goals**: Model serving (→ `dev-backend/references/core/ml-serving.md`), LLM integration (→ `dev-backend/references/core/llm-integration.md`), model evaluation (→ `dev-testing/references/ml-evaluation.md`)

---

## §1 ML Pipeline Principles

| Principle | What It Means |
|-----------|---------------|
| **Reproducibility** | Same code + same data + same config = same model. Pin library versions, fix random seeds, log all hyperparameters. |
| **Version everything** | Code (git), data (DVC/Delta), models (MLflow registry), configs (hydra/yaml in repo). |
| **Experiment tracking** | Every training run logged with metrics, params, artifacts. No "which run was that?" moments. |
| **Idempotent pipelines** | Re-running a pipeline stage with same inputs produces same outputs. Use content-addressable caching. |
| **Fail fast** | Validate data schema and distributions BEFORE training. Don't waste GPU hours on bad data. |

---

## §2 Experiment Tracking

| Platform | Best For | Hosting | 2026 Status |
|----------|----------|---------|-------------|
| **MLflow 3.x** | Full lifecycle (track → register → serve) | Self-hosted / Databricks | ✅ Default — unified API, broad ecosystem |
| **W&B (Weights & Biases)** | Rich visualization, team collaboration | Cloud (free tier) / self-hosted | ✅ Best UI, expensive at scale |
| **Dagster+** | Pipeline-integrated tracking | Dagster Cloud / self-hosted | ✅ If already using Dagster for orchestration |

### MLflow 3.x Tracking Pattern

```python
import mlflow

mlflow.set_tracking_uri("http://mlflow.internal:5000")
mlflow.set_experiment("recommender-v2")

with mlflow.start_run(run_name="baseline-transformer"):
    mlflow.log_params({
        "model": "transformer",
        "lr": 1e-4,
        "batch_size": 64,
        "epochs": 50,
        "data_version": "v2.3.1",  # DVC tag or Delta version
    })

    for epoch in range(50):
        metrics = train_one_epoch(model, train_loader)
        mlflow.log_metrics(metrics, step=epoch)

        if epoch % 10 == 0:
            # Checkpoint every 10 epochs
            mlflow.pytorch.log_model(model, f"checkpoint-{epoch}")

    # Log final model to registry
    mlflow.pytorch.log_model(
        model,
        "model",
        registered_model_name="recommender",
    )
    mlflow.log_artifact("configs/train.yaml")
```

### Decision Rule

```
IF   need full lifecycle (track + register + deploy)  → MLflow 3.x
IF   team wants rich dashboards + collaboration       → W&B (log to both if needed)
IF   pipeline orchestration already in Dagster         → use Dagster+ tracking
```

---

## §3 Feature Store

| Platform | Online Serving | Offline Training | 2026 Status |
|----------|---------------|-----------------|-------------|
| **Feast 0.40+** | Redis, DynamoDB, PostgreSQL | BigQuery, Snowflake, file | ✅ Default — open source, flexible |
| **Tecton** | Managed low-latency | Managed | ✅ Enterprise, expensive |
| **Custom** | Redis/PostgreSQL | SQL warehouse | ⚠️ Only if <10 features |

### Feast Pattern

```python
from feast import FeatureStore

store = FeatureStore(repo_path="feature_repo/")

# Offline: training data retrieval (point-in-time correct)
training_df = store.get_historical_features(
    entity_df=entity_df,  # DataFrame with entity keys + timestamps
    features=[
        "user_features:purchase_count_30d",
        "user_features:avg_session_duration",
        "item_features:category_embedding",
    ],
).to_df()

# Online: real-time serving
features = store.get_online_features(
    features=["user_features:purchase_count_30d"],
    entity_rows=[{"user_id": "abc123"}],
).to_dict()
```

### When to Use a Feature Store

| Condition | Feature Store? |
|-----------|---------------|
| Same features used in training AND serving | ✅ Yes — prevents train/serve skew |
| >20 ML features shared across models | ✅ Yes — single source of truth |
| <10 features, single model | ❌ Overkill — compute inline |
| Real-time features from streaming sources | ✅ Yes — Feast + Kafka materialization |

---

## §4 Training Pipeline Orchestration

### Dagster DAG Pattern

```python
from dagster import asset, define_asset_job, Definitions
import mlflow

@asset
def raw_data():
    """Extract raw data from source."""
    return pd.read_parquet("s3://data/raw/events.parquet")

@asset
def processed_data(raw_data):
    """Validate schema, clean, feature-engineer."""
    validated = validate_schema(raw_data, expected_schema)
    cleaned = remove_outliers(validated)
    return engineer_features(cleaned)

@asset
def trained_model(processed_data):
    """Train model with experiment tracking."""
    with mlflow.start_run():
        model = train(processed_data)
        metrics = evaluate(model, test_split(processed_data))
        mlflow.log_metrics(metrics)
        mlflow.pytorch.log_model(model, "model",
            registered_model_name="my-model")
    return model

training_job = define_asset_job("training_pipeline",
    selection=["raw_data", "processed_data", "trained_model"])

defs = Definitions(
    assets=[raw_data, processed_data, trained_model],
    jobs=[training_job],
)
```

### GPU Resource Management

| Practice | Why |
|----------|-----|
| Request specific GPU type in job config | Avoid training on wrong GPU (A10G vs H100) |
| Set `CUDA_VISIBLE_DEVICES` | Prevent multi-tenant GPU conflicts |
| Checkpoint every N epochs | Resume after preemption; don't lose hours of work |
| Use mixed precision (`torch.amp`) | 2× speedup, half memory — no quality loss on modern GPUs |
| Set `max_epochs` + early stopping | Prevent runaway training costs |

---

## §5 Data Versioning

| Tool | Best For | 2026 Status |
|------|----------|-------------|
| **DVC 3.x** | File-based datasets (images, CSVs, Parquet) | ✅ Default — git-like workflow |
| **Delta Lake 3.x** | Tabular data, time travel, ACID transactions | ✅ Best for data lake/warehouse |
| **LakeFS** | Git-like branching for data lakes | ✅ Advanced — multi-branch experimentation |

### DVC Workflow

```bash
# Track a large dataset
dvc add data/training/images/
git add data/training/images.dvc .gitignore
git commit -m "data: add training images v1"
git tag data-v1.0

# Reproduce pipeline
dvc repro  # Runs only changed stages (content-addressable)

# Switch to a different data version
git checkout data-v2.0
dvc checkout  # Pulls the matching data version from remote
```

### Version Linking Checklist

- [ ] Every training run logs `data_version` (DVC tag or Delta version) in experiment tracker
- [ ] Model registry entry includes data version used for training
- [ ] Promotion to production requires matching data version documented
- [ ] Data schema changes trigger model retraining CI job

---

## §6 Anti-Patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| Training without experiment tracking | "Which hyperparams worked?" — nobody knows | MLflow/W&B from day one (§2) |
| Unversioned training data | Non-reproducible models | DVC or Delta Lake (§5) |
| Feature computation in both training and serving code | Train/serve skew, silent accuracy drops | Feature store (§3) |
| No checkpointing | Lost GPU hours on preemption | Checkpoint every N epochs (§4) |
| Manual GPU allocation | Resource conflicts, idle GPUs | Job scheduler with GPU requests (§4) |
| `pip install` without pinned versions | "Works on my machine" failures | `uv.lock` or `requirements.txt` with exact pins |
| Training on full data without validation split | Overfitting, no early stopping signal | Always hold out validation + test splits |

## Pre-flight Checklist

Before running ML training:

- [ ] Experiment tracker configured and logging params/metrics/artifacts
- [ ] Training data versioned (DVC tag or Delta version recorded)
- [ ] Data schema validated before training starts
- [ ] Checkpointing configured (frequency, storage location)
- [ ] GPU resources explicitly requested (type, count, memory)
- [ ] Reproducibility: random seeds fixed, library versions pinned
- [ ] Pipeline is idempotent — re-run produces same output
- [ ] Model registry configured for promotion workflow (staging → production)

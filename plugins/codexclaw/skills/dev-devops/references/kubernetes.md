# Kubernetes — Deployment & Orchestration Patterns

Last reviewed: 2026-07-02
Applies to: Kubernetes 1.32+, Gateway API v1.5
When to read: K8s deployment tasks
Canonical owner: dev-devops §3

---

## §1 Gateway API v1.5 (2026 Standard)

Gateway API is the successor for new Kubernetes traffic routing; Ingress remains GA but feature-frozen.

### Role Separation

| Role | Owns | Resources |
|------|------|-----------|
| Platform team | Cluster-wide infra | `GatewayClass`, `Gateway` |
| App team | Per-service routing | `HTTPRoute`, `ReferenceGrant` |

### GatewayClass + Gateway

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: cloud-lb
spec:
  controllerName: example.com/gateway-controller
---
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: shared-gateway
  namespace: infra
spec:
  gatewayClassName: cloud-lb
  listeners:
    - name: https
      protocol: HTTPS
      port: 443
      tls:
        mode: Terminate
        certificateRefs:
          - name: wildcard-cert
```

### HTTPRoute

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: payments-route
  namespace: payments
spec:
  parentRefs:
    - name: shared-gateway
      namespace: infra
  hostnames: ["payments.example.com"]
  rules:
    - matches:
        - path: { type: PathPrefix, value: /api }
      backendRefs:
        - name: payments-svc
          port: 8080
    - matches:
        - path: { type: PathPrefix, value: /webhooks }
      backendRefs:
        - name: webhooks-svc
          port: 8081
```

### ReferenceGrant (Cross-Namespace)

```yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata:
  name: allow-infra-gateway
  namespace: payments
spec:
  from:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      namespace: infra
  to:
    - group: ""
      kind: Service
```

### Ingress → Gateway API Migration Checklist

- [ ] Replace `Ingress` resources with `HTTPRoute`
- [ ] Move annotations to structured fields (path types, header matches)
- [ ] Set up `GatewayClass` + `Gateway` (platform team)
- [ ] Add `ReferenceGrant` for cross-namespace routes
- [ ] Verify TLS termination on Gateway listener
- [ ] Test with `kubectl get httproute -A` and verify `Accepted` condition

---

## §2 Kustomize Patterns

### Directory Structure

```
apps/
  payments/
    base/
      deployment.yaml
      service.yaml
      httproute.yaml
      kustomization.yaml
    overlays/
      dev/
        kustomization.yaml
        replicas-patch.yaml
      staging/
        kustomization.yaml
      prod/
        kustomization.yaml
        resource-patch.yaml
platform/
  gateway/
    gatewayclass.yaml
    gateway.yaml
    kustomization.yaml
```

### Base kustomization.yaml

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
  - httproute.yaml
labels:
  - includeSelectors: true
    pairs:
      app: payments
```

### Overlay Example (prod)

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base
patches:
  - path: resource-patch.yaml
images:
  - name: payments
    newTag: v2.3.1
    digest: sha256:abc123...
configMapGenerator:
  - name: payments-config
    literals:
      - LOG_LEVEL=warn
      - ENVIRONMENT=production
```

### Validation

```bash
# Preview rendered manifests
kubectl kustomize overlays/prod

# Dry-run against cluster
kubectl kustomize overlays/prod | kubectl apply --dry-run=server -f -
```

---

## §3 Resource Management

### Requests and Limits Guidelines

| Resource | Request | Limit | Rationale |
|----------|---------|-------|-----------|
| CPU | 100m–500m | 2×–4× request | Allow burst; requests guarantee scheduling |
| Memory | Measured P95 usage | ≈ request (tight) | OOM-kill on exceed; keep close to request |

### HPA Configuration

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: payments-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: payments
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 70 }
    - type: Pods
      pods:
        metric: { name: http_requests_per_second }
        target: { type: AverageValue, averageValue: "100" }
```

### VPA Modes

| Mode | Behavior | Use When |
|------|----------|----------|
| Off | Recommendations only | Alongside HPA (don't combine on same metric) |
| Initial | Set on pod creation | New services without usage data |
| Auto | Live updates | Standalone (no HPA on same resource) |

### PDB

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: payments-pdb
spec:
  minAvailable: "50%"
  selector:
    matchLabels:
      app: payments
```

---

## §4 Helm Patterns

### Values Separation

```bash
helm install payments ./chart \
  -f values.yaml \
  -f values-prod.yaml \
  --set image.digest=sha256:abc123
```

| Rule | Detail |
|------|--------|
| Version | Chart version follows SemVer |
| Validation | `helm template --debug \| kubectl apply --dry-run=client -f -` |
| Environment | `values-dev.yaml`, `values-staging.yaml`, `values-prod.yaml` |

### Helm vs Kustomize Decision

| Factor | Helm | Kustomize |
|--------|------|-----------|
| Templating | Rich (`{{ .Values }}`, conditionals, loops) | Patch-based (strategic merge) |
| Sharing | Chart repos, versioned packages | Directory copies |
| Complexity | Higher (template language) | Lower (YAML patches) |
| Best for | Shared charts, complex config | Simple overlays, in-house apps |

---

## §5 ArgoCD GitOps Patterns

### Application CRD

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: payments
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/org/deploy.git
    path: apps/payments/overlays/prod
    targetRevision: main
  destination:
    server: https://kubernetes.default.svc
    namespace: payments
  syncPolicy:
    automated:
      selfHeal: true
      prune: true
    syncOptions:
      - CreateNamespace=true
```

### Sync Waves

```yaml
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "0"  # namespace, configmaps first
---
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "1"  # deployments second
```

### ApplicationSet (Multi-Env)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: payments
spec:
  generators:
    - list:
        elements:
          - env: dev
            cluster: dev-cluster
          - env: prod
            cluster: prod-cluster
  template:
    spec:
      source:
        path: "apps/payments/overlays/{{env}}"
      destination:
        server: "{{cluster}}"
```

---

## §6 Anti-Patterns (Detailed)

| Banned | Why | Fix |
|--------|-----|-----|
| `Ingress` (new projects) | Feature-frozen; Gateway API (`HTTPRoute`) is the successor — prefer it for new routing (DEFAULT) | `HTTPRoute` with structured fields |
| No resource limits | Noisy neighbor; OOM kills random pods | Always set requests + limits |
| `image: app:latest` | Irreproducible; ArgoCD can't detect changes | SHA digest or pinned SemVer |
| Single replica (prod) | Zero availability during updates/failures | Minimum 2 replicas + PDB |
| Secrets in ConfigMap | Base64 is not encryption; exposed in logs | K8s Secret + External Secrets Operator |
| `kubectl apply` from CI | No audit trail, no drift detection | GitOps via ArgoCD |
| Manual `kubectl edit` | Drift from desired state | All changes via Git |

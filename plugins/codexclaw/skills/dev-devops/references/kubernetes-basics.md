## §3 Kubernetes Basics

### §3.1 Minimum Viable K8s (DEFAULT)

| Resource | Purpose |
|----------|---------|
| Deployment | Pod template + replica management |
| Service | Internal networking |
| HTTPRoute (Gateway API) | External traffic routing — **not Ingress** |
| ResourceQuota | Request/limit enforcement |
| Probes | Liveness + readiness + startup |
| Namespace | Environment isolation (dev/staging/prod) |

### §3.2 Gateway API (v1.6+, verified 2026-07-02 — TCPRoute/UDPRoute GA in v1.6)

Gateway API is the successor for new routing while Ingress remains GA but feature-frozen. Role separation: platform team owns `GatewayClass` + `Gateway`, app team owns `HTTPRoute`.

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: payments-route
spec:
  parentRefs:
    - name: shared-gateway
  hostnames: ["payments.example.com"]
  rules:
    - matches:
        - path: { type: PathPrefix, value: /api }
      backendRefs:
        - name: payments-svc
          port: 8080
```

### §3.3 Scaling (DEFAULT)

| Mechanism | Scope | Watch |
|-----------|-------|-------|
| HPA | CPU/memory + custom metrics | Don't combine with VPA on same metric |
| VPA | Request auto-tuning | Use `Off` mode for recommendations only |
| PDB | Disruption budget | `minAvailable: 50%` or `maxUnavailable: 1` |

### §3.4 Anti-Patterns

| Banned | Fix |
|--------|-----|
| `Ingress` (new projects) | Gateway API `HTTPRoute` |
| No resource limits | Always set requests + limits |
| `image: app:latest` | SHA digest or pinned SemVer |
| Single replica in prod | Minimum 2 + PDB |
| Secrets in ConfigMap | K8s Secret + External Secrets Operator |
| Annotation-based routing | Gateway API native fields |

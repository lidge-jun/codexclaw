## 6. Review Integration

### Architecture Review Checklist (for code-reviewer)

When reviewing any PR that adds/modifies module structure, verify:

- [ ] **No new circular dependencies** — run `madge --circular` or equivalent
- [ ] **Layer violations** — no upward imports (infra->domain OK, domain->infra BLOCKED)
- [ ] **Coupling classified** — any new cross-module dependency has coupling type identified
- [ ] **No CRITICAL/HIGH coupling without justification** — Content/Common/Control coupling blocked
- [ ] **Barrel files** — no new internal barrels; existing public barrels use named exports only
- [ ] **Validation placement** — parse untrusted shape at ingress; enforce domain invariants in their owner and preserve required security checks
- [ ] **Module size** — review >400 LOC for cohesion; document a justified exception rather than blocking by size alone
- [ ] **No "utils" growth** — shared code placed in domain-specific module, not catch-all utils
- [ ] **Dependency direction** — dependencies point inward toward Domain: outer layers depend on inner layers (Presentation/Application/Infrastructure -> Domain), and inner layers never import outward
- [ ] **No lazy-import hacks** — no `require()` inside function body to hide circular deps

### Automated Enforcement (CI Recommendations)

| Check | Tool | CI Command |
|-------|------|------------|
| Layer/dependency rules (preferred CI gate) | dependency-cruiser | `npx depcruise --validate .dependency-cruiser.cjs src/` |
| Circular deps (quick visualization) | madge | `npx madge --circular --extensions ts,tsx src/ && echo "OK"` |
| Dead files/exports/deps | knip | `npx knip` |
| Monorepo package consistency | sherif | `npx sherif` |
| Import boundaries | eslint-plugin-boundaries | ESLint with boundaries config |
| Layer violations | dependency-cruiser | `npx depcruise --validate .dependency-cruiser.cjs src/` |
| Barrel abuse | custom ESLint rule | `no-restricted-imports` pattern for internal index files |
| Module size | custom script | `find src -name '*.ts' -exec wc -l {} + | awk '$1 > 400'` |

On Windows without Unix tools, use PowerShell equivalents: `Get-ChildItem -Recurse`,
`Measure-Object`, `Select-String`.

---

## Cross-Skill References

- **Observability**: Trace emission at module boundaries is a production/long-lived-runtime concern (DEFAULT there, not universal). See `../../dev-backend/references/core/observability.md` for the canonical OTel setup.
- **Security**: Validate at every trust/process/external boundary (HTTP entry, IPC, file/CLI input, third-party responses). Intra-trust-domain module calls follow [§4 boundary-only defense](../SKILL.md#4-boundary-only-defensive-programming) — do not re-validate already-trusted data. See `../../dev-security/SKILL.md` for input validation and auth patterns.
- Coupling and boundary review: see `dev-code-reviewer`.
- Debugging escalation for boundary or coupling issues: see `dev-debugging`.
- Infrastructure architecture and deployment boundaries: see `dev-devops`.

---

## Quick Decision Trees

### "Should I create a new module?"

```
Does the code serve a distinct responsibility?
  NO  -> Keep in existing module
  YES -> Is it used by 3+ other modules?
    NO  -> Co-locate with primary consumer
    YES -> Create dedicated module with clear interface
```

### "Is this coupling acceptable?"

```
What type? (see taxonomy above)
  Content/Common -> BLOCK, refactor now
  Control/Stamp/External -> BLOCK unless tech-debt ticket created
  Temporal -> ALLOW with documentation
  Sequential/Functional -> ALLOW
```

### "Where does this validation go?"

```
Is the data source external (HTTP, file, queue, DB, user input)?
  YES -> Validate here (boundary)
  NO  -> Is this a security-critical path or a domain/state invariant?
    YES -> Enforce the relevant invariant/authorization in its owner
    NO  -> Avoid duplicating already-proven shape validation
```

---

## Structural Index Concept (ARCH-INDEX-01, DEFAULT)

Instead of reconstructing a module map for every task, maintain a lightweight
structural index that agents can query:

- Use `cxc map <dir>` for on-demand symbol-level maps (already shipped).
- For larger repos, consider a persistent dependency graph artifact (e.g.,
  `dependency-cruiser` JSON, Nx project graph, or a custom SQLite index).
- The index should track: module → exports, module → imports, symbol → callers.
- Freshness: re-generate on significant structural changes (new modules, moved files).
- Query before editing: "what depends on this module?" should be answerable from
  the index without a full codebase scan.

This is a guidance concept, not a shipped tool. The agent should check for existing
index artifacts before running ad-hoc scans.

## Architecture Conformance Tests (ARCH-CONFORMANCE-01, DEFAULT)

Architecture rules that exist only as prose are invisible to CI. For C3+ work
where boundary violations would cause real harm:

- Generate tool-specific configs from architecture decisions (dependency-cruiser
  rules, ESLint boundaries plugin, Nx enforce-module-boundaries, Go `depguard`).
- Include at least one allowed-edge and one forbidden-edge test fixture.
- The CI gate should FAIL on new violations while allowing a baselined set of
  legacy violations (ratcheting: new cycles fail, old ones are migrated).
- Return a machine-readable report (JSON or SARIF) that agents can consume.

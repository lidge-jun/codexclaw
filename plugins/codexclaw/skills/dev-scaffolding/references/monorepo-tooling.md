# Monorepo Tooling — Turborepo vs Nx (2026)

Last reviewed: 2026-06-16
Applies to: Turborepo 2.x, Nx 21.x
When to read: Setting up or optimizing a monorepo build system
Canonical owner: dev-scaffolding

Cross-ref: `dev-architecture` (module boundaries, dependency rules), `dev-devops` (CI optimization)

## 1. Decision Table: Turborepo vs Nx

| Factor | Turborepo 2.x | Nx 21.x |
|--------|--------------|---------|
| **Philosophy** | Build orchestrator — minimal, fast, zero-config start | Full platform — graph analysis, code generation, migrations |
| **Setup complexity** | Low — `npx turbo init`, works with existing package.json scripts | Medium — `npx create-nx-workspace`, opinionated project structure |
| **Task graph** | Inferred from `package.json` scripts + `turbo.json` pipeline | Explicit project graph with `project.json` or inferred from `package.json` |
| **Remote cache** | Vercel Remote Cache (free tier) or self-hosted (Turborepo server) | Nx Cloud (free tier) or self-hosted (Nx Powerpack) |
| **Code generation** | None built-in — use custom scripts | Built-in generators (`nx generate`), community plugins |
| **Migrations** | Manual — update `turbo.json` and scripts | Automated migrations (`nx migrate`) across framework versions |
| **IDE support** | Standard — relies on TypeScript project references | Nx Console extension for VSCode/WebStorm |
| **Affected analysis** | Basic — file hash comparison | Advanced — project graph + file dependency analysis |
| **Bundle size impact** | None — CLI tool only, not in app bundle | None — CLI tool only |
| **Community** | Vercel ecosystem, simpler community | Larger plugin ecosystem, enterprise adoption |

**Decision guide:**

| Situation | Choose | Why |
|-----------|--------|-----|
| Small-medium monorepo (2-10 packages), existing npm scripts | Turborepo | Minimal config, works with existing setup |
| Large monorepo (10+ packages), need code generation and migrations | Nx | Full platform features justify the complexity |
| Vercel deployment | Turborepo | Native integration, zero-config remote cache |
| Enterprise with strict dependency boundaries | Nx | Module boundary enforcement, project graph constraints |
| AI agent operating on monorepo | Either — see §2 | Both support `affected` filtering; Nx gives richer graph data |

## 2. Task Graph for AI Agents

AI agents benefit from predictable, deterministic task execution:

| Capability | How to Use | Turborepo | Nx |
|-----------|-----------|-----------|-----|
| Run only affected | `turbo run test --filter=...[HEAD~1]` | `nx affected -t test` | Both support; Nx is more granular |
| Dependency graph | `turbo run build --graph` | `nx graph` | Both generate; Nx provides interactive UI |
| Parallel execution | Automatic based on graph | Automatic based on graph | Both parallelize independent tasks |
| Cache hit detection | `turbo run build --dry` | `nx run-many -t build --dry-run` | Check cache status before running |
| Task targeting | `turbo run test --filter=@scope/pkg` | `nx run @scope/pkg:test` | Target specific package tasks |

Rules for AI agents working in monorepos:
- Always use `--affected` or `--filter` to scope work — never run all tasks across all packages.
- Check cache status with dry-run before executing — avoid redundant work.
- Use the dependency graph to determine build order — do not guess.
- When modifying shared packages, verify downstream consumers with affected analysis.

```bash
# Turborepo: run tests only for packages affected by recent changes
turbo run test --filter=...[HEAD~1]

# Nx: same concept
nx affected -t test --base=HEAD~1

# Turborepo: visualize task graph
turbo run build --graph

# Nx: interactive dependency graph
nx graph
```

## 3. Synthetic Monorepos (Nx)

Nx can manage projects that are not traditional npm workspaces:

| Use Case | Setup | When Useful |
|----------|-------|-------------|
| Polyglot repo (TS + Python + Go) | Nx with custom executors per language | CI orchestration across language boundaries |
| Non-package directories as projects | `project.json` in each directory | Legacy repos being incrementally monorepo-ified |
| Virtual packages | `nx.json` defines implicit dependencies | Documentation, infrastructure-as-code alongside app code |

Rules:
- Use synthetic projects only when the alternative is a custom build system.
- Each synthetic project must have explicit `targets` in `project.json` — implicit conventions break for non-standard layouts.
- Test that `nx affected` correctly identifies synthetic project dependencies before relying on it.

## 4. CI Optimization

| Technique | Turborepo | Nx | Impact |
|-----------|-----------|-----|--------|
| Remote cache | `TURBO_TOKEN` + `TURBO_TEAM` env vars | `NX_CLOUD_ACCESS_TOKEN` env var | 60-90% CI time reduction on cache hit |
| Affected only | `--filter=...[base..head]` | `--base=base --head=head` | Skip unchanged packages entirely |
| Parallel tasks | Default (based on CPU cores) | `--parallel=N` | Saturate CI runner CPU |
| Distributed execution | Vercel Remote Cache shares across runners | Nx Agents distribute tasks across machines | For very large monorepos (50+ packages) |

```yaml
# GitHub Actions — Turborepo with remote cache
- name: Build affected
  run: turbo run build test lint --filter=...[origin/main...HEAD]
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ vars.TURBO_TEAM }}

# GitHub Actions — Nx with affected
- name: Build affected
  run: npx nx affected -t build test lint --base=origin/main
  env:
    NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}
```

Rules:
- Always set up remote cache — local-only cache does not help CI.
- CI must use `affected` filtering with the merge base as reference.
- Cache keys must include OS, Node version, and lockfile hash.
- Periodically verify cache correctness by running a full build (weekly or on release branches).

## 5. Anti-Patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| Running all tasks in CI | 30-minute CI on a 2-line change | Use `affected` / `--filter` (§4) |
| No remote cache | Every CI run rebuilds from scratch | Configure Vercel/Nx Cloud or self-hosted cache (§4) |
| Circular package dependencies | Build fails unpredictably, task graph errors | Enforce boundaries with `@nx/enforce-module-boundaries` or `turbo` pipeline ordering |
| Mixing Turborepo and Nx in same repo | Conflicting task runners, cache confusion | Choose one — see §1 decision table |
| `*` dependencies between workspace packages | Phantom version resolution, non-deterministic builds | Use `workspace:*` protocol or exact version pins |

## Pre-flight

- [ ] Monorepo tool chosen with documented rationale (§1)
- [ ] Remote cache configured and verified in CI (§4)
- [ ] `affected` filtering used in CI pipeline — no full-repo runs on PRs (§4)
- [ ] Package dependency graph has no circular dependencies
- [ ] AI agents use `affected`/`filter` and dry-run before executing tasks (§2)

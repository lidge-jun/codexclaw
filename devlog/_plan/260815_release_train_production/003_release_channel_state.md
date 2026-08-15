# 003 — Release channel state and what a production train requires

Status: ANALYZED

Source: dedicated read-only research pass over the live repository, GitHub API,
and the local `codex` CLI (2026-08-15, checkout `dev` @ `15b3d44a`).

## What exists today

```
$ gh release list --repo lidge-jun/codexclaw
codexclaw v0.1.0 — first public release  Latest  v0.1.0  2026-07-06T21:14:24Z

$ gh release view v0.1.0 --json assets,targetCommitish,isPrerelease
{"assets":[], "targetCommitish":"main", "isPrerelease":false}
```

- **No assets.** The release carries only GitHub's automatic source archives.
- **Unsigned tag**, tagged by `bitkyc08-arch`, pointing at `c266bb06`.
- **No workflow produced it**: `gh run list --event release` returns `[]`; the only
  run near the tag commit was ordinary push CI (`28823710922`).

Workflow inventory: `ci.yml`, `docs.yml`, `enforce-pr-target.yml`. What is absent:

- no `push.tags` trigger, no `release` trigger, no release-scoped dispatch
- no workflow anywhere holds `contents: write`
- no archive, checksum, signature, SBOM, or attestation step
- no `gh release create` / upload step
- no packed-install or uninstall smoke job
- CI matrix is ubuntu + windows only; macOS is untested despite being the primary
  development platform

Branch protection, checked directly rather than assumed:

```
$ gh api repos/lidge-jun/codexclaw/branches/main --jq '{protected,protection}'
{"protected":false,"protection":{"enabled":false,
 "required_status_checks":{"checks":[],"contexts":[],"enforcement_level":"off"}}}
$ gh api repos/lidge-jun/codexclaw/rulesets     # HTTP 200
[]
```

The token had `repo`+`workflow` scope and the rulesets endpoint returned 200, so
this is a genuine "no protection configured" answer, not a permissions artifact.

## What the distributable actually is

The install is a git-marketplace clone, not an artifact download:

```
codex plugin marketplace add https://github.com/lidge-jun/codexclaw
codex plugin add codexclaw@codexclaw
```

`.agents/plugins/marketplace.json` points at the in-repo payload
(`"source": {"source":"local","path":"./plugins/codexclaw"}`), so the **committed
tree is the artifact** — `plugins/codexclaw/test/packaging.test.mjs` states this
outright ("the committed repo IS the install artifact"), and `package.json` is
`private: true`.

`build.mjs` compiles the eight components' TypeScript into committed `dist/`
(120 tracked files), validates the manifest, hook/MCP targets and skill layout,
and scans for placeholder markers. It produces no archive, checksum or artifact.

Two consequences shape the design:

1. `marketplace add` accepts `--ref`, so a release **can** be pinned to a tag or
   SHA. That is the only mechanism that makes a release meaningful to an installer
   today.
2. Attaching a tarball to a release would not change what installers consume unless
   the marketplace flow is changed. So the release artifact's job is *evidence and
   reproducibility* (payload snapshot + checksums + manifest), while `--ref`
   pinning is the actual install contract.

## Packed-install lifecycle: what CI can honestly prove

`codex` is not preinstalled on ubuntu-24.04 or windows-2025 runner images
(verified against `actions/runner-images` READMEs). It installs non-interactively:
`npm install -g @openai/codex@0.147.0`.

Hook trust is scriptable. `cxc hooks retrust --key codexclaw@codexclaw
--codex-home <home> --bootstrap-ok` recomputes hashes, rewrites TOML atomically
with a timestamped backup, and rolls back on failure. The trust-hash algorithm is
pure crypto over a canonical handler identity
(`components/cxc-ops/src/hook-trust.ts:100-130`), and `UserPromptSubmit`/`Stop`
drop the matcher (`:30-35`). The **final verification step shells out to
`codex features list`** (`:371-378`), which is why full lifecycle proof needs the
binary.

Split the lifecycle job in two so each lane makes a claim it can actually back:

| Lane | Needs `codex`? | Proves |
| --- | --- | --- |
| Artifact lane | no | payload layout, manifest/hook/MCP target validity, dist freshness vs source, runtime graph tracked in git, trust-hash recomputation, fake-home residue policy |
| Install lane | yes | `marketplace add --ref <tag>`, `plugin add`, bootstrap retrust, `cxc doctor --json`, upgrade from the previous release ref, retrust after upgrade, `plugin remove` + residue assertion |

Anything asserting "the published artifact installs" must run the install lane
against the **immutable release ref**, not the checkout — otherwise it certifies
the branch, not the release.

## Requirements carried into 030/040

1. Release workflow: `workflow_dispatch` + `push.tags`, `contents: write`,
   concurrency guard, exact-SHA validation against the tag.
2. Gate CLI must run inside that workflow and fail closed before publication.
3. Receipts the manifest must link: per-platform CI run ids on the exact SHA,
   test-suite count, inventory hash, packed-install lifecycle run id.
4. Publication: payload archive + `SHA256SUMS` + candidate manifest JSON attached
   to the release, notes generated from the changelog.
5. Post-publish verification: re-read the release via API and confirm assets and
   tag→SHA binding.

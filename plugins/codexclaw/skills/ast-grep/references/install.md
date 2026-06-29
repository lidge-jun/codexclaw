# Installing / provisioning `sg` (ast-grep)

The helper resolves the `sg` binary lazily and never assumes a global install.

## Resolution order

1. `CODEXCLAW_AST_GREP_SG_PATH` (explicit override; `OMO_AST_GREP_SG_PATH` fallback).
2. codexclaw runtime: `$CODEX_HOME/runtime/ast-grep/<os>-<arch>/sg`, then
   `~/.codexclaw/runtime/ast-grep/<os>-<arch>/sg`.
3. A cached binary under this skill's `bin/`.
4. `PATH` (via `which`).
5. Homebrew defaults (`/opt/homebrew/bin/ast-grep`, `/opt/homebrew/bin/sg`).

## Lazy provisioning

Run the helper's `install` subcommand to provision on demand:

```
python3 scripts/ast_grep_helper.py install
```

It delegates to the platform install path and is idempotent — re-running when
`sg` is already present is a no-op. If provisioning fails, the helper prints a
clear hint (network, permissions, or unsupported platform) instead of crashing.

## Manual install options

- npm: `npm install -g @ast-grep/cli`
- Homebrew: `brew install ast-grep`
- Cargo: `cargo install ast-grep`

After installing, confirm with:

```
python3 scripts/ast_grep_helper.py doctor
```

which reports the resolved binary path and version, or a missing-binary hint.

## codexclaw doctor

`cxc doctor` includes an `ast-grep` status line (provisioned / PATH fallback /
missing / provisioning failed) with the binary path and version when available,
so plugin health surfaces the runtime state without a separate command.

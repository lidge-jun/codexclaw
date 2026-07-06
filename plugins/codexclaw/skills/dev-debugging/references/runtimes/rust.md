# Rust Debugging

Covers cargo, tokio, panics. Rust's type system + `dbg!` + logging cover 80%
of sessions faster than gdb. Reach for the lightest tool first.
Lineage: lazycodex `runtimes/rust.md` + gpt-5.5 research (2026-07-07).

## Phase 0 — Environment Detection

```bash
cargo --version; rustc --version
cat rust-toolchain.toml rust-toolchain 2>/dev/null
which rust-gdb; which rust-lldb; which lldb
grep -E '"(tokio|async-std|smol)"' Cargo.toml
grep -E '^\[profile' Cargo.toml
```

Default `cargo run` builds with `dev` profile (debug symbols). `--release`
strips them. Stay in dev unless the bug only manifests under optimization.

## The Rust Debugging Hierarchy (use in order)

1. **`dbg!(expr)`** — prints file:line + value, returns the value unchanged.
   Inline it anywhere. Writes to stderr (safe for stdout pipelines). Journal
   each `dbg!` addition.
2. **`RUST_LOG=trace`** with `tracing` / `env_logger` — flow + state across an
   operation. Zero code change at dev time.
3. **`RUST_BACKTRACE=1` / `=full`** — for panics. Almost always sufficient for
   crash bugs.
4. **`rust-gdb` / `rust-lldb`** — pause execution, inspect memory. Essential
   for unsafe code / FFI. CodeLLDB (VS Code) usually gives the best DX
   cross-platform, but rust-gdb/rust-lldb wrappers apply Rust type
   pretty-printers that raw gdb/lldb miss. GDB generally works better on Linux;
   LLDB's Rust parser is more limited (Tier-2: rustc-dev-guide).
5. **`tokio-console`** — async deadlocks, stuck tasks, hot loops. Requires
   `console-subscriber` dep + `RUSTFLAGS="--cfg tokio_unstable"`.
6. **`cargo-expand`** — when a macro (`#[derive]`, `#[tokio::main]`,
   `#[async_trait]`) is suspect. Shows exactly what the compiler sees.

## rust-gdb / rust-lldb Quick Reference

```bash
cargo build
rust-gdb ./target/debug/my_binary          # or rust-lldb
rust-gdb --args ./target/debug/my_binary arg1 arg2
rust-gdb -p $(pgrep my_binary)             # attach to running
```

Breakpoints: `b main`, `b my_crate::module::function`, `b src/handler.rs:42`.
State: `p x`, `info locals`, `bt`, `frame <n>`, `watch my_var`.

## Miri — UB Detection

Miri detects: OOB access, uninitialized data, misalignment, data races,
aliasing-rule violations (Stacked/Tree Borrows). Essential for unsafe code.

```bash
rustup +nightly component add miri
cargo +nightly miri test
cargo +nightly miri run
```

## Release-Build Gotcha

```toml
# Cargo.toml — add symbols to release for rare optimization bugs
[profile.release]
debug = true
```

## Silent-Failure Patterns

| Pattern | Why silent |
| --- | --- |
| `.unwrap_or_default()` | Masks errors as the zero value |
| `let _ = fallible_operation()` | Explicitly discards Result, no warning |
| `if let Ok(x) = ... { use(x); }` (no else) | Silent on Err |
| `.ok()` chaining | Converts Result to Option, error thrown away |
| Panic inside un-awaited tokio task | Task dies silently if logs are off |
| `Drop` impl that panics | Double-panic aborts silently |

## Cleanup

```bash
git diff | grep -E 'dbg!\('
git checkout <file>
unset RUST_LOG RUST_BACKTRACE
pkill -f 'rust-gdb' || true; pkill -f 'rust-lldb' || true
lsof -iTCP:6669 -sTCP:LISTEN -nP 2>/dev/null   # tokio-console default
```

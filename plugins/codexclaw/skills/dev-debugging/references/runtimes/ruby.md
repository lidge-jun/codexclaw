# Ruby Debugging

Covers Ruby 3.2+ (bundled `debug` gem), Rails, pry. The `debug` gem / `rdbg`
is now the standard; `byebug` is legacy for Ruby < 3.2.
Lineage: gpt-5.5 Tier-2 research (2026-07-07).

## Phase 0 — Environment Detection

```bash
ruby -v
gem list debug byebug pry 2>/dev/null
bundle info debug 2>/dev/null
rdbg --version 2>/dev/null
rails about 2>/dev/null || true
```

## Debugging Hierarchy (use in order)

1. **Logs + stack trace** — structured logging; read the full exception first.
2. **`binding.irb`** — lightweight scoped REPL, no extra gem needed.
3. **`debug` gem / `rdbg`** — stepping, breakpoints, remote attach. Default
   for Ruby 3.2+ (bundled). Source breakpoint: `require "debug"; binding.break`.
4. **`pry`** — richer REPL with `ls`, `show-source`, `cd`. Use when `irb`
   isn't enough.
5. **Rails tools** — `web-console` (browser-context console, dev only),
   `better_errors` (dev only, never in prod group).
6. **Profiler / memory** — `stackprof`, `memory_profiler`, `derailed_benchmarks`.

## Launch / Attach Recipes

```bash
rdbg app.rb                              # launch under debug
rdbg -c -- bin/rails server              # Rails under debug
rdbg -c -- bundle exec rspec spec/foo_spec.rb  # RSpec

# Remote attach (default: UNIX socket; TCP with --port)
rdbg --open --nonstop -c -- bin/rails server
rdbg -A                                  # attach from another terminal
```

**Security**: debug traffic is NOT encrypted; never expose TCP debug ports
beyond localhost.

## `rdbg` Essentials

`n` next, `s` step, `c` continue, `fin` finish, `b <file>:<line>` breakpoint,
`bt` backtrace, `info` locals, `p <expr>` evaluate, `catch <Exception>` break
on exception class, `irb` drop into IRB with frame locals.

## Silent-Failure Patterns

| Pattern | Why silent |
| --- | --- |
| Nil propagation / `&.` chains | Silently returns nil through many calls |
| Broad `rescue => e` | Catches everything, often logs and continues |
| `method_missing` / dynamic dispatch | Rails magic hides real call site |
| `Hash#[]` returns nil for missing key | Use `Hash#fetch` at boundaries |
| Background job silently rescued | Sidekiq/GoodJob default: log + discard |

## Cleanup

```bash
# Remove debug statements
rg 'binding\.break|binding\.irb|binding\.pry|require.*debug/open' --type ruby
git checkout <file>
unset RUBY_DEBUG_PORT RUBY_DEBUG_HOST RUBY_DEBUG_OPEN
```

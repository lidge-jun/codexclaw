# Release preparation evidence

User authorization and boundaries:070. Dependency/count repairs:071.
Research integration PR:[#65](https://github.com/lidge-jun/codexclaw/pull/65), dev base.

## Integration

Main merged dev336d2479 into099b409a as4b7d72114dc3ec1686e47f3bba6d630ca499dc8c.
Independent Gauss review covers15 overlapping paths plus six relocated policy
references: PASS, no lost semantics or concrete integration defects. Existing
peer/stack/browser/class-scaling changes survive with the modular skill design.

Fresh clone of that exact published SHA on macmini, Node24.20.0: npm ci, build,
generated-dist consistency, full npm test, gate and inventory. Result2523 total,
2522pass,0fail,0cancelled,1 existing repo-map smoke skip;79,623.293ms; exit0.
Logs at remote R/release-merged-{install,build,suite}.log, where R is the session
probe root recorded in049_1. No local suite/build/typecheck ran.

Two earlier index-based transfer attempts failed before applying changes; none
qualifies as integrated evidence. The fresh Git clone supersedes that transfer
method, not its failed records. Node22 cancellation evidence also remains intact.

## Dependency and version preparation

Lock-only security commit1c553b6 updates the two vulnerable transitives and five
browserslist dependencies, no direct dependency changes. The isolated resolver's
fresh audit reports0 vulnerabilities; final exact-head testing follows.

Version surfaces are prepared for0.2.17, with helper-generated manifest cachebuster
0.2.17+codex.20260905162606. Root, CLI, GUI, eight components and workspace lock
versions agree. inventory.mjs --write --tests2523 regenerates the actual payload
inventory and three root README badges from the measured integrated total.
Version bumps have not yet published anything; v0.2.16 is not overwritten.

## SSH inventory (read-only)

Confirmed enabled production installs, all old0.2.16+codex.260830094500:

| Host | Home | Codex | Mechanism |
|---|---|---|---|
| macmini-cf | /Users/junny |0.146.0 | normal plugin manager; cache-following cxc |
| suji | /Users/neuralarcadepro |0.147.0 | normal plugin manager; payload dispatcher |
| desktop-c795oh4 | C:\Users\user |0.147.0 | native Windows npm codex.cmd, not POSIX shim |

Aliases were grouped by observed host/user identity. No install was found in
scoped normal-home locations on lidge, intmb, clisu-oracle or cursor. win proxy
handshake failed; oracle and ocx-ci timed out. Those three remain unknown, not
certified absent or deployed. No new installation on an absent host is planned.

Normal CLI help confirms named marketplace upgrade plus plugin add; hook re-trust
uses the existing payload hooks retrust command without --bootstrap-ok. Preserve
old complete payload separately: cache retention is not guaranteed. Exact pin,
rollback restoration, trust and installed smoke are still deployment work.

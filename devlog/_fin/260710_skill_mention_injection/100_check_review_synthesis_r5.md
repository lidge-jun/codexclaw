# 100 — C-Gate r5 Synthesis (Kierkegaard, VERDICT: FAIL, 2 High)

Both ACCEPTED (genuine false-positive rewrites inside protected content).
Convergence trend: 4 -> 3 -> 3 -> 2 High, prior rounds all verified closed.

## B1 — container-looking line falsely closes an active fence
A literal "> ```" line INSIDE a top-level fence is stripped of its quote prefix
and accepted as the closer. Fix: fence state records the OPENER's container
prefix (the exact stripped prefix string); a close fires only when the line's
stripped prefix byte-matches the opener's. Mismatch = fenced content. A
genuine prefix drift (">" vs "> ") leaves the fence unclosed => protects to
EOM, acceptable per FAILSAFE-SPAN-01.

## B2 — over-budget container depth leaks fence BODY lines
Five quote levels exceed the 8-token strip budget; the opener line is itself
backtick-protected, but no fence state opens, and backtick-free BODY lines are
then bare-normalized. Fix: fence-toggle detection must not silently give up on
budget overflow — strip container tokens without a practical cap for the
PURPOSE of fence detection (bounded by line length; still linear), and if a
3+ marker run is found after ANY prefix that fence detection cannot fully
classify, toggle protection anyway (over-protect). Test with 5+ quote levels.

# L1 measurements (wp2)

Per-emitter source-renderer bytes reported by the four lanes; aggregate totals through the real hook commands are in `l1-before.txt` and `l1-after.txt` (`measure-l1.mjs`).

| Lane | Emitter | Before → after (B) |
|---|---|---|
| A | cxc-ops SessionStart bundle (with map) | 4,346 → 807 |
| A | compact recovery marker | 2,332 → 439 |
| B | loop-arm POSIX / Windows (renderer, win32 arg) | 3,242 → 400 / 3,472 → 423 |
| B | Interview body / Mind pointer | 1,960 → 296 / 1,208 → 134 |
| B | phase I, P, A, B, C, D | 750/669/762/295/608/373 → 160/171/154/137/150/169 |
| B | footer / lexical note / search block | 690 → 160 / 484 → 112 / 1,392 → 149 |
| B | worktree startup / rename | 1,330 → 260 / 883 → 180 |
| B | loop CLI init / add-work-phase / add-criterion (2,400 B objective) | 2,573 → 202 / 2,609 → 197 / 2,640 → 196 |
| B | deny reasons (memory, git source, substitution, deletion, goal-complete) | 785/415/434/501/179-536 → 303/176/165/179/142-264 |
| C | fallback notice / unmanaged spawn | 2,462 → 209 / 2,474 → 195 |
| C | child guards V1 leaf/coord, V2 leaf/coord (markers unchanged) | 502/461/1,091/690 → 291/323/301/350 |
| C | V2 self-load block / recursion deny | 3,370 → 239 / 387 → 133 |
| D | recall startup / intent / history frame / unavailable | 276 → 98 / 367 → 125 / 360-533 → 178-195 / 113 → 44 |
| D | bg completion / adoption frame | 217 → 83 / 233 → 109 |
| D | provider healthy / error | 95-122 → 0 / 95 → 59 |
| D | config-guard healed/failed / permissions advice | 224/283 → 83 / 388 → 106 |


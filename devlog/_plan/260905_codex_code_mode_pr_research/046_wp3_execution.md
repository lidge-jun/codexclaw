# WP3 implementation record

Status: B in progress after combined independent A PASS in044. No candidate
native behavior or final adoption is claimed yet.

Source baseline for implementation:336bf1f (product payload unchanged from91e051df).
Disjoint workers own hook/test changes and the offline family evaluator. Main
owns integration, SoT synchronization, generated dist, remote checks, native
operator controls and all phase/goal state. Local tests/build/typecheck remain
prohibited; all execution checks are on macmini.

## Family evaluator RED

Worker first added the approved synthetic native-shaped fixture and full new
family tests without touching the analyzer. Main transported only those files
to owned wp3-source based on91e051df. The positive schema1/schema2 test fails
with public rc2 / invalid proof manifest instead of rc0; the preceding schema1
assertion passes. node --test process exit1,1 failed case,0 skips.
Original log: remote wp3-family-red.log. Main then authorized the bounded
analyzer implementation. No prospective test output is labeled as executed proof.

## First implementation checks

Family GREEN:223 tests pass,0 fail,0 skip across existing analyzer/recorder/compiled
fixtures and new family cases (wp3-family-green.log). Main then added an explicit
declared-but-unspawned native child case so deleting inventory equality changes
acceptance, rather than merely changing a private error string. Four isolated
mutations are killed: missing inventory equality, wrong shared identity, skipped
first request and fabricated per-thread allocation. Original source/control passes.
Russell independently reviewed all three family files and returned PASS.

Hook RED: the retained original Korean C2 source test fails the old unconditional
CHECK text at the expected no-delegation assertion (wp3-hook-red.log). Only then
was the hook source patch authorized. After the bounded implementation and remote
build,529 targeted hook/guard/CLI/compiled/manifest tests pass,0 fail,0 skip.
156 files compile and layout validation passes (wp3-build.log, wp3-hook-green.log).
Harvey independently reviewed the scoped hook implementation and all seven affected
test files and returned PASS. Only the three expected generated outputs changed:
hook.js, interview-policy.js and map-affordance.js; main copied remote-generated
bytes back without a local build or hand editing.

The complete family test file including the additional inventory case passes113/0.
Main reviewed complete retained parent/child call code, original lifecycle and
owned-home inventory, rechecked unfiltered usage and source identity, then created
separate schema2 analysis packets for the historical C2 runs. Both analyzers exit0
with2 native sessions and12/13 family requests counted once. These are explicitly
family-scoped, human-reviewed evidence, not per-child wire attribution; the original
no-delegation behavioral failures remain failures. Original packets are untouched.

The WP3 baseline original Korean C2 native attempt reached its180s deadline. Its
OS rc0 does not make it successful: interruption=timeout, identities and doctors
remain valid. Preserve runs/wp3-baseline-c2-001 as a failed sample; no performance
comparison against a successful candidate may erase this failure.

## Pending

Exact candidate native original Korean no-delegation/phase and answer cases,
native goal admission and scope checks, final family evidence review,
SoT update and fresh C receipt remain required. 050 delivery comparison and
final installed handoff remain separate downstream cycles.

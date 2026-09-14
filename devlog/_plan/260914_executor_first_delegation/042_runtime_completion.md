# 042 — Complete the remaining architect runtime verification

Follow-up to 041, 2026-09-15 KST, based on `8f4b6bf9` in the same worktree.
The user requested completion of the remaining live verification. The formal P
trial now completes proposal → main executable plan → same-architect reflection.
It exposed a pre-existing spawn-hook defect that had blocked every earlier
positive trial. Design-amendment and text-only observations also completed below.
These are bounded observations, not a measured invocation-rate or quality gain.

## Failure, causal test and correction

Native V2 supplied the task as a Fernet-shaped encrypted `message`. The existing
spawn hook put a plaintext leaf guard, skill affordance and optional prompt override
around it. The child received the mixture in an `encrypted_content` slot and the
backend rejected it with:

```text
stream disconnected before completion: Encrypted function output content could not be decrypted or decoded.
```

Three hypotheses were tested: CXC message mutation, a general V2/backend failure,
and mismatched test configuration/fork arguments. All controls used the same local
CLI 0.154.0 and account-backed inherited model. The actual exposed surface was V2
despite the disabled feature flag; the schema, not that flag, identifies the trial.

| Control | Actual child result |
| --- | --- |
| `no-plugin-control` | CHILD_OK, then FOLLOWUP_OK |
| `no-plugin-fresh-explicit` | Same success with a fresh context |
| `plugin-control` | Original decryption error |
| `plugin-minimal-fields` | Same error with optional spawn fields omitted |
| `plugin-preserve-ciphertext` | Same installed plugin, only the message-preservation expression changed: both replies succeeded |
| `plugin-restored` | Original installed hook restored in a fresh fixture: same error returned |

The last two trials establish the causal off/on check. A general V2 failure and
fork-argument explanation do not account for these observations. Parent CLI exit
0 in a control means it reported its result; child success/failure above comes
from native replies and error events, not from that exit code.

The local correction is in `components/subagent-config/src/spawn-attach-hook.ts`
under `plugins/codexclaw/`, with rebuilt dist and runtime regressions. It preserves
recognized native V2 ciphertext byte-for-byte and discloses that hook-added text
was not attached. Metadata-based recursion denial, explicit settings, full-history
fork restrictions, separate routing fields and V1 item attachments retain their
existing behavior. Main made this small local boundary correction; independent
source investigation and review ran separately. No role, model, permission or
consultation gate was added. Existing doctrine claims about encrypted delivery
were corrected in `structure/20_pabcd_dispatch_doctrine.md` and `structure/INDEX.md`.

The token detector is a format heuristic, not decryption or authentication.
Encrypted managed markers and encrypted cross-provider delivery remain outside
this fix. This trial uses inherited routing and does not certify those paths.

## Regression and installed evidence

- Old source with new byte-preservation assertions: two tests failed. The unchanged
  recursion-denial case passed. See `cipher-red.log`.
- Subagent-config suite after the correction: 328 passed, 0 failed.
- The first full run found one old E2E assertion that required corrupting ciphertext.
  It was replaced with separate ciphertext-preservation and plaintext-affordance
  cases through the shipped entrypoint. Both capabilities remain tested; no skip
  or threshold was added.
- Final focused source/entrypoint suites: 120 passed, 0 failed.
- Final full suite: 3,158 tests, 3,085 passed, 0 failed, 73 existing skips.
- Build, repository gate and `git diff --check`: exit 0.
- Real plugin copy installed only into the task-owned `followup-home`; doctor PASS.
  The final reinstall includes the comment correction made after initial P startup;
  that correction does not change executable behavior.

## Actual formal P

The natural request asked for a plan to add title search and pagination to a tiny
existing catalog module. It did not name architect or prescribe its calls. It
forbade implementation, goal creation and A entry.

- Parent: `01a0a08c-adda-7f23-aaca-b4658d7490be`.
- Architect: `01a0a08d-80b2-7310-99cf-c4e48c74aa14`, returned V2 handle
  `/root/catalog_architect`.
- Parent rollout: architect spawn at line 38; concrete two-file plan write at
  line 85; same-handle `followup_task` at line 90.
- Architect rollout: CAT-01–CAT-05 proposal at line 32; revision-1 reflection at
  line 48, ALIGNED, mapping every decision to plan paths and acceptance criteria.
- Parent then recorded the reflection and stopped in P, exit 0. Source and README
  stayed unchanged. The plan records executor ownership for the later implementation.
- The separate cold-read helper is document readability evidence, not A review.

The plan is in `behavior-positive-fixed/devlog/_plan/260915_catalog_query/`.
`positive-fixed-r1/` preserves its completed revision before subsequent amendments.
Raw native transcripts remain outside Git under the evidence root.

## Design amendment and text-only amendment

The same parent resumed with a natural requirement change: replace page/pageSize
with offset/limit and complete A review, without implementation or B entry.

- Main revised CAT-02, CAT-03 and CAT-05, preserving CAT-01 and CAT-04, and sent
  revision 2 to `/root/catalog_architect` at parent rollout line 160.
- The same architect returned ALIGNED at its rollout line 64, with changed and
  preserved decisions mapped to the revised contract and acceptance criteria.
- Parent then spawned independent `/root/catalog_audit` at line 205, using the
  supported read-only explorer plus logical reviewer packet. Native reviewer was
  absent from that trial schema; no architect-role substitution occurred.
- Reviewer `01a0a094-1295-7b51-92a6-e5a3d1c22dda` returned VERDICT: PASS and no
  blocking issues at rollout line 75. The parent's completed turn is line 281.
- The amended executable specification's SHA-256 is
  `fecec8d67011628435b55dd97e25d4c2bc20441fc15a4b84aa10a04f28d07efa`.
  `002_audit.md` records the main disposition, architect reflection and independent
  review separately. `positive-fixed-r2/` preserves that completed revision.
- The final wording-only request changed just the first heading's “페이지 조회”
  to “구간 조회”. Parent rollout lines 282–302 contain one shell/tool composition
  and no spawn or architect follow-up. Independent byte comparison found exactly
  that replacement, with every other plan file, catalog source and README unchanged.
  See `text-amendment-proof.json`.

Both resumed CLI runs exited 0. The trial stayed at A; no implementation, B entry
or goal was created. The real parent task remained IDLE throughout. Earlier C0
and explicit-no-delegation observations in 041 remain separate evidence for those
unchanged paths. Actual model routing across providers was not measured.

## Independent review and evidence location

Reviewer `01a0a08c-afe5-7660-8c9c-103296617b54` initially returned PASS with no blockers
and independently ran 52 assertions on source/dist parity, recursion, routing,
ciphertext variants, disclosure, plaintext and items. Its two minor observations
were addressed: the stale inline comment and missing persistent disclosure check.
The same reviewer subsequently returned PASS for the corrected E2E case and
completed P evidence, reproduced source→plan→same-architect ordering, checked
the final suite logs and independently compared all 14 changed plugin files with
installed bytes. Its verdict is distinct from the fixture's independent A review.
The final receipt-only review also returned PASS, confirming revision-2 reflection
before independent A, the preserved revision hash, the title-only diff and forward
links. Cleanup and the real-cache comparison are explicitly main-verified evidence.

Evidence root: `/var/tmp/cxc-architect-01a0a049-aah8dgrt/`. Relevant additions:
`control-probe.py`, the six control directories, `remaining-validation-hypotheses.md`,
`cipher-{red,green,focused-final}.log`, `followup-{build,install,gate}-final.log`,
`followup-full-tests-final.log`, `run-behavior-fixed.py`, `run-amendment.py`,
`followup-home/sessions/`, `behavior-positive-fixed/`, and `positive-fixed-r1/`.
An initial resume command rejected unsupported `--color` before starting a turn;
the runner removed that argument. This was a harness correction, not a model retry.

`transport-controls-summary.json` records the original encrypted slots and child
outcomes without copying ciphertext into Git. `followup-source-installed-manifest.json`
records changed tracked-file hashes. Main compared all 1,042 real plugin-cache
paths and hashes against the original baseline: unchanged. All temporary auth
copies were removed, and owned CLI processes were reaped. The evidence directory
is retained. This follow-up remains a local working-tree change; no commit, push,
merge or real Codex-home installation was performed in this verification follow-up.

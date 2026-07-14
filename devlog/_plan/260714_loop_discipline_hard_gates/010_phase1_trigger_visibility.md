# 010 — Phase 1: Trigger + Visibility Hardening (wp1)

Goal: the natural Korean/English phrasings for "run PABCD repeatedly" must arm the
loop mandate, and the loop contract must be visible without the model deciding to look.

## MODIFY `plugins/codexclaw/components/pabcd-state/src/hook.ts`

### 1. `detectLoopArmRequest` (~line 150)

Current:

```ts
export function detectLoopArmRequest(prompt: string): boolean {
  const p = (prompt ?? "").toLowerCase();
  if (/\bcxc-?loop\b|\bhotl\b|\bgoal\s*plan\b|\bgoalplan\b|골플랜|고울플랜/.test(p)) return true;
  if (/\bcontinue\s+until\s+done\b|\bkeep\s+going\s+until\b|\buntil\s+(?:it'?s\s+)?done\b/.test(p)) return true;
  if (/\bautonomous(?:ly)?\b.*\b(?:loop|continue|run|finish)\b|\bwork[- ]phase\s+loop\b/.test(p)) return true;
  if (/루프\s*(?:를?\s*돌|시작|모드|가동|진행)/.test(p)) return true;
  if (/끝까지\s*(?:해|진행|돌|완성|가|마무리)|멈추지\s*말|알아서\s*(?:끝까지|다\s*해)/.test(p)) return true;
  return false;
}
```

Add two rules AFTER the 골플랜 line (keep curation comment updated). AUDIT ROUND 1
(Fermat, GO-WITH-FIXES) tightened both rules — weak co-occurrence tokens (다시, 계속,
`runs?`, again) false-positived on questions ABOUT pabcd ("pabcd 문서 다시 보여줘",
"explain how pabcd runs internally"), and bare 실행/수행 false-positived on ordinary
repeat-run asks ("이 테스트 여러 번 실행해봐"). Final shape:

```ts
  // ORCH-ARM-PABCD-01: the harness's own protocol name is a first-class arming
  // token when paired with a STRONG run/repeat marker ("pabcd 여러 번", "run
  // pabcd", "pabcd 돌려", "pabcd repeatedly"). Bare "pabcd" alone stays excluded
  // (a question ABOUT pabcd must not arm ceremony), and weak markers like
  // 다시/계속/again/runs are deliberately NOT signals (audit round 1).
  if (/\bi?pabcd\b/.test(p) && /여러\s*번|반복|한\s*번\s*더|돌려|돌리|돌자|사이클|\b(?:run|loop|repeat|iterate|cycle)\b|\brepeatedly\b|\bmultiple\s+times\b/.test(p)) return true;
  // Repeat-marker IMMEDIATELY followed by a solve/progress marker, without the
  // literal 루프 word ("여러 번 돌려서 해결해"). Bare 실행/수행 excluded: "테스트 여러 번
  // 실행해봐" is a repeat-run ask, not a loop request (audit round 1).
  if (/(?:여러\s*번|반복(?:해서|적으로)?)\s*(?:돌|해결|해라|하자)/.test(p)) return true;
```

Rule-2 verb set is 돌|해결|해라|하자 only — 진행 was dropped too ("여러 번 진행된
마이그레이션 롤백해줘" must stay false), accepting the false negative on "여러 번
진행해" as the safer trade.

### 2. `detectTrigger` (~line 116) — no change

Deliberate: "PABCD 여러 번" is a LOOP request, not a single-phase entry; adding `pabcd`
here would fire single-phase transitions for loop asks. The arming mandate (which tells
the agent to run `orchestrate status` + enter P itself) is the correct surface.

## MODIFY `plugins/codexclaw/skills/loop/SKILL.md` frontmatter description

Append Korean triggers to the `Triggers:` tail (keep under the existing sentence):
`..., PABCD 여러 번, 여러 번 돌려, 반복 실행, 루프 돌려, 끝까지 해줘`.

## MODIFY `plugins/codexclaw/skills/pabcd/SKILL.md` frontmatter description

Append to `Triggers:` tail: `..., 'PABCD 돌려', 'PABCD 여러 번', '한 사이클씩', '단계별로 제대로'`.

## MODIFY `plugins/codexclaw/skills/loop/agents/openai.yaml` + `pabcd/agents/openai.yaml`

`short_description` currently "HOTL work-phase continuation." / "Structured Plan-Audit-Build-Check-Done
workflow discipline for multi-phase work." — extend with the visible contract cue:

```yaml
# loop
short_description: "HOTL work-phase continuation - one PABCD cycle per work-phase, arm with cxc orchestrate (PABCD 여러 번/루프 돌려)."
# pabcd
short_description: "Plan-Audit-Build-Check-Done discipline - one work-phase per cycle, diff-level decade plan docs (PABCD 돌려/단계별로)."
```

`allow_implicit_invocation` stays `true` (already visible; the gap was the description
text, not the policy bit).

## MODIFY `plugins/codexclaw/components/cxc-ops/src/map-affordance.ts`

`runMapAffordanceSessionStart` composes the SessionStart envelope. Add ONE always-on
line (new `renderLoopAffordance()` helper, appended where the skill-search/kwrite lines
are joined):

```ts
export function renderLoopAffordance(): string {
  return [
    "[codexclaw] Loop contract: a multi-cycle/PABCD/루프 request is INVALID without the",
    "persisted FSM — run `cxc orchestrate status --session <your id>` first, then enter",
    "P and advance each edge with --attest. One work-phase = one full PABCD cycle;",
    "never implement two plan pages in one B. Load $codexclaw:cxc-loop + cxc-pabcd.",
  ].join(" ");
}
```

Rationale: the binding line already proves SessionStart injection works; this adds the
missing "the FSM exists and loops must use it" fact to the always-visible layer, immune
to the prompt-regex single point of failure.

## TESTS

`plugins/codexclaw/components/pabcd-state/test/hook.test.ts` (or the existing detect*
test file): add cases —

Positive: "pabcd 여러 번 돌려서 해결해" / "PABCD를 여러 번 돌려서 이 문제 해결해라"
(mixed case via toLowerCase) / "run pabcd repeatedly until this is fixed" /
"pabcd multiple times" / "여러 번 반복해서 해결해" → all true.

Negative (audit round 1 additions marked *): "what is pabcd?" / "for 루프 버그 고쳐줘" /
"pabcd 문서 다시 보여줘"* / "explain how pabcd runs internally"* (note: `run` without
optional `s` — descriptive "runs" must not match) / "pabcd가 뭐야? 계속 헷갈리네"* /
"이 함수 여러 번 호출되는 버그 고쳐"* / "이 테스트 여러 번 실행해봐"* /
"앱 아이콘 여러 번 실행해도 안 열려"* / "빌드 반복 실행해서 flaky 잡아줘"* /
"여러 번 진행된 마이그레이션 롤백해줘"* → all false.

`plugins/codexclaw/components/cxc-ops/test/map-affordance.test.ts`: envelope contains
"Loop contract:" line.

## Verification (C) — corrected by audit round 1

- Repo-root `npm run build` (scripts/build.mjs — zero-toolchain node type-stripping,
  NOT bun/tsc; dist-freshness test recomputes bytes via node stripTypeScriptTypes) then
  repo-root `npm test` (node --test), which includes the plugin-level `hook-e2e`,
  `dist-freshness`, `loop-activation-doc-sync`, `cli-usage` guards a component-local
  run would miss.
- Standalone: pipe a UserPromptSubmit payload with the Korean phrase through the built
  hook entry and grep the output for `ORCH-MANDATE-01`; capture exit code.

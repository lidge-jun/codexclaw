# #250 — Require an explicit CodexClaw phase or loop request

Incidental `interview`, Korean build/verify verbs, and ordinary “keep going” language must not inject PABCD context or arm the loop. Explicit line-anchored `orchestrate <verb>` remains authoritative through `parseOrchestrateCommand`; this change narrows only the advisory detectors.

Current anchors: `plugins/codexclaw/components/pabcd-state/src/hook.ts:238`, `plugins/codexclaw/components/pabcd-state/src/hook.ts:272`, `plugins/codexclaw/components/pabcd-state/src/hook.ts:655`, `plugins/codexclaw/components/pabcd-state/test/hook.test.ts:63`, `plugins/codexclaw/components/pabcd-state/test/hook.test.ts:461`.

## File change map

### MODIFY `plugins/codexclaw/components/pabcd-state/src/hook.ts`

`detectTrigger` at `:238-250` currently matches bare `interview`/`인터뷰`, generic `plan this`, `build this`, Korean `구현해`/`검증해`, and `audit this`. Replace with a line-oriented explicit marker grammar. An accepted line must name `cxc-pabcd`, `codexclaw:cxc-pabcd`, a `[$cxc-pabcd](skill://...)` mention, `PABCD로`/`PABCD phase`, or a literal line-start `orchestrate [ipabc]`; for phase selection, it must additionally carry an unambiguous phase token (`interview/I`, `plan/P`, `audit/A`, `build/B`, `check/C`) on that line. A line-start `orchestrate` token remains handled by the existing parser first (`hook.ts:655-664`); the detector may recognize it for pure-function compatibility but must not broaden command parsing. Do not scan the whole prompt with an unanchored regex: quoted issue bodies often contain exact tokens. Add this complete helper before both detectors and replace `detectTrigger` with:

```ts
function requestLines(prompt: string): string[] {
  const result: string[] = [];
  let fenced = false;
  for (const raw of (prompt ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (/^```/.test(line)) { fenced = !fenced; continue; }
    if (fenced || !line || /^(?:>|[-*] |\d+[.)] )/.test(line)) continue;
    result.push(line);
  }
  return result;
}

export function detectTrigger(prompt: string): Phase | null {
  for (const line of requestLines(prompt)) {
    const command = /^orchestrate\s+([ipabc])(?:\s|$)/i.exec(line);
    if (command) {
      const phase = command[1].toUpperCase();
      if (phase === "I" || phase === "P" || phase === "A" || phase === "B" || phase === "C") return phase;
    }
    const marker = /(?:\bcxc-pabcd\b|\bcodexclaw:cxc-pabcd\b|\[\$?cxc-pabcd\]\(skill:\/\/[^)]+\)|\bpabcd\s*(?:로|phase\b))/i.test(line);
    const requested = /(?:\b(?:use|run|start|enter|apply)\b|(?:시작|진행|적용|돌려|들어가))/i.test(line);
    if (!marker || !requested) continue;
    if (/\binterview\b|(?:^|\s)인터뷰(?:\s|$)|\bphase\s*i\b/i.test(line)) return "I";
    if (/\bplan\b|\bphase\s*p\b|계획/.test(line)) return "P";
    if (/\baudit\b|\bphase\s*a\b|감사/.test(line)) return "A";
    if (/\bbuild\b|\bphase\s*b\b|구현/.test(line)) return "B";
    if (/\bcheck\b|\bphase\s*c\b|검증/.test(line)) return "C";
    if (/pabcd\s*로|\bcxc-pabcd\b/i.test(line)) return "P";
  }
  return null;
}
```

The helper excludes quoted, list, and fenced examples. Preserve phase priority only within one explicitly requested line, and update old tests that asserted generic phrasing (`hook.test.ts:63-99`).

`detectLoopArmRequest` at `:272-290` currently accepts unanchored goalplan/HOTL tokens, repeated Korean phrases, generic “keep going until,” and “끝까지 진행해.” Replace with the same line scanner/quoted-text exclusion. Accept a request line that names `cxc-loop`, `codexclaw:cxc-loop`, a matching skill link, `goalplan`/`골플랜`, `HOTL`, or `PABCD` and has a run/arm/create imperative on that line. Bare marker mentions or general persistence language return false. In particular delete the branches at `:284-288`; do not add a fallback on `continue until done`. Keep `parseOrchestrateCommand` untouched. Full replacement:

```ts
export function detectLoopArmRequest(prompt: string): boolean {
  for (const line of requestLines(prompt)) {
    const marker = /\bcxc-?loop\b|\bcodexclaw:cxc-loop\b|\[\$?cxc-loop\]\(skill:\/\/[^)]+\)|\bgoal\s*plan\b|\bgoalplan\b|골플랜|\bhotl\b|\bi?pabcd\b/i;
    const action = /\b(?:use|run|start|arm|create|init|repeat|cycle)\b|(?:돌려|돌리|시작|등록|진행|적용|해줘)/i;
    if (marker.test(line) && action.test(line)) return true;
  }
  return false;
}
```

In `handleUserPromptSubmit`, the loop-arm branch at `:690-711` persists `loopArmSeen`; incidental prompts must take the silent path and leave it false. Existing explicit command path at `:655-664` is unchanged. A prompt with a literal skill mention and imperative must still inject once per turn.

### MODIFY `plugins/codexclaw/components/pabcd-state/test/hook.test.ts`

Replace generic positive expectations at `:63-99,461-494` with explicit marker plus action cases. Also update the C2 lexical-trigger fixtures at `hook.test.ts:182-263`: prompts whose only phase signal is the ordinary Korean verify verb now expect null and silent handler output; where a test is meant to prove the CHECK directive itself, add an explicit `cxc-pabcd` marker and action to its prompt. Add a table test named `issue 250: nine reported prompts stay silent` with the exact issue examples and expected `(trigger, loopArm)`:

| Label | Prompt | Expected |
| --- | --- | --- |
| order_line | `Keep going until Done means holds. ...` | null, false |
| wn_workflow_name | `... workflow 인터뷰엔진 must keep its name.` | null, false |
| author_ko_build | `이 기능 구현해 두고 결과 보고해` | null, false |
| author_ko_verify | `검증해 보고 알려줘` | null, false |
| author_ko_finish | `끝까지 진행해` | null, false |
| english_mention | `Summarize the interview notes in file X` | null, false |
| neg_thanks | `감사합니다` | null, false |
| neg_for_loop | `fix the for loop bug in parser.ts` | null, false |
| neg_plain | `list the files in out/` | null, false |

These prompts and the old false positives are recorded in issue #250. Add `issue 250: incidental prompt emits no context and does not arm`: call `handleUserPromptSubmit` for each on a fresh existing default-state fixture, assert output `""`, `loopArmSeen === false`, `injectedTurns` unchanged. The six formerly positive examples fail before the fix. Add `issue 250: explicit skill request arms once` with `Use [$cxc-pabcd](skill:///Users/jun/.codex/plugins/cache/codexclaw/codexclaw/0.2.39+codex.20260924082502/skills/pabcd/SKILL.md) to start Plan phase` and `Run cxc-loop for this task`; assert the first emits context and the duplicate `turn_id` is silent. Add quoted/fenced mention negatives and line-start `orchestrate i` positive.

## Activation and bypass record

Exercise each of nine issue prompts, explicit English/Korean markers, skill link, duplicate turn, quoted line, fenced code, mixed incidental and explicit lines, and explicit orchestrate grammar. Tier: advisory prompt detector; executing surface: `handleUserPromptSubmit`; known bypass: other installed skills or direct human/CLI orchestration can still enter PABCD; residual risk: an unusual natural-language request lacking a marker no longer gets a hint. Wording: “automatic hints require an explicit CodexClaw request”; no claim that all phase entry is disabled. Final enforcement layer: detector plus existing parser-first dispatch. Out of scope: changing explicit CLI/chat command grammar, goal policy, or unrelated search-request detection.

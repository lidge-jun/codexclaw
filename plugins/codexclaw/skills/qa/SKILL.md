---
name: cxc-qa
description: "Use for manual web, TUI, CLI, API and desktop QA. Triggers: smoke test, visual QA, screenshot check, CJK clipping, 수동 QA, 실제로 되는지 확인, 동작 확인, 직접 돌려봐."
metadata:
  short-description: "Manual surface-driving QA gate: faithful channels, evidence matrix, adversarial classes, teardown receipts."
---

# cxc-qa — Manual Surface QA Gate

Prove a built surface works by DRIVING it, not by inferring from green tests.
No scenario closes on a status string; it closes on a captured artifact from a
real surface, an adversarial pass, and a teardown receipt. Everything in this
skill is E7 discipline (agent-followed, not hook-enforced); the one shipped E2
touchpoint is noted in [§7](references/scope-and-binding.md#7-binding-to-pabcd-c).

Completion proof: [dev verification gate](../dev/SKILL.md#3-verification-before-completion-strict) (FAMILY-PROOF-01).
Every PASS points at a non-empty artifact you (or
your dispatched QA worker) captured THIS round.

## 2. Surface detection + faithful channels

State the exact surface and invocation BEFORE running each scenario. Use the
channel faithful to the surface — CLI output parsed from the wrong layer is
not evidence of the layer you changed:

| Surface | Faithful channel | Artifact |
| --- | --- | --- |
| HTTP API | `curl -i` (headers + body) — scenarios in `references/http-api-qa.md` | response capture |
| CLI | real invocation, stdout/stderr split + exit code — discipline in `references/cli-tui-qa.md` | terminal capture |
| TUI | tmux session at FIXED dims — mechanics in `references/cli-tui-qa.md`, visual rubric in `references/visual-qa.md` | plain + ANSI captures |
| Web UI | browser screenshot at a STATED viewport, read via `view_image` — workflow in `references/visual-qa.md` | screenshot(s) |
| Desktop GUI | computer-use + screenshots (per-app approval; never drive terminals/Codex itself) | screenshots + action log; native panels, menu-bar popups and approval prompts follow `dev-devops` `native-desktop-acceptance.md` §10 and `macos-system-approvals.md` |

Tool choice for the browser/CU rows follows the shared portable browser policy; the inspect -> act -> re-inspect protocol applies. Data-shaped behavior
may use parsed CLI/data output as its channel.

## Modular References

Read the matching row before the governed action.

| Condition | Reference |
| --- | --- |
| Choosing QA ownership or closing PABCD C | [Scope and binding](references/scope-and-binding.md) |
| Recording any scenario verdict or aggregate receipt | [Evidence contract](references/evidence-contract.md) |
| Driving scenarios and reviewing artifacts | [Adversarial classes and oracle passes](references/adversarial-oracles.md) |
| Finishing any QA pass | [Teardown receipts](references/teardown-receipts.md) |
| ANY visual surface verdict (web UI, TUI, desktop GUI) | [Visual rubric](references/visual-qa.md) |
| HTTP API surface scenarios | [Wire-driving procedure](references/http-api-qa.md) |
| CLI or TUI surface scenarios | [Session mechanics](references/cli-tui-qa.md) |
| Choosing browser/CU tools | [Portable browser routing](../dev/references/browser-routing.md) (QA-TOOL-LADDER-01) |

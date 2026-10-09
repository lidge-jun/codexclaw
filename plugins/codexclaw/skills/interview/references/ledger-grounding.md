## Grounding questions in state (INTERVIEW-GROUND-01)

Question quality is a STATE problem before it is a wording problem. A question generated with
no accumulated knowns and no recorded gaps comes out vague no matter how the prompt is phrased
— that is the failure mode behind questions like "이어서 어느 방향으로 진행할까요?".

The loop that prevents it:

1. Answers are captured automatically by the `PostToolUse` hook into
   `.codexclaw/interviews/<sessionId>.jsonl`.
2. Fold them into the tracker before asking again:
   `cxc scan record --session <id> --derive --map <questionId>=<goal|constraint|success|ontology>`.
   Each answered question becomes a `known[]` fact on its dimension; each asked-but-unanswered
   one becomes an explicit `unknown[]` gap, and answering it later retires the gap.
   Unmapped questions are skipped rather than guessed, so pass `--map` for every question that
   should count.
3. Read `.codexclaw/sessions/<id>.json` back and let the weakest dimension choose the next
   question. This is also what makes Mind routing adaptive: `selectMinds` ranks by dimension
   level, so with an empty tracker all four tie and it degrades to a fixed order.

**Readiness is reached through step 2, not through an assertion.** A dimension counts
toward I -> P when the session's interview ledger shows a question that was ASKED, an
answer that was RECORDED, and a `--map` attributing that question to that dimension.
That is why `--map` matters: an answered question nobody attributed proves nothing about
any dimension.

`--known <dimension>=<text>` records a fact you already hold. It moves a dimension off
`low` and can carry it to `high`, but it can NOT make it count for readiness — a typed
fact is not an answered question, and four `--known` flags would otherwise be a complete
interview in one command.

`--dim <dimension>=<low|mid|high>` records an explicit level assertion when coverage alone
understates what you know. It deliberately cannot set `max`: that level bypasses the ledger
check entirely, so it stays out of the writer's reach.

When the interview genuinely is not complete, the sanctioned way past the gate is the attested
`cxc orchestrate P --attest-file <path>` carrying
`{"from":"I","to":"P","did":"<why the interview is complete>","override":true}`,
which leaves a ledger row. (The file flag is required on Windows: PowerShell cannot pass
inline JSON as a single argument.) `from`/`to` are not optional here — the parser
coerces them before the override is ever read, so `{"override":true}` alone is
refused (ATTEST-SHAPE-01 in `cxc-pabcd`).

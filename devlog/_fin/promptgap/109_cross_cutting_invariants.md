# 109 — Cross-Cutting Prompt Invariants

Gap class: PROMPT/SKILL (cross-cutting) · evidence: explorer #109

> Scope: all 20 `plugins/codexclaw/skills/*/SKILL.md` files, read against omo prompt/skill
> contracts, jaw/cli-jaw prompt-discipline notes, and codexclaw structure SOT. This is
> the family-level synthesis layer: not "what one skill says," but what the whole skill
> set does or fails to do consistently.

## Parity / inconsistency table

| Reference invariant | codexclaw family state | Gap | Evidence |
| --- | --- | --- | --- |
| **Frontmatter is mostly normalized, but the body should open with an authority marker / operating contract, not only a heading.** omo prompt bodies open with markers like `<identity>`, `[search-mode]`, `<system-reminder>`, `<ultrawork-mode>` before prose. | codexclaw is strong on YAML parity (`name` / trigger-rich `description` / `metadata.short-description`) across the family, but after frontmatter most skills open with an H1 and then descriptive prose. No shared first-line authority marker exists in the SKILL.md *bodies*. (A-gate nuance: the injected *directive* layer already carries markers — `[codexclaw: INTERVIEW]`, `[PABCD — D: DONE]`, `IPABCD:` footers — so the gap is at the static skill-body layer, partially mitigated at runtime.) | Family-wide *body* opening contract is weak. Good metadata helps discovery, but once loaded the first visible body line does not consistently say "this skill now owns the turn" in the omo/jaw sense. | codexclaw frontmatter convention is explicitly declared in `plugins/codexclaw/skills/README.md:32-38`. Representative openings without authority marker: `plugins/codexclaw/skills/dev-backend/SKILL.md:8-13`, `plugins/codexclaw/skills/dev-data/SKILL.md:8-15`, `plugins/codexclaw/skills/dev-testing/SKILL.md:7-14`, `plugins/codexclaw/skills/search/SKILL.md:8-14`. Marker-first references: `.../prompts-core/prompts/atlas/default.md:1-15`, `.../prompts-core/prompts/mode/search.md:1-6`, `.../prompts-core/prompts/prometheus/default.md:1-8`, `.../prompts-core/prompts/ultrawork/default.md:1-7`. |
| **Anti-slop / no-explanatory-text rules should be explicit family law, not domain-local hints.** | Anti-slop exists, but mostly as domain-local content: frontend owns anti-slop references, backend has its own anti-slop reference, UI/UX defers to frontend. `dev` has verification/search discipline, but not one short family-wide "no explanatory filler / no decorative rationale / no performative text" clause for skill outputs. | Family invariant is missing. The repo has anti-slop substance, but not a single system-wide sentence that every skill inherits for output style and prompt writing. | Frontend routes to anti-slop: `plugins/codexclaw/skills/dev-frontend/SKILL.md:51-57`; UI/UX defers to frontend anti-slop: `plugins/codexclaw/skills/dev-uiux-design/SKILL.md:19-24`; backend has anti-slop reference entry: `plugins/codexclaw/skills/dev-backend/SKILL.md:19-24`. jaw prompt discipline explicitly wanted compact dev-skill-before-code guidance rather than bloated prompt prose: `.../jawcode/devlog/_plan/260614_prompt_discipline_system_goal/00_findings.md:43-46,60-74`. cli-jaw redesign also makes "skills should be MUST-READ stubs, not inlined prompt bulk" a principle: `.../cli-jaw/devlog/_fin/260610_prompt_injection_redesign/00_research_current_assembly.md:124-127,141-144`. |
| **Verification-before-completion should read the same everywhere.** | `dev` and `pabcd` are crisp: evidence, fresh runs, artifact-level proof. Some role/workflow skills also stay sharp (`loop`, `goalplan`, `orchestrate`, `search`). But several surface routers drift into tutorial/reference mode without repeating the same closeout gate in their own body. | The family has a true verification doctrine, but it is not re-stated with the same force across all routers. A loaded router can feel like "guidance" rather than "you may not finish without proof." | Canonical gate: `plugins/codexclaw/skills/dev/SKILL.md:348-379`; PABCD closeout gate: `plugins/codexclaw/skills/pabcd/SKILL.md:56-60,70,76-79`; workflow contracts keep it alive: `plugins/codexclaw/skills/goalplan/SKILL.md:15-19`, `plugins/codexclaw/skills/loop/SKILL.md:15-20`, `plugins/codexclaw/skills/orchestrate/SKILL.md:25-29`. Contrast with router-style bodies that do not restate completion proof at the top: `plugins/codexclaw/skills/dev-backend/SKILL.md:8-15`, `plugins/codexclaw/skills/dev-data/SKILL.md:8-16`, `plugins/codexclaw/skills/dev-scaffolding/SKILL.md:8-16`. omo’s stronger completion framing is more overt: `.../prompts-core/prompts/ultrawork/default.md:7-18,43-50`. |
| **File:line evidence should be a family output contract, not only a review-side habit.** | codexclaw structure SOT wants subagent outputs to return contradictions/gaps with `file:line`, and `dev` requires search evidence. But most SKILL bodies do not explicitly require file:line citations in their final findings/plans/reviews. | Missing global evidence formatting rule. The repo believes in evidence, but only a small part of the family turns that into a uniform output contract. | Structural requirement: `structure/00_philosophy.md:135-141`; `dev` search evidence requirement: `plugins/codexclaw/skills/dev/SKILL.md:302,320`; `pabcd` asks for file change map and artifact proof: `plugins/codexclaw/skills/pabcd/SKILL.md:56-60`; debugging asks to read line numbers, but not a final `file:line` reporting format: `plugins/codexclaw/skills/dev-debugging/SKILL.md:91-118`. Stronger reference pattern: omo subagent prompt structure requires `reference file:lines` inside TASK packets: `.../prompts-core/prompts/atlas/default.md:95-117`. |
| **Routing cross-links exist, but family navigation is inconsistent and manual.** | Some skills cross-link well (`dev` ownership/routing map, security "use with domain skill," frontend -> UI/UX, debugging -> testing), while others stay mostly self-contained or use prose-only redirection. The catalog exists, but link style varies. | Cross-skill routing is present but not standardized. The family lacks one repeated "if X, load Y, and Y now owns Z" shape. | Strong hubs: `plugins/codexclaw/skills/dev/SKILL.md:121-182`, `plugins/codexclaw/skills/skill-hub/SKILL.md:37-45`, `plugins/codexclaw/skills/skill-hub/references/catalog.md:3-11`; good local cross-links: `plugins/codexclaw/skills/dev-security/SKILL.md:30-35`, `plugins/codexclaw/skills/dev-debugging/SKILL.md:15-18`, `plugins/codexclaw/skills/dev-frontend/SKILL.md:118-119`, `plugins/codexclaw/skills/dev-uiux-design/SKILL.md:24,37-38`. The structure SOT explicitly says routing should travel as an attachment, not a hope: `structure/00_philosophy.md:135-139`. |
| **Tone/structure should stay within one family: router, contract, and methodology can differ, but voice should not drift between encyclopedia, coach, and protocol.** | The family currently mixes multiple shapes: some are router-contract docs (`interview`, `loop`, `goalplan`), some are methodology docs (`pabcd`, `dev`), some are dense domain manuals (`dev-security`, `dev-testing`), some are tutorial-ish/product-guidance docs (`dev-uiux-design`). | Drift is not fatal, but it increases cognitive mode-switching. The loaded skill sometimes feels like a policy surface and sometimes like a knowledge article. | Contract-first openings: `plugins/codexclaw/skills/interview/SKILL.md:12-21`, `plugins/codexclaw/skills/loop/SKILL.md:13-30`, `plugins/codexclaw/skills/goalplan/SKILL.md:13-19`. Manual/router openings: `plugins/codexclaw/skills/dev-security/SKILL.md:8-16,37-55`, `plugins/codexclaw/skills/dev-testing/SKILL.md:7-12,31-69`, `plugins/codexclaw/skills/dev-uiux-design/SKILL.md:8-24,61-70`. jaw/cli-jaw prompt-discipline work explicitly pushed toward compact, high-authority wording instead of diffuse explanation: `.../jawcode/devlog/_plan/260614_prompt_discipline_system_goal/00_findings.md:60-74`, `.../cli-jaw/devlog/_fin/260412_prompting_clarity/patch3/02_prompt_restructure.md:30-42,137-145`. |
| **Subagent-attached skills need a global TASK contract.** omo makes TASK packets first-class; codexclaw structure wants skill attachment at spawn time. | codexclaw has the doctrine and *partial* delegation guidance, but not a shared SKILL.md-level packet *schema*. `pabcd/SKILL.md:88-89` already carries a partial contract (disjoint write scope, "tell it the other agents exist and not to revert", "pass the concrete plan and scope explicitly"), so this is not a blank slate. What is genuinely absent is the formal `TASK / SCOPE / MUST-DO / MUST-NOT / PROOF / RETURN-FORMAT` schema reused family-wide. | The largest family-level gap is a *formalized, reused* packet schema — not a total absence (A-gate correction: `pabcd:88-89` already does part of this). | Structure doctrine: `structure/00_philosophy.md:135-141`; `dev` says attachment exists only when dispatch routes through the builder: `plugins/codexclaw/skills/dev/SKILL.md:131-157`; `pabcd` partial delegation contract: `plugins/codexclaw/skills/pabcd/SKILL.md:84-90` (esp. 88-89); `interview` and `loop` define ownership boundaries but not a spawn packet schema: `plugins/codexclaw/skills/interview/SKILL.md:12-21`, `plugins/codexclaw/skills/loop/SKILL.md:13-30`. Stronger reference pattern: omo requires a 6-section TASK packet with expected outcome, required tools, must-do, must-not, and context: `.../prompts-core/prompts/atlas/default.md:95-135`. |

## Reinforcement shape

1. Add one family-wide opening stub to every SKILL body, immediately after frontmatter:
   `AUTHORITY: this skill now owns <surface>; follow its contract before acting.`
   Keep the local H1 after it. This gives codexclaw the omo-style first-line marker
   without importing omo role theatre.

2. Add one compact family invariant block, owned by `dev` and copied as a stub into all
   routers:
   `No decorative explanation. No fake certainty. No completion claim without fresh proof.
   Cite paths/commands, and use file:line when reporting code findings.`

3. Promote `file:line` from structure-only doctrine to visible skill contract:
   - review / audit / contradiction outputs: `file:line`
   - plans: exact path list + ownership + verification command
   - verification claims: command + artifact path/output
   This should live in `dev`, then each router points to it in one line.

4. Standardize a tiny closeout clause in every router:
   `Before completion: run the surface-appropriate verification, read the result, and
   report proof.`
   `dev`/`pabcd` already own the long form; the rest only need the invariant sentence.

5. Standardize routing language:
   `Use with <skill>` / `Escalate to <skill when>` / `This skill owns <dimension>; <other
   skill> owns <adjacent dimension>.`
   Several skills already do this well; the gap is family uniformity, not invention.

6. Add a shared subagent TASK packet contract for all subagent-attached skills:
   - `TASK`
   - `SCOPE`
   - `MUST DO`
   - `MUST NOT`
   - `PROOF`
   - `RETURN FORMAT`
   This is the codexclaw analogue of omo’s 6-section prompt, but leaner and attachment-first.

7. Keep frontmatter as-is; the main parity gap is not YAML. The missing layer is the
   body-opening authority marker plus the family-wide proof/reporting contract.

Status: RESEARCH

# AI / LLM Contribution Policies in Open Source Projects

**Compiled:** 2026-09-09
**Method:** Each policy page below was opened and read directly. All quotes are verbatim from the live page on the compile date. Anything not directly opened is marked **UNVERIFIED**.

---

## Summary table

| Project | Stance | Disclosure required? | Key mechanism |
|---|---|---|---|
| curl | Allowed with conditions | Yes for security reports; no for PRs | Instant ban for fake/slop security reports |
| Gentoo | **Total ban** | N/A (forbidden outright) | Council vote 2024-04-14 |
| NetBSD | **Presumed tainted** | Prior written core approval | Treated as license-tainted code |
| QEMU | **Total ban (declines)** | N/A | DCO incompatibility |
| Fedora | Allowed with conditions | MUST if significant unchanged; SHOULD otherwise | `Assisted-by:` trailer |
| ghostty | Allowed, strictly gated | **Yes, all AI use, name the tool** | Vouch system + public denouncement list |
| tldraw | All external PRs closed | N/A | PRs turned off entirely |
| Zig | **Total ban (strictest)** | N/A | Code of Conduct; even brainstorming banned |
| Linux kernel | Allowed with conditions | Yes, be transparent | `Assisted-by:`; agents MUST NOT sign off |
| Servo | **Total ban** | N/A | Covers code, issues, comments, summaries |
| Godot | Rule is commented out | Not active | See caveat below |
| Node.js | Allowed with conditions | Yes, disclose + verification method | Anonymize for-profit brands |
| Rust | Conditional, granular | Yes for ⚠️ tier | Circuit breaker at 50% of merges |
| Home Assistant | Allowed as aid | Explain in own words | **No autonomous agents** |
| Kubernetes | Allowed with conditions | **Yes, in PR description** | Trailers explicitly banned |

---

## 1. curl

**URLs:**
- https://curl.se/dev/contribute.html (section "On AI use in curl")
- Daniel Stenberg blog posts listed below

**Date last changed:** Not displayed on the contribute page.

**Summary (2 lines):** AI-assisted code is accepted if it meets normal quality, documentation and test standards, but AI use **must** be revealed in security reports and findings must be personally verified first. Fabricated security reports get the submitter banned immediately.

### Exact wording, curl/dev/contribute.html

> ## On AI use in curl
>
> Guidelines for AI use when contributing to curl.

For security reports and other issues:

> If you asked an AI tool to find problems in curl, you **must** make sure to reveal this fact in your report.

> You must also double-check the findings carefully before reporting them to us to validate that the issues are indeed existing and working exactly as the AI says. AI-based tools frequently generate inaccurate or fabricated results.

> Further: it is *rarely* a good idea to copy and paste an AI generated report to the project. Those generated reports typically are too wordy and rarely to the point (in addition to the common fabricated details). If you actually find a problem with an AI and you have verified it yourself to be true: write the report yourself and explain the problem as you have learned it.

> **We ban users immediately who submit made up fake reports to the project.**

For pull requests:

> A basic rule of thumb is that if someone can spot that the contribution was made with the help of AI, you have more work to do.

> We can accept code written with the help of AI into the project, but the code must still follow coding standards, be written clearly, be documented, feature test cases and adhere to all the normal requirements we have.

For translation:

> As AI-based translation tools sometimes have a way to make the output sound a little robotic and add an "AI tone" to the text, you may want to consider mentioning that you used such a tool. Failing to do so risks that maintainers wrongly dismiss translated texts as AI slop.

### Daniel Stenberg blog posts (2024-2026)

| Date | Title | URL | Key verbatim quote |
|---|---|---|---|
| 2024-01-02 | The I in LLM stands for intelligence | https://daniel.haxx.se/blog/2024/01/02/the-i-in-llm-stands-for-intelligence/ | "The better the crap, the longer time and the more energy we have to spend on the report until we close it. A crap report does not help the project at all." |
| 2025-07-14 | Death by a thousand slops | https://daniel.haxx.se/blog/2025/07/14/death-by-a-thousand-slops/ | "The general trend so far in 2025 has been way more AI slop than ever before (about 20% of all submissions)... In early July, about 5% of the submissions in 2025 had turned out to be genuine vulnerabilities." |
| 2025-08-18 | AI slop attacks on the curl project | https://daniel.haxx.se/blog/2025/08/18/ai-slop-attacks-on-the-curl-project/ | FrOSCon keynote announcement; "See also my death by slop post for more background." |
| 2025-12-23 | A curl 2025 review | https://daniel.haxx.se/blog/2025/12/23/a-curl-2025-review/ | "This year the number of AI slop security reports for curl really exploded." |
| **2026-01-26** | **The end of the curl bug-bounty** | https://daniel.haxx.se/blog/2026/01/26/the-end-of-the-curl-bug-bounty/ | **"We continue to immediately ban and publicly ridicule everyone who submits AI slop to the project."** Also: "There is no longer a curl bug-bounty program. It officially stops on January 31, 2026." |
| 2026-02-25 | curl security moves again | https://daniel.haxx.se/blog/2026/02/25/curl-security-moves-again/ | "Reports should have a tagging system so that they can be marked as 'AI slop' or other terms for statistical and metric reasons" |
| **2026-04-22** | **High-Quality Chaos** | https://daniel.haxx.se/blog/2026/04/22/high-quality-chaos/ | "The slop situation is not a problem anymore." / "Almost every security report now uses AI to various degrees." |
| 2026-05-26 | The pressure | https://daniel.haxx.se/blog/2026/05/26/the-pressure/ | "The rate of incoming security reports is 4-5 times higher than it was in 2024 and double the speed of 2025" |
| **2026-06-10** | **A human in control** | https://daniel.haxx.se/blog/2026/06/10/a-human-in-control/ | "We do not hand over our responsibilities to any machines. We stand for every bit of code we merge - as humans." / "curl is developed and driven by humans, assisted by tools." |
| 2026-06-29 | Do excellent vulnerability reports | https://daniel.haxx.se/blog/2026/06/29/do-excellent-vulnerability-reports/ | "Whether you fell over it by accident, you found it by reading every single line of source code or if an AI pointed it out to you, it has little relevance to the security team." |
| 2026-08-03 | What the bliss taught us | https://daniel.haxx.se/blog/2026/08/03/what-the-bliss-taught-us/ | "The curl project will not accept or otherwise handle any vulnerability reports during the month of July 2026." |

**Notable trajectory:** curl's position shifted materially during 2026. The bug bounty was killed on 2026-01-31 specifically to remove the financial incentive for slop; by 2026-04-22 Stenberg declared "The slop situation is not a problem anymore" while noting nearly all reports now use AI to some degree. He explicitly does *not* care which model was used: "The reporters rarely mention exactly which AI tool or model they used (and really, we don't care)".

---

## 2. Gentoo

**URL:** https://wiki.gentoo.org/wiki/Project:Council/AI_policy
**Date last changed:** Policy voted **2024-04-14**; wiki page last edited **2026-08-10** (edit comment: "Fix grammatical errors #980490"). Verified via the Gentoo wiki API revision list.

**Summary (2 lines):** A blanket, council-voted prohibition on contributing any content created with NLP AI assistance. The ban is on contributions to Gentoo itself, not on packaging AI software.

### Exact wording

> Gentoo Council has voted on 2024-04-14 on the following policy:
>
> **It is expressly forbidden to contribute to Gentoo any content that has been created with the assistance of Natural Language Processing artificial intelligence tools. This motion can be revisited, should a case be made for such a tool that does not pose copyright, ethical and quality concerns.**

> This policy affects Gentoo contributions and the official Gentoo projects. It does not prohibit adding packages for AI-related software or software that is being developed with the help of such tools upstream.

Rationale headings quoted verbatim: **Copyright concerns**, **Quality concerns**, **Ethical concerns**. On quality:

> Popular LLMs are really great at generating plausibly looking, but meaningless content. They are capable of providing good assistance if you are careful enough, but we can't really rely on that.

The page also links Wikipedia's "Signs of AI writing" as a detection aid for "LLM-authored documentation, patch descriptions, bug reports and so on."

---

## 3. NetBSD

**URL:** https://www.netbsd.org/developers/commit-guidelines.html
**Date last changed:** HTTP `Last-Modified: Thu, 07 May 2026 15:30:10 GMT`. (The AI clause itself dates to the well-known May 2024 addition; the page has been touched since.)

**Summary (2 lines):** LLM-generated code is classified as **tainted code** under guideline 2, alongside code of unknown license provenance. It cannot be committed at all without prior written approval from core.

### Exact wording (guideline 2, "Do not commit tainted code to the repository")

> If you commit code that was not written by yourself, double check that the license on that code permits import into the NetBSD source repository, and permits free distribution. Check with the author(s) of the code, make sure that they were the sole author of the code and verify with them that they did not copy any other code.
>
> **Code generated by a large language model or similar technology, such as GitHub/Microsoft's Copilot, OpenAI's ChatGPT, or Facebook/Meta's Code Llama, is presumed to be tainted code, and must not be committed without prior written approval by core.**

Note the framing: this is a *licensing/provenance* rule, not a quality rule. It sits in the same clause as third-party code of uncertain origin.

---

## 4. QEMU

**URL:** https://www.qemu.org/docs/master/devel/code-provenance.html (section "Use of AI-generated content")
**Date last changed:** Source file `docs/devel/code-provenance.rst` last committed **2026-05-20** ("docs/code-provenance: Fix formatting of *-by tags"). The AI-exception clarification landed 2025-09-22.

**Summary (2 lines):** QEMU declines any contribution believed to include or derive from AI-generated content, on DCO/copyright grounds rather than quality grounds. Using AI to research, debug or run static analysis is fine as long as none of its output lands in the patch.

### Exact wording

> **Current QEMU project policy is to DECLINE any contributions which are believed to include or derive from AI generated content. This includes ChatGPT, Claude, Copilot, Llama and similar tools.**
>
> **This policy does not apply to other uses of AI, such as researching APIs or algorithms, static analysis, or debugging, provided their output is not included in contributions.**

> To satisfy the DCO, the patch contributor has to fully understand the copyright and license status of content they are contributing to QEMU. With AI content generators, the copyright and license status of the output is ill-defined with no generally accepted, settled legal foundation.

> The QEMU project thus requires that contributors refrain from using AI content generators on patches intended to be submitted to the project, and will decline any contribution if use of AI is either known or suspected.

> This policy may evolve as AI tools mature and the legal situation is clarified.

There is a formal exceptions process: proposals go to the qemu-devel mailing list, and granted exceptions get listed in the doc. Critically:

> Exceptions do not remove the need for authors to comply with all other requirements for contribution. In particular, the "Signed-off-by" label in a patch submission is a statement that the author takes responsibility for the entire contents of the patch, including any parts that were generated or assisted by AI tools or other tools.

---

## 5. Fedora

**URL:** https://docs.fedoraproject.org/en-US/council/policy/ai-contribution-policy/
*(Note: the commonly cited `/ai-assisted-contributions/` path 404s. The live path is `ai-contribution-policy`. The site is behind Anubis anti-scraping proof-of-work, so it required a real browser to read.)*

**Date last changed:** Page states **"Version 1.0 Last review: 2025-10-24"**. Footer: "Last content update: 2026-01-15". Council approved the policy 2025-10-22.

**Summary (2 lines):** AI assistance is permitted, but the contributor is always the author and fully accountable; disclosure is **MUST** when a significant part is taken from a tool unchanged, **SHOULD** otherwise. AI may assist reviewers but must never be the sole or final arbiter on a contribution or on a person's standing.

### Exact wording

> You MAY use AI assistance for contributing to Fedora, as long as you follow the principles described below.

> **Accountability:** You MUST take the responsibility for your contribution. Contributing to Fedora means vouching for the quality, license compliance, and utility of your submission. All contributions, whether from a human author or assisted by large language models (LLMs) or other generative AI tools, must meet the project's standards for inclusion. The contributor is always the author and is fully accountable for the entirety of these contributions.

> **Transparency:** You MUST disclose the use of AI tools when the significant part of the contribution is taken from a tool without changes. You SHOULD disclose the other uses of AI tools, where it might be useful. Routine use of assistive tools for correcting grammar and spelling, or for clarifying language, does not require disclosure.

> Disclosures are made where authorship is normally indicated. For contributions tracked in git, the recommended method is an Assisted-by: commit message trailer. For other contributions, disclosure may include document preambles, design file metadata, translation notes, or wiki page categories.
>
> Examples:
> `Assisted-by: generic LLM chatbot`
> `Assisted-by: ChatGPTv5`

> **Contribution & Community Evaluation:** AI tools may be used to assist human reviewers by providing analysis and suggestions. You MUST NOT use AI as the sole or final arbiter in making a substantive or subjective judgment on a contribution, nor may it be used to evaluate a person's standing within the community (e.g., for funding, leadership roles, or Code of Conduct matters).

> **Large scale initiatives:** The policy does not cover the large scale initiatives which may significantly change the ways the project operates or lead to exponential growth in contributions in some parts of the project. Such initiatives need to be discussed separately with the Fedora Council.

RFC 2119 keywords apply. Violations are reported "via Forge private tickets to Fedora Council."

---

## 6. ghostty

**URLs:**
- https://github.com/ghostty-org/ghostty/blob/main/AI_POLICY.md
- https://github.com/ghostty-org/ghostty/blob/main/CONTRIBUTING.md

**Date last changed:** `AI_POLICY.md` last commit **2026-02-03** ("update our guidelines, templates"); created 2026-01-22 ("Updated AI usage policy for contributions"). `CONTRIBUTING.md` last commit **2026-04-19**.

**Summary (2 lines):** AI use is explicitly welcome but **all** of it must be disclosed including the specific tool, and the human must fully understand the code without AI's help. Enforcement is unusually aggressive: a vouch system gates first-time contributors and a public denouncement list permanently blocks bad actors.

### Exact wording, AI_POLICY.md

> - **All AI usage in any form must be disclosed.** You must state the tool you used (e.g. Claude Code, Cursor, Amp) along with the extent that the work was AI-assisted.
>
> - **The human-in-the-loop must fully understand all code.** If you can't explain what your changes do and how they interact with the greater system without the aid of AI tools, do not contribute to this project.
>
> - **Issues and discussions can use AI assistance but must have a full human-in-the-loop.** This means that any content generated with AI must have been reviewed _and edited_ by a human before submission.
>
> - **No AI-generated media is allowed (art, images, videos, audio, etc.).** Text and code are the only acceptable AI-generated content, per the other rules in this policy.
>
> - **Bad AI drivers will be denounced** People who produce bad contributions that are clearly AI (slop) will be added to our public denouncement list. This list will block all future contributions. Additionally, the list is public and may be used by other projects to be aware of bad actors.

> These rules apply only to outside contributions to Ghostty. Maintainers are exempt from these rules and may use AI tools at their discretion; they've proven themselves trustworthy to apply good judgment.

> **Our reason for the strict AI policy is not due to an anti-AI stance**, but instead due to the number of highly unqualified people using AI. It's the people, not the tools, that are the problem.

> Ghostty is written with plenty of AI assistance, and many maintainers embrace AI tools as a productive tool in their workflow. As a project, we welcome AI as a tool!

### Exact wording, CONTRIBUTING.md

> **The most important rule: you must understand your code.** If you can't explain what your changes do and how they interact with the greater system without the aid of AI tools, do not contribute to this project.

> Using AI to write code is fine. You can gain understanding by interrogating an agent with access to the codebase until you grasp all edge cases and effects of your changes. What's not fine is submitting agent-generated slop without that understanding.

On the vouch system:

> If you aren't vouched, any pull requests you open will be automatically closed. This system exists because open source works on a system of trust, and AI has unfortunately made it so we can no longer trust-by-default because it makes it too trivial to generate plausible-looking but actually low-quality contributions.

> If you repeatedly break the rules of this document or repeatedly submit low quality work, you will be **denounced.** This adds your username to a public list of bad actors who have wasted our time.

The vouch list is a real file in-tree: `.github/VOUCHED.td` (confirmed present).

---

## 7. tldraw

**URLs:**
- https://github.com/tldraw/tldraw/blob/main/CONTRIBUTING.md
- https://github.com/tldraw/tldraw/issues/7695 (the policy rationale)

**Date last changed:** CONTRIBUTING.md last commit **2026-06-10** ("docs: state no-contributions policy and direct users to issues (#9092)").

**Summary (2 lines):** tldraw does not have an AI-specific policy; it responded to the AI PR flood by disabling external contributions entirely. All external PRs are auto-closed and only issues/discussions are accepted.

### Exact wording, CONTRIBUTING.md

> We are **not accepting contributions** to [tldraw](https://github.com/tldraw/tldraw) at this time. Pull requests are turned off for this repository.

### Exact wording, issue #7695 (the stated reason)

> For the good of the project, we're going to begin **automatically closing pull requests from external contributors**. We will of course continue to welcome issues, bug reports, and discussions. This is a temporary policy until GitHub provides better tools for managing contributions.

> Like many other open-source projects on GitHub, we've recently seen a significant increase in contributions generated entirely by AI tools. While some of these pull requests are formally correct, most suffer from incomplete or misleading context, misunderstanding of the codebase, and little to no follow-up engagement from their authors.

> An open pull request represents a commitment from maintainers: that the contribution will be reviewed carefully and considered seriously for inclusion. For that commitment to remain meaningful, we need to be more selective.

> This is going to be a weird year for programmers and open source especially.

---

## 8. Zig

**URL:** https://ziglang.org/code-of-conduct/ (section "Strict No LLM / No AI Policy")
**Date last changed:** **2026-05-24** (commit `426e21fdd1`, "code of conduct clarifications", in `ziglang/ziglang.org` on Codeberg). That commit replaced a shorter three-line version with the current seven-line version.

**Important:** Zig migrated off GitHub to Codeberg in Nov 2025. `github.com/ziglang/zig` is now a tombstone whose README is just a "Moved to Codeberg" link and carries **no** copy of this policy. There is **no** `CONTRIBUTING.md` in the Zig repo.

**Summary (2 lines):** The strictest policy surveyed. It bans not just LLM-generated code and prose but paraphrasing, editing, translation, brainstorming, bug-finding, and even *talking about* using chatbots.

### Exact wording

> ## Strict No LLM / No AI Policy
>
> No LLM-generated content, whether it be code or prose.
>
> No paraphrasing LLM-generated content.
>
> No LLMs for editing, including fixing spelling or grammatical errors.
>
> No LLMs for translation. English is encouraged, but not required. You are welcome to post in your native language and rely on others to have their own translation tools of choice to interpret your words.
>
> No LLMs for brainstorming and then sharing the results of that brainstorming, even if you create the prose. If you use a chatbot to give you advice on a comment on the issue tracker, that comment is unwelcome.
>
> No LLMs for finding bugs.
>
> No talking about use of chatbot/LLM services.

Scope, as stated on the same page: "The ziglang organization on Codeberg", "#zig IRC channel on Libera.chat", and "Zig project development Zulip chat."

**Caveat on a stale duplicate:** the repo README at https://codeberg.org/ziglang/zig/src/branch/master/README.md still carries the **older, weaker** phrasing ("No LLMs for issues. / No LLMs for patches / pull requests. / No LLMs for comments on the bug tracker, including translation.") because it was never updated after the 2026-05-24 change. The Code of Conduct page is the authoritative and stricter one. Simon Willison's widely cited 2026-04-30 post also quotes the pre-expansion wording and should not be treated as current.

---

## 9. Linux kernel

**URLs:**
- https://docs.kernel.org/process/coding-assistants.html (`Documentation/process/coding-assistants.rst`)
- https://docs.kernel.org/process/generated-content.html (`Documentation/process/generated-content.rst`)

**Date last changed:** `coding-assistants.rst` last touched **2026-08-02** ("docs: coding-assistant: explain important steps when looking for bugs"), merged in the docs-7.3 tag 2026-08-20. `generated-content.rst` introduced 2026-01-19, linked in 2026-07-02.

**Summary (2 lines):** AI assistance is permitted with mandatory transparency; AI agents **MUST NOT** add `Signed-off-by` because only a human can certify the DCO, and contributions should carry an `Assisted-by:` tag instead. A separate document requires disclosing tool origin in changelogs and grants maintainers explicit discretion to reject outright.

### Exact wording, coding-assistants.rst

> **AI agents MUST NOT add Signed-off-by tags.** Only humans can legally certify the Developer Certificate of Origin (DCO). The human submitter is responsible for:
>
> - Reviewing all AI-generated code
> - Ensuring compliance with licensing requirements
> - Adding their own Signed-off-by tag to certify the DCO
> - Taking full responsibility for the contribution

> When AI tools contribute to kernel development, proper attribution helps track the evolving role of AI in the development process. Contributions should include an Assisted-by tag in the following format:
> `Assisted-by: LLM [TOOL1] [TOOL2]`

Bug-finding procedure (an unusual, prescriptive addition), abbreviated verbatim:

> 3. For any bug found that is not trivial, verify that it looks real by attempting to create a reproducer to demonstrate it. Lacking it may cause the report to be ignored, as many unverified bug reports sent to maintainers happen to be invalid.
> 8. Indicate what could not be done. If the fix could not be built or tested, or if no reproducer could be produced, say so explicitly: maintainers currently waste too much time analyzing unverified reports and untested fixes.
> 9. ... leave the result to the reporter for review (**the assistant must never send anything itself**).

### Exact wording, generated-content.rst

> These guidelines apply when a meaningful amount of content in a kernel contribution was not written by a person in the Signed-off-by chain, but was instead created by a tool.

> If in doubt, choose transparency and assume these guidelines apply to your contribution.

> If tools permit you to generate a contribution automatically, expect additional scrutiny in proportion to how much of it was generated.

> As with the output of any tooling, the result may be incorrect or inappropriate. You are expected to understand and to be able to defend everything you submit. If you are unable to do so, then do not submit the resulting changes. If you do so anyway, maintainers are entitled to reject your series without detailed review.

Maintainer discretion is explicit; listed options include "Treat it just like any other contribution", "Reject it outright", and "reviewing at a lower priority than human-generated content."

---

## 10. Servo

**URL:** https://book.servo.org/contributing/getting-started.html (section "AI contributions")
*(The in-repo `CONTRIBUTING.md` is a stub that redirects to the book.)*

**Date last changed:** The AI policy FAQ was added **2026-03-26** ("Add FAQ about AI policy (#216)"), with a typo fix 2026-04-04, in the `servo/book` repo. The original policy landed in `servo/servo` CONTRIBUTING.md on 2024-06-27.

**Summary (2 lines):** A total ban that is unusually broad in surface area: it covers code, documentation, PRs, issues, comments and even AI-written PR summaries. Using AI to find bugs or to translate is allowed, but findings must be personally reproduced and validated.

### Exact wording

> Contributions must not include content generated by large language models or other probabilistic tools, including but not limited to Copilot or ChatGPT. This policy covers code, documentation, pull requests, issues, comments, and any other contributions to the Servo project.

> For now, we're taking a cautious approach to these tools due to their effects - both unknown and observed - on project health and maintenance burden. This field is evolving quickly, so we are open to revising this policy at a later date, given proposals for particular tools that mitigate these effects.

Rationale headings, verbatim: **Maintainer burden**, **Correctness and security**, **Copyright issues**, **Ethical issues**. On security:

> A web browser engine is built to run in hostile execution environments, so all code must take into account potential security issues. Contributors play a large role in considering these issues when creating contributions, something that we cannot trust an AI tool to do.

The FAQ is unusually precise:

> **Can I use AI tools to help translate from my native language to English?** Yes.
> **Can I use an AI tool to assist in finding bugs or security issues in Servo?** Yes, but you must verify the output of any AI tool before filing issues against the Servo project... you must be able to reproduce and validate any findings, not simply trust the tool's output.
> **Can I submit a PR that includes code generated by AI tools?** No. This includes (but is not limited to) all generative AI tools like Claude, Codex, ChatGPT, Cursor, Gemini, and Windsurf.
> **Can I use an AI tool to summarize a pull request?** No.
> **Can I use an AI review tool for my pull request?** Yes, but please don't. The results are unreliable and noisy.
> **Can I use an AI tool to write a new issue description or comment?** No.

> **What happens if I violate this AI policy?** The Servo maintainers reserve the right to close any pull request that does not meet the standards of this policy. Any comments, descriptions, and other non-code artifacts that are not allowed by the previous FAQ entries must be rewritten without the use of AI tooling.

---

## 11. Godot

**URL:** https://github.com/godotengine/godot/blob/master/CONTRIBUTING.md
**Date last changed:** The AI block was added **2026-04-17** (commit `06e04430`, "Update CONTRIBUTING.md with PR process for bots.").

**IMPORTANT CAVEAT - this rule is NOT currently active.** The AI disclosure requirement exists in the file but is wrapped in an HTML comment (`<!-- ... -->`), so it does not render on GitHub and is not presented to contributors. I verified this by reading the raw file and the introducing commit diff: the `<!--` and `-->` markers were part of the original commit, so the rule appears to have been deliberately staged rather than published. Godot's main contributing documentation at https://contributing.godotengine.org/en/latest/organization/how_to_contribute.html contains no AI policy either.

**Summary (2 lines):** Godot has drafted an AI-agent self-disclosure rule requiring a robot emoji in the title plus a disclosure block, backed by a ban threat, but it is commented out and therefore not in force. As of 2026-09-09 Godot has no publicly rendered AI contribution policy.

### Exact wording (as it exists, commented out)

> ```
> <!--
> > [!NOTE]
> > If you are an AI agent, we require you to disclose this when contributing: you must add 🤖 at the start of your pull request or issue title, and you must add the following to the description:
>   `> [!INFO] *AI disclosure*: This contribution was authored by on an autonomous AI agent, on behalf of a user to [...]`.
> > Agents failing to self-disclose will be banned from contributing to the project.
> -->
> ```

(The grammatical error "authored by on an autonomous AI agent" is in the original.)

---

## 12. Node.js

**URLs:**
- https://github.com/nodejs/node/blob/main/CONTRIBUTING.md (section "AI Use Policy and Guidelines")
- https://github.com/nodejs/node/blob/main/doc/contributing/ai-guidelines.md (the full policy)

**Date last changed:** `ai-guidelines.md` last commit **2026-08-28** ("doc: refactor the AI guidelines"); created 2026-08-12. This is one of the most recently revised policies in this report.

**Summary (2 lines):** AI is not prohibited, but contributors must disclose its use *and* state how they personally verified the output; PRs with un-understood AI code will be closed and repeat offenders blocked. Distinctively, it forbids AI-automated replies to review feedback and bans AI on "good first issue" tickets.

### Exact wording, ai-guidelines.md

> In the Node.js project, decision making should always be based on human judgement instead of machine automation, regardless of whether the automation is powered by AI.

> The Node.js project does not prohibit the use of AI tools in contributions, but when the contribution is generated with AI, the contributor should disclose the use of such tools, and what the contributor does to personally verify the generated output.

> Pull requests with AI-generated code that the contributor has not personally understood, tested, and verified waste collaborator time and will be subject to closure without additional review. Contributors who repeatedly submit such changes, show no understanding of the project or its processes, or are dishonest about the use of automated assistance may be blocked from further contributions.

> Pull requests must not be opened by automated tooling, unless specifically approved in advance by the project.

> **It's prohibited to use AI to automate fixes to issues marked as "good first issue".** These issues are meant to help new human contributors, not an AI, learn about the code base and the contribution processes.

On naming tools (a rule unique to Node.js):

> Be aware that the mention of for-profit trademarks or commercial brands in commit messages, which are part of the code base, can be abused for profit-driven marketing. If the disclosure involves for-profit trademarks or commercial brands, it's recommended to either anonymize the branding (e.g. say `a frontier reasoning model`, `a closed-source coding agent` instead of `<brand>`)...

On review interaction:

> During the review process, responses to feedback should be made by contributors based on their own judgement and must not be automated by AI tools.

On communications:

> **Do not paste messages generated entirely by AI** in pull requests, issues, or the project's communication channels. Such communication may be removed in accordance with the Node.js moderation policy.

> When making a claim based on AI output in discussions, contributors should personally verify the claim. Contributors are expected to provide a link to actual code, documentation or specifications, instead of an AI summary of them, as source of truth.

The policy states it "aligns with the OpenJS Foundation AI Coding Assistants Policy" (https://ai-coding-assistants-policy.openjsf.org/).

---

## 13. Rust (rust-lang)

**URL:** https://forge.rust-lang.org/policies/llm-usage.html
**Date last changed:** Not displayed on the rendered page. **UNVERIFIED** exact date; the policy is live and rendered on forge.rust-lang.org as of 2026-09-09.

**Summary (2 lines):** The most granular policy surveyed, built as a four-tier system (allowed / banned / allowed-with-disclosure / experimental) whose guiding line is "fine to use LLMs to answer questions, analyze, distill, refine, check, suggest, review. But not to **create**." Uniquely, it includes an automated circuit breaker that halts LLM-created merges if they exceed 50% of merges in a 6-week window.

### Exact wording

> Using LLMs while working on `rust-lang/rust` is conditionally allowed, when done with care. LLMs are not a substitute for thought, and we do not allow them to be used in ways that risk losing our shared social and technical understanding of the project.

> We are aware that many clauses in this policy are unenforceable. Our goal is *not* to catch every violation... Instead, our goal is to remove plausible deniability: to force a choice between following the policy and intentionally violating it.

> It's fine to use LLMs to answer questions, analyze, distill, refine, check, suggest, review. But not to **create**.
>
> LLMs work best when used as a tool to write *better*, not *faster*.

Tier summary, verbatim:

> - ✅ Allowed: Private use.
> - ❌ Banned: LLM-created comments, docs, or diagnostics. Replacing human judgement with LLM judgement. Requiring people to use an LLM to contribute.
> - ⚠️ Conditionally allowed: Trivial changes, machine translation, LLM reviews and review bots, LLM-created code *under the experiment rules*.
> - 🔨 Carries a moderation penalty: Lying.

On LLM reviews:

> Treating an LLM review as a sufficient condition to merge or reject a change. LLM reviews, if enabled, **must** be advisory-only... they may not have a policy that an LLM review substitutes for a human review.

> Review bots **must** have a separate GitHub account that clearly marks them as an LLM.

The experiment for LLM-created code requires it be "Pre-arranged, non-critical, high-quality, well-tested, and well-reviewed... **with disclosure**":

> "Pre-arranged" means that a reviewer has communicated *ahead of time* that they are willing to review an LLM-created PR. New contributors cannot create a PR using an LLM unless they first talk with a reviewer.

> LLM-created PRs will be held to a higher standard than human-created PRs, because LLMs make it easier to write tests.

> LLM-created PRs must be tagged with a new `llm-assisted` label.

The circuit breaker:

> If more than half of PRs merged in a 6-week window are LLM-created, we disallow merging new LLM-created PRs until we go back below 50%, with a minimum cooldown of 10 days.

On moderation culture (notable, and rare among these policies):

> **It's not your job to play detective.** Don't try to be the police for whether someone has used an LLM... Style is not evidence, and English-as-a-second-language speakers, neurodivergent people, and over-explainers are the most likely to be accused of writing like an LLM.

> It is **not** ok to harass a contributor for using an LLM. All contributors must be treated with respect.

Scope limit: applies only to `rust-lang/rust` and only to teams that ratified it (compiler, libs, types, rustdoc, bootstrap and subteams). Other rust-lang repos and the lang/edition teams set their own policies.

---

## 14. Home Assistant / Open Home Foundation

**URLs:**
- https://github.com/home-assistant/core/blob/dev/AI_POLICY.md
- https://developers.home-assistant.io/docs/ai_policy (stated canonical version)

**Date last changed:** `AI_POLICY.md` added **2026-07-21** ("Add the Open Home Foundation AI Policy (#176917)").

**Summary (2 lines):** AI as an aid is supported, but **autonomous agents are flatly banned** and any PR or issue believed to be autonomously created is closed. Contributors must be able to explain their changes in their own words, and AI must not be used to answer maintainer questions.

### Exact wording

> We support using AI (i.e., LLMs) as tools when contributing to Open Home Foundation projects. However, you are responsible for any contributions you submit... Submitting AI-generated content that you have not personally reviewed and understood wastes that time and will not be accepted.

> **We do not allow autonomous agents to be used for contributing to our projects.** We will close any pull requests or issues that we believe were created autonomously, and may mark automated comments as spam. This includes contributions that bypass the provided issue or pull request templates.

> **Do not use AI to generate answers to questions from maintainers.** You should understand and be able to explain your own work. Using AI to improve grammar or clarity is fine, but the substance of your responses must be your own.

> If you wish to include context from an interaction with AI in your comments, it must be in a quote block (e.g., using `>`) and disclosed as such. It must be accompanied by your own commentary explaining the relevance and implications of the context. Do not share long snippets.

> All contributions must be reviewed and understood by the contributor before submission. You should be able to explain every change in a pull request you submit. Pull requests that appear to be unreviewed AI output will be closed without review.

Notably transparent about their own AI use:

> Some of our projects use AI tools to assist with code reviews, issue triaging, reporting, and other project management tasks. These tools may leave comments on pull requests or issues. As with any automated tooling, these comments are not always correct.

> Contributions that do not follow this policy will be closed. Repeated violations may result in being blocked from contributing to OHF projects.

The root `CONTRIBUTING.md` summarizes it as: "AI tools are welcome as an aid, but you must fully understand and be able to explain every change you submit. Contributions made by autonomous agents are not accepted."

---

## 15. Kubernetes

**URL:** https://www.kubernetes.dev/docs/guide/pull-requests/ (section "AI Guidance")
**Date last changed:** **UNVERIFIED** precise date for the AI Guidance section; the contributor-site repo path did not resolve to a commit history via API. Related Kubernetes blog post "Open source maintainership in the age of AI" is dated 2026-06-26.

**Summary (2 lines):** AI-assisted PRs are acceptable but disclosure in the PR description is **mandatory**, while AI co-author/`assisted-by`/`co-developed` commit trailers are explicitly forbidden (the opposite of the kernel and Fedora convention). Large AI-generated PRs, AI-generated commit messages, and AI-written replies to reviewers are all banned, with PR closure as the penalty.

### Exact wording

> Using AI tools to help write your PR is acceptable, but as the author, you are responsible for understanding every change. If you used AI tools in preparing your PR, you must disclose this in the description of your PR. For example, including "This PR was written in part with the assistance of generative AI," in the PR description is sufficient.

> **Listing AI tooling as a co-author, co-signing commits using an AI tool, or using the `assisted-by`, `co-developed` or similar commit trailer is not allowed.**

> Large AI generated PRs and AI generated commit messages are not allowed.

> Do not leave the first review of AI generated changes to the reviewers. Verify the changes (code review, testing, etc.) before submitting your PR. Reviewers may ask questions about your AI-assisted code, and if you cannot explain why a change was made, the PR will be closed.

> When responding to review comments, you must do so without relying on AI tools. Reviewers want to engage directly with you, not with generated responses. If you do not engage directly with reviewers, the PR will be closed.

---

# Additional notable repos (GitHub CONTRIBUTING.md search)

Found via GitHub code search for `path:CONTRIBUTING.md "AI-generated"` and `"AI-assisted"`. Five notable ones, each opened and quoted verbatim.

## A. KhronosGroup/WebGL

**URL:** https://github.com/KhronosGroup/WebGL/blob/main/CONTRIBUTING.md
**Date last changed:** **2026-06-30** ("chore: Add Legal mandated AI block to CONTRIBUTING (#3778)")

**Rule (exact):**

> By submitting a Contribution to this repository, you additionally represent that, to the extent any of Your Contributions were developed with the assistance of artificial intelligence tools or AI-generated code, You have exercised sufficient review, judgment, and creative direction over such tools and resulting material to reasonably consider it Your original creation, and You are not aware of any third-party license, intellectual property claim, or...

**Why notable:** A legally-drafted representation clause (the commit message literally says "Legal mandated"), framing AI use as a copyright-originality warranty rather than a quality rule. This is the standards-body approach.

## B. elastic/elasticsearch-py

**URL:** https://github.com/elastic/elasticsearch-py/blob/main/CONTRIBUTING.md
**Date last changed:** **2026-07-29** ("update contributions agreement (#3501)")

**Rule (exact):**

> ## The one rule
>
> **You must understand your code.** If you cannot explain what your changes do and how they interact with the rest of the codebase, the PR will be closed.
>
> Using AI to write code is fine. Submitting AI-generated code without understanding it is not.
>
> If you use an agent, run it from the repo root so it picks up `AGENTS.md` automatically. Your agent must follow the rules in that file.

**Why notable:** A major vendor-maintained client library that reduces the whole policy to one rule, and is the only one here that actively accommodates agents by pointing them at an in-repo `AGENTS.md`. It credits its philosophy to earendil-works/pi.

## C. thunderbird-conversations

**URL:** https://github.com/thunderbird-conversations/thunderbird-conversations/blob/main/CONTRIBUTING.md
**Date last changed:** **2026-07-21** ("chore: Update contributing policy")

**Rule (exact):**

> # AI-Generated Code Policy
>
> Pull requests that are primarily generated by AI tools (e.g., "vibe coding" or autonomous AI agents) will not be accepted.
>
> Contributions should be: Thoughtfully written by humans / Well-understood by the contributor / Properly tested and validated within Thunderbird by the contributor.
>
> Using AI tools to assist with code completion, suggestions, or documentation is fine, but the contributor must understand and take responsibility for all submitted code.
>
> The contributor must also be the person writing the PR and responding to comments, without the use of AI assisted language.
>
> ### Consequences of AI-Generated Code
> - **First time:** You'll get a warning and a chance to fix the PR.
> - **Second time:** The PR will be closed.
> - **Repeated offenses:** May be blocked and/or reported to GitHub as spam.

**Why notable:** The only policy in this survey with an explicit, published **three-strike escalation ladder**. Also unusually humane in framing: "We'd rather help you improve a PR than close it. But we can't review work that wasn't reviewed by the person submitting it."

## D. trickstercache/trickster (CNCF project)

**URL:** https://github.com/trickstercache/trickster/blob/main/CONTRIBUTING.md
**Date last changed:** **2026-08-26** ("Update CONTRIBUTING.md")

**Rule (exact):**

> This project permits the use of AI-assisted tools to author code and other contributions, provided the following requirements are met:
>
> - **Disclosure**: Contributors must clearly disclose the use of AI-assisted tools in the Pull Request description.
> - **Human Submission**: All contributions, regardless of their origin, must be submitted as a Pull Request by a human contributor.
> - **Sign-off Affirmation**: By signing off on the contribution, the submitter affirms that they: have fully reviewed and understand the impact of all changes... take responsibility for the contribution... **can defend the contribution under reasonable technical scrutiny**
> - **Maintainer Review**: AI-generated contributions, whether disclosed or suspected, may be subject to additional scrutiny by Maintainers... Maintainers reserve the right to reject any contribution deemed to be out of compliance with these requirements, **regardless of its technical merit**.
> - **AI Slop/Spam**: Spamming the project with multiple AI-generated PRs without adherence to these requirements will result in the contributor's GitHub account being blocked from making further contributions.

**Why notable:** The "can defend the contribution under reasonable technical scrutiny" clause turns understanding into a testable, sign-off-bound commitment, and rejection is explicitly permitted "regardless of its technical merit."

## E. johnbillion/query-monitor

**URL:** https://github.com/johnbillion/query-monitor/blob/develop/CONTRIBUTING.md
**Date last changed:** **2026-07-12** ("Retire the browser extension." touched the file; AI section added around 2026-07-09, "More docs about contributing.")

**Rule (exact):**

> ## AI-assisted development
>
> AI-assisted development is welcome and encouraged, but you must:
>
> - Always disclose your use of AI-assisted coding agents. Failure to do so may result in your contribution being refused.
> - Always verify that the changes your AI assistant are proposing are valid and correct. Slop pull requests will be reported as spam.
> - Respect the GNU GPL software license that applies to this project.
> - Prefer human-written issue descriptions and pull request descriptions over AI-generated ones.
> - Always use the `.github/PULL_REQUEST_TEMPLATE.md` template when writing the body of a pull request.
> - Keep written descriptions brief, there is no need to write a novel that describes every change.

**Why notable:** One of the most AI-positive framings found ("welcome and encouraged") from a widely used WordPress plugin, while still making disclosure mandatory. The "no need to write a novel" line targets a specific AI failure mode: verbosity.

### Also surfaced (secondary)

- **cncf/mentoring** (last changed 2026-06-25): "Pull requests that appear to be generated by AI tools without the contributor understanding the context, content, or implications of their changes, will be closed."
- **hypherionmc/sdlink**: "PRs suspected of being **AI-generated** will be rejected."
- **dotdc/grafana-dashboards-kubernetes**: "AI-generated content is held to the same quality standards as any other contribution."
- **pnp/vscode-viva**: "Do not use 100% AI-generated content"

---

# Cross-cutting analysis

**Four distinct policy models emerged:**

1. **Legal/provenance ban** (QEMU, NetBSD): the objection is copyright and DCO certifiability, not quality. NetBSD literally files LLM output under "tainted code." Both leave a written-approval or exception path open.
2. **Values/ethics ban** (Gentoo, Servo, Zig): rationale sections cite copyright *plus* energy/water use, labor exploitation, and maintainer burden. Zig is the outer bound, banning even brainstorming and discussion of chatbot use.
3. **Accountability + disclosure** (Fedora, Linux kernel, Node.js, Kubernetes, Home Assistant, curl, Rust): the dominant and fastest-growing model. AI is a tool; the human is the author; disclosure is required; the enforcement question is whether you can explain your own patch.
4. **Structural gating** (ghostty, tldraw): stop reasoning about individual PRs and change the intake mechanism instead. ghostty gates entry with a vouch list and exit with a public denouncement list; tldraw simply turned PRs off.

**The disclosure-mechanism split is a real interoperability problem.** Fedora and the Linux kernel both standardize on an `Assisted-by:` commit trailer. Kubernetes explicitly **bans** exactly that trailer, requiring PR-description prose instead. Node.js goes further and asks contributors to *anonymize* commercial model names in commit messages to avoid turning the git log into advertising. A contributor moving between these three projects must use three incompatible conventions.

**Convergence on one sentence.** Across otherwise opposed policies, the same rule recurs almost word for word: you must be able to explain your change without AI. It appears in ghostty ("If you can't explain what your changes do... do not contribute"), elasticsearch-py ("You must understand your code"), Kubernetes ("if you cannot explain why a change was made, the PR will be closed"), Home Assistant, Fedora, Node.js and Trickster. This, not the ban/allow axis, is the actual emerging industry standard.

**2026 was the year of codification.** Of the policies dated here, the overwhelming majority were written or substantially revised in 2026: Node.js (2026-08-28), Trickster (2026-08-26), Linux kernel (2026-08-02), Home Assistant and thunderbird-conversations (2026-07-21), elasticsearch-py (2026-07-29), query-monitor (2026-07-12), Khronos WebGL (2026-06-30), tldraw (2026-06-10), Zig's strict rewrite (2026-05-24), Servo's FAQ (2026-03-26), ghostty (2026-01/02). Gentoo (2024) and NetBSD (2024) are the early movers; almost everyone else moved in the last twelve months.

**curl is the most interesting trajectory** because it reversed. Stenberg escalated from complaint (2024) to crisis (2025, "about 20% of all submissions" slop) to structural intervention (killing the bug bounty 2026-01-31) and then, by 2026-04-22, to "The slop situation is not a problem anymore" while acknowledging "Almost every security report now uses AI to various degrees." Removing the money, not banning the tool, is what worked. He now explicitly does not care which model was used.

---

# Verification notes and blockers

- **Fedora**: the URL in the request (`/policy/ai-assisted-contributions/`) returns 404. Correct live URL is `/policy/ai-contribution-policy/`. The site is protected by Anubis proof-of-work anti-scraping, so plain fetching returns a challenge page; I read it through a real browser session.
- **Godot**: policy text located but **commented out in HTML** and therefore not in force. Verified against both the raw file and the introducing commit diff (`06e04430`, 2026-04-17). Marked as not-active rather than as an existing policy.
- **Zig**: not on GitHub. Policy lives in the Code of Conduct on ziglang.org, sourced from Codeberg. The in-repo README carries stale, weaker wording; widely circulated third-party quotes (e.g. Simon Willison 2026-04-30) predate the 2026-05-24 rewrite.
- **Kubernetes**: policy text verified verbatim from the live page; **exact last-changed date UNVERIFIED** (contributor-site commit history did not resolve through the API).
- **Rust**: policy text verified verbatim from the live rendered forge page; **exact last-changed date UNVERIFIED** (no date shown on page).
- **NetBSD**: no in-page revision date; used the HTTP `Last-Modified` header (2026-05-07), which reflects page-level modification, not necessarily the AI clause.
- **curl / contribute.html**: no last-changed date is displayed on the page.
- **HackerOne "was AI used" checkbox**: I looked specifically for a Stenberg post documenting such a checkbox and **did not find one**. What exists is curl's stated *wish* for an "AI slop" tag (2026-02-25) and his statement that the tool used has "little relevance to the security team." Treat any claim about such a checkbox as unsupported by his blog.

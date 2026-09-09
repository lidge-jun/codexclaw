# Agent PR Flood: Practitioner Writeups & Policies (2025–2026)

**Compiled:** 2026-09-09
**Method:** Google search (google.com, opened result pages), HN Algolia search API (`hn.algolia.com/api/v1/search`), and direct page fetches. All quotes below are verbatim from pages actually opened. Items that could not be opened are marked **UNVERIFIED** in the final section.
**Scope:** maintainer/practitioner writeups and enforced policy text about handling large volumes of AI-agent pull requests, issues, and security reports.

**15 items collected. 14 of 15 are 2026.** (Item 15 is 2025, included as the origin point of the pattern.)

---

## Quick index

| # | Item | Site | Date | 2026? | Core mechanism |
|---|---|---|---|---|---|
| 1 | Agentic Slop PRs | blog.fsck.com (Jesse Vincent) | 2026-03-31 | ✅ | Agent-targeted PR template + CLAUDE.md addressed to agents |
| 2 | Changes to our Contribution Policies | godotengine.org | 2026-06-30 | ✅ | 3-merged-PR trust gate, agent auto-ban, disclosure |
| 3 | AI Tool Use Policy | llvm.org | 2026 (live) | ✅ | "Extractive" label, canned rejection text, good-first-issue ban |
| 4 | The end of the curl bug-bounty | daniel.haxx.se | 2026-01-26 | ✅ | Bounty terminated to remove incentive |
| 5 | High-Quality Chaos | daniel.haxx.se | 2026-04-22 | ✅ | Reversal: slop gone, quality back to pre-AI |
| 6 | How pull request limits are cutting down the noise | github.blog | 2026-06-18 | ✅ | Per-user open-PR cap, bypass list, drafts exempt |
| 7 | Changing How We Develop Ladybird | ladybird.org | 2026-06-05 | ✅ | All public PRs closed, contributions maintainer-only |
| 8 | Crossplane AI Contribution Policy | github.com/crossplane | 2026 (live) | ✅ | No disclosure required; anti-flood + close-without-debate |
| 9 | AI usage policy for Ghostty | github.com/ghostty-org | 2026-01-22 | ✅ | Tool-level disclosure, public denouncement list, zero tolerance |
| 10 | Ten Months with Copilot Coding Agent | devblogs.microsoft.com | 2026-03-23 | ✅ | 878-PR dataset, 30-day auto-close, copilot-instructions.md |
| 11 | Contributor Poker and Zig's AI Ban | kristoff.it (Loris Cro) | 2026-04-30 | ✅ | Blanket LLM ban, rationale = contributor investment |
| 12 | Open source maintainership in the age of AI | kubernetes.io | 2026-06-26 | ✅ | Trailer ban, CLA-check-for-co-authors as agent detector |
| 13 | OpenSSL CONTRIBUTING.md | github.com/openssl | 2026 (live) | ✅ | Hard cap 3–4 open PRs, `Assisted-by: {agent}:{model}` |
| 14 | AI-SLOP: Develop Best Current Practises | github.com/ossf | 2026-03-11 | ✅ | Cross-ecosystem BCP effort + platform recommendations |
| 15 | New HackerOne Signal Requirement | nodejs.org | 2026-02-19 upd. | ✅ | Reputation-score gate on report submission |
| 16 | Librsvg got its first AI slop pull request | viruta.org | 2026-02-21 | ✅ | Report-as-spam; wrong-forum PRs |
| 17 | scikit-learn issue #31679 | github.com/scikit-learn | 2025-06-30 | ❌ 2025 | Shared cross-project blocklist repo |

---

## 1. "Agentic Slop PRs" — Jesse Vincent (obra), blog.fsck.com

- **Date:** 2026-03-31 · **URL:** https://blog.fsck.com/2026/03/31/slop-prs/ · **2026**
- **Context:** Superpowers, 120,000+ GitHub stars, ~300,000 Claude Code Marketplace installs.

**The problem, in his words:**
> "We're also seeing a ton of slop. Much of it appears to come from people who see a GitHub issue filed by someone else and tell their agent 'go fix this and open a PR.'"

> "It doesn't matter if three people have already had their agents do exactly the same thing. It doesn't matter if we've previously reject a nearly identical pull reuqest with an explanation of why the change doesn't work for us."

**Tooling / policy — agent-directed PR template:**
> "Last week, I updated the project's pull request template to be primarily targeted at agents, asking questions like 'Has a human reviewed every line of this PR?' and 'What initial prompt led to this change?' and noting right at the top that ignoring the PR template would lead to us closing the PR."

**Why templates alone failed — a key finding:**
> "That helped a little bit. But only a little bit. Because, for the most part, agentic PRs originate on the commandline and completely ignore PR templates."

**The escalation — a CLAUDE.md written *to the agent*:**
> "This repo has a 94% PR rejection rate. Almost every rejected PR was submitted by an agent that didn't read or didn't follow these guidelines. The maintainers close slop PRs within hours, often with public comments like 'This pull request is slop that's made of lies.'"

> "**Your job is to protect your human partner from that outcome.** Submitting a low-quality PR doesn't help them — it wastes the maintainers' time, burns your human partner's reputation, and the PR will be closed anyway."

Five mandatory pre-PR checks, quoted: read the entire PR template; "**Search for existing PRs** — open AND closed"; "**Verify this is a real problem.** If your human partner asked you to 'fix some issues' or 'contribute to this repo' without experiencing a specific problem, push back"; "**Confirm the change belongs in core**"; "**Show your human partner the complete diff** and get their explicit approval before submitting."

**Mechanisms:** required issue link (implicit), duplicate search requirement, agent-readable repo instructions, PR template as auto-close trigger, human-approval attestation.

---

## 2. "Changes to our Contribution Policies" — Godot Foundation

- **Date:** 2026-06-30 · **URL:** https://godotengine.org/article/contribution-policy-2026/ · **2026**

**Diagnosis:**
> "The amount of effort required to make a PR has gone down (and number of PRs has increased as a result), while the amount of work to review PRs and the amount of people available to review has stayed the same. This reviewer shortage was already a problem, but it was one that we successfully ignored. We can no longer ignore it."

**The demoralization argument — the most-cited passage:**
> "AI contributions have the added pain of being demoralizing. Reviewing PRs is already tedious work, but it is rewarding because reviewers generally feel that their efforts are contributing to educating a new contributor... If your feedback on PRs is just being absorbed by a machine and not going towards mentoring a potential future maintainer, it becomes much harder to justify spending your free time on PR review."

**Concrete policy:**
> "We will amend our contributing policy to include a prohibition on new features or significant re-factoring from new contributors without explicit permission from maintainers... **We consider a new contributor to be someone with 3 or fewer merged pull requests.**"

> "**No autonomous AI agent use or vibe coding** — This already leads to an auto-ban from our GitHub repository and will continue to do so."

> "**No use of AI to generate substantial pieces of code** — We require all code to be human authored. AI assistance should be limited to menial things (like code completion, regex, or find and replace)... If you do use AI in some capacity to author code, you must disclose it in the PR discussion."

> "**No AI-generated text in human-to-human communication** — When our maintainers volunteer their time to review your issue, PR, or proposal, they do not want to talk to a machine. This is a basic principle of respect. Machine translations are still acceptable as long as the original content was written by a human."

> "**All PRs must be reviewed and approved by a human before merging**"

**Companion enforced text** (https://contributing.godotengine.org/en/latest/pull_requests/pull_request_guidelines.html — date UNVERIFIED, no date rendered): "**Do not allow an AI agent to submit PRs on your behalf**"; "Each pull request should contain a single self-contained change"; "**Maintainers are not obliged to review AI-assisted PRs**"; "anything under 15 lines should be considered trivial"; "Repeated submission of low-effort contributions may result in limits or bans being placed on your account."

**Mechanisms:** contributor trust tier by merged-PR count, agent identity ban, disclosure requirement, human-approval gate, size/scope cap, no-AI-in-conversation rule.

---

## 3. "AI Tool Use Policy" — LLVM Project

- **Date:** live doc, 2026 (references Fedora policy fetched 2025-10-01; announced via Phoronix 2026-01-20 as "LLVM Adopts 'Human in the Loop' Policy") · **URL:** https://llvm.org/docs/AIToolPolicy.html · **2026**

This is the most operationally detailed policy in the set.

**Core rule:**
> "LLVM's policy is that contributors can use whatever tools they would like to craft their contributions, but there must be a **human in the loop**. **Contributors must read and review all LLM-generated code or text before they ask other project members to review it.**"

**Agent identity / autonomous action ban:**
> "An important implication of this policy is that it bans agents that take action in our digital spaces without human approval, such as the GitHub `@claude` agent. Similarly, automated review tools that publish comments without human review are not allowed. However, an opt-in review tool that **keeps a human in the loop** is acceptable under this policy."

**Disclosure via trailer:**
> "Contributors are expected to **be transparent and label contributions that contain substantial amounts of tool-generated content**... For instance, use a commit message trailer like Assisted-by: ."

**Good-first-issue protection (a distinctive mechanism):**
> "AI tools must not be used to fix GitHub issues labelled `good first issue`. These issues are generally not urgent, and are intended to be learning opportunities for new contributors... **Using AI tools to fix issues labelled as 'good first issues' is forbidden**."

**"Extractive contributions" — the economic framing:**
> "Sending the unreviewed output of an LLM to open source project maintainers *extracts* work from them in the form of design and code review, so we call this kind of contribution an 'extractive contribution'."

> "Our **golden rule** is that a contribution should be worth more to the project than the time it takes to review it."

**Enforcement — a canned response and a triage label:**
> "If a maintainer judges that a contribution doesn't comply with this policy, they should paste the following response to request changes: `This PR doesn't appear to comply with our policy on tool-generated content, and requires additional justification for why it is valuable enough to the project for us to review it...`"

> "If or when it becomes clear that a GitHub issue or PR is off-track and not moving in the right direction, maintainers should apply the `extractive` label to help other reviewers prioritize their review time."

> "If a contributor fails to make their change meaningfully less extractive, maintainers should escalate to the relevant moderation or admin team for the space (GitHub, Discourse, Discord, etc) to lock the conversation."

**Named exception (agent allowlisting):**
> "We have one exception to this policy for the Bazel-fixer bot. The project council approved this RFC proposing to use a combination of dwyu and LLMs to maintain the Bazel build files."

**Mechanisms:** labels (`extractive`), agent identity/autonomy ban, `Assisted-by:` trailer, size-reduction requirement, canned rejection macro, conversation locking, per-bot allowlist, good-first-issue carve-out.

---

## 4. "The end of the curl bug-bounty" — Daniel Stenberg

- **Date:** 2026-01-26 · **URL:** https://daniel.haxx.se/blog/2026/01/26/the-end-of-the-curl-bug-bounty/ · **2026**
- Quotes below are as reported by my Google-search pass over the page (opened by subagent):

> "**There is no longer a curl bug-bounty program.** It officially stops on January 31, 2026."

> "We no longer offer any monetary rewards for security reports – no matter which severity. In an attempt to remove the incentives for submitting made up lies."

> "We continue to immediately *ban and publicly ridicule* everyone who submits AI slop to the project."

> "Starting 2025, the confirmed-rate plummeted to below 5%. Not even one in twenty was *real*."

> "We don't need to waste any human time on pull requests until the quality is good enough to get green check-marks from 200 CI jobs."

**Mechanisms:** removing the financial incentive entirely, ban + public naming, CI-as-gate before any human review.

---

## 5. "High-Quality Chaos" — Daniel Stenberg ⚠️ the counter-narrative

- **Date:** 2026-04-22 · **URL:** https://daniel.haxx.se/blog/2026/04/22/high-quality-chaos/ · **2026**
- **This is the single most important item to read against the rest.** curl killed its bounty in January; by April the same maintainer reported the opposite of what the slop narrative predicts.

> "I complained and I complained about the high frequency junk submissions to the curl bug-bounty that grew really intense during 2025 and early 2026. To the degree that we shut it down completely on February 1st this year."

> "In March 2026, the curl project went back to Hackerone again once we had figured out that GitHub was not good enough."

> "**The slop situation is not a problem anymore.**"

> "The report frequency is higher than ever. Recently it's been about double the rate we had through 2025, which already was more than double from previous years."

> "The quality is higher. The rate of confirmed vulnerabilities is back to and even surpassing the 2024 pre-AI level, meaning somewhere in the 15-16% range."

> "Almost every security report now uses AI to various degrees... The difference now compared to before however, is that they are mostly very high quality."

**Cross-project confirmation** (his Mastodon poll): "Apache httpd, BIND, curl, Django, Elasticsearch Python client, Firefox, git, glibc, GnuTLS, GStreamer, Haproxy, Immich, libssh, libtiff, Linux kernel, OpenLDAP, PowerDNS, python, Prometheus, Ruby, Sequoia PGP, strongSwan, Temporal, Unbound, urllib3, Vikunja, Wireshark, wolfSSL, …"

**The new problem is throughput, not quality:**
> "We might publish closer to 50 curl vulnerabilities in 2026."

> "This avalanche is going to make maintainer overload even worse. Some projects will have a hard time to handle this kind of backlog expansion without any added maintainers to help."

**Mechanisms:** platform choice (HackerOne over GitHub) as a triage tool; note that the *incentive removal* is what he credits, and the quality recovery came anyway.

---

## 6. "How pull request limits are cutting down the noise" — The GitHub Blog

- **Date:** 2026-06-18 · **URL:** https://github.blog/open-source/maintainers/how-pull-request-limits-are-cutting-down-the-noise/ · **2026**
- The platform-level primitive that several projects above now rely on.

**The feature, exactly:**
> "A pull request limit sets the maximum number of pull requests a user without write access can have open at once in your repository. Hit the limit, and you must close or merge one before opening another. **Pull requests opened by Copilot or another AI agent will counts toward your limit.** Trusted contributors can be placed on a bypass list, where they are exempted from limits, but don't gain full contributor access. **Draft pull requests will not count towards your limit.**"

> "GitHub already has interaction limits, but those are temporary cooldowns. These new pull request limits are persistent and configurable"

**Behavioral rationale:**
> "When anyone can open a pull request in seconds, a polished change and a rough draft look the same in the queue. But when only a few pull requests can be open at once, a contributor must be selective and prioritize which contributions they want to be reviewed."

**Scale data:**
> "In January 2023, developers merged about 25 million pull requests a month across GitHub. Today that number tops 90 million—a roughly 3.6x increase."

**Maintainer testimony:**
> Nicholas Tindle, AutoGPT: "It's helped us want to review pull requests again. Knowing that someone hasn't just opened 5–10 pull requests that are slop makes it much easier to want to look."

> Mike McQuaid, Homebrew: "We've had problems on Homebrew for a while with enthusiastic users submitting many pull requests that need near identical review. **AI further accelerated it.** This allows us to still have outside contribution and maintainers contribute more while gating users to a level of pull requests we can cope with."

> Vincent Koc, OpenClaw: "At OpenClaw we get a huge volume of pull requests from the community and **had to build our own bots for fighting spam.**"

**Roadmap:**
> "**Archiving pull requests (shipping soon)**: Repository admins will be able to archive pull requests, hiding low-quality or spammy pull requests out of the main pull request view."
> "**Issue limits (in development)**: ...per-repository caps on how many open issues a user without write access can have at once"
> "**Smarter bypass signals (up next)**: ...let contributors clear a limit automatically based on real signals: a previously merged pull request in the repo, account age, or organization membership."
> "**Cross-repository controls (exploring)**: ...catch contributors who spray pull requests across multiple repositories"

**Mechanisms:** per-contributor rate limit (concurrency cap), draft-first exemption, bypass/allowlist, agent PRs explicitly counted, archive, planned issue caps and cross-repo limits.

---

## 7. "Changing How We Develop Ladybird" — Andreas Kling

- **Date:** 2026-06-05 · **URL:** https://ladybird.org/posts/changing-how-we-develop-ladybird/ · **2026**
- The most extreme response in the set.

> "**We will no longer accept public pull requests.** From now on, code changes to the Ladybird codebase will only be introduced by project maintainers."

> "AI tools have changed the economics of this very quickly. We use them ourselves every day, but **a pull request no longer tells us as much as it used to about the person submitting it.** A substantial patch used to imply substantial effort, and that effort was a reasonable proxy for good faith. That assumption no longer holds."

> "As part of this change, we will close all currently open public pull requests... keeping the existing queue open would keep that contribution path open in practice."

> "There will not be a separate process for submitting patches by other means. We do not want to create a shadow contribution system through issues, comments, email, or forks."

**Mechanisms:** close the contribution channel entirely, mass-close existing queue, explicit anti-workaround clause.

---

## 8. Crossplane AI Contribution Policy (CNCF)

- **Date:** live on `main`, surfaced on HN 2026-09-02 · **URL:** https://github.com/crossplane/crossplane/blob/main/AI_POLICY.md · **2026**
- Notable because it inverts the disclosure consensus.

**No disclosure required — deliberately:**
> "The Crossplane team makes use of AI coding tools every day and we expect that almost all contributors will be doing the same. Therefore, **we do not require any disclosure for the usage of AI in any contributions.**"

> "We discourage including attribution for your agent in your commits, e.g., a `Co-authored-by` trailer, as it pollutes contributor statistics."

**Ownership standard:**
> "**Understand every line you are changing:** If you cannot explain the purpose and impact of every change without the assistance of an agent, it's not ready for submission."

> "**Don't blame your agent:** 'My agent did/wrote that' is not a sufficient answer to review comments"

**Template as an agent detector:**
> "**Use the templates:** ...An incoming PR that doesn't even contain the template's checklist is a clear sign your agent opened the PR for you and you didn't take much care during the PR creation process."

**Anti-flood + issue-first:**
> "**Bias towards discussion first:** For anything beyond a clearly scoped fix, we encourage you to open an issue and drive alignment on the direction before implementing"
> "**Keep changes small and focused**"
> "**Avoid flooding us with changes:** If you already have pull requests open that have not been merged, avoid opening more pull requests that continue to grow the review backlog."

**Agent-to-agent review, explicitly banned:**
> "Don't point an agent at someone else's pull request and just post what it produces. **We already have automated AI reviewing tools set up and don't need your agents fabricating additional engagement.**"

**Enforcement without debate:**
> "The maintainer team may close pull requests and issues that do not meet the spirit of the guidelines in this policy. **We may even do so without first writing a detailed explanation or providing a technical critique. We will most likely not debate whether a contribution violated this policy.**"

**Mechanisms:** no-disclosure (inverse), anti-trailer, soft rate limit, issue-first, size cap, agent-to-agent review ban, close-without-explanation, escalating blocks.

---

## 9. "AI usage policy for Ghostty" — Mitchell Hashimoto

- **Date:** PR #10412, comments dated 2026-01-22 · **URL:** https://github.com/ghostty-org/ghostty/pull/10412 (policy file: https://github.com/ghostty-org/ghostty/blob/main/AI_POLICY.md) · **2026**

**The backpressure framing:**
> "The rise of agentic programming has **eliminated the natural effort-based backpressure** that previously limited low-effort contributions. It is now too easy to create large amounts of bad content with minimal effort."

> "Open source projects have always had poor quality issues, PRs, etc. That comes with the territory. Unfortunately, the ease and carelessness by which these are now manifested has **increased the 'bad' count by 10x if not more.**"

**Policy:**
> "**Going forward, AI generated contributions will only be allowed for accepted issues and maintainers.** Drive-by pull requests with AI generated content will be immediately closed."

> "**Going further, users who contribute bad AI generated content will be immediately banned from all future contributions.** This is a zero-tolerance policy."

> "This is not an anti-AI stance. This is an anti-idiot stance. Ghostty is written with plenty of AI assistance and many of our maintainers use AI daily."

**From `AI_POLICY.md`** (via subagent; file view shows no date — **date UNVERIFIED**):
> "**All AI usage in any form must be disclosed.** You must state the tool you used (e.g. Claude Code, Cursor, Amp) along with the extent that the work was AI-assisted."
> "**Bad AI drivers will be denounced** People who produce bad contributions that are clearly AI (slop) will be added to our public denouncement list. This list will block all future contributions. Additionally, the list is public and may be used by other projects to be aware of bad actors."
> "These rules apply only to outside contributions to Ghostty. Maintainers are exempt from these rules"

**On disclosure granularity — a direct answer to the "which model" question:**
> mitchellh, 2026-01-22: "No, it's more important to me to know that AI was used. I don't particularly care what model. **In the future, once there is more broad support, I plan on requiring full transcripts for any AI assistance that we can map 1:1 to the diff.** But there isn't broad enough tool support for that yet."

**Mechanisms:** required linked/accepted issue, tool-level disclosure, immediate close for drive-by, zero-tolerance ban, shared public blocklist, maintainer exemption, future transcript requirement.

---

## 10. "Ten Months with Copilot Coding Agent in dotnet/runtime" — Stephen Toub, Microsoft

- **Date:** 2026-03-23 · **URL:** https://devblogs.microsoft.com/dotnet/ten-months-with-cca-in-dotnet-runtime/ · **2026**
- The only large-N quantitative account here, and from the *receiving* side of agent PRs at scale.

**The dataset:** 878 CCA PRs in dotnet/runtime, May 19 2025 – March 22 2026: 535 merged, 253 closed, 90 open.

| Category | PRs | Merged | Success rate |
|---|---|---|---|
| Human (Microsoft) | 3,082 (50%) | 2,556 | 87.1% |
| Human (Community) | 1,411 (23%) | 1,029 | 79.7% |
| CCA | 878 (14%) | 535 | 67.9% |

**The review-bottleneck problem, stated numerically:**
> "I opened nine PRs, some quite complicated, in the span of a few hours. Those PRs need review. Detailed, careful review, the kind that takes at least 30 to 60 minutes per PR for changes of this complexity. That means I quite quickly created 5 to 9 hours of review work... **The bottleneck has moved.** AI changes the economics of code production. One person with good judgment and a phone can generate PRs faster than a team can review them. This creates asymmetric pressure: the person triggering CCA work feels productive ('nine PRs!!'), while reviewers feel overwhelmed ('nine PRs??')."

**Auto-close after N days — a concrete, quantified mechanism:**
> "The largest category, auto-closed drafts (44%), represents PRs where CCA produced work but **no one reviewed it within the repository's 30-day inactivity window.** These are backlog management failures, not CCA failures: the work was requested, CCA delivered something, and it expired unreviewed."

(112 of 253 closed PRs = 44% were auto-closed drafts.)

**Instruction files as the highest-leverage fix:**
> "**Our success rate jumped from 38% before our instruction file to 69% after.** Better preparation was the primary driver. Every hour spent documenting 'how we work' in `.github/copilot-instructions.md` and teaching new skills pays dividends across every future CCA PR."

**Firewall / sandbox configuration:**
> "We also weren't aware of the firewall rules that CCA operates under (by default, the agent runs in a sandboxed environment that blocks access to most external resources)... We configured the firewall rules to allow access to the package feeds our build needs."

**Hard evidence gate for a claim class:**
> "The agent makes claims like 'this improves performance by 2x' without validation... We've added explicit instructions requiring benchmarks and results, and have **a strict policy: no performance PR merges without empirical evidence, regardless of who contributes the PR.**"

**Agent-assisted review (used, but not autonomous):**
> "We've also built a custom code-review skill that we can invoke on demand to get a deeper, repo-aware analysis tailored to dotnet/runtime's conventions."
> "We now have eight skills in dotnet/runtime, covering performance benchmarking, JIT regression testing, CI failure analysis, API proposal workflows, issue triage, and more."

**Reviewer concentration risk:**
> "284 distinct users commented on the 878 CCA PRs, but the top 10 reviewers account for 61% of all comments... This concentration could be a sustainability concern: if key reviewers burn out, CCA throughput would drop significantly."

**Intervention rate:** "CCA's 52.3% intervention rate is roughly 5x the human baseline"; merged CCA PRs average 16.5 comments vs 12.4 for human PRs.

**Mechanisms:** 30-day auto-close on inactivity, repo instruction file, agent skills for review/triage, network firewall allowlist, evidence-required merge gate, draft state.

---

## 11. "Contributor Poker and Zig's AI Ban" — Loris Cro (ZSF VP of Community)

- **Date:** 2026-04-30 (Simon Willison's linked writeup same date) · **URLs:** https://kristoff.it/blog/contributor-poker-and-ai/ and https://simonwillison.net/2026/Apr/30/zig-anti-ai/ · **2026**

**Zig's Code of Conduct policy text** (via Simon Willison, quoting ziglang.org/code-of-conduct/):
> "No LLMs for issues. No LLMs for pull requests. No LLMs for comments on the bug tracker, including translation. English is encouraged, but not required."

**The rationale — why a blanket ban rather than a quality bar:**
> "In successful open source projects you eventually reach a point where you start getting more PRs than what you're capable of processing. Given what I mentioned so far, it would make sense to stop accepting imperfect PRs in order to maximize ROI from your work, but that's not what we do in the Zig project. Instead, **we try our best to help new contributors to get their work in**"

> "The reason I call it 'contributor poker' is because, just like people say about the actual card game, 'you play the person, not the cards'. **In contributor poker, you bet on the contributor, not on the contents of their first PR.**"

**What they actually received:**
> "from an increase in background noise due to worthless drive-by PRs full of hallucinations (that wouldn't even compile, let alone pass CI), to **insane 10 thousand line long first time PRs.** In-between we also received plenty of PRs that looked fine on the surface, some of which explicitly claimed to not have made use of LLMs, but where follow-up discussions immediately made it clear that the author was sneakily consulting an LLM"

**The detection objection, answered:**
> "**from the perspective of contributor poker it's simply irrational for us to bet on LLM users while there's a huge pool of other contributors that don't present this risk factor.** The people who remarked on how it's impossible to know if a contribution comes from an LLM or not have completely missed the point of this policy"

**Downstream consequence** (Simon Willison, quoting @bunjavascript): Bun's Zig fork achieved a 4x compile speedup but "We do not currently plan to upstream this, as Zig has a strict ban on LLM-authored contributions."

**Mechanisms:** blanket LLM ban across PRs/issues/comments; no size cap needed because the channel is closed; explicit rejection of detection-based enforcement.

---

## 12. "Open source maintainership in the age of AI" — Kubernetes

- **Date:** 2026-06-26 (page footer: last modified June 23, 2026) · **URL:** https://kubernetes.io/blog/2026/06/26/open-source-maintainership-in-the-age-of-ai/ · **2026**
- Quotes via the Google-search pass (subagent-opened).

> "Contributors must disclose when AI tools have been used to assist with a pull request. A simple statement in the PR description such as 'This PR was written in part with the assistance of generative AI' is sufficient."

> "The policy explicitly prohibits: Listing AI as a co-author on commits; Using AI co-signing on commits; Adding trailers like 'assisted-by' or 'co-developed' that attribute work to AI"

**A clever agent-identity detector:**
> "**AI agents are not able to solve these contributor license agreements so one enforcement the project made is to enable the CLA check for co-authors.** This provides a flag to reviewers that the PR is not ready to merge."

> "In mid 2026, the Kubernetes community has rolled out CodeRabbit to a few projects."
> "Agent-sandbox has added a label on PRs to reflect that there is still a need to resolve some of the comments from AI tools."

**Enforced contributor-guide text** (https://www.kubernetes.dev/docs/guide/pull-requests/#ai-guidance — no date on section, **date UNVERIFIED**):
> "**Large AI generated PRs and AI generated commit messages are not allowed.**"
> "Reviewers may ask questions about your AI-assisted code, and if you cannot explain why a change was made, **the PR will be closed**."
> "When responding to review comments, you must do so without relying on AI tools... **If you do not engage directly with reviewers, the PR will be closed.**"

**Mechanisms:** disclosure sentence, trailer prohibition, CLA-check as bot detector, size cap, auto-close on non-explanation, AI review tooling (CodeRabbit), status labels.

---

## 13. OpenSSL `CONTRIBUTING.md`

- **Date:** live on `master`; text references "CLAs signed after June 2026" so it is 2026-current. **Exact publication date UNVERIFIED** (no date rendered on file view). · **URL:** https://github.com/openssl/openssl/blob/master/CONTRIBUTING.md · **2026**
- Quotes via the Google-search pass. The clearest explicit per-contributor rate limit in the set.

> "Do not submit changes in bulk. **Review, not authorship, is the scarce resource in this project:** every pull request consumes the attention of at least two committers"

> "**Keep to no more than three or four open pull requests at a time**, and let those be reviewed to completion before opening more... Pull requests opened well in excess of this may be **closed without review**, with a request to resubmit at a sustainable rate."

> "This applies regardless of how good the individual changes are, and it is not satisfied by spacing submissions out over a few hours or days."

**Structured agent identity requirement:**
> "if a non-trivial portion of a contribution was created using an AI tool, you must declare which agent and model were used. This is done by adding `Assisted-by: {agent}:{model}` below the commit message" — example given: `Assisted-by: Claude:claude-sonnet-4-6`

> "You will need to have signed a v1.1 or later CLA in order to include AI-generated content in your contribution. CLAs signed after June 2026 will have the requisite clauses."

**Label-driven merge pipeline:**
> "In the first phase the label 'approval: review pending' is added. Once you receive 2 or more approvals from Committers the label is changed to 'approval: done' and 24 hours after this the label changes to 'approval: ready to merge'."

**Mechanisms:** hard concurrency cap (3–4), close-without-review, machine-readable agent+model trailer, CLA version gate, three-stage approval labels with a 24h cooling period.

---

## 14. "AI-SLOP: Develop Best Current Practises for Open Source Maintainers" — OpenSSF

- **Date:** 2026-03-11 (HN submission date; issue in `ossf/wg-vulnerability-disclosures`) · **URL:** https://github.com/ossf/wg-vulnerability-disclosures/issues/178 · **2026**
- Ecosystem-level coordination effort; also the best single hub of further primary sources.

> "Projects are receiving high volumes of low-quality vulnerability reports that appear to be generated by AI with minimal or no human review, creating a **'DDoS-like situation'** for maintainers."

> "Halfway through 2025, curl reported that only ~5% of bug bounty submissions were genuine vulnerabilities, with around 20% appearing to be AI-generated slop."

> "**Detection Difficulty**: There is no reliable technical indicator for AI-generated content: detection is often based on 'vibes' and maintainer intuition."

> "Node.js mentioned receiving over 30 AI-slop reports *during major holidays for the maintainers* as a key reason for raising their H1 signal requirements."

**Stated goal — explicitly not a ban:**
> "**Balance Good vs. Bad AI Use**: Acknowledge that AI tools *can* find valid vulnerabilities. *The goal is to reduce slop, not ban AI entirely.*"

**Their tabulation of what projects are doing:** ending bug bounties (curl#20312); requiring higher HackerOne signal (Node.js); AI contribution policies (LLVM, Selenium#17043, Django); requiring PoC videos; banning repeat offenders; cataloging slop examples.

**Distilled policy elements:**
> "**Human-in-the-loop accountability** ... **Disclosure requirements** ... **No autonomous agents**: AI tools should not autonomously open PRs or push commits ... **Quality bar unchanged** ... **Contributor remains responsible** ... **'Good first issues' protection**"

**Platform-level asks:**
> "Implement systems to prevent automated or abusive reporting (CAPTCHAs, rate limits, etc.)"; "Remove credit for abusive reporters"

**Mechanisms:** cross-project BCP, policy templates, blocklists, platform rate-limit advocacy.

---

## 15. "New HackerOne Signal Requirement for Vulnerability Reports" — Node.js Project

- **Date:** update dated **2026-02-19** · **URL:** https://nodejs.org/en/blog/announcements/hackerone-signal-requirement · **2026**

> "We have updated our HackerOne program to require a **Signal of 1.0 or higher** to submit vulnerability reports to the Node.js project."

> "The Node.js security team has experienced a significant increase in low-quality reports... over the holidays it crossed the threshold that we can actually handle. **Between December 15th and January 15th, we received over 30 reports.**"

> "**UPDATE 2026-02-19**: New researchers without signal can no longer submit reports through HackerOne. If you are a new researcher and would like to report a potential vulnerability, please reach out to the Node.js security release stewards through the OpenJS Foundation Slack"

**Mechanisms:** reputation-score gate on submission, tightened to a full block for zero-signal researchers, with a human out-of-band channel preserved.

---

## 16. "Librsvg got its first AI slop pull request" — Federico Mena Quintero

- **Date:** 2026-02-21 · **URL:** https://viruta.org/librsvg-ai-slop.html · **2026**
- Small but useful: an agent opening PRs at a *mirror* that explicitly forbids them.

> "You all know that librsvg is developed in gitlab.gnome.org, not in GitHub. The README prominently says, '**PLEASE DO NOT SEND PULL REQUESTS TO GITHUB**'."

> "So, of course, today librsvg got its first AI slop pull request and later a second one, both in GitHub. Fortunately (?) they were closed by the same account that opened them, four minutes and one minute after opening them, respectively."

**What was in them:**
> "There is compiled Python code (nope, that's how you get another xz attack)."
> "Suggestions to call standard library functions that do not even exist."
> "Adding a cache for something that does not need caching (without an eviction policy (so it is a memory leak))."
> "Adding two 'missing' filters from the SVG spec (they are already implemented), and the implementation is `todo!()`."

> "It's all like that. I stopped looking, and **reported both PRs for spam.**"

**Mechanisms:** report-as-spam; demonstrates that README-level prohibitions do not deter agents.

---

## 17. scikit-learn issue #31679 — *2025 item, included as origin point*

- **Date:** references "as of June 30th **2025**" · **URL:** https://github.com/scikit-learn/scikit-learn/issues/31679 · **NOT 2026**
- Title: "AI tools like Copilot Coding Agent don't know about / don't care about our Automated Contributions Policy". Quotes via the Google-search pass.

> "I have added repeated cases to @adrinjalali's [agents-to-block] folder. **The pattern of spammers is to open a PR with an unqualified guess of what the project needs or how an issue can be solved, and then not follow up after maintainers reviewed, close and try again.**"

> "**Many authors of automated PRs did not invest a lot of time into it and don't have enough skin in the game to care.**"

> "The issue to solve is to find out how to protect against the effects of AI spam, mark AI based PRs and issues (so reviewers know what they deal with), most efficiently block spam-authors, and discourage LLM agents to automatically open PRs in scikit-learn."

**Mechanisms:** shared cross-project blocklist repo, labeling AI PRs for reviewer awareness.

---

## Cross-cutting analysis

### The mechanism matrix

| Mechanism | Who uses it |
|---|---|
| **Per-contributor rate limit** | OpenSSL (3–4 open), llama.cpp (1 for new contributors), GitHub platform feature, Crossplane (soft) |
| **Trust tier by merged-PR count** | Godot (≤3 merged = "new contributor"), GitHub ("smarter bypass signals" roadmap) |
| **Required linked/accepted issue** | Ghostty ("only allowed for accepted issues"), llama.cpp ("Features must begin with an issue, not a PR"), Crossplane ("bias towards discussion first") |
| **Auto-close after N days** | dotnet/runtime (30-day inactivity window; 44% of closed CCA PRs) |
| **Auto-close on non-explanation** | Kubernetes ("if you cannot explain why a change was made, the PR will be closed"), LLVM (canned rejection macro) |
| **Diff size cap** | Kubernetes ("Large AI generated PRs... not allowed"), Godot (single self-contained change; 15-line triviality line), Crossplane ("keep changes small and focused"), LLVM ("reduce its size or complexity") |
| **Agent identity requirement** | OpenSSL (`Assisted-by: {agent}:{model}`), Ghostty (tool name; transcripts planned), LLVM (`Assisted-by:`), KubeVirt (trailer), Godot (disclose in PR discussion) |
| **Agent identity *prohibition*** | Kubernetes (no `assisted-by`/`co-developed` trailers), Crossplane (discourages `Co-authored-by`) |
| **Autonomous agent ban** | LLVM (bans `@claude`-style agents), Godot (auto-ban), OSSF BCP ("No autonomous agents"), Godot docs ("Do not allow an AI agent to submit PRs on your behalf") |
| **Labels for triage** | LLVM (`extractive`), OpenSSL (`approval: review pending` → `done` → `ready to merge`), llama.cpp (`merge ready`), Kubernetes/agent-sandbox (unresolved-AI-comments label) |
| **Agent-to-agent review** | Crossplane **bans** contributor-side agent review while running its own; Kubernetes runs CodeRabbit; dotnet/runtime runs Copilot code review + a custom code-review skill; LLVM allows only opt-in human-in-the-loop review tools |
| **CODEOWNERS** | llama.cpp ("Consider adding yourself to CODEOWNERS to indicate your availability for fixing related issues and reviewing related PRs") |
| **Blocklists / denouncement** | Ghostty (public denouncement list, explicitly shareable), scikit-learn (`agents-to-block`), curl ("ban and publicly ridicule") |
| **Reputation gate** | Node.js (HackerOne Signal ≥ 1.0, then full block for zero-signal) |
| **Channel closure** | Ladybird (no public PRs at all), curl (bounty terminated, then restored) |
| **Repo instruction files for agents** | dotnet/runtime (`copilot-instructions.md`, 38% → 69% success rate), Superpowers (`CLAUDE.md` addressed to agents) |

### Four genuine disagreements among practitioners

1. **Disclosure vs. no disclosure.** Godot, Ghostty, LLVM, Kubernetes and OpenSSL all require it. **Crossplane explicitly does not** — "we do not require any disclosure for the usage of AI in any contributions" — on the grounds that everyone uses AI so the signal is worthless.
2. **The `Assisted-by:` trailer is directly contested.** OpenSSL **mandates** `Assisted-by: {agent}:{model}`; LLVM **recommends** it; KubeVirt **accepts** it; Kubernetes **forbids** it; Crossplane **discourages** attribution trailers as statistics pollution.
3. **Is the slop permanent?** Godot (June 2026), Ladybird (June 2026) and Zig treat it as a structural condition requiring channel restriction. **curl's April 2026 follow-up says the opposite:** "The slop situation is not a problem anymore," with confirmed-vulnerability rate back to 15–16% pre-AI levels at double the volume. Any argument resting on "curl proves AI reports are worthless" is contradicted by curl's own later post.
4. **Ban the tool vs. cap the rate.** Zig/QEMU/Godot judge AI-ness. OpenSSL, llama.cpp, GitHub and Crossplane deliberately **do not** — they cap concurrency per contributor regardless of provenance. GitHub's implementation is the tell: it counts agent PRs toward the limit but exempts drafts, i.e. it prices review attention rather than policing authorship.

### The convergent finding

Three independent sources arrive at the same economic statement: review, not authorship, is the scarce resource.

- LLVM: "a contribution should be worth more to the project than the time it takes to review it"
- OpenSSL: "Review, not authorship, is the scarce resource in this project"
- Microsoft/dotnet: "The bottleneck has moved... One person with good judgment and a phone can generate PRs faster than a team can review them."
- Ghostty names the cause: agentic programming "eliminated the natural effort-based backpressure."

And a second, subtler convergence — **the mentorship loss**, which is why several projects reject even *high-quality* AI PRs. Godot: "If your feedback on PRs is just being absorbed by a machine and not going towards mentoring a potential future maintainer, it becomes much harder to justify spending your free time on PR review." Zig: "you bet on the contributor, not on the contents of their first PR." LLVM protects `good first issue` for exactly this reason.

---

## UNVERIFIED / not opened

**Date UNVERIFIED (page opened, but no publication date rendered):**
- Ghostty `AI_POLICY.md` file view (the PR #10412 comments are firmly dated 2026-01-22)
- Godot `contributing.godotengine.org` pull-request guidelines (content reflects the dated June 2026 blog post)
- Kubernetes `kubernetes.dev` AI Guidance section
- OpenSSL, llama.cpp, KubeVirt, Apple `containerization` CONTRIBUTING/policy files
- QEMU `code-provenance.html` (living doc)
- LLVM `AIToolPolicy.html` (undated page; adoption reported 2026-01-20)

**Not opened at all (UNVERIFIED):**
- `groups.google.com/a/kubernetes.io/g/dev/c/7Y9016gdFZw` — "[ANNOUNCEMENT] Updates to the AI usage policy" (would be the best-dated primary source for the Kubernetes policy)
- `github.com/melissawm/open-source-ai-contribution-policies` — community index of policies
- `github.com/scientific-python/cookie/pull/821` — the AI_POLICY.md template PR
- EuroPython 2026 talk "Defending Open Source from 'AI' Slop: A Maintainer's..."
- FOSDEM 2026 "OSS in Spite of AI" (fosdem.org/2026/schedule/event/B7YKQ7-oss-in-spite-of-ai/)
- `SeleniumHQ/selenium#17043`, Django commit `0f60102`, `apache/logging-log4j2#4052` — all cited by the OSSF issue
- `curl/curl#20312` (bounty discontinuation PR)
- Bluesky post by Rémi Verschelde (akien) "Godot is drowning in AI slop pull requests", 2026-02-18

**Deliberately excluded as news rewrites** (not primary): The Register, Ars Technica, PC Gamer, Kotaku, Game Developer, BleepingComputer, Hackaday, Tom's Hardware, Phoronix, The New Stack, InfoQ, itsfoss.

**Secondary but useful as a map:** RedMonk / Kate Holterhoff, "The Generative AI Policy Landscape in Open Source," 2026-02-26 with edits through 2026-06-08 — a census of "**86 open source organizations**" and their policies.

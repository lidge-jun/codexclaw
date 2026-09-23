# Architect consultation record

- Handle: 01a0cc8c-a9d6-78a1-b0b9-3af8e550196a (V1 `spawn_agent`, message header `CXC-ROLE: architect`, skills cxc-dev and cxc-dev-architecture attached, read-only packet).
- Proposal: returned 2026-09-23, decisions D1-D7, field-chain table and owner outline. Summary below; the full text stayed in the task transcript.

| ID | Proposal | Main disposition |
|---|---|---|
| D1 | Two references under dev-devops (native-desktop-acceptance.md, macos-system-approvals.md); no new skill, to avoid skills badge, inventory skills[], agents/openai.yaml and docs-site churn and to honor the issue's reuse request | Accepted |
| D2 | Routing row in dev/SKILL.md, two rows in dev-devops Modular References, two ownership rows in skill-ownership.md, one-line stubs in cross-platform-release.md, qa, dev-testing, mobile-native.md, dev-debugging swift runtime; trigger keywords in dev-devops description and agents/openai.yaml | Accepted; description length checked in wp3 P before editing |
| D3 | Surface value `desktop` (`native` collides with native-execution and mobile-native vocabulary; `gui` is a QA verdict surface, narrower than packaging and distribution) | Accepted |
| D4 | computeQaRequired and the inlined final-gate-guard copy include `desktop`; no schemaVersion bump; CHANGELOG names the 0.2.37 reader requirement | Accepted |
| D5 | Render observations and receipt schema unchanged; skill asks for artifact-identity.json in QA artifactRefs; follow-up issue | Accepted as residual; follow-up issue filed in wp4 |
| D6 | Release follows 7ad32cf5's file set; check-versions and inventory --check enforce | Accepted; stamp hand-set in the release commit |
| D7 | wp2 surface, wp3 skills, wp4 release | Accepted |

Amendments by main: no unverified macOS 26 menu-bar claims (001 "Not verified"); `sfltool dumpbtm` moves to authorization-required because it can need administrator rights.

## Reflection

Sent revision 00f3cf0a to the same handle. Verdict ALIGNED, with every decision mapped to plan lines. Seven gaps, all folded into the next revision:

1. durable-goalplan.md:60-62 also describes surface: added to 010.
2. INDEX anchor named as the skill inventory row; runtimes/swift.md gets one scope line: added to 020 and 000.
3. steering.ts import of CriterionSurface: stated in 010.
4. CLI test needs its own fixture; v2 message and guard/computeQaRequired table tests: added to 010.
5. mobile-native stub phrased as a need: 020.
6. Three claims not backed by 001 (status item geometry, WidgetKit build details, hidden status items): reworded or cited to #232 in 020.
7. docs-site skills guide line: added to 030.

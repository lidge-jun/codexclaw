# r1 moved history

## Source: plugins/codexclaw/skills/dev-architecture/SKILL.md

Source: sol research (wednesday-solutions/ai-agent-skills AST dependency graph).

## Source: plugins/codexclaw/skills/dev-architecture/SKILL.md

Source: sol research (HoangNguyen0403/agent-skills-standard compliance auditing).

## Source: plugins/codexclaw/skills/dev-data/SKILL.md

Source: sol research (dev-skill reinforcement audit, Euler findings).

## Source: plugins/codexclaw/skills/dev-security/SKILL.md

AI-recommended package names are a supply-chain attack surface: 2025 research found
~20% of LLM-recommended packages in study settings did not exist, and hallucinated
names recur — attackers register them (slopsquatting). Before adding ANY dependency
suggested by an AI: (1) package exists on the official registry with real release
history (not days old); (2) maintainer/org and linked source repo are plausible;
(3) no surprising install scripts; lockfile diff reviewed; (4) provenance/trusted
publishing attestation when the registry supports it (npm/PyPI).


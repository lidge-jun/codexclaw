# Agent Skill Integrity (SEC-SKILL-INTEGRITY-01, DEFAULT)

Source: sol research (OWASP Agentic Skills Top 10, tech-leads-club/agent-skills, Security-Phoenix-demo).

## OWASP AST01-10 Coverage

| AST ID | Threat | Codexclaw Mitigation |
|--------|--------|---------------------|
| AST01 | Malicious skill content | Review skill SKILL.md before installation; check for embedded commands, data exfiltration URLs, or instruction overrides |
| AST02 | Compromised supply chain | Pin skill versions to commit SHA; verify publisher identity; content-hash skill files at installation |
| AST03 | Excessive privilege | Skills should declare required capabilities (read/write paths, network, commands); deny undeclared access |
| AST04 | Unsafe metadata parsing | Validate YAML frontmatter with strict schema; reject unknown fields; sanitize skill names for path traversal |
| AST05 | External instruction injection | Skills must not fetch remote instructions at runtime; all behavior defined at installation time |
| AST06 | Weak isolation | Leaf-topology enforcement (LEAF-TOPOLOGY-01); subagents cannot spawn without explicit grant |
| AST07 | Update drift | Track installed skill versions; alert on upstream changes; require explicit update approval |
| AST08 | Insufficient scanning | Scan skill text for encoded payloads, obfuscated instructions, URL extraction, and behavioral anomalies |
| AST09 | Governance gaps | Maintain skill inventory with owner, install date, last review, and risk classification |
| AST10 | Cross-platform inconsistency | Skill behavior may differ across Codex/Claude/Cursor; test on target platform before trust |

## Skill Installation Checklist

- [ ] Read the full SKILL.md before installing
- [ ] Verify publisher identity (GitHub profile, org membership)
- [ ] Check for embedded shell commands or exec calls
- [ ] Check for URLs that could exfiltrate data
- [ ] Check for instruction-override patterns ("ignore previous instructions")
- [ ] Pin to a specific commit SHA, not a branch
- [ ] Record the content hash at installation time

## Skill Update Review

- Diff the new version against the installed version
- Focus on: new commands, new URLs, changed behavioral instructions, removed safety constraints
- Re-run the installation checklist on changed content

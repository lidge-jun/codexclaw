# 021 — Research: 외부 skill 생태계 조사 (gpt-5.5 explorer, web-verified 2026-07-05)

---

## 소스별 요약

| Source | URL | 규모 | 포맷 | License | 비고 |
|--------|-----|------|------|---------|------|
| OpenClaw / ClawHub | github.com/openclaw/clawhub, clawhub.ai | repo 내 13 | SKILL.md + metadata.openclaw | MIT | 레지스트리/퍼블리싱 시스템. 포맷 규칙 소스로 가치 |
| OpenClaw ecosystem | Dev-Dennis-040/openclaw-agency-skills 외 | 81+ | SKILL.md 호환 | 혼재/무라이선스 다수 | lsp-index-engineer, testing-evidence-collector 등. 라이선스 있는 것만 vendor |
| Hermes (NousResearch/hermes-agent) | github.com/NousResearch/hermes-agent | 175 | SKILL.md + hermes metadata/toolsets | MIT | gitnexus-explorer, oss-forensics, dspy, fastmcp, qdrant 등 |
| Anthropic 공식 | github.com/anthropics/skills | 18 | canonical SKILL.md | Apache-2.0 다수, doc skills는 source-available | mcp-builder, webapp-testing. docx/pdf류는 vendoring 금지(source-available) |
| OpenAI skills (deprecated) | github.com/openai/skills | 44 | Codex SKILL.md | per-skill LICENSE | sentry, linear, jupyter-notebook. 신규는 openai/plugins 우선 |
| OpenAI plugins | github.com/openai/plugins | 605 SKILL.md | Codex plugin+skills | per-plugin | 최대 Codex-native 풀. react/shadcn/supabase/stripe/d3 등 |
| OK Skills | github.com/mxyhi/ok-skills | 40 | portable SKILL.md | Apache-2.0 | browser-trace, codebase-design, domain-modeling |
| Superpowers | github.com/obra/superpowers | 14 | SKILL.md | MIT | using-git-worktrees 등 방법론. cxc-dev와 중복 주의 |
| claude-skills (community) | github.com/alirezarezvani/claude-skills | 354+ | SKILL.md+scripts | MIT | 품질 편차 큼, 마이닝용 |
| 인덱스류 | VoltAgent/awesome-agent-skills(1497+), SkillNote, AGNXI | - | discovery | MIT | 직접 소스 아닌 탐색 인프라 |

## Import 후보 shortlist (18)

Codex-native (openai/plugins, openai/skills): react-best-practices,
shadcn-best-practices, supabase-best-practices, stripe-best-practices,
d3-data-visualization, sentry, notion-spec-to-implementation, linear.

Hermes (MIT): gitnexus-explorer, oss-forensics, dspy, fastmcp.

OK Skills (Apache-2.0): browser-trace, codebase-design, domain-modeling.

Superpowers (MIT): using-git-worktrees.

기타: skillnote collection 패턴(레지스트리 관리), openclaw-skill-scanner(무라이선스 →
개념만 차용, 원문 vendor 금지).

## 제약

- 무라이선스 repo 원문 vendor 금지 (영감/개념만).
- Anthropic doc skills는 source-available → 기존 풀에 문서 스킬 이미 있으므로 skip.
- openai/plugins 스킬은 connector/plugin.json 가정 → import 시 wrapper 메타데이터 필요.
- Hermes metadata.hermes/toolsets 필드 → codexclaw registry 스키마로 매핑 필요.
- ClawHub metadata.openclaw.requires/install은 codexclaw 의존성 모델로 매핑해 보존.

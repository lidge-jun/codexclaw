# Threat Model Procedure

Required order before implementation:
1. Assets: accounts, sessions, payment state, admin actions, uploaded files, secrets, PII, audit logs, build artifacts.
2. Entrypoints: forms, URLs, headers, cookies, APIs, webhooks, uploads, queues, CLIs, prompts, tool calls, CI jobs.
3. Trust boundaries: browser ↔ API, public API ↔ internal service, app ↔ database, agent prompt ↔ tool execution, CI runner ↔ production artifact.
4. Attacker capability: anonymous user, authenticated user, tenant peer, malicious insider, compromised browser, compromised CI, poisoned dependency, hostile retrieved text/prompt.
5. Assumptions: runtime surface vs CI/dev tooling, identity source, tenant model, data sensitivity, deployment environment, and what evidence supports each assumption.
6. Controls: validation, authn/authz, rate limits, isolation, logging/redaction, secret handling, scans, and tests.

If an assumption materially changes severity or priority, pause and ask 1-3 targeted questions before claiming the threat model is good enough. If the change touches auth, payment, file upload, logging, or PII, write the must-pass checks after the model and before coding.
This skill owns security policy.
Domain skills own architecture and implementation details.

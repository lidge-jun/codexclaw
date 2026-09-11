# PR #91 upgrade compatibility follow-up

The maintainer reproduced an existing installation with no native executor role. The original resolver emitted executor unconditionally, so the host rejected the spawn before the plugin could explain it. Previous live proof covered only an already-registered installation.

The production resolver now inspects the host Codex home's executor role file and selects worker when registration is absent or inaccessible. The pure builder defaults to worker unless registration is explicitly known. Both names retain executor role routing and exit verification. Registering a file still requires a fresh Codex session; disk presence is not proof that an existing session loaded it.

Registration gains content provenance to update unchanged managed prompts without replacing user edits. Differing unmarked files remain conflicts. Installation docs make registration optional, put it after hook approval, and provide a pasteable Codex-chat request for marketplace users plus the installed CLI command.

Latest upstream dev was integrated by a normal merge to preserve published history; README counts and scoped CLI reset/global behavior are retained. Main owns implementation. The bounded executor delegation stalled without edits and was shut down; main reclaimed registration and its tests. Independent reviewer owns final audit. Acceptance: absent/present role dispatch, idempotent registration, managed prompt update, edited/unmanaged conflict preservation, concurrent registration, scoped CLI and full suite.

Verification: absent-role test failed with the old unconditional mapping and passed after fallback (artifacts `/home/jun/tmp/pr91-followup/absent-role-{red,green}.log`). Focused suites 46/46 passed. Combined full suite 2711 total / 2640 pass / 71 conditional skips / 0 failures. Changed-core strict TypeScript, build and Linux platform smoke passed. README test counts regenerated from measured total. Registration update keeps a hash-addressed previous-content backup and serializes cooperating updaters with a lock; user edits fail closed. No live user role files were changed.

Final independent review: PASS, no blockers. Reviewer verified payload fallback, registration provenance/backup and combined CLI behavior; targeted reviewer tests passed (spawn-wrapper 30, registration 8, attach-hook 88). Scope flag on registration remains ignored and config.toml-only role declarations conservatively retain worker compatibility.

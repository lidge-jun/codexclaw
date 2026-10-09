## 12. Audit

Run the scaffold audit if one is available for the repo (e.g. `bash <SKILL_DIR>/scripts/scaffold-audit.sh [project-path]`) to check structural compliance. Audit checks should reflect the project's own conventions — covering feature-based structure, colocation, public boundary exports (dev-architecture §5), optional source-of-truth docs, `.env` safety, file length, and `AGENTS.md` where those apply.

## Scaffold Contract (SCAFFOLD-CONTRACT-01, DEFAULT)

Source: sol research (microsoft/apm, HoangNguyen0403/agent-skills-standard).

A scaffold operation must be deterministic and verifiable:

1. **Manifest**: before generating files, produce a list of files that will be
   created/modified with their purpose. Show it to the user or record it.
2. **Idempotency**: running the scaffold twice on the same input should not
   create duplicates or corrupt existing files.
3. **Template provenance**: record which template or pattern was used and its
   version/commit so the scaffold can be reproduced.
4. **Dry run**: for C3+ scaffolds, offer a dry-run mode that shows what would
   be created without writing files.

## Post-Scaffold Verification (SCAFFOLD-VERIFY-01, DEFAULT)

Apply the following only to a runnable project scaffold and only for supported commands.
Documentation scaffolds use link/structure/contract checks; module scaffolds use affected
checks. Do not install dependencies, start servers, or run a broad suite merely to validate prose.
For a runnable scaffold, verify usability within the authorized environment:

1. `npm install` / `pip install` / equivalent dependency installation succeeds
2. `npm run build` / `cargo build` / equivalent build succeeds
3. `npm test` / `pytest` / equivalent test suite passes (even if only a smoke test)
4. Linter runs clean (or with only pre-existing warnings)
5. Dev server starts and responds (for web projects)
6. A second scaffold run on the same input does not break the first (idempotency)

Failures in any of these steps mean the scaffold is incomplete. Fix before
claiming done.

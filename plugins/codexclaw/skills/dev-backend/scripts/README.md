# Scripts

Utility scripts for backend development workflows.

## scaffold-audit.sh

Audit existing project structure for compliance with backend/scaffolding conventions owned by `dev-scaffolding`.

```bash
bash scripts/scaffold-audit.sh [project-path]
```

Checks 7 items:
1. Feature-based structure (`src/` with domain folders)
2. Colocation (logic + test + schema together)
3. Public boundary exports (`index.ts`, `__init__.py`, etc.)
4. project planning or history docs
5. `.env` safety (`.env` in `.gitignore`, `.env.example` exists)
6. File length (< 500 lines)
7. `AGENTS.md` exists

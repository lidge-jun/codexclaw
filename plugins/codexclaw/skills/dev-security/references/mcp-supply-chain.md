# MCP & Agentic Skill Supply Chain Security

Last reviewed: 2026-06-16
Applies to: MCP 1.x servers, agentic skill registries, tool-using AI agents
When to read: Adding MCP servers, enabling agent tools, vetting skill packages
Canonical owner: dev-security

MCP servers and agentic skills are executable supply chain — treat them with the same rigor as npm packages, not as configuration.

Cross-ref: `dev-security` §8 (Agent Configuration Security), `references/agentic-ai-security.md` (OWASP ASI01-ASI10)

## OWASP References

**OWASP MCP Top 10 (2025):**

| ID | Risk | Agent Impact |
|----|------|-------------|
| MCP-01 | Tool Poisoning | Malicious MCP tool returns crafted output to hijack agent behavior |
| MCP-02 | Excessive Permissions | MCP server granted broader access than needed |
| MCP-03 | Insecure Authentication | MCP server credentials in plaintext or auto-installed without verification |
| MCP-04 | Tool Injection via Prompt | Untrusted prompt content triggers unintended MCP tool calls |
| MCP-05 | Data Exfiltration via Tools | MCP tool sends sensitive data to external endpoints |

**OWASP Agentic Skills Top 10** — covered in `references/agentic-ai-security.md` (ASI01-ASI10). Key overlaps: ASI02 (Tool Misuse), ASI04 (Data Exfiltration), ASI06 (Tool Poisoning/Supply Chain).

## 1. MCP Server Vetting Checklist

Before enabling any MCP server, complete this checklist:

| Check | How | Block if |
|-------|-----|----------|
| Package source verified | Check npm/PyPI publisher, GitHub repo, commit history | Anonymous publisher, < 6 months old, no repo link |
| Version pinned | `"@modelcontextprotocol/server-x": "1.2.3"` not `"latest"` | Using `latest`, `*`, or `npx -y` auto-install |
| Capabilities scoped | Review `tools` manifest — does it request only needed capabilities? | Requests filesystem, network, or shell beyond stated purpose |
| No hardcoded secrets | Check `mcp.json` for inline API keys or tokens | Any secret value not using `${ENV_VAR}` reference |
| Maintainer active | Last commit < 6 months, issues responded to | Abandoned (> 12 months no activity) |
| Security advisory check | Search npm/GitHub advisories for package name | Known unpatched CVE |

```jsonc
// mcp.json — safe pattern
{
  "servers": {
    "database": {
      "command": "node",
      "args": ["node_modules/@mcp/postgres-server/dist/index.js"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"  // ✅ env ref, not inline
      }
    }
  }
}
```

```jsonc
// mcp.json — BANNED pattern
{
  "servers": {
    "database": {
      "command": "npx",
      "args": ["-y", "@mcp/postgres-server"],  // ❌ auto-install, unpinned
      "env": {
        "DATABASE_URL": "postgres://user:pass@prod:5432/db"  // ❌ hardcoded secret
      }
    }
  }
}
```

## 2. Skill Allowlist & Version Pinning

| Rule | Required Practice |
|------|-------------------|
| Allowlist | Maintain explicit list of approved MCP servers and skill packages per project |
| Version pin | Pin exact versions in `mcp.json` and skill manifests — no `latest`, no `*`, no auto-install |
| Lockfile | Include MCP dependency resolution in project lockfile where tooling supports it |
| Review on update | Treat MCP server version bumps as dependency PRs — review changelog and diff |
| Audit trail | Log which MCP servers/skills are enabled per environment (dev/staging/prod) |

```yaml
# .mcp-allowlist.yaml — project-level allowlist
allowed_servers:
  - name: "@mcp/postgres-server"
    version: "1.2.3"
    approved_by: "@security-team"
    approved_at: "2026-06-01"
    scope: "database read/write"
  - name: "@mcp/github-server"
    version: "2.0.1"
    approved_by: "@security-team"
    approved_at: "2026-05-15"
    scope: "issue read, PR read/write"

blocked_servers:
  - name: "@mcp/shell-executor"
    reason: "Unrestricted shell access — use scoped alternatives"
```

## 3. Sandbox Isolation

Reduce blast radius of any single compromised MCP server:

| Control | Implementation |
|---------|---------------|
| Filesystem | Mount only required directories read-only; write access only to designated output paths |
| Network | Egress filtering — allow only required API endpoints; block arbitrary outbound connections |
| Process | Run MCP servers as unprivileged user/container with no host PID/network namespace access |
| Credentials | Per-server credential scope — each server gets only the secrets it needs, not shared env |
| Timeout | Kill MCP server processes that exceed response time limits (default: 30s per tool call) |
| Resource | CPU/memory limits per MCP server process to prevent resource exhaustion |

```jsonc
// Container isolation example
{
  "servers": {
    "database": {
      "command": "docker",
      "args": [
        "run", "--rm",
        "--read-only",
        "--network=mcp-internal",      // isolated network
        "--memory=256m", "--cpus=0.5",  // resource limits
        "-e", "DATABASE_URL=${DATABASE_URL}",
        "mcp-postgres:1.2.3"           // pinned image
      ]
    }
  }
}
```

## 4. Audit Logging

Log every MCP tool invocation for forensic reconstruction:

| Field | Required | Example |
|-------|----------|---------|
| Timestamp | Yes | `2026-06-16T14:30:00Z` |
| Server name | Yes | `@mcp/postgres-server` |
| Tool name | Yes | `query` |
| Input (redacted) | Yes | `SELECT * FROM users WHERE id = ?` (params redacted) |
| Output (truncated) | Yes | First 500 chars of response |
| Duration | Yes | `120ms` |
| Caller context | Yes | Session ID, agent ID, task ID |
| Error | If applicable | Error message and code |

Rules:
- Redact secrets and PII from logged inputs/outputs.
- Retain logs for minimum 90 days.
- Alert on: tool call failures > 3× baseline rate, calls to blocked tools, calls outside business hours from automated agents.
- Include MCP audit logs in incident response runbooks.

## 5. Anti-Patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| `npx -y` for MCP servers | Unpinned, auto-installed, unvetted code runs with agent permissions | Pin version, install explicitly, vet before enabling |
| Shared secrets across MCP servers | One compromised server exposes all credentials | Per-server credential scope (§3) |
| No MCP server inventory | Nobody knows which servers are enabled or why | Maintain allowlist (§2) with approval trail |
| Trusting MCP tool output blindly | Tool poisoning (MCP-01) hijacks agent behavior | Validate and sanitize MCP tool outputs before acting on them |
| MCP servers with shell access | Unrestricted command execution via agent | Use scoped, purpose-built tools instead of generic shell |

## Pre-flight

- [ ] All MCP servers are on the project allowlist with pinned versions (§2)
- [ ] No hardcoded secrets in `mcp.json` — all use `${ENV_VAR}` references (§1)
- [ ] No `npx -y` auto-install patterns (§1)
- [ ] MCP servers run with least-privilege isolation (§3)
- [ ] Audit logging captures all tool invocations with required fields (§4)
- [ ] MCP server version updates go through dependency review process (§2)

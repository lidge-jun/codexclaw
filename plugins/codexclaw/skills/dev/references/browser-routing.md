# Portable browser routing

Canonical owner for dev-family browser selection. This is guidance, not a browser
installer or a guarantee that a tool exists. Read the live tool schema or installed
CLI's documentation before invoking it. A missing optional tool is normal.

## Selection

| Need | Preferred usable capability | Fallback |
|---|---|---|
| Public static source | Hosted search for URL discovery, then HTTP source-open; agbrowse fetch when installed | Host fetch/open or another available source reader |
| Many independent public pages | agbrowse HTTP or CDP extraction with independent task-owned tabs | Bounded native-tab or serial reads |
| Signed-in / judgment-heavy browsing | Aside when installed, running, permitted, and appropriate to the task | Native signed-in browser or agbrowse session that actually has the required access |
| Local UI / interactive QA | Suitable available Aside or native browser; agbrowse is also valid for built-UI driving | Another available browser capability preserving the required render/action/evidence features |
| Desktop / browser-chrome-only UI | Available native computer-use capability | Report the specific capability gap |
| Maintained E2E regression | Repository-owned test runner and fixtures | Report unavailable test prerequisites; exploratory QA is not a replacement |

Aside preference never means a required dependency. Its platform support and account
state must be detected, not inferred from an OS name. Do not copy a personal skill path,
account root, model, or permission preset into distributed defaults. Follow the exposed
Aside integration skill/CLI docs when available; do not claim a private skill is bundled.

agbrowse is recommended, not required. Its package installation is separate from
Node and a compatible browser. Check installed-version requirements; when necessary,
offer the official installation instructions without modifying a project's dependencies.
No available equivalent and no authorized installation path -> report the missing
capability and required human action. Never lower the evidence standard to report PASS.

## Session and parallel-work boundaries

- Inspect -> act -> re-inspect. Read screenshots you cite; verify the promised interaction.
- Each parallel lane owns explicit tabs/targets. Separate profile/port/context where
  necessary; do not race a shared active-tab cursor, overwrite another lane's references,
  or stop a browser/profile another task owns.
- Never assume cookies or permissions transfer between Aside, native Chrome, and agbrowse.
  Do not export credentials to make a fallback work. Reconfirm the actual account/access.
- Before retrying a side-effecting action or switching tools after a timeout, inspect
  whether the action already happened. No duplicate messages, purchases, or submissions.
- A tool's ok/verdict/title is not proof of the requested content. RSS, navigation shells,
  metadata, wrong accounts, and truncated content can require another reader or rendering.
- Start/retry a CDP session only after diagnosing a connection failure and checking
  ownership. Do not start Chrome to repair an unrelated HTTP/auth/content error.
- Missing native plugins on Windows, CLI, or restricted hosts is not a product failure.
  Record the selected fallback; claim platform support only to the extent actually tested.

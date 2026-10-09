## 4. Playwright Browser Testing
Use Playwright after API and contract tests are already trustworthy. Browser tests should validate rendered flows, accessibility-critical interactions, and real integration seams that lower layers cannot prove alone.
**Helper Scripts Available**:
- `../scripts/with_server.py` - Manages server lifecycle (supports multiple servers)
Run scripts with `--help` first — treat as black boxes to avoid context window pollution.
### 4.1 Decision Tree: Choosing Your Approach
```
User task → Static HTML? → Read file → find selectors → write Playwright script
         → Dynamic app? → Server running? → No: `python ../scripts/with_server.py --help`
                                           → Yes: Recon-then-action (navigate → screenshot → selectors → act)
```
### 4.2 Example: Using with_server.py
```bash
# Single server:
python ../scripts/with_server.py --server "npm run dev" --port 5173 -- python your_automation.py

# Multiple servers:
python ../scripts/with_server.py \
  --server "cd backend && python server.py" --port 3000 \
  --server "cd frontend && npm run dev" --port 5173 \
  -- python your_automation.py
```
### 4.3 Reconnaissance-Then-Action Pattern
1. Wait for an explicit app-ready signal or locator assertion → 2. Screenshot/inspect DOM → 3. Identify selectors → 4. Execute actions

### 4.4 Best Practices
- **Use bundled scripts as black boxes** — run `--help` first, invoke directly.
- Use `sync_playwright()` for synchronous scripts; always close the browser.
- Prefer locator-based interactions and web-first assertions: `expect(page.get_by_role("button", name="Save")).to_be_visible()`, then `click()` on that locator.
- Prefer user-facing locators, especially `get_by_role()` with an accessible name. Use `get_by_label()`, `get_by_placeholder()`, or `get_by_test_id()` when role/name cannot express the target.
- Avoid `networkidle`, hard sleeps, and `wait_for_timeout()` in tests. Wait on observable app-ready signals, locator actions, or `expect()` assertions.
- **AI-authored tests (DEFAULT):** Playwright MCP / Test Agents are generation-and-repair aids only — final acceptance still requires deterministic locators, web-first assertions, traces, and a human-readable failure artifact.
### 4.5 Reference Files
- **../examples/** - Examples showing common patterns:
  - `element_discovery.py` - Discovering buttons, links, and inputs on a page
  - `static_html_automation.py` - Using file:// URLs for local HTML
  - `console_logging.py` - Capturing console logs during automation
### 4.6 Browser Testing Rules
- Run **contract tests and API tests first** for broken-data bugs.
- Use Playwright for **rendered truth**, not as a replacement for service tests.
- Prefer one smoke flow per critical path over many brittle micro-flows.
- If a failure looks like data-shape drift, go back to **§2 Backend & API Testing** or **§3 Contract Testing**.
### 4.7 Exploratory browser QA (TEST-CU-QA-01)

Browser QA loads `dev-frontend` for rendered implementation context.
Follow [portable browser routing](../../dev/references/browser-routing.md)
(QA-TOOL-LADDER-01). Suitable available Aside, native browsers, and agbrowse may
drive built UI; no one optional tool is required. Inspect -> act -> re-inspect,
exercise the promised interaction, and retain the state/result evidence.
Repository-owned Playwright suites remain the deterministic regression path.
Load `cxc-qa` for scenario matrices, adversarial/oracle passes, and teardown.
Missing tool/access -> report the gap, never mark an unperformed check passed.

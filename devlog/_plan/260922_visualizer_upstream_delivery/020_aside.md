# wp2 — Aside port on dev

Depends on verified wp1. Root A=/Users/jun/Developer/aside-visualizer.
Read latest origin/main and dev; preserve existing docs-only commit 19633da and
untracked .DS_Store. If dev is absent, create it from verified main; user explicitly
requested dev work. Main alone owns branch/merge operations.

MODIFY A/SKILL.md: merge shared content and VIZ-VERIFY-SCALE-01 while retaining Aside
artifact-file delivery, no inline-host assumptions and no-system-Chrome route.
MODIFY A/reference/{report-writing,reader-documents,document-pdf,visual-design}.md
from verified shared behavior, retaining bundled paths. ADD portable report-pipeline,
port-maintenance, page-role-catalog, English/exhibit references and JSON examples.
COPY shared scripts report-contract, research-adapter, report-intake, report-locale,
exhibit-contract, quality-gate and patched exporter to A/scripts. Never copy cxc-only
upstream sync machinery. Reuse shared tests by rebasing import root into A/test;
include source-only/research/locale/exhibit/export/quality-gate suites and fixtures.

MODIFY A/reference/{environment-detection,no-chrome-pdf-export}.md to make simple
static source inspection sufficient and exported PDF checks truthful; remove obsolete
'poppler works everywhere' claim, check installed capabilities, document exit 3 for
required checks not run. Use --paper-size explicitly. Keep Aside browser extraction
adapter as an injected capability returning the same contract; no private account
needed for fixtures. Preserve capture-pdf.codemode.js unless integration requires a
specific correction; no codemode repository changes.

NEW A/port-manifest.json: schemaVersion, upstream repository/source SHA, shared path
mapping and per-file hashes, adapted file reasons, skill version and evidence locators (issue acceptance status stays only in README). NEW A/test/port-parity.test.mjs verifies payload
hashes and shared fixture outputs against pinned source expectations; record hashes
of actual copied source, never assert arbitrary prose. Main fills exact upstream SHA
after wp1 commit and pins consumer version only when known.

MODIFY A/README.md: replace dated pending ledger with verified acceptance mapping,
retain historical baseline, record implementation/intentional adaptation and loaded
version unknown when not checked. Add focused test/run commands. No claim that code
presence verifies an installed account skill.

NEW A/.github/workflows/ci.yml only if no CI exists: Node built-in tests on pull_request
and pushes to dev/main, contents read, no secret/browser-account use, isolated fixtures.
No repository protection changes. No npm package invention for a file-distributed skill.

Acceptance: each original #1–#4 criterion maps to file + executed check or explicit
human review, neither skipped nor silently narrowed. Test suite and standalone link
check run in isolated copied payload. Test no-Chrome --qa-only on frozen generated PDF,
missing dependencies must fail closed. Shared model preserves observed/illustrative
and source/output language distinctions. Simple static HTML path does not request
browser rendering. Actual downstream dev PR CI is required before integration.

Packaging preflight amendment: current Aside has no LICENSE file despite README's
MIT statement. Add A/LICENSE with the upstream MIT notice/copyright preserved after
reading codexclaw/LICENSE; this is license retention for copied code, not a relicensing
claim. port-manifest.json is created in this phase before the release archive names
it. The new archive allowlist is validated against tracked paths before publication.

Hosted Windows repair during wp2: upstream PR229 inherited-output fixture assumes
its unref child remains alive after parent exit; Windows returned ESRCH, while
all product checks in that job passed. E owns fixture/test-only repair with a real
ready handshake and lifetime guarantee, no skipped assertion. Main will copy the
verified test fixture downstream, update source pin if payload changes, and re-run
both CI matrices. wp1 baseline stays historical; release requires latest-head green.

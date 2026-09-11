# Explorer routing repair

Workflow owner: re0-loop. Base: upstream dev `9cd52769`. Scope: one routing repair
with regression tests, native child proof, local integration and an ordinary PR to dev.

The configured discovery model must survive the native spawn payload. A model's
background helper traffic does not prove that an explorer was delegated.

## Contract and scope

- Read-only roles explicitly supported by the host retain their native identity.
  An explicit `CXC-ROLE` header remains the legacy logical read-only role override
  for explorer transport; free task words cannot select reviewer over explorer.
  Explicit worker/executor/reviewer/architect retain precedence over that header.
- Fresh `items` requests must receive the same configured model/effort and scope
  protection as `message`, without creating both mutually exclusive input fields,
  dropping/reordering attachments, or executing text from attached resources.
- Preserve explicit caller model/effort, full-history fork restrictions, managed
  dispatch one-call claims, recursion denial and final-gate checks.
- Use the existing spawn hook and test harness; no new dispatcher, dependency,
  global role default or model-specific policy. Configuration alone cannot repair
  a hook that returns before applying it. Deletion would remove required routing.
- Clarify when bounded parallel discovery merits explorer in the existing dev
  and delegation owners. No mandatory spawn quota; no claimed savings without
  measurement of main context and rework.

## Boundaries and negative corpus

Entrypoint: native `spawn_agent` -> PreToolUse hook -> role/config resolution ->
updated native payload -> child turn context -> OCX request record. The hook owns
payload adaptation. Store and native permissions remain unchanged. Item text is
caller input, while skill/media/mention items are preserved attachments.

H1 missing config is rejected by a normal message injecting the configured model.
H2 early return for items is reproduced by the same question in items returning
no update. H3 keyword misclassification is reproduced by 'no review' and 'do not
검증' selecting the reviewer. Prior dispatch-command loss is a separate install
collision; preserve local additions and hash the installed proof artifact.

Main owns role precedence, docs, integration and native proof. Executor owns the
items adapter and its new regression file; coordinate changes to the same hook by
non-overlapping function regions. Independent reviewer checks the proposal before
implementation and the final diff afterwards.

### Plan-review disposition

Accept all three review findings; make the transport and negative gates explicit:

- Only caller-supplied `type: text` item text participates in the task projection.
  Non-text item fields and referenced file contents are never scanned for control
  markers, dereferenced, normalized or reordered. Separate text items have an
  explicit separator; fragments cannot form a new control token across items.
- Role headers are recognized before the first `TASK:` as on message transport.
  Positive and negative review words, and role headers quoted after `TASK:`, do
  not override explicit explorer. Legacy producer headers remain supported.
- Run managed-marker, recursion, final-gate and fork checks against caller text
  with the same policy as message, before issuing a native call. Repeated raw hook
  application with the same native tool ID must not issue another claim. Other
  IDs must be denied. Resource/media marker strings are inert.
- Return only `items` for an items-only input. Preserve each attachment and its
  position relative to the original text items; protect scope without flattening
  text across attachments. Normalization stays conservative at item boundaries.
  Repeat application is idempotent. Explicit overrides and full forks retain
  their existing behavior. Cover attachment-only and malformed inputs explicitly.
- Execute `node --test --test-concurrency=1
  'plugins/codexclaw/components/subagent-config/test/*.test.ts'` with isolated
  CODEXCLAW_HOME/CODEX_HOME, `npm run build`, `npm test`, inventory `--check --tests
  <measured total>`, `npm run gate`, and `npm run smoke`. Capture exit codes/logs.

## Gates

1. Capture red tests for items routing and negative review terms before source edits.
2. Green focused subagent suite; preserve legacy headers, attachments, explicit
   overrides, full forks, guard idempotence, managed claims and child recursion.
3. Build, full repository suite, inventory, gate and platform smoke as required by CI.
4. Drive real native explorer calls, with bounded synthetic tasks, using message and
   items; verify completed child model/effort and upstream route/usage. Retire children.
5. Preserve local integration, compare installed hashes, record real-surface limits.
6. re0-memo: evidence-backed lessons and explicit keep/iterate/re0-work decision.
7. Publish generic source/fixtures and sanitized evidence only. Private usage logs,
   account identities, task paths and full transcripts remain local. Open PR to dev.

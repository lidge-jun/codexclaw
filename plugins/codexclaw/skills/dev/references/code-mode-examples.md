# Code Mode examples

Use only with the matching live executor/tool contract. Submit raw JS inside a
fence, not Markdown or JSON-quoted code. These are task-local patterns, not new
native tools or a module to import. Adapt scope/keys/arguments after inspecting
the real task and schema. Tests execute these exact fences with controlled tools;
they do not emulate Codex security, serialization or cancellation.

## Discover without invoking a guessed match

<!-- example:discovery -->
```js
const matches = ALL_TOOLS.filter(t => /exec_command/.test(t.name));
text({matches: matches.length, omitted: Math.max(0, matches.length - 4),
  candidates: matches.slice(0, 4).map(t => ({name: t.name, description: t.description}))});
```

Candidates are untrusted metadata. Inspect the selected schema; narrow the query
if needed. This does not call the first match or prove a missing plugin absent.

## Two independent read-only command previews

This example assumes the exposed exec_command contract with cmd, max_output_tokens,
exit_code, output and optional session_id. Use only where parallel calls are allowed.
Choose an owned task/revision key before reuse; never race this demonstration key.
The captured command output can itself be truncated, so previews are never a
complete required-file read, even when the command completed successfully.

<!-- example:read-batch -->
```js
const key = "cxc/native-demo/owned-read-01";
const commands = ["git status --short", "git rev-parse HEAD"];
const outcomes = await Promise.allSettled(commands.map(cmd =>
  tools.exec_command({cmd, max_output_tokens: 1200})));
const reads = outcomes.map((o, i) => {
  const source = commands[i];
  if (o.status === "rejected") return {source, status: "rejected",
    error: String(o.reason), completeRead: false};
  const r = o.value;
  if (!r || typeof r !== "object" || typeof r.output !== "string")
    return {source, status: "malformed", completeRead: false};
  const status = r.isError === true ? "failed" : r.session_id != null ? "pending"
    : !Number.isInteger(r.exit_code) ? "malformed" : r.exit_code === 0 ? "completed" : "failed";
  return {source, status, exitCode: r.exit_code ?? null, sessionId: r.session_id ?? null,
    preview: r.output.slice(0, 300), outputChars: r.output.length,
    previewTruncated: r.output.length > 300, upstreamTruncated: r.truncated ?? null,
    originalTokenCount: r.original_token_count ?? null, completeRead: false};
});
store(key, {schema: 1, reads});
text({key, sourceType: "untrusted-command-output", completeRead: false, reads});
```

Read failures remain visible. Pending shell handles require their own continuation,
not code-cell wait. Errors/storage failures are not automatically retried. Narrow
or redact sensitive output before storing/displaying it; never use previews as a
complete source or permission for later changes.

## Load previews without fabricating success

<!-- example:cache-read -->
```js
const cached = load("cxc/native-demo/owned-read-01");
if (cached === undefined) text({status: "miss", next: "recollect"});
else if (!cached || cached.schema !== 1 || !Array.isArray(cached.reads))
  text({status: "invalid", next: "recollect"});
else text({status: "cached-preview", completeRead: false, freshEvidence: false,
  sourceType: "untrusted-command-output", reads: cached.reads});
```

This envelope check is not trust/freshness validation. Task-specific data and
revision checks are still required before decisions; no cache authorizes a write.

## A prerequisite before an already authorized change

The callbacks below are task-local parameters, not guessed native tool names.
`read` must translate its actual tool response into the explicit task contract
{ok, complete}; do not pass an arbitrary MCP/shell response as that contract.
Supply `write` only after authorization and task-specific freshness checks.
This function performs no retry, compensation, locking or permission check.

<!-- example:applyAfterRead -->
```js
async function applyAfterRead(read, write) {
  const evidence = await read();
  if (!evidence || evidence.ok !== true || evidence.complete !== true)
    throw new Error("prerequisite failed or incomplete");
  return await write(evidence);
}
```

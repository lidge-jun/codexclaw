# Delivery — inspect capabilities, not application labels

Choose delivery from the user's requested artifact and the current host contract.
Environment variables, app names, ports and installed packages are hints only;
they do not establish that the conversation supports a renderer.

| Evidence actually available | Use |
|---|---|
| Host explicitly supports the needed Mermaid type | Normal fenced Mermaid |
| Current `visualize` skill is exposed and the request is in-conversation | Read it fully; follow its current fragment/path/resource/reference contract |
| User asks for a standalone HTML/SVG/PDF file | Create that file in an authorized durable output directory |
| Browser is available, inline rendering is not established | Inspect the standalone artifact in that browser and return its file link |
| No renderer/exporter is available | Provide useful editable source/text and state which verification/output is unavailable |

An exposed host contract takes priority over `reference/visualize-contract.md`.
Do not emit historical directives, assume an app version, or use a local server's
health response as proof that the user is reading its UI. The embedded contract
and its extractor are maintenance provenance, not an alternative renderer owner.

## Files and browser inspection

- Use an absolute path on the executor that writes the file. A writable file is
  not automatically conversation-readable; follow the host's declared artifact path.
- System temporary space is suitable for disposable inspection, not durable delivery.
- Follow the available browser's current documentation. Aside is suitable for the
  user's signed-in browser and research; other available browser tools are valid
  for local QA. Do not assume a vendor-specific method or force an installation.
- Some browser surfaces cannot open file URLs. If HTTP is required, serve only the
  artifact directory on loopback with a task-owned process and available port.
  Record its handle, inspect the page, and stop only that process after use.
- Platform open commands are optional conveniences. Successful process dispatch
  proves the request was sent, not that a page rendered. Inspect before claiming it.

## Inline and standalone are different products

A conversation fragment uses host-provided utilities, resource restrictions and
interaction APIs. A standalone report uses its own document structure and tokens.
Do not deliver a fragment as a full HTML file or depend on host-only globals in
exported files. When exporting an existing inline visual, use the current host
skill's supported export procedure and replace unavailable host interactions.

“Self-contained” means the necessary code/data/assets are included; a CDN-backed
single file still needs network access. Test with network disabled before claiming
offline behavior. Do not fetch private data or introduce telemetry into an artifact.

PDF is a separate output: perform the export and inspect its pages following
[documents/PDF](document-pdf.md). Browser rendering alone cannot certify PDF layout.

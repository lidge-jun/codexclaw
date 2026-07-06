# RepoMapper Vendor Notice

Vendored from github.com/pdavis68/RepoMapper, MIT License, by Pete Davis.

The `queries/*.scm` files are derived from Aider (github.com/Aider-AI/aider),
Apache-2.0.

Date vendored: 2026-07-06.

Local modifications:
- Made `repomap.py` a stateless one-shot CLI with lazy imports after argument
  parsing, a dependency install hint, `--budget` as an alias for
  `--map-tokens`, and a default budget of 4096 tokens.
- Removed debug/default tuple-style output from `repomap.py`; stdout now emits
  only the map, while no-map and verbose file-report summaries go to stderr.
- Made `utils.py` load `tiktoken` lazily and fall back to an approximate token
  count when `tiktoken` is unavailable.
- Changed the tags cache location to `CODEXCLAW_REPOMAP_CACHE` when set, or
  `.codexclaw/cache/repomap/tags.v1` under the working repository by default.
- Changed the `get_tags_raw` missing parser dependency path to raise a clean
  `RuntimeError` instead of exiting the process from library code.
- Extended the `find_src_files` directory skip set with compiled-output dirs
  (`dist`, `build`, `target`, `out`, `coverage`) so maps rank sources, not
  build artifacts.
- Set argparse `prog="cxc map"` so help text names the real entry point.

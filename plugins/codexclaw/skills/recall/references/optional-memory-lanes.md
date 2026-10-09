## Optional extra lanes (only if the tool is installed)

These are not part of cxc. Skip the whole section when the binary is missing.

- **Aside** (`aside` on PATH): `aside memory search --json "<q>"`. If the top
  score is below 0.72, treat the semantic lane as a miss. Recover proper nouns
  with `rg --fixed-strings`. Dedupe by `path` (neighbor chunks of the same file
  are not extra evidence).
- **kim_wiki** (`~/kim_wiki/scripts/ask.py` exists):
  `python3 ~/kim_wiki/scripts/ask.py "<q>"`. Do not add entries/raw/nodes scores
  together. If the entries lane is empty, open the detailed document that
  nodes/raw pointed at and confirm with `rg`.

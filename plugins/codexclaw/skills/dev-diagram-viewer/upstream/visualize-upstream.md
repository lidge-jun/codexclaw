# Visualize inspection provenance

This records the last inspection, not an embedded contract. The host's current
visualize skill always owns inline delivery.

- Current upstream path: `resolve visualize/SKILL.md from the active host skill catalog`
- Current SHA-256: `be82c4e573ffe2fc0921a10f49eb690ce6f7c8a06acffb2789600be677720d05`
- Version: `1.0.29`
- Last inspected: `2026-09-05`

The repository formerly embedded 1.0.11. The installed codexclaw snapshot inspected
during the audit had a different 1.0.22 extraction; neither determines the current
host's contract. This patch removes that duplicated authority and delegates to the
listed upstream skill, with standalone/text fallback when unavailable.

The optional Unix sync-check.sh compares the locally found upstream hash with this
inspection record. A mismatch means re-read current instructions; do not mechanically
copy a new manual into this repository. Missing local cache is an availability result,
not a reason to require the plugin or declare a broken user environment.

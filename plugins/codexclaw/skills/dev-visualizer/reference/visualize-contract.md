# Current visualization contract — delegation, not a frozen copy

The host-provided `visualize` skill is the source of truth when available.
Read its full current SKILL.md before creating or changing an inline visualization.
Resolve the path from the task's skill catalog; do not hardcode a home directory,
cache version, directive spelling, size limit, or writable-root assumption.

Check these live requirements:
- allowed artifact location and absolute executor-side path;
- HTML fragment versus standalone document;
- size and permitted resource/network rules;
- the exact response content reference;
- accessibility and primary interaction verification.

The 2026-09-05 inspection observed visualize 1.0.29, including a 1 MB limit and an
absolute-path content reference. This is provenance, not a contract to copy forward.
See `../upstream/visualize-upstream.md` for the inspected hash.

If the host does not expose visualize, use the standalone/browser or text/static
route from `../SKILL.md`. Do not invent inline support or require the user to install
a particular optional plugin. Respect the task's current platform and permissions.

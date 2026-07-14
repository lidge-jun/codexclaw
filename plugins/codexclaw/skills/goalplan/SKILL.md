---
name: cxc-goalplan
description: "DEPRECATED — merged into cxc-loop. Use $cxc-loop for durable goalplans."
metadata:
  deprecated: true
  redirect: cxc-loop
---

# cxc-goalplan (DEPRECATED)

This skill has been merged into `$cxc-loop`. All goalplan concepts (work-phases,
criteria, checkpoints, evidence, CLI surface) now live in the loop skill.

Use `$cxc-loop` instead. The `cxc goalplan` CLI commands still work as deprecated
aliases for `cxc loop`.

For multi-cycle loops, `cxc-loop` now mandates a docs-first entry cycle
(LOOP-DOCS-FIRST-01) before implementation work-phases.

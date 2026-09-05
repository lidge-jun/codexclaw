# WP2 implementation and verification record

Status: BUILD in progress. This candidate is not released or accepted as a
complete runtime default. WP3 still owns arming-text alignment; WP4 owns final
installed proof. See [030](030_agent_owned_skills.md) and [031](031_skill_content.md).

## Clarified optimization target

The user clarified during B that modularity stays and references may increase.
Keep knowledge and rule ownership; reduce unconditional loading. Reference count
is not a success metric. Main recorded this in 030 section4 and the existing
goalplan steering ledger (20260905-wp2-reference-modularity). Existing coverage,
behavior and whole-selected-path criteria remain unchanged.

## Materialized candidate

Three disjoint workers implemented loop, pabcd and dev/scaffolding respectively
from the approved baseline ranges in 031. They reported exact construction and
only the approved ownership/link corrections; independent integration review is
pending. Main moved the attestation document reader, extended reference route
assertions, checked real catalog/body consumers and extended the prose scanner.
No runtime hook, implicit policy, frontend/uiux or component dist changed.

Entrypoint sizes are dev20,357, pabcd10,261 and loop7,034 bytes. These are only file
sizes, not observed total loaded paths, model tokens or a performance result.
Selected reference reads, repetitions, hook duplication and task outcomes still
need actual matching probe observations before an optimization claim.

## Remote verification so far

Host: macmini-cf, isolated wp2-source under the established experiment root.
Node v22.22.0. No local tests, builds or typecheck were run.

- RED: the new nested-reference false-enforcement case fails on the old scanner
  with true versus false (wp2-gate-red.log). This proves the old coverage gap.
- First GREEN attempt failed to parse: a glob in main's new block comment
  contained the comment terminator. Changed the comment to plain nested-reference
  wording; scanner semantics stayed as designed. Retain wp2-gate-green.log as a
  failed attempt, not passing evidence.
- Corrected focused suite:118 passed,0 failed,0 skipped; exit0 (wp2-suite.log).
  Targets: manifest policy, skill catalog, provenance, gate, attestation shape and
  spawn attachment. This includes the relocated-reference case and actual catalog
  and body-delivery consumers.
- Inventory exit0:28 skills,23 hooks,8 components. Gate exit0 with reference
  scanning enabled (wp2-inventory.log, wp2-gate.log).

Behavioral and loaded-path trials, independent verdict, fresh C receipt and WP2
closure remain pending. Static passes do not prove that an agent follows a rule.

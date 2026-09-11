# Global settings and live model discovery

Users should choose main/global/direct models in each existing role dropdown, manage user defaults on a separate Global Settings page, and see the models currently enabled in OCX. This replaces the Editing selector and ambiguous reset buttons from 81faa22 while retaining its effort persistence fix.

- Archetype/trigger: satisfy-spec, Jun's explicit PABCD implementation request after UX review.
- Goal: separate global settings, clear role inheritance, canonical CXC home, truthful shared model list, tested in this host before any PR.
- Non-goals: PR/push, merge/release, installed plugin replacement, paid inference, changing existing user role preferences or unrelated catalog-native-models worktree.
- Verifiers: component tests, GUI strict tsc/build, actual serve HTTP restart fixtures, browser flows, read-only OCX roster comparison. Existing suite and build were verified in prior cycle (2,614 passes, 70 conditional skips); new commands directly target the changed files. Observe errors by disabling fixture server/returning malformed data; observe refresh by changing fake OCX output and forcing refresh.
- Stop: clean local commit, independent review and actual-host preview checks complete; report before PR.
- Artifacts: this unit's numbered plan/design/check docs and /home/jun/tmp/cxc-global-settings-01a07d17 runtime logs.
- Outcomes: implemented/tested local change, or explicit unresolved evidence; no automatic publication.
- Escalation: main handles routine implementation choices; ask only if required live mutation exceeds scope. Main reclaims stalled executor scope explicitly; no concurrent overlapping writes.

Prior D: effort save + role-level project > global > session passed. Change direction because user rejected Editing/reset-button UX and requested CXC-owned global path plus automatic OCX discovery. Preserve entire-role inheritance semantics: absent project role follows global; selecting Global uses existing inherit:true reset; selecting a main/direct model creates/updates a project role and retains its effort/prompt. In global mode effort/prompt display inherited values read-only; pick main/direct model to customize. Existing persisted models and null effort are unchanged until an explicit edit.

Design read: existing light dense developer dashboard, existing CSS tokens/type/icons, sidebar Global Settings entry. No new framework, assets, or expressive redesign. Original Subagents three-role layout stays. Each model selector offers Main model / Global settings / catalog entries. Global page offers Main model / catalog entries and effort/prompt controls. No Editing selector or per-role Use buttons. Status text shows actual inherited value and no ambiguity about write scope. Preserve disabled untrusted-project edits and prompt drafts. Existing Dashboard quick controls must use the same selection semantics.

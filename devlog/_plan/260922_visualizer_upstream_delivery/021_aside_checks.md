# wp2 verified downstream port

Aside dev contains the verified shared behavior with host-specific adaptation.
PR5 merged c4ba0c5bc5de3698fbc877a6d636f15e8c1def94 after latest-head CI
35709411308 passed Linux/macOS/Windows and all3 review threads were fixed/resolved.
Reviewed head ef7e562512a48efb8c68f6011b431edff9435ce5; merge is source-equivalent.
Shared source pin9d32c389f98da74d147ec6726b97a6f972760414;29exact shared hashes.

-226local tests pass,0skip; parity/standalone checks pass.
-Source-only intake,6localizedHTML and10exhibit outputs equal upstream.
-NoChrome actual PDF QA reports chrome:null/PASS and2A4pages.
-Independent port audit PASS; interdiff source-note/quote/Windows-LF fixes PASS.
-Hosted Windows first failed because fixture lifetime andCRLF weren't portable;
IPC readiness+detachment and LF attributes repaired actual triggers, no tests skipped.
-Question-gap q1/q10 false association fixed upstream and copied downstream;
existing test extended without count change. Upstream PR229 latest CI pending.
-SKILL keeps source-only static editing; noChrome Aside path remains available.
-Manifest records hashes/adaptations; README owns issue status; no installed account
claim. Existing untracked .DS_Store preserved.

D direction: integrate upstream dev, version/promote/publish both exact revisions,
verify downloaded archives and existing local plugin, then close issues. Remote
existing-install rollout follows as user-added wp4 after release proof.

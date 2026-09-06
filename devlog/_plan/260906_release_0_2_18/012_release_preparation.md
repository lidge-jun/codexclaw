# Version preparation and deployment preflight

Prepared3bfc2474c49427c70323d09e42e384128541b51a: root/CLI/GUI/eight components
0.2.18, matching lock workspace versions, manifest and inventory
0.2.18+codex.20260906043759. Official plugin cachebuster helper supplied the UTC
suffix after identifier validation. The dependency graph is structurally unchanged;
docs-site's independent0.0.1 version is untouched. Independent Grok metadata review GO.

Fresh macmini Node24.20.0 at exact3bfc2474: embedded versions and inventory2579
pass; full suite2579total/2578pass/0fail/0cancel/1existing skip,74270.194209ms;
build passes and source remains clean. npm audit reports0 at every severity;
CycloneDX SBOM has83 components. No signed-provenance claim is made.

Prepared installer is the previous reviewed helper with only its expected-version
literal changed. SHA256:7ce39f5b698fe2a7c510ba853cc6da67e85760964395bba9fd1cfb223f4e842f.
Expected-file producer SHA256:9bc768b813d83fb42e06fdc8d2a11eac0934b0684e59345d91512914142541bd.
Both require the eventual frozen source/published payload; no direct-snapshot
deployment was authorized in place of a release in this run.

Fresh installed runtime inventory:
- macmini-cf: Codex0.146.0, operator Node24.20.0, installed0.2.17; local source mode.
- suji: Codex0.147.0, operator Node22.23.1, installed0.2.17; Git mode.
- desktop-c795oh4: Codex0.147.0, Node24.19.0, installed0.2.17; Git mode.
- local: Codex0.153.2; cache0.2.16; local marketplace points at
  /Users/jun/Developer/new/700_projects/codexclaw. That checkout has unrelated
  uncommitted ast-grep/diagram/script work and is NOT a clean release source.

Local source/work is preserved. An optional async question asks whether to switch
only the local install's connection to a fixed released Git source while leaving
the dirty development checkout intact. Submission is not approval; no response
means keep the local development connection. SSH deployment continues independently.
No app restart or forced source reset is allowed. Unreachable aliases are checked
separately, not treated as absent installations.

Corrected PR69 passed all11 current-head checks before its normal merge to dev;
the compact-delivery review thread was resolved with the fix evidence. PR70 was
already merged. The release branch integrates the actual dev merge commit while
retaining the independently reviewed0.2.18 metadata. A failed local JSON parsing
attempt during read-only preflight performed no merge; separate structured reads
then verified the same pinned head and green checks before the successful action.

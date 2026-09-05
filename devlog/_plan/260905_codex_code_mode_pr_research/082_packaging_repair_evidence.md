# Compiled parity repair evidence

081 plan independently approved by Gauss, including the one-call NUL-delimited
Git membership check. No original test assertion, source body or runtime wiring
was changed.

On macmini, fresh source375c02a plus the new packaging test:

- RED: packaging exit1; original three tests pass and the new test identifies
  exactly the seven missing Git-tracked compiler outputs.
- Build: existing Node24.20.0 build emits the outputs from unchanged sources.
  Explicitly stage those seven generated files, without changing the oracle.
- GREEN: same packaging command4pass/0fail/0skip.
- Full suite:2524total,2523pass,0fail,0cancelled,1 existing repo-map skip;
  69,532.825ms, exit0. The generator updates root README badges to measured2524.

Evidence in session remote root R: release-packaging-{red,build,green,suite}.log.
Source fixture: R/release-packaging-source. Copies of all seven compiled outputs
in the main checkout match the file hashes already captured from the original
375c02a Node24 build in operator/lifecycle-check-expected.json. Nothing was
hand-edited in generated output; global dist ignore is unchanged.

This closes the bounded packaging test failure. New-ref CI, successful native
candidate lifecycle, publication and production delivery are still required;
the first isolated apply failure and successful recovery remain recorded in080.

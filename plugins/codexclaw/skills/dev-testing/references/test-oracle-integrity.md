## Test Oracle Integrity (TEST-PROMPT-SEAM-01 / TEST-ORACLE-INDEPENDENCE-01 / TEST-PRECEDENCE-FIXTURE-01, DEFAULT)

Three narrow contracts that stop false-green. All three are **E7 prose — no gate enforces
them**; the reviewer is the only check.

**TEST-PROMPT-SEAM-01 (DEFAULT).** Do not assert on prose. A test may read a document only
when it EXTRACTS a value and COMPARES it against a value from another source. Asserting that
a phrase exists in a file is a violation no matter how many files you read or what the test's
header says it is for.

- Forbidden: `assert.match(readFileSync(".../SKILL.md"), /prefer rg first/i)` — one source,
  phrase existence, breaks on harmless rewording, proves no behavior.
- Allowed: parse the frontmatter `description`, pull the model token out of it, and
  `assert.ok(NATIVE_OPENAI_MODELS.includes(token))` — two sources, values compared, breaks
  only when they genuinely disagree.
- Also allowed (outside this rule's scope): asserting on non-prose values — version pins,
  license names, runtime output, CLI stdout, hook payloads, file existence.

**TEST-ORACLE-INDEPENDENCE-01 (DEFAULT).** Never derive the expected value from the code
under test.

- Forbidden: `assert.equal(fn(x), fn(x))`; building the expectation with a helper the DUT
  also uses; refreshing a snapshot from current output and calling that verification.
- Allowed: hardcode the expectation in the fixture, or compute it by an independent route
  (a second implementation, a hand-worked example, an external spec).

**TEST-PRECEDENCE-FIXTURE-01 (DEFAULT).** When testing override / default / fallback, the
three values must all DIFFER — otherwise the test cannot tell which path ran.

- Forbidden: override `"x"`, default `"x"`, fallback `"x"` — every branch passes.
- Allowed: override `"from-flag"`, default `"from-config"`, fallback `"builtin"`, and each
  case asserts the specific one.

A regression test should FAIL when the defect is reintroduced. Confirm it once by mutation —
break it, watch it go red, restore it, watch it go green.

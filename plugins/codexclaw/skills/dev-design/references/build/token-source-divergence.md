# Token Source Divergence

Read this when a repository declares the same design tokens in more than one
place — an SCSS variable file and a Tailwind config, a theme object and a CSS
custom-property block, or one config per app in a monorepo — and your change
touches colour, typography, spacing, or breakpoints.

The failure this file prevents is quiet. Nothing breaks at the moment you edit
one source; the copies simply stop agreeing, and the disagreement surfaces
later as a screen that looks almost right.

## Detecting independently declared sources

Before changing a token value, find every place that declares it. Grep for the
value itself, not only the name: a copy can carry the same hex under a
different key.

```bash
rg -n --glob '!node_modules' -e 'tailwind.config' -e '_variables' -e 'theme\.(ts|js)'
rg -n --glob '!node_modules' '<the-hex-you-are-changing>'
```

Two sources declaring the same names is the common case. Two sources declaring
*overlapping but unequal* name sets is the dangerous one, because a name
present in one and absent in the other reads as "not a token" from whichever
side you happen to open.

## Confirming authority and synchronisation

A repository with several token sources usually has one of three arrangements.
Establish which before editing.

| Arrangement | Signal | What your change must do |
|---|---|---|
| One source generates the others | a build step, codegen script, or comment marking a file generated | edit the source, re-run generation |
| A shared package feeds all of them | an import from a package rather than a literal | change the package, then verify consumers |
| Each is maintained by hand | no import, no generator, values simply repeated | decide the scope of your change explicitly |

The third arrangement is the one that needs judgement, and it is the most
common in applications assembled over several years. There is no mechanism to
lean on; whether the copies stay aligned depends on the person editing.

If you cannot establish which arrangement applies, say so and stop. Reporting
"changed the colour" while one of three declarations still holds the old value
is a false completion claim.

## Change plan before editing

State, before the first edit:

- which sources declare the token
- which of them your change will touch, and why the others are excluded
- how you will verify each touched source rendered the new value

"Excluded because that app is out of scope" is a good reason. "Excluded
because I only found one" is not a reason; it is an incomplete search.

## Semantic additions and literal exceptions

A value that no source declares is not automatically a mistake to normalise.
Classify it first.

- **Missing token.** The role is general and recurring, but no entry names it.
  The fix is a token addition, which usually needs design approval rather than
  an inline constant.
- **Deliberate content colour.** The value belongs to one piece of content —
  a campaign page, a themed report, a partner brand — and injecting it through
  data is the intended design. Normalising it removes a feature.
- **Near-duplicate.** The value sits a step or two from an existing token.
  These are the worst kind: indistinguishable on screen, invisible to search
  for the token name, and multiplying quietly.

Only the third class is unambiguously a defect. Do not run a repository-wide
literal-to-token sweep on the strength of a count alone; the count mixes all
three classes.

## One-sided change gate

**FE-TOKEN-SOURCE-01 (STRICT):** when the same token is declared in more than
one source, do not change a value in one source without either changing the
others or recording why they are excluded. Mechanism: enumerate the sources
before editing and name the ones you touch. Failure: the copies drift and the
difference shows up as a near-miss colour later. Exception: a source that is
demonstrably generated from the one you edit.

**FE-TOKEN-LITERAL-01 (DEFAULT):** classify an out-of-token literal as a
missing token, a deliberate content value, or a near-duplicate before acting on
it. Mechanism: check whether the role recurs and whether the value arrives
through content data. Failure: a sweep erases intentional per-content values,
or a genuine near-duplicate survives because the count looked large and
hopeless. Exception: none; recording the classification as unknown is itself an
acceptable outcome.

## Rendered parity verification

Static agreement between files is not proof. When a change touches more than
one source, render at least one surface per source and compare.

Where the sources feed different applications, that means running each
application. Where they feed the same application through different layers,
check a component from each layer. Follow `visual-verification.md` for the
observation itself; this file only insists that the observation covers every
source you touched.

## Reporting unresolved ownership

When the arrangement cannot be established, or when a token addition needs a
decision you do not own, the honest output is a routed request naming the
sources, the role the change needs, and the decision that would settle it.

A change that edits one source and stays silent about the others is worse than
no change, because it looks finished.

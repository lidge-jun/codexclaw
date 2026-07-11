# 080 — Plan Amendment: Fail-Safe Scanner Default (C-gate r3 response)

- Trigger: Kierkegaard C-gate r3 FAIL (3 High). All prior-round blockers verified
  closed; new ones are again markdown-fidelity gaps. LOOP-REPAIR-01 escalation:
  amend the plan with a DESIGN RULE rather than another blind patch round.

## Design rule (new accept criterion)

FAILSAFE-SPAN-01: whenever the scanner cannot POSITIVELY classify a span —
over-cap link tails, unrecognized/ambiguous constructs, unclosed spans — it must
PROTECT (identity no-op for that region or the rest of the message) rather than
fall back to plain-text handling. A false negative (mention left bare) is
acceptable — normalization is a safety net behind the fixed directive/wrapper/doc
channels; a false positive (corrupting a valid message) is not.

## r3 blocker fold-backs

1. Over-cap link tail (>1KiB): return "protected span to the balanced close" of
   the link candidate instead of null/plain-text — the label token must never be
   nested-rewritten.
2. Container/CRLF fences: fence open/close detection strips up to one level of
   block-quote/list prefixes (`>`, `-`, `*`, `N.`, spaces up to CommonMark
   limits) and tolerates `\r` before the newline. Unrecognized container nesting
   => treat the whole line as a potential fence toggle (over-protection OK per
   FAILSAFE-SPAN-01).
3. Backslash escapes: the main scanner consumes `\\x` pairs so `\\\`` is not an
   inline-code opener; no state bleeds to EOM.

Escalation clause: if the NEXT review round still finds new High scanner
blockers, abandon incremental hardening and rebuild as the conservative
line-based scanner (fences by line state; skip any line containing a backtick;
never rewrite inside bracket spans) — the maximally fail-safe shape.

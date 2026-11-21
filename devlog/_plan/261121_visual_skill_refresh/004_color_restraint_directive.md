# 004 — Color restraint directive (user, 2026-11-21)

## The instruction

> 필에 왼쪽 강조 이것도 없애고 색상도 최대한 많이 없도록 버튼에 많은색이 들어가지 않게하고
> 아예 svg나 이런거를 이런식으로하게 왜냐하면 색깔로 버튼만들면 별로안좋아

Read as three rules:

1. No left (one-sided) accent on pills, cards, callouts, nav items or any rounded box.
2. As little color as possible; buttons do not carry hue.
3. Controls are built from neutral shapes and monochrome SVG glyphs, as in the attached
   reference, because colored buttons look worse.

## The reference (described, not committed)

A macOS Activity Monitor window. Observed:

- Toolbar actions (stop, info, more) are monochrome line glyphs inside neutral circular
  controls of the same gray as the window chrome. No hue, no fill color, no label.
- The CPU / Memory / Energy / Disk / Network switcher is a neutral segmented control; the
  selected segment is a slightly darker neutral pill, not a colored one.
- Search is a single glyph in a neutral circle.
- Color appears only in data: the CPU load chart (blue user, red system) and the matching
  numbers "System 21.95%" (red) and "User 68.55%" (blue). Everything that is clicked is gray;
  everything that is measured may be colored.
- Table rows use zebra neutral striping, no accents.

## How this lands in the skills (wp1)

- New `FE-SIDE-ACCENT-01` (DEFAULT, user contract): one-sided accent edges are removed from
  every recipe and banned as an emphasis channel. Only a per-row marker that encodes data (a
  diff gutter, an event category) survives, and it must also carry a non-color cue.
- New `FE-COLOR-RESTRAINT-01` (DEFAULT, user contract): a per-screen color budget; neutral
  buttons (ink primary, bordered secondary, glyph-only tertiary); icon controls as monochrome
  SVG with `currentColor` in a neutral shape; selected states change neutral step and weight,
  not hue; hue is spent on data, focus, links in prose and status.
- Every sample that contradicts this is rewritten in the same phase (005 lists them).

DEFAULT, not STRICT, because dev §0.2 makes style rules DEFAULT. The documented reason to
deviate is narrow: the user's or client's brief explicitly asks for the pattern.

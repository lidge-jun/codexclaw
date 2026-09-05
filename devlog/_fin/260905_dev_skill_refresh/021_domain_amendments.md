# wp2 — A audit amendments

Dependency: owning decade plan. These exact edits run AFTER its original operations.

## MODIFY plugins/codexclaw/skills/dev-architecture/SKILL.md

Before:

`````text
Ownership split: **placement** (validation happens at the boundary, nowhere else) is owned
by this section; **what the validation schema enforces** (content/policy) is owned by
`dev-security` §1.
`````

After:

`````text
Ownership: this section distinguishes ingress shape parsing, domain invariants and
reachable-state assertions. `dev-security` owns security validation and authorization
policy; placement must not erase a business invariant or required defense-in-depth.
`````

## MODIFY plugins/codexclaw/skills/dev-architecture/SKILL.md

Before:

`````text
- [ ] **Validation placement** — new validation is at system boundary, not internal functions
`````

After:

`````text
- [ ] **Validation placement** — parse untrusted shape at ingress; enforce domain invariants in their owner and preserve required security checks
`````

## MODIFY plugins/codexclaw/skills/dev-architecture/SKILL.md

Before:

`````text
- [ ] **Module size** — new/modified modules under 400 LOC
`````

After:

`````text
- [ ] **Module size** — review >400 LOC for cohesion; document a justified exception rather than blocking by size alone
`````

## MODIFY plugins/codexclaw/skills/dev-architecture/SKILL.md

Before:

`````text
  NO  -> Is this a security-critical path?
    YES -> Validate (defense in depth)
    NO  -> Trust the type system, no validation needed
`````

After:

`````text
  NO  -> Is this a security-critical path or a domain/state invariant?
    YES -> Enforce the relevant invariant/authorization in its owner
    NO  -> Avoid duplicating already-proven shape validation
`````

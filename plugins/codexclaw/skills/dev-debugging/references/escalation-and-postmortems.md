## When to Escalate vs When to Keep Digging

### Keep Digging When:

- You have untested hypotheses from Phase 2
- You haven't read the full error message or stack trace
- You haven't checked recent changes (`git log`, `git diff`)
- You haven't found working comparison code yet
- The bug is in YOUR code (not a third-party library)
- You still have untested approaches to try

### Escalate When:

- **Repeated fix attempts failed** — likely architectural; needs human judgment
- **Undocumented library behavior** — document evidence; propose an upstream report or scoped workaround without posting externally unless authorized
- **Environment-specific** — requires access you don't have (prod DB, cloud IAM)
- **Security-sensitive** — don't debug auth/crypto/payment alone; flag for human review
- **Multi-team dependency** — bug is in another team's service or API contract
- **Stalled**: if investigation stalls, reassess approach

### How to Escalate Well

Don't just say "I'm stuck." Provide: **symptom** (exact error), **reproduction
steps**, **evidence gathered** (logs, traces, bisect results), **hypotheses
tested** (including rejected hypotheses and rejection evidence), **remaining hypotheses** (untested),
and a **recommendation** for next steps.

---

## Post-Mortem Discipline

After resolving any bug that:
- Was user/customer-impacting
- Took >1 hour to diagnose
- Involved 3+ failed fix attempts (per postmortem-template.md)
- Revealed a systemic issue (same bug class exists elsewhere)

Fill out `postmortem-template.md` and include it in the PR or commit.
The goal is **learning, not blame**. Every postmortem must produce at least one
action item that prevents the same class of bug from recurring.

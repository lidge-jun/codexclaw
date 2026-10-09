# Scope and maintenance

**VIZ-SCOPE-01 — caller-scoped artifacts, upstream-first maintenance.** Shared
visualizer fixes are implemented and verified in codexclaw first, then adapted to
the standalone `aside-visualizer` repository. For explicitly requested maintenance,
follow [the port workflow](port-maintenance.md); an upstream merge alone
does not close a downstream issue. This direction does not authorize maintenance
while answering an ordinary artifact request or duplicate Aside's roadmap here.
Within codexclaw the skill has no independent mandate either. It composes and verifies
the artifact the calling task asked for, under that task's plan and verification gate.
It does not open a repository of its own, install itself or its scripts as a
prerequisite, publish, deploy, upload or open an artifact nobody requested, or start a
loop of its own. When something beyond the requested artifact looks necessary, say so
and let the caller decide.

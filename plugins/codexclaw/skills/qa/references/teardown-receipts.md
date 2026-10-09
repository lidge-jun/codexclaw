## 6. Teardown receipts

Every resource the QA pass spawned — dev-server PIDs, ports, tmux sessions,
browser tabs, containers, temp dirs — gets its own teardown line WITH proof:
`lsof -i :<port>` empty, `tmux ls` clean, `ps` check, `rm` + absent check.
A stateless pass records an explicit "no resources spawned" line with what was
checked. No QA asset is left running after the verdict.

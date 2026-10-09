## Result checks (before treating a hit as the answer)

- Version-string trap: a hit that contains `2.49.0` may be the previous release
  bumping *toward* 2.49.0. Check the title/date/task_outcome. Do not take the
  first version match.

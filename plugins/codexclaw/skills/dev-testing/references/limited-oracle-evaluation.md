# Limited-Oracle / Score-Objective Evaluation

Use this reference when the real evaluator is scarce, paid, rate-limited, or opaque, and
local tests are proxy metrics for a score/objective. These rules are paired with
`cxc-pabcd` Optimization-Loop Meta-Rules (plateau discipline). They were observed in a
14-discard optimization plateau where a prefix-only replay gate and hard
draw-protection invariant locked a 3.5/8 score.

- **GATE-ORACLE-VALIDITY-01 (STRICT):** When the true evaluator/oracle is
  rate-limited and local metrics are proxies, evaluator validity is a PREREQUISITE
  gate. Before trusting the proxy for accept/reject, quantify historical divergence:
  cases where the proxy said better/equal but the oracle said worse. A proxy with known
  optimistic bias must not be the sole acceptance evidence.
- **GATE-PREFIX-HORIZON-01 (DEFAULT):** Replay-based evidence, such as recorded logs or
  scripted opponents, is prefix-valid only. It stops being valid as soon as the
  candidate diverges from the recorded trajectory. Candidates that diverge early need
  live adversarial evaluation with a modeled opponent/environment, not replay-only
  acceptance. State the divergence turn/point whenever citing replay evidence.
- **GATE-INVARIANT-EV-01 (DEFAULT):** Every hard invariant in an acceptance gate, meaning
  a metric that must not regress, needs an expected-value justification: the value it
  protects versus the candidate-space it vetoes. If a hard invariant vetoes three or
  more consecutive candidates that target strictly larger gains, downgrade it to a
  soft cost and re-justify or remove it.
- **GATE-HOLDOUT-LEAKAGE-01 (DEFAULT):** Fixed evaluation assets - recorded logs, test
  maps, sparring bots, graders, and even public oracle outcomes - become training data
  once candidates are repeatedly tuned against them (adaptive reuse overfits the
  holdout itself; Blum & Hardt's Ladder, arXiv:1502.04585, and the reusable-holdout
  line, arXiv:1506.02629). Rotate or expand the gate's instance set as tuning
  accumulates, and reserve a blind slice (instances never used for candidate
  selection) as the final acceptance check. A candidate that wins only on the tuned
  set and not on the blind slice is gate-overfit, not improved.
- **GATE-AGREEMENT-STATS-01 (HEURISTIC):** Calibrate a proxy against the scarce oracle
  with agreement statistics, not correlation alone: sign-discordance rate (proxy said
  better/equal, oracle said worse), mean and worst-case proxy-minus-oracle error, and
  rank agreement on paired decisions (Bland-Altman method-comparison doctrine). Track
  these per scenario family - a proxy can be trustworthy on one instance class and
  optimistic on another - and re-derive them whenever the oracle returns new results.

#!/usr/bin/env node
/**
 * codexclaw CLI entry (MVP stub).
 *
 * Planned commands:
 *   codexclaw status              show PABCD state + ocx detection
 *   codexclaw subagents [...]     view/edit subagent model & prompt config
 *   codexclaw provider <on|off>   toggle the opencodex provider bridge
 *   codexclaw gui                 launch the codexclaw web dashboard
 */
const cmd = process.argv[2] ?? "help";
switch (cmd) {
  case "status":
    console.log("codexclaw: MVP scaffold. PABCD state + ocx detection TBD.");
    break;
  case "gui":
    console.log("codexclaw: GUI launcher TBD (MVP step 05).");
    break;
  default:
    console.log("codexclaw <status|subagents|provider|gui>  (MVP scaffold)");
}

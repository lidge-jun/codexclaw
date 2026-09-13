# Logic Analysis — Comprehending an Unknown System

Read this when the task is to understand how a system works — a closed-source
app, an AI tool, an undocumented API, a protocol, an unfamiliar codebase —
and no defect is being fixed. Defects use the phases 0-4 method in
`../SKILL.md`; this reference is the same discipline aimed at comprehension.

Distilled from three reverse-engineering courses (mytechnotalent
Reverse-Engineering, wtsxDev reverse-engineering list, Z0FCourse) — analysis
with citations: `devlog/_plan/260913_logic_analysis_skill/001_analysis_synthesis.md`.

## The core rule

**"I can't analyze this" is a skipped loop, not a limit.** Missing source,
missing docs, and no debugger are *starting conditions*, not stop conditions
— professional reverse engineers begin from exactly there. Refusal is correct
only at the honest-limits boundary (§Honest limits). Everything short of that
is a routing problem: pick the technique family that fits the target and run
the loop.

## The Logic-Analysis Loop

1. **State the question precisely.** "How does X work" is not a question;
   "which endpoint charges the card, and what fields does it need" is. Decide
   what "understood" means — usually: you can predict or reproduce a behavior.
2. **Isolate the target.** Work in a sandbox/VM/copy where you can observe
   side effects (files, network, processes, DB rows) and revert mistakes.
3. **Acquire just enough domain language.** Learn the host vocabulary (ABI,
   data structure, protocol family) before reading deeply — otherwise every
   observation is unreadable. Do not front-load more than the next step needs.
4. **Inventory the public surface before internals.** Exports, routes,
   commands, config keys, UI actions — what is callable, what does each entry
   promise, what does calling it need? For a library you care about the
   exported functions first, not the internals.
5. **Slice; don't reverse the whole system.** Pick one function family, one
   route, one dialog. Prefer a semi-documented slice so you can check your
   work against an independent oracle. Simple functions first — they teach
   the conventions the hard ones use.
6. **Hypothesize from names, strings, and errors before the deep dive.**
   Skim for the general idea, then write a guess: "a Generic Table is
   probably a data structure; initialization will hint at its fields."
   Treat every reconstruction — including decompiler/LLM output and metadata
   labels — as a guess until observed evidence confirms it. Names lie.
7. **Observe: static AND dynamic.** Static: read the artifact as it sits
   (source, strings, headers, bundles, OpenAPI leftovers). Dynamic: run the
   smallest thing and watch (logs, proxy, `strace`/`dtruss`, added print
   statements, one `curl`). A static-only conclusion is a hypothesis; some
   questions are provably undecidable statically.
8. **Prove the model by using it.** Write the harness: a minimal client, a
   REPL call, a test that invokes the interface you think you understood.
   The loop closes when your client works — black-box observation has become
   a white-box model. Then re-verify after any mutation.

Run the loop per slice. Overwhelm is a chunking problem: break it down, name
one function/block/field, finish it, then the next.

## Controlled mutation (the "hack" step)

To learn a rule, change exactly one variable and re-observe:

- Flip one input field, one flag, one predicate — never five at once.
- Table the delta: status × body × side effect. Error strings are schema.
- Probe through input — it is the cheapest experiment: boundary values and
  wrong types map validation without any internals access. This is mapping,
  not attacking: stay within authorization (§Honest limits).
- Inject a unique canary (request id, filename, email) and watch which
  outputs echo it — that traces the data path with zero instrumentation.
- Compare two encodings of the same behavior (GUI vs CLI, SDK vs raw HTTP,
  x86 vs x64 build): the diff isolates what is essential from what is
  incidental.

## The incremental model

Keep written notes as you go — a running document, not memory:

- Maintain the reconstructed schema/struct/state machine with explicit
  `UNKNOWN` fields; fill them as evidence arrives.
- Rename things as you learn them ("endpoint X" → "createCharge"); never
  keep raw hashes in your head.
- Record rejected hypotheses and what rejected them — the final explanation
  must include the dead ends.
- Until contradicted, prefer the stupid-simple mechanism; keep an open mind
  and update the model the moment evidence contradicts it.

## Technique routing table

| Target | First moves | Agent-accessible tools |
|---|---|---|
| Unfamiliar open-source repo | README → entry point → one test/example run; trace one identifier end-to-end | grep/ast-grep, the repo's own tests, a 10-line harness |
| Undocumented HTTP API | Inventory via JS bundles/OpenAPI leftovers/`--help`; one known-good request; then one-field mutations | `curl`, browser devtools/HAR, mitmproxy, jq |
| Closed-source desktop/CLI app | Strings, config files, logs, `--help`, file/registry/network side effects of one action | `strings`, `file`, `fs_usage`/`dtruss`, process listing, a signed-in browser profile |
| Local binary artifact (structure) | Format identification → symbols/imports → disassembly slice | `file`, `nm`, `objdump`, `readelf`, radare2, capstone, scripted runs |
| Managed bytecode / APK | Decompile to source-like form, then read | jadx, apktool, dex2jar, oletools (docs), `pefile` |
| Live behavior of a running system | Syscall/FS/network trace; capture once, analyze offline | `strace`/`dtruss`, `lsof`, tcpdump, HAR/pcap capture |
| Automated reasoning about a small function | Encode and solve | z3/angr (programmable, no GUI) |

## Human-lab boundary (route honestly, never fake)

These need a specialist workstation or lab — say so instead of claiming the
technique or claiming impossibility: IDA/Ghidra GUI workflows, Sysinternals/
Procmon, Wireshark GUI analysis, Windows unpacker GUIs, Cuckoo-style malware
detonation, time-travel debuggers on a live target. The honest answer is
"this slice needs tool T on a lab machine; here is what I CAN establish from
here" — never "I can't", never a fabricated result.

## Anti-give-up escalation ladder

When stuck, climb — do not stop:

1. Shrink the example until the technique is visible (Hello-World-sized).
2. Re-read the actual error/artifact — every line, not a skim.
3. Form a hypothesis and design the check that would falsify it.
4. Run the check; a failed probe is information, try the second probe.
5. Drop one abstraction layer (SDK → raw HTTP → bytes) or rise one
   (bytes → strings → documented API).
6. Compare against a second implementation/version/encoding.
7. Capture a trace and analyze it offline instead of live.
8. Look it up — unknown instructions/fields are normal; external docs and
   the `search` skill are part of the loop.
9. Only now, report the exact blocking observation, what a human with tool T
   would do, and what is already established.

## Honest limits

- **Authorization**: analyze only systems you may analyze. Mapping input
  validation of your own service is fine; probing third-party systems,
  bypassing controls, or detonating malware is not in this skill's scope.
- **Hostile code**: never execute unknown binaries to observe them. Static
  inspection only, or hand to a lab.
- **Decompiler/LLM reconstructions are sketches, not evidence** — confirm by
  observation before claiming.
- Some truths are dynamic-only (representation chosen at runtime); some need
  the lab tools above. Name which case you are in.

## Vocabulary worth having

static analysis (artifact at rest) · dynamic analysis (running system) ·
breakpoint (controlled observation point — a log line counts) ·
import/export (the callable surface) · entry point (where execution really
starts — not `main`) · calling convention (who owns which argument) ·
canary (unique traceable input) · black-box → white-box (observe → model →
prove by using).

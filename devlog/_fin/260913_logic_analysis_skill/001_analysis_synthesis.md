# 001 — RE repo analysis synthesis

Raw material from three parallel explorer subagents (grok-4.6), one per clone.
Each section is the agent's verified return, kept with its `path:line` citations
into the `/tmp` clones. The distilled skill content lives in `010_wp1_skill_content.md`;
this file is evidence, not the deliverable.

---

## A. wtsxDev/reverse-engineering (awesome list) — agent d866486b

**Shape:** `README.md` + remark-lint `package.json` only. 16-section taxonomy
(`README.md:6`–`README.md:21`): Books, Courses, Practice, Hex Editors, Binary
Format, Disassemblers, Binary Analysis, Bytecode Analysis, Import Reconstruction,
Dynamic Analysis, Debugging, Mac Decrypt, Document Analysis, Scripting, Android,
Yara. No first-class "decompiler", "network analysis", or "dynamic
instrumentation" heading.

### Technique taxonomy → routing table (target → family → tools)

| Target / question | Family | Tools | Cite |
|---|---|---|---|
| Learn RE from scratch | Books | IDA Pro Book; RE for Beginners; Practical RE; Practical Malware Analysis; Windows Internals | `README.md:25`–`47` |
| Structured course | Courses | Open Security Training; Modern Binary Exploitation; RPISEC Malware; SANS FOR610 | `README.md:49`–`66` |
| Crackme/CTF practice | Practice | Crackmes.de; Flare-on; challenges.re (malware corpora carry explicit warning) | `README.md:68`–`85` |
| Raw bytes / patched constants | Hex Editors | HxD; 010; HexFiend; Hiew; hecate (terminal) | `README.md:87`–`96` |
| "What IS this file?" headers/packer/symbols | Binary Format | CFF; Detect It Easy; PeStudio; MachoView; `file`/`nm`/`codesign` | `README.md:98`–`110` |
| Machine code → asm/CFG | Disassemblers | IDA; GHIDRA; Binary Ninja; Radare; Hopper; Capstone; `objdump` | `README.md:112`–`123` |
| Automated reasoning / symbolic exec | Binary Analysis | z3; bap; angr | `README.md:125`–`132` |
| Managed bytecode → source-like | Bytecode Analysis | dnSpy; Bytecode Viewer; JPEXS | `README.md:134`–`141` |
| Packed PE import table | Import Reconstruction | ImpRec; Scylla; LordPE | `README.md:143`–`149` |
| Live host behavior | Dynamic (host) | Process Hacker/Explorer/Monitor; Autoruns; Noriben; API Monitor; Instruments | `README.md:151`–`161` |
| Live network of a sample | Dynamic (network) | iNetSim; SmartSniff; TCPView; Wireshark; Fakenet | `README.md:162`–`165` |
| Memory image | Dynamic (memory) | Volatility; Dumpit; LiME | `README.md:166`–`168` |
| Detonate + behavioral report | Dynamic (sandbox) | Cuckoo | `README.md:169` |
| POSIX/macOS syscall/FS trace | Dynamic (OS trace) | `dtrace`/`dtruss`; `fs_usage`; `dmesg` | `README.md:172`–`174` |
| Step/breakpoint/emulate | Debugging | WinDbg; OllyDbg; x64dbg; gdb; lldb; qira; unicorn | `README.md:176`–`192` |
| Encrypted macOS/iOS binary | Mac Decrypt | class-dump `-deprotect`; readmem | `README.md:194`–`201` |
| Hostile Office/PDF | Document Analysis | oletools; Didier Stevens PDF tools; Origami | `README.md:203`–`209` |
| Automate IDA / parse PE | Scripting | IDAPython; IDC; `pefile` | `README.md:211`–`222` |
| Android APK | Android | apktool; dex2jar; JaDx | `README.md:224`–`233` |
| Pattern-hunt samples | Yara | Yara; yarGen | `README.md:235`–`242` |

### Agent-accessible subset (shell + browser + editor only)

Driveable CLI slice: `file`/`nm`/`codesign` (`README.md:108`–`110`); `objdump`/
Radare/Capstone (`README.md:119`–`122`); z3/bap/angr (`README.md:130`–`132`);
gdb/lldb/unicorn (`README.md:188`–`192`); `dtrace`/`fs_usage`/`dmesg`
(`README.md:172`–`174`); Volatility on existing dumps (`README.md:166`);
oletools/PDF tools (`README.md:207`–`209`); `pefile` (`README.md:222`);
apktool/dex2jar/JaDx (`README.md:229`–`233`); Yara (`README.md:239`–`241`);
hecate (`README.md:96`); class-dump/readmem (`README.md:200`–`201`).

GUI/lab-bound (never pretend available): IDA/GHIDRA/Binary Ninja/Hopper GUIs
(`README.md:116`–`120`); Sysinternals suite + API Monitor (`README.md:155`–`160`);
Wireshark/SmartSniff/TCPView (`README.md:163`–`164`); Cuckoo (`README.md:169`);
WinDbg/Olly/x64dbg (`README.md:180`–`187`); IDAPython track (`README.md:215`–`221`).

Agent-native stand-ins the list does NOT name: `strings`/`grep`/`readelf`,
HTTP capture via `curl`/mitmproxy/`tcpdump`, added logging, black-box API
probing — the usual "how does X work" tools; this README is a binary-malware
map, not an application-logic map.

### Learning-path resources (signal-ranked)

1. RE for Beginners (free) `README.md:31`
2. Radare2 Book (CLI-native) `README.md:30`
3. Open Security Training `README.md:54`
4. Modern Binary Exploitation (RPI) `README.md:59`
5. RPISEC Malware Course `README.md:60`
6. Practical Reverse Engineering `README.md:33`
7. Practical Malware Analysis `README.md:35`
8. Reversing: Secrets of RE `README.md:34`
9. The IDA Pro Book `README.md:29`
10. Offensive/Defensive Android Reversing (DEF CON PDF) `README.md:66`

### Gaps (what the list assumes an agent lacks)

1. Human at a RE workstation (GUI products throughout).
2. Local binary/sample access — no SaaS/closed-API/production-service category.
3. Permission to run hostile code (`README.md:70`, `79`–`85`, `155`–`169`).
4. Windows malware lab (and often Mac lab).
5. IDA as the automation bus.
6. **No source-available lane** — reading source/symbols/logs/tests/docs never
   listed (`README.md:7`–`21`), yet it is an agent's FIRST method.
7. **No web/JS/protocol-RE family** — network = fake-Internet + sniffing for
   malware, not HTTP API mapping / source maps / DevTools.
8. No named dynamic-instrumentation family (no Frida/Pin/DynamoRIO; closest
   API Monitor `README.md:160`, `dtrace` `README.md:172`).
9. Decompilation not first-class.
10. Books often paid; prefer beginners.re/radare book/OST/RPISEC.
11. Sandbox/memory work needs lab VMs.
12. Yara answers "have I seen this?" not "how does the logic work?"

**Routing rule (agent):** local native/APK/Office artifact + structure/decompile
question → CLI slice (format → `objdump`/r2 → jadx/oletools → angr/gdb). Live
Windows malware behavior → human GUI lab; answer honestly, not "I can't".

---

## B. mytechnotalent/Reverse-Engineering — agent 02680c08

**Shape correction:** not per-lesson markdown — `README.md` is a 527+ lesson
catalog; lesson bodies live in bundled PDFs. Local code is a thin Windows
x86/x64 sample set. The transferable method is a repeated loop:
**smallest runnable surface → observe live state → change one thing →
re-observe** ("Program → Debug → Hack" triad, `README.md:253`–`264`).

### 14 methodology principles (each with repo evidence)

1. **Pair a dead listing with a live run** — static vs dynamic split
   (`README.md:153`, `1196`, `1201`).
2. **Start from the smallest runnable surface** — every architecture opens on
   Hello World (`README.md:253`, `546`, `993`, `1092`, `1191`;
   `0x0001-hello_world-x86/main.asm:13`).
3. **Program → Debug → Hack triad per primitive** — produce it, watch the
   state, mutate one value/branch, confirm (`README.md:253`–`264`, cloned
   across ARM/x64/Pico/Windows/RISC-V; "hack" = controlled mutation to test a
   causal hypothesis).
4. **Follow one value through every store** — immediate → register → memory →
   output (`README.md:253`–`313`; `0x0013-readfile/main.c:8`–`64`).
5. **Treat public interfaces as contracts** — annotate the visible boundary
   from official docs/datasheet before guessing internals
   (`0x0001-hello_world-x86/main.asm:14`–`20`; `README.md:804`, `1625`).
6. **Observable side effects are ground truth** — success/fail prints, bytes
   on disk, stdout (`0x0006-directories/main.c:8`–`14`; `README.md:998`).
7. **Compare two encodings of the same behavior** — x86 vs x64 twins, C vs asm
   blink (`README.md:1196`–`1237`, `1844`/`1849`, `2032` vs `2186`).
8. **Mutate one control-flow decision, re-run** — invert one predicate, watch
   which path fires (`README.md:969`, `1008`–`1018`, `1750`–`1775`).
9. **Inspect the artifact, not only the source story** — on-disk ≠ mapped;
   strings/ELF first, then live attach (`README.md:183`, `238`, `934`,
   `998`, `1571`).
10. **Walk initialization in dependency order** — Reset_Handler line-by-line,
    "why order matters" (`README.md:2032`, `2061`, `2196`).
11. **Probe through input — the cheapest experiment** — map validation/error
    strings/success paths without a debugger (`README.md:1008`–`1018`,
    `1167`–`1182`).
12. **Decompose into independently testable stages** — four build stages, one
    API per chapter (`README.md:2012`, `2355`, `2047`–`2057`, `1216`–`1316`).
13. **Drop one abstraction layer when stuck** (or go one up) — C→asm,
    docs→bytes, SDK→MMIO (`README.md:238`, `551`, `934`, `1844`/`1849`,
    `2151`).
14. **Analyze line-by-line / function-by-function** — never "the binary"
    (`README.md:2839`, `2847`, `2022`, `1097`, `934`).

### Agent-translatable techniques (closed app / undocumented HTTP API / unfamiliar OSS)

- Static+dynamic both before concluding "can't see inside": strings/imports/
  configs + one happy-path run recording UI text/logs/files/HTTP.
- Smallest surface: one menu item / `GET /` only / `examples/`+`main()`.
- Triad for APIs: known-good request → record response → flip ONE field and
  table the delta ("hack the validation", `README.md:1018`).
- Follow one value: inject a unique canary (req-id, filename) and watch which
  response fields echo it (`0x0013-readfile/main.c:8`,`64`).
- Contracts: write a request/response schema from samples like reading a
  datasheet first (`README.md:1625`).
- Ground truth: status code + dependent second request; tests/logs/real run
  beat comments (`README.md:2061`).
- Two encodings: GUI vs CLI vs mobile; SDK vs raw HTTP vs second client.
- One-branch mutation: omit auth / wrong content-type / empty array → map
  error strings (`README.md:1013`).
- Artifact vs story: saved OpenAPI vs actual traffic — clients lie, HAR doesn't.
- Init order: CSRF cookie → login → token → resource; never start at the
  resource.
- Probe through input as *mapping*, not attack: table status × body.
- Stages: auth, pagination, create, get, delete — separately.
- Drop a layer: SDK method → raw HTTP → TLS SNI; docs → source → generated
  code → bytes.
- One route's full error matrix before the next route.

### 11 anti-give-up patterns

1. Next lesson is never "you're done" — program→debug→hack structure forbids
   stopping at "I read it" (`README.md:253`–`264`, `417`–`472`).
2. Shrink the example until a technique is visible (`README.md:551`).
3. Hypothesis + falsifying check ("verify our hypothesis", `README.md:998`).
4. Confused → regress one layer, never invent (`README.md:934`, `551`).
5. Re-run the same observation after mutation (`README.md:939`, `964`, `969`).
6. One failed probe ≠ impossible — try a second breakpoint/hack
   (`README.md:571`).
7. Homework pattern: method transfers to the next slot (`README.md:964`).
8. **Missing docs/source is a starting condition, not a stop condition**
   (`README.md:551`, `238`).
9. Overwhelm is a chunking problem — "break it down" (`README.md:934`,
   `1097`, `1013`).
10. Budget a troubleshooting pass; first bring-up is expected to fail
    (`README.md:2216`, `2370`, `2832`).
11. ANY program is in scope once the tools exist (`README.md:253`).

### Leave out

ISA furniture (registers/encodings), debugger keystroke recipes, boot-media/
chip bring-up trivia, malware taxonomy as a goal, tool installers,
electronics, STUXNET narratives, ASLR/opcode tables (keep only "runtime
addresses move" + "on-disk ≠ mapped"), capstone door-hack scenario.

**Bottom line:** smallest observable → static artifact + one live run →
follow one value/contract → change one input or branch → re-check a side
effect → drop a layer or shrink the example if stuck.

---

## C. 0xZ0F/Z0FCourse_ReverseEngineering — agent cd728d53

**Shape:** no single numbered checklist; the process is *demonstrated* across
Chapters 4–8. Theory transfers off Windows, tools/ABI do not (`README.md:3`,
`@BeforeYouBegin.md:11`). `Lingo.md` is 24 lines and does NOT define
static/dynamic analysis — those live in `Chapter 4 - Tools/4.1 ToolTypes.md:42-45`.

### The 13-step RE process (demonstrated, cited)

1. **State the goal, isolate the target** — "If we want to use the DLL, we
   will need to know how it works" (`Chapter 6 - DLL/6.01 BeforeWeBegin.md:5`);
   VM to observe "network traffic, disk usage, registry modifications" and
   revert (`Chapter 1 - Introduction/1.2 Setup.md:16`); tools interchangeable,
   method isn't (`1.2 Setup.md:11`, `Chapter 4 - Tools/4.0 Tools.md:3`).
2. **Don't start grinding the lowest representation** — goal is not "smash
   your head against assembly"; use tools, log calls, write own code
   (`README.md:34`); advanced skill comes from experience (`README.md:3`).
3. **Acquire just enough domain language first** — host language/ABI before
   reversing (`Chapter 1 - Introduction/1.0 Introduction.md:18-21`,
   `Chapter 5 - BasicReversing/5.1 BeforeWeBegin.md:7`); learn the
   data-structure topic first or be "very confused"
   (`Chapter 8 - Generic Table/8.04 GetElement.md:51`).
4. **Inventory the public surface before internals** — "we don't care too much
   about what's going on internally. What we care about is what exported
   functions are available, what do they do, what do we need to call them"
   (`Chapter 6 - DLL/6.03 Exports.md:3`, `6.03:7`,
   `Chapter 4 - Tools/4.1 ToolTypes.md:38`).
5. **Don't reverse the whole system** — slice to a function family, pick
   "semi-documented (so we can check our work)"
   (`Chapter 8 - Generic Table/8.00 GenericTable.md:3`); order = whatever
   yields information (`8.04 GetElement.md:3`).
6. **Start from names/strings/known artifacts; find the real entry** — string
   refs when symbols missing (`Chapter 5 - BasicReversing/5.3
   HelloWorld.md:36`); entry ≠ `main()` (`5.3:24-26`); guess type from name,
   start at initialization which "will hint at what a table contains"
   (`Chapter 8 - Generic Table/8.01 InitializeTable.md:3-5`); simple functions
   first (`8.02 NumberGenericTableElements.md:3`).
7. **Skim for general idea, hypothesize BEFORE deep dive** — (`Chapter 6 -
   DLL/6.04 SayHello.md:3`, `6.06 InitializePlayer.md:87`, `8.02:5`,
   `8.04:55`).
8. **Read statically, treat reconstructions as guesses** — disassembly is "the
   backbone" (`4.1 ToolTypes.md:13`); "never trust decompiler data types"
   (`4.1:23`); metadata lies: `__cdecl` label, fastcall body (`Chapter 6 -
   DLL/6.05 PrintArray.md:21-33`); "we wouldn't actually know for sure"
   (`5.3:50`).
9. **Ignore scaffolding; keep the big picture** — skip security cookies,
   prologues, instruction variants (`5.3:27-28`, `5.3:62`, `5.2
   FunctionCall.md:8`, `6.07 PrintPlayerStats.md:11`); "focus on the bigger
   picture" (`8.01:3`, `6.05:17`).
10. **Write notes/labels/incremental model with UNKNOWN fields** — rename
    found functions (`5.3:52`); "write comments and take notes"
    (`6.06:256`); pseudo-code while reversing (`8.04:64`); `UNKNOWN`/
    `UNKNOWN_PTR` layout updated as evidence arrives (`8.01:89-101`,
    `8.02:16-32`).
11. **Test hypotheses with observation, comparison, numbers** — side-effect
    breakpoint test ("extremely likely we are correct", `5.3:123`);
    comparison programs + graph diff (`6.04:22`, `5.3:125`); escalation
    ladder: multiple tools → execute and watch → fully reverse (`5.3:64`);
    plug test values (`8.04:133`); static provably insufficient for some
    questions — class vs array needed dynamic (`Chapter 6 - DLL/6.08
    MysteryFunc.md:112`).
12. **Keep an open mind; update on contradiction** — (`8.01:38`, `8.01:58`,
    `8.02:16`, `8.04:201`).
13. **Close the loop by USING the reconstructed interface** — reverse the DLL
    AND "write a program that can use it" (`6.01:5`, `6.00 DLL.md:3`);
    "Hello! printed as we guessed" (`6.04:84`); "We nailed it!" vs source
    (`6.06:252`). Black-box → white-box.

### Mindset rules

- Computers don't assume; don't invert the spec ("even→red" ≠ "red→even";
  unspecified = anything) (`Chapter 2 - BinaryBasics/2.6 Mindset.md:3`,
  `18-24`).
- Opaque blobs become intelligible with the template: "Protocols are simply
  templates" (`2.6:28-37`); delimiters exist because computers are literal
  (`2.6:39`).
- Prefer the stupid-simple mechanism (compare = subtract, `2.6:43`).
- Confusion is normal; persistence is the method (`5.1 BeforeWeBegin.md:9`,
  `6.06:256`, `8.04:486`).
- No dumb questions; silent failure is the dumb move (`5.1:11`, `Chapter 6 -
  DLL/6.10 FinalNotes.md:3`).
- **You don't need to understand everything on screen** (`Chapter 4 -
  Tools/4.3 ToolGuides.md:82-83`, `5.2:8`, `5.3:68`, `Chapter 7 -
  Windows/7.4 API.md:18`).
- Don't trust names/decorations/decompilers as ground truth (`6.05:21`,
  `4.1:23`).
- Tools beat brute-force reading (`README.md:34`, `4.1:40`).
- Puzzle from fragments, not a linear read (`6.05:100`, `6.08:114`).
- Write your own programs and reverse them (`5.3:163`, `6.10:3`).
- Look things up; unknown instructions are normal (`Chapter 8 - Generic
  Table/8.03 IsGenericTableEmpty.md:20`, `Chapter 3 - Assembly/3.6
  FinalNotes.md:7`).
- Difficulty expected; needless difficulty isn't (`README.md:40`). "I can't
  analyze this" usually = refusing the loop, not hitting a real stop.

### Observation toolkit → agent equivalents (selected)

- Static = on-disk, not running (`4.1:44`) → docs/headers/OpenAPI/source/
  `strings`/`file`/`nm`; reading a library you never invoke is still static.
- Dynamic = running in memory (`4.1:45`) → run the CLI/server, `curl`, watch.
- Decompiler = untrusted hint (`4.1:23`) → LLM/type-inference reconstructions
  are sketches, not evidence.
- Surface utilities (DUMPBIN exports, `4.1:38`, `6.03:7`) → `curl -I`,
  OpenAPI, `npm ls`, `--help`, HAR entry points.
- String/reference search (`5.3:36`) → grep error strings/log lines to find
  emitters.
- Breakpoint = controlled observation (`4.2 Debugging.md:5`) → log line before
  the call, proxy breakpoint on one route.
- Step into/over/out (`4.2:11-13`) → read handler vs one `curl` black-box vs
  return to caller.
- Log calls / own logger (`README.md:34`) → verbose flags, HTTP proxy,
  wrapper SDK, request-id logs, `strace`/`dtruss`.
- Trace then analyze offline (`4.3:34`) → capture HAR/pcap once, reason on
  the recording.
- Graph/CF compare (`6.04:22-32`, `5.3:125`) → diff two traces/SDK versions/
  minimal repro vs unknown.
- Harness/loader to invoke the surface (`6.01:13-19`, `6.04:96-107`) →
  minimal client/fixture/REPL that actually calls the API.
- Plug numbers / walk paths (`8.04:133`, `220-226`) → table-driven inputs
  forcing each branch.
- Notes/labels (`4.3:22`, `5.3:52`) → rename "endpoint X" as you learn.
- Environment observers (`1.2:27`, `1.2:16`) → `strace`, `lsof`, mitmproxy,
  fs watch.
- Xrefs / find callers (`5.3:129`) → who calls this function / hits this
  route.

Black-box → white-box: observe outputs → guess types/layout → write a client →
refine dynamically when static can't distinguish (`5.3:123`, `8.01:89-101`,
`6.04:84`, `6.08:112`).

### Vocabulary (real terms live in Ch.4, not Lingo)

Lingo: WIP/TODO (don't freeze models on stubs), x64 vs x86 (ABI/pointer
size/tools differ), JRE/JVM/CLR/JIT/MSIL/IL (static view ≠ executed stream).
Teach from Ch.4: **static analysis** (`4.1:44`), **dynamic analysis**
(`4.1:45`), **breakpoint** (`4.2:5`), **import/export** (`Chapter 6 -
DLL/6.02 DLLBasics.md:12-15`), **entry point** (`5.3:26`), **calling
convention** (`Chapter 3 - Assembly/3.5 CallingConventions.md:3`).

### Leave out

Windows/x64 lock-in (`README.md:3`, `@BeforeYouBegin.md:11`), fastcall/shadow
space/XMM lanes, MSVC mangling/decorations, specific tools (x64dbg/Ghidra/
DUMPBIN...), Intel syntax/PE loaders/WOW64, CRT noise, WinAPI A/W/Ex naming,
NTDLL Generic Table internals, endianness trivia, "avoid the documentation"
pedagogy (`8.00:5` — agents SHOULD use docs; the transferable move is checking
against an independent oracle), malware-lab/exploit content.

**Transferable core:** isolate → inventory the callable surface → hypothesize
from names/strings/errors → observe with breakpoint-or-log + comparison
harness → keep UNKNOWN fields → update when contradicted → prove the model by
calling it.

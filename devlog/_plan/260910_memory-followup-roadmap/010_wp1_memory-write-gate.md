# 010 — wp1: memory-write gate 오탐 (목적지 기준 셸 분류)

날짜: 2026-09-10 (KST). 워크트리 `/Users/jun/.codex/worktrees/3412/codexclaw`, 브랜치 `codex/memory-l1-wp0-roadmap`, HEAD `369ed0e1`. 이 문서는 계획이다. 이 파일 외에 코드·훅·테스트를 바꾸지 않았다.

근거: `000_plan.md` wp1, `notes/03_hook-runtime-audit.md` §4–§6 (000_plan이 §3으로 가리킨 게이트 본문; 현재 파일에서 §3은 PostCompact), `notes/08_carryover-backlog.md` E6/E7 (`:170-171`), `notes/00_brief.md` 라이브 heredoc. 소스 행 번호는 2026-09-10 재확인.

## 1. 목적과 범위

목적: #102 게이트가 메모리 파일을 읽는 셸과, 쓰기 목적지는 메모리 밖인데 본문에 메모리 경로 문자열이 있는 셸을 쓰기로 분류하는 오탐을 없앤다. 셸 분류 단위는 명령 문자열이 아니라 쓰기 목적지 경로다.

IN

- `plugins/codexclaw/components/pabcd-state/src/memory-write-gate.ts` 셸 분기. `shellPathTokens` (156-170행)와 write-verb 정규식 (210-218행)을 목적지 추출로 교체.
- 쓰기 형태: stdout 리다이렉션 `>`/`>>` (fd 생략 또는 1), `tee`, `sed -i`/`--in-place`, `cp`/`mv`의 대상 경로, `perl -i`/`ruby -i` in-place. 그 경로가 `memoriesRoot` 아래일 때만 `surface:"shell"`.
- stderr 리다이렉션 (`2>/dev/null`, `2>>`)과 입력 heredoc (`<<`, `<<<`)은 목적지가 아니다. `sed -n` 등 `-i` 없는 sed는 읽기다.
- 픽스처 5종 + 라이브 heredoc 재현 + 기존 11개 테스트 유지.
- 툴 표면(`MEMORY_WRITE_TOOL_NAMES`)과 편집 표면(`apply_patch`/`Write`/`Edit` + `patchTargets`)은 그대로.
- `docs-site/src/content/docs/reference/hooks.md` Pre-tool guards에 목적지 분류를 적는다 (000_plan wp1 문서 항목).
- 같은 커밋에 `npm run build`로 `dist/memory-write-gate.js`를 맞춘다.

OUT

- 훅 JSON matcher 변경. 현재 `^(memories[._]?add_ad_hoc_note|apply_patch|Write|Edit|Bash)$` (`pre-tool-use-guarding-memory-write.json:13`). JSON 바이트를 바꾸면 `trusted_hash` 입력이 달라지고 (`structure/40_enforcement_methods.md:35-39`) 재신뢰가 필요하다. 라이브 오탐이 이미 이 matcher로 발생했으므로 (`notes/03` §4 항목 9, 메인 세션 L97-98) 분류만 고치면 된다. `SHELL_TOOLS`의 `exec_command`/`shell`/`local_shell` (`memory-write-gate.ts:68`)은 훅이 호출된 뒤의 분류 집합이다.
- `rm`/`touch`/`mkdir`/`dd`/`install` 동사 복원. 현재 정규식(`:212`)이 이들을 쓰기로 본다. 라이브 오탐 명령이 `mkdir -p`를 포함하지만 실제 원인은 `>` + 본문 토큰이다 (`notes/03` §5). 이번 사이클은 사용자 열거 형태만 목적지로 본다. 나머지는 §8 잔여 우회.
- 완전한 셸 파서, 변수 확장, 서브셸 전개, `python -c`/`node -e` 쓰기.
- 호스트 Phase 2 writer 차단 (260909 `000_plan.md:313`).
- `how-it-works.md` PreToolUse x6→x7 (wp3).
- `detectMemoryWriteRequest` 관용구, 승인 consume, fail-open, deny 봉투 스키마.

성공 기준: 아래 5 픽스처가 `classifyMemoryWrite`에서 기대 surface를 내고, 기존 c-2 테스트 11개가 유지되며, `dist-freshness`가 `memory-write-gate.js`를 포함해 통과한다.

## 2. 현재 코드

셸 분류는 두 단계다. 먼저 명령 문자열 아무 곳에 쓰기 표시가 있는지 정규식으로 보고 (`:212`), 있으면 `memories` 부분문자열이 들어 있는 토큰을 전부 목적지로 승격한다 (`:163-169`, `:215-217`). 주석(`:157-161`)이 이미 "리다이렉션을 모델링하지 않고 넓게 모은다"고 적는다. 파일 머리 주석(`:17-18`)이 말하는 정책("destination is under ~/.codex/memories")과 구현이 어긋난다.

`plugins/codexclaw/components/pabcd-state/src/memory-write-gate.ts:156-219`:

```ts
/**
 * Shell tokens that could name a write destination. Deliberately BROAD and
 * path-shaped: it collects every token that mentions a memories path rather than
 * modelling redirection, `tee`, `sed -i` and friends separately. Over-collection is
 * safe here — the caller still requires the token to resolve under the memories
 * root, and the remedy for a false deny is one CLI grant.
 */
export function shellPathTokens(command: string): string[] {
  const out: string[] = [];
  for (const token of command.split(/[\s;|&()<>]+/)) {
    const cleaned = token.replace(/^["']|["']$/g, "");
    if (cleaned.includes("memories")) out.push(cleaned);
  }
  return out;
}

  if (SHELL_TOOLS.has(toolName)) {
    const command = typeof toolInput.command === "string" ? toolInput.command : "";
    if (command === "") return { surface: "", target: "" };
    if (!/>>?|\btee\b|\bsed\b|\bcp\b|\bmv\b|\brm\b|\btouch\b|\bmkdir\b|\bdd\b|\bteee?\b|\bwrite\b|\binstall\b/.test(command)) {
      return { surface: "", target: "" };
    }
    for (const token of shellPathTokens(command)) {
      const abs = absolutize(token, cwd);
      if (isMemoryPath(abs, root)) return { surface: "shell", target: abs };
    }
  }
```

오탐 경로 (재확인한 행, `notes/03` §5와 일치).

| 입력 | 정규식 `:212` | 토큰 `:165-167` | 결과 |
|---|---|---|---|
| `sed -n '1p' <root>/MEMORY.md` | `\bsed\b` 히트 | MEMORY.md 경로 | deny. E6 (`08:170`) |
| `rg foo <root>/MEMORY.md 2>/dev/null` | `>>?`가 `2>`의 `>`에 히트 | memories 루트 | deny. `notes/03` §4 항목 5 |
| `print('x -> y')` + Path(MEMORY.md) | `->`의 `>` | MEMORY.md | deny. `notes/03` §4 항목 2, §6 표 |
| `rg '<prose>' <root>/MEMORY.md` | `<prose>`의 `>` | MEMORY.md | deny. `notes/03` §4 항목 6 |
| devlog heredoc, 본문에 `~/.codex/memories` | `mkdir`와 `>` 둘 다 | 본문 경로 → 루트 | deny. E7 (`08:171`), `notes/00_brief.md`, 메인 세션 L97-98 |

`split(/[\s;|&()<>]+/)`는 괄호·꺾쇠를 구분자로 써서 `Path('~/.codex/memories/MEMORY.md')`에서 절대 경로가 따로 떨어진다 (`notes/03` §5). `isMemoryPath` (`:119-123`)는 그 토큰이 루트 아래이면 히트한다. 실제 쓰기 파일이 워크트리여도 본문 문자열이 루트를 가리키면 루트가 `target`이 된다.

통과하는 현재 테스트는 cat/rg와, 목적지가 명시된 echo 리다이렉트뿐이다 (`memory-write-gate.test.ts:174-182`). sed -n, stderr 꺾쇠, 본문-only heredoc은 없다.

건드리지 않는 표면: 툴 `MEMORY_WRITE_TOOL_NAMES` (`:59-64`, `:188-193`, 테스트 `:48-61`, `:63-78`); 편집 `EDIT_TOOLS` (`:67`) + `patchTargets` (`:142-154`, `:196-204`, 테스트 `:161-172`); 훅 엔트리 `cli.ts:367-373`; matcher JSON `:13`; 승인 `consumeAuthorization` (`:257-279`); fail-open `:312-314`.

## 3. 변경 파일 맵

| 파일 | NEW/MODIFY/DELETE | 변경 요지 | 예상 줄수 |
|---|---|---|---|
| `plugins/codexclaw/components/pabcd-state/src/shell-write-destinations.ts` | NEW | §4.1의 목적지 파서 전체(`splitShellSegments`, `skipQuoted`, `skipHeredoc`, `readToken`, `redirectDestinations`, `verbDestinations`, `shellWriteDestinations` export). 순수 함수, import 없음 (A/B8 분리) | ~300 |
| `plugins/codexclaw/components/pabcd-state/src/memory-write-gate.ts` | MODIFY | `shellPathTokens`·write-verb 정규식 삭제. `import { shellWriteDestinations } from "./shell-write-destinations.ts"`. 셸 분기가 그 목록만 `isMemoryPath`로 본다 | 삭제 ~25, 추가 ~10 |
| `plugins/codexclaw/components/pabcd-state/test/shell-write-destinations.test.ts` | NEW | 파서 단위 케이스: 공백 없는 `>`/`>>`/`>|`, `->`, 따옴표, heredoc, `2>/dev/null`, `&>`, tee/cp/mv/sed -i/perl -i | ~120 |
| `plugins/codexclaw/components/pabcd-state/dist/shell-write-destinations.js` | NEW | `npm run build` 산출, src와 같은 커밋 | compileSource 결과 |
| `plugins/codexclaw/components/pabcd-state/test/memory-write-gate.test.ts` | MODIFY | 기존 11케이스 유지. 셸 테스트 확장: 픽스처 5종, 라이브 heredoc, `->`/`<prose>`, tee/cp/mv/perl -i, exec_command 동일 분류 | +95 |
| `plugins/codexclaw/components/pabcd-state/dist/memory-write-gate.js` | MODIFY | `npm run build` (`package.json` scripts.build → `plugins/codexclaw/scripts/build.mjs`). src와 같은 커밋 | compileSource 결과, src와 동기 |
| `docs-site/src/content/docs/reference/hooks.md` | MODIFY | Pre-tool guards에 memory-write 목적지 분류 한 항목. 표 matcher는 그대로 | +8 |
| `plugins/codexclaw/hooks/pre-tool-use-guarding-memory-write.json` | 변경 없음 | matcher·command·timeout 유지 | 0 |

`dist/cli.js`는 `handleMemoryWriteGate`를 import만 하므로 이 변경으로 바이트가 안 바뀐다. freshness는 파일 단위 (`dist-freshness.test.mjs:35-47`).

신규 직렬화 필드 없음. PLAN-FIELD-CHAIN-01: `shellWriteDestinations`는 프로세스 안 순수 함수 → `classifyMemoryWrite` → `handleMemoryWriteGate`가 기존 deny 봉투(`:237-245`, camelCase `permissionDecision`)를 그대로 쓴다. creation/serialization/deserialization/consumer 체인 추가 없음 (N/A).

## 4. 변경 상세

### 4.1 `memory-write-gate.ts` — `shellPathTokens` 교체

before (`:156-170`, `:207-219`): §2 인용과 동일. `export function shellPathTokens`를 지운다. 이 이름을 다른 파일이 import하지 않는다 (워크트리 rg, 2026-09-10).

after (A/B8 분리 기준): 아래 TS 블록은 **새 파일 `src/shell-write-destinations.ts` 전체**다(순수 함수, import 없음). `memory-write-gate.ts`에서는 (a) `:156`–`:170`의 `shellPathTokens`와 `:157-161` 주석을 삭제하고, (b) 상단 import에 `import { shellWriteDestinations } from "./shell-write-destinations.ts";`와 그 아래 `export { shellWriteDestinations } from "./shell-write-destinations.ts";`(re-export, 기존 테스트 파일이 같은 모듈에서 가져오기 위함)를 추가하며, (c) `classifyMemoryWrite`의 셸 분기(`:207-219`)만 이 절 말미의 after 블록으로 바꾼다. 게이트의 다른 import(`node:os` / `node:path` / `./state.ts` / `./text-lines.ts`)는 그대로다. `worktree-guard.ts` tokenizer는 heredoc 본문을 건너뛰지 않아 (`worktree-guard.ts:219-253`) 여기로 가져오지 않는다.

```ts
/**
 * Write destinations named by a shell command. Quote- and heredoc-aware.
 * A memories path that appears only in a heredoc body, a quoted pattern, or
 * an argument that is not the write target is ignored.
 *
 * Counted as writes: stdout redirect `>`/`>>` (fd omitted or 1), `tee`
 * operands, `sed -i`/`--in-place` file operands, `cp`/`mv` destination,
 * `perl -i`/`ruby -i` file operands.
 * Not writes: `2>`/`2>>`, `<<` heredoc, `<<<` herestring, `sed -n`.
 */
export function shellWriteDestinations(command: string): string[] {
  const dests: string[] = [];
  for (const segment of splitShellSegments(command)) {
    dests.push(...redirectDestinations(segment));
    dests.push(...verbDestinations(segment));
  }
  return dests;
}

function splitShellSegments(command: string): string[] {
  const segments: string[] = [];
  let cur = "";
  let i = 0;
  while (i < command.length) {
    const ch = command[i];
    if (ch === "'" || ch === '"') {
      const next = skipQuoted(command, i);
      cur += command.slice(i, next);
      i = next;
      continue;
    }
    if (ch === "<" && command[i + 1] === "<" && command[i + 2] !== "<") {
      const next = skipHeredoc(command, i);
      cur += command.slice(i, next);
      i = next;
      continue;
    }
    if (ch === "|" && i > 0 && command[i - 1] === ">") {
      // `>|` clobber redirection: keep the bar inside the current segment.
      cur += ch;
      i++;
      continue;
    }
    if (ch === ";" || ch === "|" || (ch === "&" && command[i + 1] === "&")) {
      if (cur.trim() !== "") segments.push(cur);
      cur = "";
      if (ch === "&") i++;
      if (ch === "|" && command[i + 1] === "|") i++;
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  if (cur.trim() !== "") segments.push(cur);
  return segments;
}

function skipQuoted(s: string, i: number): number {
  const q = s[i];
  i++;
  while (i < s.length) {
    if (q === '"' && s[i] === "\\" && i + 1 < s.length) {
      i += 2;
      continue;
    }
    if (s[i] === q) return i + 1;
    i++;
  }
  return i;
}

function skipHeredoc(s: string, i: number): number {
  i += 2;
  if (s[i] === "-") i++;
  while (i < s.length && /\s/.test(s[i])) i++;
  let delim = "";
  if (s[i] === "'" || s[i] === '"') {
    const q = s[i++];
    const start = i;
    while (i < s.length && s[i] !== q) i++;
    delim = s.slice(start, i);
    if (s[i] === q) i++;
  } else {
    const start = i;
    while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) i++;
    delim = s.slice(start, i);
  }
  if (delim === "") return i;
  while (i < s.length && s[i] !== "\n") i++;
  if (i < s.length) i++;
  while (i < s.length) {
    const nl = s.indexOf("\n", i);
    const line = nl === -1 ? s.slice(i) : s.slice(i, nl);
    if (line === delim) return nl === -1 ? s.length : nl + 1;
    i = nl === -1 ? s.length : nl + 1;
  }
  return i;
}

function readToken(s: string, i: number): { token: string; next: number } {
  while (i < s.length && /\s/.test(s[i])) i++;
  if (i >= s.length) return { token: "", next: i };
  if (s[i] === "'" || s[i] === '"') {
    const q = s[i];
    const start = i + 1;
    const end = skipQuoted(s, i) - 1;
    return { token: s.slice(start, Math.max(start, end)), next: end + 1 };
  }
  const start = i;
  while (i < s.length && !/\s/.test(s[i])) i++;
  return { token: s.slice(start, i), next: i };
}

function redirectDestinations(segment: string): string[] {
  const dests: string[] = [];
  let i = 0;
  while (i < segment.length) {
    const ch = segment[i];
    if (ch === "'" || ch === '"') {
      i = skipQuoted(segment, i);
      continue;
    }
    if (ch === "<" && segment[i + 1] === "<") {
      if (segment[i + 2] === "<") {
        const r = readToken(segment, i + 3);
        i = r.next;
        continue;
      }
      i = skipHeredoc(segment, i);
      continue;
    }
    if (ch !== ">") {
      i++;
      continue;
    }
    let k = i - 1;
    let fd = "";
    if (k >= 0 && segment[k] === "&") {
      fd = "&";
      k--;
    } else {
      while (k >= 0 && segment[k] >= "0" && segment[k] <= "9") k--;
      fd = segment.slice(k + 1, i);
    }
    const before = k < 0 ? "" : segment[k];
    // A1 (audit round 1): no token-boundary requirement. `echo hi>PATH` is a real
    // write. Only `->` (arrow) and `<>` are not redirections; quoted spans never
    // reach here (skipQuoted).
    if (before === "-" || before === "<") {
      i++;
      continue;
    }
    let opEnd = i + 1;
    if (segment[opEnd] === ">") opEnd++;
    else if (segment[opEnd] === "|") opEnd++; // `>|` clobber
    if (segment[opEnd] === "&") {
      const r = readToken(segment, opEnd + 1);
      i = r.next;
      continue;
    }
    const dest = readToken(segment, opEnd);
    if (fd !== "2" && dest.token !== "" && !dest.token.startsWith("&")) dests.push(dest.token);
    i = dest.next;
  }
  return dests;
}

function tokenize(segment: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < segment.length) {
    if (segment[i] === "'" || segment[i] === '"') {
      const r = readToken(segment, i);
      tokens.push(r.token);
      i = r.next;
      continue;
    }
    if (segment[i] === "<" && segment[i + 1] === "<" && segment[i + 2] !== "<") {
      i = skipHeredoc(segment, i);
      continue;
    }
    if (/\s/.test(segment[i])) {
      i++;
      continue;
    }
    const r = readToken(segment, i);
    if (r.token !== "") tokens.push(r.token);
    i = r.next === i ? i + 1 : r.next;
  }
  return tokens;
}

function basename(p: string): string {
  const norm = p.replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  return idx === -1 ? norm : norm.slice(idx + 1);
}

function stripPrefixes(tokens: string[]): string[] {
  let rest = tokens;
  for (;;) {
    const head = rest[0] ? basename(rest[0]) : "";
    if (head === "sudo" || head === "command" || head === "builtin") {
      rest = rest.slice(1);
      continue;
    }
    if (head === "env") {
      rest = rest.slice(1);
      while (rest.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(rest[0])) rest = rest.slice(1);
      continue;
    }
    return rest;
  }
}

function verbDestinations(segment: string): string[] {
  const rest = stripPrefixes(tokenize(segment));
  const verb = rest[0] ? basename(rest[0]) : "";
  const args = rest.slice(1);
  if (verb === "tee") return teeDestinations(args);
  if (verb === "sed") return sedInPlaceDestinations(args);
  if (verb === "cp" || verb === "mv") return cpMvDestinations(args);
  if (verb === "perl" || verb === "ruby") return interpInPlaceDestinations(args);
  return [];
}

function teeDestinations(args: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") {
      out.push(...args.slice(i + 1));
      break;
    }
    if (a.startsWith("-") && a !== "-") continue;
    out.push(a);
  }
  return out;
}

function sedInPlaceDestinations(args: string[]): string[] {
  let inPlace = false;
  let sawExpression = false;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") {
      positional.push(...args.slice(i + 1));
      break;
    }
    if (a === "-i" || a === "--in-place" || a.startsWith("--in-place=") || (a.startsWith("-i") && a.length > 2)) {
      inPlace = true;
      if (a === "-i" && args[i + 1] !== undefined && (args[i + 1] === "" || /^\./.test(args[i + 1]))) i++;
      continue;
    }
    if (a === "-e" || a === "-f" || a === "--expression" || a === "--file") {
      sawExpression = true;
      i++;
      continue;
    }
    if (a.startsWith("-")) continue;
    positional.push(a);
  }
  if (!inPlace) return [];
  return sawExpression ? positional : positional.slice(1);
}

function cpMvDestinations(args: string[]): string[] {
  let targetDir: string | undefined;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-t" || a === "--target-directory") {
      targetDir = args[++i];
      continue;
    }
    if (a.startsWith("--target-directory=")) {
      targetDir = a.slice("--target-directory=".length);
      continue;
    }
    if (a === "--") {
      positional.push(...args.slice(i + 1));
      break;
    }
    if (a.startsWith("-")) continue;
    positional.push(a);
  }
  if (targetDir) return [targetDir];
  if (positional.length >= 2) return [positional[positional.length - 1]];
  return [];
}

function interpInPlaceDestinations(args: string[]): string[] {
  let inPlace = false;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") {
      positional.push(...args.slice(i + 1));
      break;
    }
    if (/^-[a-zA-Z]*i/.test(a)) {
      inPlace = true;
      continue;
    }
    if (a === "-e") {
      i++;
      continue;
    }
    if (a.startsWith("-")) continue;
    positional.push(a);
  }
  return inPlace ? positional : [];
}
```

`classifyMemoryWrite` 셸 분기 after (`memory-write-gate.ts:207-219` 자리):

```ts
  if (SHELL_TOOLS.has(toolName)) {
    const command = typeof toolInput.command === "string" ? toolInput.command : "";
    if (command === "") return { surface: "", target: "" };
    for (const token of shellWriteDestinations(command)) {
      const abs = absolutize(token, cwd);
      if (isMemoryPath(abs, root)) return { surface: "shell", target: abs };
    }
  }
```

write-verb 정규식은 제거한다. 목적지가 없으면 surface는 `""`이다. `cat`/`rg`는 목적지가 없으니 계속 통과한다 (`:174-182` 유지). 머리 주석 `:157-161`의 "Deliberately BROAD" 문장은 삭제한다. `:17-18` 정책 문장이 구현과 같아진다. `absolutize` (`:130-136`)와 `isMemoryPath` (`:119-123`)는 그대로다.

### 4.2 `memory-write-gate.test.ts` — 셸 픽스처

before: `:174-183` 한 테스트. cat/rg 허용, echo 리다이렉트 메모리 거부, 워크트리 허용.

after: 기존 테스트를 남기고, import 목록에 `shellWriteDestinations`를 추가하고(게이트가 `export { shellWriteDestinations } from "./shell-write-destinations.ts"`로 re-export하므로 같은 모듈에서 가져올 수 있다; 파서 단위 테스트는 `test/shell-write-destinations.test.ts`가 `../src/shell-write-destinations.ts`를 직접 import한다) 아래를 `:183` 다음에 붙인다. 테스트는 `node:test` + `node:assert/strict`, 소스는 `../src/memory-write-gate.ts` (확장자 포함). 메모리 경로는 픽스처에서 `CODEX_HOME=/h`의 `/h/memories`를 쓰고, 라이브 재현만 본문에 `~/.codex/memories` 물결표를 쓴다.

```ts
test("shell surface: destination-based classification, not body path strings", () => {
  const root = memoriesRoot({ CODEX_HOME: "/h" });
  const mem = "/h/memories";
  const classify = (command: string, tool = "Bash") =>
    classifyMemoryWrite(tool, { command }, "/w", root);

  // (1) sed -n is a read.
  assert.equal(classify(`sed -n '1p' ${mem}/MEMORY.md`).surface, "");
  // (2) stderr redirect is not a write destination.
  assert.equal(classify(`rg foo ${mem}/MEMORY.md 2>/dev/null`).surface, "");
  // (3) heredoc body names the memories root; the write destination is devlog.
  const heredoc = [
    "mkdir -p /w/devlog/_plan/notes",
    `&& cat > /w/devlog/_plan/notes/00_brief.md <<'EOF'`,
    `\n${mem}\nEOF`,
  ].join(" ");
  assert.equal(classify(heredoc).surface, "");
  // (4) sed -i of a memory file remains a write.
  const sedInPlace = classify(`sed -i 's/a/b/' ${mem}/MEMORY.md`);
  assert.equal(sedInPlace.surface, "shell");
  assert.equal(sedInPlace.target, `${mem}/MEMORY.md`);
  // (5) stdout redirect into memories remains a write.
  assert.equal(classify(`echo hi > ${mem}/notes.md`).surface, "shell");
  // (A1) no-space redirections and `>|` clobber are real writes (audit round 1 found the
  // first parser draft returning [] for all three).
  assert.equal(classify(`echo hi>${mem}/n.md`).surface, "shell");
  assert.equal(classify(`echo hi>>${mem}/n.md`).surface, "shell");
  assert.equal(classify(`echo hi >| ${mem}/n.md`).surface, "shell");
  assert.equal(classify(`echo 'a>b'`).surface, "");
  assert.equal(classify(`grep -- '->' /w/f`).surface, "");

  // Live shape from notes/00 and notes/03 §6: worktree dest, tilde path in the body.
  const live = [
    "mkdir -p /Users/jun/.codex/worktrees/3412/codexclaw/devlog/_plan/260910_memory-followup-roadmap/notes /tmp/mfu-260910",
    "&& cat > /Users/jun/.codex/worktrees/3412/codexclaw/devlog/_plan/260910_memory-followup-roadmap/notes/00_brief.md <<'EOF'",
    "\n~/.codex/memories\nEOF",
  ].join(" ");
  assert.equal(classify(live).surface, "");

  // Old >>? regex false-denies (notes/03 §4, §6 table).
  assert.equal(classify(`python3 -c "from pathlib import Path; print(Path('${mem}/MEMORY.md').read_text()); print('x -> y')"`).surface, "");
  assert.equal(classify(`rg '<prose>' ${mem}/MEMORY.md`).surface, "");

  assert.equal(classify(`rg foo /w | tee ${mem}/out.md`).surface, "shell");
  assert.equal(classify(`cp /w/a.md ${mem}/b.md`).surface, "shell");
  assert.equal(classify(`cp ${mem}/a.md /w/b.md`).surface, "");
  assert.equal(classify(`mv /w/a.md ${mem}/b.md`).surface, "shell");
  assert.equal(classify(`perl -i -pe 's/a/b/' ${mem}/MEMORY.md`).surface, "shell");
  assert.equal(classify(`ruby -i -pe 's/a/b/' ${mem}/MEMORY.md`).surface, "shell");
  assert.equal(classify(`sed -n '1p' ${mem}/MEMORY.md`, "exec_command").surface, "");
  assert.equal(classify(`echo hi > ${mem}/notes.md`, "exec_command").surface, "shell");
});

test("shellWriteDestinations: stderr, arrows in prose, and heredoc bodies are not dests", () => {
  assert.deepEqual(shellWriteDestinations("rg foo /h/memories 2>/dev/null"), []);
  assert.deepEqual(shellWriteDestinations("echo 'a > b'"), []);
  assert.deepEqual(shellWriteDestinations("echo hi > /tmp/out.md"), ["/tmp/out.md"]);
  assert.deepEqual(
    shellWriteDestinations("cat > /tmp/out.md <<'EOF'\n~/.codex/memories\nEOF"),
    ["/tmp/out.md"],
  );
  assert.deepEqual(shellWriteDestinations("sed -n '1p' /h/memories/MEMORY.md"), []);
  assert.deepEqual(shellWriteDestinations("sed -i 's/a/b/' /h/memories/MEMORY.md"), ["/h/memories/MEMORY.md"]);
  assert.deepEqual(shellWriteDestinations("echo hi>/h/memories/n.md"), ["/h/memories/n.md"]);
  assert.deepEqual(shellWriteDestinations("echo hi>>/h/memories/n.md"), ["/h/memories/n.md"]);
  assert.deepEqual(shellWriteDestinations("echo hi >| /h/memories/n.md"), ["/h/memories/n.md"]);
  assert.deepEqual(shellWriteDestinations("x -> y"), []);
});
```

기존 `:48-61` 툴 거부, `:63-78` deny 봉투, `:161-172` apply_patch, `:174-182` echo 리다이렉트는 한 줄도 지우지 않는다.

### 4.3 `docs-site/src/content/docs/reference/hooks.md`

before (`:75-85`). Pre-tool guards 목록에 memory-write가 없다. 표 `:47`에 파일·matcher만 있다.

after: `:85` 다음에 항목을 넣는다. 표 `:47` matcher 열은 바꾸지 않는다.

```md
- **memory-write / pre-tool-use (`memories[._]?add_ad_hoc_note|apply_patch|Write|Edit|Bash`)** — denies an unauthorized write into the Codex memories directory. The shell leg classifies by write destination (`>`, `>>`, `tee`, `sed -i`, `cp`/`mv` dest, `perl -i`/`ruby -i`), not by a memories path string in the command body. `sed -n` reads and `2>/dev/null` stderr redirects are allowed. Fail-open on crash. Early warning, not enforcement: subshells, expansions, and `python -c` writers are residual bypasses.
```

## 5. 테스트 계획

| 파일 | 케이스 | 활성화 시나리오 | 관측 |
|---|---|---|---|
| `test/memory-write-gate.test.ts` 기존 11개 | 툴 거부, 승인 1회, 관용구, 턴 스코프, CLI grant, apply_patch, echo 리다이렉트, fail-open, 구 state | 입력 그대로 | 전부 유지. c-2 |
| 같은 파일 NEW | sed -n 읽기 허용 | tool_name=Bash, command=`sed -n '1p' /h/memories/MEMORY.md` | `classifyMemoryWrite.surface === ""`. 옛 코드는 `\bsed\b`로 deny (E6) |
| 같은 파일 NEW | 2>/dev/null 허용 | command=`rg foo /h/memories/MEMORY.md 2>/dev/null` | surface `""`. 옛 코드는 `>` 히트 |
| 같은 파일 NEW | 본문 경로 heredoc, 목적지 devlog 허용 | `cat > /w/devlog/... <<'EOF'` 본문 `/h/memories` | surface `""`. 옛 코드는 본문 토큰으로 루트 deny (E7) |
| 같은 파일 NEW | 라이브 형태 | mkdir 워크트리 notes + `cat > .../00_brief.md <<'EOF'` 본문 `~/.codex/memories` (`notes/00`, `notes/03` §6) | surface `""`. 본문 물결표 경로가 목적지가 아님 |
| 같은 파일 NEW | sed -i 메모리 거부 | `sed -i 's/a/b/' /h/memories/MEMORY.md` | surface `"shell"`, target 그 파일 |
| 같은 파일 NEW | `>` 메모리 거부 | `echo hi > /h/memories/notes.md` | surface `"shell"` (기존 테스트와 중복 고정) |
| 같은 파일 NEW | 공백 없는 `>` 메모리 거부 (A1) | `echo hi>/h/memories/n.md` | surface `"shell"`. round-1 파서는 `[]`였다 |
| 같은 파일 NEW | 공백 없는 `>>` 메모리 거부 (A1) | `echo hi>>/h/memories/n.md` | surface `"shell"` |
| 같은 파일 NEW | `>\|` clobber 메모리 거부 (A1) | `echo hi >\| /h/memories/n.md` | surface `"shell"`. `splitShellSegments`가 `>\|`를 분리하지 않음 |
| 같은 파일 NEW | `->` / `<prose>` 허용 | python print `x -> y`; `rg '<prose>'` | surface `""` (`notes/03` §6 표) |
| 같은 파일 NEW | tee/cp/mv dest/perl -i/ruby -i 메모리 거부 | 목적지가 `/h/memories/...` | surface `"shell"` |
| 같은 파일 NEW | cp 메모리→밖 허용 | `cp /h/memories/a.md /w/b.md` | surface `""` (대상이 밖) |
| 같은 파일 NEW | exec_command 동일 분류 | 같은 command, tool_name=exec_command | sed -n 허용, `>` 메모리 거부. `SHELL_TOOLS` `:68` |
| 같은 파일 NEW | shellWriteDestinations 단위 | 2>/dev/null, quoted `>`, heredoc, sed -n vs -i | dest 배열이 위 표와 같음 |
| 기존 툴 테스트 | memoriesadd_ad_hoc_note 거부 | `handleMemoryWriteGate(ptu({cwd}))` | deny 봉투. (b) 유지 |
| 기존 편집 테스트 | apply_patch 메모리 vs 밖 | `*** Add File: /h/memories/...` vs `/w/src/index.ts` | edit vs `""` |

구현 후 훅 CLI 스모크는 stdin만 넣고 셸을 실행하지 않는다. 워크트리 dist를 쓰고, `CODEX_HOME=/h`를 env로 넘긴다. 허용은 빈 stdout, 거부는 `permissionDecision":"deny"`. 라이브 재검증(`sed -n '1p'` 물결표 MEMORY.md, devlog heredoc)은 구현+재설치 뒤에만 돌린다. 지금 돌리면 현재 게이트가 막는다 (`notes/03` §6).

## 6. 검증 명령 (PLAN-VERIFIER-REAL-01)

오늘 이 워크트리에서 실행한 결과. 코드를 바꾸기 전 기준선이다.

| 명령 | 실제 읽기 근거 | 결과 |
|---|---|---|
| `cd plugins/codexclaw/components/pabcd-state && node --test test/memory-write-gate.test.ts` | 인자 `test/memory-write-gate.test.ts`가 변경 대상 테스트를 직접 연다. 테스트가 `../src/memory-write-gate.ts`를 import (`:15-23`) | exit 0. tests 11 pass 11, duration 93ms. Node v24.17.0 |
| `cd plugins/codexclaw/components/pabcd-state && node --test` | Node 기본 러너가 `test/**` 아래를 재귀 로드. `test/memory-write-gate.test.ts` 포함 | exit **1**. tests 1210, pass 1208, fail 1, skipped 1. 실패는 `test/fixtures/capture-goalplan-baseline.mjs` (생성기 파일이 `test/` 아래에 있어 러너가 테스트로 취급). 변경 대상과 무관한 기존 실패. 루트 `package.json` scripts.test는 `pabcd-state/test/*.test.ts` glob이라 이 픽스처를 안 넣는다 |
| `node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/dist-freshness.test.mjs"` (레포 루트) | `test.mjs`가 argv.slice(2)를 `node --test`에 전달. `dist-freshness.test.mjs:13,32-47`가 `COMPONENTS`의 `pabcd-state`에 대해 `listTsFiles(src)` → `memory-write-gate.ts`를 읽고 `dist/memory-write-gate.js`와 compileSource 바이트 비교 | exit 0. pass 1 (`F1: committed dist/ is in sync with src`), duration 1220ms |

구현 후 같은 세 명령을 다시 돌린다. 컴포넌트 전체 `node --test`의 fixture 실패는 이 wp의 범위가 아니다. 게이트 회귀는 `node --test test/memory-write-gate.test.ts`와 루트 glob `test/*.test.ts`로 본다.

Build 단계:

```bash
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/pabcd-state/test/*.test.ts"   # 레포 루트
npm run build                                                                                   # 레포 루트 (scripts/build.mjs)
git add -f plugins/codexclaw/components/pabcd-state/dist/shell-write-destinations.js plugins/codexclaw/components/pabcd-state/dist/memory-write-gate.js
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/dist-freshness.test.mjs" "plugins/codexclaw/test/packaging.test.mjs"
node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/test/dist-freshness.test.mjs
```

`npm run build`는 레포 루트 `package.json` scripts.build → `node plugins/codexclaw/scripts/build.mjs`이다.

## 7. dist 재생성

`memory-write-gate.ts`를 고치면 같은 커밋에 `npm run build` 결과 `plugins/codexclaw/components/pabcd-state/dist/memory-write-gate.js`를 담는다. `dist-freshness.test.mjs:40-47`가 이 파일의 커밋 바이트를 `compileSource(src)`와 비교한다. 빠지면 CI F1 실패 (260909 `000_plan.md:325` R-7).

바뀔 dist 파일: `plugins/codexclaw/components/pabcd-state/dist/memory-write-gate.js`(MODIFY)와 `dist/shell-write-destinations.js`(NEW). `dist/`는 루트 `.gitignore:2`에 있어 새 파일은 `git add -f`로 추적한다(§6 Build 블록). `packaging.test.mjs` L19가 src마다 tracked dist를 요구하므로 누락되면 CI가 잡는다. `dist/cli.js` / `dist/hook.js`는 이 src를 import만 하고 자체 바이트는 그대로다.

## 8. 위험·롤백

### PLAN-BYPASS-NAMED-01

| 필드 | 값 |
|---|---|
| tier | E1 (`structure/40_enforcement_methods.md:22,46-51`). PreToolUse `permissionDecision:"deny"`. 매칭된 툴 호출은 실행되지 않는다 |
| executing surface | 훅 파일 `plugins/codexclaw/hooks/pre-tool-use-guarding-memory-write.json` → `node ${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js hook pre-tool-use-memory-write` (`cli.ts:367-373`). matcher `Bash` + 툴/편집 이름. 런타임 분류 집합 `SHELL_TOOLS`는 Bash/shell/exec_command/local_shell (`:68`) |
| known bypass | (1) 서브셸/명령치환 목적지 `echo hi > $(printf %s ~/.codex/memories/x)` — 토큰이 전개되지 않아 `isMemoryPath`가 빗나감. (2) 변수 확장 `D=~/.codex/memories/x; echo hi > $D`. (3) `python -c` / `node -e` / `perl -e`로 open+write. (4) `rm` / `touch` / `mkdir` / `dd of=` / `install` (이번 분류에서 제외). (5) `mv` 소스가 메모리이고 대상은 밖 — 대상만 보므로 메모리 파일이 빠져나감. (6) matcher에 없는 툴 이름 (훅이 안 뜸). (7) `plugin_hooks=false` 또는 훅 untrusted skip (`40_enforcement_methods.md:35-39`). (8) 호스트 Phase 2 writer (훅 경로 밖, 260909 `000_plan.md:313`). (9) 공백 없는 리다이렉션 `echo hi>P` / `>>P` / `>| P`는 round-1 파서가 놓쳤고 A1 규칙으로 닫혔다; 남는 잔여는 `echo hi -> P`(bash는 `-`를 단어로, `>`를 리다이렉션으로 파싱)로 `->` 제외 규칙 때문에 통과한다 — (1)~(3)과 동급의 명시적 우회이며 현행 게이트는 이를 deny했다 |
| residual risk | 에이전트가 우회 형태를 쓰면 승인 없이 메모리 바이트가 생긴다. fail-open (`:37-41, :312-314`)이라 게이트 크래시도 통과. 오탐을 줄인 대가이고, 미탐 방향이다 |
| wording downgrade | 예. 이 게이트는 **early warning**이다. "enforcement" / "cannot bypass" / "메모리는 승인 없이 못 쓴다"는 쓰지 않는다. 최종 enforcement layer: **none**. E1이 매칭된 호출을 막지만 우회 표면이 열려 있고, 호스트 writer는 의도적으로 바깥이다 |

그 밖의 위험.

- sed GNU/BSD `-i` 접미사. `sed -i.bak`는 `startsWith("-i") && length > 2`로 잡고, BSD `sed -i '' file`는 다음 토큰이 `""`이면 suffix로 건너뛴다. `sed -i -e`는 `-e` 본 뒤 positional 전부 파일. 잘못된 suffix 소비는 파일을 놓쳐 미탐이 된다 (early warning 방향).
- heredoc delimiter 파서가 quoted/unquoted 워드만 처리한다. `<<'EOF'` / `<<EOF` / `<<-EOF`는 IN. `<<"$FOO"` 확장은 잔여.
- 목적지 분류가 느슨해 `mkdir -p ~/.codex/memories/...` 같은 옛 정규식 히트는 더 이상 deny가 아니다. 의도된 완화. 빈 디렉터리 생성은 노트 생성보다 피해가 작고, 라이브 오탐 명령이 mkdir을 끼고 있었다.
- 롤백: 이 커밋만 revert. 훅 JSON을 안 바꾸므로 개수 6표면·trusted_hash 입력은 그대로. dist를 같이 revert한다.

## 9. PR 제목·본문 초안

제목:

`fix: classify memory-write gate shell commands by destination`

본문:

```
The #102 PreToolUse memory-write gate treated any shell command that
mentioned a memories path and also contained sed, a redirect glyph, mkdir,
or similar as a write. That blocked read-only sed -n, 2>/dev/null,
-> in Python, regex <prose>, and a worktree devlog heredoc whose body
only quoted ~/.codex/memories (E6/E7, live session 01a0880e).

Shell classification now takes write destinations only: stdout > / >>,
tee, sed -i, cp/mv dest, perl/ruby -i. Deny only when that path
resolves under the memories root. Tool and apply_patch/Write/Edit
judgement are unchanged. The gate remains an early warning (PLAN-BYPASS
E1, final layer none).

Stack (enforce-pr-target: every PR targets dev; local branch chain +
merge order replace a GitHub stacked-PR base):

| layer | branch | GitHub base | merge order | depends on |
|---|---|---|---|---|
| wp1 (this) | codex/memory-l1-wp1-write-gate | dev | independent; can land in parallel with wp2 | none |
| wp2 symbol-boundary | codex/memory-l1-wp2-symbol-boundary | dev | parallel | none |
| wp3 skill/docs | later | dev | after wp1 so hooks.md text matches | wp1 wording |

Verify: cd plugins/codexclaw/components/pabcd-state && node --test test/memory-write-gate.test.ts; root npm run build; node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/test/dist-freshness.test.mjs.
```

브랜치 접두 `codex/`. 이 워크트리의 wp0 브랜치(`codex/memory-l1-wp0-roadmap`)는 로드맵 문서용이고 wp1 코드와 파일 집합이 겹치지 않는다. wp1은 `dev`에서 새 브랜치를 딴다.

## 검증 명령 정정 (메인, 2026-09-10 07:25)

이 문서가 기록한 recall 컴포넌트 `node --test` exit 1(`chat-fallback.test.ts:176`)은 코드 결함이 아니라 러너 미사용 탓이다. 그 테스트는 memory→chat 폴백이 사이드카 인덱스를 읽는데, `CODEXCLAW_HOME`을 덮지 않으면 사용자 실인덱스(12GB)를 읽어 합성 픽스처 `aardwolf`를 못 찾는다. 레포 러너 `plugins/codexclaw/scripts/test.mjs`(`CODEXCLAW_HOME`을 임시 디렉터리로 덮음, test.mjs:7-11)로 돌리면 9/9 통과, exit 0이다(메인 세션 실측). 이후 모든 C 단계 검증은 다음 형태를 쓴다.

```bash
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/<comp>/test/*.test.ts"
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/dist-freshness.test.mjs"
```

## A 감사 반영 (round 1, 2026-09-10)

독립 리뷰어(opus-5)가 제안 파서(§4 TS 블록)를 실제로 실행해 현행 `classifyMemoryWrite`와 대조한 결과, 공백 없는 리다이렉션 세 형태가 목적지를 놓친다: `echo hi><mem>/n.md`, `echo hi>><mem>/n.md`, `echo hi >| <mem>/n.md`. 현행 게이트는 셋 다 deny한다. 원인은 `redirectDestinations`가 fd 앞 글자를 공백·`;|&`·문자열 시작으로 강제한 부분과, `>|`을 처리하지 않으면서 `|`를 세그먼트 구분자로 쓰는 부분이다. 이는 000 loop-spec의 UNSAFE 조건("진짜 쓰기 차단을 약화")에 해당하므로 다음과 같이 접는다(blocker #1).

- 리다이렉션 인식 규칙 수정: 연산자 `>`, `>>`, `>|`, `&>`, `&>>`, `N>`, `N>>`를 토큰 경계와 무관하게 인식한다. 제외 조건은 두 가지뿐이다 — 직전 문자가 `-`(`->` 화살표)이거나 `<`(`<>`, 또는 `<prose>` 꼴의 산문)인 경우, 그리고 따옴표 안. `>|`은 `|`보다 먼저 매칭되도록 연산자 정규식 순서를 `>>|>\||&>>|&>|>`로 두고, 세그먼트 분리 정규식에서 `>|`를 먼저 치환해 보호한다.
- 회귀 픽스처 추가(§5 표에 3행): 위 세 형태가 목적지 `<mem>/n.md`로 분류돼 deny. 대조군으로 `echo 'a>b'`(따옴표 안), `grep -- '->' f`(화살표), `cat <mem>/x 2>/dev/null`(stderr)은 allow.
- §8 known bypass 표에 "공백 없는 리다이렉션 / `>|` clobber"를 9번째 항목으로 추가하고 이 수정으로 닫힘을 명시.

B8(파일 크기): `memory-write-gate.ts`가 315→약 600줄이 되므로 목적지 파서를 `pabcd-state/src/shell-write-destinations.ts`(NEW, 약 300줄)로 분리하고 `memory-write-gate.ts`는 `import { shellWriteDestinations } from "./shell-write-destinations.ts"`로 소비한다. 테스트는 `test/shell-write-destinations.test.ts`(NEW)에 파서 단위 케이스, `memory-write-gate.test.ts`에 게이트 통합 케이스로 나눈다. dist는 `dist/shell-write-destinations.js`가 추가된다(같은 커밋에 빌드).


## P 재검증 (wp1 사이클, 2026-09-10 08:05)

기준 트리 `db4e9412`(origin/dev, #123 머지 직후). `git diff --stat 369ed0e1 HEAD -- plugins/`에서 게이트 관련 파일 변경 없음(추가된 것은 `plugins/codexclaw/test/test-shard.test.mjs`뿐). §2 인용 행(`memory-write-gate.ts:156-170, 207-219, 237-245, 312-314`)은 그대로 유효하다. A 감사 반영(A1·B8)이 본문에 접혀 있으므로 이 문서를 그대로 실행한다. 브랜치 `codex/memory-l1-wp1-gate`(origin/dev 위), PR base dev.



## A 감사 반영 (wp1 round 1, 2026-09-10)

리뷰어(grok-4.6) FAIL 4건을 본문에 접었다.

1. §4.1 인라인 vs B8 분리: §4.1의 TS 블록은 **새 파일 `src/shell-write-destinations.ts` 전용**이다. `memory-write-gate.ts`는 `shellPathTokens`(:156-170)와 write-verb 정규식(:212)을 삭제하고, 상단 import에 `import { shellWriteDestinations } from "./shell-write-destinations.ts";`를 추가하며, 셸 분기(:207-219)만 §4.1 말미의 after 블록으로 교체한다. 게이트는 `export { shellWriteDestinations } from "./shell-write-destinations.ts";`로 re-export해 기존 테스트 파일이 같은 모듈에서 가져올 수 있게 한다(§4.2 문구 수정).
2. re-export: 위 1과 같다.
3. dist: 루트 `.gitignore:2`가 `dist/`이므로 새 산출 `dist/shell-write-destinations.js`는 `git add -f`로 추적해야 한다. F1(dist-freshness)은 untracked dist를 건너뛰므로 `packaging.test.mjs` L19(src마다 tracked dist)를 검증에 추가했다(§6 Build 블록 수정).
4. A1 픽스처: §4.2 게이트 테스트와 파서 단위 테스트에 `echo hi>P` / `>>P` / `>| P` deny와 `echo 'a>b'` / `grep -- '->'` allow를 추가했다.

Medium(빌드 cwd): Build 블록을 레포 루트 명령으로 고쳤다. Low(심볼명): §3의 `commandDestinations`를 `verbDestinations`로 맞췄다.


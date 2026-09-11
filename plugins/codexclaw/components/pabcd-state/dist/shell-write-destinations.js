/**
 * shell-write-destinations.ts — write-destination parser for MEMORY-WRITE-GATE-01
 * (260910 wp1). Replaces the body-string token scan (`shellPathTokens`) that
 * classified read-only `sed`, `2>/dev/null` and heredoc bodies mentioning the
 * memories path as writes. Plan: devlog/_plan/260910_memory-followup-roadmap/010.
 *
 * Pure functions, no imports. The gate only asks one question of a shell command:
 * which paths does it WRITE to? Everything else (reads, arguments that are not a
 * destination, text inside quotes or heredoc bodies) is ignored.
 */

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
export function shellWriteDestinations(command        )           {
  const dests           = [];
  for (const segment of splitShellSegments(stripHeredocBodies(command))) {
    dests.push(...redirectDestinations(segment));
    dests.push(...verbDestinations(segment));
  }
  return dests;
}

/**
 * Remove every heredoc BODY (the lines after a `<<DELIM` line up to and including
 * the terminator line). The `<<DELIM` operator and the rest of its own line stay,
 * so `cat <<EOF > /w/x.md` still shows its redirect target. Body text is exactly
 * what must never count as a destination: a devlog brief whose body quotes the
 * memories path is the false positive this parser exists to remove.
 */
function stripHeredocBodies(command        )         {
  let out = "";
  let i = 0;
  while (i < command.length) {
    const ch = command[i];
    if (ch === "'" || ch === '"') {
      const next = skipQuoted(command, i);
      out += command.slice(i, next);
      i = next;
      continue;
    }
    if (ch === "<" && command[i + 1] === "<" && command[i + 2] !== "<") {
      const afterDelim = skipHeredoc(command, i);
      const delim = heredocDelimiter(command, i);
      out += command.slice(i, afterDelim);
      i = afterDelim;
      if (delim === "") continue;
      // Keep the rest of the operator's line, then drop the body.
      let eol = command.indexOf("\n", i);
      if (eol === -1) return out + command.slice(i);
      out += command.slice(i, eol);
      let j = eol + 1;
      for (;;) {
        const nl = command.indexOf("\n", j);
        const line = nl === -1 ? command.slice(j) : command.slice(j, nl);
        if (line === delim) {
          j = nl === -1 ? command.length : nl + 1;
          break;
        }
        if (nl === -1) {
          j = command.length;
          break;
        }
        j = nl + 1;
      }
      out += "\n";
      i = j;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/** The heredoc delimiter word at `<<` position `i`, unquoted; "" when absent. */
function heredocDelimiter(s        , i        )         {
  i += 2;
  if (s[i] === "-") i++;
  while (i < s.length && /\s/.test(s[i])) i++;
  if (s[i] === "'" || s[i] === '"') {
    const q = s[i++];
    const start = i;
    while (i < s.length && s[i] !== q) i++;
    return s.slice(start, i);
  }
  const start = i;
  while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) i++;
  return s.slice(start, i);
}

function splitShellSegments(command        )           {
  const segments           = [];
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

function skipQuoted(s        , i        )         {
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

/**
 * Skip a `<<` / `<<-` operator and its delimiter word only. Bodies are removed
 * beforehand by stripHeredocBodies, so the rest of the line stays visible.
 */
function skipHeredoc(s        , i        )         {
  i += 2;
  if (s[i] === "-") i++;
  while (i < s.length && /\s/.test(s[i])) i++;
  if (s[i] === "'" || s[i] === '"') {
    const q = s[i++];
    while (i < s.length && s[i] !== q) i++;
    if (s[i] === q) i++;
    return i;
  }
  while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) i++;
  return i;
}

function readToken(s        , i        )                                  {
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

function redirectDestinations(segment        )           {
  const dests           = [];
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

function tokenize(segment        )           {
  const tokens           = [];
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

function basename(p        )         {
  const norm = p.replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  return idx === -1 ? norm : norm.slice(idx + 1);
}

function stripPrefixes(tokens          )           {
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

function verbDestinations(segment        )           {
  const rest = stripPrefixes(tokenize(segment));
  const verb = rest[0] ? basename(rest[0]) : "";
  const args = rest.slice(1);
  if (verb === "tee") return teeDestinations(args);
  if (verb === "sed") return sedInPlaceDestinations(args);
  if (verb === "cp" || verb === "mv") return cpMvDestinations(args);
  if (verb === "perl" || verb === "ruby") return interpInPlaceDestinations(args);
  return [];
}

function teeDestinations(args          )           {
  const out           = [];
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

function sedInPlaceDestinations(args          )           {
  let inPlace = false;
  let sawExpression = false;
  const positional           = [];
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

function cpMvDestinations(args          )           {
  let targetDir                    ;
  const positional           = [];
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

function interpInPlaceDestinations(args          )           {
  let inPlace = false;
  const positional           = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") {
      positional.push(...args.slice(i + 1));
      break;
    }
    if (/^-[a-zA-Z]*i/.test(a)) {
      inPlace = true;
      // A bundle whose LAST letter is `e` (`-pie`, `-nie`) still takes the next
      // argument as the program text.
      if (/e$/.test(a) && !/^-i/.test(a)) i++;
      continue;
    }
    if (a === "-e" || /^-[a-zA-Z]*e$/.test(a)) {
      // `-e`, `-pe`, `-ne`: the program text is the next argument, never a file.
      i++;
      continue;
    }
    if (a.startsWith("-")) continue;
    positional.push(a);
  }
  return inPlace ? positional : [];
}

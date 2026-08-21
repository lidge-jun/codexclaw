/**
 * text-lines.ts - one newline idiom for the whole repo.
 *
 * `split(/\r?\n/)` is right for display and tool output and wrong wherever byte
 * offsets or lengths are recorded: it consumes two bytes and leaves no way to
 * tell that it did, so a CRLF ledger's recorded lengths come out short by one
 * byte per line (opencodex usage/log.ts:782-786). Both idioms are named here so
 * a call site has to choose on purpose.
 *
 * SHARED-HELPER-01: copied verbatim into every consuming package rather than
 * imported across a package boundary. Components in this repo are dependency-free
 * of each other, so a `../../` specifier would not resolve at build time.
 */

/** Split for reading. Tolerates CRLF, LF, and a CR-only final line. */
export function splitLines(text        )           {
  return text.split(/\r?\n/);
}

/** Split preserving exact byte lengths. Use where offsets are recorded. */
export function splitLinesByteExact(text        )           {
  return text.split("\n");
}

/** The EOL this text predominantly uses. */
export function dominantEol(text        )                {
  const crlf = (text.match(/\r\n/g) ?? []).length;
  const lf = (text.match(/(?<!\r)\n/g) ?? []).length;
  return crlf > lf ? "\r\n" : "\n";
}

/**
 * Rewrite `text` with `eol`, preserving whether it ended with a newline.
 *
 * Editing a user's `config.toml` and handing it back with flipped line endings turns
 * a one-line change into a whole-file diff (opencodex grok/inject.ts:388-389).
 */
export function withEol(text        , eol               )         {
  const normalized = text.replace(/\r\n/g, "\n");
  return eol === "\n" ? normalized : normalized.replace(/\n/g, "\r\n");
}

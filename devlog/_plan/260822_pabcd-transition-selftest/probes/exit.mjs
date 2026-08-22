// A child with a controllable exit code and one line on each stream, for
// testing how a shell propagates and merges them.
//   node probes/exit.mjs 3
const code = Number(process.argv[2] ?? 0);
process.stdout.write("stdout-line\n");
process.stderr.write("stderr-line\n");
process.exit(code);

// Prints the child's raw argv, one per line with an index, so nothing is hidden
// by console formatting or by a shell that "helpfully" re-joins.
//   node probes/argv.mjs --attest '{"a":"b c"}'
const args = process.argv.slice(2);
console.log("argc=" + args.length);
args.forEach((a, i) => console.log(i + ": " + JSON.stringify(a)));

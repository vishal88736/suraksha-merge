import { triage } from "../lib/engine.ts";
// Decode incrementally: a pipe chunk can end inside an Indic UTF-8 character.
process.stdin.setEncoding("utf8");
let input = "";
for await (const chunk of process.stdin) input += chunk;
try {
 const rows = input.trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
 for (const row of rows) process.stdout.write(JSON.stringify(triage(row)) + "\n");
} catch (error) { process.stderr.write("Invalid input. Check the triage schema.\n"); process.exitCode = 1; }

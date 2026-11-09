import { triage } from "../lib/engine.ts";
let input = "";
for await (const chunk of process.stdin) input += chunk;
try {
 const rows = input.trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
 for (const row of rows) process.stdout.write(JSON.stringify(triage(row)) + "\n");
} catch (error) { process.stderr.write(`Invalid input: ${error.message}\n`); process.exitCode = 1; }

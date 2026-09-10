import { readFileSync } from "node:fs";

const tag = process.argv[2];
if (!/^v\d+\.\d+\.\d+$/.test(tag ?? "")) {
  throw new Error("Usage: node .github/scripts/release-notes.mjs vX.Y.Z");
}

const version = tag.slice(1);
const changelog = readFileSync(new URL("../../CHANGELOG.md", import.meta.url), "utf8");
const lines = changelog.split(/\r?\n/);
const start = lines.findIndex((line) => line.startsWith(`## [${version}] - `));
if (start === -1) throw new Error(`Missing changelog section for ${tag}`);

let end = start + 1;
while (end < lines.length && !/^## \[|^\[[^\]]+\]:/.test(lines[end])) end++;
const body = lines.slice(start + 1, end).join("\n").trim();
if (!body || body === "_Nothing yet._") throw new Error(`Empty changelog section for ${tag}`);

const comparison = lines.find((line) => line.startsWith(`[${version}]: `));
const link = comparison?.slice(`[${version}]: `.length).trim();
process.stdout.write(`${body}\n${link ? `\n[Full changelog](${link})\n` : ""}`);

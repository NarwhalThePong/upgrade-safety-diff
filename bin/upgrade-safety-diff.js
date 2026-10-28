#!/usr/bin/env node
'use strict';
const fs = require('fs');
const { diff, rank } = require('../src/diff');
const { text, markdown } = require('../src/format');
const HELP = `upgrade-safety-diff - compare two forge storage layouts for proxy-upgrade review

Usage: upgrade-safety-diff <old-layout.json> <new-layout.json> [options]

Get a layout with: forge inspect <Contract> storageLayout --json > layout.json

Options:
  --json                Output JSON
  --markdown            Output Markdown
  --fail-on <severity>  Exit 1 if any finding is at or above: critical|high|medium|info
  -o, --out <file>      Write output to a file
  -h, --help            Show this help

Checks storage layout only. A clean result does not prove an upgrade is safe.`;
const a = process.argv.slice(2); const files = []; let fmt = 'text', failOn = null, out = null;
for (let i = 0; i < a.length; i++) {
  const x = a[i];
  if (x === '-h' || x === '--help') { console.log(HELP); process.exit(0); }
  else if (x === '--json') fmt = 'json'; else if (x === '--markdown') fmt = 'md';
  else if (x === '--fail-on') { failOn = a[++i]; if (rank(failOn) < 0) { console.error(`bad --fail-on ${failOn}`); process.exit(2); } }
  else if (x === '-o' || x === '--out') out = a[++i];
  else if (x.startsWith('-')) { console.error(`Unknown option ${x}\n\n${HELP}`); process.exit(2); }
  else files.push(x);
}
if (files.length !== 2) { console.error(HELP); process.exit(2); }
let r;
try { r = diff(fs.readFileSync(files[0], 'utf8'), fs.readFileSync(files[1], 'utf8')); }
catch (e) { console.error(`error: ${e.message}`); process.exit(2); }
r.old = files[0]; r.new = files[1];
const s = fmt === 'json' ? JSON.stringify(r, null, 2) + '\n' : fmt === 'md' ? markdown(r) : text(r);
if (out) fs.writeFileSync(out, s); else process.stdout.write(s);
if (failOn && r.findings.some(f => rank(f.severity) >= rank(failOn))) process.exit(1);

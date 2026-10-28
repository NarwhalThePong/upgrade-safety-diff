'use strict';
const NOTE = 'Storage layout check only. It does not prove an upgrade is safe; review the code, initializers and inheritance as well.';
function text(r) {
  const L = [`upgrade-safety-diff: ${r.old} -> ${r.new}`, `critical ${r.summary.critical}  high ${r.summary.high}  medium ${r.summary.medium}  info ${r.summary.info}`, ''];
  for (const f of r.findings) L.push(`[${f.severity.toUpperCase()}] ${f.check} ${f.label}: ${f.message}`);
  if (!r.findings.length) L.push('No layout differences found.');
  L.push('', NOTE); return L.join('\n') + '\n';
}
function markdown(r) {
  const L = ['# Storage layout upgrade review', '', `Old: \`${r.old}\`  `, `New: \`${r.new}\``, '', '| Severity | Count |', '|---|---|'];
  for (const s of ['critical', 'high', 'medium', 'info']) L.push(`| ${s} | ${r.summary[s]} |`);
  L.push('');
  if (r.findings.length) { L.push('| Severity | Check | Variable | Detail |', '|---|---|---|---|'); for (const f of r.findings) L.push(`| ${f.severity} | ${f.check} | \`${f.label}\` | ${f.message.replace(/\|/g, '\\|')} |`); }
  else L.push('No layout differences found.');
  L.push('', `> ${NOTE}`); return L.join('\n') + '\n';
}
module.exports = { text, markdown, NOTE };

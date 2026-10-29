'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { diff, rank } = require('../src/diff');
const pairs = require('./pairs');
const ROOT = path.join(__dirname, '..');
const BIN = path.join(ROOT, 'bin', 'upgrade-safety-diff.js');
const rd = (d, n) => fs.readFileSync(path.join(ROOT, d, n + '.json'), 'utf8');
const serious = r => [...new Set(r.findings.filter(f => rank(f.severity) >= rank('medium')).map(f => f.check))].sort();
const CHECKS = ['C1-slot-shift', 'C2-type-size', 'C3-deleted', 'C4-reorder', 'C5-insert', 'C6-struct', 'C7-gap', 'C8-mapping-array'];

for (const [d, a, b, safe, want] of pairs) {
  test(`${a} -> ${b} (${safe ? 'safe' : 'unsafe'})`, () => {
    const got = serious(diff(rd(d, a), rd(d, b)));
    assert.deepStrictEqual(got, [...want].sort());
    if (safe) assert.deepStrictEqual(got, []); else assert.ok(got.length > 0);
  });
}

test('every check fires on at least one unsafe pair and on no safe pair', () => {
  const fired = new Set(), safeFired = new Set();
  for (const [d, a, b, safe] of pairs) for (const c of serious(diff(rd(d, a), rd(d, b)))) (safe ? safeFired : fired).add(c);
  for (const c of CHECKS) assert.ok(fired.has(c), `${c} never fired`);
  assert.deepStrictEqual([...safeFired], []);
});

test('identical layouts give no findings', () => {
  const l = rd('fixtures/layouts', 'StructV1');
  assert.deepStrictEqual(diff(l, l).findings, []);
});

test('rename at same slot and type is info only', () => {
  const v1 = { storage: [{ label: 'a', slot: '0', offset: 0, type: 't_uint256' }], types: { t_uint256: { encoding: 'inplace', label: 'uint256', numberOfBytes: '32' } } };
  const v2 = { storage: [{ label: 'b', slot: '0', offset: 0, type: 't_uint256' }], types: v1.types };
  const r = diff(v1, v2);
  assert.ok(r.findings.length === 1 && r.findings[0].severity === 'info');
});

test('rejects input without storage[]', () => { assert.throws(() => diff('{}', '{}'), /storage/); });

const run = args => { try { return { code: 0, out: execFileSync('node', [BIN, ...args], { cwd: ROOT, stdio: 'pipe' }).toString() }; } catch (e) { return { code: e.status, out: String(e.stdout) + String(e.stderr) }; } };
const L = n => `fixtures/layouts/${n}.json`;

test('CLI --fail-on exit codes', () => {
  assert.strictEqual(run([L('PlainV1'), L('PlainV2Insert'), '--fail-on', 'critical']).code, 1);
  assert.strictEqual(run([L('PlainV1'), L('PlainV2Deleted'), '--fail-on', 'critical']).code, 0);
  assert.strictEqual(run([L('PlainV1'), L('PlainV2Deleted'), '--fail-on', 'high']).code, 1);
  assert.strictEqual(run([L('PlainV1'), L('PlainV2Append'), '--fail-on', 'medium']).code, 0);
  assert.strictEqual(run([L('PlainV1'), L('PlainV2Append'), '--fail-on', 'info']).code, 1);
  assert.strictEqual(run([L('PlainV1'), L('PlainV2Insert')]).code, 0);
});

test('CLI formats and errors', () => {
  const j = JSON.parse(run([L('PlainV1'), L('PlainV2Insert'), '--json']).out);
  assert.strictEqual(j.summary.critical, 2);
  assert.match(run([L('PlainV1'), L('PlainV2Insert'), '--markdown']).out, /^# Storage layout upgrade review/);
  assert.match(run([L('PlainV1'), L('PlainV2Insert')]).out, /\[CRITICAL\] C1-slot-shift owner/);
  assert.match(run([L('PlainV1'), L('PlainV2Append')]).out, /does not prove an upgrade is safe/);
  assert.strictEqual(run([L('PlainV1')]).code, 2);
  assert.strictEqual(run([L('PlainV1'), 'nope.json']).code, 2);
  assert.strictEqual(run([L('PlainV1'), L('PlainV1'), '--fail-on', 'bogus']).code, 2);
  assert.strictEqual(run([L('PlainV1'), L('PlainV1'), '--bogus']).code, 2);
});

test('interface/contract -> address retype is info, not high (openzeppelin-upgrades#687)', () => {
  const r = diff(rd('fixtures/layouts', 'AddrRetype_RegistryV1'), rd('fixtures/layouts', 'AddrRetype_RegistryV2'));
  assert.deepStrictEqual(r.findings.map(f => [f.check, f.severity, f.label]), [['C2-type-size', 'info', 'oracle']]);
});

test('cli: example:<name> resolves bundled layouts from any cwd', () => {
  const os = require('os');
  let code = 0, out = '';
  try { out = execFileSync('node', [BIN, 'example:AddrRetype_RegistryV1', 'example:AddrRetype_RegistryV2Bad', '--fail-on', 'high'], { cwd: os.tmpdir() }).toString(); } catch (e) { code = e.status; out = e.stdout.toString(); }
  assert.strictEqual(code, 1); assert.match(out, /\[HIGH\] C2-type-size oracle/);
  const ok = execFileSync('node', [BIN, 'example:AddrRetype_RegistryV1', 'example:AddrRetype_RegistryV2', '--fail-on', 'high'], { cwd: os.tmpdir() }).toString();
  assert.match(ok, /\[INFO\] C2-type-size oracle/);
});

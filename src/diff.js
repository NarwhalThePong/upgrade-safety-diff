'use strict';
// Compare two storage layouts (forge inspect <C> storageLayout --json) for proxy-upgrade safety.
const SEV = ['info', 'medium', 'high', 'critical'];
const rank = s => SEV.indexOf(String(s).toLowerCase());
const isGap = l => /^_*gap$/i.test(String(l || ''));

function load(json) {
  const o = typeof json === 'string' ? JSON.parse(json) : json;
  if (!o || !Array.isArray(o.storage)) throw new Error('not a storage layout: missing storage[]');
  return { storage: o.storage, types: o.types || {} };
}

// Canonical, compiler-id-free description of a type (strips AST ids and "Contract." prefixes).
function canon(types, id, depth = 0) {
  const t = types[id];
  if (!t || depth > 20) return String(id).replace(/\)\d+_/g, ')_');
  const label = String(t.label).replace(/\b\w+\./g, '');
  if (t.encoding === 'mapping') return `mapping(${canon(types, t.key, depth + 1)}=>${canon(types, t.value, depth + 1)})`;
  if (t.encoding === 'dynamic_array') return `${canon(types, t.base, depth + 1)}[]`;
  if (t.members) return `struct{${t.members.map(m => `${m.label}:${canon(types, m.type, depth + 1)}@${m.slot}.${m.offset}`).join(',')}}`;
  if (t.base && /\[\d+\]$/.test(t.label)) return `${canon(types, t.base, depth + 1)}${t.label.match(/\[\d+\]$/)[0]}`;
  return `${label}/${t.encoding}/${t.numberOfBytes}`;
}
const nbytes = (types, id) => Number((types[id] || {}).numberOfBytes || 32);
const nslots = (types, id) => Math.max(1, Math.ceil(nbytes(types, id) / 32));
const enc = (types, id) => (types[id] || {}).encoding;
const lbl = (types, id) => String((types[id] || {}).label || id).replace(/\b\w+\./g, '');
const key = v => v.label; // state variable names are unique across the inheritance chain (no shadowing since 0.6)

function structDiff(o, n, ot, nt) {
  // Compare members of two struct types; returns list of {kind, msg}.
  const out = []; const om = ot[o].members, nm = nt[n].members;
  const byO = new Map(om.map(m => [m.label, m])), byN = new Map(nm.map(m => [m.label, m]));
  for (const m of om) {
    const x = byN.get(m.label);
    if (!x) { out.push({ append: false, msg: `member ${m.label} removed` }); continue; }
    if (x.slot !== m.slot || x.offset !== m.offset) out.push({ append: false, msg: `member ${m.label} moved slot ${m.slot}.${m.offset} -> ${x.slot}.${x.offset}` });
    if (canon(ot, m.type) !== canon(nt, x.type)) out.push({ append: false, msg: `member ${m.label} type ${lbl(ot, m.type)} -> ${lbl(nt, x.type)}` });
  }
  const lastO = Math.max(...om.map(m => Number(m.slot) * 32 + m.offset));
  for (const x of nm) if (!byO.has(x.label)) {
    const pos = Number(x.slot) * 32 + x.offset;
    out.push({ append: pos > lastO, msg: `member ${x.label} added at ${x.slot}.${x.offset}${pos > lastO ? ' (after existing members)' : ' (before or between existing members)'}` });
  }
  return out;
}

// True when new type b keeps every byte of old type a at the same place and only adds at the end
// (static array longer, or struct members appended). Only safe where nothing follows (mapping values).
function extendsType(at, a, bt, b) {
  if (canon(at, a) === canon(bt, b)) return true;
  const A = at[a], B = bt[b]; if (!A || !B) return false;
  const ra = /\[(\d+)\]$/.exec(A.label || ''), rb = /\[(\d+)\]$/.exec(B.label || '');
  if (ra && rb && A.base && B.base && A.encoding === 'inplace') return Number(rb[1]) >= Number(ra[1]) && canon(at, A.base) === canon(bt, B.base);
  if (A.members && B.members && B.members.length >= A.members.length)
    return A.members.every((m, i) => { const x = B.members[i]; return x.label === m.label && x.slot === m.slot && x.offset === m.offset && canon(at, m.type) === canon(bt, x.type); });
  return false;
}

function diff(oldL, newL) {
  const O = load(oldL), N = load(newL); const ot = O.types, nt = N.types; const F = [];
  const add = (check, severity, label, msg) => F.push({ check, severity, label, message: msg });
  const oVars = O.storage.filter(v => !isGap(v.label)), nVars = N.storage.filter(v => !isGap(v.label));
  const nByKey = new Map(nVars.map(v => [key(v), v])), oByKey = new Map(oVars.map(v => [key(v), v]));
  const at = (v) => `${v.slot}.${v.offset}`;
  const oGaps = O.storage.filter(v => isGap(v.label)), nGaps = N.storage.filter(v => isGap(v.label));
  // slot occupied by any non-gap old var (end-exclusive ranges)
  const oldRange = v => [Number(v.slot), Number(v.slot) + nslots(ot, v.type)];

  for (const v of oVars) {
    const w = nByKey.get(key(v));
    if (!w) {
      const same = nVars.find(x => !oByKey.has(key(x)) && x.slot === v.slot && x.offset === v.offset && canon(nt, x.type) === canon(ot, v.type));
      if (same) add('C3-deleted', 'info', v.label, `${v.label} not found; ${same.label} has the same slot ${at(v)} and type (rename?)`);
      else add('C3-deleted', 'high', v.label, `${v.label} (${lbl(ot, v.type)}) at slot ${at(v)} removed; its slot may be reused by a later variable and read stale data`);
      continue;
    }
    if (w.slot !== v.slot || w.offset !== v.offset) add('C1-slot-shift', 'critical', v.label, `${v.label} moved slot ${at(v)} -> ${at(w)}; the proxy's existing value stays at the old slot`);
    const e1 = enc(ot, v.type), e2 = enc(nt, w.type);
    const c1 = canon(ot, v.type), c2 = canon(nt, w.type);
    if (c1 === c2) continue;
    if (e1 === 'mapping' && e2 === 'mapping' && canon(ot, ot[v.type].key) === canon(nt, nt[w.type].key) && extendsType(ot, ot[v.type].value, nt, nt[w.type].value)) {
      add('C8-mapping-array', 'info', v.label, `${v.label} ${lbl(ot, v.type)} -> ${lbl(nt, w.type)}: mapping value only grows at its end (fixed array longer or struct members appended); existing entries keep their layout`);
      continue;
    }
    if (e1 === 'mapping' || e1 === 'dynamic_array' || e2 === 'mapping' || e2 === 'dynamic_array') {
      add('C8-mapping-array', 'critical', v.label, `${v.label} ${lbl(ot, v.type)} -> ${lbl(nt, w.type)}; existing entries are decoded with the new key/value/element layout${lbl(ot, v.type) === lbl(nt, w.type) ? ' (a struct inside changed its member layout)' : ''}`);
      // nested struct changes inside mapping value are reported by C8 already
      continue;
    }
    if ((ot[v.type] || {}).members && (nt[w.type] || {}).members) {
      const sd = structDiff(v.type, w.type, ot, nt);
      for (const d of sd) add('C6-struct', d.append ? (nbytes(ot, v.type) === nbytes(nt, w.type) ? 'medium' : 'high') : 'critical', v.label, `struct ${v.label}: ${d.msg}`);
      if (nbytes(ot, v.type) !== nbytes(nt, w.type) && !sd.length) add('C6-struct', 'high', v.label, `struct ${v.label} size changed`);
      continue;
    }
    const b1 = nbytes(ot, v.type), b2 = nbytes(nt, w.type);
    // address <-> contract/interface types, and address <-> address payable, share the same
    // 20-byte encoding, so the stored bits mean the same thing (OpenZeppelin/openzeppelin-upgrades#687).
    const addrLike = s => /^(address( payable)?|contract \w+)$/.test(s);
    if (b1 === b2 && b1 === 20 && addrLike(lbl(ot, v.type)) && addrLike(lbl(nt, w.type))) { add('C2-type-size', 'info', v.label, `${v.label} ${lbl(ot, v.type)} -> ${lbl(nt, w.type)}: both are 20-byte addresses, the stored value is read the same way`); continue; }
    if (b1 !== b2) add('C2-type-size', 'critical', v.label, `${v.label} ${lbl(ot, v.type)} (${b1} bytes) -> ${lbl(nt, w.type)} (${b2} bytes) in place; packing and later slots can shift`);
    else add('C2-type-size', 'high', v.label, `${v.label} ${lbl(ot, v.type)} -> ${lbl(nt, w.type)} (same size); existing bits are reinterpreted`);
  }

  // C4 reorder: relative order of surviving variables
  const common = oVars.filter(v => nByKey.has(key(v)));
  const pos = v => Number(v.slot) * 32 + v.offset;
  const newOrder = common.map(v => pos(nByKey.get(key(v))));
  for (let i = 1; i < newOrder.length; i++) if (newOrder[i] < newOrder[i - 1]) {
    add('C4-reorder', 'high', common[i].label, `declaration order changed: ${common[i].label} now precedes ${common[i - 1].label}`); }

  // Gap ranges in old layout
  const gapRanges = oGaps.map(g => [Number(g.slot), Number(g.slot) + nslots(ot, g.type)]);
  const inOldGap = s => gapRanges.some(([a, b]) => s >= a && s < b);
  const lastOldSlot = Math.max(-1, ...oVars.map(v => oldRange(v)[1] - 1));
  // C5 new variables
  for (const w of nVars) if (!oByKey.has(key(w))) {
    if (O.storage.length && oVars.some(v => v.slot === w.slot && v.offset === w.offset && !nByKey.has(key(v)) && canon(ot, v.type) === canon(nt, w.type))) continue; // rename, reported as info above
    const s = Number(w.slot);
    const before = oVars.some(v => nByKey.has(key(v)) && pos(v) >= pos(w));
    const overlapsOld = oVars.some(v => { const [a, b] = oldRange(v); return s >= a && s < b; });
    if (inOldGap(s) && !overlapsOld) { add('C5-insert', 'info', w.label, `new ${w.label} at slot ${at(w)} takes space from a __gap`); }
    else if (before) add('C5-insert', 'critical', w.label, `new ${w.label} at slot ${at(w)} is declared before existing variables; everything after it shifts`);
    else if (overlapsOld && s <= lastOldSlot) add('C5-insert', 'high', w.label, `new ${w.label} at slot ${at(w)} reuses a slot used by a removed variable`);
    else add('C5-insert', 'info', w.label, `new ${w.label} appended at slot ${at(w)}`);
  }
  // C7 gaps: end of each gap must stay put
  for (const g of oGaps) {
    const ng = nGaps.find(x => x.label === g.label && (x.contract || '').split(':').pop() === (g.contract || '').split(':').pop()) || nGaps.find(x => x.label === g.label);
    const oEnd = Number(g.slot) + nslots(ot, g.type), oSize = nslots(ot, g.type);
    const used = nVars.filter(w => !oByKey.has(key(w)) && Number(w.slot) >= Number(g.slot) && Number(w.slot) < oEnd).reduce((set, w) => { for (let i = 0; i < nslots(nt, w.type); i++) set.add(Number(w.slot) + i); return set; }, new Set()).size;
    if (!ng && used === oSize) { add('C7-gap', 'info', g.label, `${g.label} (${oSize} slots) fully consumed by new variables`); continue; }
    if (!ng) { add('C7-gap', 'high', g.label, `${g.label} (${oSize} slots) removed; later inherited storage would shift`); continue; }
    const nEnd = Number(ng.slot) + nslots(nt, ng.type), nSize = nslots(nt, ng.type);
    if (nEnd !== oEnd) add('C7-gap', 'critical', g.label, `${g.label} ends at slot ${nEnd - 1} (was ${oEnd - 1}): size ${oSize} -> ${nSize} but ${Number(ng.slot) - Number(g.slot)} slot(s) were added before it; it should be ${oSize - (Number(ng.slot) - Number(g.slot))}`);
    else if (nSize !== oSize) add('C7-gap', 'info', g.label, `${g.label} shrank ${oSize} -> ${nSize}, matching the ${oSize - nSize} new slot(s)`);
  }
  F.sort((a, b) => rank(b.severity) - rank(a.severity));
  return { findings: F, summary: SEV.slice().reverse().reduce((o, s) => (o[s] = F.filter(f => f.severity === s).length, o), {}) };
}

module.exports = { diff, canon, SEV, rank };

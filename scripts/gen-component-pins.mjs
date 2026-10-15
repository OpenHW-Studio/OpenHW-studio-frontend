#!/usr/bin/env node
// gen-component-pins.mjs — regenerate the COMPONENT_PINS table in
// src/worker/registries/component-registry.ts from emulator manifests (§6).
//
// Manifests are the source of truth; the worker table is build output.
// Usage: node scripts/gen-component-pins.mjs [--check]
//   --check: exit 1 with a diff-style report if the table is stale (CI gate).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(__dirname, '..');
const EMU_COMPONENTS = path.resolve(FRONTEND, '../openhw-studio-emulator/src/components');
const REGISTRY_TS = path.join(FRONTEND, 'src/worker/registries/component-registry.ts');

const BOARD_PIN_CONSTANTS = new Set(['UNO_BOARD_PINS']);

function loadManifests() {
  const out = new Map(); // type -> [ids]
  for (const dir of fs.readdirSync(EMU_COMPONENTS)) {
    const mp = path.join(EMU_COMPONENTS, dir, 'manifest.json');
    if (!fs.existsSync(mp)) continue;
    try {
      const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
      if (!m.type) continue;
      const ids = (m.pins || []).map((p) => (typeof p === 'string' ? p : p?.id)).filter(Boolean).map(String);
      out.set(m.type, ids);
    } catch { /* skip unreadable */ }
  }
  return out;
}

function parseTable(src) {
  // Extract the COMPONENT_PINS *values* block. NOTE: the decl at line ~291
  // opens a Record<…, { … }> TYPE annotation whose body mirrors pin lists
  // as types; the runtime values live in the second literal, which opens
  // right after the `}[]> = {` line. Anchor there — the naive first-brace
  // parse used to swallow the type as the block and no-op.
  const valuesAnchor = src.indexOf('}[]> = {');
  let brace;
  if (valuesAnchor >= 0) {
    brace = src.indexOf('{', valuesAnchor);
  } else {
    const start = src.indexOf('export const COMPONENT_PINS');
    if (start < 0) throw new Error('COMPONENT_PINS decl not found');
    brace = src.indexOf('{', start);
  }
  let depth = 0;
  let end = -1;
  for (let i = brace; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end < 0) throw new Error('unbalanced COMPONENT_PINS literal');
  return { head: src.slice(0, brace), block: src.slice(brace, end), tail: src.slice(end) };
}

function parseEntries(block) {
  // Returns [{ key, raw }] for each 'type': ... entry. Values are either
  // bracket-balanced array literals (possibly multi-line) or const-ref
  // expressions like UNO_BOARD_PINS.map((id: string) => ({ id })) whose
  // parens defeat naive regexes — hence this scanner. Pin ids never
  // contain brackets or escaped quotes, so light quote-tracking suffices.
  const entries = [];
  const keyRe = /'([^']+)':\s*/g;
  let m;
  while ((m = keyRe.exec(block))) {
    const key = m[1];
    let i = m.index + m[0].length;
    while (i < block.length && /\s/.test(block[i])) i++;
    let raw = '';
    if (block[i] === '[') {
      let depth = 0;
      let j = i;
      let inStr = false;
      for (; j < block.length; j++) {
        const ch = block[j];
        if (ch === "'") inStr = !inStr;
        else if (!inStr && ch === '[') depth++;
        else if (!inStr && ch === ']') {
          depth--;
          if (depth === 0) { j++; break; }
        }
      }
      raw = block.slice(i, j).trim();
      keyRe.lastIndex = j;
    } else {
      let j = block.indexOf('\n', i);
      if (j < 0) j = block.length;
      raw = block.slice(i, j).trim().replace(/,?\s*$/, '');
      keyRe.lastIndex = j;
    }
    entries.push({ key, raw });
  }
  return entries;
}

const manifests = loadManifests();
const src = fs.readFileSync(REGISTRY_TS, 'utf8');
const { head, block, tail } = parseTable(src);
const entries = parseEntries(block);

// Partition: const-ref entries (board pin constants) vs literal entries.
const kept = [];
const literalByKey = new Map();
for (const e of entries) {
  if (/^[A-Z_]+\.map\(/.test(e.raw)) kept.push(e);
  else literalByKey.set(e.key, e);
}

// Rebuild: keep const-refs verbatim + in original relative order; regenerate
// literals from manifests for openhw-*/wokwi-* types; preserve any literal
// that has no manifest (custom/synthetic keys like 'shift_register').
const manifestTypes = new Set(manifests.keys());
const lines = [];
const seen = new Set();
for (const e of entries) {
  if (/^[A-Z_]+\.map\(/.test(e.raw)) {
    lines.push(`    '${e.key}': ${e.raw},`);
    seen.add(e.key);
  }
}
const generated = [];
for (const [type, ids] of [...manifests.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  if (seen.has(type)) continue;
  const pins = ids.map((id) => `{ id: '${id}' }`).join(', ');
  lines.push(`    '${type}': [${pins}],`);
  generated.push(type);
  seen.add(type);
}
// Orphan literals (no manifest anymore): keep, flagged.
const orphans = [];
for (const e of entries) {
  if (seen.has(e.key) || /^[A-Z_]+\.map\(/.test(e.raw)) continue;
  lines.push(`    '${e.key}': ${e.raw}, // ORPHAN: no manifest — hand-checked`);
  orphans.push(e.key);
}

const newBlock = `{\n${lines.join('\n')}\n}`;
const check = process.argv.includes('--check');
if (check) {
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  if (norm(block) !== norm(newBlock)) {
    console.error('COMPONENT_PINS is stale. Regenerate: node scripts/gen-component-pins.mjs');
    console.error(`Generated types: ${generated.length}, orphans kept: ${orphans.length}${orphans.length ? ` (${orphans.join(', ')})` : ''}`);
    process.exit(1);
  }
  console.log(`COMPONENT_PINS fresh (${generated.length} manifest types, ${orphans.length} orphans, const-refs kept).`);
  process.exit(0);
}

const out = head + newBlock + tail;
fs.writeFileSync(REGISTRY_TS, out);
console.log(`Regenerated COMPONENT_PINS: ${generated.length} manifest types, ${orphans.length} orphans kept${orphans.length ? ` (${orphans.join(', ')})` : ''}.`);

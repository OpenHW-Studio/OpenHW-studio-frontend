/**
 * Pre-compile all guided projects and populate precompiledBinaries.js
 *
 * This script reads every project from guidedProjects.json, sends the
 * Arduino code to the backend compiler API, collects the hex output,
 * and writes it back into precompiledBinaries.js.
 *
 * Usage:
 *   1. Start the backend (so the /compile endpoint is available)
 *   2. node scripts/precompile-guided-projects.mjs
 *
 * Environment variables:
 *   COMPILER_URL  – backend compile endpoint (default: http://localhost:5000/api)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GUIDED_JSON = path.join(ROOT, 'src', 'services', 'guidedProjects.json');
const BINARIES_JS  = path.join(ROOT, 'src', 'services', 'precompiledBinaries.js');

const COMPILER_URL = process.env.COMPILER_URL || 'http://localhost:5001/api';

// ── Slug mapping (JSON slug → URL slug) ──────────────────────────────────────
const JSON_SLUG_TO_URL = {
  'rgb-led-blink':        'rgb-led',
  'potentiometer-led':    'potentiometer',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonSlugToUrl(slug) {
  return JSON_SLUG_TO_URL[slug] || slug;
}

async function compileCode(code, slug) {
  const payload = {
    code,
    fqbn: 'arduino:avr:uno',
    target: 'uno',
  };

  console.log(`  → Compiling ${slug}...`);

  const res = await fetch(`${COMPILER_URL}/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Compile failed for ${slug}: ${res.status} ${text}`);
  }

  const data = await res.json();
  if (!data.hex) {
    throw new Error(`No hex returned for ${slug}`);
  }

  console.log(`  ✓ Got hex (${data.hex.length} chars)`);
  return data.hex;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📖 Reading guided projects...');
  const raw = fs.readFileSync(GUIDED_JSON, 'utf-8');
  const projects = JSON.parse(raw);

  const entries = [];

  for (const [level, levelData] of Object.entries(projects)) {
    console.log(`\n📁 Level: ${level}`);
    for (const [, category] of Object.entries(levelData.categories || {})) {
      console.log(`  📂 Category: ${category.icon || '?'}`);
      for (const project of (category.projects || [])) {
        const urlSlug = jsonSlugToUrl(project.slug);
        const code = project.code || '';
        const board = (project.board || '').toLowerCase().includes('esp32')
          ? 'esp32:esp32:esp32'
          : 'arduino:avr:uno';

        if (!code.trim()) {
          console.warn(`  ⚠ Skipping ${urlSlug}: no code`);
          continue;
        }

        try {
          const hex = await compileCode(code, urlSlug);
          entries.push({ slug: urlSlug, hex, board });
        } catch (err) {
          console.error(`  ✗ ${err.message}`);
        }
      }
    }
  }

  // ── Write precompiledBinaries.js ──────────────────────────────────────────
  console.log('\n📝 Writing precompiledBinaries.js...');

  const now = new Date().toISOString().slice(0, 10);
  const lines = [];

  lines.push('/**');
  lines.push(' * Pre-compiled hex/elf binaries for instant simulation.');
  lines.push(` * Auto-generated on ${now} by scripts/precompile-guided-projects.mjs`);
  lines.push(' */');
  lines.push('');
  lines.push('const PRECOMPILED_BINARIES = {');

  for (const { slug, hex, board } of entries) {
    lines.push(`  "${slug}": {`);
    lines.push(`    hex: ${JSON.stringify(hex)},`);
    lines.push(`    board: ${JSON.stringify(board)}`);
    lines.push('  },');
  }

  lines.push('};');
  lines.push('');
  lines.push('export function getPrecompiledBinary(slug) {');
  lines.push('  return PRECOMPILED_BINARIES[slug] || null');
  lines.push('}');
  lines.push('');
  lines.push('export function hasPrecompiledBinary(slug) {');
  lines.push("  return !!PRECOMPILED_BINARIES[slug]");
  lines.push('}');
  lines.push('');
  lines.push('export function getAllPrecompiledSlugs() {');
  lines.push("  return Object.keys(PRECOMPILED_BINARIES)");
  lines.push('}');
  lines.push('');
  lines.push('export function setPrecompiledBinary(slug, hex, board = \'arduino:avr:uno\') {');
  lines.push("  PRECOMPILED_BINARIES[slug] = { hex, board }");
  lines.push('}');
  lines.push('');
  lines.push('export default PRECOMPILED_BINARIES');

  fs.writeFileSync(BINARIES_JS, lines.join('\n') + '\n', 'utf-8');
  console.log(`✅ Wrote ${entries.length} pre-compiled binaries to ${BINARIES_JS}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
/**
 * ============================================================
 * MOCK DEMO: Import-Chain Tracer Verification
 * ============================================================
 * This script creates a synthetic "mini-workspace" in a temp
 * directory and proves that the import-chain tracer correctly
 * surfaces transitive dependents when a deeply-nested file changes.
 *
 * Scenario:
 *   simulate-core.ts     (core timer utility, CHANGED in PR)
 *       ↑ imported by
 *   avr-runner.ts        (board runner - NOT directly changed)
 *       ↑ imported by
 *   grading-engine.ts    (grading worker - NOT directly changed)
 *
 * Expected result:
 *   Even though only simulate-core.ts changed, the tracer should
 *   flag BOTH avr-runner.ts AND grading-engine.ts as transitive
 *   suspects, and find the keyword "pinToggle" in avr-runner.ts.
 * ============================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Create a temp workspace ───────────────────────────────────
const MOCK_DIR = path.join(os.tmpdir(), `openhw-chain-mock-${Date.now()}`);
fs.mkdirSync(MOCK_DIR, { recursive: true });

console.log(`\n📁 Mock workspace: ${MOCK_DIR}\n`);

// ── Write mock source files ───────────────────────────────────

// Level 1: Core utility — this is what the PR changes
fs.writeFileSync(path.join(MOCK_DIR, 'simulate-core.ts'), `
// simulate-core.ts — Core timer and clock utility
export const CPU_FREQ = 16_000_000;

export function computeTickInterval(speed: number): number {
  return 1000 / (CPU_FREQ * speed);
}

export function advanceClock(ticks: number, speed: number): number {
  // BUG INTRODUCED HERE: should be ticks / CPU_FREQ but is now ticks * CPU_FREQ
  return ticks * CPU_FREQ * speed; 
}
`, 'utf8');

// Level 2: AVR runner — imports simulate-core (not directly changed)
fs.writeFileSync(path.join(MOCK_DIR, 'avr-runner.ts'), `
// avr-runner.ts — AVR board runner
import { advanceClock, computeTickInterval } from './simulate-core';

let pinToggleCount = 0;
let lastPinToggleTimeMs = 0;

export function executeCycle(ticks: number) {
  const simTime = advanceClock(ticks, 1.0);  // uses the changed utility
  if (simTime > lastPinToggleTimeMs + 500) {
    pinToggleCount++;
    lastPinToggleTimeMs = simTime;
  }
}

export function getPinToggleFrequency(): number {
  return pinToggleCount / (lastPinToggleTimeMs / 1000);
}
`, 'utf8');

// Level 3: Grading engine — imports avr-runner (not directly changed)
fs.writeFileSync(path.join(MOCK_DIR, 'grading-engine.ts'), `
// grading-engine.ts — Grading worker
import { executeCycle, getPinToggleFrequency } from './avr-runner';

export function runGradingSession(durationMs: number) {
  const ticks = Math.floor(durationMs * 16);
  executeCycle(ticks);
  return {
    frequency: getPinToggleFrequency(),
    score: 0
  };
}
`, 'utf8');

// Unrelated file — should NOT appear in transitive chain
fs.writeFileSync(path.join(MOCK_DIR, 'ai-audit.ts'), `
// ai-audit.ts — AI Semantic Auditor (does NOT import simulate-core)
export function computeCosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  return dot;
}
`, 'utf8');

// ── Copy the tracer functions inline for the mock ─────────────

function parseImports(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const importRe = /(?:import|export)\s[\s\S]*?from\s+['"](\.[^'"]+)['"]|(?:await\s+)?import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;
  const resolved = [];
  let match;
  while ((match = importRe.exec(content)) !== null) {
    const raw = match[1] || match[2];
    if (!raw) continue;
    let candidate = path.resolve(path.dirname(filePath), raw);
    if (!path.extname(candidate)) {
      for (const ext of ['.ts', '.tsx', '.js']) {
        if (fs.existsSync(candidate + ext)) { candidate = candidate + ext; break; }
      }
    }
    if (fs.existsSync(candidate)) resolved.push(candidate);
  }
  return resolved;
}

function collectSourceFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) result.push(full);
  }
  return result;
}

function buildReverseImportGraph(dirs) {
  const graph = new Map();
  const allFiles = [];
  for (const dir of dirs) allFiles.push(...collectSourceFiles(dir));
  for (const file of allFiles) {
    for (const dep of parseImports(file)) {
      if (!graph.has(dep)) graph.set(dep, []);
      graph.get(dep).push(file);
    }
  }
  return graph;
}

function findTransitiveDependents(changed, graph) {
  const visited = new Set();
  const queue = [changed];
  while (queue.length) {
    const cur = queue.shift();
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const dep of (graph.get(cur) || [])) {
      if (!visited.has(dep)) queue.push(dep);
    }
  }
  visited.delete(changed);
  return [...visited];
}

function scanFile(filePath, keywords) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const hits = [];
  const patterns = keywords.map(kw => ({
    kw,
    re: new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
  }));
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t.startsWith('//') || t.startsWith('*')) continue;
    if (/console\.(log|warn|error)/.test(t)) continue;
    const m = patterns.find(({ re }) => re.test(lines[i]));
    if (m) hits.push({ lineNo: i + 1, content: t, reason: m.kw });
  }
  return hits;
}

// ── Run the mock demonstration ────────────────────────────────

console.log('═══════════════════════════════════════════════════════');
console.log('   MOCK DEMO: Import-Chain Tracer');
console.log('═══════════════════════════════════════════════════════\n');

// Step 1: Simulate git diff — only simulate-core.ts was changed
const changedFile = path.join(MOCK_DIR, 'simulate-core.ts');
console.log('📌 PR changed file:');
console.log(`   ${path.basename(changedFile)}\n`);

// Step 2: Build the reverse import graph
const graph = buildReverseImportGraph([MOCK_DIR]);

console.log('📊 Reverse import graph built:');
for (const [dep, dependents] of graph.entries()) {
  console.log(`   ${path.basename(dep)} ← imported by: ${dependents.map(d => path.basename(d)).join(', ')}`);
}
console.log();

// Step 3: Find transitive dependents of the changed file
const transitiveDeps = findTransitiveDependents(changedFile, graph);

console.log('🔗 Transitive dependents found (files affected by the change):');
if (transitiveDeps.length === 0) {
  console.log('   ⚠️  NONE — graph may not be connected');
} else {
  for (const dep of transitiveDeps) {
    console.log(`   ✅ ${path.basename(dep)}`);
  }
}

// Step 4: Scan transitive dependents for the failing keyword
const keywords = ['pinToggle', 'frequency', 'advanceClock'];
console.log(`\n🔍 Scanning transitive dependents for keywords: [${keywords.join(', ')}]\n`);

for (const dep of transitiveDeps) {
  const hits = scanFile(dep, keywords);
  if (hits.length > 0) {
    console.log(`📍 ${path.basename(dep)}`);
    for (const hit of hits) {
      console.log(`   Line ${hit.lineNo}: ${hit.content}`);
      console.log(`   Reason: keyword "${hit.reason}" found here`);
    }
    console.log();
  } else {
    console.log(`   ${path.basename(dep)} — no keyword matches\n`);
  }
}

// Verify ai-audit.ts was NOT included (it's unrelated)
const aiFile = path.join(MOCK_DIR, 'ai-audit.ts');
const aiIncluded = transitiveDeps.includes(aiFile);

console.log('═══════════════════════════════════════════════════════');
console.log('   VERIFICATION RESULTS');
console.log('═══════════════════════════════════════════════════════\n');

const avrRunner   = path.join(MOCK_DIR, 'avr-runner.ts');
const gradingEng  = path.join(MOCK_DIR, 'grading-engine.ts');

const checks = [
  {
    label: 'avr-runner.ts flagged as transitive (imports simulate-core indirectly)',
    pass: transitiveDeps.includes(avrRunner),
  },
  {
    label: 'grading-engine.ts flagged as transitive (imports avr-runner → simulate-core)',
    pass: transitiveDeps.includes(gradingEng),
  },
  {
    label: 'ai-audit.ts NOT flagged (unrelated, no import chain to simulate-core)',
    pass: !aiIncluded,
  },
  {
    label: 'Keyword "pinToggle" or "advanceClock" found in avr-runner.ts via transitive scan',
    pass: transitiveDeps.includes(avrRunner) && scanFile(avrRunner, ['pinToggle', 'advanceClock']).length > 0,
  },
];

let allPassed = true;
for (const check of checks) {
  const icon = check.pass ? '✅' : '❌';
  console.log(`  ${icon} ${check.label}`);
  if (!check.pass) allPassed = false;
}

console.log();
if (allPassed) {
  console.log('🎉 ALL CHECKS PASSED — Import-chain tracer works correctly!\n');
} else {
  console.log('💥 SOME CHECKS FAILED — See above for details.\n');
  process.exit(1);
}

// Cleanup
fs.rmSync(MOCK_DIR, { recursive: true, force: true });
console.log('🧹 Cleaned up mock workspace.\n');

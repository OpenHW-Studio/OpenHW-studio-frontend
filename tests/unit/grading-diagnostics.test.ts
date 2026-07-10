/**
 * ============================================================
 * OpenHW Autograding CI/CD Diagnostic Analyzer
 * ============================================================
 * Run AFTER the Playwright grading-matrix test to analyze bundles.
 *
 * npm run test:diagnostics
 *
 * Tiers:
 *   1. Isolated failure     → blame component logic.ts in the emulator
 *   2. Board-wide failure   → blame the board runner (avr-runner.ts etc.)
 *   3. Global failure       → blame core engine (grading-engine / simulation.worker)
 *   + Git diff intersection → narrow to files changed in this PR
 * ============================================================
 */

import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Directories ────────────────────────────────────────────
const REPORTS_DIR  = path.resolve(__dirname, '..', 'fixtures', 'grading-reports');
const FRONTEND_DIR = path.resolve(__dirname, '..', '..');
const EMULATOR_DIR = path.resolve(FRONTEND_DIR, '..', 'openhw-studio-emulator', 'src', 'components');
const WORKER_DIR   = path.resolve(FRONTEND_DIR, 'src', 'worker');

// ─── Board → Runner mapping ─────────────────────────────────
// Key: prefix of the test bundle file name (e.g. "uno_" from "uno_buzzer_bundle.json")
const BOARD_RUNNER_MAP: Record<string, string> = {
  uno:    path.join(WORKER_DIR, 'runners', 'avr-runner.ts'),
  mega:   path.join(WORKER_DIR, 'runners', 'avr-runner.ts'),
  nano:   path.join(WORKER_DIR, 'runners', 'avr-runner.ts'),
  pico:   path.join(WORKER_DIR, 'runners', 'rp2040-runner.ts'),
  rp2040: path.join(WORKER_DIR, 'runners', 'rp2040-runner.ts'),
  esp32:  path.join(WORKER_DIR, 'runners', 'esp32-runner.ts'),
};

// ─── Core engine files ──────────────────────────────────────
const CORE_ENGINE_FILES = [
  path.join(WORKER_DIR, 'grading-engine.worker.ts'),
  path.join(WORKER_DIR, 'simulation.worker.ts'),
  path.join(WORKER_DIR, 'execute.ts'),
  path.join(WORKER_DIR, 'ai-audit-final.worker.ts'),
];

// ─── Component name → emulator folder mapping ───────────────
// Maps partial names extracted from bundle files to exact emulator directories
const COMPONENT_FOLDER_MAP: Record<string, string> = {
  led:     'openhw-led',
  buzzer:  'openhw-buzzer',
  servo:   'openhw-servo',
  button:  'openhw-pushbutton',
  lcd:     'openhw-lcd1602',
  oled:    'openhw-ssd1306-oled',
  pir:     'PIR-Motion-Sensor',
  motor:   'openhw-motor',
  relay:   'openhw-relay-module',
  keypad:  'openhw-membrane-keypad',
  pot:     'openhw-potentiometer',
  rgb:     'openhw-rgb-led',
  dht:     'openhw-dht22',
  mpu:     'openhw-mpu6050',
  neopixel:'openhw-neopixel-ring',
  stepper: 'openhw-stepper-motor',
};

// ─── Types ──────────────────────────────────────────────────
interface Issue {
  component: string;
  type: string;
  message: string;
  details?: string;
  codeSuspects?: CodeSuspect[];
}

interface CodeSuspect {
  file: string;
  lineNo: number;
  lineContent: string;
  context: string[];
  reason: string;
}

interface Bundle {
  component: string;
  board: string;        // e.g. "uno"
  componentType: string; // e.g. "buzzer"
  data: any;
}

// ─── Globals collected during tests ─────────────────────────
const reportIssues: Issue[] = [];
const allBundles: Bundle[] = [];

// ─── Load bundles synchronously (needed for describe blocks) ─
if (fs.existsSync(REPORTS_DIR)) {
  const files = fs.readdirSync(REPORTS_DIR).filter(f => f.endsWith('_bundle.json'));
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, file), 'utf8'));
      const baseName = file.replace('_bundle.json', ''); // e.g. "uno_buzzer"
      const [board, ...rest] = baseName.split('_');
      const componentType = rest.join('_');
      allBundles.push({ component: baseName, board, componentType, data });
    } catch (err) {
      console.error(`[Diagnostic] Failed to parse ${file}:`, err);
    }
  }
}

// ─── Utilities ───────────────────────────────────────────────

/**
 * Scan a file for lines matching a keyword using whole-word boundary regex.
 * Returns up to `maxHits` matches with ±contextLines lines of surrounding code.
 */
function scanFile(
  filePath: string,
  keywords: string[],
  maxHits = 4,
  contextLines = 2
): CodeSuspect[] {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const suspects: CodeSuspect[] = [];
  const seenLines = new Set<number>();

  // Build whole-word regex patterns for each keyword
  const patterns = keywords.map(kw => ({
    kw,
    re: new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
  }));

  for (let i = 0; i < lines.length && suspects.length < maxHits; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip pure comment lines
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    // Skip blank lines
    if (trimmed.length === 0) continue;
    // Skip lines that only match in string literals (console.log / postMessage noise)
    if (/console\.(log|warn|error|info)/.test(trimmed)) continue;
    if (/postMessage\(|sendJsonLog\(|self\.postMessage/.test(trimmed)) continue;

    const matched = patterns.find(({ re }) => re.test(line));
    if (!matched) continue;
    if (seenLines.has(i)) continue;
    seenLines.add(i);

    const from = Math.max(0, i - contextLines);
    const to   = Math.min(lines.length - 1, i + contextLines);
    const context = lines.slice(from, to + 1).map(
      (l, idx) => `${(from + idx + 1).toString().padStart(4)}: ${l}`
    );
    suspects.push({
      file: filePath,
      lineNo: i + 1,
      lineContent: line.trim(),
      context,
      reason: `Keyword match: "${matched.kw}"`,
    });
  }
  return suspects;
}

// Physical path of the emulator source (npm file: link)
const EMULATOR_SRC_DIR = path.resolve(FRONTEND_DIR, '..', 'openhw-studio-emulator', 'src');

/**
 * Get all files changed in the FULL PR (all commits) vs the base branch.
 * Strategy:
 *   1. Try  git diff origin/main...HEAD  (full PR diff — all commits)
 *   2. Fall back to  git diff HEAD~1 HEAD  (single commit — works locally)
 *   3. Fall back to empty list (not a git repo)
 * Also checks the emulator repo for changes (since it's a local npm link).
 */
function getGitChangedFiles(): string[] {
  const resolveFiles = (raw: string, baseDir: string) =>
    raw.split('\n')
       .map(f => path.resolve(baseDir, f.trim()))
       .filter(f => fs.existsSync(f));

  const tryDiff = (cmd: string, cwd: string): string[] => {
    try {
      const out = execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim();
      return out ? resolveFiles(out, cwd) : [];
    } catch { return []; }
  };

  // ── Frontend repo ────────────────────────────────────────────
  let frontendFiles =
    tryDiff('git diff --name-only origin/main...HEAD', FRONTEND_DIR);
  if (frontendFiles.length === 0)
    frontendFiles = tryDiff('git diff --name-only HEAD~1 HEAD', FRONTEND_DIR);

  // ── Emulator repo (local npm link) ───────────────────────────
  const EMULATOR_REPO = path.resolve(FRONTEND_DIR, '..', 'openhw-studio-emulator');
  let emulatorFiles =
    tryDiff('git diff --name-only origin/main...HEAD', EMULATOR_REPO);
  if (emulatorFiles.length === 0)
    emulatorFiles = tryDiff('git diff --name-only HEAD~1 HEAD', EMULATOR_REPO);

  return [...frontendFiles, ...emulatorFiles];
}

/**
 * Extract keywords from failing temporal/AI ids, e.g.:
 *   "pinstate:via_sig_buzzer_1_0:frequency" → ["frequency", "buzzer", "pinstate"]
 *   "led_1" → ["led"]
 */
function extractKeywords(failingIds: string[], componentType: string): string[] {
  const kws = new Set<string>([componentType]);
  for (const id of failingIds) {
    const parts = id.split(/[:._ ]/);
    for (const p of parts) {
      if (p.length > 3 && !['pinstate','pin','via','uno','esp32','pico'].includes(p.toLowerCase())) {
        kws.add(p.toLowerCase());
      }
    }
  }
  return [...kws];
}

/**
 * Determine the board prefix from the component name.
 */
function getBoardPrefix(component: string): string {
  return component.split('_')[0].toLowerCase();
}

/**
 * Find the emulator folder for a given componentType string.
 */
function getEmulatorComponentDir(componentType: string): string | null {
  for (const [key, dir] of Object.entries(COMPONENT_FOLDER_MAP)) {
    if (componentType.toLowerCase().includes(key)) {
      return path.join(EMULATOR_DIR, dir);
    }
  }
  return null;
}

// ─── Import-Chain Tracer ──────────────────────────────────────

/**
 * Parse all relative import paths from a TypeScript file.
 * Handles:
 *   import X from './foo'
 *   import { X } from '../bar/baz'
 *   await import('./utils')
 *   export * from './something'
 */
// Map @openhw/emulator package name to physical src folder
const PACKAGE_ALIAS_MAP: Record<string, string> = {
  '@openhw/emulator': path.join(EMULATOR_SRC_DIR, 'index.ts'),
};

function parseImports(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const resolved: string[] = [];

  // ── 1. Static relative imports ────────────────────────────────
  const relativeRe = /(?:import|export)\s[\s\S]*?from\s+['"](\.[^'"]+)['"]|(?:await\s+)?import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = relativeRe.exec(content)) !== null) {
    const raw = match[1] || match[2];
    if (!raw) continue;
    let candidate = path.resolve(path.dirname(filePath), raw);
    if (!path.extname(candidate)) {
      for (const ext of ['.ts', '.tsx', '.js', '.mjs']) {
        if (fs.existsSync(candidate + ext)) { candidate = candidate + ext; break; }
      }
      for (const ext of ['.ts', '.tsx', '.js']) {
        const idx = path.join(candidate, 'index' + ext);
        if (fs.existsSync(idx)) { candidate = idx; break; }
      }
    }
    if (fs.existsSync(candidate)) resolved.push(candidate);
  }

  // ── 2. Package alias resolution (@openhw/emulator etc.) ───────
  const packageRe = /from\s+['"](@[^'"]+)['"]/g;
  while ((match = packageRe.exec(content)) !== null) {
    const pkg = match[1];
    const mapped = PACKAGE_ALIAS_MAP[pkg];
    if (mapped && fs.existsSync(mapped)) resolved.push(mapped);
  }

  // ── 3. Dynamic imports with variable paths ─────────────────────
  // e.g. await import('./runners/' + boardType)  or  import(`./runners/${x}`)
  // We can't know the variable value, so we enumerate the directory.
  const dynamicDirRe = /import\s*\(\s*[`'"](\.[\/\w-]+\/)[`'"\s+]/g;
  while ((match = dynamicDirRe.exec(content)) !== null) {
    const dirPrefix = match[1];
    const resolvedDir = path.resolve(path.dirname(filePath), dirPrefix);
    if (fs.existsSync(resolvedDir) && fs.statSync(resolvedDir).isDirectory()) {
      // Add all .ts/.tsx files in that directory as potential targets
      for (const entry of fs.readdirSync(resolvedDir)) {
        if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts')) {
          resolved.push(path.join(resolvedDir, entry));
        }
      }
    }
  }

  return [...new Set(resolved)]; // deduplicate
}

/**
 * Collect all .ts / .tsx source files under a root directory (recursive).
 */
function collectSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const result: string[] = [];
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(full); }
      else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        result.push(full);
      }
    }
  };
  walk(dir);
  return result;
}

/**
 * Build a REVERSE dependency graph for all source files under the given root dirs.
 * reverseGraph[B] = [A, C, ...]  means A and C both import B.
 * So if B changes, A and C are also affected.
 */
function buildReverseImportGraph(rootDirs: string[]): Map<string, string[]> {
  const reverseGraph = new Map<string, string[]>();
  const allFiles: string[] = [];
  for (const dir of rootDirs) allFiles.push(...collectSourceFiles(dir));

  for (const file of allFiles) {
    for (const dep of parseImports(file)) {
      if (!reverseGraph.has(dep)) reverseGraph.set(dep, []);
      reverseGraph.get(dep)!.push(file);
    }
  }
  return reverseGraph;
}

/**
 * Given a changed file, walk the reverse graph to find ALL files that
 * transitively depend on it (i.e., would be affected if it changes).
 * Uses BFS to detect and report circular imports.
 * Returns { dependents, circularWarnings }
 */
function findTransitiveDependents(
  changedFile: string,
  reverseGraph: Map<string, string[]>
): { dependents: string[]; circularWarnings: string[] } {
  const visited   = new Set<string>();
  const inQueue   = new Set<string>(); // tracks nodes currently in BFS queue
  const circularWarnings: string[] = [];
  const queue = [changedFile];
  inQueue.add(changedFile);

  while (queue.length) {
    const current = queue.shift()!;
    inQueue.delete(current);
    if (visited.has(current)) continue;
    visited.add(current);

    for (const dependent of (reverseGraph.get(current) || [])) {
      if (inQueue.has(dependent)) {
        // Already queued → circular import detected
        const relCurrent   = path.relative(FRONTEND_DIR, current);
        const relDependent = path.relative(FRONTEND_DIR, dependent);
        circularWarnings.push(`${relCurrent} ↔ ${relDependent}`);
        continue;
      }
      if (!visited.has(dependent)) {
        queue.push(dependent);
        inQueue.add(dependent);
      }
    }
  }
  visited.delete(changedFile);
  return { dependents: [...visited], circularWarnings };
}

// ─── Main afterAll: generate the markdown report ─────────────
afterAll(() => {
  const gitChangedFiles = getGitChangedFiles();
  const totalComponents = allBundles.length;
  const failingComponents = [...new Set(reportIssues.map(i => i.component))];
  const failCount = failingComponents.length;

  // ── Tier determination ────────────────────────────────────
  //  < 25%  failing → Isolated (component logic)
  //  25-75% failing → Board-level (runner)
  //  > 75%  failing → Global (core engine)
  const failRatio = totalComponents > 0 ? failCount / totalComponents : 0;
  let tier: 'ISOLATED' | 'BOARD' | 'GLOBAL' = 'ISOLATED';
  if (failRatio > 0.75) tier = 'GLOBAL';
  else if (failRatio >= 0.25) tier = 'BOARD';

  // Group failing components by board prefix
  const boardGroups: Record<string, string[]> = {};
  for (const comp of failingComponents) {
    const prefix = getBoardPrefix(comp);
    if (!boardGroups[prefix]) boardGroups[prefix] = [];
    boardGroups[prefix].push(comp);
  }

  // Collect code suspects per issue
  for (const issue of reportIssues) {
    const bundle = allBundles.find(b => b.component === issue.component);
    if (!bundle) continue;

    const boardPrefix = getBoardPrefix(issue.component);
    const runnerFile  = BOARD_RUNNER_MAP[boardPrefix];

    // Failing ids to extract keywords from
    const failingIds: string[] = [];
    if (issue.type.startsWith('TEMPORAL')) {
      failingIds.push(issue.message.replace('Mismatch on ', '').split(' ')[0]);
    }
    const keywords = extractKeywords(failingIds, bundle.componentType);

    const suspects: CodeSuspect[] = [];

    if (tier === 'GLOBAL') {
      // Scan core engine files
      for (const file of CORE_ENGINE_FILES) {
        suspects.push(...scanFile(file, keywords, 3));
      }
    } else if (tier === 'BOARD') {
      // Scan runner file for this board
      if (runnerFile) suspects.push(...scanFile(runnerFile, keywords, 4));
    } else {
      // Tier ISOLATED: scan emulator component folder
      const compDir = getEmulatorComponentDir(bundle.componentType);
      if (compDir) {
        for (const srcFile of ['logic.ts', 'validation.ts', 'index.ts']) {
          const full = path.join(compDir, srcFile);
          suspects.push(...scanFile(full, keywords, 3));
        }
      }
      // Also check if the runner was changed in this PR
      if (runnerFile && gitChangedFiles.includes(runnerFile)) {
        suspects.push(...scanFile(runnerFile, keywords, 2));
      }
    }

    // ── Direct git-changed file scan ──────────────────────────
    for (const changedFile of gitChangedFiles) {
      if (suspects.some(s => s.file === changedFile)) continue;
      if (
        changedFile.includes('runner') ||
        changedFile.includes('worker') ||
        changedFile.includes('component') ||
        changedFile.includes('emulator')
      ) {
        suspects.push(...scanFile(changedFile, keywords, 2));
      }
    }

    // ── Import-chain: transitive dependents + circular warnings ──
    if (gitChangedFiles.length > 0) {
      const reverseGraph = buildReverseImportGraph([
        WORKER_DIR,
        path.join(FRONTEND_DIR, 'src', 'utils'),
        EMULATOR_SRC_DIR,       // physical emulator src (covers @openhw/emulator)
        EMULATOR_DIR,           // individual component folders
      ]);

      const transitivelyAffected = new Set<string>();
      const allCircularWarnings: string[] = [];

      for (const changedFile of gitChangedFiles) {
        const { dependents, circularWarnings } = findTransitiveDependents(changedFile, reverseGraph);
        for (const dep of dependents) transitivelyAffected.add(dep);
        allCircularWarnings.push(...circularWarnings);
      }

      // Attach circular warnings to this issue so the report can surface them
      if (allCircularWarnings.length > 0) {
        if (!issue.details) issue.details = '';
        issue.details += ` | ⚠️ Circular imports detected: ${[...new Set(allCircularWarnings)].join('; ')}`;
      }

      for (const affectedFile of transitivelyAffected) {
        const rel = path.relative(FRONTEND_DIR, affectedFile);
        if (
          !rel.includes('node_modules') &&
          !rel.includes('.spec.') &&
          !rel.includes('.test.') &&
          (rel.includes('runner') || rel.includes('worker') || rel.includes('execute') ||
           rel.includes('logic') || rel.includes('validation') || rel.includes('simulation'))
        ) {
          if (suspects.some(s => s.file === affectedFile)) continue;
          const found = scanFile(affectedFile, keywords, 2);
          found.forEach(f => {
            f.reason = `[Transitive import] ${f.reason} — indirectly affected by PR change`;
          });
          suspects.push(...found);
        }
      }
    }

    issue.codeSuspects = suspects;
  }

  // ── Build Markdown ──────────────────────────────────────
  let md = `# 🔬 OpenHW Autograding CI Diagnostic Report\n\n`;
  md += `*Generated: ${new Date().toLocaleString()}*\n\n`;
  md += `---\n\n`;

  // Summary table
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n|---|---|\n`;
  md += `| Total components tested | ${totalComponents} |\n`;
  md += `| Components with issues | ${failCount} |\n`;
  md += `| Failure ratio | ${(failRatio * 100).toFixed(0)}% |\n`;
  md += `| Failure tier | **${tier}** |\n`;
  if (gitChangedFiles.length > 0) {
    md += `| Files changed in this PR | ${gitChangedFiles.length} |\n`;
  }
  md += `\n`;

  // Tier explanation
  if (tier === 'GLOBAL') {
    md += `> [!CAUTION]\n`;
    md += `> **GLOBAL ENGINE FAILURE** — Over 75% of components are failing. `;
    md += `This is almost certainly a regression in the core simulation engine, not individual components. `;
    md += `Suspect files: \`grading-engine.worker.ts\`, \`simulation.worker.ts\`, \`execute.ts\`.\n\n`;
  } else if (tier === 'BOARD') {
    const boardList = Object.keys(boardGroups).join(', ');
    md += `> [!WARNING]\n`;
    md += `> **BOARD-LEVEL FAILURE** — Multiple components on the same board(s) are failing (${boardList}). `;
    md += `This likely points to a regression in the board runner files.\n\n`;
    for (const [prefix, comps] of Object.entries(boardGroups)) {
      if (comps.length >= 2) {
        const runner = BOARD_RUNNER_MAP[prefix];
        md += `- **${prefix.toUpperCase()}** runner: \`${runner ? path.relative(FRONTEND_DIR, runner) : 'unknown'}\`\n`;
      }
    }
    md += `\n`;
  } else if (failCount > 0) {
    md += `> [!NOTE]\n`;
    md += `> **ISOLATED FAILURE** — Only specific components are failing. The issue is likely in the emulator component code, not the core engine.\n\n`;
  } else {
    md += `> [!TIP]\n`;
    md += `> ✅ **All components passed!** No regressions detected.\n\n`;
  }

  // Git changed files section
  if (gitChangedFiles.length > 0) {
    md += `## 📋 Files Changed in This PR\n\n`;
    for (const f of gitChangedFiles) {
      md += `- \`${path.relative(path.resolve(FRONTEND_DIR, '..'), f)}\`\n`;
    }
    md += `\n`;
  }

  // Per-component issues
  if (reportIssues.length > 0) {
    md += `## ⚠️ Component Failures\n\n`;
    const grouped = reportIssues.reduce((acc, issue) => {
      if (!acc[issue.component]) acc[issue.component] = [];
      acc[issue.component].push(issue);
      return acc;
    }, {} as Record<string, Issue[]>);

    for (const [comp, issues] of Object.entries(grouped)) {
      const bundle = allBundles.find(b => b.component === comp);
      const boardPrefix = getBoardPrefix(comp);
      const runnerFile = BOARD_RUNNER_MAP[boardPrefix];
      const compDir = bundle ? getEmulatorComponentDir(bundle.componentType) : null;

      md += `### ❌ ${comp}\n\n`;

      // Scores table
      if (bundle) {
        const r = bundle.data.grading_report;
        md += `| Score | Value |\n|---|---|\n`;
        md += `| Overall | ${r.score}% |\n`;
        md += `| Spatial | ${r.spatial_score}% |\n`;
        md += `| Logic | ${r.logic_score}% |\n`;
        md += `| Behavioral | ${r.behavioral_score}% |\n`;
        md += `| Code | ${r.code_score}% |\n`;
        md += `| Verified Code | ${r.verified_code_score}% |\n`;
        md += `| AI Semantic | ${r.ai_score ?? 'N/A'}% |\n\n`;
      }

      // Issues list
      md += `**Issues detected:**\n\n`;
      for (const issue of issues) {
        md += `- **[${issue.type}]** ${issue.message}\n`;
        if (issue.details) md += `  - *${issue.details}*\n`;
      }
      md += `\n`;

      // Targeted file hints
      md += `**📁 Source files to investigate:**\n\n`;
      if (compDir) {
        md += `- Emulator component: \`${path.relative(path.resolve(FRONTEND_DIR, '..'), compDir)}/logic.ts\`\n`;
        md += `- Emulator validation: \`${path.relative(path.resolve(FRONTEND_DIR, '..'), compDir)}/validation.ts\`\n`;
      }
      if (runnerFile) {
        md += `- Board runner: \`${path.relative(path.resolve(FRONTEND_DIR, '..'), runnerFile)}\`\n`;
      }
      for (const coreFile of CORE_ENGINE_FILES) {
        md += `- Core engine: \`${path.relative(path.resolve(FRONTEND_DIR, '..'), coreFile)}\`\n`;
      }
      md += `\n`;

      // Code suspects
      const allSuspects = issues.flatMap(i => i.codeSuspects || []);
      if (allSuspects.length > 0) {
        md += `**🔍 Probable culprit code lines:**\n\n`;
        for (const suspect of allSuspects) {
          const relFile = path.relative(path.resolve(FRONTEND_DIR, '..'), suspect.file);
          md += `**\`${relFile}\` — Line ${suspect.lineNo}**\n`;
          md += `> *${suspect.reason}*\n\n`;
          md += `\`\`\`typescript\n`;
          md += suspect.context.join('\n');
          md += `\n\`\`\`\n\n`;
        }
      } else {
        md += `*No code suspects found via keyword scan.*\n\n`;
      }

      md += `---\n\n`;
    }
  } else {
    md += `## ✅ No Issues Found\n\nAll components passed their diagnostics.\n`;
  }

  // Footer
  md += `\n*Report generated by OpenHW CI Diagnostic Analyzer — Vitest*\n`;

  const reportPath = path.join(REPORTS_DIR, 'vitest_diagnostics_report.md');
  fs.writeFileSync(reportPath, md, 'utf8');
  console.log(`\n📝 Diagnostic report written to: ${reportPath}\n`);
});

// ─── Test Suite ───────────────────────────────────────────────
describe('OpenHW Autograding CI Diagnostic Analyzer', () => {

  it('should find bundle files to analyze', () => {
    if (allBundles.length === 0) {
      console.warn('[Diagnostic] No bundles found. Run the Playwright matrix test first.');
    }
    expect(allBundles.length).toBeGreaterThan(0);
  });

  allBundles.forEach(({ component, data }) => {
    describe(`${component}`, () => {
      const report = data.grading_report;

      it('overall score >= 90%', () => {
        if (report.score < 100) {
          reportIssues.push({
            component,
            type: 'OVERALL_SCORE',
            message: `Score was ${report.score}% (expected 100%)`,
            details: `Spatial: ${report.spatial_score}%, Logic: ${report.logic_score}%, Behavioral: ${report.behavioral_score}%, Code: ${report.code_score}%, Verified: ${report.verified_code_score}%`,
          });
        }
        expect(report.score, `${component}: score below 90%`).toBeGreaterThanOrEqual(90);
      });

      it('temporal breakdown: all pins/components 100% match', () => {
        const breakdown = report.temporal_breakdown;
        if (!breakdown || !Array.isArray(breakdown.id_stats)) {
          reportIssues.push({ component, type: 'TEMPORAL_MISSING', message: 'temporal_breakdown is missing from bundle' });
          return;
        }
        const failing = breakdown.id_stats.filter((s: any) => s.match_percentage < 100);
        failing.forEach((stat: any) => {
          reportIssues.push({
            component,
            type: `TEMPORAL_${stat.id_type.toUpperCase()}`,
            message: `Mismatch on "${stat.id}" — ${stat.match_percentage.toFixed(1)}% match`,
            details: `Teacher: ${stat.teacher_event_count} events, Student: ${stat.student_event_count} events, Matched: ${stat.matched_events}`,
          });
        });
        if (failing.length > 0) {
          console.warn(`[${component}] ${failing.length} temporal mismatches: ${failing.map((s: any) => s.id).join(', ')}`);
        }
      });

      it('AI semantic score reported', () => {
        const aiScore = report.ai_score ?? null;
        if (aiScore === null) {
          reportIssues.push({ component, type: 'AI_MISSING', message: 'AI Semantic score is not present in bundle' });
        } else if (aiScore < 80) {
          reportIssues.push({
            component,
            type: 'AI_SEMANTIC',
            message: `AI Semantic Score dropped to ${aiScore}%`,
            details: `Functional match: ${report.ai_functional_match}%, Electrical match: ${report.ai_electrical_match}%`,
          });
        }
      });

      it('verified code score >= 90%', () => {
        if (report.verified_code_score < 90) {
          reportIssues.push({
            component,
            type: 'STATIC_ANALYSIS',
            message: `Verified Code Score dropped to ${report.verified_code_score}%`,
            details: `Code score: ${report.code_score}%, Pin fidelity: ${report.pin_fidelity}%`,
          });
        }
        expect(report.verified_code_score, `${component}: verified_code_score below 90%`).toBeGreaterThanOrEqual(90);
      });

      it('no critical feedback errors', () => {
        const criticalFeedback = (report.feedback || []).filter(
          (f: string) => f.toLowerCase().includes('error') || f.toLowerCase().includes('fail')
        );
        if (criticalFeedback.length > 0) {
          reportIssues.push({
            component,
            type: 'FEEDBACK_ERRORS',
            message: `${criticalFeedback.length} critical feedback items found`,
            details: criticalFeedback.join(' | '),
          });
        }
      });
    });
  });
});

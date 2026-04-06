import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');
const matrixOutDir = path.join(workspaceRoot, 'temp', 'cli-hw-matrix');

const EXPECTED_CASE_IDS = [
  'case1-pico-ws2812b',
  'case2-pico-servo-potentiometer',
  'case3-pico-max7219-dot-matrix',
  'case4-pico-uart-loopback',
  'case5-pico2pico-uart',
  'case6-uno2uno-uart',
  'case7-pico2uno-uart',
  'case8-arduino-multifile-ino-h-cpp',
  'case9-micropython-multifile-py',
  'case10-pico-micropython-mixed-components',
  'case11-pico-oled-ino',
  'case12-circuitpython-multifile-py',
  'case13-pico-micropython-mixed-io-serial',
  'case14-pico-circuitpython-mixed-io-serial',
];

function isFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n);
}

function deriveFaultCount(report) {
  const details = report?.details && typeof report.details === 'object' ? report.details : {};

  if (isFiniteNumber(details.faultCount)) {
    return Math.max(0, Math.floor(Number(details.faultCount)));
  }

  const byBoard = details.faultCountByBoard;
  if (byBoard && typeof byBoard === 'object') {
    return Object.values(byBoard).reduce((sum, value) => {
      const n = isFiniteNumber(value) ? Number(value) : 0;
      return sum + Math.max(0, Math.floor(n));
    }, 0);
  }

  return 0;
}

function findLatestMatrixJson() {
  if (!fs.existsSync(matrixOutDir)) {
    throw new Error(`Matrix output directory not found: ${matrixOutDir}`);
  }

  const entries = fs
    .readdirSync(matrixOutDir)
    .filter((name) => /^cli-hw-matrix-.*\.json$/i.test(name))
    .map((name) => ({
      name,
      abs: path.join(matrixOutDir, name),
      mtime: fs.statSync(path.join(matrixOutDir, name)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (!entries.length) {
    throw new Error(`No matrix JSON artifacts found in ${matrixOutDir}`);
  }

  return entries[0].abs;
}

function parseExpectedCount() {
  const explicit = String(process.env.CLI_HW_MATRIX_EXPECTED_CASES || '').trim();
  if (explicit.length > 0) {
    const parsed = Number(explicit);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`Invalid CLI_HW_MATRIX_EXPECTED_CASES value: ${explicit}`);
    }
    return Math.floor(parsed);
  }

  if (String(process.env.CLI_SMOKE_CASES || '').trim()) {
    return null;
  }

  return EXPECTED_CASE_IDS.length;
}

function main() {
  const inputPath = String(process.env.CLI_HW_MATRIX_JSON || '').trim() || findLatestMatrixJson();
  const raw = fs.readFileSync(inputPath, 'utf8');
  const payload = JSON.parse(raw);
  const reports = Array.isArray(payload?.reports) ? payload.reports : [];

  const violations = [];
  const caseIds = [];

  for (const report of reports) {
    const caseId = String(report?.caseId || '').trim();
    const pass = !!report?.pass;
    const derivedFaultCount = deriveFaultCount(report);

    if (!caseId) {
      violations.push({ type: 'invalid-case-id', reason: 'Empty caseId in report entry.' });
      continue;
    }

    caseIds.push(caseId);

    if (pass && derivedFaultCount > 0) {
      violations.push({
        type: 'pass-fault-mismatch',
        caseId,
        pass,
        derivedFaultCount,
      });
    }

    const noFaultsFlag = report?.details?.behaviorChecks?.noFaults;
    if (noFaultsFlag === true && derivedFaultCount > 0) {
      violations.push({
        type: 'behavior-noFaults-mismatch',
        caseId,
        noFaultsFlag,
        derivedFaultCount,
      });
    }
  }

  const duplicates = caseIds.filter((id, idx) => caseIds.indexOf(id) !== idx);
  if (duplicates.length > 0) {
    violations.push({
      type: 'duplicate-case-id',
      duplicates: Array.from(new Set(duplicates)).sort((a, b) => a.localeCompare(b)),
    });
  }

  const expectedCount = parseExpectedCount();
  if (expectedCount !== null && reports.length !== expectedCount) {
    violations.push({
      type: 'unexpected-case-count',
      expected: expectedCount,
      actual: reports.length,
    });
  }

  if (expectedCount === EXPECTED_CASE_IDS.length) {
    const present = new Set(caseIds);
    const missing = EXPECTED_CASE_IDS.filter((id) => !present.has(id));
    if (missing.length > 0) {
      violations.push({
        type: 'missing-expected-cases',
        missing,
      });
    }
  }

  const summary = {
    sourceJson: inputPath,
    generatedAt: new Date().toISOString(),
    reportCount: reports.length,
    passedCount: reports.filter((r) => !!r?.pass).length,
    expectedCount,
    violations,
  };

  const outName = `cli-hw-matrix-guard-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const outPath = path.join(matrixOutDir, outName);
  fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(`[matrix-guard] source=${inputPath}`);
  console.log(`[matrix-guard] reports=${summary.reportCount} passed=${summary.passedCount}`);
  console.log(`[matrix-guard] summary=${outPath}`);

  if (violations.length > 0) {
    console.error(`[matrix-guard] FAIL violations=${violations.length}`);
    for (const violation of violations) {
      console.error(`- ${JSON.stringify(violation)}`);
    }
    process.exit(1);
  }

  console.log('[matrix-guard] PASS no consistency violations detected');
}

main();

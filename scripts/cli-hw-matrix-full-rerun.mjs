import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workspaceRoot = path.resolve(__dirname, '..', '..');
const frontendRoot = path.resolve(__dirname, '..');
const cliRoot = path.join(workspaceRoot, 'openhw-studio-cli-danish');
const matrixScriptPath = path.join(frontendRoot, 'src', 'worker', 'cli-hardware-compat-matrix.ts');
const matrixOutDir = path.join(workspaceRoot, 'temp', 'cli-hw-matrix');

const CASE_IDS = [
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

const caseTimeoutMs = Math.max(120_000, Number(process.env.CLI_HW_CASE_TIMEOUT_MS || 480_000));
const keepLogs = String(process.env.CLI_HW_KEEP_CASE_LOGS || '1').trim() !== '0';

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeName(value) {
  return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function latestMatrixJson() {
  if (!fs.existsSync(matrixOutDir)) return null;

  const entries = fs
    .readdirSync(matrixOutDir)
    .filter((name) => /^cli-hw-matrix-.*\.json$/i.test(name))
    .map((name) => {
      const abs = path.join(matrixOutDir, name);
      const stat = fs.statSync(abs);
      return {
        name,
        abs,
        mtimeMs: stat.mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return entries.length > 0 ? entries[0] : null;
}

function deriveFaultCount(report) {
  const details = report?.details && typeof report.details === 'object' ? report.details : {};

  if (Number.isFinite(Number(details.faultCount))) {
    return Math.max(0, Math.floor(Number(details.faultCount)));
  }

  const byBoard = details.faultCountByBoard;
  if (byBoard && typeof byBoard === 'object') {
    return Object.values(byBoard).reduce((sum, raw) => {
      const n = Number(raw);
      if (!Number.isFinite(n)) return sum;
      return sum + Math.max(0, Math.floor(n));
    }, 0);
  }

  return 0;
}

function strictStatusFromReport(report) {
  if (!report || typeof report !== 'object') return 'missing';

  const pass = !!report.pass;
  const faultCount = deriveFaultCount(report);
  if (pass && faultCount === 0) return 'pass';
  return 'fail';
}

function readReportForCase(jsonPath, caseId) {
  try {
    const payload = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const reports = Array.isArray(payload?.reports) ? payload.reports : [];
    const report = reports.find((entry) => String(entry?.caseId || '') === caseId) || null;
    return report;
  } catch {
    return null;
  }
}

function formatDuration(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m${String(s).padStart(2, '0')}s`;
}

async function runCase(caseId) {
  const startedAt = Date.now();
  const before = latestMatrixJson();

  let stdoutText = '';
  let stderrText = '';
  let timedOut = false;

  const command = `npm --prefix "${cliRoot}" exec -- tsx "${matrixScriptPath}"`;
  const child = spawn(command, {
    cwd: workspaceRoot,
    shell: true,
    env: {
      ...process.env,
      CLI_SMOKE_CASES: caseId,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    stdoutText += String(chunk || '');
  });

  child.stderr.on('data', (chunk) => {
    stderrText += String(chunk || '');
  });

  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }, 5000);
  }, caseTimeoutMs);

  const exit = await new Promise((resolve) => {
    child.on('error', (error) => {
      resolve({ code: null, signal: null, error: String(error?.message || error) });
    });

    child.on('exit', (code, signal) => {
      resolve({ code, signal, error: null });
    });
  });

  clearTimeout(timeout);
  const endedAt = Date.now();

  const after = latestMatrixJson();
  const candidateJson = (
    after
    && (!before || after.mtimeMs > before.mtimeMs)
    && fs.existsSync(after.abs)
  )
    ? after.abs
    : null;

  let report = null;
  if (candidateJson) {
    report = readReportForCase(candidateJson, caseId);
  }

  if (!report && after && fs.existsSync(after.abs)) {
    report = readReportForCase(after.abs, caseId);
  }

  const strictStatus = timedOut
    ? 'timeout'
    : strictStatusFromReport(report);

  const logBase = sanitizeName(`${new Date().toISOString()}-${caseId}`);
  const stdoutPath = path.join(matrixOutDir, `${logBase}.stdout.log`);
  const stderrPath = path.join(matrixOutDir, `${logBase}.stderr.log`);

  if (keepLogs) {
    fs.writeFileSync(stdoutPath, stdoutText || '', 'utf8');
    fs.writeFileSync(stderrPath, stderrText || '', 'utf8');
  }

  return {
    caseId,
    strictStatus,
    durationMs: endedAt - startedAt,
    timedOut,
    processExitCode: exit.code,
    processSignal: exit.signal,
    processError: exit.error,
    sourceJson: candidateJson || (after ? after.abs : null),
    reportPass: report ? !!report.pass : null,
    faultCount: report ? deriveFaultCount(report) : null,
    summary: report ? String(report.summary || '') : '',
    stdoutLog: keepLogs ? stdoutPath : null,
    stderrLog: keepLogs ? stderrPath : null,
  };
}

async function main() {
  ensureDir(matrixOutDir);

  const rows = [];
  for (const caseId of CASE_IDS) {
    process.stdout.write(`[full-rerun] ${caseId} ... `);
    const row = await runCase(caseId);
    rows.push(row);
    process.stdout.write(`${row.strictStatus} (${formatDuration(row.durationMs)})\n`);
  }

  const counts = {
    total: rows.length,
    pass: rows.filter((row) => row.strictStatus === 'pass').length,
    fail: rows.filter((row) => row.strictStatus === 'fail').length,
    timeout: rows.filter((row) => row.strictStatus === 'timeout').length,
    missing: rows.filter((row) => row.strictStatus === 'missing').length,
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(matrixOutDir, `cli-hw-matrix-full-rerun-${stamp}.json`);
  const mdPath = path.join(matrixOutDir, `cli-hw-matrix-full-rerun-${stamp}.md`);

  const payload = {
    generatedAt: new Date().toISOString(),
    workspaceRoot,
    caseTimeoutMs,
    counts,
    rows,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const mdLines = [];
  mdLines.push('# Full Matrix Strict Table');
  mdLines.push('');
  mdLines.push(`Generated at: ${payload.generatedAt}`);
  mdLines.push(`Case timeout: ${caseTimeoutMs} ms`);
  mdLines.push(`Counts: pass=${counts.pass}, fail=${counts.fail}, timeout=${counts.timeout}, missing=${counts.missing}, total=${counts.total}`);
  mdLines.push('');
  mdLines.push('| Case ID | Strict Status | pass | faultCount | duration | sourceJson |');
  mdLines.push('| --- | --- | --- | --- | --- | --- |');

  for (const row of rows) {
    mdLines.push(`| ${row.caseId} | ${row.strictStatus} | ${row.reportPass ?? '-'} | ${row.faultCount ?? '-'} | ${formatDuration(row.durationMs)} | ${row.sourceJson || '-'} |`);
  }

  fs.writeFileSync(mdPath, `${mdLines.join('\n')}\n`, 'utf8');

  console.log(`[full-rerun] json=${jsonPath}`);
  console.log(`[full-rerun] markdown=${mdPath}`);
  console.log(`[full-rerun] counts pass=${counts.pass} fail=${counts.fail} timeout=${counts.timeout} missing=${counts.missing} total=${counts.total}`);

  if (counts.fail > 0 || counts.timeout > 0 || counts.missing > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`[full-rerun] FAIL ${String(error?.message || error)}`);
  process.exit(1);
});
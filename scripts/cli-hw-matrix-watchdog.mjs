import { spawn } from 'node:child_process';

const timeoutMs = Math.max(120_000, Number(process.env.CLI_HW_MATRIX_TIMEOUT_MS || 3_600_000));
const command = 'npx --yes tsx src/worker/cli-hardware-compat-matrix.ts';

const child = spawn(command, {
  stdio: 'inherit',
  cwd: process.cwd(),
  shell: true,
});

let timedOut = false;
const timer = setTimeout(() => {
  timedOut = true;
  console.error(`[matrix-watchdog] timeout after ${timeoutMs}ms; terminating matrix process`);
  child.kill('SIGTERM');
  setTimeout(() => {
    if (!child.killed) {
      child.kill('SIGKILL');
    }
  }, 5000);
}, timeoutMs);

child.on('exit', (code, signal) => {
  clearTimeout(timer);

  if (timedOut) {
    console.error('[matrix-watchdog] MATRIX_WATCHDOG_DONE status=timeout');
    process.exit(124);
  }

  if (signal) {
    console.error(`[matrix-watchdog] MATRIX_WATCHDOG_DONE status=signal signal=${signal}`);
    process.exit(1);
  }

  const exitCode = Number(code ?? 1);
  console.log(`[matrix-watchdog] MATRIX_WATCHDOG_DONE status=exit code=${exitCode}`);
  process.exit(exitCode);
});

child.on('error', (err) => {
  clearTimeout(timer);
  console.error(`[matrix-watchdog] failed to start matrix run: ${String(err?.message || err)}`);
  process.exit(1);
});

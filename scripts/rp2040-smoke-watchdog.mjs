import { spawn } from 'node:child_process';

const timeoutMs = Math.max(30_000, Number(process.env.SMOKE_TIMEOUT_MS || 240_000));
const command = 'npx --yes tsx src/worker/rp2040-smoke-matrix.ts';

const child = spawn(command, {
  stdio: 'inherit',
  cwd: process.cwd(),
  shell: true,
});

let timedOut = false;
const timer = setTimeout(() => {
  timedOut = true;
  console.error(`[smoke-watchdog] timeout after ${timeoutMs}ms; terminating smoke process`);
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
    console.error('[smoke-watchdog] SMOKE_WATCHDOG_DONE status=timeout');
    process.exit(124);
  }

  if (signal) {
    console.error(`[smoke-watchdog] SMOKE_WATCHDOG_DONE status=signal signal=${signal}`);
    process.exit(1);
  }

  const exitCode = Number(code ?? 1);
  console.log(`[smoke-watchdog] SMOKE_WATCHDOG_DONE status=exit code=${exitCode}`);
  process.exit(exitCode);
});

child.on('error', (err) => {
  clearTimeout(timer);
  console.error(`[smoke-watchdog] failed to start smoke matrix: ${String(err?.message || err)}`);
  process.exit(1);
});

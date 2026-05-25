import QemuRunner from './utils/qemuRunner.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const BUILDS_DIR = path.resolve(__dirname, '../../builds');
const SESSION_TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS || String(5 * 60 * 1000), 10);

export const activeRunners = new Map();

export function cleanupBuild(buildId) {
    activeRunners.delete(buildId);
    const buildFolder = path.join(BUILDS_DIR, buildId);
    try {
        if (fs.existsSync(buildFolder)) {
            fs.rmSync(buildFolder, { recursive: true, force: true });
        }
    } catch (e) {
        console.error(`Failed to delete build folder ${buildFolder}:`, e);
    }
}

const gcInterval = setInterval(() => {
    const now = Date.now();
    for (const [buildId, runner] of activeRunners.entries()) {
        if (now - runner.lastActivity > SESSION_TIMEOUT_MS) {
            console.log(`⏱️  Session ${buildId} timed out — killing QEMU`);
            runner.kill();
            cleanupBuild(buildId);
        }
    }
}, 60_000);
gcInterval.unref();

export function startRunner(buildId, mergedFlash, pipesDir) {
    const runner = new QemuRunner(buildId, mergedFlash, pipesDir);
    activeRunners.set(buildId, runner);
    runner.start();
    return runner;
}

export function stopRunner(buildId) {
    const runner = activeRunners.get(buildId);
    if (runner) {
        runner.kill();
        cleanupBuild(buildId);
        return true;
    }
    return false;
}

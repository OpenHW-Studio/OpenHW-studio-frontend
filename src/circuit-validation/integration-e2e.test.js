import assert from 'node:assert';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Autofix integration (CLI + MCP controller)', () => {
  it('CLI runner returns a JSON result when applied to minimal project', () => {
    const tmpDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const project = {
      components: [ { id: 'board', type: 'wokwi-board' }, { id: 'led1', type: 'LED' } ],
      connections: []
    };

    const projFile = path.join(tmpDir, 'e2e_project.json');
    fs.writeFileSync(projFile, JSON.stringify(project));

    const cliScript = path.resolve(__dirname, '..', '..', '..', 'openhw-studio-cli', 'bin', 'run-autofix.mjs');
    const res = spawnSync(process.execPath, [cliScript, projFile], { encoding: 'utf8' });
    assert.strictEqual(res.status, 0);
    // CLI prints JSON; ensure valid JSON parsed
    const out = res.stdout.trim();
    // CLI prints logs followed by a JSON payload; extract first JSON object
    const firstBrace = out.indexOf('{');
    assert.ok(firstBrace >= 0, 'No JSON payload found in CLI output');
    const jsonText = out.slice(firstBrace);
    const parsed = JSON.parse(jsonText);
    assert.ok(parsed && typeof parsed === 'object');
    // result should include applied (boolean) or reason
    assert.ok('applied' in parsed || 'reason' in parsed || 'components' in parsed);
  });

  it('MCP controller returns JSON result when called directly', async () => {
    const controllerPath = path.resolve(__dirname, '..', '..', '..', 'openhw-studio-backend', 'src', 'controllers', 'autofixController.js');
    const mod = await import(new URL('file://' + controllerPath).href);
    const fn = mod.runAutofixController;
    assert.ok(typeof fn === 'function');

    const project = {
      components: [ { id: 'board', type: 'wokwi-board' }, { id: 'led1', type: 'LED' } ],
      connections: []
    };

    // mock req/res
    const req = { body: { project, issue: { message: 'missing_ground_connection', compIds: ['led1'] } } };
    let sent = null;
    const res = {
      status(code) { this._status = code; return this; },
      json(payload) { sent = payload; return this; }
    };

    await fn(req, res);
    assert.ok(sent && typeof sent === 'object');
    assert.ok('applied' in sent || 'reason' in sent || 'components' in sent);
  });
});

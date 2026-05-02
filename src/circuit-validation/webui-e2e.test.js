import assert from 'node:assert';
import { describe, it } from 'node:test';
import path from 'node:path';
import express from 'express';

describe('WebUI E2E: backend autofix endpoint', () => {
  it('mounts controller on lightweight express server and handles POST /api/autofix', async () => {
    // Import the actual controller from the backend
    const controllerPath = path.resolve(process.cwd(), '..', 'openhw-studio-backend', 'src', 'controllers', 'autofixController.js');
    const mod = await import(new URL('file://' + controllerPath).href);
    const runAutofixController = mod.runAutofixController;
    assert.ok(typeof runAutofixController === 'function', 'runAutofixController not found');

    // Create lightweight express server with just the necessary endpoints
    const app = express();
    app.use(express.json({ limit: '5mb' }));
    app.get('/api/components/version', (req, res) => res.json({ version: 'test' }));
    app.post('/api/autofix', (req, res) => runAutofixController(req, res));

    const server = app.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr?.port ? addr.port : 0;
    const base = `http://127.0.0.1:${port}`;

    // Verify server is listening
    let ok = false;
    for (let i = 0; i < 40; i++) {
      try {
        const r = await fetch(base + '/api/components/version');
        if (r.ok) { ok = true; break; }
      } catch (err) {
        // not ready yet
      }
      await new Promise(r => setTimeout(r, 100));
    }
    assert.ok(ok, 'test server failed to respond');

    // POST to /api/autofix endpoint (simulating WebUI client)
    const project = { components: [ { id: 'board', type: 'wokwi-board' }, { id: 'led1', type: 'LED' } ], connections: [] };
    const issue = { message: 'missing_ground_connection', compIds: ['led1'] };

    const resp = await fetch(base + '/api/autofix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, issue })
    });
    assert.ok(resp.ok, 'autofix endpoint returned non-ok status ' + resp.status);
    const json = await resp.json();
    assert.ok(json && typeof json === 'object', 'response is not JSON object');
    assert.ok('applied' in json || 'reason' in json || 'components' in json, 'response missing expected fields');

    server.close();
  });
});

import assert from 'node:assert';
import { describe, it } from 'node:test';
import path from 'node:path';

describe('WebUI E2E: backend autofix controller (mocked request/response)', () => {
  it('handles POST payload with project and issue, returns autofix result', async () => {
    // Import the actual controller from the backend
    const controllerPath = path.resolve(process.cwd(), '..', 'openhw-studio-backend', 'src', 'controllers', 'autofixController.js');
    const mod = await import(new URL('file://' + controllerPath).href);
    const runAutofixController = mod.runAutofixController;
    assert.ok(typeof runAutofixController === 'function', 'runAutofixController not found');

    // Simulate WebUI client POSTing /api/autofix
    const project = { 
      components: [ { id: 'board', type: 'wokwi-board' }, { id: 'led1', type: 'LED' } ], 
      connections: [] 
    };
    const issue = { message: 'missing_ground_connection', compIds: ['led1'] };

    // Mock Express req/res
    let responseSent = null;
    const mockReq = {
      body: { project, issue }
    };
    const mockRes = {
      status(code) { this._status = code; return this; },
      json(payload) { responseSent = payload; return this; }
    };

    // Call the controller
    await runAutofixController(mockReq, mockRes);

    // Verify response
    assert.ok(responseSent !== null, 'controller did not send response');
    assert.ok(typeof responseSent === 'object', 'response is not an object');
    assert.ok('applied' in responseSent || 'reason' in responseSent || 'components' in responseSent, 
      'response missing expected fields: ' + JSON.stringify(responseSent));
  });
});

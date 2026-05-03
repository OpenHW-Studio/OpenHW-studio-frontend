import assert from 'node:assert';
import { describe, it } from 'node:test';
import { runAutoFixAll, undoLastFix } from '../index.js';

describe('runAutoFixAll planner (dry-run + apply + rollback)', () => {
  it('returns a dry-run plan with changeSet when previewing fixes', async () => {
    const project = {
      components: [ { id: 'board1', type: 'pico' }, { id: 'led1', type: 'LED' } ],
      connections: []
    };

    const issues = [ { message: 'Missing ground', remediation: 'connect to GND', compIds: ['led1'], id: 'missing_ground' } ];

    const res = await runAutoFixAll(project, issues, { apply: false, quiet: true });
    assert.ok(res, 'no result returned');
    assert.strictEqual(typeof res, 'object');
    assert.ok(Array.isArray(res.appliedPlan), 'appliedPlan missing');
    assert.ok(res.finalProject, 'finalProject missing');
    // Ensure a connection to GND was suggested in the dry-run project
    const connHasGnd = (res.finalProject.connections || []).some(c => String(c.from).includes('GND') || String(c.to).includes('GND'));
    assert.ok(connHasGnd, 'dry-run did not include ground connection');
  });

  it('applies fixes when requested and supports undo rollback', async () => {
    const project = {
      components: [ { id: 'board1', type: 'pico' }, { id: 'led2', type: 'LED' } ],
      connections: []
    };

    const issues = [ { message: 'Missing ground', remediation: 'connect to GND', compIds: ['led2'], id: 'missing_ground' } ];

    const res = await runAutoFixAll(project, issues, { apply: true, quiet: true });
    assert.ok(res.applied, 'apply did not report applied');
    // Project object should be mutated when apply:true
    assert.ok((project.connections || []).length > 0, 'project was not mutated by apply');

    // Undo the last fix
    const undo = undoLastFix();
    assert.ok(undo, 'undo result missing');
    assert.ok(undo.undone || undo.redone !== undefined, 'undo did not report undone');
    // After undo, undo.circuit should reflect previous state with no added connections
    const after = undo.circuit || {};
    const connCount = (after.connections || []).length;
    assert.strictEqual(connCount, 0, 'undo did not revert connections');
  });
});

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { CircuitFixValidator } from './circuit-fix-validator.js';

describe('CircuitFixValidator', () => {
  it('verifies successful fix when original error removed', async () => {
    // Mock validator that returns no errors after fix
    const mockValidator = {
      async runValidation(circuit, opts) {
        return { errors: [] };
      }
    };

    const fixValidator = new CircuitFixValidator(mockValidator);
    const error = { id: 'missing_ground_connection' };
    const beforeCircuit = { errors: [ { id: 'missing_ground_connection' } ] };
    const afterCircuit = { errors: [] };

    const result = await fixValidator.verifyFix(error, beforeCircuit, afterCircuit);
    assert.strictEqual(result.verified, true);
    assert.strictEqual(result.newIssueCount, 0);
    assert.ok(result.confidence > 0);
  });

  it('detects new issues and lowers confidence', async () => {
    const mockValidator = {
      async runValidation(circuit, opts) {
        return { errors: [ { id: 'some_new_error', severity: 'warn' } ] };
      }
    };
    const fixValidator = new CircuitFixValidator(mockValidator);
    const error = { id: 'missing_ground_connection' };
    const beforeCircuit = { errors: [ { id: 'missing_ground_connection' } ] };
    const afterCircuit = { errors: [ { id: 'some_new_error', severity: 'warn' } ] };

    const result = await fixValidator.verifyFix(error, beforeCircuit, afterCircuit);
    assert.strictEqual(result.verified, true);
    assert.strictEqual(result.newIssueCount, 1);
    assert.ok(result.confidence < 1);
  });
});

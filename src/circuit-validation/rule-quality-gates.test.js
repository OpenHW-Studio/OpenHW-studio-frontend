import test from 'node:test';
import assert from 'node:assert/strict';

import { validationRules } from './rules/index.js';

const ALLOWED_SEVERITIES = new Set(['error', 'warn', 'info']);

test('validation rule metadata quality gates', () => {
  assert.ok(Array.isArray(validationRules) && validationRules.length > 0, 'validationRules must be non-empty');

  const seenIds = new Set();

  for (const rule of validationRules) {
    assert.equal(typeof rule.id, 'string', 'rule.id must be a string');
    assert.ok(rule.id.trim().length > 0, 'rule.id must be non-empty');
    assert.equal(typeof rule.description, 'string', `rule ${rule.id} must include description`);
    assert.equal(typeof rule.run, 'function', `rule ${rule.id} must include executable run function`);
    assert.ok(Number.isFinite(Number(rule.priority)), `rule ${rule.id} must include numeric priority`);

    const severity = String(rule.severity || '').toLowerCase();
    assert.ok(ALLOWED_SEVERITIES.has(severity), `rule ${rule.id} has invalid severity: ${severity}`);

    assert.ok(!seenIds.has(rule.id), `rule id must be unique: ${rule.id}`);
    seenIds.add(rule.id);
  }
});

test('expensive rules must declare profile scope', () => {
  for (const rule of validationRules) {
    if (!rule.expensive) continue;

    assert.ok(Array.isArray(rule.profiles) && rule.profiles.length > 0, `expensive rule ${rule.id} must define profiles`);
    const normalizedProfiles = rule.profiles.map((entry) => String(entry).toLowerCase());
    assert.ok(
      normalizedProfiles.includes('strict') || normalizedProfiles.includes('balanced'),
      `expensive rule ${rule.id} must be enabled in strict or balanced profile`
    );
  }
});

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { findApplicablePatterns, fixPatternsCatalog } from './fix-patterns-catalog.js';

describe('fix-patterns-catalog', () => {
  it('matches missing_ground_connection by message keyword', () => {
    const error = { message: 'missing ground connection detected on LED' };
    const patterns = findApplicablePatterns(error);
    assert.ok(Array.isArray(patterns));
    const ids = patterns.map(p => p.id);
    assert.ok(ids.includes('missing_ground_connection'));
  });

  it('estimates complexity correctly for simple patterns', () => {
    const pattern = fixPatternsCatalog.missing_ground_connection;
    assert.strictEqual(pattern.estimate.components, 0);
    assert.strictEqual(pattern.estimate.connections, 1);
  });
});

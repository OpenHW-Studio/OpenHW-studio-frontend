import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { FullCircuitValidator } from './engine.js';
import { formatValidationError, validationCases } from './validation-examples.js';
import { validateComponentManifest } from '../components/component-schema.js';
import { createValidationIssue } from '../components/component-schema.js';

for (const testCase of validationCases) {
    test(testCase.name, () => {
        const validator = new FullCircuitValidator(testCase.project);
        const passed = validator.runValidation();

        assert.equal(passed, testCase.expectPass, `${testCase.name} pass/fail mismatch`);

        if (testCase.expectMessageIncludes) {
            const hasExpectedMessage = validator.errors.some(error =>
                formatValidationError(error).includes(testCase.expectMessageIncludes)
            );
            assert.ok(hasExpectedMessage, `${testCase.name} should include message: ${testCase.expectMessageIncludes}`);
        }

        if (testCase.expectSeverity) {
            const severityMatch = validator.errors.some(error =>
                String(error.severity || error.type || '').toLowerCase() === testCase.expectSeverity
            );
            assert.ok(severityMatch, `${testCase.name} should include severity ${testCase.expectSeverity}`);
        }

        if (testCase.expectRuleId) {
            const ruleMatch = validator.errors.some(error => error.ruleId === testCase.expectRuleId || error.id === testCase.expectRuleId);
            assert.ok(ruleMatch, `${testCase.name} should include rule ${testCase.expectRuleId}`);
        }

        if (testCase.expectVoltageNode) {
            const voltage = validator.calculateVoltageAtNode(testCase.expectVoltageNode);
            const [minVoltage, maxVoltage] = testCase.expectVoltageRange;

            assert.ok(
                voltage >= minVoltage && voltage <= maxVoltage,
                `${testCase.name} expected ${testCase.expectVoltageNode} to be between ${minVoltage}V and ${maxVoltage}V, got ${voltage}V`
            );
        }
    });
}

test('structured errors carry normalized metadata', () => {
    const validator = new FullCircuitValidator(validationCases.find(testCase => testCase.name === 'component_validation_blocks_overvoltage').project);
    validator.runValidation();

    const error = validator.errors.find(entry => entry.ruleId === 'demo-sensor-vin');

    assert.ok(error, 'expected the demo sensor rule to emit an error');
    assert.equal(error.severity, 'error');
    assert.equal(error.type, 'error');
    assert.deepEqual(error.compIds, ['demo_1']);
    assert.match(error.message, /Demo sensor VIN is 5\.00 V/);
});

test('component manifest schema validates representative manifests', () => {
    const unoManifest = JSON.parse(readFileSync(new URL('../components/wokwi-arduino-uno/manifest.json', import.meta.url), 'utf8'));
    const maxManifest = JSON.parse(readFileSync(new URL('../components/max30102/manifest.json', import.meta.url), 'utf8'));

    for (const [name, manifest] of [
        ['wokwi-arduino-uno', unoManifest],
        ['max30102', maxManifest],
    ]) {
        const result = validateComponentManifest(manifest);
        assert.ok(result.valid, `${name} manifest should be valid: ${result.errors.join('; ')}`);
    }
});

test('auto-fix suggestions are inferred for common wiring issues', () => {
    const issue = createValidationIssue({
        message: '⚠️ [Pushbutton pb_1] Warning: Button is completely disconnected.',
        severity: 'warn',
    });

    assert.equal(issue.autoFix, true);
    assert.match(issue.remediation || '', /wire the pushbutton|wire the component/i);
});

test('fast-run profile ignores warning-only rules for pass/fail', () => {
    const warningCase = validationCases.find(testCase => testCase.name === 'component_validation_warns_but_passes');
    const validator = new FullCircuitValidator(warningCase.project);
    const passed = validator.runValidation({ profile: 'fast-run' });

    assert.equal(passed, true);
    assert.equal(validator.errors.length, 0, 'fast-run should suppress warn/info checks');
});

test('waivers suppress matching errors', () => {
    const failingCase = validationCases.find(testCase => testCase.name === 'component_validation_blocks_overvoltage');
    const validator = new FullCircuitValidator(failingCase.project);

    const passed = validator.runValidation({
        waivers: [
            {
                ruleId: 'demo-sensor-vin',
                componentId: 'demo_1',
                reason: 'temporary lab exception',
            },
        ],
    });

    assert.equal(passed, true, 'waiver should allow run by suppressing fatal issue');
    assert.equal(validator.errors.length, 0);
    assert.equal(validator.lastRunMeta.ignoredErrors.length, 1);
});

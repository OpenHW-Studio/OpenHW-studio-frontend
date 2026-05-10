import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Skip legacy JS autofix check (now moved to Rust engine)
/*
const scriptPath = path.resolve(__dirname, '..', '..', 'scripts', 'smoke_autofix.mjs');
try {
  await import(pathToFileURL(scriptPath).href);
} catch (err) {
  console.error('Smoke test failed:', err);
  process.exitCode = 2;
}
*/

function pathToFileURL(p) { return new URL(`file://${p}`); }
import { FullCircuitValidator } from './engine.js';
import { formatValidationError, validationCases } from './validation-examples.js';

function runCase(testCase) {
    const validator = new FullCircuitValidator(testCase.project);
    const passed = validator.runValidation();
    return {
        passed,
        errors: validator.errors,
    };
}

let failedCount = 0;

console.log('\\n[smoke] Circuit validation smoke tests');

validationCases.forEach((testCase) => {
    const result = runCase(testCase);
    const passMatches = result.passed === testCase.expectPass;
    const messageMatches =
        !testCase.expectMessageIncludes
            ? true
            : result.errors.some(err => formatValidationError(err).includes(testCase.expectMessageIncludes));

    const ok = passMatches && messageMatches;
    if (!ok) {
        failedCount += 1;
    }

    console.log(`\\n- ${testCase.name}: ${ok ? 'PASS' : 'FAIL'}`);
    console.log(`  expected pass: ${testCase.expectPass}, actual: ${result.passed}`);
    if (testCase.expectMessageIncludes) {
        console.log(`  expected message contains: "${testCase.expectMessageIncludes}"`);
    }
    if (result.errors.length) {
        result.errors.forEach(err => console.log(`  error: ${formatValidationError(err)}`));
    }
});

if (failedCount > 0) {
    console.error(`\\n[smoke] ${failedCount} case(s) failed.`);
    process.exit(1);
}

console.log('\\n[smoke] All smoke cases passed.');

import assert from 'node:assert';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Autofix integration (CLI + MCP controller)', () => {
  it.skip('CLI runner returns a JSON result when applied to minimal project', () => {
    const tmpDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const project = {
      components: [ { id: 'board', type: 'wokwi-board' }, { id: 'led1', type: 'LED' } ],
      connections: []
    };

    const projFile = path.join(tmpDir, 'e2e_project.json');
    fs.writeFileSync(projFile, JSON.stringify(project));

    const cliScript = path.resolve(__dirname, '..', '..', '..', 'openhw-studio-cli', 'bin', 'run-autofix.mjs');
    const res = spawnSync(process.execPath, [cliScript, projFile, '--json'], { encoding: 'utf8' });
    assert.strictEqual(res.status, 0);
    // CLI with --json flag outputs pure JSON
    const out = res.stdout.trim();
    assert.ok(out.startsWith('{'), 'JSON output should start with {');
    const parsed = JSON.parse(out);
    assert.ok(parsed && typeof parsed === 'object');
    assert.ok('applied' in parsed || 'reason' in parsed || 'components' in parsed);
  });

  it.skip('CLI runner with --json flag outputs JSON only (no human-readable logs)', () => {
    const tmpDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const project = {
      components: [ { id: 'board', type: 'wokwi-board' }, { id: 'led1', type: 'LED' } ],
      connections: []
    };

    const projFile = path.join(tmpDir, 'e2e_project_json_flag.json');
    fs.writeFileSync(projFile, JSON.stringify(project));

    const cliScript = path.resolve(__dirname, '..', '..', '..', 'openhw-studio-cli', 'bin', 'run-autofix.mjs');
    const res = spawnSync(process.execPath, [cliScript, projFile, '--json'], { encoding: 'utf8' });
    assert.strictEqual(res.status, 0);
    
    const out = res.stdout.trim();
    // With --json flag, output should be pure JSON (no logs before it)
    assert.ok(out.startsWith('{'), 'Output should start with JSON object');
    const parsed = JSON.parse(out);
    assert.ok(parsed && typeof parsed === 'object');
  });

  it('CLI runner with --verbose flag includes debug messages', () => {
    const tmpDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const project = {
      components: [ { id: 'board', type: 'wokwi-board' } ],
      connections: []
    };

    const projFile = path.join(tmpDir, 'e2e_project_verbose.json');
    fs.writeFileSync(projFile, JSON.stringify(project));

    const cliScript = path.resolve(__dirname, '..', '..', '..', 'openhw-studio-cli', 'bin', 'run-autofix.mjs');
    const res = spawnSync(process.execPath, [cliScript, projFile, '--verbose'], { encoding: 'utf8' });
    assert.strictEqual(res.status, 0);
    
    const out = res.stdout.trim();
    // Verbose output should include info messages with timestamps
    assert.ok(out.includes('Loading project') || out.includes('Applying fix'), 'Verbose output missing expected messages');
  });

  it('CLI runner with --help flag displays help message', () => {
    const cliScript = path.resolve(__dirname, '..', '..', '..', 'openhw-studio-cli', 'bin', 'run-autofix.mjs');
    const res = spawnSync(process.execPath, [cliScript, '--help'], { encoding: 'utf8' });
    assert.strictEqual(res.status, 0);
    
    const out = res.stdout;
    assert.ok(out.includes('Usage') || out.includes('OpenHW'), 'Help message not found');
  });

  it('CLI runner with missing project file returns error exit code 2', () => {
    const cliScript = path.resolve(__dirname, '..', '..', '..', 'openhw-studio-cli', 'bin', 'run-autofix.mjs');
    const res = spawnSync(process.execPath, [cliScript, '/nonexistent/path.json'], { encoding: 'utf8' });
    assert.strictEqual(res.status, 2);
    assert.ok(res.stderr.includes('not found') || res.stdout.includes('not found'));
  });

  it.skip('MCP controller returns JSON result when called directly', async () => {
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

  it('Integration test: I2C pull-up resistors fix pattern', async () => {
    const emulatorPath = path.resolve(__dirname, 'autofix', 'fix-patterns-catalog.js');
    const mod = await import(new URL('file://' + emulatorPath).href);
    const { findApplicablePatterns, fixPatternsCatalog } = mod;
    
    // Check that i2c_pull_up_resistors pattern exists
    assert.ok(fixPatternsCatalog.i2c_pull_up_resistors, 'I2C pull-up pattern not found');
    
    const pattern = fixPatternsCatalog.i2c_pull_up_resistors;
    assert.strictEqual(pattern.category, 'communication');
    assert.strictEqual(pattern.severity, 'warn');
    assert.ok(pattern.description.includes('I2C'));
    assert.ok(pattern.steps.length > 0, 'Pattern has no steps');
    
    // Test pattern matching
    const error = { message: 'i2c_pull_up_resistors_missing', compIds: [] };
    const patterns = findApplicablePatterns(error);
    assert.ok(Array.isArray(patterns), 'Pattern search should return array');
  });

  it('Integration test: LED series resistor fix pattern', async () => {
    const emulatorPath = path.resolve(__dirname, 'autofix', 'fix-patterns-catalog.js');
    const mod = await import(new URL('file://' + emulatorPath).href);
    const { fixPatternsCatalog } = mod;
    
    // Check that led_series_resistor pattern exists
    assert.ok(fixPatternsCatalog.led_series_resistor, 'LED resistor pattern not found');
    
    const pattern = fixPatternsCatalog.led_series_resistor;
    assert.strictEqual(pattern.category, 'current_limiting');
    assert.strictEqual(pattern.severity, 'error');
    assert.ok(pattern.description.includes('LED'));
    assert.ok(pattern.steps.length > 0, 'Pattern has no steps');
    
    // Verify confidence is high for LED resistor
    assert.ok(pattern.confidence >= 0.9, 'LED resistor fix should have high confidence');
  });

  it('Integration test: EMI/RFI filter suggestion pattern', async () => {
    const emulatorPath = path.resolve(__dirname, 'autofix', 'fix-patterns-catalog.js');
    const mod = await import(new URL('file://' + emulatorPath).href);
    const { fixPatternsCatalog } = mod;
    
    // Check that emi_rfi_filter_suggestion pattern exists
    assert.ok(fixPatternsCatalog.emi_rfi_filter_suggestion, 'EMI/RFI filter pattern not found');
    
    const pattern = fixPatternsCatalog.emi_rfi_filter_suggestion;
    assert.strictEqual(pattern.category, 'emc');
    assert.strictEqual(pattern.severity, 'warn');
    assert.ok(pattern.description.includes('EMI') || pattern.description.includes('RFI'));
    assert.ok(pattern.steps.length > 0, 'Pattern has no steps');
  });

  it.skip('Integration test: Apply I2C pull-up fix to project with i2c device', async () => {
    const emulatorPath = path.resolve(__dirname, 'circuit-fixer.js');
    const mod = await import(new URL('file://' + emulatorPath).href);
    const { applyCircuitFix } = mod;
    
    const project = {
      components: [
        { id: 'board', type: 'wokwi-board' },
        { id: 'mpu6050', type: 'MPU6050' }
      ],
      connections: [
        { from: 'board.SDA', to: 'mpu6050.SDA' },
        { from: 'board.SCL', to: 'mpu6050.SCL' }
      ]
    };
    
    const error = { message: 'i2c_pull_up_resistors', compIds: ['mpu6050'], remediation: 'Add pull-up resistors to SDA and SCL lines' };
    const result = applyCircuitFix(project, error, { appliedBy: 'test' });
    
    assert.ok(result !== null, 'Autofix should return a result');
    assert.ok(typeof result === 'object', 'Result should be an object');
  });

  it.skip('Integration test: Apply LED resistor fix to LED circuit', async () => {
    const emulatorPath = path.resolve(__dirname, 'circuit-fixer.js');
    const mod = await import(new URL('file://' + emulatorPath).href);
    const { applyCircuitFix } = mod;
    
    const project = {
      components: [
        { id: 'board', type: 'wokwi-board' },
        { id: 'led1', type: 'LED' }
      ],
      connections: [
        { from: 'board.D13', to: 'led1.anode' },
        { from: 'led1.cathode', to: 'board.GND' }
      ]
    };
    
    const error = { message: 'led_series_resistor', compIds: ['led1'], remediation: 'LED needs current limiting resistor' };
    const result = applyCircuitFix(project, error, { appliedBy: 'test' });
    
    assert.ok(result !== null, 'Autofix should return a result');
    assert.ok(typeof result === 'object', 'Result should be an object');
    assert.ok(result.applied, 'LED resistor autofix should be applied');

    const insertedRes = (result.components || []).find((c) => c.type === 'wokwi-resistor');
    assert.ok(insertedRes, 'Expected inserted resistor component');

    const rewired = (result.connections || []).filter((w) =>
      String(w.from || '').startsWith(`${insertedRes.id}:`) || String(w.to || '').startsWith(`${insertedRes.id}:`)
    );
    assert.ok(rewired.length >= 2, 'Expected at least two wires connected to inserted resistor');

    const allColonEndpoints = (result.connections || []).every((w) =>
      String(w.from || '').includes(':') && String(w.to || '').includes(':')
    );
    assert.ok(allColonEndpoints, 'All generated wire endpoints must be compId:pin format for WebUI rendering');
  });

  it('Integration test: EMI detection and suggestion for high-speed lines', async () => {
    const emulatorPath = path.resolve(__dirname, 'autofix', 'signal-integrity.js');
    const mod = await import(new URL('file://' + emulatorPath).href);
    const {
      detectHighSpeedNets,
      estimateNetLength,
      findDifferentialPairs,
      flagDifferentialPairMismatches,
      recommendSeriesTermination,
    } = mod;
    
    // Test that high-speed detection functions exist
    assert.ok(typeof detectHighSpeedNets === 'function', 'detectHighSpeedNets should be a function');
    assert.ok(typeof recommendSeriesTermination === 'function', 'recommendSeriesTermination should be a function');
    
    const mockComponents = [
      { id: 'board', type: 'wokwi-board' },
      { id: 'spi_flash', type: 'SPI_FLASH', frequency: '50MHz' }
    ];
    
    const mockConnections = [
      { from: 'board.GPIO13', to: 'spi_flash.MOSI', trace_length: 150 }
    ];
    
    const highSpeedNets = detectHighSpeedNets(mockComponents, mockConnections);
    assert.ok(Array.isArray(highSpeedNets), 'detectHighSpeedNets should return an array');

    const length = estimateNetLength(mockComponents, mockConnections);
    assert.ok(Number.isFinite(length.estimatedLength), 'estimateNetLength should return numeric length');

    const diffConnections = [
      { from: 'board.USB_DP', to: 'usb.DP' },
      { from: 'board.USB_DN', to: 'usb.DN' },
      { from: 'board.TXP', to: 'phy.RXP' },
      { from: 'board.TXN', to: 'phy.RXN' },
    ];
    const diffPairs = findDifferentialPairs(diffConnections);
    assert.ok(Array.isArray(diffPairs), 'findDifferentialPairs should return array');
    assert.ok(diffPairs.length >= 1, 'expected to detect at least one differential pair');

    const mismatchComponents = [
      { id: 'board', type: 'wokwi-board', x: 0, y: 0 },
      { id: 'usb', type: 'USB_CONN', x: 140, y: 5 },
      { id: 'phy', type: 'USB_PHY', x: 420, y: 40 },
    ];
    const mismatchIssues = flagDifferentialPairMismatches(mismatchComponents, diffConnections, 0.01);
    assert.ok(Array.isArray(mismatchIssues), 'flagDifferentialPairMismatches should return array');
  });
});

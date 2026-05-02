import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function run() {
  const indexPath = path.join(process.cwd(), 'src', 'circuit-validation', 'index.js');
  const mod = await import(pathToFileURL(indexPath).href);

  const applyCircuitFix = mod.applyCircuitFix;
  if (!applyCircuitFix) {
    console.error('applyCircuitFix not exported by emulator index.js');
    process.exitCode = 2;
    return;
  }

  // Minimal mock project: board + LED with no ground connection
  const project = {
    components: [
      { id: 'board', type: 'wokwi-board' },
      { id: 'led1', type: 'LED' }
    ],
    connections: []
  };

  const engineError = {
    message: 'missing_ground_connection',
    remediation: null,
    compIds: ['led1'],
    id: 'missing_ground_connection'
  };

  try {
    const result = applyCircuitFix(project, engineError, { appliedBy: 'smoke-test', trackHistory: true });
    console.log('Autofix result:');
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 0;
  } catch (err) {
    console.error('Error running applyCircuitFix:', err);
    process.exitCode = 3;
  }
}

run();

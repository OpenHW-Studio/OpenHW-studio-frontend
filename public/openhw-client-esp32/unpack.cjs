const fs = require('fs');
const path = require('path');
const vm = require('vm');

const mockEspDir = path.join(__dirname, '../Mock-esp');

// Find all chunk files in the Mock-esp folder
if (!fs.existsSync(mockEspDir)) {
  console.error(`ERROR: Mock-esp directory not found at: ${mockEspDir}`);
  process.exit(1);
}

const jsFiles = fs.readdirSync(mockEspDir).filter(
  f => f.endsWith('.js') && !f.includes('loader') && !f.includes('webpack')
);

console.log('🔍 Locating and loading Wokwi chunks...');

const moduleDefinitions = {};

// Mock the Webpack runtime context
const context = {
  self: {
    webpackChunk_N_E: {
      push(args) {
        const moduleDefs = args[1];
        if (moduleDefs) {
          for (const [key, value] of Object.entries(moduleDefs)) {
            // Capture the string representation of each module factory
            moduleDefinitions[key] = value.toString();
          }
        }
      }
    }
  },
  globalThis: {},
  console: console
};

context.globalThis = context.self;
context.window = context.self;

vm.createContext(context);

// Evaluate each chunk file inside the vm sandbox to register their modules
for (const file of jsFiles) {
  const filePath = path.join(mockEspDir, file);
  console.log(`⚙️  Evaluating chunk: ${file}`);
  const code = fs.readFileSync(filePath, 'utf8');
  try {
    vm.runInContext(code, context);
  } catch (err) {
    console.warn(`⚠️  Non-critical eval warning for ${file}:`, err.message);
  }
}

console.log(`\n🎉 Successfully captured ${Object.keys(moduleDefinitions).length} Webpack module definitions!`);

// Verify that module 50722 (Wokwi core simulator engine) was captured
if (!moduleDefinitions['50722']) {
  console.error('❌ CRITICAL: Module 50722 (Core Simulation Engine) was not found!');
  process.exit(1);
}

// Generate the standalone ES6 engine module
let bundleContent = `/**
 * Standalone Client-Side ESP32 Simulation Engine
 * Generated dynamically from captured Wokwi Webpack chunks.
 */

// Serialized module factories
const moduleDefinitions = {
`;

// Serialize the main engine module and its trace logger dependency
const coreModules = ['50722', '11882'];
for (const moduleId of coreModules) {
  if (moduleDefinitions[moduleId]) {
    bundleContent += `  "${moduleId}": ${moduleDefinitions[moduleId]},\n`;
  } else {
    console.warn(`⚠️  Warning: Dependent module ${moduleId} was not found.`);
  }
}

bundleContent += `};

// Isolated Webpack Cache & Loader
const cache = {};

function webpackRequire(moduleId) {
  if (cache[moduleId]) {
    return cache[moduleId].exports;
  }
  const module = { exports: {} };
  cache[moduleId] = module;
  
  if (!moduleDefinitions[moduleId]) {
    throw new Error("Module " + moduleId + " is missing from the bundle.");
  }
  
  moduleDefinitions[moduleId](module, module.exports, webpackRequire);
  return module.exports;
}

// Webpack Runtime Helpers for ES Modules compatibility
webpackRequire.r = function(exports) {
  if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
  }
  Object.defineProperty(exports, '__esModule', { value: true });
};

webpackRequire.d = function(exports, definition) {
  for (var key in definition) {
    if (webpackRequire.o(definition, key) && !webpackRequire.o(exports, key)) {
      Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
    }
  }
};

webpackRequire.o = function(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
};

// Instantiate the core simulator exports
const engine = webpackRequire("50722");

// Clean ES6 Exports
export const {
  ESP32,
  ESP32C2,
  ESP32C3,
  ESP32C5,
  ESP32C6,
  ESP32C61,
  ESP32H2,
  ESP32P4,
  ESP32S2,
  ESP32S3,
  XtensaCore,
  RV32Core,
  Memory,
  MemoryTranslator,
  ReadonlyMemory,
  SimulationClock,
  Simulator,
  IOPinState,
  SignalDirection
} = engine;
`;

const outputPath = path.join(__dirname, 'esp32-engine.js');
fs.writeFileSync(outputPath, bundleContent, 'utf8');

console.log(`\n✅ Standalone ES6 Engine compiled successfully!`);
console.log(`📂 Output file: ${outputPath}\n`);

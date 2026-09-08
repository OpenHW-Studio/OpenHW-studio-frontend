import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.resolve(__dirname, '../src/services/guidedProjects.json');
const targetDir = path.resolve(__dirname, '../src/services/exampleBlocks');
const examplesDir = path.resolve(__dirname, '../../openhw-studio-examples/examples');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const gp = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const projects = [];
for (const [lvKey, lv] of Object.entries(gp)) {
  for (const [catKey, cat] of Object.entries(lv.categories || {})) {
    for (const p of cat.projects || []) {
      const schema = p.schemas?.arduino || {};
      projects.push({
        slug: p.slug,
        title: p.title,
        level: lvKey,
        category: catKey,
        useBlocklyCode: schema.useBlocklyCode ?? p.useBlocklyCode ?? true,
        blocklyXml: schema.blocklyXml || p.blocklyXml || '',
        blocklyGeneratedCode: schema.blocklyGeneratedCode || p.blocklyGeneratedCode || '',
      });
    }
  }
}

function toIdentifier(slug) {
  const clean = slug
    .replace(/^(\d)/, 'num_$1')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_([a-z0-9])/g, (_, g) => g.toUpperCase());
  return clean.charAt(0).toLowerCase() + clean.slice(1);
}

const imports = [];
const mapEntries = [];
const exportVars = [];

// Mapping to openhw-studio-examples folder names
const FOLDER_MAP = {
  'buzzer': 'Turn_on_Buzzer',
  '7-segment-counter': '7-segment-display',
  'ir-remote-control': 'ir-remote-control-system',
  'led-pwm': 'potentiometer-led',
  'dht-lcd': 'temperature-rgb-led',
  'line-following-robot': 'obstacle-avoiding-robot',
  'bluetooth-hc05': 'smart-home-automation',
  'rf-remote-control': 'ir-remote-control-system',
  'wifi-led-control': 'smart-home-automation',
  'communication-protocols': 'button-led',
};

for (const p of projects) {
  const varName = toIdentifier(p.slug) + 'Block';
  exportVars.push(varName);
  const filePath = path.join(targetDir, `${p.slug}.js`);

  const fileContent = `/**
 * Block Editor Default Code
 * Project: ${p.title} (${p.slug})
 * Level: ${p.level} | Category: ${p.category}
 */

export const ${varName} = {
  slug: ${JSON.stringify(p.slug)},
  title: ${JSON.stringify(p.title)},
  level: ${JSON.stringify(p.level)},
  category: ${JSON.stringify(p.category)},
  useBlocklyCode: ${p.useBlocklyCode ? 'true' : 'false'},
  blocklyXml: ${JSON.stringify(p.blocklyXml)},
  blocklyGeneratedCode: ${JSON.stringify(p.blocklyGeneratedCode)},
};

export default ${varName};
`;

  fs.writeFileSync(filePath, fileContent, 'utf8');
  imports.push(`import ${varName} from './${p.slug}.js';`);
  mapEntries.push(`  [${JSON.stringify(p.slug)}]: ${varName},`);

  // Write blockly.xml into openhw-studio-examples if directory exists
  if (fs.existsSync(examplesDir)) {
    const folderName = FOLDER_MAP[p.slug] || p.slug;
    const exampleProjDir = path.join(examplesDir, folderName);
    if (fs.existsSync(exampleProjDir) && p.blocklyXml) {
      const xmlFilePath = path.join(exampleProjDir, 'blockly.xml');
      fs.writeFileSync(xmlFilePath, p.blocklyXml, 'utf8');
    }
  }
}

const indexContent = `/**
 * Example Projects Block Editor Registry
 * Aggregates individual block editor files for each example project.
 */

${imports.join('\n')}

export const EXAMPLE_BLOCK_MAP = {
${mapEntries.join('\n')}
};

/**
 * Retrieve block editor definition for a given project slug.
 * @param {string} slug - Project slug (e.g. 'led-blink')
 * @returns {object|null} Block editor definition or null
 */
export function getExampleBlockData(slug) {
  if (!slug) return null;
  const cleanSlug = String(slug).trim().toLowerCase();
  return EXAMPLE_BLOCK_MAP[cleanSlug] || null;
}

export {
${exportVars.map(v => `  ${v},`).join('\n')}
};

export default EXAMPLE_BLOCK_MAP;
`;

fs.writeFileSync(path.join(targetDir, 'index.js'), indexContent, 'utf8');
console.log(`Generated ${projects.length} block editor files in ${targetDir}`);

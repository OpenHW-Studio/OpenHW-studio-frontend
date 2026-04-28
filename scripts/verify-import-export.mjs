import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';

const EDIT_COPY_KEY = 'openhw_edit_copy';
const EDIT_COPY_PAYLOAD_PREFIX = 'openhw_edit_copy_payload_';

function parseUISource(src) {
  const s = String(src || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const ctxExportStartRegex = /export\s+(?:default\s+)?(?:const|function|class)\s+[A-Za-z0-9_]*ContextMenu[A-Za-z0-9_]*\b/;
  const uiExportRegex = /(export\s+(?:default\s+)?(?:const|function|class)\s+[A-Za-z0-9_]*(?:UI|View|Component)[A-Za-z0-9_]*\b[\s\S]*?)(?=\nexport\s+|$)/i;

  let ctxCode = '';
  let uiSrc = s;
  const marker = '// ── Context Menu ─────────────────────────────────────────────────────────';
  const markerIdx = s.indexOf(marker);
  if (markerIdx !== -1) {
    ctxCode = s.substring(markerIdx + marker.length).trim();
    uiSrc = s.substring(0, markerIdx).trim();
  } else {
    const ctxStart = s.search(ctxExportStartRegex);
    if (ctxStart !== -1) {
      const tail = s.slice(ctxStart + 1);
      const nextExportRel = tail.search(/\nexport\s+/);
      const ctxEnd = nextExportRel === -1 ? s.length : (ctxStart + 1 + nextExportRel);
      ctxCode = s.slice(ctxStart, ctxEnd).trim();
      uiSrc = `${s.slice(0, ctxStart)}${s.slice(ctxEnd)}`.trim();
    }
  }

  let outMode = 'code';
  let outSvg = '';
  let outReact = '';

  const sourceRegex = /const\s+__openhwSvgSource\s*=\s*String\.raw`([\s\S]*?)`/;
  const svgSource = uiSrc.match(sourceRegex);
  const inlineSvg = uiSrc.match(/<svg[\s\S]*?<\/svg>/i);
  const looksLikeReactModule = /import\s+React|from\s+['"]react(?:\/jsx-runtime)?['"]/.test(uiSrc)
    || /export\s+(?:default\s+)?(?:const|function)\s+\w*(?:UI|View|Component)\b/.test(uiSrc);

  if (svgSource?.[1]) {
    outSvg = svgSource[1];
    outMode = 'code';
  } else if (looksLikeReactModule) {
    const uiOnly = uiSrc.match(uiExportRegex);
    outReact = (uiOnly ? uiOnly[0] : uiSrc).trim();
    outMode = 'react';
  } else if (inlineSvg) {
    outSvg = inlineSvg[0];
    outMode = 'code';
  } else {
    const uiOnly = uiSrc.match(uiExportRegex);
    outReact = (uiOnly ? uiOnly[0] : uiSrc).trim();
    outMode = 'react';
  }

  return { svgMode: outMode, svgCode: outSvg, reactCode: outReact, ctxMenuCode: ctxCode };
}

function parseContextFlagsFromUiSource(source) {
  const normalized = String(source || '').replace(/\r\n/g, '\n');
  const duringRunMatch = normalized.match(/export\s+const\s+contextMenuDuringRun\s*=\s*(true|false)/);
  const onlyDuringRunMatch = normalized.match(/export\s+const\s+contextMenuOnlyDuringRun\s*=\s*(true|false)/);
  return {
    hasDuringRun: !!duringRunMatch,
    duringRun: duringRunMatch ? duringRunMatch[1] === 'true' : false,
    hasOnlyDuringRun: !!onlyDuringRunMatch,
    onlyDuringRun: onlyDuringRunMatch ? onlyDuringRunMatch[1] === 'true' : false,
  };
}

function extractBounds(source) {
  const normalized = String(source || '').replace(/\r\n/g, '\n');
  const match = normalized.match(/BOUNDS\s*=\s*\{\s*x:\s*([\d.-]+)[^}]*y:\s*([\d.-]+)[^}]*w:\s*([\d.-]+)[^}]*h:\s*([\d.-]+)/);
  if (!match) return null;
  return {
    x: Number(match[1]),
    y: Number(match[2]),
    w: Number(match[3]),
    h: Number(match[4]),
  };
}

class FakeStorage {
  constructor(quotaBytes = Infinity) {
    this.quotaBytes = quotaBytes;
    this.map = new Map();
  }

  get length() {
    return this.map.size;
  }

  key(index) {
    return Array.from(this.map.keys())[index] ?? null;
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  removeItem(key) {
    this.map.delete(key);
  }

  setItem(key, value) {
    const str = String(value);
    const next = new Map(this.map);
    next.set(String(key), str);
    const bytes = Array.from(next.entries()).reduce((sum, [k, v]) => sum + Buffer.byteLength(k, 'utf8') + Buffer.byteLength(v, 'utf8'), 0);
    if (bytes > this.quotaBytes) {
      throw new Error('QuotaExceededError');
    }
    this.map = next;
  }
}

function cleanupEditCopyPayloadStorage(localStorageLike, sessionStorageLike) {
  const removeMatching = (storageLike) => {
    const keys = [];
    for (let i = 0; i < storageLike.length; i += 1) {
      const k = storageLike.key(i);
      if (k && k.startsWith(EDIT_COPY_PAYLOAD_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => storageLike.removeItem(k));
  };

  removeMatching(sessionStorageLike);
  removeMatching(localStorageLike);
}

function writeEditCopyPayload(data, localStorageLike, sessionStorageLike) {
  const serialized = JSON.stringify(data || {});
  const payloadKey = `${EDIT_COPY_PAYLOAD_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const pointer = JSON.stringify({
    __openhwEditCopyPointer: true,
    version: 2,
    storage: 'session',
    key: payloadKey,
    createdAt: Date.now(),
  });

  const writePointerPayload = () => {
    sessionStorageLike.setItem(payloadKey, serialized);
    localStorageLike.setItem(EDIT_COPY_KEY, pointer);
  };

  try {
    writePointerPayload();
    return { ok: true, mode: 'pointer' };
  } catch {
    // Continue with fallback.
  }

  try {
    localStorageLike.setItem(EDIT_COPY_KEY, serialized);
    return { ok: true, mode: 'direct' };
  } catch {
    // Continue with cleanup + retry.
  }

  cleanupEditCopyPayloadStorage(localStorageLike, sessionStorageLike);

  try {
    writePointerPayload();
    return { ok: true, mode: 'pointer-retry' };
  } catch (error) {
    return { ok: false, mode: 'failed', error };
  }
}

async function readComponentBundle(componentType) {
  const workspaceRoot = path.resolve(process.cwd(), '..');
  const componentRoot = path.join(workspaceRoot, 'openhw-studio-emulator-danish', 'src', 'components', componentType);

  const manifestRaw = await fs.readFile(path.join(componentRoot, 'manifest.json'), 'utf8');
  const uiRaw = await fs.readFile(path.join(componentRoot, 'ui.tsx'), 'utf8');
  const logicRaw = await fs.readFile(path.join(componentRoot, 'logic.ts'), 'utf8');
  const validationRaw = await fs.readFile(path.join(componentRoot, 'validation.ts'), 'utf8');
  const indexRaw = await fs.readFile(path.join(componentRoot, 'index.ts'), 'utf8');
  const docsRaw = await fs.readFile(path.join(componentRoot, 'doc', 'index.html'), 'utf8');

  return {
    manifest: JSON.parse(manifestRaw),
    uiRaw,
    logicRaw,
    validationRaw,
    indexRaw,
    docsRaw,
  };
}

async function runImportFlow(bundle) {
  const zip = new JSZip();
  const folder = zip.folder(bundle.manifest.type);

  folder.file('manifest.json', JSON.stringify(bundle.manifest, null, 2));
  folder.file('ui.tsx', bundle.uiRaw);
  folder.file('logic.ts', bundle.logicRaw);
  folder.file('validation.ts', bundle.validationRaw);
  folder.file('index.ts', bundle.indexRaw);
  folder.file('doc/index.html', bundle.docsRaw);

  const zipData = await zip.generateAsync({ type: 'nodebuffer' });
  const loaded = await JSZip.loadAsync(zipData);

  let manifestStr = '';
  let uiStr = '';
  let logicStr = '';
  let validationStr = '';
  let indexStr = '';
  let docsStr = '';

  for (const p of Object.keys(loaded.files)) {
    const read = () => loaded.files[p].async('string');
    if (p.endsWith('manifest.json')) manifestStr = await read();
    if (/ui\.(tsx|jsx)$/i.test(p)) uiStr = await read();
    if (/logic\.(ts|js)$/i.test(p)) logicStr = await read();
    if (/validation\.(ts|js)$/i.test(p)) validationStr = await read();
    if (/index\.(ts|js)$/i.test(p)) indexStr = await read();
    if (/(^|\/)docs\/.*\.html$/i.test(p) || /(^|\/)doc\/.*\.html$/i.test(p)) docsStr = await read();
  }

  const parsedManifest = JSON.parse(manifestStr || '{}');
  const parsedUi = parseUISource(uiStr);
  const flags = parseContextFlagsFromUiSource(uiStr);
  const bounds = extractBounds(uiStr);

  return {
    checks: [
      { name: 'manifest loaded', pass: parsedManifest.type === bundle.manifest.type && parsedManifest.label === bundle.manifest.label },
      { name: 'ui exports preserved', pass: uiStr.includes('MAX30102UI') && uiStr.includes('MAX30102ContextMenu') },
      { name: 'logic constants preserved', pass: logicStr.includes('REG_INT_STATUS1') && logicStr.includes('ppgPulseShape') },
      { name: 'validation loaded', pass: validationStr.includes('max30102-vin-voltage') },
      { name: 'index loaded', pass: indexStr.includes('MAX30102Logic') && indexStr.includes('ContextMenu') },
      { name: 'docs loaded', pass: docsStr.toLowerCase().includes('component documentation') || docsStr.length > 20 },
      { name: 'context flags parsed', pass: flags.hasDuringRun && flags.duringRun && flags.hasOnlyDuringRun && flags.onlyDuringRun },
      { name: 'bounds parsed', pass: !!bounds && bounds.x === 13 && bounds.y === 7 && bounds.w === 74 && bounds.h === 56 },
      { name: 'ui parse mode', pass: parsedUi.svgMode === 'react', details: `mode=${parsedUi.svgMode}` },
      { name: 'context menu extracted', pass: parsedUi.ctxMenuCode.includes('ContextMenu'), details: `ctxLen=${parsedUi.ctxMenuCode.length}` },
    ],
  };
}

function runEditCopyFlow(bundle) {
  const editCopyData = {
    manifest: bundle.manifest,
    logic: bundle.logicRaw,
    ui: bundle.uiRaw,
    validation: bundle.validationRaw,
    index: bundle.indexRaw,
    docs: bundle.docsRaw,
  };

  const localStorageTight = new FakeStorage(1800);
  const sessionStorageWide = new FakeStorage(4 * 1024 * 1024);
  const writeResult = writeEditCopyPayload(editCopyData, localStorageTight, sessionStorageWide);

  const pointerRaw = localStorageTight.getItem(EDIT_COPY_KEY) || '';
  let pointerParsed = null;
  try {
    pointerParsed = JSON.parse(pointerRaw);
  } catch {
    pointerParsed = null;
  }

  const pointerPayload = pointerParsed?.key ? sessionStorageWide.getItem(pointerParsed.key) : '';
  const resolvedPayload = pointerPayload ? JSON.parse(pointerPayload) : null;

  return {
    checks: [
      { name: 'payload write succeeded', pass: writeResult.ok === true },
      { name: 'quota fallback used pointer transport', pass: writeResult.mode.startsWith('pointer') },
      { name: 'pointer envelope stored', pass: !!pointerParsed?.__openhwEditCopyPointer && pointerParsed.storage === 'session' },
      { name: 'payload retrievable', pass: !!resolvedPayload && resolvedPayload.manifest?.type === bundle.manifest.type },
      { name: 'raw ui retained', pass: String(resolvedPayload?.ui || '').includes('MAX30102ContextMenu') },
      { name: 'raw logic retained', pass: String(resolvedPayload?.logic || '').includes('REG_INT_STATUS1') },
      { name: 'raw docs retained', pass: String(resolvedPayload?.docs || '').length > 20 },
    ],
  };
}

function summarize(flowName, checks) {
  const failed = checks.filter((c) => !c.pass);
  const passed = checks.length - failed.length;

  console.log(`\n[${flowName}]`);
  checks.forEach((c) => {
    const tail = c.details ? ` (${c.details})` : '';
    console.log(`- ${c.pass ? 'PASS' : 'FAIL'}: ${c.name}${tail}`);
  });
  console.log(`Result: ${failed.length === 0 ? 'PASS' : 'FAIL'} (${passed}/${checks.length} checks passed)`);

  return { failed, passed, total: checks.length };
}

async function main() {
  const bundle = await readComponentBundle('max30102');

  const importFlow = await runImportFlow(bundle);
  const editCopyFlow = runEditCopyFlow(bundle);

  const importSummary = summarize('Import Button Flow', importFlow.checks);
  const editSummary = summarize('Edit-a-Copy Flow', editCopyFlow.checks);

  const totalFailed = importSummary.failed.length + editSummary.failed.length;
  if (totalFailed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Verification script failed to run:', error);
  process.exitCode = 1;
});

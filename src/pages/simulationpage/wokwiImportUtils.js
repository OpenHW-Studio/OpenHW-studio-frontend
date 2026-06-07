import JSZip from 'jszip';
import { normalizeProjectFiles } from '../../utils/projectCompilerUtils';
import { normalizeImportedCircuitData, normalizeOpenCodeTabs, parseWokwiDiagramJson } from './projectUtils';
import * as hardwareUtils from './utils/hardwareUtils';

/**
 * wokwiImportUtils.js
 * Encapsulates the Wokwi ZIP import parsing, file extraction, and board folder restructuring.
 */

export async function importWokwiProjectZip(file, currentComponents = [], currentWires = []) {
  if (!file) return null;
  
  const zip = await JSZip.loadAsync(file);
  const diagramFile = zip.file('diagram.json');
  if (!diagramFile) {
    throw new Error('Invalid Wokwi backup: diagram.json not found.');
  }

  const diagramJson = JSON.parse(await diagramFile.async('string'));
  if ((currentComponents.length > 0 || currentWires.length > 0) && !window.confirm('Import Wokwi project? Current unsaved changes will be replaced.')) {
    return null;
  }

  // 1. Parse diagram.json using our universal fallback bridge
  const { components: parsedComps, wires: parsedWires } = parseWokwiDiagramJson(diagramJson);
  const normalizedCircuit = normalizeImportedCircuitData(parsedComps, parsedWires);

  // 2. Determine the board ID and kind
  const boardComp = normalizedCircuit.components.find(c => hardwareUtils.isProgrammableBoardType(c.type)) || normalizedCircuit.components[0];
  const currentBoard = currentComponents.find(c => hardwareUtils.isProgrammableBoardType(c.type));
  if (boardComp && currentBoard && boardComp.id !== currentBoard.id) {
    const oldBoardId = boardComp.id;
    const newBoardId = currentBoard.id;
    // To prevent React/Zustand batched update race conditions in SimulatorPage.jsx where boardComponents 
    // lags behind projectFiles, preserve the existing board ID if replacing a programmable board.
    boardComp.id = newBoardId;

    // Update all wire connections that referenced the old board ID to point to the preserved board ID
    normalizedCircuit.wires.forEach(wire => {
      if (wire.from && wire.from.startsWith(`${oldBoardId}:`)) {
        wire.from = newBoardId + wire.from.slice(oldBoardId.length);
      }
      if (wire.to && wire.to.startsWith(`${oldBoardId}:`)) {
        wire.to = newBoardId + wire.to.slice(oldBoardId.length);
      }
    });
  }
  const boardId = boardComp?.id || 'uno1';
  const boardKind = boardComp ? hardwareUtils.normalizeBoardKind(boardComp.type) : 'arduino_uno';
  const boardType = boardComp?.type || 'openhw-arduino-uno';

  // 3. Extract all other files from the ZIP and move them into project/<boardId>/<filename>
  const extractedFiles = [];
  const zipFiles = Object.keys(zip.files);
  for (const relPath of zipFiles) {
    const zf = zip.files[relPath];
    if (zf.dir) continue;
    const name = relPath.split('/').pop();
    if (name === 'diagram.json' || name === 'wokwi-project.txt' || name === 'README.md') continue;
    
    const content = await zf.async('string');
    if (name === 'libraries.txt' || name === 'library.txt') {
      extractedFiles.push({
        id: `project/${boardId}/library.txt`,
        path: `project/${boardId}/library.txt`,
        name: 'library.txt',
        kind: 'code',
        boardId,
        boardKind,
        content,
        dirty: false,
      });
    } else {
      extractedFiles.push({
        id: `project/${boardId}/${name}`,
        path: `project/${boardId}/${name}`,
        name,
        kind: 'code',
        boardId,
        boardKind,
        content,
        dirty: false,
      });
    }
  }

  const normalizedFiles = normalizeProjectFiles(extractedFiles);
  const normalizedTabs = normalizeOpenCodeTabs(normalizedFiles.map(f => f.id), normalizedFiles);
  const activeId = normalizedTabs[0] || normalizedFiles[0]?.id || '';

  // Find the main code file to populate `code` property
  const mainFile = extractedFiles.find(f => f.name.endsWith('.ino') || f.name.endsWith('.py')) || extractedFiles[0];
  const code = mainFile ? mainFile.content : '';

  return {
    board: boardType.replace('openhw-', '').replace('-', '_'),
    components: normalizedCircuit.components,
    wires: normalizedCircuit.wires,
    projectFiles: normalizedFiles,
    openCodeTabs: normalizedTabs,
    activeCodeFileId: activeId,
    projectName: diagramJson.author ? `Wokwi Project by ${diagramJson.author}` : 'Wokwi Project',
    code,
  };
}

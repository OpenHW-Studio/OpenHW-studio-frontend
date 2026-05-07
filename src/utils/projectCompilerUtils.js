/**
 * SHARED UTILITY: projectCompilerUtils.js
 * This file contains the "Source of Truth" for extracting compilation payloads from OpenHW projects.
 * It is used by both SimulatorPage.jsx and grading-worker.ts.
 */

export const GENERATED_ROOT_FILE_IDS = new Set(['project/diagram.png']);

export function fileExt(path) {
    const idx = String(path || '').lastIndexOf('.');
    return idx >= 0 ? path.substring(idx).toLowerCase() : '';
}

export function isFileDisabled(pathLike) {
    return String(pathLike || '').toLowerCase().endsWith('.disabled');
}

/**
 * Normalizes project files to ensure they have valid paths and IDs.
 * MIRRORED FROM SimulatorPage.jsx
 */
export function normalizeProjectFiles(files) {
    const list = Array.isArray(files) ? files : [];
    const seen = new Set();
    const out = [];
  
    list.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const normalizedPath = String(entry.path || entry.id || '').trim();
      if (!normalizedPath || GENERATED_ROOT_FILE_IDS.has(normalizedPath) || seen.has(normalizedPath)) return;
      seen.add(normalizedPath);
  
      out.push({
        ...entry,
        id: normalizedPath,
        path: normalizedPath,
        name: String(entry.name || normalizedPath.split('/').pop() || ''),
      });
    });
  
    return out;
}

/**
 * Extracts the compilation unit for a specific board from a project structure.
 * @param {Object} project - The project metadata (from PNG/JSON).
 * @param {string} boardId - The ID of the board (e.g. "uno1").
 * @returns {Object} { mainCode, files, sketchName, hasMainFile }
 */
export function getBoardCompileFiles(project, boardId) {
    // 1. Normalize files first (EXACTLY like SimulatorPage.jsx does)
    const projectFiles = normalizeProjectFiles(project.projectFiles);
    
    const allowed = new Set(['.ino', '.h', '.hpp', '.c', '.cpp']);
    
    let targetBoardId = boardId;
    
    // Safety fallback for board discovery
    const hasFilesForBoard = projectFiles.some(f => f.path.startsWith(`project/${targetBoardId}/`));
    if (!hasFilesForBoard) {
        const firstBoardFile = projectFiles.find(f => f.path.startsWith('project/'));
        if (firstBoardFile) {
            const match = firstBoardFile.path.match(/^project\/([^/]+)\//);
            if (match) targetBoardId = match[1];
        }
    }

    // Filter files for the resolved board
    const boardFiles = projectFiles
        .filter((f) => f.path.startsWith(`project/${targetBoardId}/`))
        .filter((f) => !isFileDisabled(f.path))
        .filter((f) => allowed.has(fileExt(f.path)));

    const preferredMainName = `${targetBoardId}.ino`;
    const main = boardFiles.find((f) => f.name === preferredMainName || f.path.endsWith(preferredMainName))
              || boardFiles.find((f) => fileExt(f.name) === '.ino')
              || boardFiles[0]
              || null;

    const files = boardFiles
        .filter((f) => !(main && f.path === main.path))
        .map((f) => ({ name: f.name, content: f.content || '' }));

    let mainCode = main?.content || project.code || "";
    
    if (!mainCode && project.components) {
        const boardComp = project.components.find((c) => c.id === targetBoardId);
        if (boardComp?.attrs?.code) mainCode = boardComp.attrs.code;
    }

    return {
        mainCode: String(mainCode).trim(),
        sketchName: targetBoardId,
        files,
        hasMainFile: !!main,
    };
}

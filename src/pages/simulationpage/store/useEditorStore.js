import { create } from 'zustand';
import { fileExt, isFileDisabled } from '../../../utils/projectCompilerUtils';

export const useEditorStore = create((set, get) => ({
  projectFiles: [],
  openCodeTabs: [],
  activeCodeFileId: '',
  showCodeExplorer: true,
  code: '', // Current content of the active file

  // Actions
  setProjectFiles: (files) => set((state) => ({ 
    projectFiles: typeof files === 'function' ? files(state.projectFiles) : files 
  })),
  setOpenCodeTabs: (tabs) => set((state) => ({ 
    openCodeTabs: typeof tabs === 'function' ? tabs(state.openCodeTabs) : tabs 
  })),
  setActiveCodeFileId: (id) => set((state) => ({ 
    activeCodeFileId: typeof id === 'function' ? id(state.activeCodeFileId) : id 
  })),
  setShowCodeExplorer: (show) => set((state) => ({ 
    showCodeExplorer: typeof show === 'function' ? show(state.showCodeExplorer) : show 
  })),
  setCode: (code) => set((state) => ({ 
    code: typeof code === 'function' ? code(state.code) : code 
  })),

  setFileContent: (fileId, content) => {
    set((state) => ({
      projectFiles: state.projectFiles.map((f) =>
        f.id === fileId ? { ...f, content, dirty: true } : f
      ),
      // If the file being updated is the active one, also update 'code' state
      code: state.activeCodeFileId === fileId ? content : state.code,
    }));
  },

  openCodeFile: (fileId) => {
    const { projectFiles, openCodeTabs } = get();
    const file = projectFiles.find((f) => f.id === fileId);
    
    set({
      openCodeTabs: openCodeTabs.includes(fileId) ? openCodeTabs : [...openCodeTabs, fileId],
      activeCodeFileId: fileId,
      code: file ? (file.content || '') : '',
    });
  },

  closeCodeTab: (fileId) => {
    set((state) => {
      const nextTabs = state.openCodeTabs.filter((id) => id !== fileId);
      const nextActiveId = state.activeCodeFileId === fileId 
        ? (nextTabs[nextTabs.length - 1] || '') 
        : state.activeCodeFileId;
      
      const nextActiveFile = state.projectFiles.find(f => f.id === nextActiveId);
      
      return {
        openCodeTabs: nextTabs,
        activeCodeFileId: nextActiveId,
        code: nextActiveFile ? (nextActiveFile.content || '') : '',
      };
    });
  },

  saveCodeFile: (fileId) => {
    set((state) => ({
      projectFiles: state.projectFiles.map((f) => (f.id === fileId ? { ...f, dirty: false } : f)),
    }));
  },

  duplicateCodeFile: (fileId) => {
    const { projectFiles } = get();
    const source = projectFiles.find((f) => f.id === fileId);
    if (!source) return;

    const ext = fileExt(source.name);
    const base = ext ? source.name.slice(0, -ext.length) : source.name;
    let name = `${base}_copy${ext}`;
    let path = `${source.path.substring(0, source.path.lastIndexOf('/') + 1)}${name}`;
    let i = 2;

    while (projectFiles.some((f) => f.path === path)) {
      name = `${base}_copy${i}${ext}`;
      path = `${source.path.substring(0, source.path.lastIndexOf('/') + 1)}${name}`;
      i += 1;
    }

    const dup = { ...source, id: path, path, name, dirty: true };
    set({ projectFiles: [...projectFiles, dup] });
  },

  toggleCodeFileDisabled: (fileId, disabledSuffix) => {
    const { projectFiles, renameCodeFile } = get();
    const source = projectFiles.find((f) => f.id === fileId);
    if (!source || source.kind !== 'code') return;

    const currentlyDisabled = isFileDisabled(source.name);
    const nextName = currentlyDisabled
      ? source.name.slice(0, -disabledSuffix.length)
      : `${source.name}${disabledSuffix}`;

    if (nextName) renameCodeFile(fileId, nextName);
  },

  renameCodeFile: (fileId, nextName) => {
    const cleaned = String(nextName || '').trim();
    if (!cleaned) return;

    set((state) => {
      const source = state.projectFiles.find((f) => f.id === fileId);
      if (!source) return state;

      const parent = source.path.substring(0, source.path.lastIndexOf('/') + 1);
      const nextPath = `${parent}${cleaned}`;
      if (state.projectFiles.some((f) => f.id !== fileId && f.path === nextPath)) return state;

      return {
        projectFiles: state.projectFiles.map((f) =>
          f.id === fileId ? { ...f, id: nextPath, path: nextPath, name: cleaned, dirty: true } : f
        ),
        openCodeTabs: state.openCodeTabs.map((id) => (id === fileId ? nextPath : id)),
        activeCodeFileId: state.activeCodeFileId === fileId ? nextPath : state.activeCodeFileId,
      };
    });
  },

  deleteCodeFile: (fileId) => {
    set((state) => {
      const nextFiles = state.projectFiles.filter((f) => f.id !== fileId);
      const nextTabs = state.openCodeTabs.filter((id) => id !== fileId);
      const nextActiveId = state.activeCodeFileId === fileId 
        ? (nextTabs[nextTabs.length - 1] || '') 
        : state.activeCodeFileId;
      
      const nextActiveFile = nextFiles.find(f => f.id === nextActiveId);

      return {
        projectFiles: nextFiles,
        openCodeTabs: nextTabs,
        activeCodeFileId: nextActiveId,
        code: nextActiveFile ? (nextActiveFile.content || '') : '',
      };
    });
  },
}));

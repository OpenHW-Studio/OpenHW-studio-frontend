import { useCallback, useState } from 'react';

export function useCodeExplorerState({
  fileExt,
  isFileDisabled,
  disabledFileSuffix,
}) {
  const [projectFiles, setProjectFiles] = useState([]);
  const [openCodeTabs, setOpenCodeTabs] = useState([]);
  const [activeCodeFileId, setActiveCodeFileId] = useState('');
  const [showCodeExplorer, setShowCodeExplorer] = useState(true);

  const openCodeFile = useCallback((fileId) => {
    setOpenCodeTabs((prev) => (prev.includes(fileId) ? prev : [...prev, fileId]));
    setActiveCodeFileId(fileId);
  }, []);

  const closeCodeTab = useCallback((fileId) => {
    setOpenCodeTabs((prev) => {
      const next = prev.filter((id) => id !== fileId);
      setActiveCodeFileId((current) => (current === fileId ? (next[next.length - 1] || null) : current));
      return next;
    });
  }, []);

  const saveCodeFile = useCallback((fileId) => {
    setProjectFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, dirty: false } : f)));
  }, []);

  const duplicateCodeFile = useCallback((fileId) => {
    setProjectFiles((prev) => {
      const source = prev.find((f) => f.id === fileId);
      if (!source) return prev;

      const ext = fileExt(source.name);
      const base = ext ? source.name.slice(0, -ext.length) : source.name;
      let name = `${base}_copy${ext}`;
      let path = `${source.path.substring(0, source.path.lastIndexOf('/') + 1)}${name}`;
      let i = 2;

      while (prev.some((f) => f.path === path)) {
        name = `${base}_copy${i}${ext}`;
        path = `${source.path.substring(0, source.path.lastIndexOf('/') + 1)}${name}`;
        i += 1;
      }

      const dup = { ...source, id: path, path, name, dirty: true };
      return [...prev, dup];
    });
  }, [fileExt]);

  const renameCodeFile = useCallback((fileId, nextName) => {
    const cleaned = String(nextName || '').trim();
    if (!cleaned) return;

    let renamedPath = '';

    setProjectFiles((prev) => {
      const source = prev.find((f) => f.id === fileId);
      if (!source) return prev;

      const parent = source.path.substring(0, source.path.lastIndexOf('/') + 1);
      const nextPath = `${parent}${cleaned}`;
      if (prev.some((f) => f.id !== fileId && f.path === nextPath)) return prev;

      renamedPath = nextPath;
      return prev.map((f) => (f.id === fileId ? { ...f, id: nextPath, path: nextPath, name: cleaned, dirty: true } : f));
    });

    if (!renamedPath) return;

    setOpenCodeTabs((prev) => prev.map((id) => (id === fileId ? renamedPath : id)));
    setActiveCodeFileId((current) => (current === fileId ? renamedPath : current));
  }, []);

  const toggleCodeFileDisabled = useCallback((fileId) => {
    let nextName = '';

    setProjectFiles((prev) => {
      const source = prev.find((f) => f.id === fileId);
      if (!source || source.kind !== 'code') return prev;

      const currentlyDisabled = isFileDisabled(source.name);
      nextName = currentlyDisabled
        ? source.name.slice(0, -disabledFileSuffix.length)
        : `${source.name}${disabledFileSuffix}`;
      return prev;
    });

    if (nextName) renameCodeFile(fileId, nextName);
  }, [disabledFileSuffix, isFileDisabled, renameCodeFile]);

  const deleteCodeFile = useCallback((fileId) => {
    setProjectFiles((prev) => prev.filter((f) => f.id !== fileId));
    setOpenCodeTabs((prev) => {
      const next = prev.filter((id) => id !== fileId);
      setActiveCodeFileId((current) => (current === fileId ? (next[next.length - 1] || null) : current));
      return next;
    });
  }, []);

  return {
    projectFiles,
    setProjectFiles,
    openCodeTabs,
    setOpenCodeTabs,
    activeCodeFileId,
    setActiveCodeFileId,
    showCodeExplorer,
    setShowCodeExplorer,
    openCodeFile,
    closeCodeTab,
    saveCodeFile,
    duplicateCodeFile,
    renameCodeFile,
    toggleCodeFileDisabled,
    deleteCodeFile,
  };
}

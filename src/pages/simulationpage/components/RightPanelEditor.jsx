import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import MonacoEditor, { DiffEditor as MonacoDiffEditor } from '@monaco-editor/react';
import { useEditorStore } from '../store/useEditorStore';

const RightPanelEditor = memo(({
  theme,
  editorLanguage,
  editorOptions,
  activeCodeFileId,
  compareWithId,
  projectFiles,
  onSaveCodeFile,
  editingDisabled,
  isDragging // Passed to potentially suppress updates during drag if needed
}) => {
  const { code, setCode } = useEditorStore();
  const [localCode, setLocalCode] = useState(code);
  const isInternalUpdate = useRef(false);
  const editorRef = useRef(null);
  const containerRef = useRef(null);

  // Sync localCode with store code when it changes from outside
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    setLocalCode(code);
  }, [code]);

  // Debounced update to central store
  useEffect(() => {
    if (localCode === code) return;
    const timeout = setTimeout(() => {
      setCode(localCode);
    }, 400);
    return () => clearTimeout(timeout);
  }, [localCode, setCode, code]);

  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Add Custom Commands to the Command Palette (F1)
    editor.addAction({
      id: 'openhw-save',
      label: 'OpenHW: Save Current File',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => onSaveCodeFile?.(activeCodeFileId)
    });
  }, [onSaveCodeFile, activeCodeFileId]);

  // Localized Resize Observer for 60fps layout updates
  useEffect(() => {
    if (!containerRef.current || !editorRef.current) return;

    const observer = new ResizeObserver(() => {
      // In real-time, we just call layout()
      // This is much faster than a React re-render of the whole panel
      editorRef.current.layout();
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const activeFile = projectFiles.find(f => f.id === activeCodeFileId);
  const compareFile = projectFiles.find(f => f.id === compareWithId);

  return (
    <div ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', minHeight: 0 }}>
      {compareWithId ? (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '4px 12px', background: 'var(--accent)', color: '#000', fontSize: 10, fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>COMPARING: {activeFile?.name} vs {compareFile?.name}</span>
          </div>
          <MonacoDiffEditor
            height="calc(100% - 20px)"
            original={compareFile?.content || ''}
            modified={localCode}
            language={editorLanguage}
            theme={theme === 'light' ? 'openhw-light' : 'openhw-dark'}
            options={{ ...editorOptions, readOnly: true }}
          />
        </div>
      ) : (
        <MonacoEditor
          height="100%"
          language={editorLanguage}
          theme={theme === 'light' ? 'openhw-light' : 'openhw-dark'}
          value={localCode}
          onMount={handleEditorMount}
          onChange={v => {
            if (!activeCodeFileId || activeCodeFileId === 'project/diagram.json') return;
            if (editingDisabled) return;
            isInternalUpdate.current = true;
            setLocalCode(v || '');
          }}
          options={editorOptions}
        />
      )}
    </div>
  );
});

export default RightPanelEditor;

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
  const { code, setCode, setFileContent } = useEditorStore();
  const activeFile = (projectFiles || []).find(f => f.id === activeCodeFileId);
  const activeFileContent = activeFile ? (activeFile.content || '') : (code || '');

  const [localCode, setLocalCode] = useState(activeFileContent);
  const isInternalUpdate = useRef(false);
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const currentFileIdRef = useRef(activeCodeFileId);

  // Sync localCode with store/projectFiles code when file or content changes externally
  useEffect(() => {
    currentFileIdRef.current = activeCodeFileId;
    isInternalUpdate.current = false;
    setLocalCode(activeFileContent);
  }, [activeCodeFileId, activeFileContent]);

  // Debounced update to central store ONLY for internal user typing
  useEffect(() => {
    if (!isInternalUpdate.current) return;
    if (currentFileIdRef.current !== activeCodeFileId) return;

    const timeout = setTimeout(() => {
      if (activeCodeFileId) {
        setFileContent(activeCodeFileId, localCode);
      } else {
        setCode(localCode);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [localCode, activeCodeFileId, setFileContent, setCode]);

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

  const compareFile = projectFiles.find(f => f.id === compareWithId);

  return (
    <div 
      ref={containerRef} 
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', minHeight: 0 }}
      onKeyDownCapture={(e) => {
        if (editorOptions?.readOnly) {
          // If in read-only mode, aggressively prevent typing so Monaco's suggestions don't get triggered
          // Allow only navigational keys (arrows, page up/down) or copy shortcuts if needed, 
          // or just block printable characters. 
          // Actually, blocking everything except arrows/copy is safer.
          const isNav = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown','Home','End'].includes(e.key);
          const isCopy = (e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C');
          if (!isNav && !isCopy) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
        // Stop key events (like Backspace/Delete) from bubbling to Wokwi Simulator global listeners
        e.stopPropagation();
        e.nativeEvent.stopPropagation();
      }}
    >
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
            if (editorOptions?.readOnly) return;
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

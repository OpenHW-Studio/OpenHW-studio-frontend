import { useEffect } from 'react';
import { removeCodeSnippet } from '../projectUtils';

/**
 * Custom hook to manage global keyboard shortcuts for the Simulator.
 * Extracts the complex keydown logic from SimulatorPage.jsx.
 */
export function useSimulatorShortcuts({
  selected, isRunning, liveEditingDisabled, readOnly, saveHistory, handleSave, undo, redo, handleRun, handleStop,
  rotateComponent, components, setShowShortcuts, setCanvasZoom, setCanvasOffset, setShowProjectsSidebar,
  setProjectsSidebarTab, wireStart, setWireStart, setSelected, setWireClickPos, setWires, setComponents,
  applyZoomAtCenter, showProjectsSidebar, handleNewProject, setIsConsoleOpen, setShowGrid, setIsCanvasLocked,
  isPanelOpen, setIsPanelOpen, codeTab, setCodeTab, fitToView, setWiresAlwaysOnTop, setShowCodeExplorer,
  setShowF1Menu, canvasZoomRef, canvasOffsetRef, innerCanvasRef,
  setProjectFiles, activeCodeFileId, code, setCode, handleExportPng, handleImportPng
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (!e || !e.key) return;

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Check if user is actively typing inside an input element, textarea, or Monaco code editor
      const isTyping = (() => {
        const t = e.target;
        if (!t) return false;
        const tag = t.tagName?.toUpperCase();
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return true;
        if (t.isContentEditable) return true;
        if (typeof t.closest === 'function' && t.closest('.monaco-editor, .monaco-diff-editor, .injectionDiv, .blocklyWorkspace, [role="textbox"], [contenteditable="true"]')) {
          return true;
        }
        return false;
      })();

      // === 1. GLOBAL SHORTCUTS (Work everywhere, even if focused in text inputs) ===

      // Escape key (Closes F1 Menu -> Modals -> Sidebars -> Wires -> Selection -> Simulation)
      if (e.key === 'Escape') { 
        if (typeof setShowF1Menu === 'function') setShowF1Menu(false);
        if (typeof setShowShortcuts === 'function') setShowShortcuts(false);
        if (typeof setShowProjectsSidebar === 'function' && showProjectsSidebar) {
          setShowProjectsSidebar(false);
          return;
        }
        if (wireStart) {
          setWireStart(null);
          setWireClickPos(null);
          return;
        }
        if (selected) {
          setSelected(null);
          return;
        }
        if (isRunning) {
          handleStop();
          return;
        }
        setWireClickPos(null);
        return;
      }

      // F1 Command Menu Overlay
      if (e.key === 'F1') {
        e.preventDefault();
        if (typeof setShowF1Menu === 'function') {
          setShowF1Menu(prev => !prev);
        }
        return;
      }

      // Help Shortcuts Modal (Alt+H)
      if (e.altKey && e.code === 'KeyH') {
        e.preventDefault();
        if (typeof setShowShortcuts === 'function') {
          setShowShortcuts(prev => !prev);
        }
        return;
      }
      
      // Save Project (Ctrl+S / Cmd+S)
      if (mod && key === 's' && !e.altKey) {
        e.preventDefault();
        handleSave();
        return;
      }

      // New Project (Ctrl+Alt+N / Cmd+Alt+N)
      if (mod && e.altKey && key === 'n') {
        e.preventDefault();
        handleNewProject();
        return;
      }

      // Open / Toggle Projects Sidebar (Ctrl+O / Cmd+O)
      if (mod && key === 'o') {
        e.preventDefault();
        setShowProjectsSidebar(prev => !prev);
        if (!showProjectsSidebar) setProjectsSidebarTab('projects');
        return;
      }

      // Toggle Console (Ctrl+B / Cmd+B)
      if (mod && key === 'b') {
        e.preventDefault();
        setIsConsoleOpen(prev => !prev);
        return;
      }

      // Toggle Right Panel (Alt+V)
      if (e.altKey && e.code === 'KeyV') {
        e.preventDefault();
        setIsPanelOpen(prev => !prev);
        return;
      }

      // Open Code Panel (Alt+C)
      if (e.altKey && e.code === 'KeyC') {
        e.preventDefault();
        if (isPanelOpen && codeTab === 'code') {
          setIsPanelOpen(false);
        } else {
          setIsPanelOpen(true);
          setCodeTab('code');
        }
        return;
      }

      // Open Serial Panel (Alt+S)
      if (e.altKey && e.code === 'KeyS') {
        e.preventDefault();
        if (isPanelOpen && codeTab === 'serial') {
          setIsPanelOpen(false);
        } else {
          setIsPanelOpen(true);
          setCodeTab('serial');
        }
        return;
      }

      // Code Explorer Toggle (Alt+E)
      if (e.altKey && e.code === 'KeyE') {
        e.preventDefault();
        if (isPanelOpen && codeTab === 'code') {
          setShowCodeExplorer(v => !v);
        } else {
          setIsPanelOpen(true);
          setCodeTab('code');
          setShowCodeExplorer(true);
        }
        return;
      }

      // Grid Toggle (Ctrl+G / Cmd+G)
      if (mod && key === 'g') {
        e.preventDefault();
        setShowGrid(prev => !prev);
        return;
      }

      // Lock Canvas Toggle (Ctrl+L / Cmd+L)
      if (mod && key === 'l') {
        e.preventDefault();
        setIsCanvasLocked(prev => !prev);
        return;
      }

      // Fit to View (Alt+F)
      if (e.altKey && e.code === 'KeyF') {
        e.preventDefault();
        fitToView('fit');
        return;
      }

      // Toggle Wires Always on Top (Alt+T)
      if (e.altKey && e.code === 'KeyT') {
        e.preventDefault();
        setWiresAlwaysOnTop(v => !v);
        return;
      }

      // Run / Stop Simulation (F5 or Ctrl+Enter / Cmd+Enter)
      if (e.key === 'F5' || (mod && e.key === 'Enter')) {
        e.preventDefault();
        if (!isRunning) handleRun();
        else handleStop();
        return;
      }

      // Zoom Controls (Alt + '+' or '-' or '0')
      if (e.altKey && (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd')) {
        e.preventDefault();
        applyZoomAtCenter(Math.min(2, parseFloat((canvasZoomRef.current + 0.25).toFixed(2))));
        return;
      }
      if (e.altKey && (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract')) {
        e.preventDefault();
        applyZoomAtCenter(Math.max(0.25, parseFloat((canvasZoomRef.current - 0.25).toFixed(2))));
        return;
      }
      if (e.altKey && (e.key === '0' || e.code === 'Numpad0')) {
        e.preventDefault();
        setCanvasZoom(1);
        setCanvasOffset({ x: 0, y: 0 });
        canvasZoomRef.current = 1;
        canvasOffsetRef.current = { x: 0, y: 0 };
        if (innerCanvasRef.current) {
          innerCanvasRef.current.style.transform = `translate(0px, 0px) scale(1)`;
        }
        return;
      }

      // PNG Import (Alt+I) / Export (Alt+P)
      if (e.altKey && e.code === 'KeyP') {
        e.preventDefault();
        if (handleExportPng) handleExportPng();
        return;
      }
      if (e.altKey && e.code === 'KeyI') {
        e.preventDefault();
        if (handleImportPng) handleImportPng();
        return;
      }

      // === 2. CANVAS SHORTCUTS (Ignored when typing in text input or code editor) ===
      if (isTyping) {
        return;
      }

      // Add Text Component ('t')
      if (key === 't' && !mod && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        saveHistory();
        const textCount = components.filter(c => c.type === 'openhw-text').length;
        const offset = textCount * 20;
        
        // Calculate center of screen
        const zoom = canvasZoomRef?.current || 1;
        const cOffset = canvasOffsetRef?.current || { x: 0, y: 0 };
        const centerX = (-cOffset.x + window.innerWidth / 2) / zoom;
        const centerY = (-cOffset.y + window.innerHeight / 2) / zoom;

        const newComp = {
          type: 'openhw-text',
          id: `openhw-text-${Date.now()}`,
          x: centerX - 30 + offset,
          y: centerY - 15 + offset,
          attrs: {}
        };
        
        setComponents(prev => [...prev, newComp]);
        setSelected(newComp.id);
        return;
      }

      // Add Image Component ('i')
      if (key === 'i' && !mod && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        saveHistory();
        const imageCount = components.filter(c => c.type === 'openhw-image').length;
        const offset = imageCount * 20;
        
        // Calculate center of screen
        const zoom = canvasZoomRef?.current || 1;
        const cOffset = canvasOffsetRef?.current || { x: 0, y: 0 };
        const centerX = (-cOffset.x + window.innerWidth / 2) / zoom;
        const centerY = (-cOffset.y + window.innerHeight / 2) / zoom;

        const newComp = {
          type: 'openhw-image',
          id: `openhw-image-${Date.now()}`,
          x: centerX - 75 + offset,
          y: centerY - 75 + offset,
          attrs: {}
        };
        
        setComponents(prev => [...prev, newComp]);
        setSelected(newComp.id);
        return;
      }

      // When Blocks tab is active and panel is open, ALL canvas shortcuts belong to Blockly!
      if (isPanelOpen && codeTab === 'block') {
        return;
      }

      // Undo (Ctrl+Z) / Redo (Ctrl+Y or Ctrl+Shift+Z)
      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      // Rotate Component ('R' or 'Alt+R' or 'Alt+Shift+R')
      if ((key === 'r' || (e.altKey && e.code === 'KeyR')) && selected && !isRunning && !liveEditingDisabled && !readOnly) {
        e.preventDefault();
        rotateComponent(selected);
        return;
      }

      // Delete Component or Wire (Delete / Backspace)
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !isRunning && !liveEditingDisabled && !readOnly) {
        e.preventDefault();
        saveHistory();
        if (selected.match(/^w\d+$/)) {
          setWires(prev => prev.filter(w => w.id !== selected));
        } else {
          // Shared Ownership Cleanup: Only delete if no other owners exist
          const id = selected;
          setComponents(prev => prev.map(c => {
            if (c.ownerIds?.includes(id)) {
              return { ...c, ownerIds: c.ownerIds.filter(oid => oid !== id) };
            }
            return c;
          }).filter(c => c.id !== id && (!c.ownerIds || c.ownerIds.length > 0)));

          setWires(prev => prev.map(w => {
            if (w.ownerIds?.includes(id)) {
              return { ...w, ownerIds: w.ownerIds.filter(oid => oid !== id) };
            }
            return w;
          }).filter(w =>
            !w.from.startsWith(id + ':') &&
            !w.to.startsWith(id + ':') &&
            (!w.ownerIds || w.ownerIds.length > 0)
          ));

          // Cleanup Autocode snippets
          setProjectFiles(prev => prev.map(f => {
            if (f.content) {
              const newContent = removeCodeSnippet(f.content, id);
              if (activeCodeFileId === f.id && code !== newContent) {
                setCode(newContent);
              }
              return { ...f, content: newContent };
            }
            return f;
          }));

          setSelected(null);
        }
        return;
      }

      // Clear Canvas (Ctrl+Shift+Delete / Cmd+Shift+Delete / Backspace)
      if (mod && e.shiftKey && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        if (!isRunning && !readOnly) {
          if (window.confirm('Clear all components and wires from the canvas?')) {
            saveHistory();
            setComponents([]);
            setWires([]);
            if (setProjectFiles) setProjectFiles(prev => prev.filter(f => f.id === 'project/diagram.json'));
            if (setCode) setCode('');
            setSelected(null);
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [
    selected, isRunning, liveEditingDisabled, saveHistory, handleSave, undo, redo, handleRun, handleStop,
    rotateComponent, components, setShowShortcuts, setCanvasZoom, setCanvasOffset, setShowProjectsSidebar,
    setProjectsSidebarTab, wireStart, setWireStart, setSelected, setWireClickPos, setWires, setComponents,
    applyZoomAtCenter, showProjectsSidebar, handleNewProject, setIsConsoleOpen, setShowGrid, setIsCanvasLocked,
    isPanelOpen, setIsPanelOpen, codeTab, setCodeTab, fitToView, setWiresAlwaysOnTop, setShowCodeExplorer,
    setShowF1Menu, canvasZoomRef, canvasOffsetRef, innerCanvasRef,
    setProjectFiles, activeCodeFileId, code, setCode, handleExportPng, handleImportPng
  ]);
}




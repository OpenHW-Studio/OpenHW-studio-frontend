import { useEffect } from 'react';
import { removeCodeSnippet } from '../projectUtils';

/**
 * Custom hook to manage global keyboard shortcuts for the Simulator.
 * Extracts the complex keydown logic from SimulatorPage.jsx.
 */
export function useSimulatorShortcuts({
  selected, isRunning, liveEditingDisabled, saveHistory, handleSave, undo, redo, handleRun, handleStop,
  rotateComponent, components, setShowShortcuts, setCanvasZoom, setCanvasOffset, setShowProjectsSidebar,
  setProjectsSidebarTab, wireStart, setWireStart, setSelected, setWireClickPos, setWires, setComponents,
  applyZoomAtCenter, showProjectsSidebar, handleNewProject, setIsConsoleOpen, setShowGrid, setIsCanvasLocked,
  isPanelOpen, setIsPanelOpen, codeTab, setCodeTab, fitToView, setWiresAlwaysOnTop, setShowCodeExplorer,
  setShowF1Menu, canvasZoomRef, canvasOffsetRef, innerCanvasRef,
  setProjectFiles, activeCodeFileId, code, setCode
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setShowF1Menu(prev => !prev);
        return;
      }
      
      // Shortcuts that work even if input is focused
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
        return;
      }

      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Blocks tab uses Blockly's own undo stack — do not touch the circuit history.
      if (isPanelOpen && codeTab === 'block') {
        if (mod && (key === 'z' || key === 'y')) return;
      }

      // Undo/Redo (circuit canvas only)
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

      // Simulation Control
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
        e.preventDefault();
        if (!isRunning) handleRun();
        else handleStop();
        return;
      }

      if (e.key === 'Escape') { 
        if (wireStart) setWireStart(null);
        else if (selected) setSelected(null);
        else if (isRunning) handleStop();
        setWireClickPos(null); 
      }

      // Edit
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !isRunning && !liveEditingDisabled) {
        saveHistory();
        if (selected.match(/^w\d+$/)) {
          setWires(prev => prev.filter(w => w.id !== selected))
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
      }

      if (e.altKey && e.shiftKey && e.code === 'KeyR' && selected && !isRunning && !liveEditingDisabled) {
        e.preventDefault();
        if (components.find(c => c.id === selected)) {
          rotateComponent(selected);
        }
      }

      if (e.altKey && e.code === 'KeyH') {
        setShowShortcuts(prev => !prev);
      }

      if (e.altKey && e.code === 'KeyV') {
        setIsPanelOpen(prev => !prev);
      }

      if (e.altKey && (e.key === '+' || e.key === '=')) {
        applyZoomAtCenter(Math.min(2, parseFloat((canvasZoomRef.current + 0.25).toFixed(2))));
      }
      if (e.altKey && (e.key === '-' || e.key === '_')) {
        applyZoomAtCenter(Math.max(0.25, parseFloat((canvasZoomRef.current - 0.25).toFixed(2))));
      }
      if (e.altKey && e.key === '0') {
        setCanvasZoom(1);
        setCanvasOffset({ x: 0, y: 0 });
        canvasZoomRef.current = 1;
        canvasOffsetRef.current = { x: 0, y: 0 };
        if (innerCanvasRef.current) {
          innerCanvasRef.current.style.transform = `translate(0px, 0px) scale(1)`;
        }
      }

      // Projects
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setShowProjectsSidebar(prev => !prev);
        if (!showProjectsSidebar) setProjectsSidebarTab('projects');
      }

      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewProject();
      }

      // Panels & UI
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsConsoleOpen(prev => !prev);
      }

      if (e.altKey && e.code === 'KeyC') {
        e.preventDefault();
        if (isPanelOpen && codeTab === 'code') {
          setIsPanelOpen(false);
        } else {
          setIsPanelOpen(true);
          setCodeTab('code');
        }
      }

      if (e.altKey && e.code === 'KeyS') {
        e.preventDefault();
        if (isPanelOpen && codeTab === 'serial') {
          setIsPanelOpen(false);
        } else {
          setIsPanelOpen(true);
          setCodeTab('serial');
        }
      }

      if (e.altKey && e.code === 'KeyE') {
        e.preventDefault();
        if (isPanelOpen && codeTab === 'code') {
          setShowCodeExplorer(v => !v);
        } else {
          setIsPanelOpen(true);
          setCodeTab('code');
          setShowCodeExplorer(true);
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setShowGrid(prev => !prev);
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setIsCanvasLocked(prev => !prev);
      }

      // Canvas Actions
      if (e.altKey && e.code === 'KeyF') {
        e.preventDefault();
        fitToView('fit');
      }

      if (e.altKey && e.code === 'KeyT') {
        e.preventDefault();
        setWiresAlwaysOnTop(v => !v);
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        if (!isRunning) {
          if (window.confirm('Clear all components and wires from the canvas?')) {
            saveHistory();
            setComponents([]);
            setWires([]);
            if (setProjectFiles) setProjectFiles(prev => prev.filter(f => f.id === 'project/diagram.json'));
            if (setCode) setCode('');
            setSelected(null);
          }
        }
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
    setProjectFiles, activeCodeFileId, code, setCode
  ]);
}

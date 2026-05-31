import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useTourLogic - Custom hook to manage the interactive simulation tour logic.
 * Extracted from SimulatorPage to keep the main component clean.
 */
export const useTourLogic = ({
  setComponents,
  setWires,
  setCodeTab,
  setIsPanelOpen,
  setSerialViewMode,
  setIsPaletteHovered, // closes the left components palette
  windowSize
}) => {
  const [showTour, setShowTour] = useState(false);
  const [tourActiveStep, setTourActiveStep] = useState(null);
  const demoComponentIdRef = useRef(null);
  const demoWireIdRef = useRef(null);

  // Initial check for tour completion
  useEffect(() => {
    const tourCompleted = localStorage.getItem('openhw_tour_completed');
    if (!tourCompleted) {
      setShowTour(true);
    }
  }, []);

  const handleFinishTour = useCallback(() => {
    setShowTour(false);
    setTourActiveStep(null);
    localStorage.setItem('openhw_tour_completed', 'true');
    
    // Always purge demo artifacts by their known IDs.
    // Refs alone are unreliable — they may have been cleared mid-tour
    // (e.g. remove-demo-wire sets demoWireIdRef to null) leaving orphans on canvas.
    setComponents(prev => prev.filter(c => c.id !== 'demo-comp-tour' && !c.isDemo));
    setWires(prev => prev.filter(w => w.id !== 'demo-wire-tour' && !w.isDemo));
    demoComponentIdRef.current = null;
    demoWireIdRef.current = null;
  }, [setComponents, setWires]);

  // Auto-close both panels whenever the tour opens
  useEffect(() => {
    if (showTour) {
      setIsPanelOpen(false);
      setIsPaletteHovered?.(false);
    }
  }, [showTour, setIsPanelOpen, setIsPaletteHovered]);

  const handleTourDemoAction = useCallback((action) => {
    if (action === 'add-component') {
      const id = 'demo-comp-tour';
      const newComp = {
        id,
        type: 'wokwi-arduino-uno',
        x: 600,
        y: 400,
        w: 260,
        h: 190,
        state: {},
        attrs: {},
        isDemo: true
      };
      setComponents(prev => [...prev.filter(c => c.id !== id), newComp]);
      demoComponentIdRef.current = id;
    } else if (action === 'remove-component') {
      if (demoComponentIdRef.current) {
        setComponents(prev => prev.filter(c => c.id !== demoComponentIdRef.current));
        demoComponentIdRef.current = null;
      }
    } else if (action === 'show-quick-add') {
      const ev = new CustomEvent('quick-add-open', {
        detail: {
          screenX: window.innerWidth / 3,
          screenY: window.innerHeight / 2,
          canvasX: 600,
          canvasY: 400
        }
      });
      window.dispatchEvent(ev);
    } else if (action === 'hide-quick-add') {
      // Mousedown outside closes it
      if (document.dispatchEvent) {
         document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      }
    } else if (action === 'add-demo-wire') {
      const id = 'demo-wire-tour';
      const newWire = {
        id,
        from: 'demo-comp-tour:13',
        to: 'demo-comp-tour:GND',
        color: 'var(--accent)',
        isDemo: true
      };
      setWires(prev => [...prev.filter(w => w.id !== id), newWire]);
      demoWireIdRef.current = id;
    } else if (action === 'remove-demo-wire') {
      if (demoWireIdRef.current) {
        setWires(prev => prev.filter(w => w.id !== demoWireIdRef.current));
        demoWireIdRef.current = null;
      }
    } else if (action === 'switch-blockly') {
      // Tab ID is 'block', not 'blockly'
      setCodeTab('block');
      setIsPanelOpen(true);
    } else if (action === 'switch-library') {
      // Libraries live inside the Code tab (no separate 'library' tab)
      setCodeTab('code');
      setIsPanelOpen(true);
    } else if (action === 'switch-serial') {
      setCodeTab('serial');
      setSerialViewMode?.('monitor');
      setIsPanelOpen(true);
    } else if (action === 'switch-plotter') {
      // Plotter is a view mode inside the Serial tab, not its own tab
      setCodeTab('serial');
      setSerialViewMode?.('plotter');
      setIsPanelOpen(true);
    }
  }, [setComponents, setWires, setCodeTab, setIsPanelOpen, setSerialViewMode, setIsPaletteHovered]);

  return {
    showTour,
    setShowTour,
    tourActiveStep,
    setTourActiveStep,
    handleFinishTour,
    handleTourDemoAction
  };
};
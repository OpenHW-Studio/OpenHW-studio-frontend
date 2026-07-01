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
  windowSize,
  openCodeFile
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
      setComponents(prev => prev.filter(c => c.id !== 'demo-comp-tour' && c.id !== 'demo-led-tour' && c.id !== 'demo-resistor-tour'));
      demoComponentIdRef.current = null;
    } else if (action === 'add-wiring-components') {
      const arduino = {
        id: 'demo-comp-tour',
        type: 'wokwi-arduino-uno',
        x: 450,
        y: 350,
        w: 260,
        h: 190,
        state: {},
        attrs: {},
        isDemo: true
      };
      const led = {
        id: 'demo-led-tour',
        type: 'openhw-led',
        x: 480,
        y: 150,
        w: 65,
        h: 65,
        state: {},
        attrs: { color: "red" },
        isDemo: true
      };
      setComponents(prev => [...prev.filter(c => c.id !== 'demo-comp-tour' && c.id !== 'demo-led-tour'), arduino, led]);
      demoComponentIdRef.current = 'demo-comp-tour';
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
    } else if (action === 'add-demo-wire-1') {
      const wire1 = {
        id: 'demo-wire-tour-1',
        from: 'demo-comp-tour:13',
        to: 'demo-led-tour:A',
        color: 'var(--accent)',
        isDemo: true
      };
      setWires(prev => [...prev.filter(w => w.id !== 'demo-wire-tour-1'), wire1]);
      demoWireIdRef.current = 'demo-wire-tour-1';
    } else if (action === 'add-demo-wire-2') {
      const wire2 = {
        id: 'demo-wire-tour-2',
        from: 'demo-comp-tour:gnd_3',
        to: 'demo-led-tour:K',
        color: 'black',
        isDemo: true
      };
      setWires(prev => [...prev.filter(w => w.id !== 'demo-wire-tour-2'), wire2]);
    } else if (action === 'remove-demo-wire') {
      setWires(prev => prev.filter(w => !w.isDemo));
      demoWireIdRef.current = null;
    } else if (action === 'execute-autowire-demo') {
      const resistor = {
        id: 'demo-resistor-tour',
        type: 'openhw-resistor',
        x: 520,
        y: 260,
        w: 65,
        h: 20,
        state: {},
        attrs: { value: '220' },
        isDemo: true
      };
      const w1 = { id: 'demo-auto-1', from: 'demo-led-tour:A', to: 'demo-resistor-tour:1', color: 'var(--accent)', isDemo: true };
      const w2 = { id: 'demo-auto-2', from: 'demo-resistor-tour:2', to: 'demo-comp-tour:13', color: 'var(--accent)', isDemo: true };
      const w3 = { id: 'demo-auto-3', from: 'demo-led-tour:K', to: 'demo-comp-tour:gnd_3', color: 'black', isDemo: true };
      
      setComponents(prev => [...prev.filter(c => c.id !== 'demo-resistor-tour'), resistor]);
      setWires(prev => [...prev, w1, w2, w3]);
    } else if (action === 'switch-blockly') {
      // Tab ID is 'block', not 'blockly'
      setCodeTab('block');
      setIsPanelOpen(true);
    } else if (action === 'switch-library') {
      // Libraries live inside the Code tab (no separate 'library' tab)
      setCodeTab('code');
      setIsPanelOpen(true);
    } else if (action === 'open-library-txt') {
      setCodeTab?.('code');
      setIsPanelOpen?.(true);
      if (openCodeFile) openCodeFile('project/demo-comp-tour/library.txt');
    } else if (action === 'open-demo-ino') {
      setCodeTab?.('code');
      setIsPanelOpen?.(true);
      if (openCodeFile) openCodeFile('project/demo-comp-tour/demo-comp-tour.ino');
    } else if (action === 'open-library-panel') {
      window.dispatchEvent(new Event('open-library-panel'));
    } else if (action === 'close-library-panel') {
      window.dispatchEvent(new Event('close-library-panel'));
    } else if (action === 'switch-serial') {
      setCodeTab('serial');
      setSerialViewMode?.('monitor');
      setIsPanelOpen(true);
    } else if (action === 'switch-monitor') {
      setCodeTab?.('serial');
      setSerialViewMode?.('monitor');
    } else if (action === 'switch-plotter') {
      // Plotter is a view mode inside the Serial tab, not its own tab
      setCodeTab('serial');
      setSerialViewMode?.('plotter');
      setIsPanelOpen(true);
    } else if (action === 'open-console') {
      window.dispatchEvent(new Event('open-simulation-console'));
    } else if (action === 'close-console') {
      window.dispatchEvent(new Event('close-simulation-console'));
    } else if (action === 'clear-console') {
      window.dispatchEvent(new Event('clear-simulation-console'));
    } else if (action === 'console-demo-log') {
      console.log("[System] Booting simulator engine...");
      setTimeout(() => console.log("[Compiler] Building project for target: Arduino Uno"), 400);
      setTimeout(() => console.log("[Compiler] Success! Firmware size: 14.2kb"), 800);
      setTimeout(() => console.log("[Hardware] Device successfully connected on virtual port"), 1200);
    } else if (action === 'close-right-panel') {
      setIsPanelOpen?.(false);
    } else if (action === 'close-palette') {
      setIsPaletteHovered?.(false);
    }
  }, [setComponents, setWires, setCodeTab, setIsPanelOpen, setSerialViewMode, setIsPaletteHovered, openCodeFile]);

  return {
    showTour,
    setShowTour,
    tourActiveStep,
    setTourActiveStep,
    handleFinishTour,
    handleTourDemoAction
  };
};
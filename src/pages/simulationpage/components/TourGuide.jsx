import React, { useState, useEffect, useRef, useCallback } from 'react';
import './TourGuide.css';

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to OpenHW Studio! 🚀',
    content: "Let's take a quick 1-minute tour to see how you can build and simulate Arduino projects right in your browser.",
    target: null,
    position: 'center',
    spotlightPadding: 8,
  },
  {
    id: 'quick-add',
    target: '[data-tour-id="tour-canvas"]',
    fallbackTarget: 'main',
    title: 'Quick Add Portal',
    content: 'Double-click anywhere on the canvas to instantly find and add components. It\'s the fastest way to build your circuit.',
    position: 'top-center',
    action: 'quick-add',
    spotlightPadding: 0,
    // letMeTryTrigger: which DOM event + element to listen for to auto-advance.
    // Use 'window' as selector to listen globally (for custom app-dispatched events).
    letMeTryTrigger: {
      event: 'dblclick',
      selector: '[data-tour-id="tour-canvas"]',
      fallbackSelector: 'main',
    },
    letMeTryHint: 'Double-click anywhere on the canvas to continue →',
  },
  {
    id: 'drag-demo',
    target: '[data-tour-id="tour-canvas"]',
    fallbackTarget: 'main',
    title: 'Component Movement',
    content: 'Simply drag any component to reposition it. Components snap to the grid for professional, clean layouts.',
    position: 'top-center',
    action: 'drag',
    spotlightPadding: 0,
    // Native drag detection: mousedown + mouseup with distance threshold.
    // No custom event needed — works out of the box.
    letMeTryTrigger: { type: 'drag', minDistance: 24 },
    letMeTryHint: 'Drag any component to a new position to continue →',
  },
  {
    id: 'wiring',
    target: '[data-tour-id="tour-canvas"]',
    fallbackTarget: 'main',
    title: 'Intelligent Wiring',
    content: 'Connect pins by clicking and dragging. The simulator automatically calculates the best path for your wires.',
    position: 'top-right',
    action: 'wire',
    spotlightPadding: 0,
    // App should dispatch: new CustomEvent('openhw:wire-created', { bubbles: true })
    letMeTryTrigger: { event: 'openhw:wire-created', selector: 'window' },
    letMeTryHint: 'Connect two pins with a wire to continue →',
  },
  {
    id: 'autowiring',
    target: '[data-tour-id="tour-canvas"]',
    fallbackTarget: 'main',
    title: 'Intelligent Autowiring',
    content: 'Select a component, right click, then choose Wire To. This automatically adds required components like resistors and routes the wires perfectly.',
    position: 'top-right',
    action: 'add-wiring-components',
    spotlightPadding: 0,
    letMeTryHint: 'Try right-clicking a component to see its context menu, then click Done →',
  },
  {
    id: 'components-palette',
    // The palette already carries a stable data-tour-id in PalettePanel
    target: '[data-tour-id="palette-panel"]',
    title: 'Components Palette',
    content: 'Browse hundreds of components — boards, sensors, displays, and more. Drag any component straight onto the canvas.',
    position: 'right',
    spotlightPadding: 0,   // full sidebar, no extra padding needed
  },
  {
    id: 'projects',
    // TopToolbox MenuButton exposes data-tour-id="menu-file" on the File menu
    target: '[data-tour-id="menu-file"]',
    title: 'Save Your Work',
    content: 'Use the File menu to save your project, open existing ones, import files, or make a local backup copy.',
    position: 'bottom',
    spotlightPadding: 6,
  },
  {
    id: 'ide',
    target: '[data-tour-step="ide"]',
    title: 'Integrated IDE',
    content: 'A professional-grade editor for your firmware. Supports multi-file projects and real-time syntax checking.',
    position: 'left',
    action: 'switch-code', // the panel is collapsed on tour start; open it before measuring
    spotlightPadding: 8,
  },
  {
    id: 'blockly',
    target: '[data-tour-step="blockly"]',
    title: 'Visual Block Coding',
    content: 'Prefer visual logic? Switch to Blockly to build your firmware with drag-and-drop blocks.',
    position: 'left',
    action: 'switch-blockly',
    spotlightPadding: 8,
    letMeTryTrigger: {
      event: 'click',
      selector: '[data-tour-id="tab-block"]',
      fallbackSelector: '[data-tour-step="blockly"]',
    },
    letMeTryHint: 'Click the Blockly tab to continue →',
  },
  {
    id: 'library',
    target: '[data-tour-step="library"]',
    title: 'Library Manager',
    content: 'Click Libraries in code section to browse and install thousands of community-built libraries for sensors, displays, and communication protocols.',
    position: 'top',
    action: 'switch-library',  // ensures Code tab is active so the Libraries button is visible
    spotlightPadding: 6,
    letMeTryHint: 'Click the Libraries button to continue →',
  },
  {
    id: 'serial',
    target: '[data-tour-step="serial"]',
    title: 'Serial Monitor',
    content: 'Interact with your simulated hardware in real-time. Send commands and view debug output instantly.',
    position: 'left',
    action: 'switch-serial',
    spotlightPadding: 8,
    letMeTryTrigger: {
      event: 'click',
      selector: '[data-tour-id="tab-serial"]',
      fallbackSelector: '[data-tour-step="serial"]',
    },
    letMeTryHint: 'Click the Serial Monitor tab to continue →',
  },
  {
    id: 'plotter',
    target: '[data-tour-step="plotter"]',
    title: 'Real-time Plotter',
    content: 'Visualize high-frequency sensor data with our built-in oscilloscope and telemetry plotter.',
    position: 'left',
    action: 'switch-plotter',
    spotlightPadding: 8,
    letMeTryTrigger: {
      event: 'click',
      // Plotter is a view-mode toggle inside the Serial tab, not a separate tab
      selector: '[data-tour-id="plotter-view-btn"]',
      fallbackSelector: '[data-tour-step="plotter"]',
    },
    letMeTryHint: 'Switch to Plotter inside the Serial Monitor to continue →',
  },
  {
    id: 'console',
    target: '#tour-console-btn',
    title: 'System Console',
    content: 'Check for compilation logs, system warnings, and hardware connection status here.',
    position: 'top',
    spotlightPadding: 16,
  },
  {
    id: 'finish',
    title: 'Ready to Create!',
    content: "You're all set! Start building your first project or explore the examples library to see what's possible.",
    position: 'center',
    spotlightPadding: 8,
  },
];

// Only query focusable elements inside the tooltip for Tab trapping
const FOCUSABLE_SELECTORS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ─────────────────────────────────────────────────────────────────────────────
// Target resolution
//
// A selector is only useful if the element it matches is actually on screen.
// Several panels in the simulator keep off-screen DOM nodes mounted (the
// palette is translated -302px, the right panel and projects sidebar collapse
// to zero width), so document.querySelector alone happily returns a hidden
// element and the spotlight lands in the wrong place.
// ─────────────────────────────────────────────────────────────────────────────
function isUsableElement(el) {
  if (!el || el.getClientRects().length === 0) return false;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  return r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
}

function queryVisible(selector) {
  if (!selector) return null;
  try {
    for (const el of document.querySelectorAll(selector)) {
      if (isUsableElement(el)) return el;
    }
  } catch {
    // A malformed legacy selector must never break the tour.
  }
  return null;
}

function resolveTargetEl(step) {
  if (!step?.target) return null;
  for (const selector of step.target.split(',')) {
    const el = queryVisible(selector.trim());
    if (el) return el;
  }
  for (const selector of (step.fallbackTarget || '').split(',')) {
    const el = queryVisible(selector.trim());
    if (el) return el;
  }
  return null;
}

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// Where the ghost pointer should be for each step. The first visible match
// wins; the canvas is always the last resort so the pointer never ends up
// parked on an off-screen palette item (a previous bug).
const GHOST_SELECTORS = {
  'quick-add': '[data-tour-id="tour-canvas"], main',
  'drag-demo': '[id*="comp-master-demo-comp-tour"], [data-tour-id="tour-canvas"], main',
  wiring: (phase) => {
    if (phase <= 2) return '[id*="pin-dot-demo-comp-tour-13"], [data-tour-id="tour-canvas"], main';
    if (phase <= 4) return '[id*="pin-dot-demo-led-tour-A"], [data-tour-id="tour-canvas"], main';
    if (phase <= 6) return '[id*="pin-dot-demo-comp-tour-gnd_3"], [data-tour-id="tour-canvas"], main';
    return '[id*="pin-dot-demo-led-tour-K"], [data-tour-id="tour-canvas"], main';
  },
  autowiring: '[id*="comp-master-demo-led-tour"], [data-tour-id="tour-canvas"], main',
  'components-palette': '[data-tour-id="palette-panel"]',
  projects: '[data-tour-id="menu-file"]',
  ide: '[data-tour-step="ide"]',
  blockly: '[data-tour-step="blockly"], [data-tour-id="tab-block"]',
  library: '[data-tour-step="library"], [data-tour-file="library.txt"]',
  serial: '[data-tour-id="tab-serial"], [data-tour-step="serial"]',
  plotter: '[data-tour-id="plotter-view-btn"], [data-tour-step="plotter"]',
  console: '#tour-console-btn',
};

function ghostSelectorFor(step, phase) {
  const configured = GHOST_SELECTORS[step.id];
  return typeof configured === 'function' ? configured(phase) : configured;
}

function sameRect(a, b) {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5 &&
    a.padding === b.padding
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TourGuide
// ─────────────────────────────────────────────────────────────────────────────
const TourGuide = ({ onFinish, onStepChange, onDemoAction }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);
  // Visibility is owned by the parent (showTour); this component is mounted
  // only while a tour is actually running. A remount (new key from the Help
  // menu) always starts a fresh tour at step 0.
  const [isVisible, setIsVisible] = useState(true);
  const [demoPhase, setDemoPhase] = useState(0);
  const [ghostMousePos, setGhostMousePos] = useState({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
  const [ghostWireStart, setGhostWireStart] = useState(null);
  // 'show-me'   → ghost cursor runs the demo animation
  // 'let-me-try' → ghost cursor hidden; spotlight waits for the user
  const [mode, setMode] = useState('show-me');

  const tooltipRef = useRef(null);

  // ── Continuous geometry tracking ─────────────────────────────────────────
  // Measuring once per step (or on resize alone) goes stale the moment a
  // panel slides in, the canvas is transformed, the DOM re-renders or the
  // user scrolls. One rAF loop re-resolves and re-measures the live element
  // every frame; React state is only updated when the rect actually moves.
  useEffect(() => {
    if (!isVisible) return undefined;
    let frame = 0;
    const tick = () => {
      const step = STEPS[currentStep];
      const targetEl = resolveTargetEl(step);
      const rect = targetEl?.getBoundingClientRect();
      const nextRect = targetEl && rect && rect.width >= 2 && rect.height >= 2
        ? {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            padding: step.spotlightPadding ?? 4,
          }
        : null;
      setSpotlightRect(prev => (sameRect(prev, nextRect) ? prev : nextRect));

      if (mode === 'show-me') {
        const ghostEl = queryVisible(ghostSelectorFor(step, demoPhase));
        const ghostRect = ghostEl?.getBoundingClientRect();
        let pos = ghostRect && ghostRect.width >= 2 && ghostRect.height >= 2
          ? { x: ghostRect.left + ghostRect.width / 2, y: ghostRect.top + ghostRect.height / 2 }
          : nextRect
            ? { x: nextRect.left + nextRect.width / 2, y: nextRect.top + nextRect.height / 2 }
            : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

        // Keep the fake context-menu offsets, but never let the pointer drift
        // outside its step target or the viewport.
        if (step.id === 'autowiring') {
          if (demoPhase === 3) { pos.x += 115; pos.y += 168; }
          else if (demoPhase >= 4) { pos.x += 255; pos.y += 168; }
        }
        if (targetEl && nextRect) {
          const margin = 24;
          pos = {
            x: nextRect.width <= margin * 2
              ? nextRect.left + nextRect.width / 2
              : clamp(pos.x, nextRect.left + margin, nextRect.left + nextRect.width - margin),
            y: nextRect.height <= margin * 2
              ? nextRect.top + nextRect.height / 2
              : clamp(pos.y, nextRect.top + margin, nextRect.top + nextRect.height - margin),
          };
        }
        pos = {
          x: clamp(pos.x, 20, window.innerWidth - 20),
          y: clamp(pos.y, 20, window.innerHeight - 20),
        };
        setGhostMousePos(prev => (
          Math.abs(prev.x - pos.x) < 0.5 && Math.abs(prev.y - pos.y) < 0.5 ? prev : pos
        ));

        if (step.id === 'wiring') {
          const start = (demoPhase === 2 || demoPhase === 6) ? pos : null;
          setGhostWireStart(prev => (
            prev === start || (prev && start && Math.abs(prev.x - start.x) < 0.5 && Math.abs(prev.y - start.y) < 0.5)
              ? prev
              : start
          ));
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isVisible, currentStep, demoPhase, mode]);

  // ── Step change: notify parent and reset the demo phase ──────────────────
  useEffect(() => {
    if (!isVisible) return;
    onStepChange?.(STEPS[currentStep].id);
    setDemoPhase(0);
  }, [currentStep, isVisible, onStepChange]);

  // ── Focus management: move focus into tooltip on each step ───────────────
  useEffect(() => {
    if (isVisible) tooltipRef.current?.focus();
  }, [currentStep, isVisible]);

  // ── Keyboard navigation ──────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    setCurrentStep(prev => (prev < STEPS.length - 1 ? prev + 1 : prev));
    if (currentStep === STEPS.length - 1) {
      localStorage.setItem('openhw-tour-completed', 'true');
      setIsVisible(false);
      setTimeout(onFinish, 300);
    }
  }, [currentStep, onFinish]);

  const handleBack = useCallback(() => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  }, []);

  const handleFinish = useCallback(() => {
    localStorage.setItem('openhw-tour-completed', 'true');
    setIsVisible(false);
    setTimeout(onFinish, 300);
  }, [onFinish]);

  useEffect(() => {
    if (!isVisible) return;
    const onKeyDown = (e) => {
      switch (e.key) {
        case 'Enter':
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleBack();
          break;
        case 'Escape':
          e.preventDefault();
          handleFinish();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isVisible, handleNext, handleBack, handleFinish]);

  // ── Focus trapping: keep Tab inside the tooltip ──────────────────────────
  useEffect(() => {
    if (!isVisible) return;
    const onTab = (e) => {
      if (e.key !== 'Tab' || !tooltipRef.current) return;
      const focusable = Array.from(
        tooltipRef.current.querySelectorAll(FOCUSABLE_SELECTORS)
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onTab);
    return () => window.removeEventListener('keydown', onTab);
  }, [isVisible, currentStep]);

  // ── Demo actions (show-me mode only) ────────────────────────────────────
  useEffect(() => {
    if (!isVisible || !onDemoAction || mode !== 'show-me') return;
    const step = STEPS[currentStep];

    if (step.id === 'drag-demo') {
      if (demoPhase === 0) onDemoAction('remove-component');
      if (demoPhase === 2) onDemoAction('add-component');
    }
    if (step.id === 'quick-add') {
      if (demoPhase === 2) onDemoAction('show-quick-add');
      if (demoPhase === 5) onDemoAction('hide-quick-add');
    }
    if (step.id === 'wiring') {
      if (demoPhase === 0) {
        onDemoAction('remove-demo-wire');
        onDemoAction('remove-component');
      }
      if (demoPhase === 1) onDemoAction('add-wiring-components');
      if (demoPhase === 4) onDemoAction('add-demo-wire-1');
      if (demoPhase === 8) onDemoAction('add-demo-wire-2');
    }
    if (step.id === 'autowiring') {
      if (demoPhase === 0) {
        onDemoAction('remove-demo-wire');
        onDemoAction('remove-component');
      }
      if (demoPhase === 1) onDemoAction('add-wiring-components');
      if (demoPhase === 5) onDemoAction('execute-autowire-demo');
    }
    if (step.id === 'library') {
      if (demoPhase === 0) {
        onDemoAction('close-library-panel');
        onDemoAction('open-demo-ino');
        // The Libraries button only renders while library.txt is active.
        // Make it available as soon as the step opens (not 1.8s later).
        onDemoAction('open-library-txt');
      }
      if (demoPhase === 1) onDemoAction('open-library-txt');
      if (demoPhase === 3) onDemoAction('open-library-panel');
    }
    if (step.id === 'plotter') {
      if (demoPhase === 0) onDemoAction('switch-monitor');
      if (demoPhase === 2) onDemoAction('switch-plotter');
    }
    if (step.id === 'console') {
      if (demoPhase === 0) {
        onDemoAction('reset-autowiring');
        onDemoAction('close-palette');
        onDemoAction('close-right-panel');
        onDemoAction('clear-console');
        onDemoAction('close-console');
      }
      if (demoPhase === 2) {
        onDemoAction('open-console');
        onDemoAction('console-demo-log');
      }
    }
    // Fire panel-switch actions immediately (phase 0 = step entry) so the correct
    // tab is visible right away regardless of which tab the user was on before.
    if (step.action?.startsWith('switch-') && demoPhase === 0 && step.id !== 'library' && step.id !== 'plotter' && step.id !== 'console') {
      onDemoAction(step.action);
    }
  }, [demoPhase, currentStep, isVisible, onDemoAction, mode]);

  // ── Demo phase loop (show-me mode only) ─────────────────────────────────
  useEffect(() => {
    if (mode !== 'show-me') return;
    const interval = setInterval(() => {
      setDemoPhase(p => {
        const maxPhases = STEPS[currentStep].id === 'wiring' ? 9 : (STEPS[currentStep].id === 'library' ? 5 : (STEPS[currentStep].id === 'plotter' ? 5 : (STEPS[currentStep].id === 'console' ? 5 : 6)));
        return (p + 1) % maxPhases;
      });
    }, 1800);
    return () => {
      clearInterval(interval);
      // Clean up any live demo artefacts when leaving a step
      onDemoAction?.('remove-component');
      onDemoAction?.('hide-quick-add');
      onDemoAction?.('remove-demo-wire');
      onDemoAction?.('remove-demo-library-file');
    };
  }, [currentStep, onDemoAction, mode]);

  // ── Unconditional unmount cleanup ────────────────────────────────────────
  // Covers Skip/Finish in let-me-try mode where the phase loop cleanup above
  // never runs (mode !== 'show-me'). handleFinishTour in useTourLogic also
  // purges by ID, giving us two layers of defence.
  useEffect(() => {
    return () => {
      onDemoAction?.('remove-component');
      onDemoAction?.('hide-quick-add');
      onDemoAction?.('remove-demo-wire');
      onDemoAction?.('remove-demo-library-file');
    };
  }, [onDemoAction]);

  // ── Let Me Try: no auto-advance ─────────────────────────────────────────
  // Advancement is intentionally manual — only the "Done ✓" button on the
  // badge moves to the next step. This prevents accidental tab clicks or
  // stray events from skipping steps the user hasn't finished exploring.

  // ── Tooltip positioning ──────────────────────────────────────────────────
  const getTooltipStyle = () => {
    const step = STEPS[currentStep];
    if (!spotlightRect) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
    const margin = 20;
    const { top, left, width, height } = spotlightRect;

    switch (step.position) {
      case 'top-center':
        // Canvas-wide steps: float at the very top so the full canvas is visible
        return { top: 16, bottom: 'auto', left: '50%', transform: 'translateX(-50%)' };
      case 'top-right':
        return { top: 16, right: 16, bottom: 'auto', left: 'auto', transform: 'none' };
      case 'bottom':
        return {
          top: top + height + margin,
          bottom: 'auto',
          left: Math.max(20, left + width / 2 - 160),
        };
      case 'top':
        return {
          top: Math.max(20, top - 320 - margin),
          bottom: 'auto',
          left: Math.max(20, left + width / 2 - 160),
        };
      case 'left':
        return {
          top: top + height / 2 - 130,
          bottom: 'auto',
          left: Math.max(20, left - 340 - margin),
          right: 'auto',
        };
      case 'right':
        return {
          top: top + height / 2 - 130,
          bottom: 'auto',
          left: left + width + margin,
          right: 'auto',
        };
      case 'center':
      default:
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          bottom: 'auto',
          right: 'auto',
        };
    }
  };

  if (!isVisible) return null;

  const step = STEPS[currentStep];
  const pad = spotlightRect?.padding ?? 4;

  // ── Let Me Try mode: hide the entire overlay so the canvas is fully
  // interactive. A tiny fixed badge tells the user what to do and lets
  // them bail back to Show Me. The event listener (above) fires on the
  // real action, calls advance(), resets mode → 'show-me', and moves to
  // the next step — at which point the full tour reappears automatically.
  if (mode === 'let-me-try') {
    return (
      <div className="tour-lmt-active" role="status" aria-live="polite">
        <div className="tour-lmt-badge">
          <span className="tour-lmt-badge-icon">🖐</span>
          <span className="tour-lmt-badge-text">{step.letMeTryHint ?? 'Try it out!'}</span>
          <div className="tour-lmt-badge-actions">
            <button
              className="tour-lmt-badge-cancel"
              onClick={() => setMode('show-me')}
              aria-label="Go back to tour"
            >
              ← Show Me
            </button>
            <button
              className="tour-lmt-badge-done"
              onClick={() => { setMode('show-me'); handleNext(); }}
              aria-label="Done, go to next step"
            >
              Done ✓
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tour-overlay">
      {/* ── Ghost cursor (show-me mode only) ──────────────────────────── */}
      {mode === 'show-me' && (
        <>
          {step.id === 'wiring' && ghostWireStart && (demoPhase === 3 || demoPhase === 7) && (
            <svg
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                pointerEvents: 'none',
                zIndex: 9999998,
              }}
            >
              <line
                x1={ghostWireStart.x}
                y1={ghostWireStart.y}
                x2={ghostMousePos.x}
                y2={ghostMousePos.y}
                stroke={demoPhase === 3 ? "var(--accent, #00b4ff)" : "black"}
                strokeWidth="3"
                strokeDasharray="4 4"
              />
            </svg>
          )}
          <div
            className={`tour-ghost-cursor step-${step.id} phase-${demoPhase}`}
            style={{ left: ghostMousePos.x, top: ghostMousePos.y }}
            aria-hidden="true"
          >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="var(--accent, #00b4ff)"
            stroke="white"
            strokeWidth="1.2"
          >
            <path
              d="M5.636 5.636l12.728 4.243-5.657 1.414-1.414 5.657-4.243-12.728z"
              strokeLinejoin="round"
            />
          </svg>

          {/* Click ripple */}
          {((step.id === 'wiring' && (demoPhase === 2 || demoPhase === 4 || demoPhase === 6 || demoPhase === 8)) ||
            (step.id === 'autowiring' && (demoPhase === 2 || demoPhase === 5)) ||
            (step.id === 'drag-demo' && demoPhase === 1) ||
            (step.id === 'library' && (demoPhase === 1 || demoPhase === 3)) ||
            (step.id === 'plotter' && demoPhase === 2) ||
            (step.id === 'console' && demoPhase === 2)) && (
            <div className="tour-ghost-ripple" />
          )}

          {/* Dragging component preview */}
          {step.id === 'drag-demo' && demoPhase >= 2 && demoPhase <= 4 && (
            <div className="tour-ghost-comp-small">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
              >
                <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </div>
          )}

        </div>

        {/* Fake Context Menu for Autowiring */}
        {step.id === 'autowiring' && demoPhase >= 2 && demoPhase <= 4 && (
          <div
            className="canvas-menu"
            style={{
              position: 'fixed',
              left: ghostMousePos.x + 45 - (demoPhase === 3 ? 115 : (demoPhase >= 4 ? 255 : 0)),
              top: ghostMousePos.y + 20 - (demoPhase >= 3 ? 168 : 0),
              zIndex: 999999,
              background: 'rgba(15, 23, 42, 0.96)',
              border: '1px solid rgba(30, 45, 71, 0.8)',
              borderRadius: '10px',
              padding: '4px',
              color: 'white',
              minWidth: '135px',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '11.5px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              pointerEvents: 'none'
            }}
          >
            <div style={{ padding: '5px 8px 4px', fontSize: '9.5px', color: '#ef4444', background: '#ef444445', borderRadius: '6px', textAlign: 'center', marginBottom: '4px', fontWeight: 800 }}>DEMO-LED-TOUR</div>
            <div style={{ padding: '4px 8px', display: 'flex', gap: '6px' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg><span>Rename</span></div>
            <div style={{ padding: '4px 8px', display: 'flex', gap: '6px' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></svg><span>Color</span></div>
            <div style={{ padding: '4px 8px', display: 'flex', gap: '6px' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" /></svg><span>Pin Map</span></div>
            <div style={{ padding: '4px 8px', display: 'flex', gap: '6px' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg><span>AutoCode</span></div>
            
            <div style={{
              padding: '4px 8px', display: 'flex', gap: '6px',
              background: demoPhase >= 3 ? 'var(--item-hover-bg, rgba(255,255,255,0.1))' : 'transparent',
              borderRadius: '6px',
              position: 'relative'
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              <span>Wire to</span>
              <svg style={{ marginLeft: 'auto', opacity: 0.4 }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              
              {demoPhase >= 3 && (
                <div style={{
                  position: 'absolute', left: '100%', top: '-4px', marginLeft: '6px',
                  background: 'rgba(15, 23, 42, 0.96)', border: '1px solid rgba(30, 45, 71, 0.8)',
                  borderRadius: '10px', padding: '4px', minWidth: '140px',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                }}>
                  <div style={{
                    padding: '4px 8px', display: 'flex', gap: '6px',
                    background: demoPhase >= 4 ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    color: demoPhase >= 4 ? '#38bdf8' : 'inherit',
                    fontWeight: demoPhase >= 4 ? 700 : 500,
                    borderRadius: '6px'
                  }}>
                    uno
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </>
      )}

      {/* ── Spotlight ─────────────────────────────────────────────────── */}
      {spotlightRect && (
        <div
          className="tour-spotlight"
          data-tour-step-id={step.id}
          data-tour-target={step.target ?? ''}
          style={{
            top: spotlightRect.top - pad,
            left: spotlightRect.left - pad,
            width: spotlightRect.width + pad * 2,
            height: spotlightRect.height + pad * 2,
          }}
        />
      )}

      {/* ── Tooltip ───────────────────────────────────────────────────── */}
      <div
        ref={tooltipRef}
        className="tour-tooltip"
        data-tour-step-id={step.id}
        data-tour-target={step.target ?? ''}
        style={getTooltipStyle()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-content"
        tabIndex={-1}
      >
        {/* Segmented progress bar */}
        <div className="tour-progress-bar" aria-hidden="true">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={[
                'tour-progress-segment',
                i < currentStep ? 'completed' : '',
                i === currentStep ? 'active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          ))}
        </div>

        <h3 id="tour-title">{step.title}</h3>
        <p id="tour-content">{step.content}</p>

        {/* Show Me / Let Me Try toggle — only on interactive steps */}
        {step.action && (
          <div className="tour-mode-toggle" role="group" aria-label="Tour mode">
            <button
              className={`tour-mode-btn${mode === 'show-me' ? ' active' : ''}`}
              onClick={() => setMode('show-me')}
            >
              👁 Show Me
            </button>
            <button
              className={`tour-mode-btn${mode === 'let-me-try' ? ' active' : ''}`}
              onClick={() => setMode('let-me-try')}
            >
              🖐 Let Me Try
            </button>
          </div>
        )}

        <div className="tour-footer">
          <div
            className="tour-steps-indicator"
            aria-live="polite"
            aria-atomic="true"
          >
            {currentStep + 1} / {STEPS.length}
          </div>

          <div className="tour-btns">
            <button className="tour-btn skip" onClick={handleFinish}>
              Skip
            </button>

            {/* Back button — rendered only when there's a previous step */}
            {currentStep > 0 && (
              <button
                className="tour-btn back"
                onClick={handleBack}
                aria-label="Go to previous step"
              >
                Back
              </button>
            )}

            <button
              className="tour-btn next"
              onClick={handleNext}
              aria-label={
                currentStep === STEPS.length - 1
                  ? 'Finish tour'
                  : 'Go to next step'
              }
            >
              {currentStep === STEPS.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TourGuide;
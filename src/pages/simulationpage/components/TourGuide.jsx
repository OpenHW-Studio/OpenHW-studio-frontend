import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import './TourGuide.css';

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to OpenHW Studio! 🚀',
    content: 'Let\'s take a quick 1-minute tour to see how you can build and simulate Arduino projects right in your browser.',
    target: null,
    position: 'center'
  },
  {
    id: 'quick-add',
    target: 'main',
    title: 'Quick Add Portal',
    content: 'Double-click anywhere on the canvas to instantly find and add components. It\'s the fastest way to build your circuit.',
    position: 'bottom',
    action: 'quick-add'
  },
  {
    id: 'drag-demo',
    target: 'main',
    title: 'Component Movement',
    content: 'Simply drag any component to reposition it. Components snap to the grid for professional, clean layouts.',
    position: 'bottom',
    action: 'drag'
  },
  {
    id: 'wiring',
    target: 'main',
    title: 'Intelligent Wiring',
    content: 'Connect pins by clicking and dragging. The simulator automatically calculates the best path for your wires.',
    position: 'bottom',
    action: 'wire'
  },
  {
    id: 'projects',
    target: 'aside.border-r',
    title: 'Project Management',
    content: 'Access your cloud-synced projects, create backups, or manage your components from the sidebar.',
    position: 'right'
  },
  {
    id: 'ide',
    target: 'aside.border-l',
    title: 'Integrated IDE',
    content: 'A professional-grade editor for your firmware. Supports multi-file projects and real-time syntax checking.',
    position: 'left'
  },
  {
    id: 'blockly',
    target: 'aside.border-l',
    title: 'Visual Block Coding',
    content: 'Prefer visual logic? Switch to Blockly to build your firmware with drag-and-drop blocks.',
    position: 'left',
    action: 'switch-blockly'
  },
  {
    id: 'library',
    target: 'aside.border-l',
    title: 'Library Manager',
    content: 'Install thousands of community-built libraries for sensors, displays, and communication protocols.',
    position: 'left',
    action: 'switch-library'
  },
  {
    id: 'serial',
    target: 'aside.border-l',
    title: 'Serial Monitor',
    content: 'Interact with your simulated hardware in real-time. Send commands and view debug output instantly.',
    position: 'left',
    action: 'switch-serial'
  },
  {
    id: 'plotter',
    target: 'aside.border-l',
    title: 'Real-time Plotter',
    content: 'Visualize high-frequency sensor data with our built-in oscilloscope and telemetry plotter.',
    position: 'left',
    action: 'switch-plotter'
  },
  {
    id: 'console',
    target: '[data-simulation-console="true"]',
    title: 'System Console',
    content: 'Check for compilation logs, system warnings, and hardware connection status here.',
    position: 'top'
  },
  {
    id: 'finish',
    title: 'Ready to Create!',
    content: 'You\'re all set! Start building your first project or explore the examples library to see what\'s possible.',
    position: 'center'
  }
];

const TourGuide = ({ onFinish, onStepChange, onDemoAction }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [demoPhase, setDemoPhase] = useState(0);
  const [ghostMousePos, setGhostMousePos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const spotlightRef = useRef(null);

  useEffect(() => {
    if (onStepChange) {
      onStepChange(STEPS[currentStep].id);
    }
    // Reset demo phase when step changes
    setDemoPhase(0);
    // Small delay to ensure layout is ready
    const timer = setTimeout(() => {
      setIsVisible(true);
      updateSpotlight();
    }, 500);
    return () => clearTimeout(timer);
  }, [currentStep]);

  // Intelligent Coordinate Tracking
  useLayoutEffect(() => {
    if (!isVisible) return;
    const step = STEPS[currentStep];
    
    const updateGhostPosition = () => {
      let targetSelector = null;
      
      // Map phases to specific DOM targets using data-tour attributes
      if (step.id === 'quick-add') targetSelector = 'main';
      if (step.id === 'drag-demo') {
        if (demoPhase <= 1) targetSelector = '[data-tour-type="wokwi-arduino-uno"], [data-tour-type="openhw-arduino-uno"]';
        else targetSelector = '[id*="comp-master-demo-comp-tour"]';
      }
      if (step.id === 'wiring') {
        if (demoPhase <= 2) targetSelector = '[id*="pin-dot-demo-comp-tour-13"]';
        else targetSelector = '[id*="pin-dot-demo-comp-tour-GND"]';
      }
      if (step.action?.includes('switch-blockly')) targetSelector = '[data-tour-id="tab-block"]';
      if (step.action?.includes('switch-library')) targetSelector = '[data-tour-id="tab-code"]'; // Fallback to Code tab for now
      if (step.action?.includes('switch-serial')) targetSelector = '[data-tour-id="tab-serial"]';

      if (targetSelector) {
        const el = document.querySelector(targetSelector);
        if (el) {
          const rect = el.getBoundingClientRect();
          setGhostMousePos({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          });
        }
      }
    };

    const animFrame = requestAnimationFrame(updateGhostPosition);
    return () => cancelAnimationFrame(animFrame);
  }, [currentStep, demoPhase, isVisible]);

  // Handle Demo Actions based on Phase
  useEffect(() => {
    if (!isVisible || !onDemoAction) return;
    const step = STEPS[currentStep];

    // Interaction Triggers
    if (step.id === 'drag-demo') {
      if (demoPhase === 2) onDemoAction('add-component');
      if (demoPhase === 0) onDemoAction('remove-component');
    }

    if (step.id === 'quick-add') {
      if (demoPhase === 2) onDemoAction('show-quick-add');
      if (demoPhase === 5) onDemoAction('hide-quick-add');
    }

    if (step.id === 'wiring') {
      if (demoPhase === 4) onDemoAction('add-demo-wire');
      if (demoPhase === 0) {
        onDemoAction('remove-demo-wire');
        onDemoAction('remove-component');
      }
      if (demoPhase === 1) onDemoAction('add-component'); // Ensure board exists for wiring
    }

    if (step.action?.startsWith('switch-')) {
      if (demoPhase === 2) onDemoAction(step.action);
    }
  }, [demoPhase, currentStep, isVisible, onDemoAction]);

  // Comprehensive Demo Loop
  useEffect(() => {
    const interactionInterval = 1800; // Eased timing for realistic feel
    const interval = setInterval(() => {
      setDemoPhase(prev => (prev + 1) % 6);
    }, interactionInterval);

    return () => {
      clearInterval(interval);
      // Cleanup all demo state on step leave
      onDemoAction?.('remove-component');
      onDemoAction?.('hide-quick-add');
      onDemoAction?.('remove-demo-wire');
    };
  }, [currentStep, onDemoAction]);

  useEffect(() => {
    window.addEventListener('resize', updateSpotlight);
    return () => window.removeEventListener('resize', updateSpotlight);
  }, [currentStep]);

  const updateSpotlight = () => {
    const step = STEPS[currentStep];
    if (!step.target) {
      setSpotlightRect(null);
      return;
    }

    const el = document.querySelector(step.target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setSpotlightRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });
    } else {
      setSpotlightRect(null);
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleFinish = () => {
    setIsVisible(false);
    setTimeout(onFinish, 300);
  };

  const step = STEPS[currentStep];

  const getTooltipStyle = () => {
    if (!spotlightRect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }

    const margin = 20;
    const { top, left, width, height } = spotlightRect;

    switch (step.position) {
      case 'bottom':
        // Special case: if targeting 'main' (full canvas), position at bottom of viewport
        if (step.target === 'main') {
          return { bottom: 40, top: 'auto', left: '50%', transform: 'translateX(-50%)' };
        }
        return { top: top + height + margin, bottom: 'auto', left: Math.max(20, left + width / 2 - 160) };
      case 'top':
        return { top: top - 320 - margin, bottom: 'auto', left: Math.max(20, left + width / 2 - 160) };
      case 'left':
        return { top: top + height / 2 - 100, bottom: 'auto', left: left - 320 - margin, right: 'auto' };
      case 'right':
        return { top: top + height / 2 - 100, bottom: 'auto', left: left + width + margin, right: 'auto' };
      case 'center':
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', bottom: 'auto', right: 'auto' };
      default:
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', bottom: 'auto', right: 'auto' };
    }
  };

  if (!isVisible) return null;

  return (
    <div className="tour-overlay">
      {/* Ghost Cursor with Dynamic State */}
      <div 
        className={`tour-ghost-cursor step-${step.id} phase-${demoPhase}`}
        style={{
          position: 'fixed',
          left: ghostMousePos.x,
          top: ghostMousePos.y,
          transition: 'all 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
          zIndex: 9999999,
          pointerEvents: 'none'
        }}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="var(--accent, #00b4ff)" stroke="white" strokeWidth="1.2" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }}>
          <path d="M5.636 5.636l12.728 4.243-5.657 1.414-1.414 5.657-4.243-12.728z" strokeLinejoin="round" />
        </svg>

        {/* Click/Ripple Effect */}
        {(demoPhase === 2 || demoPhase === 4) && <div className="tour-ghost-ripple" />}

        {/* Dragging Preview */}
        {step.id === 'drag-demo' && demoPhase >= 2 && demoPhase <= 4 && (
          <div className="tour-ghost-comp-small">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
              <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </div>
        )}

        {/* Wiring Line Preview */}
        {step.id === 'wiring' && demoPhase >= 3 && demoPhase <= 4 && (
          <div className="tour-ghost-wire-preview" />
        )}
      </div>

      {spotlightRect && (
        <div
          className="tour-spotlight"
          style={{
            top: spotlightRect.top - 4,
            left: spotlightRect.left - 4,
            width: spotlightRect.width + 8,
            height: spotlightRect.height + 8
          }}
        />
      )}

      <div
        className="tour-tooltip"
        style={{
          ...getTooltipStyle(),
          display: 'flex',
          opacity: 1,
          visibility: 'visible',
          background: '#1a1a1a',
          border: '2px solid #00b4ff',
          color: 'white',
          zIndex: 10000000
        }}
      >
        <h3 style={{ color: '#00b4ff', margin: '0 0 10px 0' }}>{step.title}</h3>
        <p style={{ color: '#ccc', margin: '0 0 20px 0' }}>{step.content}</p>
        
        <div className="tour-footer">
          <div className="tour-steps-indicator">
            Step {currentStep + 1} of {STEPS.length}
          </div>
          <div className="tour-btns">
            <button className="tour-btn skip" onClick={handleFinish} style={{ background: 'transparent', color: '#888', border: 'none', cursor: 'pointer' }}>Skip</button>
            <button className="tour-btn next" onClick={handleNext} style={{ background: '#00b4ff', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer' }}>
              {currentStep === STEPS.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TourGuide;

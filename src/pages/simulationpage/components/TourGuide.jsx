import React, { useState, useEffect, useRef } from 'react';
import './TourGuide.css';

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to OpenHW Studio!',
    content: 'The most powerful way to design, code, and simulate hardware in your browser. Let\'s take a quick tour of the main features.',
    position: 'center'
  },
  {
    id: 'palette',
    target: 'aside.border-r',
    title: 'Component Palette',
    content: 'Browse through hundreds of sensors, displays, and controllers. (Automatically expands for you!)',
    position: 'right'
  },
  {
    id: 'drag-demo',
    target: 'main',
    title: 'Try It Out!',
    content: 'Simply drag any component onto the canvas to add it to your project. Watch how it\'s done below!',
    position: 'center'
  },
  {
    id: 'canvas',
    target: 'main',
    title: 'Interactive Canvas',
    content: 'This is your workspace. Place components, connect wires, and interact with hardware in real-time.',
    position: 'center'
  },
  {
    id: 'toolbox',
    target: 'header',
    title: 'Simulation Controls',
    content: 'Use the Run and Stop buttons to start your simulation. You can also save your projects or access the settings menu.',
    position: 'bottom'
  },
  {
    id: 'editor',
    target: 'aside.border-l',
    title: 'Integrated IDE',
    content: 'Write firmware in C++ or Python, or use the Blockly visual editor. Monitor serial output directly from the "Serial" tab.',
    position: 'left'
  },
  {
    id: 'console',
    target: '[data-simulation-console="true"]',
    title: 'System Console',
    content: 'Check for compilation errors, system logs, and hardware status messages here.',
    position: 'top'
  }
];

const TourGuide = ({ onFinish, onStepChange, onDemoAction }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [demoPhase, setDemoPhase] = useState(0);
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

  // Demo Loop for drag-demo
  useEffect(() => {
    if (STEPS[currentStep].id !== 'drag-demo') return;

    const interval = setInterval(() => {
      setDemoPhase(prev => {
        const next = (prev + 1) % 4;
        if (next === 2) onDemoAction?.('add-component');
        if (next === 0) onDemoAction?.('remove-component');
        return next;
      });
    }, 1500);

    return () => {
      clearInterval(interval);
      onDemoAction?.('remove-component');
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
      // If target not found, default to center (like welcome)
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

  // Tooltip positioning logic
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
        return { top: top + height + margin, left: left + width / 2 - 160 };
      case 'top':
        return { top: top - 320 - margin, left: left + width / 2 - 160 };
      case 'left':
        return { top: top + height / 2 - 100, left: left - 320 - margin };
      case 'right':
        return { top: top + height / 2 - 100, left: left + width + margin };
      default:
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
  };

  if (!isVisible) return null;

  return (
    <div className="tour-overlay">
      {/* Ghost Cursor */}
      <div className={`tour-ghost-cursor step-${STEPS[currentStep].id} phase-${demoPhase}`}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="#2563eb" stroke="white" strokeWidth="1.5" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }}>
          <path d="M5.636 5.636l12.728 4.243-5.657 1.414-1.414 5.657-4.243-12.728z" strokeLinejoin="round" />
        </svg>
        {STEPS[currentStep].id === 'drag-demo' && demoPhase === 1 && (
          <div className="tour-ghost-comp-small">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
              <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </div>
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
        className={`tour-tooltip-container ${step.position}`}
        style={getTooltipStyle()}
      >
        <div className="tour-tooltip">
          <div className="tour-title">{step.title}</div>
          <div className="tour-content">{step.content}</div>

          <div className="tour-footer">
            <div className="tour-progress">
              STEP {currentStep + 1} / {STEPS.length}
            </div>
            <div className="tour-btns">
              <button className="tour-btn tour-btn-skip" onClick={handleFinish}>
                Skip
              </button>
              {currentStep > 0 && (
                <button className="tour-btn tour-btn-back" onClick={handleBack}>
                  Back
                </button>
              )}
              <button
                className={`tour-btn ${currentStep === STEPS.length - 1 ? 'tour-btn-finish' : 'tour-btn-next'}`}
                onClick={handleNext}
              >
                {currentStep === STEPS.length - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
          <div className="tour-arrow" />
        </div>
      </div>
    </div>
  );
};

export default TourGuide;

import React, { useState, useEffect } from "react";
import { 
  Cpu, 
  Sparkles, 
  Terminal, 
  Layers, 
  ShieldCheck, 
  Zap, 
  Activity, 
  Compass, 
  CheckCircle2, 
  Play
} from "lucide-react";
import ThemeToggleSlider from "../../components/ThemeToggleSlider.jsx";

const FEATURE_CARDS = [
  {
    id: "simulation",
    icon: Cpu,
    tag: "HARDWARE ENGINE",
    title: "Full-Cycle MCU Simulation",
    desc: "Run real C/C++ firmware in browser with cycle-accurate RISC-V, AVR, and RP2040 emulators.",
    metric: "16+ Boards Supported",
    color: "#2563eb"
  },
  {
    id: "grading",
    icon: Layers,
    tag: "SMART LABS",
    title: "Guided Projects & Grading",
    desc: "38+ interactive engineering projects with real-time autowiring checks and test benches.",
    metric: "Instant Auto-Grading",
    color: "#059669"
  },
  {
    id: "classroom",
    icon: Compass,
    tag: "ACADEMIC SUITE",
    title: "Classroom Collaboration",
    desc: "Teachers distribute assignments, monitor student circuit states, and grade submissions live.",
    metric: "Real-time Live Sync",
    color: "#7c3aed"
  }
];

export default function AuthLeftShowcase() {
  const [activeTab, setActiveTab] = useState(0);
  const [pulseTick, setPulseTick] = useState(0);

  // Gentle periodic indicator tick for interactive feel
  useEffect(() => {
    const timer = setInterval(() => {
      setPulseTick((t) => (t + 1) % 4);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const activeFeature = FEATURE_CARDS[activeTab];

  return (
    <section className="auth-hardware-showcase">
      <div className="auth-hero-showcase-card">
        {/* Brand Header */}
        <div className="auth-hero-header">
          <div className="auth-hero-brand">
            <div className="auth-hero-logo-wrap">
              <img
                src="/logo-Photoroom.png"
                alt="OpenHW Studio"
                className="auth-hero-logo"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
            <div>
              <div className="auth-hero-title-row">
                <h3 className="auth-hero-title">OpenHW Studio</h3>
                <span className="auth-hero-version-pill">v1.4.0</span>
              </div>
              <p className="auth-hero-subtitle">Open-Source Hardware Simulation & Virtual Lab</p>
            </div>
          </div>

          <div className="auth-hero-toggle-wrap">
            <ThemeToggleSlider size="sm" />
          </div>
        </div>

        {/* Live Interactive Simulator Visualizer Canvas */}
        <div className="auth-hero-canvas">
          <div className="auth-hero-canvas-glow"></div>
          
          {/* Circuit Visual Elements */}
          <div className="auth-chip-visual">
            <div className="auth-chip-board">
              <div className="auth-chip-die">
                <Cpu className="w-8 h-8 text-blue-500 animate-pulse" />
                <span className="auth-chip-code">RV64-MCU</span>
              </div>

              {/* Pins around chip */}
              <div className="auth-chip-pins auth-chip-pins--top">
                {[...Array(6)].map((_, i) => (
                  <span key={i} className={`auth-pin-dot ${pulseTick === i % 4 ? "is-active" : ""}`} />
                ))}
              </div>
              <div className="auth-chip-pins auth-chip-pins--bottom">
                {[...Array(6)].map((_, i) => (
                  <span key={i} className={`auth-pin-dot ${pulseTick === (i + 2) % 4 ? "is-active" : ""}`} />
                ))}
              </div>
            </div>

            {/* Circuit Telemetry Floating Badges */}
            <div className="auth-telemetry-badge auth-telemetry-badge--left">
              <span className="auth-badge-dot"></span>
              <span>Clock: 120 MHz</span>
            </div>

            <div className="auth-telemetry-badge auth-telemetry-badge--right">
              <Zap className="w-3 h-3 text-amber-500" />
              <span>Logic Voltage: 3.3V</span>
            </div>
          </div>

          {/* Interactive Feature Tabs */}
          <div className="auth-feature-tabs">
            {FEATURE_CARDS.map((feat, idx) => (
              <button
                key={feat.id}
                type="button"
                onClick={() => setActiveTab(idx)}
                className={`auth-feature-tab ${activeTab === idx ? "is-active" : ""}`}
              >
                <feat.icon className="w-3.5 h-3.5" />
                <span>{feat.tag}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Active Feature Description Box */}
        <div className="auth-feature-detail">
          <div className="auth-feature-detail-header">
            <h4>{activeFeature.title}</h4>
            <span className="auth-metric-pill">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {activeFeature.metric}
            </span>
          </div>
          <p className="auth-feature-detail-desc">{activeFeature.desc}</p>
        </div>

        {/* Quick Spec Highlights Grid */}
        <div className="auth-specs-grid">
          <div className="auth-spec-item">
            <span className="auth-spec-val">Cycle-Accurate</span>
            <span className="auth-spec-lbl">Emulation Core</span>
          </div>
          <div className="auth-spec-item">
            <span className="auth-spec-val">WebAssembly</span>
            <span className="auth-spec-lbl">Zero-Install Run</span>
          </div>
          <div className="auth-spec-item">
            <span className="auth-spec-val">100% Free</span>
            <span className="auth-spec-lbl">FOSSEE Initiative</span>
          </div>
        </div>

        {/* Studio Status Footer */}
        <div className="auth-hero-footer">
          <span className="auth-footer-status">
            <span className="auth-live-dot"></span>
            Simulation Cloud Engine Ready
          </span>
          <span className="auth-footer-note">IIT Bombay Project</span>
        </div>
      </div>
    </section>
  );
}

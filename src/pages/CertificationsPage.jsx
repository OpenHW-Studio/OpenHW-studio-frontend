import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { getAdventureReturnUrl, getRoleDashboardPath } from '../utils/navigationUtils';
import {
  Award,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  Wifi,
  Layers,
  Terminal,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Share2,
  Calendar,
  Lock,
  Search,
  Sparkles,
  BookOpen,
  Check,
  Clock,
  ChevronDown,
  ChevronUp,
  Copy,
  Hash,
  Activity,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGamification } from '../context/GamificationContext';
import {
  CERTIFICATION_TRACKS,
  ARDUINO_CERTIFICATION_DOMAINS,
  getArduinoCertificationProgress,
  getEsp32CertificationProgress,
  generateCertificateId,
  buildLinkedInCertUrl
} from '../services/certification/certificateService';
import CertificateModal from '../components/certification/CertificateModal';
import ThemeToggleSlider from '../components/ThemeToggleSlider';

const ESP32_DOMAINS = [
  {
    domain: "Dual-Core Hardware Timers & PWM",
    skills: ["LEDC High-Speed PWM Channels", "ADC2 Internal Attenuation Calibration", "Precision Frequency Generation"],
    slugs: ["esp32-blink", "esp32-analog", "esp32-pwm"]
  },
  {
    domain: "Wireless IEEE 802.11 & Embedded Web Servers",
    skills: ["WiFi AP & Station Scanning Stacks", "Non-blocking Web Server Handlers", "REST API Client & JSON Deserialization"],
    slugs: ["esp32-wifi-scan", "esp32-web-server", "esp32-http-client"]
  },
  {
    domain: "Real-Time Telemetry & BLE Advertising",
    skills: ["MQTT Broker Telemetry Pipelines", "BLE GATT Services & Characteristics", "RTC Timer Ultra-Low Power Deep Sleep"],
    slugs: ["esp32-mqtt", "esp32-ble", "esp32-deep-sleep"]
  },
  {
    domain: "Edge Graphics & Cloud Streaming",
    skills: ["SSD1306 Network Status Buffer", "Cloud Sensor Telemetry Integration", "Camera Frame Buffer Pipeline"],
    slugs: ["esp32-oled-wifi", "esp32-sensor-cloud", "esp32-cam-stream"]
  }
];

const PICO_DOMAINS = [
  {
    domain: "RP2040 Dual-Core Multiprocessing & FIFO",
    skills: ["Core 0 / Core 1 Task Division", "Inter-Core Hardware FIFO Queues", "Multicore Spinlocks & Mutexes"],
    slugs: ["pico-blink", "pico-multicore", "pico-fifo"]
  },
  {
    domain: "Programmable I/O (PIO) Custom Protocols",
    skills: ["PIO Assembly State Machine Engine", "Custom 1-Wire / WS2812 PIO Driver", "High-Speed Clock Dividers"],
    slugs: ["pico-pio-led", "pico-pio-uart", "pico-pio-stepper"]
  },
  {
    domain: "Direct Memory Access (DMA) High-Throughput",
    skills: ["Ring Buffer Audio Synthesis", "Zero-CPU ADC Streaming", "Channel Chaining & Pacing"],
    slugs: ["pico-dma-adc", "pico-dma-pwm", "pico-dma-audio"]
  },
  {
    domain: "MicroPython & C/C++ Embedded SDK",
    skills: ["Hardware Timer Alarms", "Rotary Encoder Debounce", "I2C OLED Graphics & Micro-Sensors"],
    slugs: ["pico-timer-alarm", "pico-rotary", "pico-oled", "pico-temp-sensor", "pico-mpu6050"]
  }
];

export default function CertificationsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { completedProjects = [], earnedBadges = [] } = useGamification();

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'earned' | 'in-progress' | 'roadmap'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCertForModal, setSelectedCertForModal] = useState(null);
  const [expandedSyllabus, setExpandedSyllabus] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [verifySearchId, setVerifySearchId] = useState('');

  // Watch data-theme attribute
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'dark'
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    return () => observer.disconnect();
  }, []);

  const arduinoProgress = useMemo(
    () => getArduinoCertificationProgress(completedProjects),
    [completedProjects]
  );
  const esp32Progress = useMemo(
    () => getEsp32CertificationProgress(completedProjects),
    [completedProjects]
  );

  const arduinoCertId = useMemo(
    () => generateCertificateId(user?._id || user?.id, user?.email, 'ARD'),
    [user]
  );
  const esp32CertId = useMemo(
    () => generateCertificateId(user?._id || user?.id, user?.email, 'ESP'),
    [user]
  );

  // Compute status for all tracks
  const tracksWithState = useMemo(() => {
    return CERTIFICATION_TRACKS.map(track => {
      let progress = { total: track.totalProjects, completedCount: 0, percentage: 0, isComplete: false };
      let certId = null;
      let domains = [];

      if (track.trackKey === 'arduino') {
        progress = arduinoProgress;
        certId = arduinoCertId;
        domains = ARDUINO_CERTIFICATION_DOMAINS;
      } else if (track.trackKey === 'esp32') {
        progress = esp32Progress;
        certId = esp32CertId;
        domains = ESP32_DOMAINS;
      } else if (track.trackKey === 'pico') {
        domains = PICO_DOMAINS;
      }

      const isEarned = progress.isComplete;
      const isInProgress = !isEarned && progress.completedCount > 0;
      const isRoadmap = track.status === 'roadmap';

      return {
        ...track,
        progress,
        certId,
        domains,
        isEarned,
        isInProgress,
        isRoadmap
      };
    });
  }, [arduinoProgress, esp32Progress, arduinoCertId, esp32CertId]);

  const earnedCount = tracksWithState.filter(t => t.isEarned).length;
  const inProgressCount = tracksWithState.filter(t => t.isInProgress).length;

  const filteredTracks = tracksWithState.filter(track => {
    if (activeTab === 'earned' && !track.isEarned) return false;
    if (activeTab === 'in-progress' && !track.isInProgress) return false;
    if (activeTab === 'roadmap' && !track.isRoadmap) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = track.title.toLowerCase().includes(q);
      const matchSub = track.subtitle.toLowerCase().includes(q);
      const matchComp = track.competencies.some(c => c.toLowerCase().includes(q));
      const matchPrefix = track.codePrefix.toLowerCase().includes(q);
      return matchTitle || matchSub || matchComp || matchPrefix;
    }
    return true;
  });

  const toggleSyllabus = (trackId) => {
    setExpandedSyllabus(prev => ({
      ...prev,
      [trackId]: !prev[trackId]
    }));
  };

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleLookupSubmit = (e) => {
    e.preventDefault();
    if (verifySearchId.trim()) {
      navigate(`/verify/${encodeURIComponent(verifySearchId.trim().toUpperCase())}`);
    }
  };

  const getTrackIcon = (iconName) => {
    switch (iconName) {
      case 'Cpu': return <Cpu size={20} />;
      case 'Wifi': return <Wifi size={20} />;
      case 'Layers': return <Layers size={20} />;
      case 'Terminal': return <Terminal size={20} />;
      default: return <Award size={20} />;
    }
  };

  return (
    <div className="cert-page-wrapper">
      <style>{`
        :root, [data-theme="light"] {
          --c-bg: #f8fafc;
          --c-bg-subtle: #f1f5f9;
          --c-surface: #ffffff;
          --c-surface-hover: #fbfcfe;
          --c-border: #e2e8f0;
          --c-border-strong: #cbd5e1;
          --c-text-main: #0f172a;
          --c-text-sub: #334155;
          --c-text-muted: #64748b;
          --c-grid: rgba(15, 23, 42, 0.04);
          --c-accent-emerald: #059669;
          --c-accent-emerald-bg: #ecfdf5;
          --c-accent-emerald-border: #a7f3d0;
          --c-accent-blue: #2563eb;
          --c-accent-blue-bg: #eff6ff;
          --c-accent-copper: #b45309;
          --c-accent-copper-bg: #fffbeb;
          --c-accent-copper-border: #fde68a;
          --c-card-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 10px 24px -8px rgba(15, 23, 42, 0.05);
          --c-chip-bg: #f1f5f9;
          --c-chip-text: #1e293b;
          --c-code-bg: #f1f5f9;
          --c-header-border: rgba(15, 23, 42, 0.08);
        }

        [data-theme="dark"] {
          --c-bg: #070a13;
          --c-bg-subtle: #0d1322;
          --c-surface: #0f172a;
          --c-surface-hover: #141e34;
          --c-border: #1e293b;
          --c-border-strong: #334155;
          --c-text-main: #f8fafc;
          --c-text-sub: #cbd5e1;
          --c-text-muted: #94a3b8;
          --c-grid: rgba(255, 255, 255, 0.035);
          --c-accent-emerald: #10b981;
          --c-accent-emerald-bg: rgba(16, 185, 129, 0.12);
          --c-accent-emerald-border: rgba(16, 185, 129, 0.35);
          --c-accent-blue: #38bdf8;
          --c-accent-blue-bg: rgba(56, 189, 248, 0.12);
          --c-accent-copper: #f59e0b;
          --c-accent-copper-bg: rgba(245, 158, 11, 0.12);
          --c-accent-copper-border: rgba(245, 158, 11, 0.35);
          --c-card-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
          --c-chip-bg: rgba(255, 255, 255, 0.05);
          --c-chip-text: #e2e8f0;
          --c-code-bg: #0b111e;
          --c-header-border: rgba(255, 255, 255, 0.08);
        }

        .cert-page-wrapper {
          min-height: 100vh;
          background-color: var(--c-bg);
          background-image:
            linear-gradient(var(--c-grid) 1px, transparent 1px),
            linear-gradient(90deg, var(--c-grid) 1px, transparent 1px);
          background-size: 32px 32px;
          color: var(--c-text-main);
          font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-sizing: border-box;
          transition: background-color 0.25s ease, color 0.25s ease;
          padding: 0 0 80px 0;
        }

        .cert-container {
          max-width: 1140px;
          margin: 0 auto;
          padding: 0 20px;
        }

        /* Top Navigation Bar */
        .cert-nav-header {
          border-bottom: 1px solid var(--c-header-border);
          background-color: var(--c-surface);
          backdrop-filter: blur(12px);
          position: sticky;
          top: 0;
          z-index: 40;
          padding: 14px 0;
          margin-bottom: 32px;
        }

        .cert-nav-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }

        .cert-btn-back {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          border: 1px solid var(--c-border);
          color: var(--c-text-main);
          padding: 7px 14px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
        }
        .cert-btn-back:hover {
          background: var(--c-bg-subtle);
          border-color: var(--c-border-strong);
        }

        .cert-btn-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: var(--c-text-muted);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.15s ease;
        }
        .cert-btn-pill:hover {
          color: var(--c-text-main);
        }

        /* Hero Header */
        .cert-hero {
          background: var(--c-surface);
          border: 1px solid var(--c-border);
          border-radius: 20px;
          padding: 32px;
          box-shadow: var(--c-card-shadow);
          margin-bottom: 32px;
          position: relative;
        }

        .cert-badge-pre {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--c-accent-emerald);
          background: var(--c-accent-emerald-bg);
          border: 1px solid var(--c-accent-emerald-border);
          padding: 4px 10px;
          border-radius: 6px;
          margin-bottom: 12px;
        }

        .cert-hero-title {
          font-size: clamp(24px, 3.5vw, 34px);
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--c-text-main);
          margin: 0 0 10px 0;
          line-height: 1.25;
        }

        .cert-hero-desc {
          font-size: clamp(14px, 1.6vw, 15px);
          color: var(--c-text-sub);
          line-height: 1.6;
          max-width: 820px;
          margin: 0 0 24px 0;
        }

        /* Metric Grid */
        .cert-metric-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 12px;
          border-top: 1px solid var(--c-border);
          padding-top: 20px;
        }

        .cert-metric-card {
          background: var(--c-bg-subtle);
          border: 1px solid var(--c-border);
          border-radius: 12px;
          padding: 14px 16px;
        }

        .cert-metric-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--c-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }

        .cert-metric-val {
          font-size: 22px;
          font-weight: 800;
          color: var(--c-text-main);
          display: flex;
          align-items: baseline;
          gap: 4px;
        }

        /* Filter Toolbar */
        .cert-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
          margin-bottom: 24px;
        }

        .cert-tabs-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .cert-tab-btn {
          background: var(--c-surface);
          color: var(--c-text-muted);
          border: 1px solid var(--c-border);
          border-radius: 10px;
          padding: 7px 14px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.15s ease;
        }
        .cert-tab-btn:hover {
          border-color: var(--c-border-strong);
          color: var(--c-text-main);
        }
        .cert-tab-btn.active {
          background: var(--c-text-main);
          color: var(--c-bg);
          border-color: var(--c-text-main);
        }

        .cert-tab-counter {
          font-size: 10px;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 6px;
          background: var(--c-bg-subtle);
          color: var(--c-text-sub);
        }
        .cert-tab-btn.active .cert-tab-counter {
          background: rgba(255,255,255,0.2);
          color: inherit;
        }

        .cert-search-box {
          position: relative;
          min-width: 240px;
        }
        .cert-search-input {
          width: 100%;
          box-sizing: border-box;
          background: var(--c-surface);
          border: 1px solid var(--c-border);
          border-radius: 10px;
          padding: 7px 12px 7px 32px;
          font-size: 12px;
          color: var(--c-text-main);
          outline: none;
          transition: border-color 0.15s ease;
        }
        .cert-search-input:focus {
          border-color: var(--c-text-muted);
        }

        /* Card Specifications */
        .cert-card {
          background: var(--c-surface);
          border: 1px solid var(--c-border);
          border-radius: 16px;
          padding: 24px 28px;
          box-shadow: var(--c-card-shadow);
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .cert-card.earned {
          border-left: 4px solid var(--c-accent-emerald);
        }
        .cert-card.in-progress {
          border-left: 4px solid var(--c-accent-blue);
        }
        .cert-card.roadmap {
          border-left: 4px solid var(--c-text-muted);
          background: var(--c-bg-subtle);
        }

        .cert-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }

        .cert-header-left {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }

        .cert-icon-frame {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--c-bg-subtle);
          border: 1px solid var(--c-border);
          color: var(--c-text-main);
          flex-shrink: 0;
        }
        .cert-card.earned .cert-icon-frame {
          background: var(--c-accent-emerald-bg);
          border-color: var(--c-accent-emerald-border);
          color: var(--c-accent-emerald);
        }

        .cert-chip-arch {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--c-text-muted);
          margin-bottom: 3px;
        }

        .cert-title-h2 {
          font-size: clamp(17px, 2vw, 20px);
          font-weight: 800;
          color: var(--c-text-main);
          margin: 0 0 3px 0;
          line-height: 1.3;
        }

        .cert-subtitle {
          font-size: 12px;
          font-weight: 600;
          color: var(--c-text-sub);
          margin-bottom: 6px;
        }

        /* Status Pills */
        .cert-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.04em;
        }
        .cert-status-pill.earned {
          background: var(--c-accent-emerald-bg);
          border: 1px solid var(--c-accent-emerald-border);
          color: var(--c-accent-emerald);
        }
        .cert-status-pill.in-progress {
          background: var(--c-accent-blue-bg);
          border: 1px solid rgba(56, 189, 248, 0.3);
          color: var(--c-accent-blue);
        }
        .cert-status-pill.roadmap {
          background: var(--c-bg-subtle);
          border: 1px solid var(--c-border);
          color: var(--c-text-muted);
        }

        /* Progress Bar */
        .cert-progress-wrapper {
          background: var(--c-bg-subtle);
          border: 1px solid var(--c-border);
          border-radius: 10px;
          padding: 12px 14px;
        }

        .cert-progress-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .cert-progress-track {
          height: 6px;
          background: var(--c-border);
          border-radius: 6px;
          overflow: hidden;
        }

        .cert-progress-fill {
          height: 100%;
          border-radius: 6px;
          transition: width 0.3s ease;
        }
        .cert-progress-fill.green {
          background: var(--c-accent-emerald);
        }
        .cert-progress-fill.blue {
          background: var(--c-accent-blue);
        }

        /* Competency Chips */
        .cert-comp-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .cert-comp-chip {
          background: var(--c-chip-bg);
          border: 1px solid var(--c-border);
          color: var(--c-chip-text);
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 6px;
        }

        /* Action Buttons */
        .cert-action-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          padding-top: 14px;
          border-top: 1px solid var(--c-border);
        }

        .cert-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: var(--c-text-main);
          color: var(--c-bg);
          border: none;
          border-radius: 9px;
          padding: 8px 16px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: opacity 0.15s ease;
          text-decoration: none;
        }
        .cert-btn-primary:hover {
          opacity: 0.9;
        }

        .cert-btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--c-bg-subtle);
          color: var(--c-text-main);
          border: 1px solid var(--c-border);
          border-radius: 9px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
        }
        .cert-btn-secondary:hover {
          background: var(--c-surface);
          border-color: var(--c-border-strong);
        }

        /* Expandable Syllabus Drawer */
        .cert-syllabus-box {
          margin-top: 6px;
          background: var(--c-bg-subtle);
          border: 1px solid var(--c-border);
          border-radius: 10px;
          padding: 16px;
        }

        .cert-syllabus-domain {
          margin-bottom: 12px;
        }
        .cert-syllabus-domain:last-child {
          margin-bottom: 0;
        }

        .cert-domain-title {
          font-size: 12px;
          font-weight: 800;
          color: var(--c-text-main);
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .cert-labs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 6px;
        }

        .cert-lab-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          background: var(--c-surface);
          border: 1px solid var(--c-border);
          border-radius: 6px;
          padding: 5px 8px;
          color: var(--c-text-sub);
        }
        .cert-lab-item.done {
          border-color: var(--c-accent-emerald-border);
          color: var(--c-text-main);
        }

        /* Terminal Ledger Box */
        .cert-terminal-box {
          background: var(--c-surface);
          border: 1px solid var(--c-border);
          border-radius: 16px;
          padding: 24px;
          box-shadow: var(--c-card-shadow);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
      `}</style>

      {/* ── TOP STICKY NAVIGATION BAR ────────────────────────────────────────── */}
      <nav className="cert-nav-header">
        <div className="cert-container cert-nav-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => navigate(getAdventureReturnUrl({ location, searchParams }))}
              className="cert-btn-back"
              title="Return to Adventure World Map"
            >
              <ArrowLeft size={14} />
              Adventure Map
            </button>
            <span style={{ fontSize: 13, color: 'var(--c-text-muted)', fontWeight: 600 }}>/</span>
            <span style={{ fontSize: 13, color: 'var(--c-text-main)', fontWeight: 700 }}>
              Credentials & Certifications
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={() => navigate(getRoleDashboardPath(user))}
              className="cert-btn-pill"
            >
              <BookOpen size={14} />
              Dashboard
            </button>

            {/* Theme Toggle (Light / Dark switch) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderLeft: '1px solid var(--c-border)', paddingLeft: 12 }}>
              <ThemeToggleSlider size="sm" />
            </div>

            {/* User Indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 10px',
              borderRadius: 20,
              background: 'var(--c-bg-subtle)',
              border: '1px solid var(--c-border)',
              fontSize: 12,
              fontWeight: 700
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--c-accent-emerald)' }} />
              <span>{user?.name ? user.name.split(' ')[0] : 'Learner'}</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="cert-container">

        {/* ── HERO SPECIFICATION HEADER ──────────────────────────────────────── */}
        <section className="cert-hero">
          <div className="cert-badge-pre">
            <ShieldCheck size={13} />
            Academic Accreditation & Lab Micro-Credentials
          </div>

          <h1 className="cert-hero-title">
            Hardware Engineering Certification Standards
          </h1>

          <p className="cert-hero-desc">
            Formal technical certifications validating hands-on laboratory competencies in microcontroller
            firmware, hardware bus protocols (I2C, SPI, UART), actuator control loops, and edge telemetry.
            Every conferred credential includes deterministic ledger verification and 1-click LinkedIn integration.
          </p>

          {/* Metric Stats Strip */}
          <div className="cert-metric-grid">
            <div className="cert-metric-card">
              <div className="cert-metric-label">Conferred Credentials</div>
              <div className="cert-metric-val">
                <span style={{ color: earnedCount > 0 ? 'var(--c-accent-emerald)' : 'inherit' }}>{earnedCount}</span>
                <span style={{ fontSize: 13, color: 'var(--c-text-muted)', fontWeight: 600 }}>/ {CERTIFICATION_TRACKS.length} Tracks</span>
              </div>
            </div>

            <div className="cert-metric-card">
              <div className="cert-metric-label">Arduino Lab Progress</div>
              <div className="cert-metric-val">
                <span style={{ color: 'var(--c-accent-blue)' }}>{arduinoProgress.completedCount}</span>
                <span style={{ fontSize: 13, color: 'var(--c-text-muted)', fontWeight: 600 }}>/ 22 Islands ({arduinoProgress.percentage}%)</span>
              </div>
            </div>

            <div className="cert-metric-card">
              <div className="cert-metric-label">Mastered Badges</div>
              <div className="cert-metric-val">
                <span style={{ color: 'var(--c-accent-copper)' }}>{earnedBadges.length}</span>
                <span style={{ fontSize: 13, color: 'var(--c-text-muted)', fontWeight: 600 }}>Earned</span>
              </div>
            </div>

            <div className="cert-metric-card">
              <div className="cert-metric-label">Issuing Authority</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text-main)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={16} color="var(--c-accent-emerald)" />
                FOSSEE & OpenHW
              </div>
            </div>
          </div>
        </section>

        {/* ── TOOLBAR: TABS & FILTER ─────────────────────────────────────────── */}
        <section className="cert-toolbar">
          <div className="cert-tabs-row">
            {[
              { id: 'all', label: 'All Standards', count: CERTIFICATION_TRACKS.length },
              { id: 'earned', label: 'Conferred', count: earnedCount },
              { id: 'in-progress', label: 'In Progress', count: inProgressCount },
              { id: 'roadmap', label: 'Roadmap Specs', count: 2 },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`cert-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              >
                <span>{tab.label}</span>
                <span className="cert-tab-counter">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="cert-search-box">
            <Search
              size={14}
              color="var(--c-text-muted)"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder="Search by protocol, chip, or skill..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="cert-search-input"
            />
          </div>
        </section>

        {/* ── CERTIFICATION CARDS ────────────────────────────────────────────── */}
        <section>
          {filteredTracks.map(track => {
            const isEarned = track.isEarned;
            const isInProgress = track.isInProgress;
            const isRoadmap = track.isRoadmap;
            const isExpanded = Boolean(expandedSyllabus[track.id]);

            return (
              <article
                key={track.id}
                className={`cert-card ${isEarned ? 'earned' : isInProgress ? 'in-progress' : 'roadmap'}`}
              >
                {/* Header */}
                <div className="cert-card-header">
                  <div className="cert-header-left">
                    <div className="cert-icon-frame">
                      {getTrackIcon(track.iconName)}
                    </div>
                    <div>
                      <div className="cert-chip-arch">
                        {track.badgeTitle} • {track.credentialType}
                      </div>
                      <h2 className="cert-title-h2">
                        {track.title}
                      </h2>
                      <div className="cert-subtitle">
                        {track.subtitle}
                      </div>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div>
                    {isEarned ? (
                      <span className="cert-status-pill earned">
                        <CheckCircle2 size={13} />
                        CONFERRED & ACTIVE
                      </span>
                    ) : isInProgress ? (
                      <span className="cert-status-pill in-progress">
                        <Clock size={13} />
                        IN PROGRESS • {track.progress.completedCount}/{track.progress.total} ({track.progress.percentage}%)
                      </span>
                    ) : (
                      <span className="cert-status-pill roadmap">
                        <FileText size={13} />
                        CURRICULUM ROADMAP
                      </span>
                    )}
                  </div>
                </div>

                {/* Scope Description */}
                <p style={{ fontSize: 13, color: 'var(--c-text-sub)', margin: 0, lineHeight: 1.55 }}>
                  {track.description}
                </p>

                {/* Progress Bar (Active Tracks) */}
                {!isRoadmap && (
                  <div className="cert-progress-wrapper">
                    <div className="cert-progress-meta">
                      <span style={{ color: 'var(--c-text-sub)' }}>
                        Laboratory Evaluation Progress: {track.progress.completedCount} of {track.progress.total} Completed
                      </span>
                      <span style={{ color: isEarned ? 'var(--c-accent-emerald)' : 'var(--c-accent-blue)' }}>
                        {track.progress.percentage}%
                      </span>
                    </div>

                    <div className="cert-progress-track">
                      <div
                        className={`cert-progress-fill ${isEarned ? 'green' : 'blue'}`}
                        style={{ width: `${track.progress.percentage}%` }}
                      />
                    </div>

                    {isEarned && track.certId && (
                      <div style={{
                        marginTop: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8,
                        fontSize: 11,
                        color: 'var(--c-text-muted)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ShieldCheck size={14} color="var(--c-accent-emerald)" />
                          Ledger Serial:
                          <code style={{
                            background: 'var(--c-code-bg)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            color: 'var(--c-text-main)',
                            fontWeight: 700
                          }}>
                            {track.certId}
                          </code>
                        </div>
                        <button
                          onClick={() => handleCopyId(track.certId)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: copiedId === track.certId ? 'var(--c-accent-emerald)' : 'var(--c-text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 700
                          }}
                        >
                          {copiedId === track.certId ? <Check size={12} /> : <Copy size={12} />}
                          {copiedId === track.certId ? 'Copied to Clipboard' : 'Copy Serial'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Evaluated Competency Chips */}
                <div>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--c-text-muted)',
                    marginBottom: 8
                  }}>
                    Assessed Technical Domains
                  </div>
                  <div className="cert-comp-row">
                    {track.competencies.map((comp, idx) => (
                      <span key={idx} className="cert-comp-chip">
                        {comp}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Expandable Syllabus Toggle */}
                {track.domains && track.domains.length > 0 && (
                  <div>
                    <button
                      onClick={() => toggleSyllabus(track.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--c-text-sub)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '4px 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {isExpanded ? 'Hide Evaluated Laboratory Syllabus' : `Inspect Full Syllabus (${track.domains.length} Domains • ${track.totalProjects} Lab Projects)`}
                    </button>

                    {isExpanded && (
                      <div className="cert-syllabus-box">
                        {track.domains.map((dom, dIdx) => (
                          <div key={dIdx} className="cert-syllabus-domain">
                            <div className="cert-domain-title">
                              <span style={{ color: 'var(--c-text-muted)' }}>{dIdx + 1}.</span>
                              {dom.domain}
                            </div>
                            <div className="cert-labs-grid">
                              {dom.slugs.map((slug, sIdx) => {
                                const isDone = completedProjects.includes(slug);
                                return (
                                  <div
                                    key={sIdx}
                                    className={`cert-lab-item ${isDone ? 'done' : ''}`}
                                  >
                                    {isDone ? (
                                      <CheckCircle2 size={13} color="var(--c-accent-emerald)" />
                                    ) : (
                                      <span style={{ width: 13, height: 13, borderRadius: '50%', border: '1px solid var(--c-border-strong)', display: 'inline-block' }} />
                                    )}
                                    <span style={{ fontWeight: isDone ? 700 : 500 }}>
                                      {dom.skills[sIdx] || slug}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions Row */}
                <div className="cert-action-row">
                  {isEarned ? (
                    <>
                      <button
                        onClick={() => setSelectedCertForModal(track)}
                        className="cert-btn-primary"
                        style={{
                          background: 'var(--c-accent-emerald)',
                          color: '#ffffff'
                        }}
                      >
                        <Award size={15} />
                        View Official Certificate
                      </button>

                      <button
                        onClick={() => navigate(`/certificate/${track.certId}`)}
                        className="cert-btn-secondary"
                      >
                        <ExternalLink size={14} />
                        Public Ledger Entry
                      </button>

                      <a
                        href={buildLinkedInCertUrl({
                          certName: track.title,
                          certId: track.certId
                        })}
                        target="_blank"
                        rel="noreferrer"
                        className="cert-btn-secondary"
                      >
                        <Share2 size={14} />
                        Add to LinkedIn
                      </a>
                    </>
                  ) : track.journeyUrl ? (
                    <>
                      <button
                        onClick={() => navigate(track.journeyUrl)}
                        className="cert-btn-primary"
                      >
                        {isInProgress ? 'Resume Lab Track' : 'Start Track Journey'}
                        <ArrowRight size={14} />
                      </button>

                      <span style={{ fontSize: 12, color: 'var(--c-text-muted)', fontWeight: 600 }}>
                        {track.progress.remainingCount} more lab project{track.progress.remainingCount === 1 ? '' : 's'} required
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--c-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                      <Lock size={13} />
                      Laboratory specification under active development by OpenHW Working Group
                    </span>
                  )}
                </div>
              </article>
            );
          })}

          {filteredTracks.length === 0 && (
            <div style={{
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              borderRadius: 16,
              padding: 40,
              textAlign: 'center',
              color: 'var(--c-text-muted)'
            }}>
              <Search size={28} style={{ marginBottom: 10, opacity: 0.5 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-main)' }}>No matching certifications found</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Try clearing your search query or switching to another filter tab.</div>
            </div>
          )}
        </section>

        {/* ── PUBLIC LEDGER LOOKUP TERMINAL ──────────────────────────────────── */}
        <section className="cert-terminal-box" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Hash size={18} color="var(--c-text-muted)" />
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--c-text-main)', letterSpacing: '0.02em' }}>
              Verify Official Hardware Credential
            </h3>
          </div>

          <p style={{ fontSize: 13, color: 'var(--c-text-sub)', margin: 0, lineHeight: 1.5 }}>
            OpenHW Studio issues deterministic, cryptographically keyed credential hashes.
            Institutions, recruiters, and academic evaluators can inspect student verification records directly on our public ledger.
          </p>

          <form
            onSubmit={handleLookupSubmit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              maxWidth: '520px',
              marginTop: 4
            }}
          >
            <input
              type="text"
              placeholder="e.g. OHW-ARD-2026-XXXX"
              value={verifySearchId}
              onChange={e => setVerifySearchId(e.target.value)}
              style={{
                flex: 1,
                boxSizing: 'border-box',
                background: 'var(--c-bg-subtle)',
                border: '1px solid var(--c-border)',
                borderRadius: 9,
                padding: '8px 12px',
                fontSize: 12,
                fontFamily: 'monospace',
                color: 'var(--c-text-main)',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              className="cert-btn-primary"
              style={{ padding: '8px 16px' }}
            >
              Verify Credential
            </button>
          </form>
        </section>

      </main>

      {/* ── POPUP OFFICIAL CERTIFICATE MODAL ─────────────────────────────────── */}
      <CertificateModal
        isOpen={Boolean(selectedCertForModal)}
        onClose={() => setSelectedCertForModal(null)}
        user={user}
        track={selectedCertForModal?.trackKey || 'arduino'}
        trackTitle={selectedCertForModal?.title || 'Certified Embedded Systems Specialist — Arduino Architecture'}
        completedProjects={completedProjects}
      />
    </div>
  );
}

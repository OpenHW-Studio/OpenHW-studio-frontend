import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Cpu,
  Activity,
  Monitor,
  Volume2,
  Sliders,
  Zap,
  Binary,
  Layers,
  ExternalLink,
  Github,
  ArrowRight,
  Info,
  ShieldCheck,
  Radio,
  Boxes,
  EyeOff,
} from "lucide-react";
import { COMPONENT_REGISTRY } from "./simulationpage/utils/componentRegistry.js";
import { resolveComponentDetails } from "./simulationpage/utils/componentVisibilityConfig.js";
import ThemeToggleSlider from "../components/ThemeToggleSlider.jsx";

// Build clean doc URL guaranteeing proper slash formatting
function getComponentDocUrl(slug) {
  const raw = import.meta.env.VITE_DOCS_URL || "https://openhw-studio.fossee.in/docs";
  const cleanBase = String(raw).trim().replace(/\/+$/, "");
  return `${cleanBase}/components/${slug}`;
}

// Build GitHub bug report URL targeting openhw-studio-emulator with pre-filled title and feature checklist template
function getReportBugUrl(comp) {
  if (!comp) return "https://github.com/OpenHW-Studio/openhw-studio-emulator/issues/new";

  const title = `[Component Bug] ${comp.title} (${comp.type})`;

  const featureChecklist = (comp.working || []).length > 0
    ? comp.working.map((f) => `- [ ] ${f}`).join("\n")
    : "- [ ] Basic Simulation Interaction";

  const inProgressList = (comp.inProgress || []).length > 0
    ? comp.inProgress.map((f) => `- [ ] ${f} (Known in-progress)`).join("\n")
    : "";

  const body = `### 📋 Component Details
- **Component**: ${comp.title}
- **Component ID**: \`${comp.type}\`
- **Category**: ${comp.group}
- **Pin Count**: ${comp.pinCount}
- **Current Status**: ${String(comp.status || "").toUpperCase()}

### ⚠️ Feature Status / Failure Checklist
*(Tick the checkbox for any feature that is failing or misbehaving)*
${featureChecklist}
${inProgressList ? `\n**Under Development Features:**\n${inProgressList}` : ""}

### 🐛 Bug Description
<!-- Describe clearly what happened versus what you expected to happen -->

### 🔄 Steps to Reproduce
1. In OpenHW-Studio Simulator, add component \`${comp.type}\`
2. Connect pins:
3. Run the sketch:

### 💻 Minimal Arduino / MicroPython Code
\`\`\`cpp
// Paste minimal reproducible sketch here
void setup() {

}
void loop() {

}
\`\`\`

### 🖥️ Environment
- **Browser**: ${typeof navigator !== "undefined" ? navigator.userAgent : "Chrome"}
- **OS**: Linux / Windows / macOS
- **OpenHW-Studio Version**: Web Beta
`;

  return `https://github.com/OpenHW-Studio/openhw-studio-emulator/issues/new?title=${encodeURIComponent(
    title
  )}&body=${encodeURIComponent(body)}`;
}

// Category icon mapper with crisp SVGs
function getCategoryIcon(group = "") {
  const g = group.toLowerCase();
  if (g.includes("board")) return <Cpu size={15} />;
  if (g.includes("sensor")) return <Activity size={15} />;
  if (g.includes("display")) return <Monitor size={15} />;
  if (g.includes("audio") || g.includes("sound")) return <Volume2 size={15} />;
  if (g.includes("input") || g.includes("button") || g.includes("switch"))
    return <Sliders size={15} />;
  if (g.includes("actuator") || g.includes("motor") || g.includes("servo"))
    return <Zap size={15} />;
  if (g.includes("logic") || g.includes("gate")) return <Binary size={15} />;
  if (g.includes("communication") || g.includes("wireless") || g.includes("rf"))
    return <Radio size={15} />;
  return <Layers size={15} />;
}

// Status badge renderer with SVG icons
function StatusPill({ status, size = "normal" }) {
  if (status === "verified") {
    return (
      <span
        className={`status-pill status-pill-verified ${
          size === "large" ? "status-pill-lg" : ""
        }`}
      >
        <CheckCircle2 size={size === "large" ? 16 : 13} />
        <span>Supported</span>
      </span>
    );
  }
  if (status === "beta") {
    return (
      <span
        className={`status-pill status-pill-beta ${
          size === "large" ? "status-pill-lg" : ""
        }`}
      >
        <Clock size={size === "large" ? 16 : 13} />
        <span>Partial / Beta</span>
      </span>
    );
  }
  return (
    <span
      className={`status-pill status-pill-dev ${
        size === "large" ? "status-pill-lg" : ""
      }`}
    >
      <AlertTriangle size={size === "large" ? 16 : 13} />
      <span>In Development</span>
    </span>
  );
}

export default function ComponentStatusPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [activeComponent, setActiveComponent] = useState(null);

  // Close drawer on ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setActiveComponent(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Build full parsed component list from COMPONENT_REGISTRY
  const allComponents = useMemo(() => {
    const list = [];
    const seen = new Set();

    Object.values(COMPONENT_REGISTRY || {}).forEach((mod) => {
      const manifest = mod?.manifest;
      if (!manifest || manifest.hiddenAlias) return;

      const type = manifest.type || manifest.id;
      if (!type || seen.has(type)) return;
      seen.add(type);

      const resolved = resolveComponentDetails(type, manifest);
      const title =
        manifest.label || manifest.title || manifest.name || type;
      const group = manifest.group || "Misc";
      const pins = manifest.pins || [];

      list.push({
        type,
        title,
        group,
        description: manifest.description || resolved.summary || "",
        pins,
        pinCount: pins.length,
        status: resolved.status,
        hidden: resolved.hidden,
        summary: resolved.summary,
        working: resolved.working || [],
        inProgress: resolved.inProgress || [],
        limitations: resolved.limitations || [],
        notes: resolved.notes || "",
        docSlug: resolved.docSlug || type,
      });
    });

    // Sort: Boards first, then alphabetical
    list.sort((a, b) => {
      if (a.group === "Boards" && b.group !== "Boards") return -1;
      if (b.group === "Boards" && a.group !== "Boards") return 1;
      return a.title.localeCompare(b.title);
    });

    return list;
  }, []);

  // Compute live metrics
  const metrics = useMemo(() => {
    const total = allComponents.length;
    const verified = allComponents.filter((c) => c.status === "verified").length;
    const beta = allComponents.filter((c) => c.status === "beta").length;
    const dev = allComponents.filter((c) => c.status === "in-development").length;
    const hidden = allComponents.filter((c) => c.hidden).length;
    return { total, verified, beta, dev, hidden };
  }, [allComponents]);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set(allComponents.map((c) => c.group));
    const sorted = Array.from(set).sort();
    return ["All", ...sorted];
  }, [allComponents]);

  // Filtered components list
  const filteredComponents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allComponents.filter((c) => {
      // Category match
      if (selectedCategory !== "All" && c.group !== selectedCategory)
        return false;

      // Status match
      if (selectedStatus === "verified" && c.status !== "verified") return false;
      if (selectedStatus === "beta" && c.status !== "beta") return false;
      if (selectedStatus === "in-development" && c.status !== "in-development")
        return false;
      if (selectedStatus === "hidden" && !c.hidden) return false;

      // Text search match
      if (!q) return true;
      const matchesTitle = c.title.toLowerCase().includes(q);
      const matchesType = c.type.toLowerCase().includes(q);
      const matchesDesc = c.description.toLowerCase().includes(q);
      const matchesPins = c.pins.some((p) =>
        (p.id || p.description || "").toLowerCase().includes(q)
      );
      return matchesTitle || matchesType || matchesDesc || matchesPins;
    });
  }, [allComponents, search, selectedCategory, selectedStatus]);

  return (
    <div className="status-page-root">
      {/* ── TOP NAVIGATION ────────────────────────────────────────────────── */}
      <nav className="nav">
        <div
          className="nav-brand about-brand"
          onClick={() => navigate("/")}
          style={{ cursor: "pointer" }}
        >
          <img
            src="/logo-Photoroom.png"
            alt="OpenHW-Studio"
            className="brand-logo brand-logo--nav"
          />
          <div className="about-brand-text">
            <div className="name">OpenHW-Studio</div>
            <div className="sub">By FOSSEE, IIT Bombay</div>
          </div>
        </div>

        <div className="nav-actions" style={{ alignItems: "center" }}>
          <button className="btn btn-ghost" onClick={() => navigate("/")}>
            Home
          </button>
          <button className="btn btn-ghost" onClick={() => navigate("/about")}>
            About Us
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => navigate("/contributors")}
          >
            Contributors
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => navigate("/examples")}
          >
            Examples
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/simulator")}
          >
            Launch Simulator →
          </button>

          {/* Divider + Theme toggle */}
          <span
            style={{
              display: "flex",
              alignItems: "center",
              marginLeft: "22px",
              marginRight: "-24px",
              gap: "14px",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "1px",
                height: "20px",
                background: "var(--line)",
                opacity: 0.7,
                flexShrink: 0,
              }}
            />
            <ThemeToggleSlider size="sm" />
          </span>
        </div>
      </nav>

      {/* ── HERO SECTION ─────────────────────────────────────────────────── */}
      <header className="status-hero">
        <div className="status-wrap">
          <div className="status-eyebrow">
            <Boxes size={14} />
            <span>Hardware Emulation Matrix</span>
          </div>

          <h1 className="status-title">Hardware & Component Status</h1>
          <p className="status-subtitle">
            Real-time simulation capabilities, verification levels, and
            architectural support across all microcontroller boards and
            peripherals in OpenHW-Studio.
          </p>

          {/* Metric Stats Cards */}
          <div className="status-stats-grid">
            <div className="status-stat-card">
              <div className="stat-icon-wrap stat-icon-total">
                <Layers size={20} />
              </div>
              <div className="stat-content">
                <span className="stat-num">{metrics.total}</span>
                <span className="stat-lbl">Cataloged Components</span>
              </div>
            </div>

            <div className="status-stat-card">
              <div className="stat-icon-wrap stat-icon-verified">
                <CheckCircle2 size={20} />
              </div>
              <div className="stat-content">
                <span className="stat-num">{metrics.verified}</span>
                <span className="stat-lbl">Verified & Working</span>
              </div>
            </div>

            <div className="status-stat-card">
              <div className="stat-icon-wrap stat-icon-beta">
                <Clock size={20} />
              </div>
              <div className="stat-content">
                <span className="stat-num">{metrics.beta}</span>
                <span className="stat-lbl">Partial / Beta Support</span>
              </div>
            </div>

            <div className="status-stat-card">
              <div className="stat-icon-wrap stat-icon-dev">
                <AlertTriangle size={20} />
              </div>
              <div className="stat-content">
                <span className="stat-num">{metrics.dev}</span>
                <span className="stat-lbl">In Active Development</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── CONTROLS & FILTER BAR ────────────────────────────────────────── */}
      <section className="status-controls-section">
        <div className="status-wrap">
          {/* Search Box */}
          <div className="status-search-bar">
            <div className="status-search-input-wrap">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search by component name, type, pin ID, or feature..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="status-search-input"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="search-clear-btn"
                  title="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Status Filter Pills */}
            <div className="status-filter-pills">
              <button
                className={`filter-pill ${
                  selectedStatus === "All" ? "filter-pill-active" : ""
                }`}
                onClick={() => setSelectedStatus("All")}
              >
                All Status
              </button>
              <button
                className={`filter-pill ${
                  selectedStatus === "verified" ? "filter-pill-active" : ""
                }`}
                onClick={() => setSelectedStatus("verified")}
              >
                <CheckCircle2 size={13} className="text-emerald" />
                Supported ({metrics.verified})
              </button>
              <button
                className={`filter-pill ${
                  selectedStatus === "beta" ? "filter-pill-active" : ""
                }`}
                onClick={() => setSelectedStatus("beta")}
              >
                <Clock size={13} className="text-amber" />
                Beta ({metrics.beta})
              </button>
              <button
                className={`filter-pill ${
                  selectedStatus === "in-development"
                    ? "filter-pill-active"
                    : ""
                }`}
                onClick={() => setSelectedStatus("in-development")}
              >
                <AlertTriangle size={13} className="text-rose" />
                In Dev ({metrics.dev})
              </button>
              <button
                className={`filter-pill ${
                  selectedStatus === "hidden" ? "filter-pill-active" : ""
                }`}
                onClick={() => setSelectedStatus("hidden")}
              >
                <EyeOff size={13} className="text-amber" />
                Hidden ({metrics.hidden})
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="status-category-tabs">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`category-tab ${
                  selectedCategory === cat ? "category-tab-active" : ""
                }`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat !== "All" && getCategoryIcon(cat)}
                <span>{cat}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPONENT CARDS GRID ─────────────────────────────────────────── */}
      <main className="status-grid-section">
        <div className="status-wrap">
          {filteredComponents.length === 0 ? (
            <div className="status-empty-state">
              <Info size={44} className="empty-icon" />
              <h3>No matching components found</h3>
              <p>
                Try changing your search keywords or resetting your status/category
                filters.
              </p>
              <button
                className="btn btn-ghost reset-btn"
                onClick={() => {
                  setSearch("");
                  setSelectedCategory("All");
                  setSelectedStatus("All");
                }}
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="status-card-grid">
              {filteredComponents.map((comp) => (
                <div
                  key={comp.type}
                  className="status-card"
                  onClick={() => setActiveComponent(comp)}
                >
                  <div className="card-top-meta">
                    <span className="card-group-badge">
                      {getCategoryIcon(comp.group)}
                      <span>{comp.group}</span>
                    </span>
                    <div className="card-status-cluster">
                      {comp.hidden && (
                        <span className="status-pill status-pill-hidden" title="Hidden from Simulator Palette & Quick-Add">
                          <EyeOff size={11} />
                          <span>Hidden</span>
                        </span>
                      )}
                      <StatusPill status={comp.status} />
                    </div>
                  </div>

                  <h3 className="card-title">{comp.title}</h3>
                  <p className="card-desc">
                    {comp.description || comp.summary || "Open hardware simulation component."}
                  </p>

                  <div className="card-footer">
                    <span className="card-pin-count">
                      <span className="pin-dot" />
                      {comp.pinCount} {comp.pinCount === 1 ? "Pin" : "Pins"}
                    </span>

                    <span className="card-view-link">
                      <span>Details</span>
                      <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── SLIDE-OVER DRAWER (DETAILS PANEL) ────────────────────────────── */}
      {activeComponent && (
        <div className="drawer-overlay" onClick={() => setActiveComponent(null)}>
          <div
            className="drawer-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Drawer Header */}
            <div className="drawer-header">
              <div className="drawer-title-wrap">
                <div className="drawer-tags">
                  <span className="card-group-badge">
                    {getCategoryIcon(activeComponent.group)}
                    <span>{activeComponent.group}</span>
                  </span>
                  <StatusPill status={activeComponent.status} size="large" />
                  {activeComponent.hidden && (
                    <span className="status-pill status-pill-hidden status-pill-lg" title="Hidden from Simulator Palette">
                      <EyeOff size={13} />
                      <span>Hidden from Palette</span>
                    </span>
                  )}
                </div>
                <h2 className="drawer-title">{activeComponent.title}</h2>
                <code className="drawer-type-id">{activeComponent.type}</code>
              </div>

              <button
                className="drawer-close-btn"
                onClick={() => setActiveComponent(null)}
                aria-label="Close details"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="drawer-body">
              {/* Palette Visibility Alert */}
              {activeComponent.hidden && (
                <div className="drawer-hidden-alert">
                  <EyeOff size={18} className="text-amber" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Hidden from Simulator Palette & Quick-Add</strong>
                    <p>
                      This component is currently hidden from the simulator's component search
                      and palette panel while its simulation model is undergoing implementation.
                    </p>
                  </div>
                </div>
              )}

              {/* Summary / Notes */}
              {activeComponent.summary && (
                <div className="drawer-section">
                  <h4 className="drawer-section-title">
                    <Info size={15} />
                    <span>Overview</span>
                  </h4>
                  <p className="drawer-text">{activeComponent.summary}</p>
                </div>
              )}

              {/* Working Features */}
              <div className="drawer-section">
                <h4 className="drawer-section-title text-emerald-header">
                  <CheckCircle2 size={16} />
                  <span>Verified & Working Features</span>
                </h4>
                <ul className="feature-list">
                  {activeComponent.working.map((item, idx) => (
                    <li key={idx} className="feature-item feature-verified">
                      <CheckCircle2 size={14} className="feature-icon" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* In Progress Features */}
              {activeComponent.inProgress.length > 0 && (
                <div className="drawer-section">
                  <h4 className="drawer-section-title text-amber-header">
                    <Clock size={16} />
                    <span>Under Active Implementation</span>
                  </h4>
                  <ul className="feature-list">
                    {activeComponent.inProgress.map((item, idx) => (
                      <li key={idx} className="feature-item feature-progress">
                        <Clock size={14} className="feature-icon" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Limitations */}
              {activeComponent.limitations.length > 0 && (
                <div className="drawer-section">
                  <h4 className="drawer-section-title text-rose-header">
                    <AlertTriangle size={16} />
                    <span>Current Limitations</span>
                  </h4>
                  <ul className="feature-list">
                    {activeComponent.limitations.map((item, idx) => (
                      <li key={idx} className="feature-item feature-limit">
                        <AlertTriangle size={14} className="feature-icon" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Architecture & Simulation Notes */}
              {activeComponent.notes && (
                <div className="drawer-section">
                  <h4 className="drawer-section-title">
                    <ShieldCheck size={16} />
                    <span>Simulation Architecture & Notes</span>
                  </h4>
                  <div className="drawer-note-box">
                    <p>{activeComponent.notes}</p>
                  </div>
                </div>
              )}

              {/* Pinout Tags */}
              {activeComponent.pins.length > 0 && (
                <div className="drawer-section">
                  <h4 className="drawer-section-title">
                    <Layers size={15} />
                    <span>Pin Definitions ({activeComponent.pins.length})</span>
                  </h4>
                  <div className="pin-cloud">
                    {activeComponent.pins.map((pin, i) => (
                      <span key={i} className="pin-badge" title={pin.type || ""}>
                        {pin.id || pin.description || `P${i}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Action Footer */}
            <div className="drawer-footer">
              <a
                href={getComponentDocUrl(activeComponent.docSlug)}
                target="_blank"
                rel="noopener noreferrer"
                className="drawer-btn drawer-btn-primary"
              >
                <span>View Documentation & Try Now</span>
                <ExternalLink size={15} />
              </a>

              <div className="drawer-footer-row">
                <a
                  href={getReportBugUrl(activeComponent)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="drawer-btn drawer-btn-ghost"
                >
                  <Github size={14} />
                  <span>Report Bug</span>
                </a>

                <a
                  href="https://github.com/OpenHW-Studio/openhw-studio-emulator"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="drawer-btn drawer-btn-ghost"
                >
                  <span>Contribute Code</span>
                  <ArrowRight size={14} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STYLES ───────────────────────────────────────────────────────── */}
      <style>{STATUS_PAGE_CSS}</style>
    </div>
  );
}

const STATUS_PAGE_CSS = `
  .status-page-root {
    min-height: 100vh;
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    padding-bottom: 80px;
    position: relative;
  }

  .status-wrap {
    max-width: 1240px;
    margin: 0 auto;
    padding: 0 24px;
  }

  /* ── Hero ── */
  .status-hero {
    padding: 60px 0 40px;
    background: radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.08) 0%, transparent 65%);
    border-bottom: 1px solid var(--border);
    text-align: center;
  }

  .status-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 5px 14px;
    border-radius: 99px;
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.3);
    color: var(--accent, #38bdf8);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-family: 'Space Grotesk', sans-serif;
    margin-bottom: 18px;
  }

  .status-title {
    font-size: clamp(28px, 4vw, 44px);
    font-weight: 800;
    font-family: 'Space Grotesk', sans-serif;
    color: var(--text);
    letter-spacing: -0.02em;
    margin: 0 0 14px;
  }

  .status-subtitle {
    font-size: 16px;
    color: var(--text2);
    max-width: 680px;
    margin: 0 auto 36px;
    line-height: 1.6;
  }

  /* ── Stats Grid ── */
  .status-stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-top: 10px;
  }
  @media (max-width: 900px) {
    .status-stats-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 540px) {
    .status-stats-grid { grid-template-columns: 1fr; }
  }

  .status-stat-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 18px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.08);
    transition: transform 0.2s ease, border-color 0.2s ease;
  }
  .status-stat-card:hover {
    transform: translateY(-2px);
    border-color: var(--border2);
  }

  .stat-icon-wrap {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .stat-icon-total { background: rgba(56, 189, 248, 0.12); color: #38bdf8; }
  .stat-icon-verified { background: rgba(16, 185, 129, 0.12); color: #10b981; }
  .stat-icon-beta { background: rgba(245, 158, 11, 0.12); color: #f59e0b; }
  .stat-icon-dev { background: rgba(239, 68, 68, 0.12); color: #ef4444; }

  .stat-content {
    display: flex;
    flex-direction: column;
    text-align: left;
  }
  .stat-num {
    font-size: 24px;
    font-weight: 800;
    font-family: 'Space Grotesk', sans-serif;
    color: var(--text);
    line-height: 1.1;
  }
  .stat-lbl {
    font-size: 12.5px;
    color: var(--text2);
    margin-top: 4px;
    font-weight: 500;
  }

  /* ── Controls & Filter Bar ── */
  .status-controls-section {
    padding: 32px 0 20px;
  }

  .status-search-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 20px;
  }

  .status-search-input-wrap {
    position: relative;
    flex: 1;
    min-width: 280px;
  }
  .search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text2);
    pointer-events: none;
  }
  .status-search-input {
    width: 100%;
    padding: 12px 38px 12px 42px;
    border-radius: 12px;
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .status-search-input:focus {
    border-color: var(--accent, #38bdf8);
    box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
  }
  .search-clear-btn {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: var(--text2);
    cursor: pointer;
    padding: 4px;
  }
  .search-clear-btn:hover { color: var(--text); }

  .status-filter-pills {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .filter-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 99px;
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text2);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .filter-pill:hover {
    color: var(--text);
    border-color: var(--border2);
  }
  .filter-pill-active {
    background: var(--card2);
    border-color: var(--accent, #38bdf8);
    color: var(--text);
    font-weight: 600;
    box-shadow: 0 2px 10px rgba(56, 189, 248, 0.12);
  }

  /* ── Category Tabs ── */
  .status-category-tabs {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 8px;
    scrollbar-width: thin;
    scrollbar-color: var(--border2, #243350) transparent;
  }
  .status-category-tabs::-webkit-scrollbar {
    height: 5px;
  }
  .status-category-tabs::-webkit-scrollbar-track {
    background: transparent;
  }
  .status-category-tabs::-webkit-scrollbar-thumb {
    background: var(--border2, #243350);
    border-radius: 99px;
  }
  .status-category-tabs::-webkit-scrollbar-thumb:hover {
    background: var(--accent, #38bdf8);
  }
  .category-tab {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 16px;
    border-radius: 10px;
    background: transparent;
    border: 1px solid transparent;
    color: var(--text2);
    font-size: 13.5px;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .category-tab:hover {
    background: var(--card);
    color: var(--text);
  }
  .category-tab-active {
    background: var(--card);
    border-color: var(--border);
    color: var(--accent, #38bdf8);
    font-weight: 600;
  }

  /* ── Component Cards Grid (3 Columns) ── */
  .status-grid-section {
    padding: 10px 0 40px;
  }
  .status-card-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 22px;
  }
  @media (max-width: 1060px) {
    .status-card-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 680px) {
    .status-card-grid {
      grid-template-columns: 1fr;
    }
  }

  .status-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 22px 20px;
    display: flex;
    flex-direction: column;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .status-card:hover {
    transform: translateY(-3px);
    border-color: var(--accent, #38bdf8);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.12);
  }

  .card-top-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }

  .card-status-cluster {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .card-group-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border);
    color: var(--text2);
    font-size: 11.5px;
    font-weight: 600;
    text-transform: capitalize;
  }

  .card-title {
    font-size: 17px;
    font-weight: 700;
    font-family: 'Space Grotesk', sans-serif;
    color: var(--text);
    margin: 0 0 8px;
    line-height: 1.25;
  }

  .card-desc {
    font-size: 13px;
    color: var(--text2);
    line-height: 1.55;
    margin: 0 0 18px;
    flex: 1;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 14px;
    border-top: 1px solid var(--border);
  }

  .card-pin-count {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text2);
    font-weight: 500;
  }
  .pin-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent, #38bdf8);
  }

  .card-view-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--accent, #38bdf8);
    transition: transform 0.15s ease;
  }
  .status-card:hover .card-view-link {
    transform: translateX(3px);
  }

  /* ── Status Pills ── */
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: 99px;
    font-size: 11.5px;
    font-weight: 600;
    white-space: nowrap;
  }
  .status-pill-lg {
    padding: 5px 12px;
    font-size: 12.5px;
  }

  .status-pill-verified {
    background: rgba(16, 185, 129, 0.12);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }
  .status-pill-beta {
    background: rgba(245, 158, 11, 0.12);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }
  .status-pill-dev {
    background: rgba(239, 68, 68, 0.12);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .status-pill-hidden {
    background: rgba(148, 163, 184, 0.12);
    color: #94a3b8;
    border: 1px solid rgba(148, 163, 184, 0.3);
  }

  .drawer-hidden-alert {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 10px;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.25);
    margin-bottom: 24px;
  }
  .drawer-hidden-alert strong {
    display: block;
    font-size: 13.5px;
    color: #f59e0b;
    margin-bottom: 4px;
    font-weight: 700;
  }
  .drawer-hidden-alert p {
    font-size: 13px;
    line-height: 1.5;
    color: var(--text2);
    margin: 0;
  }

  .text-emerald { color: #10b981; }
  .text-amber { color: #f59e0b; }
  .text-rose { color: #ef4444; }

  /* ── Empty State ── */
  .status-empty-state {
    text-align: center;
    padding: 70px 20px;
    background: var(--card);
    border: 1px dashed var(--border);
    border-radius: 20px;
    max-width: 500px;
    margin: 40px auto;
  }
  .empty-icon {
    color: var(--text2);
    margin-bottom: 16px;
    opacity: 0.7;
  }
  .status-empty-state h3 {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 700;
  }
  .status-empty-state p {
    color: var(--text2);
    font-size: 14px;
    margin: 0 0 20px;
  }
  .reset-btn {
    border: 1px solid var(--border);
  }

  /* ── Slide-Over Drawer ── */
  .drawer-overlay {
    position: fixed;
    inset: 0;
    z-index: 100000;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(4px);
    display: flex;
    justify-content: flex-end;
    animation: drawerFadeIn 0.25s ease;
  }

  @keyframes drawerFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .drawer-panel {
    width: 100%;
    max-width: 540px;
    height: 100vh;
    background: var(--bg2, var(--card));
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    box-shadow: -10px 0 30px rgba(0, 0, 0, 0.4);
    animation: drawerSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes drawerSlideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  .drawer-header {
    padding: 24px 28px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .drawer-title-wrap { flex: 1; }
  .drawer-tags {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .drawer-title {
    font-size: 22px;
    font-weight: 800;
    font-family: 'Space Grotesk', sans-serif;
    color: var(--text);
    margin: 0 0 6px;
  }
  .drawer-type-id {
    display: inline-block;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    color: var(--text2);
    font-family: monospace;
  }

  .drawer-close-btn {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text2);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .drawer-close-btn:hover {
    color: var(--text);
    border-color: var(--border2);
    background: rgba(255, 255, 255, 0.06);
  }

  .drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 28px;
    scrollbar-width: thin;
    scrollbar-color: var(--border2, #243350) transparent;
  }
  .drawer-body::-webkit-scrollbar {
    width: 6px;
  }
  .drawer-body::-webkit-scrollbar-track {
    background: transparent;
  }
  .drawer-body::-webkit-scrollbar-thumb {
    background: var(--border2, #243350);
    border-radius: 99px;
  }
  .drawer-body::-webkit-scrollbar-thumb:hover {
    background: var(--accent, #38bdf8);
  }

  .drawer-section {
    margin-bottom: 28px;
  }
  .drawer-section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 700;
    color: var(--text);
    margin: 0 0 12px;
    letter-spacing: -0.01em;
  }

  .text-emerald-header { color: #10b981; }
  .text-amber-header { color: #f59e0b; }
  .text-rose-header { color: #ef4444; }

  .drawer-text {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text2);
    margin: 0;
  }

  .feature-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .feature-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 9px 14px;
    border-radius: 8px;
    font-size: 13.5px;
    line-height: 1.45;
  }
  .feature-icon {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .feature-verified {
    background: rgba(16, 185, 129, 0.08);
    color: var(--text);
  }
  .feature-verified .feature-icon { color: #10b981; }

  .feature-progress {
    background: rgba(245, 158, 11, 0.08);
    color: var(--text);
  }
  .feature-progress .feature-icon { color: #f59e0b; }

  .feature-limit {
    background: rgba(239, 68, 68, 0.08);
    color: var(--text);
  }
  .feature-limit .feature-icon { color: #ef4444; }

  .drawer-note-box {
    background: rgba(255, 255, 255, 0.04);
    border-left: 3px solid var(--accent, #38bdf8);
    padding: 12px 16px;
    border-radius: 0 8px 8px 0;
  }
  .drawer-note-box p {
    font-size: 13.5px;
    color: var(--text2);
    margin: 0;
    line-height: 1.55;
  }

  .pin-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .pin-badge {
    display: inline-block;
    padding: 4px 9px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border);
    font-size: 12px;
    font-family: monospace;
    color: var(--text);
  }

  .drawer-footer {
    padding: 20px 28px;
    border-top: 1px solid var(--border);
    background: var(--card);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .drawer-footer-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  @media (max-width: 480px) {
    .drawer-footer-row {
      flex-direction: column;
    }
    .drawer-btn-ghost {
      width: 100%;
    }
  }

  .drawer-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px 18px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .drawer-btn-primary {
    background: var(--accent, #38bdf8);
    color: #070b14;
    width: 100%;
  }
  .drawer-btn-primary:hover {
    filter: brightness(1.1);
    box-shadow: 0 4px 14px rgba(56, 189, 248, 0.3);
  }

  .drawer-btn-ghost {
    flex: 1;
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text2);
    font-size: 13px;
  }
  .drawer-btn-ghost:hover {
    color: var(--text);
    border-color: var(--border2);
    background: rgba(255, 255, 255, 0.05);
  }
`;

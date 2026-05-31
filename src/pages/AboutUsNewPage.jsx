import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  Cpu,
  Layers,
  Tv,
  WifiOff,
  Users,
  Trophy,
  Github,
  ChevronRight,
  Check,
  AlertCircle,
} from "lucide-react";

const DOCS_URL =
  import.meta.env.VITE_DOCS_URL || "https://openhw-studio.fossee.in/docs/";

const CSS = `
.about-new-container {
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: 'Space Grotesk', sans-serif;
  line-height: 1.5;
  overflow-x: hidden;
}

.about-new-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 48px;
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
}

.about-new-nav-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.about-new-nav-logo {
  max-width: 65px;
  height: auto;
  object-fit: contain;
  transition: transform 0.3s;
}

.about-new-nav-logo:hover {
  transform: scale(1.05);
}

.about-new-nav-title {
  font-size: 20px;
  font-weight: 700;
}

.about-new-nav-accent {
  color: var(--accent);
}

.about-new-nav-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.about-new-nav-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: monospace;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--green);
  background: rgba(0, 230, 118, 0.1);
  border: 1px solid rgba(0, 230, 118, 0.2);
  padding: 4px 10px;
  border-radius: 9999px;
}

.about-new-nav-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
  position: relative;
}

.about-new-nav-status-dot::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--green);
  animation: about-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes about-ping {
  75%, 100% {
    transform: scale(3);
    opacity: 0;
  }
}

.about-new-hero {
  max-width: 1200px;
  margin: 0 auto;
  padding: 80px 24px;
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 60px;
  align-items: center;
  position: relative;
}

.about-new-hero-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}

.about-new-hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 212, 255, 0.1);
  border: 1px solid rgba(0, 212, 255, 0.3);
  color: var(--accent);
  padding: 8px 16px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 24px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.about-new-hero-title {
  font-size: clamp(38px, 5.5vw, 64px);
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 24px;
  color: var(--text);
}

.about-new-hero-desc {
  font-size: 16px;
  color: var(--text2);
  line-height: 1.7;
  max-width: 600px;
  margin-bottom: 32px;
  border-left: 2px solid var(--border2);
  padding-left: 16px;
}

.about-new-hero-actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.about-new-hero-visual {
  display: flex;
  justify-content: center;
}

.about-new-hero-card {
  width: 100%;
  max-width: 380px;
  aspect-ratio: 1;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--bg2);
  box-shadow: var(--shadow);
  overflow: hidden;
  position: relative;
}

.about-new-hero-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.about-new-hero-card:hover .about-new-hero-img {
  transform: scale(1.03);
}

.about-new-hero-overlay {
  position: absolute;
  bottom: 16px;
  left: 16px;
  right: 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  z-index: 10;
}

.about-new-hero-stat-badge {
  background: rgba(13, 21, 37, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
}

.about-new-hero-stat-val {
  font-size: 18px;
  font-weight: 700;
  color: var(--accent);
}

.about-new-hero-stat-val.green {
  color: var(--green);
}

.about-new-hero-stat-lbl {
  font-size: 9px;
  font-family: monospace;
  text-transform: uppercase;
  color: var(--text3);
  margin-top: 2px;
}

/* VISION BAND */
.about-new-vision {
  background: var(--bg2);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 48px 24px;
}

.about-new-vision-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 40px;
}

.about-new-vision-header {
  min-width: 250px;
}

.about-new-vision-sub {
  font-size: 11px;
  font-family: monospace;
  text-transform: uppercase;
  color: var(--text3);
  letter-spacing: 0.15em;
  display: block;
  margin-bottom: 4px;
}

.about-new-vision-title {
  font-size: 24px;
  font-weight: 700;
}

.about-new-vision-quote {
  font-size: 18px;
  color: var(--text2);
  line-height: 1.7;
  max-width: 800px;
  font-style: italic;
}

.about-new-vision-quote strong {
  font-style: normal;
  font-weight: 700;
  color: var(--text);
}

/* SECTION GLOBAL styling */
.about-new-section {
  max-width: 1200px;
  margin: 0 auto;
  padding: 80px 24px;
}

.about-new-section-center {
  text-align: center;
  max-width: 700px;
  margin: 0 auto 56px;
}

.about-new-section-badge {
  font-size: 11px;
  font-family: monospace;
  text-transform: uppercase;
  color: var(--accent);
  background: rgba(0, 212, 255, 0.1);
  border: 1px solid rgba(0, 212, 255, 0.2);
  padding: 4px 12px;
  border-radius: 9999px;
  display: inline-block;
}

.about-new-section-badge.green {
  color: var(--green);
  background: rgba(0, 230, 118, 0.1);
  border-color: rgba(0, 230, 118, 0.2);
}

.about-new-section-badge.orange {
  color: var(--orange);
  background: rgba(255, 145, 0, 0.1);
  border-color: rgba(255, 145, 0, 0.2);
}

.about-new-section-badge.purple {
  color: var(--purple);
  background: rgba(168, 85, 247, 0.1);
  border-color: rgba(168, 85, 247, 0.2);
}

.about-new-section-title {
  font-size: 32px;
  font-weight: 800;
  margin-top: 16px;
  color: var(--text);
}

.about-new-section-desc {
  font-size: 15px;
  color: var(--text2);
  margin-top: 12px;
  line-height: 1.6;
}

/* FEATURES CARD GRID */
.about-new-features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.about-new-feature-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  box-shadow: var(--shadow);
}

.about-new-feature-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--accent-color);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.3s ease;
}

.about-new-feature-card:hover {
  transform: translateY(-4px);
  border-color: var(--border2);
  box-shadow: var(--shadow), 0 12px 30px rgba(0, 0, 0, 0.15);
}

.about-new-feature-card:hover::before {
  transform: scaleX(1);
}

.about-new-feature-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.about-new-feature-icon-box {
  padding: 12px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.about-new-feature-num {
  font-family: monospace;
  font-size: 12px;
  color: var(--text3);
}

.about-new-feature-title {
  font-size: 18px;
  font-weight: 700;
  margin-top: 8px;
  color: var(--text);
}

.about-new-feature-body {
  font-size: 13.5px;
  color: var(--text2);
  line-height: 1.6;
  flex-grow: 1;
}

.about-new-feature-footer {
  width: 100%;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 16px;
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.about-new-feature-foot-lbl {
  font-size: 10px;
  font-family: monospace;
  text-transform: uppercase;
  color: var(--text3);
  letter-spacing: 0.05em;
}

.about-new-feature-arrow {
  color: var(--text3);
  transition: transform 0.2s, color 0.2s;
}

.about-new-feature-card:hover .about-new-feature-arrow {
  transform: translateX(3px);
  color: var(--text);
}

/* ROLES SECTION */
.about-new-roles-bg {
  background: var(--bg2);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 80px 24px;
}

.about-new-roles-inner {
  max-width: 1200px;
  margin: 0 auto;
}

.about-new-tabs {
  display: flex;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  overflow: hidden;
  max-width: 600px;
  margin: 0 auto 40px;
}

.about-new-tab-btn {
  flex: 1;
  padding: 14px 20px;
  font-family: monospace;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  background: transparent;
  color: var(--text3);
  border: none;
  border-right: 1px solid var(--border);
  cursor: pointer;
  transition: all 0.2s ease;
}

.about-new-tab-btn:last-child {
  border-right: none;
}

.about-new-tab-btn:hover {
  background: var(--card2);
  color: var(--text2);
}

.about-new-tab-btn.active {
  background: var(--card);
  color: var(--accent-color);
  font-weight: 700;
  box-shadow: inset 0 -2px 0 var(--accent-color);
}

.about-new-role-panel {
  display: grid;
  grid-template-columns: 1fr 1.3fr;
  gap: 40px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 48px;
  max-width: 900px;
  margin: 0 auto;
  box-shadow: var(--shadow);
}

.about-new-role-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.about-new-role-badge {
  font-size: 11px;
  font-family: monospace;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
}

.about-new-role-title {
  font-size: 28px;
  font-weight: 800;
  margin-bottom: 16px;
}

.about-new-role-desc {
  font-size: 14px;
  color: var(--text2);
  line-height: 1.7;
}

.about-new-role-features {
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  padding-left: 40px;
}

.about-new-role-subtitle {
  font-size: 11px;
  font-family: monospace;
  text-transform: uppercase;
  color: var(--text3);
  letter-spacing: 0.1em;
  display: block;
  margin-bottom: 16px;
}

.about-new-role-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.about-new-role-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 13.5px;
  color: var(--text2);
}

.about-new-role-item.disabled {
  opacity: 0.5;
  color: var(--text3);
  text-decoration: line-through;
}

.about-new-role-icon {
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  padding: 2px;
  flex-shrink: 0;
}

.about-new-role-icon.success {
  background: rgba(0, 230, 118, 0.1);
  color: var(--green);
}

.about-new-role-icon.danger {
  background: rgba(255, 68, 68, 0.1);
  color: var(--red);
}

/* HARDWARE DEVICE TILES */
.about-new-hw-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.about-new-hw-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: all 0.3s ease;
  min-height: 250px;
}

.about-new-hw-card:hover {
  transform: translateY(-3px);
  border-color: var(--border2);
}

.about-new-hw-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.about-new-hw-num {
  font-family: monospace;
  font-size: 11px;
  color: var(--text3);
}

.about-new-hw-status {
  font-size: 9px;
  font-family: monospace;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 8px;
  border-radius: 9999px;
  border: 1px solid transparent;
}

.about-new-hw-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 2px;
  color: var(--text);
}

.about-new-hw-type {
  font-size: 11px;
  font-family: monospace;
  color: var(--accent);
  display: block;
  margin-bottom: 12px;
}

.about-new-hw-desc {
  font-size: 12px;
  color: var(--text2);
  line-height: 1.5;
  margin-bottom: 20px;
}

.about-new-hw-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.about-new-hw-foot-lbl {
  font-size: 9px;
  font-family: monospace;
  color: var(--text3);
  text-transform: uppercase;
}

.about-new-hw-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);
}

/* MARQUEE LOOP */
.about-new-marquee {
  width: 100%;
  overflow: hidden;
  background: var(--bg2);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 20px 0;
  position: relative;
}

.about-new-marquee-track {
  display: flex;
  gap: 60px;
  width: max-content;
  animation: about-new-loop 35s linear infinite;
}

@keyframes about-new-loop {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

.about-new-marquee-item {
  display: flex;
  align-items: center;
  gap: 16px;
  font-family: monospace;
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text2);
  white-space: nowrap;
}

.about-new-marquee-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}

/* APPROACH SECTION */
.about-new-approach-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: 1000px;
  margin: 0 auto;
}

.about-new-approach-item {
  display: grid;
  grid-template-columns: 80px 300px 1fr;
  gap: 32px;
  border-top: 1px solid var(--border);
  padding: 32px 0;
}

.about-new-approach-item:last-child {
  border-bottom: 1px solid var(--border);
}

.about-new-approach-num {
  font-family: monospace;
  font-size: 16px;
  font-weight: 700;
  color: var(--text3);
}

.about-new-approach-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}

.about-new-approach-body {
  font-size: 14.5px;
  color: var(--text2);
  line-height: 1.7;
}

/* TEAM TILES */
.about-new-team-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
}

.about-new-team-card {
  border-radius: var(--radius);
  border: 1px solid var(--border);
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  transition: all 0.3s ease;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.01);
  text-decoration: none;
}

.about-new-team-card:hover {
  transform: translateY(-3px);
  border-color: var(--accent-color);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.02);
}

.about-new-team-avatar {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: var(--text);
}

.about-new-team-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 2px;
  line-height: 1.2;
}

.about-new-team-card:hover .about-new-team-name {
  color: var(--accent-color);
}

.about-new-team-handle {
  font-family: monospace;
  font-size: 10px;
  color: var(--text3);
}

.about-new-team-action {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: monospace;
  font-size: 9px;
  text-transform: uppercase;
  color: var(--text3);
  margin-top: 12px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.about-new-team-card:hover .about-new-team-action {
  opacity: 1;
}

/* FOOTER */
.about-new-footer {
  border-top: 1px solid var(--border);
  background: var(--bg);
  padding: 48px 24px;
}

.about-new-footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
}

.about-new-footer-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.about-new-footer-logo {
  max-width: 36px;
  height: auto;
  opacity: 0.7;
}

.about-new-footer-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text2);
}

.about-new-footer-title span {
  color: var(--text3);
}

.about-new-footer-links {
  display: flex;
  gap: 24px;
  font-family: monospace;
  font-size: 11px;
}

.about-new-footer-links a {
  color: var(--text3);
  text-decoration: none;
  transition: color 0.2s;
}

.about-new-footer-links a:hover {
  color: var(--accent);
}

.about-new-footer-divider {
  color: rgba(255, 255, 255, 0.08);
}

.about-new-footer-meta {
  color: var(--text3);
}

/* RESPONSIVE LAYOUTS */
@media (max-width: 960px) {
  .about-new-nav {
    padding: 16px 24px;
  }
  .about-new-hero {
    grid-template-columns: 1fr;
    padding: 60px 24px;
    gap: 40px;
  }
  .about-new-hero-visual {
    order: -1;
  }
  .about-new-vision-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
  }
  .about-new-features-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .about-new-role-panel {
    grid-template-columns: 1fr;
    padding: 32px;
    gap: 24px;
  }
  .about-new-role-features {
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-left: 0;
    padding-top: 24px;
  }
  .about-new-hw-grid {
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .about-new-approach-item {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 24px 0;
  }
  .about-new-team-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .about-new-footer-inner {
    flex-direction: column;
    text-align: center;
  }
  .about-new-footer-links {
    flex-direction: column;
    gap: 12px;
  }
  .about-new-footer-divider {
    display: none;
  }
}

@media (max-width: 520px) {
  .about-new-hw-grid {
    grid-template-columns: 1fr;
  }
  .about-new-team-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
`;

const features = [
  {
    num: "01",
    color: "var(--accent)",
    title: "In-Browser Circuit Simulation",
    body: "A drag-and-drop canvas with manual wiring, real-time electrical validation, and smart auto-assist. LEDs receive 220 ohm resistors automatically, and LCDs get contrast potentiometers. No plugins or desktop software required.",
    foot: "Simulation Engine",
    icon: Cpu,
  },
  {
    num: "02",
    color: "var(--orange)",
    title: "Three-Level Programming",
    body: "Visual Blockly for beginners with live C++ translation, partial scaffolding for intermediate students, and a full text editor for advanced users. Switch modes dynamically as competence grows.",
    foot: "Code Editor",
    icon: Layers,
  },
  {
    num: "03",
    color: "var(--green)",
    title: "Serial Monitor & Plotter",
    body: "Real-time serial output with timestamped logging, search, pause, and clear controls. A multi-signal analog plotter visualizes sensor data at full simulation speeds.",
    foot: "Developer Tools",
    icon: Tv,
  },
  {
    num: "04",
    color: "var(--purple)",
    title: "Offline-First Architecture",
    body: "Compiled machine code is cached locally in IndexedDB. Projects auto-save every 2.5 seconds. Component uploads queue when offline and sync automatically upon reconnection.",
    foot: "Reliability",
    icon: WifiOff,
  },
  {
    num: "05",
    color: "var(--red)",
    title: "Live Classroom Infrastructure",
    body: "Screen broadcasting, instant circuit template push, screen lock, and cohort-level grading tools for teachers. Submissions are stored as structured JSON + source code.",
    foot: "Education",
    icon: Users,
  },
  {
    num: "06",
    color: "var(--accent)",
    title: "Gamified Component Progression",
    body: "Students start with basic components. Advanced sensors, actuators, and controllers unlock as they earn XP, collect badges, and solve structural engineering challenges.",
    foot: "Progression",
    icon: Trophy,
  },
];

const roles = [
  {
    key: "guest",
    name: "Guest",
    tagline: "No account needed",
    color: "var(--text2)",
    desc: "Guests have immediate access to the full simulation environment. Build circuits, write firmware, and run live simulations without creating an account. Projects persist locally in your browser.",
    can: [
      "Full simulator and interactive canvas",
      "Write and run C++ and MicroPython firmware",
      "Real-time simulation at 16 MHz AVR clock speed",
      "Download schematic as metadata-embedded PNG",
      "Access all pre-built playground examples",
    ],
    cannot: [
      "Cloud project persistence and sync",
      "Structured assignment submissions",
      "XP progression, levels, and badges",
    ],
  },
  {
    key: "student",
    name: "Student",
    tagline: "Login required",
    color: "var(--accent)",
    desc: "Students enroll in classes via invitation, submit structured assignments, and unlock achievements. Actions feed a transparent progression system that gamifies component access.",
    can: [
      "Join classes with teacher-issued invite codes",
      "Save, sync, and fork projects in the cloud",
      "Submit assignments as structured JSON + code",
      "Earn XP, coins, and achievement badges",
      "Unlock advanced components through coding",
      "View detailed grading and inline comments",
    ],
    cannot: [],
  },
  {
    key: "teacher",
    name: "Teacher",
    tagline: "Login required",
    color: "var(--green)",
    desc: "Teachers manage classroom rosters and control live sessions. Instantly lock student screens, push code templates to active workspaces, and grade submissions with detailed analytics.",
    can: [
      "Create classes and manage student rosters",
      "Design and distribute code/circuit templates",
      "Broadcast screens and push templates live",
      "Lock and unlock student screens during tests",
      "Grade submissions inline with rubrics and feed",
      "Access student progression & performance analytics",
    ],
    cannot: [],
  },
];

const hardwareRoadmap = [
  {
    num: "01",
    name: "Arduino Uno",
    type: "AVR Core Emulation",
    status: "Active",
    badgeColor: "border-emerald-500/20 text-emerald-400 bg-emerald-500/5",
    desc: "Full instruction-level AVR core emulation with cycle-accurate timing and pin state updates.",
    glow: "box-shadow: 0 0 15px rgba(16,185,129,0.1);",
  },
  {
    num: "02",
    name: "Raspberry Pi Pico",
    type: "RP2040 Emulation",
    status: "Active",
    badgeColor: "border-purple-500/20 text-purple-400 bg-purple-500/5",
    desc: "Dual-core ARM Cortex-M0+ instruction translation supporting MicroPython and C++ runtimes.",
    glow: "box-shadow: 0 0 15px rgba(168,85,247,0.1);",
  },
  {
    num: "03",
    name: "ESP32",
    type: "API-Level Emulation",
    status: "Active",
    badgeColor: "border-cyan-500/20 text-cyan-400 bg-cyan-500/5",
    desc: "Active Wi-Fi and Bluetooth protocol mockups with high-level peripheral control simulation.",
    glow: "box-shadow: 0 0 15px rgba(6,182,212,0.1);",
  },
  {
    num: "04",
    name: "STM32",
    type: "ARM Cortex-M Core",
    status: "Active",
    badgeColor: "border-blue-500/20 text-blue-400 bg-blue-500/5",
    desc: "ARM instruction translation pipeline simulating performance chips and advanced DACs/ADCs.",
    glow: "box-shadow: 0 0 15px rgba(59,130,246,0.1);",
  },
];

const approach = [
  {
    num: "01",
    title: "Simulation that behaves like real silicon",
    body: "Instruction-level emulation means code runs exactly as it would on hardware. Timer interrupts fire on the microsecond, ADC conversions track voltage logic precisely, and PWM signals simulate true duty cycles. If it works on OpenHW-Studio, it compiles and works on the workbench.",
  },
  {
    num: "02",
    title: "Education built in, not bolted on",
    body: "Our classroom integration is a foundational pillar, not an afterthought. Broadcaster protocols are optimized for limited school network bandwidth, screens can be locked instantly, and assignments export as complete JSON representations of both circuit layout and code.",
  },
  {
    num: "03",
    title: "Open by default, extensible by design",
    body: "Every single engine, library, and translation script is fully open-source. Developers and universities can add custom shields, define new hardware components through YAML schemas, or hook into the compilation pipeline to support local hardware.",
  },
];

const team = [
  {
    name: "Md. Danish",
    handle: "danish9661",
    url: "https://github.com/danish9661",
  },
  {
    name: "Satvik Sharma",
    handle: "Satvik-Sharma511",
    url: "https://github.com/Satvik-Sharma511",
  },
  {
    name: "Sagar Seth",
    handle: "lightning-sagar",
    url: "https://github.com/lightning-sagar",
  },
  {
    name: "B Naga Krishna Manohar",
    handle: "KrishnaManohar101",
    url: "https://github.com/KrishnaManohar101",
  },
  {
    name: "Viraj Shah",
    handle: "virajsh4h",
    url: "https://github.com/virajsh4h",
  },
  {
    name: "Aaditya Pranav",
    handle: "aadityapranav989-ai",
    url: "https://github.com/aadityapranav989-ai",
  },
  {
    name: "Akshat Singh Tomar",
    handle: "akshat440",
    url: "https://github.com/akshat440",
  },
  {
    name: "Poojitha S K",
    handle: "geekypooky",
    url: "https://github.com/geekypooky",
  },
  {
    name: "Kartikay Goel",
    handle: "Kartikay-goel",
    url: "https://github.com/Kartikay-goel",
  },
  {
    name: "Kiran",
    handle: "kiranpgore20117-code",
    url: "https://github.com/kiranpgore20117-code",
  },
  {
    name: "Manas Krishna Neigapula",
    handle: "manasneigapula",
    url: "https://github.com/manasneigapula",
  },
  {
    name: "Pratham Mittal",
    handle: "PrathamMittal07",
    url: "https://github.com/PrathamMittal07",
  },
  {
    name: "Rashmitha Rani B N",
    handle: "Rashmitha018",
    url: "https://github.com/Rashmitha018",
  },
  { name: "Rima", handle: "rima48-bit", url: "https://github.com/rima48-bit" },
  {
    name: "Ritesh Jadhav",
    handle: "RiteshJadhav283",
    url: "https://github.com/RiteshJadhav283",
  },
  {
    name: "Mohit Sharma",
    handle: "sharmamohit-devops",
    url: "https://github.com/sharmamohit-devops",
  },
  {
    name: "Sharukhh",
    handle: "Sharukhh69",
    url: "https://github.com/Sharukhh69",
  },
  {
    name: "Snehal",
    handle: "snehal-git-hub",
    url: "https://github.com/snehal-git-hub",
  },
];

function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

export default function AboutUsNewPage() {
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuth();
  const [activeRole, setActiveRole] = useState(0);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "dark",
  );
  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme); // Save choice
  };

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  const handleDashboard = () => {
    if (role === "teacher") navigate("/teacher/dashboard");
    else if (role === "student") navigate("/student/dashboard");
    else navigate("/user/dashboard");
  };

  const currentRole = roles[activeRole];

  return (
    <div className="about-new-container">
      {/* NAVIGATION */}
      <nav className="about-new-nav">
        <div className="about-new-nav-brand" onClick={() => navigate("/")}>
          <img
            src="/logo-Photoroom.png"
            alt="OpenHW-Studio"
            className="about-new-nav-logo"
          />
          <span className="about-new-nav-title">
            Open<span className="about-new-nav-accent">HW-Studio</span>
          </span>
        </div>
        <div className="about-new-nav-actions">
          <span className="about-new-nav-status">
            <span className="about-new-nav-status-dot" />
            Live Platform
          </span>
          <button
            className="btn btn-ghost"
            onClick={toggleTheme}
            title="Toggle Theme"
            style={{
              padding: "8px 16px",
              display: "flex",
              alignItems: "center",
            }}
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
          {isAuthenticated ? (
            <button
              className="btn btn-primary"
              onClick={handleDashboard}
              style={{ padding: "8px 16px" }}
            >
              Dashboard
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => navigate("/login")}
              style={{ padding: "8px 16px" }}
            >
              Get Started
            </button>
          )}
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="about-new-hero">
        <div className="about-new-hero-content">
          <div className="about-new-hero-badge">
            💻 Cloud-Based Emulation Engine
          </div>
          <h1 className="about-new-hero-title">
            We built the lab <br />
            that lives in <br />
            <span className="gradient-text">a browser.</span>
          </h1>
          <p className="about-new-hero-desc">
            OpenHW-Studio is a modern open-source electronics simulation and
            learning platform built for students, teachers, and engineers. Get
            instruction-level accuracy and classroom-grade tooling right in your
            browser—no physical hardware required.
          </p>
          <div className="about-new-hero-actions">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => navigate("/simulator")}
            >
              Try Simulator
            </button>
            <button
              className="btn btn-ghost btn-lg"
              onClick={() => navigate("/")}
            >
              Back to Home
            </button>
          </div>
        </div>

        <div className="about-new-hero-visual">
          <div className="about-new-hero-card">
            <img
              src="/about_hero.png"
              alt="Glow MCU Board Illustration"
              className="about-new-hero-img"
            />
            <div className="about-new-hero-overlay">
              <div className="about-new-hero-stat-badge">
                <span className="about-new-hero-stat-val">16 MHz</span>
                <span className="about-new-hero-stat-lbl">AVR Clock</span>
              </div>
              <div className="about-new-hero-stat-badge">
                <span className="about-new-hero-stat-val green">60 fps</span>
                <span className="about-new-hero-stat-lbl">Render Speed</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLATFORM VISION BAND */}
      <section className="about-new-vision">
        <div className="about-new-vision-inner">
          <div className="about-new-vision-header">
            <span className="about-new-vision-sub">Redesigning Education</span>
            <h3 className="about-new-vision-title">Platform Vision</h3>
          </div>
          <p className="about-new-vision-quote">
            "A <strong>unified, gamified, classroom-integrated</strong>{" "}
            simulation ecosystem for modern embedded education — combining
            interactive simulation, guided auto-wiring assistance, structured
            classroom workflows, and multi-board experimentation in a single,
            fully open platform."
          </p>
        </div>
      </section>

      {/* FEATURE CARDS */}
      <section className="about-new-section">
        <div className="about-new-section-center">
          <span className="about-new-section-badge">
            02 — Platform Ecosystem
          </span>
          <h2 className="about-new-section-title">
            Six systems. One coherent platform.
          </h2>
          <p className="about-new-section-desc">
            Every component is engineered to work standalone and integrate
            without friction. Simulators compile locally, emulators render
            efficiently.
          </p>
        </div>
        <div className="about-new-features-grid">
          {features.map((f) => {
            const IconComp = f.icon;
            return (
              <div
                key={f.num}
                className="about-new-feature-card"
                style={{ "--accent-color": f.color }}
              >
                <div className="about-new-feature-header">
                  <div
                    className="about-new-feature-icon-box"
                    style={{
                      borderColor: `${f.color}30`,
                      backgroundColor: `${f.color}08`,
                      color: f.color,
                    }}
                  >
                    <IconComp size={20} />
                  </div>
                  <span className="about-new-feature-num">{f.num}</span>
                </div>
                <h3 className="about-new-feature-title">{f.title}</h3>
                <p className="about-new-feature-body">{f.body}</p>
                <div className="about-new-feature-footer">
                  <span className="about-new-feature-foot-lbl">{f.foot}</span>
                  <ChevronRight size={14} className="about-new-feature-arrow" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* USER ROLES SECTION */}
      <section className="about-new-roles-bg">
        <div className="about-new-roles-inner">
          <div className="about-new-section-center">
            <span className="about-new-section-badge green">
              03 — Target Audience
            </span>
            <h2 className="about-new-section-title">
              Three roles. One shared environment.
            </h2>
            <p className="about-new-section-desc">
              OpenHW-Studio serves the student learning coding structures, the
              teacher guiding assignment layouts, and the guest tester exploring
              schematics.
            </p>
          </div>

          {/* Role selector tabs */}
          <div className="about-new-tabs">
            {roles.map((r, i) => (
              <button
                key={r.key}
                className={`about-new-tab-btn ${activeRole === i ? "active" : ""}`}
                style={{ "--accent-color": r.color }}
                onClick={() => setActiveRole(i)}
              >
                {r.name}
              </button>
            ))}
          </div>

          {/* Active Role Panel */}
          <div className="about-new-role-panel">
            <div className="about-new-role-info">
              <span
                className="about-new-role-badge"
                style={{ color: currentRole.color }}
              >
                {currentRole.name} Mode
              </span>
              <h3 className="about-new-role-title">{currentRole.name}</h3>
              <p className="about-new-role-desc">{currentRole.desc}</p>
            </div>
            <div className="about-new-role-features">
              <span className="about-new-role-subtitle">
                Platform Capabilities
              </span>
              <div className="about-new-role-list">
                {currentRole.can.map((item, idx) => (
                  <div key={idx} className="about-new-role-item">
                    <div className="about-new-role-icon success">
                      <Check size={14} />
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
                {currentRole.cannot.map((item, idx) => (
                  <div key={idx} className="about-new-role-item disabled">
                    <div className="about-new-role-icon danger">
                      <AlertCircle size={14} />
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HARDWARE DEVICE TILES */}
      <section className="about-new-section">
        <div className="about-new-section-center">
          <span className="about-new-section-badge orange">
            04 — Device Support
          </span>
          <h2 className="about-new-section-title">Multi-MCU Architecture</h2>
          <p className="about-new-section-desc">
            OpenHW-Studio supports 4 major microcontroller cores, fully
            integrated and active within our client-side emulator pipeline.
          </p>
        </div>

        <div className="about-new-hw-grid">
          {hardwareRoadmap.map((hw) => (
            <div
              key={hw.num}
              className="about-new-hw-card"
              style={{ boxShadow: hw.glow }}
            >
              <div>
                <div className="about-new-hw-header">
                  <span className="about-new-hw-num">Core {hw.num}</span>
                  <span className={`about-new-hw-status ${hw.badgeColor}`}>
                    {hw.status}
                  </span>
                </div>
                <h3 className="about-new-hw-title">{hw.name}</h3>
                <span className="about-new-hw-type">{hw.type}</span>
                <p className="about-new-hw-desc">{hw.desc}</p>
              </div>
              <div className="about-new-hw-footer">
                <span className="about-new-hw-foot-lbl">Emulator Core</span>
                <div className="about-new-hw-dot" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MARQUEE OF TECHNICAL TERMS */}
      <div className="about-new-marquee">
        <div className="about-new-marquee-track">
          {[
            "16 MHz AVR EMULATION",
            "60 FPS CANVAS RENDERING",
            "OFFLINE INDEXEDDB storage",
            "LIVE CLASSROOM BROADCASTS",
            "BLOCKLY Firmware GENERATION",
            "MULTI-CORE RP2040 TRANSCRIPTION",
            "ACTIVE ESP32 CORE SIMULATION",
            "STM32 ARM Cortex EMULATOR",
            "SERIAL MONITOR & PLOTTER",
            "GAMIFIED LEARNING QUESTS",
          ].map((term, idx) => (
            <div key={idx} className="about-new-marquee-item">
              <span className="about-new-marquee-dot" />
              <span>{term}</span>
            </div>
          ))}
          {/* Duplicate to create loop */}
          {[
            "16 MHz AVR EMULATION",
            "60 FPS CANVAS RENDERING",
            "OFFLINE INDEXEDDB storage",
            "LIVE CLASSROOM BROADCASTS",
            "BLOCKLY Firmware GENERATION",
            "MULTI-CORE RP2040 TRANSCRIPTION",
            "ACTIVE ESP32 CORE SIMULATION",
            "STM32 ARM Cortex EMULATOR",
            "SERIAL MONITOR & PLOTTER",
            "GAMIFIED LEARNING QUESTS",
          ].map((term, idx) => (
            <div key={idx + 20} className="about-new-marquee-item">
              <span className="about-new-marquee-dot" />
              <span>{term}</span>
            </div>
          ))}
        </div>
      </div>

      {/* OUR APPROACH SECTION */}
      <section className="about-new-section">
        <div className="about-new-section-center">
          <span className="about-new-section-badge purple">
            05 — Engineering Culture
          </span>
          <h2 className="about-new-section-title">
            Three architectural decisions we never compromise on.
          </h2>
        </div>

        <div className="about-new-approach-list">
          {approach.map((a) => (
            <div key={a.num} className="about-new-approach-item">
              <div className="about-new-approach-num">{a.num}</div>
              <div className="about-new-approach-title">{a.title}</div>
              <div className="about-new-approach-body">{a.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CONTRIBUTORS SECTION */}
      <section className="about-new-roles-bg">
        <div className="about-new-roles-inner">
          <div className="about-new-section-center">
            <span className="about-new-section-badge">
              06 — Open Source Community
            </span>
            <h2 className="about-new-section-title">
              18 Contributors. One open platform.
            </h2>
            <p className="about-new-section-desc">
              OpenHW-Studio is built by a distributed team of engineers
              collaborating openly under the FOSSEE program at IIT Bombay.
            </p>
          </div>

          <div className="about-new-team-grid">
            {team.map((c, idx) => {
              // Custom pastel colors matching existing color system
              const colors = [
                "var(--accent)",
                "var(--green)",
                "var(--orange)",
                "var(--purple)",
                "var(--red)",
                "var(--accent2)",
              ];
              const colorVal = colors[idx % colors.length];

              return (
                <a
                  key={c.handle}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="about-new-team-card"
                  style={{ "--accent-color": colorVal }}
                >
                  <div className="about-new-team-avatar">
                    {initials(c.name)}
                  </div>
                  <h4 className="about-new-team-name">{c.name}</h4>
                  <span className="about-new-team-handle">/{c.handle}</span>
                  <div className="about-new-team-action">
                    <Github size={10} /> Profile
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="about-new-footer">
        <div className="about-new-footer-inner">
          <div className="about-new-footer-brand">
            <img
              src="/logo-Photoroom.png"
              alt="OpenHW-Studio Logo"
              className="about-new-footer-logo"
            />
            <span className="about-new-footer-title">
              Open<span>HW-Studio</span>
            </span>
          </div>
          <div className="about-new-footer-links">
            <a
              href="https://github.com/OpenHW-Studio"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <span className="about-new-footer-divider">|</span>
            <a href={DOCS_URL} target="_blank" rel="noreferrer">
              Documentation
            </a>
            <span className="about-new-footer-divider">|</span>
            <span className="about-new-footer-meta">IIT Bombay FOSSEE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

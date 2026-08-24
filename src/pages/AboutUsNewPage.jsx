import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Rocket, Share2, GraduationCap } from "lucide-react";

import tinkeringImg from "../assets/about/tinkering-students.png";
import prabhuImg from "../assets/about/Prabhu.jpeg";
import rajeshImg from "../assets/about/rajesh.jpeg";
import pratikBImg from "../assets/about/pratik-b.jpeg";
import pratikNImg from "../assets/about/pratik-n.jpeg";
import fosseeLogoImg from "../assets/about/fossee-logo.jpeg";

const DOCS_URL =
  import.meta.env.VITE_DOCS_URL || "https://openhw-studio.fossee.in/docs/";

const PAGE_CSS = `
  :root {
    --ink: #0B1222;
    --ink-700: #1B2740;
    --ink-500: #4B5875;
    --paper: #F5F6F3;
    --panel: #FFFFFF;
    --trace-blue: #2F6FED;
    --trace-blue-dim: #DCE7FE;
    --copper: #B9713E;
    --copper-dim: #F3E1D0;
    --signal-green: #1F9D63;
    --line: #DEE2E6;
    --radius: 14px;
    --maxw: 1320px;
  }

  .about-page-root {
    margin: 0;
    background-color: var(--paper);
    background-image: 
      radial-gradient(ellipse 80% 50% at 50% -10%, rgba(47, 111, 237, 0.06), transparent),
      linear-gradient(rgba(222, 226, 230, 0.3) 1px, transparent 1px),
      linear-gradient(90deg, rgba(222, 226, 230, 0.3) 1px, transparent 1px);
    background-size: 100% 100%, 56px 56px, 56px 56px;
    color: var(--ink);
    font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow-x: hidden;
  }

  .about-page-root h1, 
  .about-page-root h2, 
  .about-page-root h3, 
  .about-page-root h4, 
  .about-page-root h5 {
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    margin: 0;
    letter-spacing: -0.01em;
  }
  .about-page-root p { margin: 0; }
  .about-page-root a { color: inherit; text-decoration: none; }
  .about-page-root img:not(.brand-logo) { display: block; max-width: 100%; }
  .about-page-root .brand-logo { max-width: 70px; }

  .about-wrap { max-width: var(--maxw); margin: 0 auto; padding: 0 32px; width: 100%; position: relative; z-index: 2; }

  .about-eyebrow {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--trace-blue);
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .about-eyebrow::before {
    content: "";
    width: 7px; height: 7px;
    background: var(--trace-blue);
    border-radius: 50%;
    box-shadow: 0 0 0 3px var(--trace-blue-dim);
  }

  /* ---------- RICH CIRCUIT ACCENTS (MARGINS) ---------- */
  .circuit-accent-left {
    position: absolute; left: -110px; top: 40px; width: 220px; height: 1600px;
    pointer-events: none; opacity: 0.85; z-index: 1;
  }
  .circuit-accent-right {
    position: absolute; right: -110px; top: 60px; width: 220px; height: 1600px;
    pointer-events: none; opacity: 0.85; z-index: 1;
  }

  @keyframes pulseGlow {
    0%, 100% { transform: scale(1); opacity: 0.5; }
    50% { transform: scale(1.6); opacity: 1; filter: drop-shadow(0 0 6px rgba(47, 111, 237, 0.8)); }
  }
  .pulse-dot-blue {
    animation: pulseGlow 3s infinite ease-in-out;
    transform-origin: center;
  }
  .pulse-dot-copper {
    animation: pulseGlow 2.4s infinite ease-in-out 0.8s;
    transform-origin: center;
  }

  /* ---------- NAV ---------- */
  .about-nav {
    position: sticky; top: 0; z-index: 50;
    background: rgba(245, 246, 243, 0.88);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--line);
  }
  .about-nav-inner {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 32px;
    max-width: var(--maxw); margin: 0 auto;
  }
  .about-brand { display: flex; align-items: center; gap: 12px; cursor: pointer; }
  .about-brand-logo-img {
    height: 38px; width: auto; object-fit: contain; display: block;
  }
  .about-brand-text { line-height: 1.15; }
  .about-brand-text .name { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 16.5px; color: var(--ink); }
  .about-brand-text .sub { font-size: 11px; color: var(--ink-500); }

  .about-links { display: flex; align-items: center; gap: 30px; }
  .about-links a, .about-links button {
    font-size: 14.5px; font-weight: 500; color: var(--ink-700);
    position: relative; padding: 4px 0; background: none; border: none; cursor: pointer;
  }
  .about-links a.active { color: var(--trace-blue); }
  .about-links a.active::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: -3px; height: 2px;
    background: var(--trace-blue); border-radius: 2px;
  }
  .about-nav-cta {
    background: var(--ink); color: #fff; font-size: 14px; font-weight: 600;
    padding: 10px 20px; border-radius: 8px;
    display: inline-flex; align-items: center; gap: 8px; border: none; cursor: pointer;
    transition: background 0.2s ease;
  }
  .about-nav-cta:hover { background: var(--trace-blue); }

  /* ---------- HERO ---------- */
  .about-hero { padding: 76px 0 60px; position: relative; }
  .about-hero-grid {
    display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 64px; align-items: center;
  }
  .about-hero h1 {
    font-size: clamp(36px, 4.8vw, 54px);
    line-height: 1.06;
    font-weight: 700;
    margin-top: 16px;
    color: var(--ink);
  }
  .about-hero h1 .accent { color: var(--trace-blue); }
  .about-hero p.lede {
    margin-top: 20px; font-size: 17px; line-height: 1.65; color: var(--ink-500);
    max-width: 56ch;
  }
  .about-hero p.lede a { color: var(--copper); border-bottom: 1px solid var(--copper-dim); font-weight: 500; }

  /* schematic / image panel */
  .about-schematic {
    position: relative; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
  }
  .about-schematic img {
    width: 100%; height: auto; object-fit: cover; border-radius: 14px;
  }

  /* ---------- SECTION HEAD ---------- */
  .about-section { padding: 64px 0; }
  .about-section-head { max-width: 640px; margin-bottom: 40px; }
  .about-section-head h2 { font-size: clamp(24px, 3vw, 32px); margin-top: 12px; font-weight: 600; color: var(--ink); }
  .about-section-head p { margin-top: 12px; color: var(--ink-500); font-size: 15.5px; line-height: 1.6; }

  /* ---------- PILLAR CARDS ---------- */
  .about-pillars {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;
  }
  .about-card {
    background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 32px 28px; position: relative;
    transition: transform .25s ease, box-shadow .25s ease;
  }
  .about-card:hover {
    transform: translateY(-3px); box-shadow: 0 12px 24px rgba(11, 18, 34, 0.06);
  }
  .about-card::before {
    content: ""; position: absolute; top: 0; left: 22px; width: 14px; height: 6px;
    background: var(--paper); border-left: 1px solid var(--line); border-right: 1px solid var(--line);
  }
  .about-pin {
    width: 44px; height: 44px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 20px; transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .about-pin.blue { background: var(--trace-blue-dim); color: var(--trace-blue); border: 1px solid rgba(47, 111, 237, 0.15); }
  .about-pin.copper { background: var(--copper-dim); color: var(--copper); border: 1px solid rgba(185, 113, 62, 0.15); }
  .about-pin.green { background: #DCF3E7; color: var(--signal-green); border: 1px solid rgba(31, 157, 99, 0.15); }
  .about-card h3 { font-size: 18.5px; font-weight: 600; margin-bottom: 11px; color: var(--ink); }
  .about-card p { font-size: 14.5px; line-height: 1.65; color: var(--ink-500); }

  /* ---------- CONTRIBUTOR STRIP ---------- */
  .about-strip {
    background: var(--ink); border-radius: 20px;
    padding: 44px 48px;
    display: flex; align-items: center; justify-content: space-between; gap: 40px;
    color: #fff;
    position: relative; overflow: hidden;
  }
  .about-strip::after {
    content: ""; position: absolute; right: -40px; top: -40px; width: 240px; height: 240px;
    border: 1px dashed rgba(255, 255, 255, 0.14); border-radius: 50%; pointer-events: none;
  }
  .about-strip-num { font-family: 'Space Grotesk', sans-serif; font-size: 56px; font-weight: 700; color: var(--trace-blue); line-height: 1; }
  .about-strip-copy { max-width: 520px; }
  .about-strip-copy h3 { font-size: 22px; font-weight: 600; margin-bottom: 8px; color: #fff; }
  .about-strip-copy p { font-size: 15px; color: #AEB8CF; line-height: 1.6; }
  .about-strip-btn {
    font-size: 14px; font-weight: 600; background: transparent; color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.28); border-radius: 99px;
    padding: 12px 24px; white-space: nowrap; display: inline-flex; align-items: center; gap: 8px;
    flex-shrink: 0; cursor: pointer; transition: background 0.2s ease, border-color 0.2s ease;
    position: relative; z-index: 2;
  }
  .about-strip-btn:hover { background: var(--trace-blue); border-color: var(--trace-blue); }

  /* ---------- LEADERSHIP CARDS ---------- */
  .about-lead-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px;
  }
  .about-lead-card {
    background: var(--panel); border: 1px solid var(--line); border-radius: 20px;
    padding: 16px; text-align: left; position: relative;
    display: flex; flex-direction: column; justify-content: space-between;
    transition: transform .25s ease, box-shadow .25s ease;
  }
  .about-lead-card:hover {
    transform: translateY(-4px); box-shadow: 0 16px 32px rgba(11, 18, 34, 0.08);
  }
  .about-lead-photo {
    width: 100%; height: 210px; border-radius: 14px;
    overflow: hidden; background: var(--paper); border: 1px solid var(--line);
    margin-bottom: 18px;
  }
  .about-lead-photo img {
    width: 100%; height: 100%; object-fit: cover; object-position: top center;
  }
  .about-lead-info {
    padding: 0 4px 8px; flex-grow: 1; display: flex; flex-direction: column;
  }
  .about-lead-card h4 { 
    font-size: 19px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; color: var(--ink); line-height: 1.25;
  }
  .about-lead-card .role { 
    font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-500); margin-top: 6px; line-height: 1.4;
  }
  .about-lead-card .org {
    font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--trace-blue);
    margin-top: 10px; letter-spacing: 0.02em;
  }
  .about-lead-footer {
    display: flex; align-items: center; justify-content: space-between;
    margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--paper);
  }
  .about-lead-link {
    font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-700);
  }
  .about-lead-arrow {
    width: 36px; height: 36px; border-radius: 10px;
    background: var(--trace-blue-dim); color: var(--trace-blue);
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 16px; transition: background 0.2s ease, color 0.2s ease;
  }
  .about-lead-card:hover .about-lead-arrow {
    background: var(--trace-blue); color: #FFFFFF;
  }

  /* ---------- JOIN CTA ---------- */
  .about-join {
    background: #FFFFFF;
    border: 1px solid var(--line); border-radius: 20px;
    padding: 48px 52px; display: flex; flex-direction: column; align-items: center; text-align: center;
    position: relative; overflow: hidden;
    box-shadow: 0 10px 30px rgba(11, 18, 34, 0.04);
  }
  .about-join h3 { font-size: 28px; font-weight: 700; margin-bottom: 12px; color: var(--ink); }
  .about-join p { color: var(--ink-500); font-size: 15.5px; line-height: 1.65; max-width: 720px; margin: 0 auto 12px; }
  .about-join p.bold-line { color: var(--ink); font-weight: 700; margin-bottom: 26px; }
  .about-join-cta {
    background: var(--trace-blue); color: #fff; font-weight: 600; font-size: 15px;
    padding: 13px 30px; border-radius: 10px; white-space: nowrap;
    display: inline-flex; align-items: center; gap: 8px; transition: background 0.2s ease, transform 0.2s ease;
    box-shadow: 0 6px 18px rgba(47, 111, 237, 0.25);
  }
  .about-join-cta:hover { background: #2358c4; transform: translateY(-2px); }

  /* ---------- FOOTER ---------- */
  .about-footer { background: var(--ink); color: #AEB8CF; margin-top: 20px; padding: 56px 0 26px; }
  .about-foot-grid {
    display: grid; grid-template-columns: 1.4fr repeat(4, 1fr); gap: 32px;
    padding-bottom: 38px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  .about-foot-brand .about-brand-text .name { color: #fff; }
  .about-foot-brand .about-brand-text .sub { color: #7C8AA8; }
  .about-foot-brand p { margin-top: 16px; font-size: 13.5px; line-height: 1.6; max-width: 34ch; }
  .about-foot-disclaimer { margin-top: 10px; font-size: 11.5px; color: #7C8AA8; line-height: 1.5; max-width: 32ch; }
  .about-footer h5 {
    font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: #7C8AA8;
    letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 16px;
  }
  .about-footer ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 11px; }
  .about-footer ul a { font-size: 14px; color: #D5DAE6; transition: color 0.2s ease; }
  .about-footer ul a:hover { color: #fff; }
  .about-foot-bottom {
    display: flex; justify-content: space-between; align-items: center; padding-top: 22px;
    font-size: 13px; color: #7C8AA8; flex-wrap: wrap; gap: 12px;
  }
  .about-tags { display: flex; gap: 18px; font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; }
  .about-tags span::before { content: "● "; color: var(--trace-blue); }
  .about-top-btn {
    background: rgba(255, 255, 255, 0.06); color: #D5DAE6; border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px; padding: 6px 14px; font-size: 12.5px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s ease;
  }
  .about-top-btn:hover { background: rgba(255, 255, 255, 0.14); color: #fff; border-color: rgba(255, 255, 255, 0.25); }

  /* ---------- RESPONSIVE ---------- */
  @media (max-width: 1180px) {
    .circuit-accent-left, .circuit-accent-right { opacity: 0.4; }
  }
  @media (max-width: 980px) {
    .circuit-accent-left, .circuit-accent-right { display: none; }
  }
  @media (max-width: 860px) {
    .about-links { display: none; }
    .about-hero-grid { grid-template-columns: 1fr; }
    .about-pillars { grid-template-columns: 1fr; }
    .about-lead-grid { grid-template-columns: repeat(2, 1fr); }
    .about-strip { flex-direction: column; align-items: flex-start; text-align: left; }
    .about-join { grid-template-columns: 1fr; }
    .about-foot-grid { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 520px) {
    .about-wrap { padding: 0 20px; }
    .about-lead-grid { grid-template-columns: 1fr; }
    .about-foot-grid { grid-template-columns: 1fr; }
  }
`;

export default function AboutUsNewPage() {
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuth();

  const [theme, setTheme] = React.useState(() => {
    return localStorage.getItem("theme") || "dark";
  });

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  const handleDashboard = () => {
    if (role === "teacher") navigate("/teacher/dashboard");
    else if (role === "student") navigate("/student/dashboard");
    else navigate("/user/dashboard");
  };

  return (
    <div className="about-page-root">
      <style>{PAGE_CSS}</style>

      {/* NAV */}
      <nav className="nav">
        <div className="nav-brand about-brand" onClick={() => navigate("/")}>
          <img src="/logo-Photoroom.png" alt="OpenHW-Studio" className="about-brand-logo-img" />
          <div className="about-brand-text">
            <div className="name">OpenHW-Studio</div>
            <div className="sub">By FOSSEE, IIT Bombay</div>
          </div>
        </div>
        <div className="nav-actions">
          <button className="btn btn-ghost" onClick={() => navigate("/about")}>
            About Us
          </button>
          <button className="btn btn-ghost" onClick={() => navigate("/examples")}>
            Examples
          </button>
          <button
            className="btn btn-ghost"
            onClick={toggleTheme}
            title="Toggle Dark/Light Mode"
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
          {isAuthenticated ? (
            <button className="btn btn-primary" onClick={handleDashboard}>
              Dashboard →
            </button>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={() => navigate("/login")}>
                Log In
              </button>
              <button className="btn btn-primary" onClick={() => navigate("/signup")}>
                Get Started
              </button>
            </>
          )}
        </div>
      </nav>

      <main style={{ position: "relative" }}>
        {/* SLEEK CIRCUIT TRACES ON LEFT MARGIN */}
        <svg className="circuit-accent-left" viewBox="0 0 220 1600" fill="none">
          <path d="M-20 40 H110 V160 H180 V320 H70 V480 H140 V680 H40 V890 H160 V1100 H60 V1340 H180 V1550" stroke="#2F6FED" strokeWidth="1.8" strokeDasharray="5 5" opacity="0.4"/>
          <path d="M-20 120 H60 V260 H130 V420 H30 V600 H180 V780 H80 V980 H130 V1220 H30 V1450" stroke="#B9713E" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.35"/>
          <path d="M-20 220 H150 V380 H90 V540 H160 V820 H50 V1050 H170 V1390 H60" stroke="#1F9D63" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.3"/>

          {/* Test Pads & Via Rings */}
          <circle cx="110" cy="40" r="5" fill="none" stroke="#2F6FED" strokeWidth="1.5" opacity="0.7"/>
          <circle cx="180" cy="160" r="5" fill="none" stroke="#2F6FED" strokeWidth="1.5" opacity="0.7"/>
          <circle cx="70" cy="320" r="5" fill="none" stroke="#B9713E" strokeWidth="1.5" opacity="0.7"/>
          <circle cx="140" cy="680" r="5" fill="none" stroke="#1F9D63" strokeWidth="1.5" opacity="0.7"/>
          <circle cx="160" cy="1100" r="5" fill="none" stroke="#2F6FED" strokeWidth="1.5" opacity="0.7"/>

          {/* Animated Glowing Signal Dots */}
          <circle className="pulse-dot-blue" cx="180" cy="320" r="4.5" fill="#2F6FED"/>
          <circle className="pulse-dot-copper" cx="70" cy="480" r="4.5" fill="#B9713E"/>
          <circle className="pulse-dot-blue" cx="160" cy="1100" r="4.5" fill="#2F6FED"/>
          <circle className="pulse-dot-copper" cx="180" cy="1550" r="4.5" fill="#B9713E"/>
        </svg>

        {/* SLEEK CIRCUIT TRACES ON RIGHT MARGIN */}
        <svg className="circuit-accent-right" viewBox="0 0 220 1600" fill="none">
          <path d="M240 60 H120 V200 H40 V360 H150 V540 H60 V760 H170 V990 H50 V1240 H160 V1520" stroke="#2F6FED" strokeWidth="1.8" strokeDasharray="5 5" opacity="0.4"/>
          <path d="M240 140 H160 V290 H80 V480 H180 V690 H30 V910 H140 V1150 H70 V1420" stroke="#1F9D63" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.35"/>
          <path d="M240 240 H90 V410 H170 V610 H70 V840 H160 V1060 H40 V1320 H180" stroke="#B9713E" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.3"/>

          {/* Test Pads & Via Rings */}
          <circle cx="120" cy="60" r="5" fill="none" stroke="#2F6FED" strokeWidth="1.5" opacity="0.7"/>
          <circle cx="40" cy="200" r="5" fill="none" stroke="#1F9D63" strokeWidth="1.5" opacity="0.7"/>
          <circle cx="150" cy="540" r="5" fill="none" stroke="#2F6FED" strokeWidth="1.5" opacity="0.7"/>
          <circle cx="60" cy="760" r="5" fill="none" stroke="#B9713E" strokeWidth="1.5" opacity="0.7"/>
          <circle cx="170" cy="990" r="5" fill="none" stroke="#1F9D63" strokeWidth="1.5" opacity="0.7"/>

          {/* Animated Glowing Signal Dots */}
          <circle className="pulse-dot-copper" cx="40" cy="200" r="4.5" fill="#B9713E"/>
          <circle className="pulse-dot-blue" cx="150" cy="540" r="4.5" fill="#2F6FED"/>
          <circle className="pulse-dot-copper" cx="60" cy="760" r="4.5" fill="#B9713E"/>
          <circle className="pulse-dot-blue" cx="160" cy="1520" r="4.5" fill="#2F6FED"/>
        </svg>

        {/* HERO */}
        <section className="about-hero">
          <div className="about-wrap about-hero-grid">
            <div>
              <span className="about-eyebrow">About OpenHW-Studio</span>
              <h1>
                Building the future of<br />
                <span className="accent">open hardware</span> education
              </h1>
              <p className="lede">
                OpenHW-Studio is an open-source platform developed under{" "}
                <a href="https://fossee.in" target="_blank" rel="noopener noreferrer">
                  FOSSEE — Free/Libre and Open Source Software for Education, IIT Bombay
                </a>
                . Our mission is to make electronics, embedded systems, IoT, and robotics education more
                accessible, interactive, and hands-on for students, educators, and makers everywhere.
              </p>
            </div>

            <div className="about-schematic">
              <img src={tinkeringImg} alt="Students tinkering with hardware" />
            </div>
          </div>
        </section>

        {/* PILLARS */}
        <section className="about-section">
          <div className="about-wrap">
            <div className="about-pillars">
              <div className="about-card">
                <div className="about-pin blue">
                  <Rocket size={20} strokeWidth={2.2} />
                </div>
                <h3>Our vision</h3>
                <p>
                  We envision a future where anyone, anywhere can learn, experiment, prototype, and
                  innovate with open technologies. OpenHW-Studio bridges theory and hands-on practice in
                  one unified platform for hardware design, programming, and simulation.
                </p>
              </div>
              <div className="about-card">
                <div className="about-pin copper">
                  <Share2 size={20} strokeWidth={2.2} />
                </div>
                <h3>Built through open collaboration</h3>
                <p>
                  OpenHW-Studio is more than software — it's a community-driven initiative. From
                  frontend and embedded systems to documentation and educational content, every
                  contributor helps shape where the platform goes next.
                </p>
              </div>
              <div className="about-card">
                <div className="about-pin green">
                  <GraduationCap size={20} strokeWidth={2.2} />
                </div>
                <h3>For learners, educators &amp; makers</h3>
                <p>
                  Whether you're a school student wiring your first circuit, a college student
                  building IoT applications, or an educator designing a practical course, OpenHW-Studio
                  is built around your learning journey.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CONTRIBUTOR STRIP */}
        <section className="about-section" style={{ paddingTop: 0 }}>
          <div className="about-wrap">
            <div className="about-strip" onClick={() => navigate("/contributors")} style={{ cursor: "pointer" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "24px" }}>
                <div className="about-strip-num">18</div>
                <div className="about-strip-copy">
                  <h3>Contributors. One open platform.</h3>
                  <p>
                    OpenHW-Studio is built by a distributed team of engineers collaborating openly
                    under the FOSSEE project at IIT Bombay.
                  </p>
                </div>
              </div>
              <button className="about-strip-btn">
                Meet our contributors →
              </button>
            </div>
          </div>
        </section>

        {/* LEADERSHIP SECTION */}
        <section className="about-section">
          <div className="about-wrap">
            <div className="about-section-head">
              <span className="about-eyebrow">Project Leadership</span>
              <h2>Guided by the FOSSEE project</h2>
              <p>
                OpenHW-Studio is developed under the guidance and leadership of the FOSSEE project at IIT Bombay.
              </p>
            </div>
            <div className="about-lead-grid">
              {/* Leader 1 */}
              <div className="about-lead-card">
                <div className="about-lead-photo">
                  <img src={prabhuImg} alt="Prof. Prabhu Ramachandran" />
                </div>
                <div className="about-lead-info">
                  <h4>Prof. Prabhu Ramachandran</h4>
                  <div className="role">Principal Investigator (PI)</div>
                  <div className="org">FOSSEE, IIT BOMBAY</div>
                </div>
                <div className="about-lead-footer">
                  <span className="about-lead-link">Profile</span>
                  <div className="about-lead-arrow">→</div>
                </div>
              </div>

              {/* Leader 2 */}
              <div className="about-lead-card">
                <div className="about-lead-photo">
                  <img src={rajeshImg} alt="Mr. Rajesh Kushalkar" />
                </div>
                <div className="about-lead-info">
                  <h4>Mr. Rajesh Kushalkar</h4>
                  <div className="role">National Coordinator — Open Source Hardware</div>
                  <div className="org">FOSSEE, IIT BOMBAY</div>
                </div>
                <div className="about-lead-footer">
                  <span className="about-lead-link">Profile</span>
                  <div className="about-lead-arrow">→</div>
                </div>
              </div>

              {/* Leader 3 */}
              <div className="about-lead-card">
                <div className="about-lead-photo">
                  <img src={pratikBImg} alt="Mr. Pratik Bhosale" />
                </div>
                <div className="about-lead-info">
                  <h4>Mr. Pratik Bhosale</h4>
                  <div className="role">Project Research Associate — Open Source Hardware</div>
                  <div className="org">FOSSEE, IIT BOMBAY</div>
                </div>
                <div className="about-lead-footer">
                  <span className="about-lead-link">Profile</span>
                  <div className="about-lead-arrow">→</div>
                </div>
              </div>

              {/* Leader 4 */}
              <div className="about-lead-card">
                <div className="about-lead-photo">
                  <img src={pratikNImg} alt="Mr. Pratik Nemane" />
                </div>
                <div className="about-lead-info">
                  <h4>Mr. Pratik Nemane</h4>
                  <div className="role">Project Research Assistant — Open Source Hardware</div>
                  <div className="org">FOSSEE, IIT BOMBAY</div>
                </div>
                <div className="about-lead-footer">
                  <span className="about-lead-link">Profile</span>
                  <div className="about-lead-arrow">→</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* JOIN CTA */}
        <section className="about-section" style={{ paddingTop: 0 }}>
          <div className="about-wrap">
            <div className="about-join">
              <h3>Join the Journey</h3>
              <p>
                OpenHW-Studio is continuously evolving, and we're always looking for enthusiastic contributors. Whether you're interested in software development, embedded systems, educational content, UI/UX design, testing, documentation, or community building, there's a place for you.
              </p>
              <p className="bold-line">
                Together, we can create an open platform that empowers the next generation of innovators.
              </p>
              <a 
                href="https://github.com/FOSSEE/OpenHW-Studio" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="about-join-cta"
              >
                Contribute Now ↗
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="about-footer">
        <div className="about-wrap">
          <div className="about-foot-grid">
            <div className="about-foot-brand">
              <div className="about-brand">
                <img src="/logo-Photoroom.png" alt="OpenHW-Studio Logo" className="about-brand-logo-img" style={{ height: "42px" }} />
                <div className="about-brand-text">
                  <div className="name">OpenHW-Studio</div>
                  <div className="sub">By FOSSEE, IIT Bombay</div>
                </div>
              </div>
              <p>Empowering learners and educators through open source hardware and collaboration.</p>
              <div className="about-foot-disclaimer">
                Supported by NMEICT, Ministry of Education, Govt. of India.
              </div>
              <div style={{ marginTop: "16px" }}>
                <a href="https://fossee.in" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block" }}>
                  <img 
                    src={fosseeLogoImg} 
                    alt="FOSSEE Logo" 
                    style={{ 
                      height: "64px", 
                      width: "auto", 
                      borderRadius: "8px", 
                      display: "block"
                    }} 
                  />
                </a>
              </div>
            </div>
            <div>
              <h5>Quick Links</h5>
              <ul>
                <li><Link to="/">Home</Link></li>
                <li><Link to="/explore">Explore</Link></li>
                <li><a href={DOCS_URL} target="_blank" rel="noopener noreferrer">Learn</a></li>
                <li><Link to="/simulator">Simulate</Link></li>
                <li><Link to="/examples">Projects</Link></li>
              </ul>
            </div>
            <div>
              <h5>Community</h5>
              <ul>
                <li><Link to="/about">About Us</Link></li>
                <li><Link to="/contributors">Contributors</Link></li>
                <li><a href="https://github.com/FOSSEE/OpenHW-Studio" target="_blank" rel="noopener noreferrer">GitHub Repo</a></li>
                <li><a href="https://fossee.in" target="_blank" rel="noopener noreferrer">FOSSEE IIT Bombay</a></li>
              </ul>
            </div>
            <div>
              <h5>Resources</h5>
              <ul>
                <li><a href={DOCS_URL} target="_blank" rel="noopener noreferrer">Documentation</a></li>
                <li><a href={DOCS_URL} target="_blank" rel="noopener noreferrer">Tutorials</a></li>
                <li><a href="mailto:support@fossee.in">Contact Us</a></li>
              </ul>
            </div>
            <div>
              <h5>Connect</h5>
              <ul>
                <li><a href="https://github.com/FOSSEE/OpenHW-Studio" target="_blank" rel="noopener noreferrer">GitHub</a></li>
                <li><a href="https://fossee.in" target="_blank" rel="noopener noreferrer">FOSSEE Website</a></li>
                <li><a href="https://www.youtube.com/@FOSSEE" target="_blank" rel="noopener noreferrer">YouTube Channel</a></li>
                <li><a href="mailto:support@fossee.in">Support Email</a></li>
              </ul>
            </div>
          </div>
          <div className="about-foot-bottom">
            <span>© 2026 OpenHW-Studio | FOSSEE, IIT Bombay</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

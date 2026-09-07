import React, { useState, useEffect } from "react";

/**
 * ThemeToggleSlider
 * ─────────────────
 * A beautiful pill-shaped toggle with:
 *  • Sun icon (light mode) / Moon icon (dark mode) inside a sliding knob
 *  • Star particles in dark mode, sun rays in light mode
 *  • Spring bounce animation on the sliding knob
 *  • Smooth background/shadow color transitions
 *
 * Props:
 *  size — "sm" | "md" | "lg"  (default: "md")
 *
 * Usage:
 *  <ThemeToggleSlider size="md" />
 */
export default function ThemeToggleSlider({ size = "md" }) {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute("data-theme") || "dark"
  );

  // Keep in sync when toggled from elsewhere (e.g. page-level toggles)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute("data-theme") || "dark");
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    setTheme(next);
  };

  const isDark = theme === "dark";

  // ── Responsive size presets ─────────────────────────────────────────────────
  const presets = {
    sm: { trackW: 50, trackH: 26, knob: 20, icon: 11, padding: 3 },
    md: { trackW: 58, trackH: 30, knob: 23, icon: 13, padding: 3.5 },
    lg: { trackW: 76, trackH: 40, knob: 32, icon: 18, padding: 4 },
  };
  const p = presets[size] || presets.md;
  const travel = p.trackW - p.knob - p.padding * 2;

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        position: "relative",
        width: p.trackW,
        height: p.trackH,
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        padding: 0,
        overflow: "hidden",
        flexShrink: 0,
        // Solid colors — gradients CANNOT be CSS-transitioned smoothly
        backgroundColor: isDark ? "#1e1b4b" : "#f59e0b",
        // Glow ring — only transition box-shadow (GPU friendly)
        boxShadow: isDark
          ? "0 0 0 1.5px rgba(99,102,241,0.45), 0 4px 14px rgba(0,0,0,0.35)"
          : "0 0 0 1.5px rgba(251,191,36,0.6), 0 4px 14px rgba(245,158,11,0.28)",
        transition: "background-color 0.35s ease, box-shadow 0.35s ease",
      }}
    >
      {/* ── Dark mode: tiny star particles ──────────────────────────────────── */}
      <Star show={isDark} top={5}  right={10} size={2}   opacity={0.85} delay="0s"   />
      <Star show={isDark} top={10} right={20} size={1.5} opacity={0.60} delay="0.4s" />
      <Star show={isDark} top={16} right={8}  size={1.5} opacity={0.50} delay="0.7s" />
      <Star show={isDark} top={5}  right={28} size={1}   opacity={0.40} delay="0.2s" />

      {/* ── Light mode: radiating sun rays (decorative arcs behind knob) ─────── */}
      {!isDark && (
        <span
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: p.trackH * 1.8,
            height: p.trackH * 1.8,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.35) 0%, transparent 65%)",
            pointerEvents: "none",
            transition: "opacity 0.4s ease",
            opacity: isDark ? 0 : 1,
          }}
        />
      )}

      {/* ── Sliding knob ─────────────────────────────────────────────────────── */}
      <span
        style={{
          position: "absolute",
          top: p.padding,
          left: p.padding,
          width: p.knob,
          height: p.knob,
          borderRadius: "50%",
          // Solid knob colors — avoids gradient transition jank
          backgroundColor: isDark ? "#e2e8f0" : "#ffffff",
          // GPU-accelerated transform only — the smoothest possible animation
          transform: isDark ? "translateX(0px)" : `translateX(${travel}px)`,
          willChange: "transform",
          // Spring bounce — tightened to 0.35s for snappier feel
          transition:
            "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.25s ease, box-shadow 0.25s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: isDark
            ? "0 2px 8px rgba(0,0,0,0.45), inset 0 1px 1px rgba(255,255,255,0.2)"
            : "0 2px 8px rgba(245,158,11,0.35), inset 0 1px 1px rgba(255,255,255,0.8)",
          zIndex: 1,
        }}
      >
        {isDark ? (
          // ── Moon SVG ───────────────────────────────────────────────────────
          <svg
            width={p.icon}
            height={p.icon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6366f1"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          // ── Sun SVG ────────────────────────────────────────────────────────
          <svg
            width={p.icon}
            height={p.icon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#d97706"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="M4.93 4.93l1.41 1.41" />
            <path d="M17.66 17.66l1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="M6.34 17.66l-1.41 1.41" />
            <path d="M19.07 4.93l-1.41 1.41" />
          </svg>
        )}
      </span>
    </button>
  );
}

// ── Helper: star particle ────────────────────────────────────────────────────
function Star({ show, top, right, size, opacity, delay }) {
  return (
    <span
      style={{
        position: "absolute",
        top,
        right,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "white",
        opacity: show ? opacity : 0,
        transition: `opacity 0.4s ease ${delay}`,
        pointerEvents: "none",
      }}
    />
  );
}

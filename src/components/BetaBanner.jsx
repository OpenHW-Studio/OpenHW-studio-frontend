import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * BetaBanner – a slim, dismissible top bar that notifies users the platform
 * is under active development and links to GitHub issue tracker for bug reports.
 *
 * • Hidden on simulator/demo/guided/admin/grading pages (where screen space matters)
 * • Pushes page content down (adds paddingTop to document.body equal to banner height)
 * • Dismissed state is persisted to localStorage (never shows again once dismissed)
 */
export default function BetaBanner() {
  const location = useLocation();
  const bannerRef = useRef(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("beta-banner-dismissed") === "true"
  );
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute("data-theme") || "dark"
  );

  // Sync theme with the global data-theme attribute
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

  // Hide on pages where a banner would interfere with the layout
  const hiddenRoutes = [
    "/simulator",
    "/demo",
    "/guided",
    "/admin",
    "/grading",
    "/mobile-simulator",
  ];
  const shouldHide = hiddenRoutes.some((r) => location.pathname.startsWith(r));
  const isVisible = !shouldHide && !dismissed;

  // Push page content down by the banner's actual height
  useEffect(() => {
    if (!isVisible) {
      document.body.style.paddingTop = "";
      return;
    }

    const applyPadding = () => {
      if (bannerRef.current) {
        document.body.style.paddingTop = `${bannerRef.current.offsetHeight}px`;
      }
    };

    applyPadding();

    // Re-apply on window resize (banner text may wrap on small screens)
    window.addEventListener("resize", applyPadding);
    return () => {
      window.removeEventListener("resize", applyPadding);
      document.body.style.paddingTop = "";
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const handleDismiss = () => {
    localStorage.setItem("beta-banner-dismissed", "true");
    document.body.style.paddingTop = "";
    setDismissed(true);
  };

  const s = getStyles(theme);

  return (
    <div ref={bannerRef} style={s.wrapper} role="alert" aria-label="Beta notice">
      <div style={s.inner}>
        {/* Left pill badge */}
        <span style={s.badge}>
          <span style={s.dot} />
          BETA
        </span>

        {/* Message */}
        <p style={s.message}>
          OpenHW-Studio is actively under development — you may encounter bugs.
          Found one?{" "}
          <a
            href="https://github.com/OpenHW-Studio/OpenHW-studio-frontend/issues/new?template=bug_report.md"
            target="_blank"
            rel="noopener noreferrer"
            style={s.link}
          >
            Report it on GitHub
          </a>{" "}
          or email{" "}
          <a href="mailto:muhd.danish9661@gmail.com" style={s.link}>
            PR Manager / Issue Resolver
          </a>
          .{" "}
          <span style={s.divider}>·</span>{" "}
          Want to help us build it?{" "}
          <a
            href="https://github.com/OpenHW-Studio/.github/blob/main/CONTRIBUTING.md"
            target="_blank"
            rel="noopener noreferrer"
            style={s.link}
          >
            Contribute on GitHub →
          </a>
        </p>
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        style={s.closeBtn}
        title="Dismiss"
        aria-label="Dismiss beta notice"
      >
        ×
      </button>
    </div>
  );
}


// ─── Theme-aware style builder ────────────────────────────────────────────────
function getStyles(theme) {
  const isDark = theme === "dark";
  return {
    wrapper: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 99999,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      // Thicker — more breathing room
      padding: "11px 24px",
      background: isDark
        ? "linear-gradient(90deg, #0a1628 0%, #0f2040 50%, #0a1628 100%)"
        : "linear-gradient(90deg, #eff6ff 0%, #dbeafe 50%, #eff6ff 100%)",
      borderBottom: isDark
        ? "1px solid rgba(56, 189, 248, 0.22)"
        : "1px solid rgba(37, 99, 235, 0.22)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      boxShadow: isDark
        ? "0 2px 16px rgba(56, 189, 248, 0.07)"
        : "0 2px 16px rgba(37, 99, 235, 0.08)",
      transition: "background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
    },
    inner: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      flex: 1,
      flexWrap: "wrap",
      minWidth: 0,
    },
    badge: {
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      padding: "3px 11px",
      borderRadius: "99px",
      background: isDark
        ? "rgba(56, 189, 248, 0.13)"
        : "rgba(37, 99, 235, 0.1)",
      border: isDark
        ? "1px solid rgba(56, 189, 248, 0.38)"
        : "1px solid rgba(37, 99, 235, 0.35)",
      color: isDark ? "#38bdf8" : "#1d4ed8",
      fontSize: "10px",
      fontWeight: "700",
      letterSpacing: "0.09em",
      fontFamily: "'Space Grotesk', sans-serif",
      whiteSpace: "nowrap",
      flexShrink: 0,
    },
    dot: {
      width: "6px",
      height: "6px",
      borderRadius: "50%",
      background: isDark ? "#38bdf8" : "#2563eb",
      animation: "betaPulse 2s ease-in-out infinite",
      flexShrink: 0,
    },
    message: {
      fontSize: "13px",
      color: isDark ? "#94a3b8" : "#374151",
      margin: 0,
      lineHeight: 1.55,
      fontFamily: "'Inter', sans-serif",
    },
    link: {
      color: isDark ? "#38bdf8" : "#1d4ed8",
      textDecoration: "underline",
      textDecorationStyle: "dotted",
      textUnderlineOffset: "2px",
      fontWeight: "600",
      transition: "color 0.2s",
      cursor: "pointer",
    },
    divider: {
      color: isDark ? "#334155" : "#9ca3af",
      margin: "0 2px",
      userSelect: "none",
    },
    closeBtn: {
      background: "transparent",
      border: "none",
      color: isDark ? "#475569" : "#6b7280",
      fontSize: "20px",
      lineHeight: 1,
      cursor: "pointer",
      padding: "0 4px",
      flexShrink: 0,
      transition: "color 0.2s",
      fontFamily: "system-ui, sans-serif",
    },
  };
}

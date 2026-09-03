import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import ThemeToggleSlider from "./ThemeToggleSlider.jsx";

// Default fallback links (used if no links prop is passed)
const DEFAULT_LINKS = [
  { label: "Home",               path: "/" },
  { label: "Components Status",  path: "/components-status" },
  { label: "Bug Tracker",        path: "/bugs" },
  { label: "Feedback & Reviews", path: "/feedback" },
  { label: "About Us",           path: "/about" },
];

/**
 * Unified glassmorphism navbar shared across all public pages.
 *
 * Props:
 *   links   - Array of { label, path } to render as nav links.
 *             Defaults to DEFAULT_LINKS if not provided.
 *   actions - JSX to render as the right-side action area.
 *             Defaults to Log In + Launch Simulator / Dashboard.
 */
export default function PublicNavbar({ links, actions }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { isAuthenticated, user } = useAuth();

  const role = user?.role;
  const handleDashboard = () => {
    if (role === "teacher") navigate("/teacher/dashboard");
    else if (role === "student") navigate("/student/dashboard");
    else navigate("/user/dashboard");
  };

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const navLinks = links ?? DEFAULT_LINKS;

  const defaultActions = isAuthenticated ? (
    <button className="btn btn-primary public-navbar__cta" onClick={handleDashboard}>
      Dashboard →
    </button>
  ) : (
    <>
      <button className="public-navbar__link" onClick={() => navigate("/login")}>
        Log In
      </button>
      <button className="btn btn-primary public-navbar__cta" onClick={() => navigate("/simulator")}>
        Launch Simulator →
      </button>
    </>
  );

  return (
    <>
      <nav className="public-navbar">
        {/* Brand */}
        <div
          className="public-navbar__brand"
          onClick={() => navigate("/")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && navigate("/")}
        >
          <img
            src="/logo-Photoroom.png"
            alt="OpenHW-Studio"
            className="public-navbar__logo"
          />
          <div className="public-navbar__brand-text">
            <div className="public-navbar__brand-name">OpenHW-Studio</div>
            <div className="public-navbar__brand-sub">By FOSSEE, IIT Bombay</div>
          </div>
        </div>

        {/* Links + Actions — all on the right */}
        <div className="public-navbar__right">
          <div className="public-navbar__links">
            {navLinks.map((link) => (
              <button
                key={link.path}
                className={`public-navbar__link ${isActive(link.path) ? "public-navbar__link--active" : ""}`}
                onClick={() => navigate(link.path)}
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="public-navbar__actions">
            {actions ?? defaultActions}

            {/* Divider + Theme toggle — always shown */}
            <span className="public-navbar__divider-wrap">
              <span className="public-navbar__divider" />
              <ThemeToggleSlider size="md" />
            </span>
          </div>
        </div>
      </nav>

      {/* Spacer so page content doesn't hide under the fixed bar */}
      <div className="public-navbar__spacer" aria-hidden="true" />

      <style>{PUBLIC_NAV_CSS}</style>
    </>
  );
}

const PUBLIC_NAV_CSS = `
  .public-navbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9000;
    display: flex;
    align-items: center;
    padding: 0 40px;
    height: 70px;
    background: rgba(7, 11, 20, 0.82);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 2px 32px rgba(0, 0, 0, 0.22);
  }

  /* Spacer that pushes page content below the fixed bar */
  .public-navbar__spacer {
    height: 70px;
    flex-shrink: 0;
    width: 100%;
    display: block;
  }

  /* Light mode override */
  [data-theme="light"] .public-navbar,
  .light-mode .public-navbar {
    background: rgba(248, 250, 252, 0.88);
    border-bottom: 1px solid rgba(203, 213, 225, 0.75);
    box-shadow: 0 2px 24px rgba(0, 0, 0, 0.07);
  }

  /* ── Brand ─────────────────────────────────────────────────────── */
  .public-navbar__brand {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    flex-shrink: 0;
    user-select: none;
    outline: none;
  }
  .public-navbar__brand:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
    border-radius: 6px;
  }

  .public-navbar__logo {
    width: 50px;
    height: auto;
    object-fit: contain;
    display: block;
    flex-shrink: 0;
  }

  .public-navbar__brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1;
  }
  .public-navbar__brand-name {
    font-size: 15px;
    font-weight: 800;
    color: var(--text);
    font-family: 'Space Grotesk', 'Inter', system-ui, sans-serif;
    letter-spacing: -0.01em;
  }
  .public-navbar__brand-sub {
    font-size: 10.5px;
    color: var(--text2);
    font-weight: 500;
    margin-top: 2px;
    letter-spacing: 0.01em;
  }

  /* ── Right-side container (links + actions grouped together) ────── */
  .public-navbar__right {
    display: flex;
    align-items: center;
    gap: 0;
    margin-left: auto;
  }

  /* ── Nav Links ──────────────────────────────────────────────────── */
  .public-navbar__links {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .public-navbar__link {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 8px 14px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid transparent;
    color: var(--text2);
    font-size: 14.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.18s ease;
    font-family: 'Inter', system-ui, sans-serif;
    white-space: nowrap;
    letter-spacing: 0.005em;
    line-height: 1.2;
  }

  .public-navbar__link:hover {
    color: var(--text);
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.08);
  }

  [data-theme="light"] .public-navbar__link:hover,
  .light-mode .public-navbar__link:hover {
    background: rgba(0, 0, 0, 0.05);
    border-color: rgba(0, 0, 0, 0.07);
  }

  .public-navbar__link--active {
    color: var(--accent, #00d4ff);
    background: rgba(0, 212, 255, 0.08);
    border-color: rgba(0, 212, 255, 0.22);
  }

  [data-theme="light"] .public-navbar__link--active,
  .light-mode .public-navbar__link--active {
    background: rgba(14, 165, 233, 0.09);
    border-color: rgba(14, 165, 233, 0.3);
    color: #0ea5e9;
  }

  /* ── Right Actions ──────────────────────────────────────────────── */
  .public-navbar__actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    margin-left: 16px;
    padding-left: 16px;
    border-left: 1px solid rgba(255, 255, 255, 0.09);
  }

  [data-theme="light"] .public-navbar__actions,
  .light-mode .public-navbar__actions {
    border-left-color: rgba(0, 0, 0, 0.1);
  }

  .public-navbar__cta {
    white-space: nowrap;
  }

  .public-navbar__divider-wrap {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-left: 2px;
  }

  .public-navbar__divider {
    display: inline-block;
    width: 1px;
    height: 20px;
    background: rgba(255, 255, 255, 0.15);
    flex-shrink: 0;
  }

  [data-theme="light"] .public-navbar__divider,
  .light-mode .public-navbar__divider {
    background: rgba(0, 0, 0, 0.15);
  }

  /* ── Scoped button overrides — identical on every page ──────────── */
  /* Ensures page-level CSS (font family, colors) cannot affect navbar buttons */

  .public-navbar .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    border-radius: 8px;
    font-size: 14.5px;
    font-weight: 600;
    font-family: 'Inter', system-ui, sans-serif;
    cursor: pointer;
    white-space: nowrap;
    text-decoration: none;
    transition: all 0.2s ease;
    line-height: 1.2;
  }

  /* Primary CTA: solid accent colour */
  .public-navbar .btn-primary {
    background: var(--accent, #00d4ff);
    color: #04070d;
    border: 1px solid transparent;
  }
  .public-navbar .btn-primary:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
    box-shadow: 0 0 18px rgba(0, 212, 255, 0.35);
  }

  /* Ghost: frosted-glass style (matching About Us .about-top-btn) */
  .public-navbar .btn-ghost {
    background: rgba(255, 255, 255, 0.06);
    color: #d5dae6;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }
  .public-navbar .btn-ghost:hover {
    background: rgba(255, 255, 255, 0.13);
    color: #fff;
    border-color: rgba(255, 255, 255, 0.24);
  }

  /* Light mode overrides for ghost */
  [data-theme="light"] .public-navbar .btn-ghost,
  .light-mode .public-navbar .btn-ghost {
    background: rgba(0, 0, 0, 0.04);
    color: #374151;
    border: 1px solid rgba(0, 0, 0, 0.12);
  }
  [data-theme="light"] .public-navbar .btn-ghost:hover,
  .light-mode .public-navbar .btn-ghost:hover {
    background: rgba(0, 0, 0, 0.09);
    color: #111827;
    border-color: rgba(0, 0, 0, 0.2);
  }

  /* Light mode primary */
  [data-theme="light"] .public-navbar .btn-primary,
  .light-mode .public-navbar .btn-primary {
    color: #fff;
    box-shadow: none;
  }

  /* ── Responsive ─────────────────────────────────────────────────── */
  @media (max-width: 1100px) {
    .public-navbar {
      padding: 0 24px;
    }
    .public-navbar__link {
      padding: 6px 10px;
      font-size: 12.5px;
    }
  }

  @media (max-width: 860px) {
    .public-navbar__links {
      display: none;
    }
  }
`;

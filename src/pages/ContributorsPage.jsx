import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Github, ExternalLink } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import fosseeLogoImg from "../assets/about/fossee-logo.jpeg";

const DOCS_URL =
  import.meta.env.VITE_DOCS_URL || "https://openhw-studio.fossee.in/docs/";

const CONTRIBUTORS = [
  { name: "Md. Danish", initials: "MD", handle: "/danish9661", url: "https://github.com/danish9661" },
  { name: "B Naga Krishna Manohar", initials: "BN", handle: "/KrishnaManohar101", url: "https://github.com/KrishnaManohar101" },
  { name: "Satvik Sharma", initials: "SS", handle: "/Satvik-Sharma511", url: "https://github.com/Satvik-Sharma511" },
  { name: "Sagar Seth", initials: "SS", handle: "/lightning-sagar", url: "https://github.com/lightning-sagar" },
  { name: "Viraj Shah", initials: "VS", handle: "/virajsh4h", url: "https://github.com/virajsh4h" },
  { name: "Aaditya Pranav", initials: "AP", handle: "/aadityapranav989-ai", url: "https://github.com/aadityapranav989-ai" },
  { name: "Akshat Singh Tomar", initials: "AS", handle: "/akshat440", url: "https://github.com/akshat440" },
  { name: "Poojitha S K", initials: "PS", handle: "/geekypooky", url: "https://github.com/geekypooky" },
  { name: "Kartikay Goel", initials: "KG", handle: "/Kartikay-goel", url: "https://github.com/Kartikay-goel" },
  { name: "Kiran", initials: "K", handle: "/kiranpgore20117-code", url: "https://github.com/kiranpgore20117-code" },
  { name: "Manas Krishna Neigapula", initials: "MK", handle: "/manasneigapula", url: "https://github.com/manasneigapula" },
  { name: "Pratham Mittal", initials: "PM", handle: "/PrathamMittal07", url: "https://github.com/PrathamMittal07" },
  { name: "Rashmitha Rani B N", initials: "RR", handle: "/Rashmitha018", url: "https://github.com/Rashmitha018" },
  { name: "Rima", initials: "R", handle: "/rima48-bit", url: "https://github.com/rima48-bit" },
  { name: "Ritesh Jadhav", initials: "RJ", handle: "/RiteshJadhav283", url: "https://github.com/RiteshJadhav283" },
  { name: "Mohit Sharma", initials: "MS", handle: "/sharmamohit-devops", url: "https://github.com/sharmamohit-devops" },
  { name: "Sharukhh", initials: "S", handle: "/Sharukhh69", url: "https://github.com/Sharukhh69" },
  { name: "Snehal", initials: "S", handle: "/snehal-git-hub", url: "https://github.com/snehal-git-hub" }
];

const CARD_COLORS = [
  "#2F6FED", // 1. Electric Blue
  "#8B5CF6", // 2. Vivid Purple
  "#EC4899", // 3. Hot Pink
  "#10B981", // 4. Mint Green
  "#0EA5E9", // 5. Sky Cyan
  "#F59E0B", // 6. Amber Gold
  "#1F9D63", // 7. Emerald Green
  "#B9713E", // 8. Copper Gold
  "#14B8A6", // 9. Teal
  "#6366F1", // 10. Indigo
  "#EA580C", // 11. Orange
  "#D946EF", // 12. Magenta
  "#0284C7", // 13. Deep Cyan
  "#84CC16", // 14. Lime Green
  "#E11D48", // 15. Crimson Red
  "#FF6B6B", // 16. Coral Red
  "#3B82F6", // 17. Bright Blue
  "#F43F5E"  // 18. Rose
];

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
    --line: #E2E8F0;
    --radius: 14px;
    --maxw: 1320px;
  }

  .contrib-page-root {
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

  .contrib-page-root h1, 
  .contrib-page-root h2, 
  .contrib-page-root h3, 
  .contrib-page-root h4 {
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    margin: 0;
    letter-spacing: -0.01em;
  }
  .contrib-page-root p { margin: 0; }
  .contrib-page-root a { color: inherit; text-decoration: none; }
  .contrib-page-root img { display: block; max-width: 100%; }

  .contrib-wrap { max-width: var(--maxw); margin: 0 auto; padding: 0 32px; width: 100%; position: relative; z-index: 2; }

  /* ---------- NAV ---------- */
  .contrib-nav {
    position: sticky; top: 0; z-index: 50;
    background: rgba(245, 246, 243, 0.88);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--line);
  }
  .contrib-nav-inner {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 32px;
    max-width: var(--maxw); margin: 0 auto;
  }
  .contrib-brand { display: flex; align-items: center; gap: 12px; cursor: pointer; }
  .contrib-brand-logo-img { height: 38px; width: auto; object-fit: contain; display: block; }
  .contrib-brand-text .name { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 16.5px; color: var(--ink); }
  .contrib-brand-text .sub { font-size: 11px; color: var(--ink-500); }

  .contrib-links { display: flex; align-items: center; gap: 30px; }
  .contrib-links a {
    font-size: 14.5px; font-weight: 500; color: var(--ink-700);
    position: relative; padding: 4px 0;
  }
  .contrib-links a.active { color: var(--trace-blue); }
  .contrib-links a.active::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: -3px; height: 2px;
    background: var(--trace-blue); border-radius: 2px;
  }
  .contrib-nav-cta {
    background: var(--ink); color: #fff; font-size: 14px; font-weight: 600;
    padding: 10px 20px; border-radius: 8px;
    display: inline-flex; align-items: center; gap: 8px; border: none; cursor: pointer;
    transition: background 0.2s ease;
  }
  .contrib-nav-cta:hover { background: var(--trace-blue); }

  /* ---------- HERO HEADER ---------- */
  .contrib-hero { padding: 48px 0 40px; text-align: center; }
  .contrib-back-link {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 600;
    color: var(--trace-blue); margin-bottom: 24px;
    transition: transform 0.2s ease;
  }
  .contrib-back-link:hover { transform: translateX(-3px); }

  .contrib-hero h1 {
    font-size: clamp(32px, 3.8vw, 44px); font-weight: 800; color: var(--ink);
    line-height: 1.15; margin-bottom: 14px; text-align: center;
  }
  .contrib-hero p.lede {
    font-size: 16px; color: var(--ink-500); line-height: 1.6; max-width: 680px;
    margin: 0 auto; text-align: center;
  }

  /* ---------- EXACT MATCHING 6-COLUMN GRID WITH VIDEO HOVER EFFECT ---------- */
  .contrib-grid-section { padding: 10px 0 80px; }
  .match-grid {
    display: grid; grid-template-columns: repeat(6, 1fr); gap: 20px;
  }

  .match-card {
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid var(--line); border-radius: 16px;
    padding: 24px 14px 18px; text-align: center;
    display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
    transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease, background 0.25s ease;
    cursor: pointer; position: relative; min-height: 182px;
    box-shadow: 0 2px 6px rgba(11, 18, 34, 0.02);
  }
  .match-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 16px 32px rgba(11, 18, 34, 0.09);
    border-color: var(--accent-color);
    background: #FFFFFF;
  }

  /* Initial Badge */
  .match-initial-badge {
    width: 46px; height: 46px; border-radius: 12px;
    background: #94A3B8; color: #FFFFFF;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px;
    margin-bottom: 14px; flex-shrink: 0;
    transition: background 0.25s ease, transform 0.25s ease;
  }
  .match-card:hover .match-initial-badge {
    background: var(--accent-color);
    transform: scale(1.05);
  }

  /* Contributor Name */
  .match-name {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 14px; font-weight: 700; color: var(--ink);
    line-height: 1.3; margin-bottom: 4px; text-align: center;
    min-height: 36px; display: flex; align-items: center; justify-content: center;
    transition: color 0.25s ease;
  }
  .match-card:hover .match-name {
    color: var(--accent-color);
  }

  /* Monospace Handle */
  .match-handle {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11.5px; color: #64748B; font-weight: 500;
    text-align: center; word-break: break-all; margin-bottom: 8px;
    transition: color 0.25s ease;
  }
  .match-card:hover .match-handle {
    color: var(--accent-color);
  }

  /* Profile Button - Reveals smoothly on hover as shown in the video */
  .match-profile-btn {
    opacity: 0; transform: translateY(6px); pointer-events: none;
    font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 600;
    color: var(--accent-color); border: 1px solid var(--accent-color);
    background: transparent; border-radius: 99px;
    padding: 4px 14px; display: inline-flex; align-items: center; gap: 5px;
    transition: opacity 0.25s ease, transform 0.25s ease, background 0.2s ease, color 0.2s ease;
    margin-top: 2px;
  }
  .match-card:hover .match-profile-btn {
    opacity: 1; transform: translateY(0); pointer-events: auto;
  }
  .match-profile-btn:hover {
    background: var(--accent-color); color: #FFFFFF;
  }

  /* ---------- JOIN CTA BANNER ---------- */
  .contrib-join {
    background: #FFFFFF;
    border: 1px solid var(--line); border-radius: 20px;
    padding: 48px 52px; display: flex; flex-direction: column; align-items: center; text-align: center;
    margin-top: 20px; margin-bottom: 60px; position: relative; overflow: hidden;
    box-shadow: 0 10px 30px rgba(11, 18, 34, 0.04);
  }
  .contrib-join h3 { font-size: 28px; font-weight: 700; margin-bottom: 12px; color: var(--ink); }
  .contrib-join p { color: var(--ink-500); font-size: 15.5px; line-height: 1.65; max-width: 720px; margin: 0 auto 12px; }
  .contrib-join p.bold-line { color: var(--ink); font-weight: 700; margin-bottom: 26px; }
  .contrib-join-cta {
    background: var(--trace-blue); color: #fff; font-weight: 600; font-size: 15px;
    padding: 13px 30px; border-radius: 10px; white-space: nowrap;
    display: inline-flex; align-items: center; gap: 8px; transition: background 0.2s ease, transform 0.2s ease;
    box-shadow: 0 6px 18px rgba(47, 111, 237, 0.25);
  }
  .contrib-join-cta:hover { background: #2358c4; transform: translateY(-2px); }

  /* ---------- FOOTER ---------- */
  .contrib-footer { background: var(--ink); color: #AEB8CF; margin-top: auto; padding: 56px 0 26px; }
  .contrib-foot-grid {
    display: grid; grid-template-columns: 1.4fr repeat(4, 1fr); gap: 32px;
    padding-bottom: 38px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  .contrib-foot-brand .contrib-brand-text .name { color: #fff; }
  .contrib-foot-brand .contrib-brand-text .sub { color: #7C8AA8; }
  .contrib-foot-brand p { margin-top: 16px; font-size: 13.5px; line-height: 1.6; max-width: 34ch; }
  .contrib-foot-disclaimer { margin-top: 10px; font-size: 11.5px; color: #7C8AA8; line-height: 1.5; max-width: 32ch; }
  .contrib-footer h5 {
    font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: #7C8AA8;
    letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 16px;
  }
  .contrib-footer ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 11px; }
  .contrib-footer ul a { font-size: 14px; color: #D5DAE6; transition: color 0.2s ease; }
  .contrib-footer ul a:hover { color: #fff; }
  .contrib-foot-bottom {
    display: flex; justify-content: space-between; align-items: center; padding-top: 22px;
    font-size: 13px; color: #7C8AA8; flex-wrap: wrap; gap: 12px;
  }
  .contrib-tags { display: flex; gap: 18px; font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; }
  .contrib-tags span::before { content: "● "; color: var(--trace-blue); }
  .contrib-top-btn {
    background: rgba(255, 255, 255, 0.06); color: #D5DAE6; border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px; padding: 6px 14px; font-size: 12.5px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s ease;
  }
  .contrib-top-btn:hover { background: rgba(255, 255, 255, 0.14); color: #fff; border-color: rgba(255, 255, 255, 0.25); } }

  /* ---------- RESPONSIVE ---------- */
  @media (max-width: 1200px) {
    .match-grid { grid-template-columns: repeat(4, 1fr); }
  }
  @media (max-width: 820px) {
    .match-grid { grid-template-columns: repeat(3, 1fr); }
    .contrib-links { display: none; }
  }
  @media (max-width: 580px) {
    .match-grid { grid-template-columns: repeat(2, 1fr); }
    .contrib-foot-grid { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 400px) {
    .match-grid { grid-template-columns: 1fr; }
    .contrib-foot-grid { grid-template-columns: 1fr; }
  }
`;

export default function ContributorsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuth();

  const handleDashboard = () => {
    if (role === "teacher") navigate("/teacher/dashboard");
    else if (role === "student") navigate("/student/dashboard");
    else navigate("/user/dashboard");
  };

  return (
    <div className="contrib-page-root">
      <style>{PAGE_CSS}</style>

      {/* NAV */}
      <header className="contrib-nav">
        <div className="contrib-nav-inner">
          <div className="contrib-brand" onClick={() => navigate("/")}>
            <img src="/logo-Photoroom.png" alt="OpenHW-Studio" className="contrib-brand-logo-img" />
            <div className="contrib-brand-text">
              <div className="name">OpenHW-Studio</div>
              <div className="sub">By FOSSEE, IIT Bombay</div>
            </div>
          </div>
          <nav className="contrib-links">
            <Link to="/">Home</Link>
            <Link to="/explore">Explore</Link>
            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">Learn</a>
            <Link to="/simulator">Simulate</Link>
            <Link to="/examples">Projects</Link>
            <Link to="/contributors" className="active">Community</Link>
            <Link to="/about">About Us</Link>
          </nav>
          {isAuthenticated ? (
            <button className="contrib-nav-cta" onClick={handleDashboard}>
              Dashboard →
            </button>
          ) : (
            <button className="contrib-nav-cta" onClick={() => navigate("/signup")}>
              Get Started →
            </button>
          )}
        </div>
      </header>

      {/* HERO & HEADER */}
      <main className="contrib-wrap">
        <section className="contrib-hero">
          <h1>18 Contributors. One open platform.</h1>
          <p className="lede">
            OpenHW-Studio is built by a distributed team of engineers collaborating openly under the FOSSEE program at IIT Bombay.
          </p>
        </section>

        {/* 6-COLUMN MATCHING GRID WITH VIDEO HOVER EFFECT */}
        <section className="contrib-grid-section">
          <div className="match-grid">
            {CONTRIBUTORS.map((c, index) => {
              const accent = CARD_COLORS[index % CARD_COLORS.length];
              return (
                <a 
                  key={index}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="match-card"
                  style={{ "--accent-color": accent }}
                >
                  <div className="match-initial-badge">
                    {c.initials}
                  </div>
                  <div className="match-name">{c.name}</div>
                  <div className="match-handle">{c.handle}</div>
                  <div className="match-profile-btn">
                    <ExternalLink size={10} /> PROFILE
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        {/* JOIN THE JOURNEY CTA BANNER */}
        <div className="contrib-join">
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
            className="contrib-join-cta"
          >
            Contribute Now ↗
          </a>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="contrib-footer">
        <div className="contrib-wrap">
          <div className="contrib-foot-grid">
            <div className="contrib-foot-brand">
              <div className="contrib-brand">
                <img src="/logo-Photoroom.png" alt="OpenHW-Studio Logo" className="contrib-brand-logo-img" style={{ height: "42px" }} />
                <div className="contrib-brand-text">
                  <div className="name">OpenHW-Studio</div>
                  <div className="sub">By FOSSEE, IIT Bombay</div>
                </div>
              </div>
              <p>Empowering learners and educators through open source hardware and collaboration.</p>
              <div className="contrib-foot-disclaimer">
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
          <div className="contrib-foot-bottom">
            <span>© 2026 OpenHW-Studio | FOSSEE, IIT Bombay</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

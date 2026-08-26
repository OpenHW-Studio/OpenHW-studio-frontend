import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PROJECTS } from '../services/gamification/ProjectsConfig.js';
import {
  EXAMPLES_BASE_URL,
  getDemoCircuitUrl,
  findGuidedProjectBySlug,
} from '../services/exampleLoaderService.js';

const DOCS_URL =
  import.meta.env.VITE_DOCS_URL || 'https://openhw-studio.fossee.in/docs/';

const DIFFICULTY = {
  'led-blink':          'Beginner',
  'rgb-led':            'Beginner',
  'buzzer':             'Beginner',
  'potentiometer':      'Beginner',
  'button-debounce':    'Beginner',
  'ldr':                'Intermediate',
  'servo-motor':        'Intermediate',
  'temperature-sensor': 'Intermediate',
  'led-strip':          'Advanced',
  'dc-motor':           'Intermediate',
};

const CATEGORY = {
  'led-blink':          'Output',
  'rgb-led':            'Output',
  'buzzer':             'Output',
  'potentiometer':      'Input',
  'button-debounce':    'Input',
  'ldr':                'Sensor',
  'servo-motor':        'Motor',
  'temperature-sensor': 'Sensor',
  'led-strip':          'Output',
  'dc-motor':           'Motor',
};

const ICONS = {
  'led-blink':          '💡',
  'rgb-led':            '🌈',
  'buzzer':             '🔊',
  'potentiometer':      '🎛️',
  'button-debounce':    '🔘',
  'ldr':                '☀️',
  'servo-motor':        '🦾',
  'temperature-sensor': '🌡️',
  'led-strip':          '✨',
  'dc-motor':           '⚙️',
};

const XP = {
  'led-blink':          100,
  'rgb-led':            150,
  'buzzer':             150,
  'potentiometer':      175,
  'button-debounce':    200,
  'ldr':                200,
  'servo-motor':        225,
  'temperature-sensor': 250,
  'led-strip':          300,
  'dc-motor':           225,
};

const ALL_CATEGORIES = ['All', 'Output', 'Input', 'Sensor', 'Motor'];
const ALL_DIFFICULTIES = ['All', 'Beginner', 'Intermediate', 'Advanced'];

function ExampleCard({ p }) {
  const navigate = useNavigate();
  const [imgErr, setImgErr] = useState(false);
  const [imgOk, setImgOk]   = useState(false);
  const diff = DIFFICULTY[p.slug] || 'Beginner';
  const isBeginner = diff === 'Beginner';
  const isAdvanced = diff === 'Advanced';
  const guidedProj = findGuidedProjectBySlug(p.slug);

  return (
    <div
      className="feature-card"
      style={{ cursor: 'pointer', textAlign: 'left', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      onClick={() => navigate(`/${p.slug}/guide`, { state: { guidedProject: guidedProj } })}
    >
      <div style={{
        height: 140,
        background: 'var(--bg, #0a0e1a)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}>
        {!imgErr && (
          <img
            src={getDemoCircuitUrl(p.slug, EXAMPLES_BASE_URL)}
            alt={p.title}
            onLoad={() => setImgOk(true)}
            onError={() => setImgErr(true)}
            style={{
              width: '100%', height: '100%', objectFit: 'contain',
              padding: 10, opacity: imgOk ? 1 : 0, transition: 'opacity .3s',
            }}
          />
        )}
        {!imgOk && !imgErr && (
          <span style={{ position: 'absolute', fontSize: 32, opacity: 0.15 }}>{ICONS[p.slug] || '⚡'}</span>
        )}
        {imgErr && (
          <span style={{ fontSize: 32, opacity: 0.25 }}>{ICONS[p.slug] || '🔌'}</span>
        )}
        <span style={{
          position: 'absolute', top: 8, right: 8,
          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
          color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.1)',
        }}>
          {CATEGORY[p.slug]}
        </span>
      </div>

      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div className="feature-icon" style={{ fontSize: 20, marginBottom: 6 }}>{ICONS[p.slug] || '⚡'}</div>
        <h3 style={{ marginBottom: 3, fontSize: 15 }}>{p.title}</h3>
        <p style={{ margin: '0 0 10px', fontSize: 12, opacity: 0.55, lineHeight: 1.4 }}>{p.subtitle}</p>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
            background: isBeginner ? 'rgba(34,197,94,.15)' : isAdvanced ? 'rgba(239,68,68,.15)' : 'rgba(251,191,36,.15)',
            color: isBeginner ? '#22c55e' : isAdvanced ? '#ef4444' : '#fbbf24',
            border: `1px solid ${isBeginner ? 'rgba(34,197,94,.3)' : isAdvanced ? 'rgba(239,68,68,.3)' : 'rgba(251,191,36,.3)'}`,
          }}>
            {diff}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>+{XP[p.slug] || 100} XP</span>
        </div>

        <div
          style={{ display: 'flex', gap: 8, marginTop: 'auto' }}
          onClick={e => e.stopPropagation()}
        >
          <button
            className="btn btn-outline"
            style={{ flex: 1, fontSize: 12 }}
            onClick={() => navigate(`/${p.slug}/guide`, { state: { guidedProject: guidedProj } })}
          >
            📖 Guide
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1, fontSize: 12 }}
            onClick={() => navigate(`/${p.slug}/demo`, { state: { guidedProject: guidedProj } })}
          >
            ▶ Try it
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExamplesPage() {
  const navigate = useNavigate();
  const [search, setSearch]       = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [filterDiff, setFilterDiff] = useState('All');
  const [theme, setTheme] = useState(
  () => localStorage.getItem('theme') || 'dark'
);

const toggleTheme = () => {
  const next = theme === 'dark' ? 'light' : 'dark';
  setTheme(next);
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
};


  const filtered = PROJECTS.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.title.toLowerCase().includes(q) || (p.subtitle || '').toLowerCase().includes(q);
    const matchCat  = filterCat  === 'All' || CATEGORY[p.slug]   === filterCat;
    const matchDiff = filterDiff === 'All' || DIFFICULTY[p.slug] === filterDiff;
    return matchSearch && matchCat && matchDiff;
  });

  return (
    <div className="landing">
      <nav className="nav">
        <div className="nav-brand">
          <img src="/logo-Photoroom.png" alt="OpenHW-Studio" className="brand-logo brand-logo--nav" />
        </div>
        <div className="nav-actions">
          <button className="btn btn-ghost" onClick={() => navigate('/')}>← Home</button>
          <button className="btn btn-ghost" onClick={() => navigate('/about')}>About Us</button>
          <button className="btn btn-ghost" onClick={toggleTheme} title="Toggle Dark/Light Mode">
  {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
</button>
          <button className="btn btn-primary" onClick={() => navigate('/simulator')}>▶ Try Simulator</button>
        </div>
      </nav>

      <div style={{
        textAlign: 'center',
        padding: '2rem 1.5rem 1.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div className="hero-badge" style={{ marginBottom: '0.75rem' }}>📂 {PROJECTS.length} Project Examples</div>
        <h1 className="hero-title" style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: '0.5rem' }}>
          Learn by doing. <span className="gradient-text">Pick a project.</span>
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: '1.25rem' }}>
          Pre-built circuits and guided walkthroughs — no login required.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search examples…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(0, 0, 0, 0.57)',
              borderRadius: 10,
              padding: '8px 16px',
              fontSize: 13,
              color: 'var(--text)',
              outline: 'none',
              width: 220,
              fontFamily: 'inherit',
            }}
          />

          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
            {ALL_CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setFilterCat(c)}
                className={filterCat === c ? 'btn btn-primary' : 'btn btn-ghost'}
                style={{ padding: '5px 13px', fontSize: 12, borderRadius: 99 }}
              >
                {c}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
            {ALL_DIFFICULTIES.map(d => (
              <button
                key={d}
                onClick={() => setFilterDiff(d)}
                className={filterDiff === d ? 'btn btn-primary' : 'btn btn-ghost'}
                style={{ padding: '5px 13px', fontSize: 12, borderRadius: 99 }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="features" style={{ paddingTop: '2rem' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text2)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <p>No examples match your filters.</p>
            <button
              className="btn btn-ghost"
              style={{ marginTop: 12 }}
              onClick={() => { setSearch(''); setFilterCat('All'); setFilterDiff('All'); }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="features-grid">
            {filtered.map(p => <ExampleCard key={p.slug} p={p} />)}
          </div>
        )}
      </section>

      <footer className="footer">
        <div className="footer-brand">
          <img src="/logo-Photoroom.png" alt="OpenHW-Studio" className="brand-logo brand-logo--footer" />
        </div>
        <p>Open Source Hardware Simulation &amp; Learning Platform</p>
        <div className="footer-links">
          <a href="https://github.com/OpenHW-Studio/" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">Documentation</a>
          <a href="/">Home</a>
        </div>
      </footer>
    </div>
  );
}

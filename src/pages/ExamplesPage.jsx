import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicNavbar from '../components/PublicNavbar.jsx';
import GUIDED_JSON from '../services/guidedProjects.json';
import { PROJECTS } from '../services/gamification/ProjectsConfig.js';
import {
  EXAMPLES_BASE_URL,
  getDemoCircuitUrl,
  findGuidedProjectBySlug,
} from '../services/exampleLoaderService.js';

const DOCS_URL =
  import.meta.env.VITE_DOCS_URL || 'https://openhw-studio.fossee.in/docs/';

const JSON_SLUG_TO_URL = {
  'rgb-led-blink': 'rgb-led',
};

const LEVEL_ORDER = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const LEVEL_LABELS = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

const PROJECT_ICONS = {};
for (const p of PROJECTS) {
  PROJECT_ICONS[p.slug] = p.icon || '🔌';
}

const CATEGORY_ICONS = {
  'Basic Output': '💡',
  'Basic Input + Control': '🔘',
  'Basic Analog Sensors': '☀️',
  'Basic Display + Serial': '🖥️',
  'Basic Counters': '🔢',
  'Sensor + Output Systems': '🌡️',
  'Display System': '📱',
  'Actuators and Motor Control': '⚙️',
  'Smart Systems': '🤖',
  'Wireless Communication': '📶',
  'IoT Systems': '🌐',
  'Robotics Systems': '🦾',
};

function getProjectIcon(slug, category) {
  if (PROJECT_ICONS[slug]) return PROJECT_ICONS[slug];
  if (category && CATEGORY_ICONS[category]) return CATEGORY_ICONS[category];
  return '⚡';
}

function ExampleCard({ p }) {
  const navigate = useNavigate();
  const [imgErr, setImgErr] = useState(false);
  const [imgOk, setImgOk] = useState(false);

  const diffNorm = (p.difficulty || '').toLowerCase();
  const isBeginner = diffNorm === 'beginner';
  const isAdvanced = diffNorm === 'advanced';
  const guidedProj = findGuidedProjectBySlug(p.slug);
  const icon = getProjectIcon(p.slug, p.category);

  return (
    <div
      className="feature-card"
      style={{
        cursor: 'pointer',
        textAlign: 'left',
        padding: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={() => navigate(`/${p.slug}/guide`, { state: { guidedProject: guidedProj } })}
    >
      <div
        style={{
          height: 140,
          background: 'rgba(255,255,255,0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          flexShrink: 0,
          borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))',
        }}
      >
        {!imgErr && (
          <img
            src={getDemoCircuitUrl(p.slug, EXAMPLES_BASE_URL)}
            alt={p.title}
            onLoad={() => setImgOk(true)}
            onError={() => setImgErr(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              padding: 10,
              opacity: imgOk ? 1 : 0,
              transition: 'opacity .3s',
            }}
          />
        )}
        {(!imgOk || imgErr) && (
          <span
            style={{
              position: 'absolute',
              fontSize: 36,
              opacity: imgErr ? 0.35 : 0.15,
            }}
          >
            {icon}
          </span>
        )}
        {p.category && (
          <span
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: 99,
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(4px)',
              color: 'rgba(255,255,255,0.75)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            {p.category}
          </span>
        )}
      </div>

      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ fontSize: 11, color: 'var(--text2)', opacity: 0.7 }}>{p.board}</span>
        </div>
        <h3 style={{ marginBottom: 4, fontSize: 15 }}>{p.title}</h3>
        <p style={{ margin: '0 0 12px', fontSize: 12, opacity: 0.65, lineHeight: 1.4 }}>
          {p.description}
        </p>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 5,
              background: isBeginner
                ? 'rgba(34,197,94,.15)'
                : isAdvanced
                ? 'rgba(239,68,68,.15)'
                : 'rgba(251,191,36,.15)',
              color: isBeginner ? '#22c55e' : isAdvanced ? '#ef4444' : '#fbbf24',
              border: `1px solid ${
                isBeginner
                  ? 'rgba(34,197,94,.3)'
                  : isAdvanced
                  ? 'rgba(239,68,68,.3)'
                  : 'rgba(251,191,36,.3)'
              }`,
            }}
          >
            {p.difficulty}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>+{p.xp} XP</span>
        </div>

        <div
          style={{ display: 'flex', gap: 8, marginTop: 'auto' }}
          onClick={(e) => e.stopPropagation()}
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
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [filterDiff, setFilterDiff] = useState('All');

  const allProjects = useMemo(() => {
    const list = [];
    for (const level of LEVEL_ORDER) {
      const levelData = GUIDED_JSON[level];
      if (!levelData) continue;
      const levelLabel = LEVEL_LABELS[level] || level;

      for (const [categoryName, cat] of Object.entries(levelData.categories || {})) {
        for (const p of cat.projects || []) {
          const urlSlug = JSON_SLUG_TO_URL[p.slug] || p.slug;
          list.push({
            slug: urlSlug,
            rawSlug: p.slug,
            title: p.title,
            description: p.description || '',
            board: p.board || 'Arduino Uno',
            category: categoryName,
            difficulty: levelLabel,
            xp: 100,
          });
        }
      }
    }
    return list;
  }, []);

  const categories = useMemo(() => {
    const set = new Set();
    for (const p of allProjects) {
      if (p.category) {
        if (filterDiff === 'All' || p.difficulty.toLowerCase() === filterDiff.toLowerCase()) {
          set.add(p.category);
        }
      }
    }
    return ['All', ...Array.from(set)];
  }, [allProjects, filterDiff]);

  const difficulties = ['All', 'Beginner', 'Intermediate', 'Advanced'];

  const handleDiffSelect = (d) => {
    setFilterDiff(d);
    // When switching difficulty, reset category if it does not exist in that difficulty
    if (d !== 'All' && filterCat !== 'All') {
      const existsInDiff = allProjects.some(
        (p) => p.difficulty.toLowerCase() === d.toLowerCase() && p.category === filterCat
      );
      if (!existsInDiff) {
        setFilterCat('All');
      }
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allProjects.filter((p) => {
      const matchSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.board.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);

      const matchCat = filterCat === 'All' || p.category === filterCat;
      const matchDiff =
        filterDiff === 'All' ||
        (p.difficulty || '').toLowerCase() === filterDiff.toLowerCase();

      return matchSearch && matchCat && matchDiff;
    });
  }, [allProjects, search, filterCat, filterDiff]);

  return (
    <div className="landing">
      <PublicNavbar
        links={[
          { label: '← Home', path: '/' },
          { label: 'About Us', path: '/about' },
        ]}
        actions={
          <button className="btn btn-primary" onClick={() => navigate('/simulator')}>
            ▶ Try Simulator
          </button>
        }
      />

      <div
        style={{
          textAlign: 'center',
          padding: '2rem 1.5rem 1.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="hero-badge" style={{ marginBottom: '0.75rem' }}>
          📂 {allProjects.length} Project Examples
        </div>
        <h1
          className="hero-title"
          style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: '0.5rem' }}
        >
          Learn by doing. <span className="gradient-text">Pick a project.</span>
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: '1.25rem' }}>
          Pre-built circuits and guided walkthroughs — no login required.
        </p>

        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'center',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <input
            type="text"
            placeholder="Search examples…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            {difficulties.map((d) => (
              <button
                key={d}
                onClick={() => handleDiffSelect(d)}
                className={filterDiff.toLowerCase() === d.toLowerCase() ? 'btn btn-primary' : 'btn btn-ghost'}
                style={{ padding: '5px 13px', fontSize: 12, borderRadius: 99 }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Category filters */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginTop: '1rem',
            maxWidth: 1000,
            marginInline: 'auto',
          }}
        >
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilterCat(c)}
              className={filterCat === c ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                borderRadius: 99,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {c !== 'All' && CATEGORY_ICONS[c] && <span>{CATEGORY_ICONS[c]}</span>}
              {c}
            </button>
          ))}
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
              onClick={() => {
                setSearch('');
                setFilterCat('All');
                setFilterDiff('All');
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="features-grid">
            {filtered.map((p) => (
              <ExampleCard key={p.slug} p={p} />
            ))}
          </div>
        )}
      </section>

      <footer className="footer">
        <div className="footer-brand">
          <img
            src="/logo-Photoroom.png"
            alt="OpenHW-Studio"
            className="brand-logo brand-logo--footer"
          />
        </div>
        <p>Open Source Hardware Simulation &amp; Learning Platform</p>
        <div className="footer-links">
          <a href="https://github.com/OpenHW-Studio/" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">
            Documentation
          </a>
          <a href="/">Home</a>
        </div>
      </footer>
    </div>
  );
}

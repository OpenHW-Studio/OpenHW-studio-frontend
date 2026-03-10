import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const S = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: 'Space Grotesk, sans-serif',
    padding: '48px 20px',
  },
  card: {
    maxWidth: 920,
    margin: '0 auto',
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 28,
    boxShadow: 'var(--shadow)',
  },
  header: {
    margin: '0 0 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: 32,
  },
  subtitle: {
    margin: '0 0 20px',
    color: 'var(--text2)',
    lineHeight: 1.6,
  },
  rubricBox: {
    marginBottom: 22,
    padding: 14,
    borderRadius: 10,
    background: 'var(--card2)',
    border: '1px solid var(--border2)',
  },
  rubricList: {
    margin: '8px 0 0',
    paddingLeft: 18,
    lineHeight: 1.8,
  },
  buttonRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  backButton: {
    background: 'transparent',
    color: 'var(--accent)',
    border: '1px solid var(--border2)',
    padding: '12px 16px',
    borderRadius: 10,
    fontWeight: 700,
    cursor: 'pointer',
  },
  simulatorButton: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    padding: '12px 16px',
    borderRadius: 10,
    fontWeight: 700,
    cursor: 'pointer',
  },
  themeButton: {
    background: 'transparent',
    color: 'var(--text2)',
    border: '1px solid var(--border)',
    padding: '8px 12px',
    borderRadius: 10,
    fontWeight: 600,
    cursor: 'pointer',
  },
}

function titleFromSlug(slug) {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export default function ProjectAssessmentPage() {
  const navigate = useNavigate()
  const { projectName = '' } = useParams()
  const projectTitle = useMemo(() => titleFromSlug(projectName), [projectName])
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark')

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.header}>
          <h1 style={S.title}>{projectTitle} Assessment</h1>
          <button onClick={toggleTheme} style={S.themeButton}>
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
        <p style={S.subtitle}>
          Assessment is the next phase after completing the guided demo. Use this page to define scoring rubrics,
          submission checks, and evaluation criteria.
        </p>

        <div style={S.rubricBox}>
          <strong>Suggested rubric:</strong>
          <ul style={S.rubricList}>
            <li>Circuit correctness and safe wiring</li>
            <li>Code logic and expected output behavior</li>
            <li>Documentation and explanation of approach</li>
          </ul>
        </div>

        <div style={S.buttonRow}>
          <button
            onClick={() => navigate(`/${projectName}/guide`)}
            style={S.backButton}
          >
            Back to Guide
          </button>
          <button
            onClick={() => navigate('/simulator')}
            style={S.simulatorButton}
          >
            Open Simulator
          </button>
        </div>
      </div>
    </div>
  )
}

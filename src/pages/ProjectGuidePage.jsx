import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const EXAMPLES_BASE_URL = import.meta.env.VITE_EXAMPLES_BASE_URL || 'http://localhost:5001/examples'
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
  topRow: {
    marginBottom: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  backButton: {
    background: 'transparent',
    border: '1px solid var(--border2)',
    color: 'var(--accent)',
    padding: '8px 12px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  themeButton: {
    background: 'transparent',
    color: 'var(--text2)',
    border: '1px solid var(--border)',
    padding: '8px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
  },
  title: {
    margin: '0 0 8px',
    fontSize: 34,
  },
  boardText: {
    margin: '0 0 6px',
    color: 'var(--accent)',
    fontWeight: 600,
  },
  description: {
    margin: '0 0 24px',
    color: 'var(--text2)',
    lineHeight: 1.6,
  },
  sectionTitle: {
    margin: '0 0 10px',
    fontSize: 22,
  },
  objectiveList: {
    margin: '0 0 28px',
    paddingLeft: 20,
    lineHeight: 1.8,
  },
  buttonRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  demoButton: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    padding: '12px 16px',
    borderRadius: 10,
    fontWeight: 700,
    cursor: 'pointer',
  },
  assessmentButton: {},
}

function titleFromSlug(slug) {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export default function ProjectGuidePage() {
  const navigate = useNavigate()
  const { projectName = '' } = useParams()
  const [remoteGuide, setRemoteGuide] = useState(null)
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark')

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  useEffect(() => {
    let cancelled = false

    const loadGuide = async () => {
      try {
        const res = await fetch(`${EXAMPLES_BASE_URL}/${projectName}/guide.json`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setRemoteGuide(data)
      } catch (err) {
        console.error('Failed to load guide file', err)
      }
    }

    setRemoteGuide(null)
    if (projectName) loadGuide()
    return () => { cancelled = true }
  }, [projectName])

  const content = useMemo(() => {
    if (remoteGuide) return remoteGuide
    return {
      title: titleFromSlug(projectName),
      board: 'Arduino Uno',
      description: 'Project guide is being prepared. You can still open the demo and proceed to assessment.',
      objectives: [
        'Review required components',
        'Implement a working circuit and code',
        'Prepare for assessment submission'
      ]
    }
  }, [projectName, remoteGuide])

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.topRow}>
          <button
            onClick={() => navigate('/')}
            style={S.backButton}
          >
            ← Back to Projects
          </button>
          <button onClick={toggleTheme} style={S.themeButton}>
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>

        <h1 style={S.title}>{content.title} Guide</h1>
        <p style={S.boardText}>Board: {content.board}</p>
        <p style={S.description}>{content.description}</p>

        <h2 style={S.sectionTitle}>Project Objectives</h2>
        <ul style={S.objectiveList}>
          {content.objectives.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <div style={S.buttonRow}>
          <button
            onClick={() => navigate(`/${projectName}/demo`)}
            style={S.demoButton}
          >
            Open Demo Project
          </button>
        </div>
      </div>
    </div>
  )
}
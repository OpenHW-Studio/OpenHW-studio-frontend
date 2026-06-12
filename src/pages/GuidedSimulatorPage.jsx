import { useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useGamification } from '../context/GamificationContext'

const THEMES = {
  dark:  { bg:'#07101f', border:'rgba(255,255,255,.07)', borderAlt:'rgba(255,255,255,.1)', text:'#f0f4ff', textAlt:'#94a3b8', textMuted:'#475569' },
  light: { bg:'#f8fafc', border:'rgba(0,0,0,.1)',        borderAlt:'rgba(0,0,0,.12)',       text:'#1e293b', textAlt:'#64748b', textMuted:'#94a3b8' },
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');
  * { box-sizing:border-box; }
`

export default function GuidedSimulatorPage() {
  const navigate = useNavigate()
  const { projectName = '' } = useParams()
  const location = useLocation()
  const { xp = 0, coins = 0 } = useGamification?.() || {}

  // ── Read initial theme from the document (set by LandingPage or any other page) ──
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark')
  const colors = THEMES[theme]
  const projectColor = location.state?.projectColor || '#22c55e'

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    // Keep document in sync so every page sees the same choice
    document.documentElement.setAttribute('data-theme', next)
  }

  const simUrl = `/simulator?guided=1&mode=assessment&project=${encodeURIComponent(projectName)}`
  const projectTitle = projectName.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100dvh', overflow:'hidden', background:colors.bg, fontFamily:'Nunito,system-ui,sans-serif' }}>
      <style>{css}</style>

      {/* Top Bar */}
      <div style={{
        display:'flex', alignItems:'center', gap:10, padding:'0 12px', height:48, flexShrink:0,
        background: theme==='dark' ? 'rgba(7,10,20,.98)' : 'rgba(248,250,252,.97)',
        backdropFilter:'blur(18px)',
        borderBottom:`1px solid ${colors.border}`,
        zIndex:300,
      }}>

        <button
          onClick={() => navigate(`/${projectName}/assessment`, { state:{ projectColor } })}
          style={{
            background: theme==='dark' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)',
            border:`1px solid ${colors.borderAlt}`,
            borderRadius:7, padding:'5px 10px',
            color:colors.textAlt, cursor:'pointer',
            fontSize:11, fontWeight:800, fontFamily:'Nunito,sans-serif', flexShrink:0,
          }}
        >← Assessment</button>

        <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0 }}>
          <div style={{
            width:26, height:26, borderRadius:6,
            background:`${projectColor}20`, border:`1px solid ${projectColor}40`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:14, flexShrink:0,
          }}>🔨</div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:900, color:colors.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {projectTitle} — Simulator
            </div>
            <div style={{ fontSize:9, color:colors.textMuted, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em' }}>
              Build your circuit · Submit assessment when ready
            </div>
          </div>
        </div>

        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          <div style={{ padding:'4px 10px', borderRadius:7, background:'rgba(251,191,36,.1)', border:'1px solid rgba(251,191,36,.2)', fontSize:11, fontWeight:800, color:'#fbbf24' }}>⭐ {xp}</div>
          <div style={{ padding:'4px 10px', borderRadius:7, background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.2)', fontSize:11, fontWeight:800, color:'#f59e0b' }}>🪙 {coins}</div>
        </div>

        <button
          onClick={toggleTheme}
          style={{
            background: theme==='dark' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)',
            border:`1px solid ${colors.borderAlt}`,
            borderRadius:7, padding:'5px 10px',
            color:colors.textAlt, cursor:'pointer',
            fontSize:12, fontFamily:'Nunito,sans-serif', flexShrink:0,
          }}
        >
          {theme==='dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Full-screen Simulator */}
      <iframe
        src={simUrl}
        title={`${projectName} simulator`}
        style={{ flex:1, border:'none', display:'block' }}
        allow="cross-origin-isolated"
      />
    </div>
  )
}
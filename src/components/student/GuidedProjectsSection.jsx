import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, ChevronDown, ChevronRight, Microchip,
  Zap, Sliders, Eye, Smartphone, Layers, Cpu, Wifi,
  Terminal, BarChart3, Target, ClipboardList,
  Megaphone, Palette, Thermometer,
  ToggleLeft, Sun, Moon, Monitor, Hash, Droplet,
  Bluetooth, Tv, Home, Trash2
} from 'lucide-react'

const TrafficLight = (props) => (
  <svg
    width={props.size || 14}
    height={props.size || 14}
    viewBox="0 0 24 24"
    fill="none"
    stroke={props.color || "currentColor"}
    strokeWidth={props.strokeWidth || 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
    style={props.style}
  >
    <rect x="8" y="2" width="8" height="20" rx="4" ry="4" />
    <circle cx="12" cy="7" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="17" r="2" />
  </svg>
)
import PROJECT_DATA from '../../services/guidedProjects.json'

const LEVEL_ICONS = { BEGINNER: Terminal, INTERMEDIATE: BarChart3, ADVANCED: Target }
const CATEGORY_ICONS = { Zap, Sliders, Eye, Smartphone, Layers, Cpu, Wifi, Terminal, BarChart3, Target, Microchip }

function getProjectIcon(slug, title) {
  const s = slug ? slug.toLowerCase() : ''
  const t = title ? title.toLowerCase() : ''
  
  if (t.includes('rgb led')) return Palette
  if (t.includes('led') || s.includes('led')) return Microchip
  if (t.includes('buzzer') || t.includes('alarm') || t.includes('sound')) return Megaphone
  if (t.includes('traffic light') || s.includes('traffic')) return TrafficLight
  if (t.includes('temperature') || t.includes('thermometer') || s.includes('temp') || t.includes('dht')) return Thermometer
  if (t.includes('button') || t.includes('switch')) return ToggleLeft
  if (t.includes('potentiometer') || t.includes('brightness')) return Sliders
  if (t.includes('light') || t.includes('ldr') || t.includes('dark')) return Sun
  if (t.includes('lcd') || t.includes('display') || t.includes('screen')) return Monitor
  if (t.includes('counter')) return Hash
  if (t.includes('water') || t.includes('level') || t.includes('liquid')) return Droplet
  if (t.includes('bluetooth')) return Bluetooth
  if (t.includes('wifi') || t.includes('esp32') || t.includes('esp8266')) return Wifi
  if (t.includes('remote') || t.includes('ir') || t.includes('rf')) return Tv
  if (t.includes('robot') || t.includes('avoid') || t.includes('follow')) return Cpu
  if (t.includes('dustbin') || t.includes('trash')) return Trash2
  
  return Microchip
}

function findLevelColor(projectSlug) {
  for (const level of Object.values(PROJECT_DATA)) {
    for (const cat of Object.values(level.categories)) {
      if (cat.projects.some(p => p.slug === projectSlug)) return level.color
    }
  }
  return '#22c55e'
}

function buildDefaultCategoryState() {
  const state = {}
  Object.entries(PROJECT_DATA).forEach(([levelKey, level]) => {
    Object.keys(level.categories).forEach(catKey => {
      state[`${levelKey}-${catKey}`] = `${levelKey}-${catKey}` === 'BEGINNER-Basic Output'
    })
  })
  return state
}

export default function GuidedProjectsPanel({ isOpen, onClose }) {
  const navigate = useNavigate()
  const [expandedLevel, setExpandedLevel] = useState('BEGINNER')
  const [expandedCategories, setExpandedCategories] = useState(buildDefaultCategoryState)

  const toggleCategory = (levelKey, catKey) => {
    setExpandedCategories(prev => ({
      ...prev,
      [`${levelKey}-${catKey}`]: !prev[`${levelKey}-${catKey}`],
    }))
  }

  const handleProjectClick = (project) => {
    const levelColor = findLevelColor(project.slug)
    navigate(`/${project.slug}/demo`, { state: { guidedProject: project, levelColor } })
    onClose()
  }

  const getTotalProjects = () => {
    let total = 0
    Object.values(PROJECT_DATA).forEach(level => {
      Object.values(level.categories).forEach(cat => {
        total += cat.projects.length
      })
    })
    return total
  }

  if (!isOpen) return null

  return (
    <>
      <div
        className="guided-panel-overlay"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9997,
          background: 'rgba(15,23,42,0.2)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      <div className="guided-panel" style={{
        position: 'fixed', top: 16, right: 16, bottom: 16, zIndex: 9998,
        width: 380, maxWidth: 'calc(100vw - 32px)',
        background: '#ffffff',
        borderRadius: 16,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(15,23,42,0.12), 0 0 0 1px rgba(15,23,42,0.04)',
        animation: 'guided-panel-slide 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '20px 20px 16px',
          flexShrink: 0,
        }}>
          <ClipboardList size={22} color="#1e3a8a" strokeWidth={2.5} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 17, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
            Guided Projects
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 100,
            background: '#f1f5f9', color: '#64748b', letterSpacing: '0.01em',
          }}>
            {getTotalProjects()} exps
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none',
              borderRadius: 8, width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#94a3b8',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#475569' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '0 16px 16px',
          scrollbarWidth: 'thin', scrollbarColor: '#e2e8f0 transparent',
        }}>
          <style>{`
            .guided-projects-scroll::-webkit-scrollbar { width: 5px; }
            .guided-projects-scroll::-webkit-scrollbar-track { background: transparent; }
            .guided-projects-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
          `}</style>

          {Object.entries(PROJECT_DATA).map(([levelKey, level]) => {
            const isExpanded = expandedLevel === levelKey
            const LevelIcon = LEVEL_ICONS[levelKey]
            const categoryEntries = Object.entries(level.categories)

            if (isExpanded) {
              return (
                <div key={levelKey} style={{
                  marginBottom: 16,
                  background: '#ffffff',
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                }}>
                  {/* Level Header (when open) */}
                  <button
                    onClick={() => setExpandedLevel(null)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '16px 20px',
                      border: 'none', background: 'transparent',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <ChevronRight size={16} color="#2563eb" style={{
                      transition: 'transform 0.2s',
                      transform: 'rotate(90deg)',
                    }} />
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 800, color: '#2563eb', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      {level.label}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100,
                      background: '#eff6ff', color: '#2563eb',
                    }}>
                      {categoryEntries.length} categories
                    </span>
                  </button>

                  {/* Categories Area */}
                  <div style={{ padding: '0 16px 16px' }}>
                    {categoryEntries.map(([catKey, category]) => {
                      const catId = `${levelKey}-${catKey}`
                      const isCatExpanded = expandedCategories[catId]
                      const CatIcon = CATEGORY_ICONS[category.icon] || Microchip

                      if (isCatExpanded) {
                        return (
                          <div key={catKey} style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 12,
                            padding: '12px 14px',
                            marginBottom: 8,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.01)',
                          }}>
                            {/* Category Header (expanded) */}
                            <button
                              onClick={() => toggleCategory(levelKey, catKey)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                width: '100%', border: 'none', background: 'transparent',
                                cursor: 'pointer', textAlign: 'left', padding: 0,
                                marginBottom: 12,
                              }}
                            >
                              <CatIcon size={16} color="#2563eb" strokeWidth={2.5} />
                              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                                {catKey}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginRight: 6 }}>
                                {category.projects.length} exps
                              </span>
                              <ChevronDown size={14} color="#64748b" />
                            </button>

                            {/* Projects List */}
                            <div style={{ position: 'relative', marginLeft: 6, paddingLeft: 14 }}>
                              {/* Vertical Guide Line */}
                              <div style={{
                                position: 'absolute', left: 0, top: 4, bottom: 4, width: 2,
                                background: '#eff6ff', borderRadius: 1
                              }} />

                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {category.projects.map((project) => {
                                  const ProjectIcon = getProjectIcon(project.slug, project.title)
                                  return (
                                    <button
                                      key={project.slug}
                                      onClick={() => handleProjectClick(project)}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '8px 10px', borderRadius: 8, border: 'none',
                                        background: 'transparent', cursor: 'pointer', textAlign: 'left',
                                        width: '100%', transition: 'all 0.15s ease',
                                      }}
                                      onMouseEnter={e => {
                                        e.currentTarget.style.background = '#eff6ff'
                                        const titleSpan = e.currentTarget.querySelector('.proj-title')
                                        if (titleSpan) titleSpan.style.color = '#2563eb'
                                        const iconSvg = e.currentTarget.querySelector('.proj-icon')
                                        if (iconSvg) iconSvg.style.color = '#2563eb'
                                      }}
                                      onMouseLeave={e => {
                                        e.currentTarget.style.background = 'transparent'
                                        const titleSpan = e.currentTarget.querySelector('.proj-title')
                                        if (titleSpan) titleSpan.style.color = '#475569'
                                        const iconSvg = e.currentTarget.querySelector('.proj-icon')
                                        if (iconSvg) iconSvg.style.color = '#1e3a8a'
                                      }}
                                    >
                                      <ProjectIcon
                                        className="proj-icon"
                                        size={14}
                                        color="#1e3a8a"
                                        strokeWidth={2}
                                        style={{ transition: 'color 0.15s' }}
                                      />
                                      <span
                                        className="proj-title"
                                        style={{
                                          flex: 1, fontSize: 12.5, fontWeight: 500,
                                          color: '#475569', transition: 'color 0.15s'
                                        }}
                                      >
                                        {project.title}
                                      </span>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        )
                      } else {
                        return (
                          <div key={catKey} style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 12,
                            padding: '12px 14px',
                            marginBottom: 8,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.01)',
                          }}>
                            {/* Category Header (collapsed) */}
                            <button
                              onClick={() => toggleCategory(levelKey, catKey)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                width: '100%', border: 'none', background: 'transparent',
                                cursor: 'pointer', textAlign: 'left', padding: 0,
                              }}
                            >
                              <CatIcon size={16} color="#64748b" strokeWidth={2} />
                              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#475569' }}>
                                {catKey}
                              </span>
                              <ChevronRight size={14} color="#64748b" />
                            </button>
                          </div>
                        )
                      }
                    })}
                  </div>
                </div>
              )
            } else {
              return (
                <div key={levelKey} style={{ marginBottom: 12 }}>
                  {/* Closed Level Card */}
                  <button
                    onClick={() => setExpandedLevel(levelKey)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      width: '100%', padding: '16px 20px',
                      borderRadius: 16,
                      border: '1px solid #e0e7ff',
                      background: '#f0f4ff',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(37,99,235,0.01)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#c7d2fe'
                      e.currentTarget.style.background = '#e0e7ff'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#e0e7ff'
                      e.currentTarget.style.background = '#f0f4ff'
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: '#ffffff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                      flexShrink: 0,
                    }}>
                      <LevelIcon size={16} color="#2563eb" strokeWidth={2.5} />
                    </div>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 800, color: '#1e3a8a', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      {level.label}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100,
                      background: '#eff6ff', color: '#2563eb',
                      marginRight: 4,
                    }}>
                      {categoryEntries.length} categories
                    </span>
                    <ChevronRight size={16} color="#2563eb" />
                  </button>
                </div>
              )
            }
          })}
        </div>
      </div>

      <style>{`
        @keyframes guided-panel-slide {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .guided-panel-overlay {
          animation: guided-overlay-in 0.25s ease-out;
        }
        @keyframes guided-overlay-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  )
}

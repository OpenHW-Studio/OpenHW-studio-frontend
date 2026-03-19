import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Editor from 'react-simple-code-editor'
import Prism from 'prismjs/components/prism-core'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-markup'
import 'prismjs/themes/prism-tomorrow.css'
import JSZip from 'jszip'
import * as Babel from '@babel/standalone'
import * as EmulatorComponents from '@openhw/emulator/src/components/index.ts'

// ─── Component Registry (same as SimulatorPage) ───────────────────────────────
const COMP_REGISTRY = {}
Object.entries(EmulatorComponents).forEach(([key, module]) => {
  if (key === 'BaseComponent') return
  if (module && module.manifest) {
    const compId = module.manifest.type || module.manifest.id || key
    COMP_REGISTRY[compId] = module
  }
})
const CATALOG = []
const CATALOG_PIN_DEFS = {}
Object.values(COMP_REGISTRY).forEach(module => {
  const manifest = module.manifest
  let group = CATALOG.find(g => g.group === manifest.group)
  if (!group) { group = { group: manifest.group, items: [] }; CATALOG.push(group) }
  const { pins, group: _, ...catalogItem } = manifest
  group.items.push(catalogItem)
  if (pins) CATALOG_PIN_DEFS[manifest.type] = pins
})

// ─── Constants ────────────────────────────────────────────────────────────────
const GROUPS    = ['Sensors', 'Outputs', 'Inputs', 'Power', 'Communication', 'Logic', 'Display', 'Other']
const PIN_TYPES = ['digital', 'analog', 'power', 'nc', 'i2c', 'spi', 'uart']
const STEPS = [
  { id:1, label:'Component Details', desc:'Type, label, group and context menu flags' },
  { id:2, label:'Component Image',   desc:'Upload SVG, code SVG, or write React JSX for the visual' },
  { id:3, label:'Dimensions',        desc:'Canvas size and interactive BOUNDS rectangle' },
  { id:4, label:'Pins',              desc:'Place and define electrical pins' },
  { id:5, label:'Simulation',        desc:'Write logic.ts, validation.ts and ui.tsx' },
  { id:6, label:'Docs',              desc:'Documentation HTML page' },
  { id:7, label:'Save & Export',     desc:'Download ZIP or test in simulator' },
]

// Grid cell size — must match simulator's 24 × 24 px
const GRID = 24

// Reference component definitions for the Canvas Panel — includes inline SVGs
const REF_COMPONENTS = [
  {
    label:'LED', w:38, h:38, color:'#ff4444', desc:'wokwi-led',
    svg:`<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
  <rect x="11" y="27" width="2.5" height="11" fill="#aaa"/>
  <rect x="24.5" y="27" width="2.5" height="11" fill="#aaa"/>
  <rect x="12" y="30" width="5" height="2" fill="#777"/>
  <ellipse cx="19" cy="17" rx="11" ry="12" fill="#1a1a1a" stroke="#555" stroke-width="1.5"/>
  <ellipse cx="19" cy="17" rx="7.5" ry="8.5" fill="rgba(255,60,60,0.75)"/>
  <ellipse cx="16" cy="13" rx="3" ry="3.5" fill="rgba(255,255,255,0.22)"/>
</svg>`,
  },
  {
    label:'Resistor', w:60, h:24, color:'#c19a6b', desc:'wokwi-resistor',
    svg:`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="24" viewBox="0 0 60 24">
  <line x1="0" y1="12" x2="12" y2="12" stroke="#aaa" stroke-width="1.5"/>
  <line x1="48" y1="12" x2="60" y2="12" stroke="#aaa" stroke-width="1.5"/>
  <rect x="12" y="6" width="36" height="12" rx="3" fill="#c8a86b" stroke="#8a6a35" stroke-width="1"/>
  <line x1="20" y1="6" x2="20" y2="18" stroke="#f4a" stroke-width="1.5"/>
  <line x1="26" y1="6" x2="26" y2="18" stroke="#744" stroke-width="1.5"/>
  <line x1="32" y1="6" x2="32" y2="18" stroke="#f80" stroke-width="1.5"/>
  <line x1="38" y1="6" x2="38" y2="18" stroke="#888" stroke-width="1.5"/>
</svg>`,
  },
  {
    label:'Uno', w:182, h:128, color:'#3a86ff', desc:'wokwi-arduino-uno',
    svg:`<svg xmlns="http://www.w3.org/2000/svg" width="182" height="128" viewBox="0 0 182 128">
  <rect x="2" y="2" width="178" height="124" rx="6" fill="#0e5a8a" stroke="#0a3f62" stroke-width="1.5"/>
  <rect x="153" y="18" width="24" height="16" rx="2" fill="#666" stroke="#444" stroke-width="1"/>
  <rect x="2" y="5" width="55" height="12" rx="2" fill="#0a3f62"/>
  <rect x="2" y="111" width="50" height="12" rx="2" fill="#0a3f62"/>
  <rect x="8" y="7" width="4" height="8" rx="1" fill="#aaa"/>
  <rect x="15" y="7" width="4" height="8" rx="1" fill="#aaa"/>
  <rect x="22" y="7" width="4" height="8" rx="1" fill="#aaa"/>
  <rect x="29" y="7" width="4" height="8" rx="1" fill="#aaa"/>
  <rect x="36" y="7" width="4" height="8" rx="1" fill="#aaa"/>
  <rect x="43" y="7" width="4" height="8" rx="1" fill="#aaa"/>
  <rect x="8" y="113" width="4" height="8" rx="1" fill="#aaa"/>
  <rect x="15" y="113" width="4" height="8" rx="1" fill="#aaa"/>
  <rect x="22" y="113" width="4" height="8" rx="1" fill="#aaa"/>
  <rect x="29" y="113" width="4" height="8" rx="1" fill="#aaa"/>
  <rect x="36" y="113" width="4" height="8" rx="1" fill="#aaa"/>
  <rect x="48" y="38" width="62" height="44" rx="4" fill="#0a0a0a" stroke="#333" stroke-width="1"/>
  <text x="79" y="63" text-anchor="middle" fill="#4ade80" font-size="6" font-family="monospace">ATmega328P</text>
  <rect x="125" y="95" width="8" height="8" rx="2" fill="#000" stroke="#333" stroke-width="1"/>
  <circle cx="129" cy="58" r="4" fill="#4ade80" opacity="0.9"/>
  <circle cx="139" cy="58" r="4" fill="#ff4444" opacity="0.7"/>
  <rect x="153" y="62" width="20" height="30" rx="2" fill="#111" stroke="#333" stroke-width="1"/>
  <text x="91" y="120" text-anchor="middle" fill="#74b9ff" font-size="7" font-family="monospace" font-weight="bold">Arduino Uno</text>
</svg>`,
  },
  {
    label:'Servo', w:56, h:72, color:'#f39c12', desc:'wokwi-servo',
    svg:`<svg xmlns="http://www.w3.org/2000/svg" width="56" height="72" viewBox="0 0 56 72">
  <rect x="3" y="10" width="50" height="52" rx="5" fill="#2c2c2c" stroke="#444" stroke-width="1.5"/>
  <rect x="8" y="18" width="40" height="30" rx="3" fill="#1a1a1a"/>
  <circle cx="28" cy="33" r="10" fill="#333" stroke="#555" stroke-width="1.5"/>
  <circle cx="28" cy="33" r="5" fill="#555"/>
  <line x1="28" y1="33" x2="28" y2="24" stroke="#f39c12" stroke-width="2" stroke-linecap="round"/>
  <rect x="20" y="56" width="5" height="10" rx="1" fill="#fff"/>
  <rect x="27" y="56" width="5" height="10" rx="1" fill="#aaa"/>
  <rect x="34" y="56" width="5" height="10" rx="1" fill="#333"/>
  <rect x="0" y="26" width="6" height="5" rx="1" fill="#333"/>
  <rect x="50" y="26" width="6" height="5" rx="1" fill="#333"/>
</svg>`,
  },
]

// ─── Grid styles — same formula as SimulatorPage ──────────────────────────────
const mkGrid = (size = GRID, dark = true) => ({
  backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
  backgroundSize:  `${size}px ${size}px`,
  backgroundColor: 'var(--canvas-bg)',
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toPascalCase(s) {
  return s.replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
          .replace(/^[a-z]/, c => c.toUpperCase())
          .replace(/[^a-zA-Z0-9]/g, '') || 'MyComponent'
}

function normalizeSvg(svg, w, h) {
  if (!svg) return svg
  // Preserve or derive viewBox so the SVG scales properly
  const vbMatch = svg.match(/\bviewBox="([^"]+)"/)
  let viewBox = vbMatch ? vbMatch[1] : null
  if (!viewBox) {
    // Derive from existing width/height attrs on the <svg> tag, fall back to component dims
    const wm = svg.match(/<svg\b[^>]*?\bwidth="([\d.]+)"/)
    const hm = svg.match(/<svg\b[^>]*?\bheight="([\d.]+)"/)
    const vw = wm ? parseFloat(wm[1]) : w
    const vh = hm ? parseFloat(hm[1]) : h
    viewBox = `0 0 ${vw || w} ${vh || h}`
  }
  return svg.replace(
    /(<svg\b[^>]*?)(\s+viewBox="[^"]*")?(\s+width="[^"]*")?(\s+height="[^"]*")?(\s*\/?>)/,
    (_, pre, _vb, _w, _h, close) => {
      const stripped = pre
        .replace(/\s+viewBox="[^"]*"/gi, '')
        .replace(/\s+width="[^"]*"/gi, '')
        .replace(/\s+height="[^"]*"/gi, '')
      return `${stripped} viewBox="${viewBox}" width="${w}" height="${h}"${close}`
    }
  )
}

// Make an SVG responsive by replacing fixed width/height with 100% while preserving
// the original viewBox so the content scales correctly inside any container.
function svgToFluid(svg) {
  if (!svg) return svg
  // Extract existing viewBox or derive one from the width/height attributes
  const vbMatch = svg.match(/\bviewBox="([^"]+)"/)
  let viewBox = vbMatch ? vbMatch[1] : null
  if (!viewBox) {
    const wm = svg.match(/<svg\b[^>]*?\bwidth="([\d.]+)"/)
    const hm = svg.match(/<svg\b[^>]*?\bheight="([\d.]+)"/)
    const vw = wm ? parseFloat(wm[1]) : 100
    const vh = hm ? parseFloat(hm[1]) : 80
    viewBox = `0 0 ${vw} ${vh}`
  }
  return svg.replace(
    /<svg(\b[^>]*?)>/,
    (_, attrs) => {
      const cleaned = attrs
        .replace(/\s+viewBox="[^"]*"/gi, '')
        .replace(/\s+width="[^"]*"/gi, '')
        .replace(/\s+height="[^"]*"/gi, '')
      return `<svg${cleaned} viewBox="${viewBox}" width="100%" height="100%">`
    }
  )
}

// ─── Code generators ──────────────────────────────────────────────────────────
function genManifest(d) {
  return JSON.stringify({
    type: d.type || 'my-component', label: d.label || 'My Component', group: d.group || 'Other',
    w: Number(d.w)||100, h: Number(d.h)||80,
    ...(d.description ? { description: d.description } : {}),
    pins: (d.pins||[]).map(({ id,x,y,type,description }) => ({ id,x,y,type,...(description?{description}:{}) })),
    ...(d.contextMenuDuringRun    ? { contextMenuDuringRun:    true } : {}),
    ...(d.contextMenuOnlyDuringRun? { contextMenuOnlyDuringRun: true } : {}),
  }, null, 2)
}

function genUICode(d) {
  const name = toPascalCase(d.type), w = Number(d.w)||100, h = Number(d.h)||80
  const b = d.bounds || { x:5, y:5, w:w-10, h:h-10 }
  const boundsLine = `export const BOUNDS = { x: ${b.x}, y: ${b.y}, w: ${b.w}, h: ${b.h} };\n`
  const ctxLines = (d.contextMenuDuringRun?'export const contextMenuDuringRun = true;\n':'') + (d.contextMenuOnlyDuringRun?'export const contextMenuOnlyDuringRun = true;\n':'')

  // React JSX mode — embed the user's exported component directly
  if (d.imageMode === 'react' && d.reactCode?.trim()) {
    return `import React from 'react';\n\n${boundsLine}${ctxLines}\n// ── Component UI (React mode) ──────────────────────────────────────\n${d.reactCode}\n`
  }

  // SVG mode — wrap SVG in a div.
  // svgToFluid converts fixed width/height to 100%/100% so the SVG always fills
  // its container (the comp.w × comp.h div in the simulator) without overflowing.
  const rawSvg = d.svgCode || `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="2" width="${w-4}" height="${h-4}" rx="6" fill="#1e1e2e" stroke="#4ade80" strokeWidth="2"/>
  <text x="${w/2}" y="${h/2+4}" textAnchor="middle" fill="#4ade80" fontSize="11" fontFamily="monospace">${d.label||'Component'}</text>
</svg>`
  const svg = svgToFluid(rawSvg).split('\n').join('\n            ')
  return `import React from 'react';\n\n${boundsLine}${ctxLines}\nexport const ${name}UI = ({ state, attrs, isRunning }: { state:any; attrs:any; isRunning:boolean }) => (\n    <div style={{ pointerEvents:'none', position:'absolute', inset:0 }}>\n        ${svg}\n    </div>\n);\n`
}

function genLogicCode(d) {
  const name = toPascalCase(d.type)
  return `import { BaseComponent } from '../../BaseComponent';\n\nexport class ${name}Logic extends BaseComponent {\n    private state: any = {};\n    reset() { this.state = {}; }\n    getSyncState() { return this.state; }\n    update(cpuCycles: number, wires: any[], allInstances: any[]) {\n        // this.getPinVoltage('VCC')  /  this.setPinVoltage('OUT', 5)\n    }\n    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {}\n}\n`
}

function genValidationCode(d) {
  return `// Return { pass: true } for OK,  { pass: false, message: '...' } for an error.\nexport const validation = [\n    // {\n    //   id: '${d.type||'my-component'}-vcc',\n    //   description: 'VCC must be connected',\n    //   check: (component, wires) => {\n    //     const pin = component.manifest?.pins?.find(p => p.id === 'VCC');\n    //     if (!pin) return { pass: true };\n    //     const ok = wires.some(\n    //       w => (w.from?.id === component.id && w.from?.pin === pin.id)\n    //         || (w.to?.id   === component.id && w.to?.pin   === pin.id)\n    //     );\n    //     return { pass: ok, message: ok ? undefined : '${d.label||'Component'}: VCC not connected.' };\n    //   },\n    // },\n];\n`
}

function genIndexCode(d) {
  const name = toPascalCase(d.type)
  const extras = [d.contextMenuDuringRun&&'contextMenuDuringRun', d.contextMenuOnlyDuringRun&&'contextMenuOnlyDuringRun'].filter(Boolean)
  return `import manifest from './manifest.json';\nimport { ${name}UI, BOUNDS${extras.length?', '+extras.join(', '):''} } from './ui';\nimport { ${name}Logic } from './logic';\nimport { validation } from './validation';\n\nexport default {\n    manifest,\n    UI: ${name}UI,\n    LogicClass: ${name}Logic,\n    BOUNDS,\n    validation,${extras.map(e=>`\n    ${e},`).join('')}\n};\n`
}

function genDocsHTML(d) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>${d.label||'Component'}</title><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;background:#0f0f0f;color:#e0e0e0;line-height:1.6}h1{color:#4ade80}h2{color:#86efac;border-bottom:1px solid #333;padding-bottom:8px}code{background:#1e1e2e;padding:2px 6px;border-radius:4px;font-family:monospace}pre{background:#1e1e2e;padding:16px;border-radius:8px}table{width:100%;border-collapse:collapse}td,th{padding:8px 12px;border:1px solid #333}th{background:#1e1e2e;color:#4ade80}</style></head><body><h1>${d.label||'Component'}</h1><p>${d.description||''}</p><h2>Pinout</h2><table><tr><th>Pin</th><th>Type</th><th>Description</th></tr>${(d.pins||[]).map(p=>`<tr><td><code>${p.id}</code></td><td>${p.type}</td><td>${p.description||''}</td></tr>`).join('')}</table><h2>Usage</h2><pre><code>// TODO</code></pre><h2>Notes</h2><ul><li>Size: ${d.w}×${d.h} px</li><li>Pins: ${(d.pins||[]).length}</li></ul></body></html>`
}

// ─────────────────────────────────────────────────────────────────────────────
//  DragResizeBox
// ─────────────────────────────────────────────────────────────────────────────
const HDefs = [
  { id:'nw', pos:{ top:-5, left:-5,  cursor:'nw-resize' } },
  { id:'n',  pos:{ top:-5, left:'50%', transform:'translateX(-50%)', cursor:'n-resize' } },
  { id:'ne', pos:{ top:-5, right:-5, cursor:'ne-resize' } },
  { id:'e',  pos:{ top:'50%', right:-5, transform:'translateY(-50%)', cursor:'e-resize' } },
  { id:'se', pos:{ bottom:-5, right:-5, cursor:'se-resize' } },
  { id:'s',  pos:{ bottom:-5, left:'50%', transform:'translateX(-50%)', cursor:'s-resize' } },
  { id:'sw', pos:{ bottom:-5, left:-5, cursor:'sw-resize' } },
  { id:'w',  pos:{ top:'50%', left:-5, transform:'translateY(-50%)', cursor:'w-resize' } },
]

function DragResizeBox({ bx=0, by=0, bw=100, bh=100, scale=1, color='#4ade80', label, onChange, onEnd, noMove=false, onlyEdges=false, snap=0 }) {
  const startDrag = useCallback((e, handle) => {
    e.stopPropagation(); e.preventDefault()
    const ox = e.clientX, oy = e.clientY, sv = { x:bx, y:by, w:bw, h:bh }
    const move = (me) => {
      const dx = (me.clientX-ox)/scale, dy = (me.clientY-oy)/scale
      let { x,y,w,h } = sv
      if (handle==='move')       { x+=dx; y+=dy }
      if (handle.includes('w'))  { x+=dx; w=Math.max(snap||10,w-dx) }
      if (handle.includes('e'))  { w=Math.max(snap||10,w+dx) }
      if (handle.includes('n'))  { y+=dy; h=Math.max(snap||10,h-dy) }
      if (handle.includes('s'))  { h=Math.max(snap||10,h+dy) }
      if (snap > 1) {
        x = Math.round(x / snap) * snap
        y = Math.round(y / snap) * snap
        w = Math.max(snap, Math.round(w / snap) * snap)
        h = Math.max(snap, Math.round(h / snap) * snap)
      } else {
        x = Math.round(x); y = Math.round(y)
        w = Math.round(w); h = Math.round(h)
      }
      onChange({ x, y, w, h })
    }
    const up = () => { onEnd?.(); document.removeEventListener('pointermove',move); document.removeEventListener('pointerup',up) }
    document.addEventListener('pointermove',move); document.addEventListener('pointerup',up)
  }, [bx,by,bw,bh,scale,onChange,onEnd,snap])

  const handles = onlyEdges ? HDefs.filter(h=>['se','s','e'].includes(h.id)) : HDefs
  return (
    <div style={{ position:'absolute', left:bx*scale, top:by*scale, width:bw*scale, height:bh*scale, border:`2px solid ${color}`, background:`${color}0d`, zIndex:15, boxSizing:'border-box', pointerEvents:'all' }}>
      {label && <div style={{ position:'absolute', top:-17, left:0, fontSize:9, fontWeight:700, color, background:'var(--bg)', padding:'1px 4px', borderRadius:3, whiteSpace:'nowrap' }}>{label}</div>}
      {!noMove && <div onPointerDown={e=>startDrag(e,'move')} style={{ position:'absolute', inset:8, cursor:'move', zIndex:16 }} />}
      {handles.map(h=>(
        <div key={h.id} onPointerDown={e=>startDrag(e,h.id)}
          style={{ position:'absolute', width:10, height:10, background:color, border:'2px solid rgba(0,0,0,.5)', borderRadius:2, zIndex:17, ...h.pos }} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  SvgPreview — mirrors simulator rendering exactly:
//  outer div is w*zoom × h*zoom, inner is w×h (CSS scaled), SVG is fluid
//  (width/height=100%) inside a position:absolute inset:0 wrapper — same as
//  the <div style={{ pointerEvents:'none', position:'absolute', inset:0 }}><svg>
//  pattern that genUICode generates for the simulator.
// ─────────────────────────────────────────────────────────────────────────────
function SvgPreview({ svgCode, compW, compH, zoom=1, style }) {
  const w = Number(compW)||100, h = Number(compH)||80
  const fluid = useMemo(()=>svgToFluid(svgCode),[svgCode])
  return (
    <div style={{ position:'relative', width:w*zoom, height:h*zoom, flexShrink:0, overflow:'hidden', ...style }}>
      {fluid
        ? <div style={{ position:'absolute', top:0, left:0, width:w, height:h, transform:`scale(${zoom})`, transformOrigin:'top left', pointerEvents:'none' }}>
            <div style={{ position:'absolute', inset:0 }}
              dangerouslySetInnerHTML={{ __html: fluid }} />
          </div>
        : <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#1e1e2e', border:'1px dashed #333', borderRadius:4 }}>
            <span style={{ color:'#555', fontSize:11 }}>{w}×{h}</span>
          </div>
      }
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  ReactPreview — compiles JSX code with Babel and renders it
// ─────────────────────────────────────────────────────────────────────────────
function ReactPreview({ reactCode, compW, compH, zoom=1, style }) {
  const w = Number(compW)||100, h = Number(compH)||80
  const [el, setEl]   = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!reactCode?.trim()) { setEl(null); setErr(null); return }
    try {
      const transformed = Babel.transform(reactCode, { filename:'ui.tsx', presets: ['react', 'typescript', 'env'] }).code
      const mod = { exports: {} }
      // Find something exported that looks like a component
      // eslint-disable-next-line no-new-func
      const evalFn = new Function('exports', 'require', 'React', transformed)
      evalFn(mod.exports, (m) => m === 'react' ? React : null, React)
      const keys = Object.keys(mod.exports)
      const compKey = keys.find(k => /ui|component|view|preview/i.test(k)) || keys[0]
      const Comp = mod.exports[compKey]
      if (typeof Comp !== 'function' && typeof Comp !== 'object') throw new Error('No exported React component found. Export a component from your code.')
      setEl(React.createElement(Comp, { state:{}, attrs:{}, isRunning:false }))
      setErr(null)
    } catch (e) {
      setErr(e.message)
      setEl(null)
    }
  }, [reactCode])

  return (
    <div style={{ position:'relative', width:w*zoom, height:h*zoom, flexShrink:0, overflow:'hidden', ...style }}>
      {err
        ? <div style={{ position:'absolute', inset:0, background:'rgba(255,68,68,.08)', border:'1px solid rgba(255,68,68,.35)', padding:'6px 8px', fontSize:10, color:'#ff6b6b', overflow:'auto', fontFamily:'monospace', borderRadius:4, lineHeight:1.5 }}>
            <strong>Compile error:</strong><br/>{err}
          </div>
        : el
          ? <div style={{ position:'absolute', top:0, left:0, width:w, height:h, transform:`scale(${zoom})`, transformOrigin:'top left', pointerEvents:'none' }}>{el}</div>
          : <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#1e1e2e', border:'1px dashed #333', borderRadius:4 }}>
              <span style={{ color:'#555', fontSize:11 }}>No component</span>
            </div>
      }
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  SimPin — simulator-accurate pin (5×5 square, hover tooltip)
// ─────────────────────────────────────────────────────────────────────────────
function SimPin({ pin, zoom, onClick, selected }) {
  const [hovered, setHov] = useState(false)
  const color  = hovered || selected ? '#f1c40f' : 'rgba(255,255,255,0.25)'
  const border = hovered || selected ? '#fff'    : 'rgba(255,255,255,0.8)'
  return (
    <div style={{ position:'absolute', left:pin.x*zoom, top:pin.y*zoom, zIndex: hovered?30:20 }}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={e=>{e.stopPropagation();onClick?.()}}>
      <div style={{
        width:5, height:5, background:color, border:`1px solid ${border}`, borderRadius:'0%',
        cursor:'crosshair', transform:`translate(-50%,-50%)${hovered?' scale(1.5)':''}`, transition:'0.15s',
      }} />
      {hovered && (
        <div style={{ position:'absolute', bottom:12, left:'50%', transform:'translateX(-50%)', background:'#111', color:'#fff', padding:'3px 7px', borderRadius:4, fontSize:10, whiteSpace:'nowrap', zIndex:9999, pointerEvents:'none', border:'1px solid #444', boxShadow:'0 2px 5px rgba(0,0,0,.5)' }}>
          {pin.description||pin.id}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  CanvasPanel — simulator-accurate canvas preview (same engine as SimulatorPage)
// ─────────────────────────────────────────────────────────────────────────────
const USER_COMP_ID = '__user_comp__'

function CanvasPanel({ open, onToggle, svgCode, reactCode, imageMode, compW, compH, bounds, pins, ctxDuringRun, ctxOnlyDuringRun, compType, compLabel }) {
  const w = Number(compW)||100, h = Number(compH)||80

  // ── Evaluate React code into a component (same approach as SimulatorPage) ──
  const [evalComp, setEvalComp] = useState(null)
  const [evalCtxMenu, setEvalCtxMenu] = useState(null)
  const [evalErr, setEvalErr]   = useState(null)
  const [userAttrs, setUserAttrs] = useState({})
  useEffect(() => {
    if (imageMode !== 'react' || !reactCode?.trim()) { setEvalComp(null); setEvalCtxMenu(null); setEvalErr(null); return }
    try {
      const transformed = Babel.transform(reactCode, { filename:'ui.tsx', presets: ['react', 'typescript', 'env'] }).code
      const exportsUI = {}
      const evalFn = new Function('exports', 'require', 'React', transformed)
      evalFn(exportsUI, (m) => m === 'react' ? React : null, React)
      // Match SimulatorPage: pick UI component (key ending with 'ui' or first function)
      const uiKey = Object.keys(exportsUI).find(k => typeof exportsUI[k] === 'function' && k.toLowerCase().endsWith('ui'))
        || Object.keys(exportsUI).find(k => typeof exportsUI[k] === 'function')
        || Object.keys(exportsUI)[0]
      const Comp = exportsUI[uiKey]
      if (typeof Comp !== 'function') throw new Error('No exported React component found.')
      setEvalComp(() => Comp)
      // Match SimulatorPage: pick ContextMenu component
      const ctxKey = Object.keys(exportsUI).find(k => k.toLowerCase().includes('contextmenu'))
      setEvalCtxMenu(ctxKey && typeof exportsUI[ctxKey] === 'function' ? () => exportsUI[ctxKey] : null)
      setUserAttrs({})
      setEvalErr(null)
    } catch (e) {
      setEvalComp(null)
      setEvalCtxMenu(null)
      setEvalErr(e.message)
    }
  }, [reactCode, imageMode])

  // ── Fluid SVG for SVG mode (same approach as SimulatorPage) ────────────────
  const fluidSvg = useMemo(() => imageMode !== 'react' ? svgToFluid(svgCode) : null, [svgCode, imageMode])

  // ── Canvas state (same as SimulatorPage) ────────────────────────────────────
  const canvasRef       = useRef(null)
  const [canvasOffset, setCanvasOffset] = useState({ x:80, y:80 })
  const [canvasZoom,   setCanvasZoom]   = useState(1)
  const canvasOffsetRef = useRef({ x:80, y:80 })
  const canvasZoomRef   = useRef(1)
  const isPanningRef    = useRef(false)
  const panStartRef     = useRef({ x:0, y:0, ox:0, oy:0 })
  const didPanRef       = useRef(false)
  const movingCompRef   = useRef(null)

  // ── UI state ────────────────────────────────────────────────────────────────
  const [isRunning,   setRunning]    = useState(false)
  const [selected,    setSelected]   = useState(null)
  const [hoveredPin,  setHoveredPin] = useState(null)  // 'compId:pinId'
  const [refComps,    setRefComps]   = useState([])
  const [panelW,      setPanelW]     = useState(380)

  // ── Quick-add popup ─────────────────────────────────────────────────────────
  const [quickAdd,    setQuickAdd]    = useState(null) // { screenX, screenY, canvasX, canvasY }
  const [quickSearch, setQuickSearch] = useState('')
  const [quickIdx,    setQuickIdx]    = useState(0)
  const quickInputRef = useRef(null)

  useEffect(() => { if (quickAdd && quickInputRef.current) quickInputRef.current.focus() }, [quickAdd])
  useEffect(() => { setQuickIdx(0) }, [quickSearch])
  useEffect(() => {
    if (!quickAdd) return
    const close = (e) => { if (!e.target.closest('[data-quickadd]')) setQuickAdd(null) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [quickAdd])

  // ── Quick-add search results ────────────────────────────────────────────────
  const quickResults = useMemo(() => {
    const q = quickSearch.trim().toLowerCase()
    const all = CATALOG.flatMap(g => g.items.map(item => ({ ...item, group: g.group })))
    if (!q) return all.slice(0, 20)
    return all.filter(i => i.label?.toLowerCase().includes(q) || i.type?.toLowerCase().includes(q)).slice(0, 20)
  }, [quickSearch])

  // ── Panel resize (left edge drag) ───────────────────────────────────────────
  const startPanelResize = useCallback((e) => {
    e.preventDefault()
    const startX = e.clientX, startW = panelW
    const onMove = (me) => setPanelW(Math.max(260, Math.min(700, startW + (startX - me.clientX))))
    const onUp   = () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp) }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [panelW])

  // ── Global mouse events for panning & component dragging ────────────────────
  useEffect(() => {
    const onMove = (e) => {
      if (movingCompRef.current) {
        movingCompRef.current.moved = true
        const { id, sx, sy, cx, cy } = movingCompRef.current
        setRefComps(prev => prev.map(c => c.id === id
          ? { ...c, x: cx + (e.clientX-sx)/canvasZoomRef.current, y: cy + (e.clientY-sy)/canvasZoomRef.current }
          : c))
        return
      }
      if (isPanningRef.current) {
        const dx = e.clientX - panStartRef.current.x
        const dy = e.clientY - panStartRef.current.y
        if (!didPanRef.current && (Math.abs(dx)>3 || Math.abs(dy)>3)) didPanRef.current = true
        if (didPanRef.current) {
          const newOff = { x: panStartRef.current.ox+dx, y: panStartRef.current.oy+dy }
          setCanvasOffset(newOff)
          canvasOffsetRef.current = newOff
        }
      }
    }
    const onUp = () => { movingCompRef.current = null; isPanningRef.current = false }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',  onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [])

  // ── Get BOUNDS for any component ────────────────────────────────────────────
  const getBounds = useCallback((comp) => {
    if (comp.id === USER_COMP_ID) return bounds || { x:0, y:0, w, h }
    const reg = COMP_REGISTRY[comp.type]
    if (!reg) return { x:0, y:0, w:comp.w, h:comp.h }
    if (typeof reg.BOUNDS === 'function') return reg.BOUNDS({})
    return reg.BOUNDS || { x:0, y:0, w:comp.w, h:comp.h }
  }, [bounds, w, h])

  // ── Get pins for any component ──────────────────────────────────────────────
  const getCompPins = useCallback((comp) => {
    if (comp.id === USER_COMP_ID) return pins || []
    return CATALOG_PIN_DEFS[comp.type] || []
  }, [pins])

  // ── Render component UI ─────────────────────────────────────────────────────
  const renderUI = useCallback((comp) => {
    if (comp.id === USER_COMP_ID) {
      if (imageMode === 'react') {
        if (evalErr) return (
          <div style={{ position:'absolute', inset:0, background:'rgba(255,68,68,.08)', border:'1px solid rgba(255,68,68,.35)', padding:'6px 8px', fontSize:10, color:'#ff6b6b', overflow:'auto', fontFamily:'monospace', borderRadius:4, lineHeight:1.5 }}>
            <strong>Compile error:</strong><br/>{evalErr}
          </div>
        )
        if (evalComp) return React.createElement(evalComp, { state: userAttrs, attrs: userAttrs, isRunning })
        return (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#1e1e2e', border:'1px dashed #333', borderRadius:4 }}>
            <span style={{ color:'#555', fontSize:11 }}>No component</span>
          </div>
        )
      }
      // SVG mode — render fluid SVG directly, same as SimulatorPage
      if (fluidSvg) return (
        <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}
          dangerouslySetInnerHTML={{ __html: fluidSvg }} />
      )
      return (
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#1e1e2e', border:'1px dashed #333', borderRadius:4 }}>
          <span style={{ color:'#555', fontSize:11 }}>{w}×{h}</span>
        </div>
      )
    }
    const reg = COMP_REGISTRY[comp.type]
    if (reg?.UI) return React.createElement(reg.UI, { state:{}, attrs:{}, isRunning })
    return (
      <div style={{ width:'100%', height:'100%', background:'#333', border:'1px solid #555',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#aaa' }}>
        {comp.type}
      </div>
    )
  }, [imageMode, evalComp, evalErr, fluidSvg, w, h, isRunning, userAttrs])

  // ── Add component at canvas coordinates ─────────────────────────────────────
  const addComponent = useCallback((item, canvasX, canvasY) => {
    const x = canvasX - (item.w||60)/2
    const y = canvasY - (item.h||60)/2
    setRefComps(prev => [...prev, {
      id: `ref_${item.type}_${Date.now()}`,
      type: item.type, label: item.label,
      x: Math.max(0, x), y: Math.max(0, y),
      w: item.w||60, h: item.h||60,
    }])
    setQuickAdd(null)
  }, [])

  // ── Delete a reference component ────────────────────────────────────────────
  const deleteRefComp = useCallback((id) => {
    setRefComps(prev => prev.filter(c => c.id !== id))
    if (selected === id) setSelected(null)
  }, [selected])

  // ── Context menu visibility (same logic as SimulatorPage) ───────────────────
  const showCtxMenu = (() => {
    if (selected !== USER_COMP_ID) return false
    if (!evalCtxMenu) return false
    const hasDuringRun = ctxDuringRun || ctxOnlyDuringRun
    if (isRunning && !hasDuringRun) return false
    if (!isRunning && ctxOnlyDuringRun) return false
    return true
  })()

  // ── All components: user comp first, then reference comps ───────────────────
  const allComps = useMemo(() => {
    const userComp = {
      id: USER_COMP_ID, type: compType||'custom',
      label: compLabel||'My Component', x: 0, y: 0, w, h,
    }
    return [userComp, ...refComps]
  }, [compType, compLabel, w, h, refComps])

  // ── Canvas mousedown — start pan ────────────────────────────────────────────
  const onCanvasMD = (e) => {
    if (e.button !== 0 || movingCompRef.current) return
    e.preventDefault()
    didPanRef.current = false
    isPanningRef.current = true
    panStartRef.current = { x: e.clientX, y: e.clientY, ox: canvasOffsetRef.current.x, oy: canvasOffsetRef.current.y }
  }

  // ── Canvas click — deselect ─────────────────────────────────────────────────
  const onCanvasClick = (e) => { if (!didPanRef.current) setSelected(null) }

  // ── Double-click — open quick-add ───────────────────────────────────────────
  const onCanvasDblClick = (e) => {
    if (isRunning) return
    const tag = e.target.tagName.toLowerCase()
    if (tag === 'input' || tag === 'button') return
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const cx = (e.clientX - rect.left - canvasOffsetRef.current.x) / canvasZoomRef.current
    const cy = (e.clientY - rect.top  - canvasOffsetRef.current.y) / canvasZoomRef.current
    setQuickAdd({ screenX: e.clientX, screenY: e.clientY, canvasX: cx, canvasY: cy })
    setQuickSearch('')
    setQuickIdx(0)
  }

  // ── Component mousedown — start drag (ref comps only) ───────────────────────
  const onCompMD = (e, comp) => {
    if (comp.id === USER_COMP_ID) return
    e.stopPropagation()
    movingCompRef.current = { id: comp.id, sx: e.clientX, sy: e.clientY, cx: comp.x, cy: comp.y, moved: false }
  }

  // ── Component click — select ────────────────────────────────────────────────
  const onCompClick = (e, comp) => { e.stopPropagation(); setSelected(comp.id) }

  // ── Collapsed tab ────────────────────────────────────────────────────────────
  if (!open) {
    return (
      <div style={{ width:22, flexShrink:0, background:'var(--bg2)', borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', alignItems:'center', paddingTop:12, gap:6, cursor:'pointer' }}
        onClick={onToggle} title="Open Canvas Preview">
        <div style={{ fontSize:14, color:'var(--accent)', transform:'rotate(180deg)', userSelect:'none' }}>▶</div>
        <div style={{ writingMode:'vertical-rl', fontSize:9, fontWeight:700, color:'var(--text3)', letterSpacing:'.08em', textTransform:'uppercase', marginTop:6, userSelect:'none' }}>Canvas</div>
      </div>
    )
  }

  const gridPx = GRID * canvasZoom

  return (
    <div style={{ width:panelW, flexShrink:0, borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', background:'var(--bg2)', position:'relative', overflow:'hidden' }}>
      {/* ── Left-edge resize handle ──────────────────────────────────────── */}
      <div onPointerDown={startPanelResize}
        style={{ position:'absolute', top:0, left:0, width:5, height:'100%', cursor:'ew-resize', zIndex:20 }} />

      {/* ── Panel header ─────────────────────────────────────────────────── */}
      <div style={{ height:36, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 8px 0 12px', borderBottom:'1px solid var(--border)', gap:6, flexShrink:0 }}>
        <span style={{ fontSize:11, fontWeight:700, color:'var(--text)' }}>Canvas Preview</span>
        <div style={{ display:'flex', gap:4, alignItems:'center', marginLeft:'auto' }}>
          <PanelBtn on={isRunning} onClick={()=>setRunning(r=>!r)} title={isRunning?'Stop (context menu preview)':'Run (test context menu)'}>
            {isRunning ? '⏹' : '▶'}
          </PanelBtn>
          <PanelBtn onClick={()=>{ const z=Math.min(3,+(canvasZoom+0.25).toFixed(2)); setCanvasZoom(z); canvasZoomRef.current=z }} title="Zoom in">+</PanelBtn>
          <PanelBtn onClick={()=>{ const z=Math.max(0.1,+(canvasZoom-0.25).toFixed(2)); setCanvasZoom(z); canvasZoomRef.current=z }} title="Zoom out">−</PanelBtn>
          <PanelBtn onClick={()=>{ setCanvasZoom(1); setCanvasOffset({x:80,y:80}); canvasOffsetRef.current={x:80,y:80}; canvasZoomRef.current=1 }} title="Fit to view">⊡</PanelBtn>
          <PanelBtn onClick={onToggle} title="Collapse panel">▶</PanelBtn>
        </div>
      </div>

      {/* ── Status pill ──────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <div style={{ width:6, height:6, borderRadius:'50%', background:isRunning?'#4ade80':'#666', transition:'0.3s' }} />
        <span style={{ fontSize:10, color:isRunning?'var(--accent)':'var(--text3)' }}>
          {isRunning ? 'Running · context menu active' : 'Stopped · double-click canvas to add components'}
        </span>
        <span style={{ fontSize:10, color:'var(--text3)', marginLeft:'auto' }}>{Math.round(canvasZoom*100)}%</span>
      </div>

      {/* ── Canvas area ─────────────────────────────────────────────────── */}
      <main
        ref={canvasRef}
        style={{
          flex:1, position:'relative', overflow:'hidden',
          backgroundColor:'var(--canvas-bg)',
          backgroundImage:'linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)',
          backgroundSize:`${gridPx}px ${gridPx}px`,
          cursor: 'grab',
        }}
        onMouseDown={onCanvasMD}
        onClick={onCanvasClick}
        onDoubleClick={onCanvasDblClick}
      >
        {/* ── Zoom wrapper ─────────────────────────────────────────────── */}
        <div style={{
          position:'absolute', top:0, left:0,
          transform:`translate(${canvasOffset.x}px,${canvasOffset.y}px) scale(${canvasZoom})`,
          transformOrigin:'0 0',
        }}>
          {/* ── Context menu (user component, renders actual ContextMenu like SimulatorPage) ── */}
          {showCtxMenu && (() => {
            const b = bounds || { x:0, y:0, w, h }
            return (
              <div data-contextmenu="true" style={{
                position:'absolute',
                left: b.x + b.w / 2,
                top:  b.y - 14,
                transform:'translateX(-50%) translateY(-100%)',
                background:'var(--bg2)', border:'1px solid var(--border)',
                display:'flex', alignItems:'center', gap:8,
                padding:'6px 10px', borderRadius:10,
                boxShadow:'0 8px 24px rgba(0,0,0,0.6)', cursor:'default',
                pointerEvents:'all', whiteSpace:'nowrap', zIndex:200,
              }}
                onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}
                onDoubleClick={e=>e.stopPropagation()}>
                {React.createElement(evalCtxMenu, {
                  attrs: userAttrs,
                  onUpdate: (key, value) => setUserAttrs(prev => ({ ...prev, [key]: value }))
                })}
                <div style={{ position:'absolute', bottom:-6, left:'50%', transform:'translateX(-50%)', width:0, height:0, borderLeft:'6px solid transparent', borderRight:'6px solid transparent', borderTop:'6px solid var(--border)' }} />
                <div style={{ position:'absolute', bottom:-5, left:'50%', transform:'translateX(-50%)', width:0, height:0, borderLeft:'5px solid transparent', borderRight:'5px solid transparent', borderTop:'5px solid var(--bg2)' }} />
              </div>
            )
          })()}

          {/* ── Components ───────────────────────────────────────────── */}
          {allComps.map(comp => {
            const compPins  = getCompPins(comp)
            const b         = getBounds(comp)
            const isSelected  = selected === comp.id
            const isUserComp  = comp.id === USER_COMP_ID
            return (
              <div key={comp.id} style={{
                position:'absolute', left:comp.x, top:comp.y, width:comp.w, height:comp.h,
                pointerEvents:'none', userSelect:'none',
              }}>
                {/* Hit box — BOUNDS sized, captures click & drag */}
                <div style={{
                  position:'absolute', left:b.x, top:b.y, width:b.w, height:b.h,
                  cursor: isUserComp ? 'default' : 'move',
                  pointerEvents:'auto', zIndex:3,
                }}
                  onMouseDown={e => onCompMD(e, comp)}
                  onClick={e => onCompClick(e, comp)}
                  onDoubleClick={e => e.stopPropagation()}
                />

                {/* Selection ring — same as SimulatorPage */}
                {isSelected && (
                  <div style={{
                    position:'absolute', left:b.x-6, top:b.y-6, width:b.w+12, height:b.h+12,
                    borderRadius:8, border:'2px solid var(--accent)',
                    boxShadow:'0 0 16px var(--glow)', pointerEvents:'none', zIndex:10,
                  }} />
                )}

                {/* BOUNDS dashed overlay (user comp only) */}
                {isUserComp && (
                  <div style={{
                    position:'absolute', pointerEvents:'none',
                    left:b.x, top:b.y, width:b.w, height:b.h,
                    border:'1px dashed rgba(96,165,250,.65)',
                    background:'rgba(96,165,250,.03)', borderRadius:2, zIndex:8,
                  }} />
                )}

                {/* Delete button (reference comps when selected) */}
                {!isUserComp && isSelected && (
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); deleteRefComp(comp.id) }}
                    style={{
                      position:'absolute', left:b.x+b.w+4, top:b.y, zIndex:20,
                      width:18, height:18, borderRadius:4, border:'none',
                      background:'rgba(255,68,68,.75)', color:'#fff',
                      cursor:'pointer', fontSize:11, display:'flex',
                      alignItems:'center', justifyContent:'center', pointerEvents:'all',
                    }}>✕</button>
                )}

                {/* Component UI render */}
                <div style={{ pointerEvents:'none', position:'absolute', inset:0, zIndex:1 }}>
                  {renderUI(comp)}
                </div>

                {/* Pins — identical to SimulatorPage */}
                {compPins.map(pin => {
                  const pinKey   = `${comp.id}:${pin.id}`
                  const isHov    = hoveredPin === pinKey
                  const pinColor  = isHov ? '#f1c40f' : 'rgba(255,255,255,0.2)'
                  const pinBorder = isHov ? '#fff' : 'rgba(255,255,255,0.8)'
                  return (
                    <div key={pin.id} style={{
                      position:'absolute', left:pin.x, top:pin.y,
                      width:5, height:5,
                      background:pinColor, border:`1px solid ${pinBorder}`,
                      borderRadius:'0%', cursor:'crosshair',
                      zIndex:isHov?30:20,
                      transform:`translate(-50%,-50%)${isHov?' scale(1.5)':''}`,
                      transition:'0.2s', pointerEvents:'all',
                    }}
                      onMouseEnter={() => setHoveredPin(pinKey)}
                      onMouseLeave={() => setHoveredPin(null)}
                    >
                      {/* Pin label tooltip */}
                      {isHov && (
                        <div style={{
                          position:'absolute', bottom:18, left:'50%',
                          transform:'translateX(-50%)',
                          background:'#111', color:'#fff',
                          padding:'4px 8px', borderRadius:4,
                          fontSize:10, whiteSpace:'nowrap', zIndex:9999,
                          pointerEvents:'none', border:'1px solid #444',
                          boxShadow:'0 2px 5px rgba(0,0,0,0.5)',
                        }}>
                          {pin.description || pin.id}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Component label below BOUNDS — same as SimulatorPage */}
                <div style={{
                  position:'absolute',
                  top: b.y + b.h + 4,
                  left: b.x + b.w / 2,
                  transform:'translateX(-50%)',
                  fontSize:10, color:'var(--text3)',
                  whiteSpace:'nowrap',
                  fontFamily:'JetBrains Mono,monospace',
                  pointerEvents:'none', zIndex:12,
                }}>
                  {comp.label}
                </div>
              </div>
            )
          })}
        </div>{/* end zoom wrapper */}

        {/* ── Quick-add popup (double-click to open) ───────────────────── */}
        {quickAdd && (() => {
          const VW = window.innerWidth, VH = window.innerHeight
          const menuW = 240, approxH = Math.min(quickResults.length, 8) * 32 + 52
          const left = quickAdd.screenX + menuW > VW ? quickAdd.screenX - menuW : quickAdd.screenX + 4
          const top  = quickAdd.screenY + approxH > VH ? quickAdd.screenY - approxH : quickAdd.screenY + 4
          const selIdx = Math.max(0, Math.min(quickIdx, quickResults.length - 1))
          return (
            <div data-quickadd="true" style={{
              position:'fixed', left, top, zIndex:2000,
              background:'var(--bg2)', border:'1px solid var(--border)',
              borderRadius:10, boxShadow:'0 8px 32px rgba(0,0,0,0.55)',
              width:menuW, overflow:'hidden',
            }}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}>
              <input
                ref={quickInputRef}
                value={quickSearch}
                onChange={e => setQuickSearch(e.target.value)}
                placeholder="Search components…"
                style={{
                  width:'100%', padding:'9px 12px', border:'none',
                  borderBottom:'1px solid var(--border)',
                  background:'var(--bg)', color:'var(--text)',
                  fontSize:12, fontFamily:'inherit', outline:'none', boxSizing:'border-box',
                }}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setQuickIdx(i => Math.min(i+1, quickResults.length-1)) }
                  if (e.key === 'ArrowUp')   { e.preventDefault(); setQuickIdx(i => Math.max(i-1, 0)) }
                  if (e.key === 'Enter' && quickResults[selIdx]) addComponent(quickResults[selIdx], quickAdd.canvasX, quickAdd.canvasY)
                  if (e.key === 'Escape') setQuickAdd(null)
                }}
              />
              <div style={{ maxHeight:260, overflowY:'auto' }}>
                {quickResults.length === 0
                  ? <div style={{ padding:'10px 12px', fontSize:12, color:'var(--text3)' }}>No components found.</div>
                  : quickResults.map((item, i) => (
                    <button key={item.type} style={{
                      display:'flex', alignItems:'center', gap:8, width:'100%',
                      textAlign:'left',
                      background: i === selIdx ? 'rgba(74,222,128,.12)' : 'none',
                      border:'none',
                      color: i === selIdx ? 'var(--accent)' : 'var(--text)',
                      padding:'7px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit',
                    }}
                      onMouseEnter={() => setQuickIdx(i)}
                      onMouseDown={e => { e.preventDefault(); addComponent(item, quickAdd.canvasX, quickAdd.canvasY) }}>
                      <span style={{ flex:1 }}>{item.label}</span>
                      <span style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase' }}>{item.group}</span>
                    </button>
                  ))
                }
              </div>
            </div>
          )
        })()}

        {/* ── Info footer ──────────────────────────────────────────────── */}
        <div style={{
          position:'absolute', bottom:0, left:0, right:0,
          padding:'4px 10px', background:'var(--bg2)',
          borderTop:'1px solid var(--border)',
          display:'flex', alignItems:'center', gap:10, zIndex:50,
        }}>
          <div style={{ fontSize:10, color:'var(--text3)' }}>
            Context:&nbsp;
            {ctxOnlyDuringRun && !isRunning
              ? <span style={{ color:'#ff6b6b' }}>hidden (run-only)</span>
              : ctxDuringRun
                ? <span style={{ color:'var(--accent)' }}>visible · running:{isRunning?'yes':'no'}</span>
                : <span>standard</span>
            }
          </div>
          <div style={{ fontSize:10, color:'var(--text3)', marginLeft:'auto' }}>
            BOUNDS ({bounds?.x},{bounds?.y}) {bounds?.w}×{bounds?.h} · {w}×{h}
          </div>
        </div>
      </main>
    </div>
  )
}

function PanelBtn({ children, onClick, title, on }) {
  return (
    <button onClick={onClick} title={title} style={{
      width:24, height:24, borderRadius:4, border:'1px solid var(--border)', cursor:'pointer',
      background: on ? 'var(--accent)' : 'var(--bg3)', color: on ? '#000' : 'var(--text2)',
      fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', padding:0,
    }}>{children}</button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  ZoomControls — zoom in/out/fit for any preview
// ─────────────────────────────────────────────────────────────────────────────
function ZoomBar({ zoom, onZoom, onFit, fitZoom }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 0 0' }}>
      <button onClick={()=>onZoom(z=>Math.max(0.1,+(z-0.25).toFixed(2)))} style={zoomBtnS}>−</button>
      <span style={{ fontSize:10, color:'var(--text3)', minWidth:38, textAlign:'center' }}>{Math.round(zoom*100)}%</span>
      <button onClick={()=>onZoom(z=>Math.min(4,+(z+0.25).toFixed(2)))} style={zoomBtnS}>+</button>
      <button onClick={onFit} title="Fit" style={{ ...zoomBtnS, padding:'0 8px', fontSize:10 }}>Fit</button>
    </div>
  )
}
const zoomBtnS = { width:24, height:22, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:4, color:'var(--text2)', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', padding:0 }

// "Check on Canvas" button
function CheckBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{ marginTop:8, width:'100%', padding:'6px 0', borderRadius:5, background:'rgba(96,165,250,.08)', border:'1px dashed rgba(96,165,250,.4)', color:'#60a5fa', fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="1" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.2"/><circle cx="6.5" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.2"/></svg>
      Check on Canvas
    </button>
  )
}

// Small inline Btn component
function Btn({ children, onClick, v='def', sm, disabled, style:xs }) {
  const base = { padding:sm?'3px 9px':'6px 14px', borderRadius:5, cursor:disabled?'not-allowed':'pointer', fontSize:sm?11:12, fontWeight:600, border:'none', display:'inline-flex', alignItems:'center', gap:5, opacity:disabled?.5:1, whiteSpace:'nowrap', ...xs }
  const vars = { def:{background:'var(--bg3)',color:'var(--text)',border:'1px solid var(--border)'}, primary:{background:'var(--accent)',color:'#000'}, ghost:{background:'transparent',color:'var(--text2)',border:'1px solid var(--border)'}, danger:{background:'rgba(255,68,68,.14)',color:'#ff5555',border:'1px solid rgba(255,68,68,.3)'}, green:{background:'rgba(74,222,128,.14)',color:'#4ade80',border:'1px solid rgba(74,222,128,.3)'}, yellow:{background:'rgba(251,191,36,.14)',color:'#fbbf24',border:'1px solid rgba(251,191,36,.3)'}, blue:{background:'rgba(96,165,250,.14)',color:'#60a5fa',border:'1px solid rgba(96,165,250,.3)'} }
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...vars[v] }}>{children}</button>
}

const Sep = ({ v }) => <div style={v ? { width:1, height:18, background:'var(--border)' } : { height:1, background:'var(--border)', margin:'8px 0' }} />

// ─────────────────────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//  Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function ComponentEditorPage() {
  const navigate = useNavigate()

  // ── Theme ─────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark')
  const toggleTheme = () => {
    const nt = theme === 'dark' ? 'light' : 'dark'
    setTheme(nt); document.documentElement.setAttribute('data-theme', nt)
  }

  // ── Step 1 ────────────────────────────────────────────────────────────────
  const [compType,  setCompType]  = useState('')
  const [compLabel, setCompLabel] = useState('')
  const [compDesc,  setCompDesc]  = useState('')
  const [compGroup, setCompGroup] = useState('Sensors')
  const [ctxDuringRun,     setCtxDuringRun]     = useState(false)
  const [ctxOnlyDuringRun, setCtxOnlyDuringRun] = useState(false)

  // ── Step 2 ────────────────────────────────────────────────────────────────
  const [svgMode, setSvgMode]   = useState('code')  // 'code' | 'upload' | 'react'
  const [svgCode, setSvgCode]   = useState('')
  const [reactCode, setReactCode] = useState('')
  const svgFileRef = useRef(null)

  // ── Step 3 ────────────────────────────────────────────────────────────────
  const [compW, setCompW] = useState(200)
  const [compH, setCompH] = useState(160)
  const [bounds, setBounds] = useState({ x:13, y:7, w:174, h:146 })
  const [resizeMode, setResizeMode] = useState('comp')  // 'comp' | 'bounds'

  // ── Step 4 ────────────────────────────────────────────────────────────────
  const [pins, setPins]         = useState([])
  const [pinPlacing, setPlacing]= useState(false)
  const [newPinId,   setNPId]   = useState('P1')
  const [newPinType, setNPType] = useState('digital')
  const [newPinDesc, setNPDesc] = useState('')
  const [editPin,    setEditPin]= useState(null)
  const pinInnerRef             = useRef(null)

  // ── Step 5 ────────────────────────────────────────────────────────────────
  const [codeTab,      setCodeTab]      = useState('logic')
  const [logicCode,    setLogicCode]    = useState('')
  const [validCode,    setValidCode]    = useState('')
  const [uiCode,       setUiCode]       = useState('')
  const [indexCode,    setIndexCode]    = useState('')
  const [manifestCode, setManifestCode] = useState('')
  const uiEdited = useRef(false)

  // ── Step 6 ────────────────────────────────────────────────────────────────
  const [docsCode,    setDocsCode]    = useState('')
  const [docsPreview, setDocsPreview] = useState(false)

  // ── UI ────────────────────────────────────────────────────────────────────
  const [step,      setStep]      = useState(1)
  const [doneSteps, setDoneSteps] = useState(new Set())
  const [canvasOpen,setCanvasOpen]= useState(true)
  const [saving,    setSaving]    = useState(false)

  // ── Preview zoom per step ─────────────────────────────────────────────────
  const [s2Zoom, setS2Zoom] = useState(null)  // null = auto-fit
  const [s3Zoom, setS3Zoom] = useState(null)
  const [s4Zoom, setS4Zoom] = useState(null)

  const fitZoom = useCallback((containerW, containerH, cW=compW, cH=compH) => (
    Math.min(containerW/Number(cW), containerH/Number(cH), 1.5)
  ), [compW, compH])

  // ── Undo / Redo ───────────────────────────────────────────────────────────
  const histRef  = useRef([])
  const histIdx  = useRef(-1)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const getSnap = useCallback(() => ({
    compType, compLabel, compDesc, compGroup, ctxDuringRun, ctxOnlyDuringRun,
    svgCode, reactCode, svgMode, compW, compH, bounds:{...bounds}, pins:pins.map(p=>({...p})),
  }), [compType,compLabel,compDesc,compGroup,ctxDuringRun,ctxOnlyDuringRun,svgCode,reactCode,svgMode,compW,compH,bounds,pins])

  const applySnap = useCallback((s) => {
    setCompType(s.compType); setCompLabel(s.compLabel); setCompDesc(s.compDesc)
    setCompGroup(s.compGroup); setCtxDuringRun(s.ctxDuringRun); setCtxOnlyDuringRun(s.ctxOnlyDuringRun)
    setSvgCode(s.svgCode); setReactCode(s.reactCode||''); setSvgMode(s.svgMode||'code')
    setCompW(s.compW); setCompH(s.compH); setBounds(s.bounds); setPins(s.pins)
  }, [])

  const pushHist = useCallback(() => {
    const h = histRef.current.slice(0, histIdx.current+1).concat(getSnap()).slice(-60)
    histRef.current = h; histIdx.current = h.length-1
    setCanUndo(histIdx.current>0); setCanRedo(false)
  }, [getSnap])

  const undo = useCallback(() => { if (histIdx.current<=0) return; histIdx.current--; applySnap(histRef.current[histIdx.current]); setCanUndo(histIdx.current>0); setCanRedo(true) }, [applySnap])
  const redo = useCallback(() => { if (histIdx.current>=histRef.current.length-1) return; histIdx.current++; applySnap(histRef.current[histIdx.current]); setCanUndo(true); setCanRedo(histIdx.current<histRef.current.length-1) }, [applySnap])

  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey||e.metaKey) && e.key==='z'&&!e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey||e.metaKey) && (e.key==='y'||(e.key==='z'&&e.shiftKey))) { e.preventDefault(); redo() }
    }
    document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h)
  }, [undo,redo])

  useEffect(() => { if (histRef.current.length===0) pushHist() }, [])

  // ── getData ───────────────────────────────────────────────────────────────
  const getData = useCallback(() => ({
    type:compType, label:compLabel, description:compDesc, group:compGroup,
    w:compW, h:compH, contextMenuDuringRun:ctxDuringRun, contextMenuOnlyDuringRun:ctxOnlyDuringRun,
    svgCode, reactCode, imageMode:svgMode, bounds, pins,
  }), [compType,compLabel,compDesc,compGroup,compW,compH,ctxDuringRun,ctxOnlyDuringRun,svgCode,reactCode,svgMode,bounds,pins])

  // ── Dynamic warnings — reactive, no stale state ───────────────────────────
  const autoWarnings = useMemo(() => [
    !compType    && 'Component type is empty — set it in Step 1.',
    svgMode !== 'react' && !svgCode && 'No SVG defined — add art in Step 2.',
    svgMode === 'react' && !reactCode && 'No React component defined — write JSX in Step 2.',
    !pins.length && 'No pins defined — add them in Step 4.',
  ].filter(Boolean), [compType, svgCode, reactCode, svgMode, pins.length])

  // ── Auto-regenerate manifest + index ──────────────────────────────────────
  useEffect(() => {
    const d = getData()
    setManifestCode(genManifest(d))
    setIndexCode(genIndexCode(d))
  }, [compType,compLabel,compDesc,compGroup,compW,compH,ctxDuringRun,ctxOnlyDuringRun,bounds,pins])

  useEffect(() => {
    if (!uiEdited.current) setUiCode(genUICode(getData()))
  }, [svgCode,reactCode,svgMode,bounds,compW,compH,compType,compLabel,ctxDuringRun,ctxOnlyDuringRun])

  // ── Nav ───────────────────────────────────────────────────────────────────
  const mark = (s) => setDoneSteps(p=>new Set([...p,s]))
  const goToStep = (n) => { mark(step); setStep(n) }
  const goNext = () => {
    if (step===4) { if (!logicCode) setLogicCode(genLogicCode(getData())); if (!validCode) setValidCode(genValidationCode(getData())) }
    if (step===6 && !docsCode) setDocsCode(genDocsHTML(getData()))
    mark(step); if (step<7) setStep(s=>s+1)
  }
  const goPrev = () => { if (step>1) setStep(s=>s-1) }

  // ── Generate all ──────────────────────────────────────────────────────────
  const genAll = () => {
    const d = getData()
    setManifestCode(genManifest(d))
    uiEdited.current = false; setUiCode(genUICode(d))
    setLogicCode(genLogicCode(d))
    setValidCode(genValidationCode(d))
    setIndexCode(genIndexCode(d))
    if (!docsCode) setDocsCode(genDocsHTML(d))
    setCodeTab('logic')
  }

  // ── SVG upload ────────────────────────────────────────────────────────────
  const handleSvgUpload = (e) => {
    const f = e.target.files?.[0]; if (!f) return
    const r = new FileReader()
    r.onload = (ev) => { setSvgCode(ev.target.result||''); pushHist() }
    r.readAsText(f)
  }

  // ── Import ZIP ────────────────────────────────────────────────────────────
  const importRef = useRef(null)
  const handleImport = async (e) => {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = ''
    try {
      const zip = await JSZip.loadAsync(file)
      let mStr,uiStr,logicStr,validStr,indexStr,docsStr
      for (const p of Object.keys(zip.files)) {
        const s = () => zip.files[p].async('string')
        if (p.endsWith('manifest.json'))   mStr    = await s()
        if (/ui\.(tsx|jsx)$/.test(p))      uiStr   = await s()
        if (/logic\.(ts|js)$/.test(p))     logicStr= await s()
        if (/validation\.(ts|js)$/.test(p))validStr= await s()
        if (/index\.(ts|js)$/.test(p))     indexStr= await s()
        if (/docs\/.*\.html$/i.test(p))    docsStr = await s()
      }
      if (mStr) {
        const m = JSON.parse(mStr)
        setCompType(m.type||''); setCompLabel(m.label||''); setCompDesc(m.description||'')
        setCompGroup(m.group||'Sensors'); setCompW(m.w||200); setCompH(m.h||160)
        setCtxDuringRun(!!m.contextMenuDuringRun); setCtxOnlyDuringRun(!!m.contextMenuOnlyDuringRun)
        if (m.pins?.length) setPins(m.pins); setManifestCode(mStr)
      }
      if (uiStr) {
        uiEdited.current=true; setUiCode(uiStr)
        const bm = uiStr.match(/BOUNDS\s*=\s*\{\s*x:\s*(\d+)[^}]*y:\s*(\d+)[^}]*w:\s*(\d+)[^}]*h:\s*(\d+)/)
        if (bm) setBounds({ x:+bm[1], y:+bm[2], w:+bm[3], h:+bm[4] })
        // Detect if ui.tsx is a React component (has JSX/React imports) vs plain SVG
        const hasReactImport = /import\s+React|from\s+['"]react['"]/.test(uiStr)
        const hasJsxExport = /export\s+(const|function)\s+\w+.*=.*\(/.test(uiStr)
        if (hasReactImport || hasJsxExport) {
          // React mode: set the full ui.tsx as reactCode
          setSvgMode('react')
          setReactCode(uiStr)
        } else {
          // SVG mode: extract inline SVG
          const sm = uiStr.match(/<svg[\s\S]*?<\/svg>/)
          if (sm) { setSvgCode(sm[0]); setSvgMode('code') }
        }
      }
      if (logicStr) setLogicCode(logicStr)
      if (validStr) setValidCode(validStr)
      if (indexStr) setIndexCode(indexStr)
      if (docsStr)  setDocsCode(docsStr)
      pushHist()
    } catch (err) { alert('Error reading ZIP: '+err.message) }
  }

  // ── Pin placement (correct scale via pinInnerRef) ──────────────────────────
  const handlePinClick = useCallback((e) => {
    if (!pinPlacing) return
    e.stopPropagation()
    const rect = pinInnerRef.current?.getBoundingClientRect(); if (!rect) return
    // pinInnerRef has width = compW * zoom, so: scale = rect.width / compW
    const sc = rect.width / Number(compW)
    const x = Math.round((e.clientX-rect.left)/sc)
    const y = Math.round((e.clientY-rect.top)/sc)
    const id = newPinId.trim() || `P${pins.length+1}`
    setPins(prev=>[...prev,{id,x,y,type:newPinType,description:newPinDesc}])
    setNPId(prev=>{const m=prev.match(/^(.*?)(\d+)$/); return m?`${m[1]}${+m[2]+1}`:prev})
    setPlacing(false); setTimeout(pushHist,0)
  }, [pinPlacing,compW,newPinId,newPinType,newPinDesc,pins.length,pushHist])

  // ── Build / download ZIP ──────────────────────────────────────────────────
  const buildZip = async () => {
    const d = getData(), zip = new JSZip(), f = zip.folder(d.type||'my-component')
    f.file('manifest.json', manifestCode||genManifest(d))
    f.file('ui.tsx',        uiCode||genUICode(d))
    f.file('logic.ts',      logicCode||genLogicCode(d))
    f.file('validation.ts', validCode||genValidationCode(d))
    f.file('index.ts',      indexCode||genIndexCode(d))
    f.folder('docs').file('index.html', docsCode||genDocsHTML(d))
    return zip.generateAsync({ type:'blob' })
  }

  const handleDownload = async () => {
    const d = getData(); const blob = await buildZip()
    const url = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), { href:url, download:`${d.type||'my-component'}.zip` }).click()
    URL.revokeObjectURL(url)
  }

  const handleTestInSim = async () => {
    setSaving(true)
    try {
      const d = getData(); const blob = await buildZip()
      const reader = new FileReader()
      reader.onload = (ev) => {
        localStorage.setItem('openhw_pending_component', JSON.stringify({ data:ev.target.result, name:d.type, label:d.label }))
        window.open('/simulator','_blank') || navigate('/simulator')
      }; reader.readAsDataURL(blob)
    } finally { setSaving(false) }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Step 1
  // ─────────────────────────────────────────────────────────────────────────
  const s1 = () => (
    <div>
      <div className="bg-[rgba(74,222,128,.05)] border border-[rgba(74,222,128,.2)] rounded-[6px] px-[11px] py-[7px] mb-[11px] text-[11px] text-[var(--text2)] leading-[1.6]">Fields auto-update <code>manifest.json</code>, <code>index.ts</code>, and <code>ui.tsx</code> in real-time.</div>
      <div className="grid grid-cols-2 gap-[13px]">
        <div style={{ marginBottom:13 }}>
          <label className="block text-[10px] font-semibold text-[var(--text2)] mb-1 uppercase tracking-[.06em]">Component Type *</label>
          <input className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[5px] text-[var(--text)] px-2 py-1.5 text-xs outline-none box-border" placeholder="e.g. my-sensor" value={compType}
            onChange={e=>setCompType(e.target.value.toLowerCase().replace(/\s/g,'-'))} onBlur={pushHist} />
          <div style={{ fontSize:10, color:'var(--text3)', marginTop:3 }}>Unique ID — lowercase, hyphens. Used as <code>manifest.type</code>.</div>
        </div>
        <div style={{ marginBottom:13 }}>
          <label className="block text-[10px] font-semibold text-[var(--text2)] mb-1 uppercase tracking-[.06em]">Display Label *</label>
          <input className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[5px] text-[var(--text)] px-2 py-1.5 text-xs outline-none box-border" placeholder="e.g. My Sensor" value={compLabel}
            onChange={e=>setCompLabel(e.target.value)} onBlur={pushHist} />
        </div>
      </div>
      <div style={{ marginBottom:13 }}>
        <label className="block text-[10px] font-semibold text-[var(--text2)] mb-1 uppercase tracking-[.06em]">Description</label>
        <textarea className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[5px] text-[var(--text)] px-2 py-1.5 text-xs outline-none box-border resize-y min-h-[60px] font-inherit" placeholder="What does this component do?" value={compDesc}
          onChange={e=>setCompDesc(e.target.value)} onBlur={pushHist} />
      </div>
      <div style={{ marginBottom:13 }}>
        <label className="block text-[10px] font-semibold text-[var(--text2)] mb-1 uppercase tracking-[.06em]">Group</label>
        <select className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[5px] text-[var(--text)] px-2 py-1.5 text-xs outline-none box-border" style={{maxWidth:200 }} value={compGroup}
          onChange={e=>{ setCompGroup(e.target.value); pushHist() }}>
          {GROUPS.map(g=><option key={g}>{g}</option>)}
        </select>
      </div>
      <div className="bg-[var(--bg3)] rounded-[7px] px-[13px] py-[11px] border border-[var(--border)] mb-[11px]">
        <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:8 }}>Context Menu Flags</div>
        <div style={{ fontSize:11, color:'var(--text2)', marginBottom:10 }}>
          Exported in <code>manifest.json</code>, <code>ui.tsx</code> and <code>index.ts</code>.
        </div>
        {[
          { v:ctxDuringRun,    s:setCtxDuringRun,    n:'contextMenuDuringRun',    d:'Context menu accessible while simulation is running (live controls).' },
          { v:ctxOnlyDuringRun,s:setCtxOnlyDuringRun,n:'contextMenuOnlyDuringRun',d:'Hide context menu when simulation is stopped — only show it during a run.' },
        ].map(row=>(
          <label key={row.n} style={{ display:'flex', alignItems:'flex-start', gap:8, cursor:'pointer', marginBottom:9 }}>
            <input type="checkbox" checked={row.v} onChange={e=>{row.s(e.target.checked); pushHist()}}
              style={{ marginTop:2, width:13, height:13, accentColor:'var(--accent)', flexShrink:0 }} />
            <span>
              <strong style={{ fontSize:12, color:'var(--text)' }}>{row.n}</strong>
              <br/><span style={{ fontSize:11, color:'var(--text3)' }}>{row.d}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  //  Step 2
  // ─────────────────────────────────────────────────────────────────────────
  const s2 = () => {
    const fz = fitZoom(360, 300)
    const zoom = s2Zoom ?? fz
    const gridPx = GRID * zoom
    const isReact = svgMode === 'react'
    return (
      <div style={{ display:'flex', gap:16, height:'100%' }}>
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:9, minWidth:0 }}>
          <div style={{ display:'flex', gap:5 }}>
            <Btn v={svgMode==='code'?'primary':'ghost'} sm onClick={()=>setSvgMode('code')}>SVG Code</Btn>
            <Btn v={svgMode==='upload'?'primary':'ghost'} sm onClick={()=>setSvgMode('upload')}>Upload SVG</Btn>
            <Btn v={svgMode==='react'?'primary':'ghost'} sm onClick={()=>setSvgMode('react')} style={{ borderColor:'rgba(96,165,250,.5)' }}>React JSX</Btn>
          </div>
          {svgMode==='upload' && (
            <div onClick={()=>svgFileRef.current?.click()} style={{ border:'2px dashed var(--border)', borderRadius:7, padding:'36px 16px', textAlign:'center', cursor:'pointer', background:'var(--bg3)', flex:1 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>⬆</div>
              <div style={{ fontSize:12, color:'var(--text2)' }}>Click to upload .svg</div>
              {svgCode && <div style={{ marginTop:7, fontSize:11, color:'var(--accent)' }}>✓ loaded ({svgCode.length} chars)</div>}
            </div>
          )}
          {svgMode==='code' && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', gap:4 }}>
              <div style={{ fontSize:10, color:'var(--text3)' }}>Use <code>viewBox="0 0 {compW} {compH}"</code> to match dimensions set in Step 3. viewBox is auto-added if missing.</div>
              <div className="bg-[var(--bg)] rounded-b-[6px] border border-[var(--border)] overflow-auto flex-1" style={{flex:1, minHeight:240, borderRadius:7 }}>
                <Editor value={svgCode} onValueChange={setSvgCode}
                  highlight={c=>Prism.highlight(c||'',Prism.languages.markup,'markup')}
                  padding={12} style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, lineHeight:1.7, minHeight:240, color:'var(--text)' }}
                  placeholder={`<svg width="${compW}" height="${compH}" viewBox="0 0 ${compW} ${compH}" xmlns="http://www.w3.org/2000/svg">\n  <!-- art here -->\n</svg>`}
                />
              </div>
            </div>
          )}
          {svgMode==='react' && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', gap:4 }}>
              <div style={{ fontSize:10, color:'var(--text3)', lineHeight:1.6 }}>
                Write a React component and <code>export</code> it. Props available: <code>state</code>, <code>attrs</code>, <code>isRunning</code>.
                The component renders at {compW}×{compH}px using <code>position:absolute</code>.
              </div>
              <div className="bg-[var(--bg)] rounded-b-[6px] border border-[var(--border)] overflow-auto flex-1" style={{flex:1, minHeight:240, borderRadius:7 }}>
                <Editor value={reactCode} onValueChange={setReactCode}
                  highlight={c=>Prism.highlight(c||'',Prism.languages.javascript,'javascript')}
                  padding={12} style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, lineHeight:1.7, minHeight:240, color:'var(--text)' }}
                  placeholder={`export const MyComponentUI = ({ state, attrs, isRunning }) => (\n  <div style={{ position:'absolute', inset:0, background:'#1e1e2e', border:'2px solid #4ade80', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center' }}>\n    <span style={{ color:'#4ade80', fontFamily:'monospace', fontSize:11 }}>My Component</span>\n  </div>\n)`}
                />
              </div>
            </div>
          )}
          <input ref={svgFileRef} type="file" accept=".svg,image/svg+xml" onChange={handleSvgUpload} style={{ display:'none' }} />
        </div>
        {/* Preview */}
        <div style={{ width:380, flexShrink:0, display:'flex', flexDirection:'column', gap:5 }}>
          <div style={{ fontSize:10, fontWeight:600, color:'var(--text3)', textTransform:'uppercase' }}>
            Live Preview {isReact && <span style={{ color:'#60a5fa' }}>· React</span>}
          </div>
          <div className="bg-[var(--canvas-bg)] rounded-[7px] border border-[var(--border)] flex items-center justify-center overflow-hidden relative" style={{ width:380, height:320, backgroundSize:`${gridPx}px ${gridPx}px` }}>
            {isReact
              ? <ReactPreview reactCode={reactCode} compW={compW} compH={compH} zoom={zoom} />
              : <SvgPreview svgCode={svgCode} compW={compW} compH={compH} zoom={zoom} />
            }
          </div>
          <ZoomBar zoom={zoom} onZoom={setS2Zoom} onFit={()=>setS2Zoom(null)} fitZoom={fz} />
          <div style={{ fontSize:10, color:'var(--text3)' }}>Canvas: {compW}×{compH}px · Grid: {GRID}px (scaled {gridPx.toFixed(0)}px at this zoom)</div>
          <CheckBtn onClick={()=>setCanvasOpen(true)} />
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Step 3
  // ─────────────────────────────────────────────────────────────────────────
  const s3 = () => {
    const maxW=380, maxH=310
    const fz = fitZoom(maxW, maxH)
    const zoom = s3Zoom ?? fz
    const scale = zoom  // alias for clarity in overlay positioning
    const gridPx = GRID * scale
    const imgPreview = svgMode === 'react'
      ? <ReactPreview reactCode={reactCode} compW={compW} compH={compH} zoom={scale} />
      : <SvgPreview svgCode={svgCode} compW={compW} compH={compH} zoom={scale} />
    return (
      <div style={{ display:'flex', gap:18 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div className="bg-[rgba(74,222,128,.05)] border border-[rgba(74,222,128,.2)] rounded-[6px] px-[11px] py-[7px] mb-[11px] text-[11px] text-[var(--text2)] leading-[1.6]">
            <strong>w/h in manifest</strong> = total pixel area on the circuit canvas.<br/>
            <strong>BOUNDS in ui.tsx</strong> = inner clickable hit-box (selection + wire-snap target). Usually smaller because pin pads extend to edges.
          </div>
          <div className="bg-[var(--bg3)] rounded-[7px] px-[13px] py-[11px] border border-[var(--border)] mb-[11px]" style={{borderColor:'var(--border)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text)', marginBottom:9 }}>Canvas Size</div>
            <div className="grid grid-cols-2 gap-[13px]">
              {[['Width (w) px','w',compW,v=>{setCompW(v);setBounds(b=>({...b,w:Math.max(GRID,v-26)}))}],
                ['Height (h) px','h',compH,v=>{setCompH(v);setBounds(b=>({...b,h:Math.max(GRID,v-14)}))}]].map(([lbl,,val,set])=>(
                <div key={lbl}><label className="block text-[10px] font-semibold text-[var(--text2)] mb-1 uppercase tracking-[.06em]">{lbl}</label>
                  <input className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[5px] text-[var(--text)] px-2 py-1.5 text-xs outline-none box-border" type="number" min={20} max={800} value={val}
                    onChange={e=>set(+e.target.value)} onBlur={pushHist} />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[var(--bg3)] rounded-[7px] px-[13px] py-[11px] border border-[var(--border)] mb-[11px]" style={{borderColor:'rgba(74,222,128,.4)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--accent)', marginBottom:9 }}>BOUNDS — Hit Box</div>
            <div className="grid grid-cols-4 gap-[9px]">
              {['x','y','w','h'].map(k=>(
                <div key={k}><label className="block text-[10px] font-semibold text-[var(--text2)] mb-1 uppercase tracking-[.06em]">{k}</label>
                  <input className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[5px] text-[var(--text)] px-2 py-1.5 text-xs outline-none box-border" style={{borderColor:'rgba(74,222,128,.4)' }} type="number"
                    value={bounds[k]} onChange={e=>setBounds(b=>({...b,[k]:+e.target.value}))} onBlur={pushHist} />
                </div>
              ))}
            </div>
            <div style={{ fontSize:10, color:'var(--text3)', marginTop:7 }}>
              → <code>export const BOUNDS = &#123; x:{bounds.x}, y:{bounds.y}, w:{bounds.w}, h:{bounds.h} &#125;;</code>
            </div>
          </div>
          {/* Mode toggle */}
          <div className="bg-[var(--bg3)] rounded-[7px] px-[13px] py-[11px] border border-[var(--border)] mb-[11px]" style={{display:'flex', alignItems:'center', gap:10, marginBottom:0 }}>
            <span style={{ fontSize:11, color:resizeMode==='comp'?'var(--accent)':'var(--text3)', fontWeight:600 }}>Component</span>
            <div onClick={()=>setResizeMode(m=>m==='comp'?'bounds':'comp')} style={{ position:'relative', width:40, height:20, background:resizeMode==='bounds'?'rgba(74,222,128,.25)':'var(--bg)', border:'1px solid rgba(74,222,128,.4)', borderRadius:10, cursor:'pointer', flexShrink:0 }}>
              <div style={{ position:'absolute', top:2, left:resizeMode==='comp'?2:20, width:14, height:14, borderRadius:'50%', background:'var(--accent)', transition:'left .2s' }} />
            </div>
            <span style={{ fontSize:11, color:resizeMode==='bounds'?'var(--accent)':'var(--text3)', fontWeight:600 }}>BOUNDS</span>
            <span style={{ fontSize:10, color:'var(--text3)' }}>→ drag handles in preview</span>
          </div>
        </div>

        {/* Preview */}
        <div style={{ width:420, flexShrink:0, display:'flex', flexDirection:'column', gap:5 }}>
          <div style={{ fontSize:10, fontWeight:600, color:'var(--text3)', textTransform:'uppercase' }}>
            Preview — <span style={{ color:'var(--accent)' }}>green=BOUNDS</span>
            {resizeMode==='comp'&&<span style={{ color:'#60a5fa', marginLeft:6 }}>· blue=component</span>}
          </div>
          <div className="bg-[var(--canvas-bg)] rounded-[7px] border border-[var(--border)] flex items-center justify-center overflow-hidden relative" style={{ width:420, height:330, overflow:'hidden', backgroundSize:`${gridPx}px ${gridPx}px` }}>
            <div style={{ position:'relative', width:Number(compW)*scale, height:Number(compH)*scale, flexShrink:0 }}>
              {imgPreview}
              {/* BOUNDS overlay */}
              {resizeMode==='bounds'
                ? <DragResizeBox bx={bounds.x} by={bounds.y} bw={bounds.w} bh={bounds.h} scale={scale} color="rgba(74,222,128,.95)"
                    label={`BOUNDS (${bounds.x},${bounds.y}) ${bounds.w}×${bounds.h}`}
                    onChange={v=>setBounds(v)} onEnd={pushHist} />
                : <div style={{ position:'absolute', pointerEvents:'none', left:bounds.x*scale, top:bounds.y*scale, width:bounds.w*scale, height:bounds.h*scale, border:'2px solid rgba(74,222,128,.8)', background:'rgba(74,222,128,.06)' }} />
              }
              {/* Component size overlay */}
              {resizeMode==='comp' && (
                <DragResizeBox bx={0} by={0} bw={Number(compW)} bh={Number(compH)} scale={scale} color="rgba(96,165,250,.9)"
                  label={`${compW}×${compH}`} noMove onlyEdges
                  onChange={v=>{ setCompW(v.w); setCompH(v.h) }} onEnd={pushHist} />
              )}
            </div>
          </div>
          <ZoomBar zoom={scale} onZoom={setS3Zoom} onFit={()=>setS3Zoom(null)} fitZoom={fz} />
          <div style={{ fontSize:10, color:'var(--text3)' }}>Canvas: {compW}×{compH} | BOUNDS: ({bounds.x},{bounds.y}) {bounds.w}×{bounds.h}</div>
          <CheckBtn onClick={()=>setCanvasOpen(true)} />
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Step 4
  // ─────────────────────────────────────────────────────────────────────────
  const s4 = () => {
    const maxW=380, maxH=330
    const fz = fitZoom(maxW, maxH)
    const zoom = s4Zoom ?? fz
    return (
      <div style={{ display:'flex', gap:16, height:'100%' }}>
        <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:9, overflowY:'auto' }}>
          <div className="bg-[rgba(74,222,128,.05)] border border-[rgba(74,222,128,.2)] rounded-[6px] px-[11px] py-[7px] mb-[11px] text-[11px] text-[var(--text2)] leading-[1.6]">
            Click <strong>Start Placing</strong> then click on the preview. Coordinates are in component coordinate space ({compW}×{compH}).
            Click any pin row to edit inline.
          </div>
          <div className="bg-[var(--bg3)] rounded-[7px] px-[13px] py-[11px] border border-[var(--border)] mb-[11px]">
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text)', marginBottom:8 }}>New Pin</div>
            <div className="grid grid-cols-2 gap-[13px]">
              <div><label className="block text-[10px] font-semibold text-[var(--text2)] mb-1 uppercase tracking-[.06em]">Pin ID</label>
                <input className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[5px] text-[var(--text)] px-2 py-1.5 text-xs outline-none box-border" placeholder="VCC, SDA…" value={newPinId} onChange={e=>setNPId(e.target.value)} />
              </div>
              <div><label className="block text-[10px] font-semibold text-[var(--text2)] mb-1 uppercase tracking-[.06em]">Type</label>
                <select className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[5px] text-[var(--text)] px-2 py-1.5 text-xs outline-none box-border" value={newPinType} onChange={e=>setNPType(e.target.value)}>
                  {PIN_TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop:9, marginBottom:9 }}>
              <label className="block text-[10px] font-semibold text-[var(--text2)] mb-1 uppercase tracking-[.06em]">Description</label>
              <input className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[5px] text-[var(--text)] px-2 py-1.5 text-xs outline-none box-border" placeholder="Supply voltage 3.3–5 V" value={newPinDesc} onChange={e=>setNPDesc(e.target.value)} />
            </div>
            <Btn v={pinPlacing?'danger':'primary'} onClick={()=>setPlacing(m=>!m)}>
              {pinPlacing?'✕ Cancel':'⊕ Start Placing — click preview'}
            </Btn>
            {pinPlacing&&<div style={{ marginTop:6, fontSize:11, color:'var(--accent)' }}>Placing <strong>"{newPinId||`P${pins.length+1}`}"</strong> →</div>}
          </div>
          <div style={{ fontSize:10, fontWeight:600, color:'var(--text3)', textTransform:'uppercase' }}>Pins ({pins.length})</div>
          {pins.length===0&&<div style={{ color:'var(--text3)', fontSize:12 }}>No pins yet.</div>}
          {pins.map((pin,i)=>(
            <div key={i}>
              <div className={`flex items-center gap-[7px] px-2 py-[5px] cursor-pointer ${(editPin===i) ? "bg-[var(--bg)] rounded-t-[6px] mb-0 border border-[var(--accent)]" : "bg-[var(--bg3)] rounded-[6px] mb-1 border border-[var(--border)]"}`} onClick={()=>setEditPin(editPin===i?null:i)}>
                <div style={{ width:8, height:8, background:editPin===i?'#f1c40f':'rgba(255,255,255,.25)', border:'1px solid rgba(255,255,255,.8)', flexShrink:0 }} />
                <span style={{ fontSize:11, fontWeight:700, color:'var(--text)', minWidth:44 }}>{pin.id}</span>
                <span style={{ fontSize:10, color:'var(--text3)', flex:1 }}>({pin.x},{pin.y}) · {pin.type}{pin.description?` — ${pin.description}`:''}</span>
                <span style={{ fontSize:10, color:'var(--text3)' }}>{editPin===i?'▲':'▼'}</span>
                <Btn v="danger" sm onClick={e=>{e.stopPropagation();setPins(ps=>ps.filter((_,j)=>j!==i));if(editPin===i)setEditPin(null);pushHist()}}>✕</Btn>
              </div>
              {editPin===i&&(
                <div style={{ padding:'9px 11px', background:'var(--bg)', border:'1px solid var(--accent)', borderTop:'none', borderRadius:'0 0 6px 6px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:9, marginBottom:4 }}>
                  {[['id','Pin ID',pin.id,'text'],['type','Type',null,'select'],['x','X (component px)',pin.x,'number'],['y','Y (component px)',pin.y,'number']].map(([k,lbl,val,type])=>(
                    <div key={k}><label className="block text-[10px] font-semibold text-[var(--text2)] mb-1 uppercase tracking-[.06em]">{lbl}</label>
                      {type==='select'
                        ? <select className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[5px] text-[var(--text)] px-2 py-1.5 text-xs outline-none box-border" value={pin.type} onChange={e=>{setPins(ps=>ps.map((p,j)=>j===i?{...p,type:e.target.value}:p));pushHist()}}>
                            {PIN_TYPES.map(t=><option key={t}>{t}</option>)}
                          </select>
                        : <input className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[5px] text-[var(--text)] px-2 py-1.5 text-xs outline-none box-border" type={type} value={val}
                            onChange={e=>setPins(ps=>ps.map((p,j)=>j===i?{...p,[k]:type==='number'?+e.target.value:e.target.value}:p))}
                            onBlur={pushHist} />
                      }
                    </div>
                  ))}
                  <div style={{ gridColumn:'1/-1' }}>
                    <label className="block text-[10px] font-semibold text-[var(--text2)] mb-1 uppercase tracking-[.06em]">Description</label>
                    <input className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[5px] text-[var(--text)] px-2 py-1.5 text-xs outline-none box-border" value={pin.description||''} onChange={e=>setPins(ps=>ps.map((p,j)=>j===i?{...p,description:e.target.value}:p))} onBlur={pushHist} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pin preview */}
        <div style={{ width:400, flexShrink:0, display:'flex', flexDirection:'column', gap:5 }}>
          <div style={{ fontSize:10, fontWeight:600, color:pinPlacing?'var(--accent)':'var(--text3)', textTransform:'uppercase' }}>
            {pinPlacing?`▶ Click to place "${newPinId||`P${pins.length+1}`}"`:' Component Preview'}
          </div>
          <div className="bg-[var(--canvas-bg)] rounded-[7px] border border-[var(--border)] flex items-center justify-center overflow-hidden relative" style={{ width:400, height:340, cursor:pinPlacing?'crosshair':'default', borderColor:pinPlacing?'var(--accent)':'var(--border)' , backgroundSize:`${GRID*zoom}px ${GRID*zoom}px` }}>
            {/* Inner ref div — exact scaled component size */}
            <div ref={pinInnerRef} onClick={handlePinClick}
              style={{ position:'relative', width:Number(compW)*zoom, height:Number(compH)*zoom, flexShrink:0 }}>
              {svgMode === 'react'
                ? <ReactPreview reactCode={reactCode} compW={compW} compH={compH} zoom={zoom} />
                : <SvgPreview svgCode={svgCode} compW={compW} compH={compH} zoom={zoom} />
              }
              {/* Simulator-accurate pin rendering */}
              {pins.map((pin,i) => (
                <SimPin key={i} pin={pin} zoom={zoom} selected={editPin===i} onClick={()=>setEditPin(editPin===i?null:i)} />
              ))}
            </div>
          </div>
          <ZoomBar zoom={zoom} onZoom={setS4Zoom} onFit={()=>setS4Zoom(null)} fitZoom={fz} />
          <div style={{ fontSize:10, color:'var(--text3)' }}>Pin shape/colors match the simulator. Hover a pin to see label. Click to edit.</div>
          <CheckBtn onClick={()=>setCanvasOpen(true)} />
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Step 5
  // ─────────────────────────────────────────────────────────────────────────
  const s5 = () => {
    const tabs = [
      { id:'logic',    l:'logic.ts',       code:logicCode,    set:setLogicCode },
      { id:'valid',    l:'validation.ts',  code:validCode,    set:setValidCode },
      { id:'ui',       l:'ui.tsx',         code:uiCode,       set:v=>{uiEdited.current=true;setUiCode(v)} },
      { id:'index',    l:'index.ts',       code:indexCode,    set:setIndexCode },
      { id:'manifest', l:'manifest.json',  code:manifestCode, set:setManifestCode },
    ]
    const active = tabs.find(t=>t.id===codeTab)||tabs[0]
    return (
      <div style={{ display:'flex', flexDirection:'column', height:'100%', gap:9 }}>
        {autoWarnings.length>0&&(
          <div className="bg-[rgba(251,191,36,.06)] border border-[rgba(251,191,36,.3)] rounded-[6px] px-[11px] py-[7px] mb-[9px] text-[11px] text-[#fbbf24] leading-[1.5]">
            <strong>Before generating:</strong>
            <ul style={{ margin:'5px 0 0 14px', padding:0 }}>{autoWarnings.map((w,i)=><li key={i}>{w}</li>)}</ul>
          </div>
        )}
        <div style={{ display:'flex', gap:9, alignItems:'center', flexShrink:0 }}>
          <Btn v="green" onClick={genAll}>⚡ Generate / Refresh All Files</Btn>
          <div style={{ fontSize:11, color:'var(--text3)' }}>Fills all 5 files from Steps 1–4. Manual edits to <code>logic.ts</code>/<code>validation.ts</code> are preserved.</div>
        </div>
        <div style={{ display:'flex', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          {tabs.map(t=><button key={t.id} className={`px-[11px] py-1 rounded-t-[5px] min-w-max text-[11px] font-semibold cursor-pointer mr-[2px] ${(codeTab===t.id) ? "bg-[var(--bg)] border border-[var(--border)] border-b-[var(--bg)] text-[var(--accent)]" : "bg-[var(--bg3)] border border-[var(--border)] border-b-[var(--border)] text-[var(--text3)]"}`} onClick={()=>setCodeTab(t.id)}>{t.l}</button>)}
        </div>
        <div className="bg-[var(--bg)] rounded-b-[6px] border border-[var(--border)] overflow-auto flex-1" style={{flex:1 }}>
          <Editor key={codeTab} value={active.code||''} onValueChange={active.set}
            highlight={c=>Prism.highlight(c||'',Prism.languages.javascript,'javascript')}
            padding={13} style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, lineHeight:1.7, minHeight:400, color:'var(--text)' }}
            placeholder={`// Click "Generate / Refresh All Files" to populate ${active.l}`}
          />
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Step 6
  // ─────────────────────────────────────────────────────────────────────────
  const s6 = () => (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', gap:9 }}>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
        <Btn v="green" onClick={()=>setDocsCode(genDocsHTML(getData()))}>Generate Template</Btn>
        <Sep v />
        <Btn v={docsPreview?'primary':'ghost'} onClick={()=>setDocsPreview(p=>!p)}>
          {docsPreview?'📋 Edit Code':'🔍 Preview HTML'}
        </Btn>
        {docsPreview && <span style={{ fontSize:11, color:'var(--text3)' }}>Live render of your docs HTML</span>}
      </div>
      {docsPreview
        ? <iframe srcDoc={docsCode||'<p style="color:#888;font-family:sans-serif;padding:20px">No docs yet — click Generate Template</p>'} style={{ flex:1, border:'1px solid var(--border)', borderRadius:8, background:'white', minHeight:420 }} title="Docs Preview" sandbox="allow-scripts" />
        : <div className="bg-[var(--bg)] rounded-b-[6px] border border-[var(--border)] overflow-auto flex-1" style={{flex:1 }}>
            <Editor value={docsCode} onValueChange={setDocsCode}
              highlight={c=>Prism.highlight(c||'',Prism.languages.markup,'markup')}
              padding={13} style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, lineHeight:1.7, minHeight:400, color:'var(--text)' }}
              placeholder="<!-- Click Generate Template to get started -->"
            />
          </div>
      }
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  //  Step 7
  // ─────────────────────────────────────────────────────────────────────────
  const s7 = () => {
    const d = getData()
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div className="bg-[rgba(74,222,128,.05)] border border-[rgba(74,222,128,.2)] rounded-[6px] px-[11px] py-[7px] mb-[11px] text-[11px] text-[var(--text2)] leading-[1.6]">Your component is ready. Choose what to do next.</div>
        <div className="bg-[var(--bg3)] rounded-[7px] px-[13px] py-[11px] border border-[var(--border)] mb-[11px]">
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:9 }}>Summary</div>
          <div className="grid grid-cols-2 gap-[13px]">
            {[['Type',d.type||'—'],['Label',d.label||'—'],['Group',d.group],['Canvas',`${d.w}×${d.h} px`],['Pins',d.pins.length],['BOUNDS',`(${d.bounds?.x},${d.bounds?.y}) ${d.bounds?.w}×${d.bounds?.h}`]].map(([k,v])=>(
              <div key={k}><span style={{ fontSize:10, color:'var(--text3)' }}>{k}: </span><span style={{ fontSize:12 }}>{v}</span></div>
            ))}
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:11 }}>
          {[
            { icon:'⬇', t:'Download ZIP',      d:"Full package — upload via 'Upload ZIP' in simulator.",       btn:'Download',          bv:'green',  fn:handleDownload, dis:false },
            { icon:'▶', t:'Test in Simulator', d:'Instantly loads component into a new simulator tab.',        btn:saving?'…':'Open & Load', bv:'primary', fn:handleTestInSim, dis:saving },
            { icon:'☁', t:'Save to Account',   d:'Submit for admin review and community catalog.',             btn:'Coming soon',       bv:'ghost',  fn:null, dis:true },
          ].map(c=>(
            <div key={c.t} className="bg-[var(--bg3)] rounded-[7px] px-[13px] py-[11px] border border-[var(--border)] mb-[11px]" style={{display:'flex', flexDirection:'column', gap:8, alignItems:'center', textAlign:'center', marginBottom:0, opacity:c.dis&&!saving?.55:1 }}>
              <div style={{ fontSize:24 }}>{c.icon}</div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>{c.t}</div>
              <div style={{ fontSize:11, color:'var(--text3)', flex:1 }}>{c.d}</div>
              <Btn v={c.bv} disabled={!!c.dis} onClick={c.fn}>{c.btn}</Btn>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const stepR = {1:s1,2:s2,3:s3,4:s4,5:s5,6:s6,7:s7}
  const cfg = STEPS[step-1]

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 flex flex-col bg-[var(--bg)] text-[var(--text)] font-mono z-[1000]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="h-[46px] bg-[var(--bg2)] border-b border-[var(--border)] flex items-center gap-2 px-3 shrink-0">
        <button onClick={()=>window.close()||navigate('/simulator')} style={{ background:'transparent', border:'none', color:'var(--text2)', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontSize:11, padding:'3px 7px', borderRadius:4 }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M7 2L2 5.5l5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Back
        </button>
        <Sep v />
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="var(--accent)" strokeWidth="1.2"/><path d="M4.5 7h5M7 4.5v5" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round"/></svg>
        <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>Component Editor</span>
        {compType&&<span style={{ fontSize:11, color:'var(--text3)' }}>— {compType}</span>}
        <Sep v />

        {/* Undo / Redo */}
        <Btn v="ghost" sm disabled={!canUndo} onClick={undo} style={{ padding:'2px 8px' }} title="Undo Ctrl+Z">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 5H7a3 3 0 010 6H5M2 5L5 2M2 5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Btn>
        <Btn v="ghost" sm disabled={!canRedo} onClick={redo} style={{ padding:'2px 8px' }} title="Redo Ctrl+Y">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M10 5H5a3 3 0 000 6h2M10 5L7 2M10 5L7 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Btn>
        <Sep v />

        {/* Import */}
        <Btn v="yellow" sm onClick={()=>importRef.current?.click()} title="Import component ZIP to edit">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 7.5V1M3 4.5l2.5 3 2.5-3M1 8.5v1a.5.5 0 00.5.5h8a.5.5 0 00.5-.5v-1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
          Import ZIP
        </Btn>
        <input ref={importRef} type="file" accept=".zip" onChange={handleImport} style={{ display:'none' }} />
        <Sep v />

        {/* Theme toggle */}
        <Btn v="ghost" sm onClick={toggleTheme} title={`Switch to ${theme==='dark'?'light':'dark'} mode`} style={{ padding:'2px 8px' }}>
          {theme==='dark'
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round"/></svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" strokeLinecap="round" strokeLinejoin="round"/></svg>
          }
        </Btn>

        {/* Canvas panel toggle */}
        <Btn v={canvasOpen?'primary':'ghost'} sm onClick={()=>setCanvasOpen(o=>!o)} title="Toggle Canvas Preview" style={{ padding:'2px 8px', marginLeft:'auto' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><rect x="7" y="1" width="4" height="10" rx="1.5" fill="currentColor" opacity=".4"/></svg>
          Canvas
        </Btn>

        {/* Progress dots */}
        <div style={{ display:'flex', gap:3, alignItems:'center' }}>
          {STEPS.map(s=>(
            <div key={s.id} onClick={()=>goToStep(s.id)} title={s.label} style={{ width:s.id===step?18:6, height:6, borderRadius:3, cursor:'pointer', background:s.id===step?'var(--accent)':doneSteps.has(s.id)?'rgba(74,222,128,.4)':'var(--border)', transition:'width .2s' }} />
          ))}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[200px] border-r border-[var(--border)] bg-[var(--bg2)] flex flex-col py-2.5 shrink-0">
          <div style={{ fontSize:9, fontWeight:700, color:'var(--text3)', letterSpacing:'.1em', padding:'0 12px 5px', textTransform:'uppercase' }}>Steps</div>
          {STEPS.map(s=>(
            <button key={s.id} className={`flex items-center gap-2 px-3 py-[7px] w-full text-left text-[11px] cursor-pointer border-l-3 ${(step===s.id) ? "bg-[rgba(74,222,128,.09)] text-[var(--accent)] border-l-[var(--accent)] font-bold" : (doneSteps.has(s.id)) ? "bg-transparent text-[var(--text2)] border-l-transparent font-medium" : "bg-transparent text-[var(--text3)] border-l-transparent font-medium"}`} onClick={()=>goToStep(s.id)}>
              <span className={`w-[18px] h-[18px] rounded-[50%] flex items-center justify-center text-[10px] font-bold shrink-0 ${(step===s.id) ? "bg-[var(--accent)] text-[#000]" : (doneSteps.has(s.id)) ? "bg-[rgba(74,222,128,.3)] text-[var(--accent)]" : "bg-[var(--border)] text-[var(--text3)]"}`}>{doneSteps.has(s.id)&&step!==s.id?'✓':s.id}</span>
              <span style={{ fontSize:11, lineHeight:1.3 }}>{s.label}</span>
            </button>
          ))}
          <div style={{ marginTop:'auto', padding:'11px 9px 0', borderTop:'1px solid var(--border)' }}>
            <button onClick={()=>goToStep(5)} style={{ width:'100%', padding:'6px 9px', borderRadius:5, background:'var(--bg3)', border:'1px dashed var(--border)', color:'var(--text2)', cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', gap:6, fontWeight:600 }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 3l-1 2 1 2M9 3l1 2-1 2M6 1L4 9" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>
              Open Code Editor
            </button>
            <div style={{ fontSize:9, color:'var(--text3)', textAlign:'center', marginTop:3 }}>Skip to Step 5</div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="px-[22px] pt-3 pb-[9px] border-b border-[var(--border)] bg-[var(--bg2)] shrink-0">
            <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', marginBottom:2 }}>
              <span style={{ color:'var(--accent)', marginRight:6 }}>Step {step}:</span>{cfg.label}
            </div>
            <div style={{ fontSize:11, color:'var(--text2)' }}>{cfg.desc}</div>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-[22px] py-4">{stepR[step]?.()}</div>
          <div className="h-[48px] border-t border-[var(--border)] bg-[var(--bg2)] flex items-center justify-between px-[18px] shrink-0">
            <Btn v="ghost" onClick={goPrev} disabled={step===1}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M7 1.5L3 5l4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Previous
            </Btn>
            <span style={{ fontSize:10, color:'var(--text3)' }}>{step} / {STEPS.length}</span>
            {step===7
              ? <Btn v="green" onClick={handleDownload}>⬇ Download ZIP</Btn>
              : <Btn v="primary" onClick={goNext}>
                  {step===6?'Finish':'Next'}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </Btn>
            }
          </div>
        </main>

        {/* ── Collapsible Canvas Panel ───────────────────────────────────────── */}
        <CanvasPanel
          open={canvasOpen}
          onToggle={()=>setCanvasOpen(o=>!o)}
          svgCode={svgCode}
          reactCode={reactCode}
          imageMode={svgMode}
          compW={compW} compH={compH}
          bounds={bounds} pins={pins}
          ctxDuringRun={ctxDuringRun}
          ctxOnlyDuringRun={ctxOnlyDuringRun}
          compType={compType}
          compLabel={compLabel||'My Component'}
        />
      </div>
    </div>
  )
}

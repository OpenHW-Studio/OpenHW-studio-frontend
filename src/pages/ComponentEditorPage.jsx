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
import * as ReactJsxRuntime from 'react/jsx-runtime'
import * as ReactJsxDevRuntime from 'react/jsx-dev-runtime'
import * as EmulatorComponents from '@openhw/emulator'

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
  { id:5, label:'Context Windows',   desc:'Write the ContextMenu component and preview it live' },
  { id:6, label:'Simulation',        desc:'Write logic.ts, validation.ts and ui.tsx' },
  { id:7, label:'Docs',              desc:'Documentation HTML page' },
  { id:8, label:'Save & Export',     desc:'Download ZIP or test in simulator' },
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
// ── Context-menu code separator written into ui.tsx ──────────────────────
const CTX_MENU_MARKER = '// ── Context Menu ─────────────────────────────────────────────────────────'

function evalTranspiledReactModule(transformedCode) {
  const exportsObj = {}
  const normalizeChildrenKeys = (value) => {
    if (!Array.isArray(value)) return value
    return value.map((child, idx) => {
      if (Array.isArray(child)) return normalizeChildrenKeys(child)
      if (React.isValidElement(child) && child.key == null) {
        return React.cloneElement(child, { key: `auto_${idx}` })
      }
      return child
    })
  }

  const normalizeProps = (props) => {
    if (!props || typeof props !== 'object') return props
    if (!Object.prototype.hasOwnProperty.call(props, 'children')) return props
    return { ...props, children: normalizeChildrenKeys(props.children) }
  }

  const jsxRuntime = {
    jsx: (type, props, key) => (ReactJsxRuntime.jsx || React.createElement)(type, normalizeProps(props), key),
    jsxs: (type, props, key) => (ReactJsxRuntime.jsxs || React.createElement)(type, normalizeProps(props), key),
    jsxDEV: (type, props, key, isStaticChildren, source, self) => (ReactJsxDevRuntime.jsxDEV || React.createElement)(type, normalizeProps(props), key, isStaticChildren, source, self),
    Fragment: ReactJsxRuntime.Fragment || React.Fragment,
  }
  const reactModule = { __esModule: true, default: React, ...React }
  const refreshSig = () => () => {}
  const refreshReg = () => {}
  const stableS = () => {}
  // Provide common React hooks as function args so user code that references
  // bare hook names (e.g. useRef) still works after import stripping.
  // eslint-disable-next-line no-new-func
  const evalFn = new Function(
    'exports', 'require', 'React',
    '_s', '$RefreshSig$', '$RefreshReg$',
    'jsx', 'jsxs', 'jsxDEV', 'Fragment',
    'useState', 'useRef', 'useEffect', 'useMemo', 'useCallback',
    'useReducer', 'useLayoutEffect', 'useImperativeHandle', 'useContext',
    'useId', 'useDeferredValue', 'useTransition', 'useSyncExternalStore',
    transformedCode
  )
  evalFn(
    exportsObj,
    (m) => {
      if (m === 'react') return reactModule
      if (m === 'react/jsx-runtime') return ReactJsxRuntime
      if (m === 'react/jsx-dev-runtime') return ReactJsxDevRuntime
      return null
    },
    React,
    stableS,
    refreshSig,
    refreshReg,
    jsxRuntime.jsx,
    jsxRuntime.jsxs,
    jsxRuntime.jsxDEV,
    jsxRuntime.Fragment,
    React.useState,
    React.useRef,
    React.useEffect,
    React.useMemo,
    React.useCallback,
    React.useReducer,
    React.useLayoutEffect,
    React.useImperativeHandle,
    React.useContext,
    React.useId,
    React.useDeferredValue,
    React.useTransition,
    React.useSyncExternalStore,
  )
  return exportsObj
}

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

  // Context-menu block — appended at the bottom when the user has written one
  const ctxBlock = d.ctxMenuCode?.trim()
    ? `\n\n${CTX_MENU_MARKER}\n${d.ctxMenuCode.trim()}\n`
    : ''

  // React JSX mode — embed the user's exported component directly
  if (d.imageMode === 'react' && d.reactCode?.trim()) {
    return `import React from 'react';\n\n${boundsLine}${ctxLines}\n// ── Component UI (React mode) ──────────────────────────────────────\n${d.reactCode}\n${ctxBlock}`
  }

  // SVG mode — wrap SVG in a div.
  // svgToFluid converts fixed width/height to 100%/100% so the SVG always fills
  // its container (the comp.w × comp.h div in the simulator) without overflowing.
  const rawSvg = d.svgCode || `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="2" width="${w-4}" height="${h-4}" rx="6" fill="#1e1e2e" stroke="#4ade80" strokeWidth="2"/>
  <text x="${w/2}" y="${h/2+4}" textAnchor="middle" fill="#4ade80" fontSize="11" fontFamily="monospace">${d.label||'Component'}</text>
</svg>`
  const svg = svgToFluid(rawSvg).split('\n').join('\n            ')
  return `import React from 'react';\n\n${boundsLine}${ctxLines}\nexport const ${name}UI = ({ state, attrs, isRunning }: { state:any; attrs:any; isRunning:boolean }) => (\n    <div style={{ pointerEvents:'none', position:'absolute', inset:0 }}>\n        ${svg}\n    </div>\n);\n${ctxBlock}`
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
  const hasCtxMenu = !!d.ctxMenuCode?.trim()
  const ctxMenuImport = hasCtxMenu ? `, ContextMenu` : ''
  const ctxMenuExport = hasCtxMenu ? `\n    ContextMenu,` : ''
  return `import manifest from './manifest.json';\nimport { ${name}UI, BOUNDS${extras.length?', '+extras.join(', '):''}${ctxMenuImport} } from './ui';\nimport { ${name}Logic } from './logic';\nimport { validation } from './validation';\n\nexport default {\n    manifest,\n    UI: ${name}UI,\n    LogicClass: ${name}Logic,\n    BOUNDS,\n    validation,${extras.map(e=>`\n    ${e},`).join('')}${ctxMenuExport}\n};\n`
}

function genDocsHTML(d) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>${d.label||'Component'}</title><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;background:#0f0f0f;color:#e0e0e0;line-height:1.6}h1{color:#4ade80}h2{color:#86efac;border-bottom:1px solid #333;padding-bottom:8px}code{background:#1e1e2e;padding:2px 6px;border-radius:4px;font-family:monospace}pre{background:#1e1e2e;padding:16px;border-radius:8px}table{width:100%;border-collapse:collapse}td,th{padding:8px 12px;border:1px solid #333}th{background:#1e1e2e;color:#4ade80}</style></head><body><h1>${d.label||'Component'}</h1><p>${d.description||''}</p><h2>Pinout</h2><table><tr><th>Pin</th><th>Type</th><th>Description</th></tr>${(d.pins||[]).map(p=>`<tr><td><code>${p.id}</code></td><td>${p.type}</td><td>${p.description||''}</td></tr>`).join('')}</table><h2>Usage</h2><pre><code>// TODO</code></pre><h2>Notes</h2><ul><li>Size: ${d.w}×${d.h} px</li><li>Pins: ${(d.pins||[]).length}</li></ul></body></html>`
}

function genContextMenuTemplate(d) {
  const label = d?.label || 'Component'
  const key = (label || 'component').toLowerCase().replace(/[^a-z0-9]+/g, '_')
  return `// Auto-generated ContextMenu for ${label}
// Props: attrs (object), onUpdate (key: string, value: any) => void

export const ContextMenu = ({ attrs, onUpdate }) => {
  const enabledKey = '${key}_enabled';
  const valueKey = '${key}_value';
  const modeKey = '${key}_mode';

  const enabled = attrs?.[enabledKey] ?? true;
  const value = attrs?.[valueKey] ?? 128;
  const mode = attrs?.[modeKey] ?? 'default';

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
      <span style={{ fontSize:11, fontWeight:700, color:'#94a3b8' }}>${label}</span>

      <label style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11, color:'#e2e8f0' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => onUpdate(enabledKey, e.target.checked)}
        />
        Enabled
      </label>

      <label style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11, color:'#e2e8f0' }}>
        Value
        <input
          type="range"
          min={0}
          max={255}
          value={value}
          onChange={e => onUpdate(valueKey, +e.target.value)}
          style={{ width:120 }}
        />
        <span style={{ minWidth:28, textAlign:'right', color:'#a5f3fc' }}>{value}</span>
      </label>

      <label style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11, color:'#e2e8f0' }}>
        Mode
        <select
          value={mode}
          onChange={e => onUpdate(modeKey, e.target.value)}
          style={{ background:'#1e293b', color:'#e2e8f0', border:'1px solid #334155', borderRadius:6, padding:'3px 6px', fontSize:11 }}
        >
          <option value="default">default</option>
          <option value="fast">fast</option>
          <option value="safe">safe</option>
        </select>
      </label>
    </div>
  );
};
`
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
      // Find something exported that looks like a component
      const exportsUI = evalTranspiledReactModule(transformed)
      const keys = Object.keys(exportsUI)
      const compKey = keys.find(k => /ui|component|view|preview/i.test(k)) || keys[0]
      const Comp = exportsUI[compKey]
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
      const exportsUI = evalTranspiledReactModule(transformed)
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
      id: USER_COMP_ID,
      type: compType||'custom',
      label: compLabel||'My Component',
      x: 0,
      y: 0,
      w,
      h,
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
function Btn({ children, onClick, v='def', sm, disabled, style:xs, title }) {
  const base = {
    padding: sm ? '5px 12px' : '8px 18px',
    borderRadius: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: sm ? '11px' : '13px',
    fontWeight: 600,
    border: '1px solid transparent',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    opacity: disabled ? 0.4 : 1,
    whiteSpace: 'nowrap',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    fontFamily: 'inherit',
    ...xs
  }

  const variants = {
    def: {
      background: 'var(--bg3)',
      color: 'var(--text)',
      borderColor: 'var(--border)',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    primary: {
      background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
      color: '#fff',
      boxShadow: '0 4px 12px rgba(0, 212, 255, 0.25)',
      textShadow: '0 1px 2px rgba(0,0,0,0.1)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text2)',
      borderColor: 'var(--border)',
    },
    danger: {
      background: 'rgba(239, 68, 68, 0.1)',
      color: '#ef4444',
      borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    green: {
      background: 'rgba(34, 197, 94, 0.1)',
      color: '#22c55e',
      borderColor: 'rgba(34, 197, 94, 0.2)',
    },
    yellow: {
      background: 'rgba(234, 179, 8, 0.1)',
      color: '#eab308',
      borderColor: 'rgba(234, 179, 8, 0.2)',
    },
    blue: {
      background: 'rgba(59, 130, 246, 0.1)',
      color: '#3b82f6',
      borderColor: 'rgba(59, 130, 246, 0.2)',
    }
  }

  return (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      title={title}
      style={{ ...base, ...variants[v] }}
      className="hover:-translate-y-px hover:brightness-110 active:translate-y-0"
    >
      {children}
    </button>
  )
}

const Sep = ({ v }) => (
  <div style={v 
    ? { width: 1, height: 20, background: 'var(--border)', margin: '0 8px', alignSelf: 'center' } 
    : { height: 1, background: 'var(--border)', margin: '16px 0', opacity: 0.6 }
  } />
)

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

  // ── Step 5 — Context Windows ─────────────────────────────────────────────
  const [ctxMenuCode, setCtxMenuCode] = useState('')
  const [ctxMenuZoom, setCtxMenuZoom] = useState(1)

  // ── Step 6 ────────────────────────────────────────────────────────────────
  const [codeTab,      setCodeTab]      = useState('logic')
  const [logicCode,    setLogicCode]    = useState('')
  const [validCode,    setValidCode]    = useState('')
  const [uiCode,       setUiCode]       = useState('')
  const [indexCode,    setIndexCode]    = useState('')
  const [manifestCode, setManifestCode] = useState('')
  const uiEdited = useRef(false)

  // ── Step 7 ────────────────────────────────────────────────────────────────
  const [docsCode,    setDocsCode]    = useState('')
  const [docsPreview, setDocsPreview] = useState(false)

  // ── UI ────────────────────────────────────────────────────────────────────
  const [step,      setStep]      = useState(1)
  const [doneSteps, setDoneSteps] = useState(new Set())
  const [canvasOpen,setCanvasOpen]= useState(true)
  const [saving,    setSaving]    = useState(false)
  const [s2EditorFont, setS2EditorFont] = useState(13)

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
    svgCode, reactCode, imageMode:svgMode, bounds, pins, ctxMenuCode,
  }), [compType,compLabel,compDesc,compGroup,compW,compH,ctxDuringRun,ctxOnlyDuringRun,svgCode,reactCode,svgMode,bounds,pins,ctxMenuCode])

  // ── Dynamic warnings — reactive, no stale state ───────────────────────────
  const autoWarnings = useMemo(() => [
    !compType    && 'Component type is empty — set it in Step 1.',
    svgMode !== 'react' && !svgCode && 'No SVG defined — add art in Step 2.',
    svgMode === 'react' && !reactCode && 'No React component defined — write JSX in Step 2.',
    !pins.length && 'No pins defined — add them in Step 4.',
  ].filter(Boolean), [compType, svgCode, reactCode, svgMode, pins.length])

  // ── Shared helper: parse a ui.tsx string into { reactCode, svgCode, svgMode, ctxMenuCode }
  // Works for both marker-based (our editor) and raw TypeScript files (Edit-a-Copy).
  const parseUISource = useCallback((src) => {
    // Normalize line endings so regexes work on Windows files too
    const s = (src || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const ctxExportRegex = /(export\s+(?:default\s+)?(?:const|function|class)\s+[A-Za-z0-9_]*ContextMenu[A-Za-z0-9_]*[\s\S]*?)(?=\nexport\s+|$)/i
    const uiExportRegex = /(export\s+(?:default\s+)?(?:const|function|class)\s+[A-Za-z0-9_]*(?:UI|View|Component)[A-Za-z0-9_]*\b[\s\S]*?)(?=\nexport\s+|$)/i

    // ── 1. Extract ContextMenu block ──────────────────────────────────────────
    let ctxCode = ''
    const markerIdx = s.indexOf(CTX_MENU_MARKER)
    if (markerIdx !== -1) {
      // Method A: our generated marker separator
      ctxCode = s.substring(markerIdx + CTX_MENU_MARKER.length).trim()
    } else {
      // Method B: detect any exported symbol whose name contains "ContextMenu"
      const m = s.match(ctxExportRegex)
      if (m) ctxCode = m[0].trim()
    }

    // ── 2. Get the UI-only body (strip ctx block when marker was used) ─────────
    let uiSrc = markerIdx !== -1 ? s.substring(0, markerIdx).trim() : s
    if (ctxCode) {
      uiSrc = uiSrc.replace(ctxExportRegex, '').trim()
    }

    // ── 3. Determine mode and extract the visual component code ───────────────
    let outReactCode = '', outSvgCode = '', outMode = 'code'

    // 3a. Our generated React-mode marker
    const reactMarker = '// ── Component UI (React mode) ──────────────────────────────────────'
    const reactMarkerIdx = uiSrc.indexOf(reactMarker)
    if (reactMarkerIdx !== -1) {
      const reactBody = uiSrc.substring(reactMarkerIdx + reactMarker.length).trim()
      const uiOnly = reactBody.match(uiExportRegex)
      outReactCode = (uiOnly ? uiOnly[0] : reactBody).trim()
      outMode = 'react'
    } else if (
      /import\s+React|from\s+['"]react(?:\/jsx-runtime)?['"]/.test(uiSrc)
      || /export\s+(?:default\s+)?(?:const|function)\s+\w*(?:UI|View|Component)\b/.test(uiSrc)
    ) {
      // 3b. Raw TypeScript React file — keep only the visual UI export for Step 2 editor.
      const uiOnly = uiSrc.match(uiExportRegex)
      outReactCode = (uiOnly ? uiOnly[0] : uiSrc).trim()
      outMode = 'react'
    } else {
      // 3c. SVG mode — pull out the inline SVG element
      const svgM = uiSrc.match(/<svg[\s\S]*?<\/svg>/)
      if (svgM) { outSvgCode = svgM[0]; outMode = 'code' }
      else if (uiSrc.trim()) {
        // Fallback: keep non-empty source visible in the editor instead of blank panes.
        outReactCode = uiSrc.trim()
        outMode = 'react'
      }
    }

    return { reactCode: outReactCode, svgCode: outSvgCode, svgMode: outMode, ctxMenuCode: ctxCode }
  }, [])

  // ── Import "Edit a Copy" data from Simulator ──────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem('openhw_edit_copy')
    if (raw) {
      try {
        const data = JSON.parse(raw)
        localStorage.removeItem('openhw_edit_copy')
        if (data.manifest) {
          const m = data.manifest
          setCompType((m.type || 'component') + '-copy')
          setCompLabel((m.label || 'Component') + ' (Copy)')
          setCompDesc(m.description || '')
          setCompGroup(m.group || 'Other')
          setCompW(m.w || 100)
          setCompH(m.h || 80)
          setPins(m.pins || [])
          setCtxDuringRun(!!m.contextMenuDuringRun)
          setCtxOnlyDuringRun(!!m.contextMenuOnlyDuringRun)
          // Extract bounds from UI string if available
          if (data.ui) {
            const n = data.ui.replace(/\r\n/g, '\n')
            const bMatch = n.match(/BOUNDS\s*=\s*\{\s*x:\s*([\d.-]+)[^}]*y:\s*([\d.-]+)[^}]*w:\s*([\d.-]+)[^}]*h:\s*([\d.-]+)/);
            if (bMatch) {
              setBounds({ x: parseFloat(bMatch[1]), y: parseFloat(bMatch[2]), w: parseFloat(bMatch[3]), h: parseFloat(bMatch[4]) });
            } else {
              setBounds({ x: 5, y: 5, w: (m.w || 100) - 10, h: (m.h || 80) - 10 })
            }
          }
        }
        if (data.ui) {
          const { reactCode: rc, svgCode: sc, svgMode: sm, ctxMenuCode: ctx } = parseUISource(data.ui)
          setCtxMenuCode(ctx || '')
          if (sm === 'react') { setReactCode(rc); setSvgMode('react') }
          else if (sm === 'code' && sc) { setSvgCode(sc); setSvgMode('code') }
          uiEdited.current = true
          setUiCode(data.ui)
        }
        if (data.logic) setLogicCode(data.logic)
        if (data.validation) setValidCode(data.validation)
        if (data.index) setIndexCode(data.index)
        if (data.docs) setDocsCode(data.docs)
      } catch (e) {
        console.error('[Editor] Failed to import Edit a Copy data:', e)
      }
    }
  }, [])

  // ── Auto-regenerate manifest + index ──────────────────────────────────────
  useEffect(() => {
    const d = getData()
    setManifestCode(genManifest(d))
    setIndexCode(genIndexCode(d))
  }, [compType,compLabel,compDesc,compGroup,compW,compH,ctxDuringRun,ctxOnlyDuringRun,bounds,pins,ctxMenuCode])

  useEffect(() => {
    if (!uiEdited.current) setUiCode(genUICode(getData()))
  }, [svgCode,reactCode,svgMode,bounds,compW,compH,compType,compLabel,ctxDuringRun,ctxOnlyDuringRun,ctxMenuCode])

  // ── Nav ───────────────────────────────────────────────────────────────────
  const mark = (s) => setDoneSteps(p=>new Set([...p,s]))
  const goToStep = (n) => { mark(step); setStep(n) }
  const goNext = () => {
    if (step===5) { if (!logicCode) setLogicCode(genLogicCode(getData())); if (!validCode) setValidCode(genValidationCode(getData())) }
    if (step===7 && !docsCode) setDocsCode(genDocsHTML(getData()))
    mark(step); if (step<8) setStep(s=>s+1)
  }
  const goPrev = () => { if (step>1) setStep(s=>s-1) }

  // ── Generate all ──────────────────────────────────────────────────────────
  const genAll = () => {
    const shouldRegenerate = window.confirm('Regenerate all files? This will erase your current code in Step 6 and replace it with generated defaults.')
    if (!shouldRegenerate) return
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
        // Use shared parser — handles CRLF, marker, regex, boilerplate strip
        const { reactCode: rc, svgCode: sc, svgMode: sm, ctxMenuCode: ctx } = parseUISource(uiStr)
        setCtxMenuCode(ctx || '')
        if (sm === 'react') { setSvgMode('react'); setReactCode(rc) }
        else if (sm === 'code' && sc) { setSvgCode(sc); setSvgMode('code') }

        uiEdited.current = true; setUiCode(uiStr)

        // Extract BOUNDS from the raw source
        const normalized = uiStr.replace(/\r\n/g, '\n')
        const bm = normalized.match(/BOUNDS\s*=\s*\{\s*x:\s*([\d.-]+)[^}]*y:\s*([\d.-]+)[^}]*w:\s*([\d.-]+)[^}]*h:\s*([\d.-]+)/)
        if (bm) setBounds({ x:+bm[1], y:+bm[2], w:+bm[3], h:+bm[4] })
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800 }}>
      <div style={{ padding: '16px 20px', background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.15)', borderRadius: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 20 }}>💡</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          Start by defining the core identity of your component. These fields automatically populate your 
          <code>manifest.json</code>, <code>index.ts</code>, and <code>ui.tsx</code> files. 
          Use clear, descriptive labels to help others understand your component.
        </div>
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 24, boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Component Type *</label>
            <input 
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '10px 14px', fontSize: 14, outline: 'none', transition: 'border-color 0.2s' }}
              placeholder="e.g. pressure-sensor" 
              value={compType}
              onChange={e=>setCompType(e.target.value.toLowerCase().replace(/\s/g,'-'))} 
              onBlur={pushHist}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            />
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>A unique URL-safe identifier (e.g., <code>my-awesome-led</code>)</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Display Label *</label>
            <input 
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '10px 14px', fontSize: 14, outline: 'none', transition: 'border-color 0.2s' }}
              placeholder="e.g. BMP280 Sensor" 
              value={compLabel}
              onChange={e=>setCompLabel(e.target.value)} 
              onBlur={pushHist}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            />
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>How the component appears in the library palette.</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Description</label>
          <textarea 
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '10px 14px', fontSize: 14, outline: 'none', minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="Describe what this component simulates..." 
            value={compDesc}
            onChange={e=>setCompDesc(e.target.value)} 
            onBlur={pushHist}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 300 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Category Group</label>
          <select 
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '10px 14px', fontSize: 14, outline: 'none', cursor: 'pointer' }}
            value={compGroup}
            onChange={e=>{ setCompGroup(e.target.value); pushHist() }}>
            {GROUPS.map(g=><option key={g}>{g}</option>)}
          </select>
        </div>
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>⚙️</span> Advanced UX Options
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { v:ctxDuringRun,    s:setCtxDuringRun,    n:'contextMenuDuringRun',    d:'Allows users to open the context menu even while simulation is active. Useful for live controls like sliders or buttons.' },
            { v:ctxOnlyDuringRun,s:setCtxOnlyDuringRun,n:'contextMenuOnlyDuringRun',d:'Hides the context menu when simulation is stopped. Use this for run-time only configuration.' },
          ].map(row=>(
            <label key={row.n} style={{ display:'flex', alignItems:'flex-start', gap:16, cursor:'pointer', padding: '12px', borderRadius: 12, background: row.v ? 'rgba(0, 212, 255, 0.05)' : 'transparent', border: `1px solid ${row.v ? 'rgba(0, 212, 255, 0.2)' : 'transparent'}`, transition: 'all 0.2s' }}>
              <input type="checkbox" checked={row.v} onChange={e=>{row.s(e.target.checked); pushHist()}}
                style={{ marginTop:4, width:18, height:18, accentColor:'var(--accent)', flexShrink:0, cursor: 'pointer' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <strong style={{ fontSize:14, color: row.v ? 'var(--accent)' : 'var(--text)' }}>{row.n}</strong>
                <span style={{ fontSize:12, color:'var(--text3)', lineHeight: 1.5 }}>{row.d}</span>
              </div>
            </label>
          ))}
        </div>
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
      <div style={{ display:'flex', gap:24, height:'100%', alignItems: 'stretch' }}>
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:16, minWidth:0 }}>
          <div style={{ display:'flex', gap:8, background: 'var(--bg2)', padding: 6, borderRadius: 12, border: '1px solid var(--border)', width: 'fit-content' }}>
            <button 
              onClick={()=>setSvgMode('code')}
              style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: svgMode==='code' ? 'var(--accent)' : 'transparent', color: svgMode==='code' ? '#fff' : 'var(--text2)' }}
            >SVG Code</button>
            <button 
              onClick={()=>setSvgMode('upload')}
              style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: svgMode==='upload' ? 'var(--accent)' : 'transparent', color: svgMode==='upload' ? '#fff' : 'var(--text2)' }}
            >Upload SVG</button>
            <button 
              onClick={()=>setSvgMode('react')}
              style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: svgMode==='react' ? 'var(--accent)' : 'transparent', color: svgMode==='react' ? '#fff' : 'var(--text2)' }}
            >React JSX</button>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', minHeight: 0 }}>
            {svgMode==='upload' && (
              <div 
                onClick={()=>svgFileRef.current?.click()} 
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, cursor:'pointer', padding: 40, border: '2px dashed var(--border)', margin: 16, borderRadius: 12, transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ fontSize:48, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.2))' }}>📤</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize:15, fontWeight: 700, color:'var(--text)', marginBottom: 4 }}>Upload Vector Artwork</div>
                  <div style={{ fontSize:12, color:'var(--text3)' }}>Supports .svg files. Best results with simple shapes.</div>
                </div>
                {svgCode && <div style={{ fontSize:12, color:'var(--green)', fontWeight: 600, background: 'rgba(34,197,94,0.1)', padding: '6px 12px', borderRadius: 20 }}>✓ {svgCode.length.toLocaleString()} bytes loaded</div>}
              </div>
            )}
            {(svgMode==='code' || svgMode==='react') && (
              <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight: 0 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize:11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Editor</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize:10, color: 'var(--text3)' }}>{svgMode==='react' ? 'TypeScript / JSX' : 'XML / SVG'}</span>
                    <button onClick={() => setS2EditorFont(f => Math.max(11, f - 1))} style={{ padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text2)', cursor: 'pointer', fontSize: 11 }}>A-</button>
                    <button onClick={() => setS2EditorFont(f => Math.min(20, f + 1))} style={{ padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text2)', cursor: 'pointer', fontSize: 11 }}>A+</button>
                  </div>
                </div>
                <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                  <Editor 
                    value={svgMode === 'react' ? reactCode : svgCode} 
                    onValueChange={svgMode === 'react' ? setReactCode : setSvgCode}
                    highlight={c=>Prism.highlight(c||'', svgMode==='react' ? Prism.languages.javascript : Prism.languages.markup, svgMode==='react' ? 'javascript' : 'markup')}
                    padding={16} 
                    style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:s2EditorFont, lineHeight:1.6, minHeight:'100%', color:'var(--text)', background:'transparent', whiteSpace:'pre', overflowX:'auto', overflowY:'auto' }}
                    placeholder={svgMode === 'react' ? 'export const MyUI = () => ...' : '<svg ...>'}
                  />
                </div>
              </div>
            )}
          </div>
          <input ref={svgFileRef} type="file" accept=".svg,image/svg+xml" onChange={handleSvgUpload} style={{ display:'none' }} />
        </div>

        {/* Preview Area */}
        <div style={{ width:400, flexShrink:0, display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize:12, fontWeight:700, color:'var(--text)', letterSpacing: '0.05em' }}>PREVIEW</span>
              <div style={{ display: 'flex', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffbd2e' }} />
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#27c93f' }} />
              </div>
            </div>
            
            <div 
              style={{ 
                width:'100%', height:300, 
                backgroundColor:'var(--canvas-bg)', 
                backgroundImage:`linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)`,
                backgroundSize:`${gridPx}px ${gridPx}px`,
                borderRadius: 12, border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', position: 'relative'
              }}
            >
              {isReact
                ? <ReactPreview reactCode={reactCode} compW={compW} compH={compH} zoom={zoom} />
                : <SvgPreview svgCode={svgCode} compW={compW} compH={compH} zoom={zoom} />
              }
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ZoomBar zoom={zoom} onZoom={setS2Zoom} onFit={()=>setS2Zoom(null)} fitZoom={fz} />
              <div style={{ height: 1, background: 'var(--border)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)' }}>
                <span>Dimension: {compW} × {compH} px</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Grid: {GRID}px</span>
              </div>
              <Btn v="blue" onClick={()=>setCanvasOpen(true)} style={{ width: '100%', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="10" height="10" rx="2"/><circle cx="7" cy="7" r="2"/></svg>
                View on Canvas
              </Btn>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Step 3
  // ─────────────────────────────────────────────────────────────────────────
  const s3 = () => {
    const maxW=400, maxH=350
    const fz = fitZoom(maxW, maxH)
    const zoom = s3Zoom ?? fz
    const scale = zoom
    const gridPx = GRID * scale
    const imgPreview = svgMode === 'react'
      ? <ReactPreview reactCode={reactCode} compW={compW} compH={compH} zoom={scale} />
      : <SvgPreview svgCode={svgCode} compW={compW} compH={compH} zoom={scale} />
    return (
      <div style={{ display:'flex', gap:32, alignItems: 'flex-start' }}>
        <div style={{ flex:1, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ padding: '16px 20px', background: 'rgba(96, 165, 250, 0.05)', border: '1px solid rgba(96, 165, 250, 0.15)', borderRadius: 12, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
            Define the physical footprint and interaction area. Adjusting <strong>Canvas Size</strong> changes the total area, while 
            <strong style={{ color: 'var(--accent)' }}> BOUNDS</strong> defines the inner clickable "hit-box".
          </div>

          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 24, boxShadow: 'var(--shadow)' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>📏 Canvas Footprint</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {[
                  ['Canvas Width', 'w', compW, v=>{setCompW(v);setBounds(b=>({...b,w:Math.max(GRID,v-26)}))}],
                  ['Canvas Height', 'h', compH, v=>{setCompH(v);setBounds(b=>({...b,h:Math.max(GRID,v-14)}))}]
                ].map(([lbl, key, val, updater]) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>{lbl}</label>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '2px 4px' }}>
                      <input 
                        type="number" 
                        value={val} 
                        onChange={e => updater(Number(e.target.value))}
                        onBlur={pushHist}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text)', padding: '8px 10px', fontSize: 14, width: '100%', outline: 'none' }} 
                      />
                      <span style={{ fontSize: 11, color: 'var(--text3)', paddingRight: 8 }}>px</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border)' }} />

            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                🎯 Interaction Bounds (Hit Box)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {['x','y','w','h'].map(k=>(
                  <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>{k}</label>
                    <input 
                      type="number" 
                      value={bounds[k]} 
                      onChange={e=>setBounds(b=>({...b,[k]:Number(e.target.value)}))} 
                      onBlur={pushHist}
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '8px 10px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }} 
                    />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text2)' }}>
                export const <span style={{ color: 'var(--accent)' }}>BOUNDS</span> = &#123; x:{bounds.x}, y:{bounds.y}, w:{bounds.w}, h:{bounds.h} &#125;;
              </div>
            </div>

            <div 
              style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px', background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}
            >
              <div style={{ flex: 1, display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 18 }}>🖱️</span>
                <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>Editing Mode</span>
              </div>
              <div style={{ display: 'flex', gap: 4, background: 'var(--bg2)', padding: 4, borderRadius: 8 }}>
                <button 
                  onClick={()=>setResizeMode('comp')}
                  style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', background: resizeMode === 'comp' ? 'var(--accent)' : 'transparent', color: resizeMode === 'comp' ? '#fff' : 'var(--text3)' }}
                >Canvas</button>
                <button 
                  onClick={()=>setResizeMode('bounds')}
                  style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', background: resizeMode === 'bounds' ? 'var(--accent)' : 'transparent', color: resizeMode === 'bounds' ? '#fff' : 'var(--text3)' }}
                >Bounds</button>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Preview */}
        <div style={{ width:420, flexShrink:0, display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow)' }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase' }}>Placement Preview</span>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                  <div style={{ width:6, height:6, borderRadius:1, background: 'rgba(74,222,128,.8)' }} />
                  <span style={{ fontSize:9, color:'var(--text3)' }}>BOUNDS</span>
                </div>
                <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                  <div style={{ width:6, height:6, borderRadius:1, background: 'rgba(96,165,250,.8)' }} />
                  <span style={{ fontSize:9, color:'var(--text3)' }}>CANVAS</span>
                </div>
              </div>
            </div>

            <div 
              style={{ 
                width: '100%', height: 350, 
                backgroundColor:'var(--canvas-bg)', 
                backgroundImage:`linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)`,
                backgroundSize:`${gridPx}px ${gridPx}px`,
                borderRadius: 12, border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', position: 'relative'
              }}
            >
              <div style={{ position:'relative', width:Number(compW)*scale, height:Number(compH)*scale }}>
                {imgPreview}
                {resizeMode==='bounds'
                  ? <DragResizeBox bx={bounds.x} by={bounds.y} bw={bounds.w} bh={bounds.h} scale={scale} color="var(--accent)"
                      label={`BOUNDS`}
                      onChange={v=>setBounds(v)} onEnd={pushHist} />
                  : <div style={{ position:'absolute', pointerEvents:'none', left:bounds.x*scale, top:bounds.y*scale, width:bounds.w*scale, height:bounds.h*scale, border:'2px solid var(--accent)', background:'rgba(0, 212, 255, 0.05)', borderRadius: 2 }} />
                }
                {resizeMode==='comp' && (
                  <DragResizeBox bx={0} by={0} bw={Number(compW)} bh={Number(compH)} scale={scale} color="#3b82f6"
                    label={`${compW}×${compH}`} noMove onlyEdges
                    onChange={v=>{ setCompW(v.w); setCompH(v.h) }} onEnd={pushHist} />
                )}
              </div>
            </div>

            <div style={{ marginTop: 16, display:'flex', flexDirection:'column', gap:10 }}>
              <ZoomBar zoom={scale} onZoom={setS3Zoom} onFit={()=>setS3Zoom(null)} fitZoom={fz} />
              <Btn v="ghost" sm onClick={()=>setCanvasOpen(true)} style={{ width: '100%', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><rect x="1" y="1" width="10" height="10" rx="1.5"/><circle cx="6" cy="6" r="1.5"/></svg>
                Check on Simulation Grid
              </Btn>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Step 4
  // ─────────────────────────────────────────────────────────────────────────
  const s4 = () => {
    const fz = fitZoom(400, 350)
    const zoom = s4Zoom ?? fz
    const scale = zoom
    const gridPx = GRID * scale
    const ui = svgMode === 'react'
      ? <ReactPreview reactCode={reactCode} compW={compW} compH={compH} zoom={scale} />
      : <SvgPreview svgCode={svgCode} compW={compW} compH={compH} zoom={scale} />

    return (
      <div style={{ display:'flex', gap:32, alignItems: 'flex-start' }}>
        <div style={{ flex:1, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ padding: '16px 20px', background: 'rgba(236, 72, 153, 0.05)', border: '1px solid rgba(236, 72, 153, 0.15)', borderRadius: 12, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
            Define connection points for wires. Pins must align to the <strong style={{ color: 'var(--accent)' }}>{GRID}px grid</strong> for correct circuit behavior.
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>Pins <span style={{ color: 'var(--text3)', fontWeight: 500, marginLeft: 4 }}>({pins.length})</span></div>
              <div style={{ height: 16, width: 1, background: 'var(--border)' }} />
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{pinPlacing ? 'Click on preview to place' : 'Management'}</div>
            </div>
            <Btn v={pinPlacing ? 'danger' : 'primary'} onClick={()=>setPlacing(!pinPlacing)}>
              {pinPlacing ? '🛑 Cancel' : '➕ Add Pin'}
            </Btn>
          </div>

          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            <div style={{ maxHeight: 400, overflowY: 'auto' }} className="panel-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ background: 'rgba(255,255,255,0.02)', position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ textAlign: 'left', color: 'var(--text3)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.05em' }}>
                    <th style={{ padding: '12px 20px' }}>Pin ID</th>
                    <th style={{ padding: '12px 20px' }}>Type</th>
                    <th style={{ padding: '12px 20px' }}>Position</th>
                    <th style={{ padding: '12px 20px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pins.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>No pins added yet. Click "Add Pin" to start placing.</td>
                    </tr>
                  ) : (
                    pins.map((p, i) => (
                      <tr 
                        key={i} 
                        style={{ 
                          borderTop: '1px solid var(--border)', 
                          background: editPin === i ? 'rgba(0, 212, 255, 0.05)' : 'transparent',
                          transition: 'background 0.2s'
                        }}
                      >
                        <td style={{ padding: '12px 20px' }}>
                          <input 
                            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '6px 10px', fontSize: 13, outline: 'none', width: '100%' }}
                            value={p.id} 
                            onChange={e => setPins(ps => ps.map((x, j) => j === i ? { ...x, id: e.target.value } : x))} 
                            onBlur={pushHist}
                          />
                        </td>
                        <td style={{ padding: '12px 20px' }}>
                          <select 
                            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '6px 10px', fontSize: 13, outline: 'none', width: '100%' }}
                            value={p.type}
                            onChange={e => { setPins(ps => ps.map((x, j) => j === i ? { ...x, type: e.target.value } : x)); pushHist() }}
                          >
                            {PIN_TYPES.map(t => <option key={t}>{t}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '12px 20px' }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>X</span>
                            <input type="number" style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '6px 8px', fontSize: 12, outline: 'none', width: 45 }} value={p.x} onChange={e => setPins(ps => ps.map((x, j) => j === i ? { ...x, x: +e.target.value } : x))} onBlur={pushHist} />
                            <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>Y</span>
                            <input type="number" style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '6px 8px', fontSize: 12, outline: 'none', width: 45 }} value={p.y} onChange={e => setPins(ps => ps.map((x, j) => j === i ? { ...x, y: +e.target.value } : x))} onBlur={pushHist} />
                          </div>
                        </td>
                        <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                          <Btn v="danger" sm onClick={() => { setPins(ps => ps.filter((_, j) => j !== i)); pushHist() }}>✕</Btn>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {pins.length > 0 && (
              <div style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Total: {pins.length} pins</span>
                <span>Pin coordinates are relative to Component (0,0)</span>
              </div>
            )}
          </div>
        </div>

        {/* Visual Preview */}
        <div style={{ width:420, flexShrink:0, display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow)' }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase' }}>Placement View</span>
              <div style={{ fontSize:10, color: pinPlacing ? 'var(--accent)' : 'var(--text3)', fontWeight: 700 }}>
                {pinPlacing ? '📍 CLICK PREVIEW TO PLACE' : 'PREVIEW'}
              </div>
            </div>

            <div 
              onClick={handlePinClick}
              style={{ 
                width: '100%', height: 350, 
                backgroundColor:'var(--canvas-bg)', 
                backgroundImage:`linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)`,
                backgroundSize:`${gridPx}px ${gridPx}px`,
                borderRadius: 12, border: pinPlacing ? '2px solid var(--accent)' : '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', position: 'relative',
                cursor: pinPlacing ? 'crosshair' : 'default',
                transition: 'border-color 0.2s'
              }}
            >
              <div ref={pinInnerRef} style={{ position:'relative', width:Number(compW)*scale, height:Number(compH)*scale }}>
                {ui}
                {pins.map((p,i)=>(
                  <SimPin 
                    key={i} pin={p} zoom={scale} 
                    selected={editPin===i} 
                    onClick={(e)=>{ e.stopPropagation(); setEditPin(editPin===i?null:i) }} 
                  />
                ))}
              </div>
            </div>

            <div style={{ marginTop: 16, display:'flex', flexDirection:'column', gap:12 }}>
              <ZoomBar zoom={scale} onZoom={setS4Zoom} onFit={()=>setS4Zoom(null)} fitZoom={fz} />
              <Btn v="ghost" sm onClick={()=>setCanvasOpen(true)} style={{ width: '100%', justifyContent: 'center' }}>
                Full Circuit Canvas
              </Btn>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Step 5 — Context Windows
  // ─────────────────────────────────────────────────────────────────────────
  const s5 = () => {
    // Live compile & render the ContextMenu component
    let liveCtxEl = null
    let liveCtxErr = null
    if (ctxMenuCode.trim()) {
      try {
        const transformed = Babel.transform(ctxMenuCode, { filename:'context.tsx', presets: ['react','typescript','env'] }).code
        const exps = evalTranspiledReactModule(transformed)
        const key = Object.keys(exps).find(k => k.toLowerCase().includes('contextmenu')) || Object.keys(exps).find(k => typeof exps[k]==='function') || Object.keys(exps)[0]
        const Comp = exps[key]
        if (typeof Comp !== 'function') throw new Error('No exported React component found. Export a named ContextMenu component.')
        liveCtxEl = React.createElement(Comp, { attrs: {}, onUpdate: () => {} })
      } catch(e) { liveCtxErr = e.message }
    }

    // Default template
    const defaultTemplate = `// Context menu component — rendered above your component when selected
// Props: attrs (object), onUpdate (key: string, value: any) => void

export const ContextMenu = ({ attrs, onUpdate }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    {/* Example: a brightness slider */}
    <label style={{ fontSize: 11, color: '#aaa' }}>Value</label>
    <input
      type="range" min={0} max={255}
      value={attrs.value ?? 128}
      onChange={e => onUpdate('value', +e.target.value)}
      style={{ width: 100 }}
    />
    <span style={{ fontSize: 11, minWidth: 28, color: '#fff' }}>{attrs.value ?? 128}</span>
  </div>
);
`
  const autoTemplate = genContextMenuTemplate(getData())

    // Compute canvas preview bounds/position
    const w = Number(compW) || 100, h = Number(compH) || 80
    const b = bounds || { x: 0, y: 0, w, h }
    const scale = ctxMenuZoom
    const canvasW = Math.max(w * scale + 120, 400)
    const canvasH = Math.max(h * scale + 120, 250)

    return (
      <div style={{ display:'flex', gap:24, height:'calc(100vh - 340px)' }}>
        {/* LEFT — Code Editor */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:12, minWidth:0 }}>
          <div style={{ padding:'14px 18px', background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:12, fontSize:13, color:'var(--text2)', lineHeight:1.6 }}>
            Write a <strong style={{ color:'#a78bfa' }}>ContextMenu</strong> React component. It receives{' '}
            <code style={{ background:'var(--bg2)', padding:'2px 6px', borderRadius:4, fontSize:12 }}>attrs</code> and{' '}
            <code style={{ background:'var(--bg2)', padding:'2px 6px', borderRadius:4, fontSize:12 }}>onUpdate(key, value)</code> props.
            The preview on the right shows it exactly as the simulator renders it.
          </div>

          <div style={{ flex:1, display:'flex', flexDirection:'column', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ padding:'10px 16px', background:'rgba(255,255,255,0.02)', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:'#ff5f57' }} />
                <div style={{ width:10, height:10, borderRadius:'50%', background:'#ffbd2e' }} />
                <div style={{ width:10, height:10, borderRadius:'50%', background:'#27c93f' }} />
                <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', marginLeft:8 }}>context.tsx</span>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ fontSize:10, color:'var(--text3)' }}>TypeScript / JSX</span>
                <button
                  onClick={() => setCtxMenuCode(defaultTemplate)}
                  style={{ padding:'4px 10px', borderRadius:6, fontSize:10, fontWeight:700, background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)', color:'#a78bfa', cursor:'pointer' }}
                >Insert Template</button>
                <button
                  onClick={() => setCtxMenuCode(autoTemplate)}
                  style={{ padding:'4px 10px', borderRadius:6, fontSize:10, fontWeight:700, background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.35)', color:'#86efac', cursor:'pointer' }}
                >Auto Generate</button>
              </div>
            </div>
            <div style={{ flex:1, overflow:'auto' }}>
              <Editor
                value={ctxMenuCode}
                onValueChange={setCtxMenuCode}
                highlight={c => Prism.highlight(c||'', Prism.languages.javascript, 'javascript')}
                padding={18}
                style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, lineHeight:1.65, minHeight:'100%', color:'var(--text)', background:'transparent' }}
                placeholder="export const ContextMenu = ({ attrs, onUpdate }) => (...)"
              />
            </div>
          </div>
        </div>

        {/* RIGHT — Live Preview */}
        <div style={{ width:400, flexShrink:0, display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:16, padding:20, display:'flex', flexDirection:'column', gap:14, boxShadow:'var(--shadow)', flex:1 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:12, fontWeight:700, color:'var(--text)', letterSpacing:'0.05em' }}>LIVE PREVIEW</span>
              <div style={{ display:'flex', gap:4 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#ff5f57' }} />
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#ffbd2e' }} />
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#27c93f' }} />
              </div>
            </div>

            {/* Simulator-accurate canvas preview */}
            <div style={{
              flex:1, minHeight:220, position:'relative', borderRadius:12, overflow:'hidden',
              backgroundColor:'var(--canvas-bg)',
              backgroundImage:'linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)',
              backgroundSize:`${GRID*scale}px ${GRID*scale}px`,
              border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <div style={{ position:'relative', width:w*scale, height:h*scale }}>
                {/* Component body */}
                {svgMode==='react'
                  ? <ReactPreview reactCode={reactCode} compW={compW} compH={compH} zoom={scale} />
                  : <SvgPreview svgCode={svgCode} compW={compW} compH={compH} zoom={scale} />}

                {/* Context menu bubble — rendered above BOUNDS centre, exactly like SimulatorPage */}
                <div data-contextmenu="true" style={{
                  position:'absolute',
                  left: b.x * scale + (b.w * scale) / 2,
                  top:  b.y * scale - 14 * scale,
                  transform:'translateX(-50%) translateY(-100%)',
                  background:'var(--bg2)', border:'1px solid var(--border)',
                  display:'flex', alignItems:'center', gap:8,
                  padding:'6px 10px', borderRadius:10,
                  boxShadow:'0 8px 24px rgba(0,0,0,0.6)',
                  pointerEvents:'all', whiteSpace:'nowrap', zIndex:200,
                  minWidth:140,
                }}>
                  {liveCtxErr
                    ? <span style={{ fontSize:10, color:'#ff6b6b', fontFamily:'monospace', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis' }}>⚠ {liveCtxErr}</span>
                    : liveCtxEl
                      ? liveCtxEl
                      : <span style={{ fontSize:10, color:'var(--text3)', fontStyle:'italic' }}>Write a ContextMenu component →</span>
                  }
                  {/* Tooltip arrow */}
                  <div style={{ position:'absolute', bottom:-6, left:'50%', transform:'translateX(-50%)', width:0, height:0, borderLeft:'6px solid transparent', borderRight:'6px solid transparent', borderTop:'6px solid var(--border)' }} />
                  <div style={{ position:'absolute', bottom:-5, left:'50%', transform:'translateX(-50%)', width:0, height:0, borderLeft:'5px solid transparent', borderRight:'5px solid transparent', borderTop:'5px solid var(--bg2)' }} />
                </div>

                {/* Selection ring */}
                <div style={{ position:'absolute', left:b.x*scale-6, top:b.y*scale-6, width:b.w*scale+12, height:b.h*scale+12, borderRadius:8, border:'2px solid var(--accent)', boxShadow:'0 0 16px var(--glow)', pointerEvents:'none' }} />
              </div>
            </div>

            {/* Zoom bar */}
            <ZoomBar zoom={ctxMenuZoom} onZoom={setCtxMenuZoom} onFit={() => setCtxMenuZoom(fitZoom(360,250))} fitZoom={fitZoom(360,250)} />

            {/* Status info */}
            <div style={{ padding:'10px 14px', background:'var(--bg)', borderRadius:10, border:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:11, color:'var(--text3)', display:'flex', justifyContent:'space-between' }}>
                <span>Render status</span>
                <span style={{ color: liveCtxErr ? '#f87171' : liveCtxEl ? '#4ade80' : 'var(--text3)', fontWeight:700 }}>
                  {liveCtxErr ? 'Compile error' : liveCtxEl ? '✓ OK' : 'Waiting for code'}
                </span>
              </div>
              <div style={{ fontSize:11, color:'var(--text3)', display:'flex', justifyContent:'space-between' }}>
                <span>Visibility flags</span>
                <span style={{ color:'var(--text2)' }}>
                  {ctxDuringRun ? 'duringRun' : ''}{ctxOnlyDuringRun ? ' onlyDuringRun' : ''}{!ctxDuringRun && !ctxOnlyDuringRun ? 'standard' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Step 6 (was Step 5)
  // ─────────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  //  Step 6
  // ─────────────────────────────────────────────────────────────────────────
  const s6 = () => {
    const tabs = [
      { id:'logic',    l:'logic.ts',       code:logicCode,    set:setLogicCode },
      { id:'valid',    l:'validation.ts',  code:validCode,    set:setValidCode },
      { id:'ui',       l:'ui.tsx',         code:uiCode,       set:v=>{uiEdited.current=true;setUiCode(v)} },
      { id:'index',    l:'index.ts',       code:indexCode,    set:setIndexCode },
      { id:'manifest', l:'manifest.json',  code:manifestCode, set:setManifestCode },
    ]
    const cur = tabs.find(t=>t.id===codeTab) || tabs[0]
    
    return (
      <div style={{ height: 'calc(100vh - 350px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {tabs.map(t => (
            <button 
              key={t.id} 
              onClick={() => setCodeTab(t.id)}
              style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s', background: codeTab===t.id ? 'var(--bg3)' : 'transparent', color: codeTab===t.id ? 'var(--accent)' : 'var(--text2)', borderColor: codeTab===t.id ? 'var(--accent)' : 'var(--border)' }}
            >{t.l}</button>
          ))}
          <div style={{ flex: 1 }} />
          <Btn v="ghost" sm onClick={genAll}>Regenerate Files</Btn>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
           <div style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginLeft: 10 }}>{cur.l}</span>
             </div>
             <span style={{ fontSize: 10, color: 'var(--text3)' }}>{cur.id === 'manifest' ? 'JSON' : 'TypeScript'}</span>
           </div>
           <div style={{ flex: 1, overflow: 'auto' }}>
              <Editor 
                value={cur.code} 
                onValueChange={cur.set}
                highlight={c=>Prism.highlight(c||'', Prism.languages.javascript, 'javascript')}
                padding={20} 
                style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, lineHeight:1.6, minHeight: '100%', color:'var(--text)', background: 'transparent' }}
              />
           </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Step 7 (was Step 6)
  // ─────────────────────────────────────────────────────────────────────────
  const s7 = () => (
    <div style={{ display:'flex', gap:24, height:'calc(100vh - 350px)' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>Documentation Editor (HTML)</div>
        <div style={{ flex:1, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <Editor 
            value={docsCode} onValueChange={setDocsCode}
            highlight={c=>Prism.highlight(c||'',Prism.languages.markup,'markup')}
            padding={16} 
            style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, lineHeight:1.6, minHeight:'100%', color:'var(--text)' }}
          />
        </div>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>Live Preview</div>
        <div style={{ flex:1, background: 'white', color: '#333', borderRadius: 16, padding: 32, overflowY: 'auto', border: '1px solid var(--border)' }} className="panel-scroll prose">
           <div dangerouslySetInnerHTML={{ __html: docsCode }} />
        </div>
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  //  Step 8 (was Step 7)
  // ─────────────────────────────────────────────────────────────────────────
  const s8 = () => (
    <div style={{ maxWidth:900, margin:'0 auto', display:'flex', flexDirection:'column', gap:32 }}>
       <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🚀</div>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', margin: '0 0 8px' }}>Your Component is Ready!</h2>
          <p style={{ fontSize: 16, color: 'var(--text2)', maxWidth: 600, margin: '0 auto' }}>You've successfully defined the manifest, visuals, logic, and pins. Now it's time to bring it to life in the simulator.</p>
       </div>

       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 24, padding: 32, display: 'flex', flexDirection: 'column', gap: 20, boxShadow: 'var(--shadow)', transition: 'transform 0.2s', cursor: 'pointer' }} onClick={handleTestInSim} className="hover:scale-[1.02]">
             <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
             </div>
             <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Test in Simulator</h3>
                <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0, lineHeight: 1.5 }}>Launch a local instance of the simulator with this component pre-loaded. Perfect for debugging logic and pin mapping.</p>
             </div>
             <Btn v="blue" style={{ marginTop: 'auto', justifyContent: 'center' }}>Run Live Test</Btn>
          </div>

          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 24, padding: 32, display: 'flex', flexDirection: 'column', gap: 20, boxShadow: 'var(--shadow)', transition: 'transform 0.2s', cursor: 'pointer' }} onClick={handleDownload} className="hover:scale-[1.02]">
             <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
             </div>
             <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Download Project ZIP</h3>
                <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0, lineHeight: 1.5 }}>Get a production-ready ZIP containing all source files. You can upload this to the global library or share it.</p>
             </div>
             <Btn v="green" style={{ marginTop: 'auto', justifyContent: 'center' }}>Download .zip</Btn>
          </div>
       </div>

       <div style={{ background: 'rgba(0, 212, 255, 0.03)', border: '1px dashed var(--accent)', borderRadius: 16, padding: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ fontSize: 24 }}>📝</div>
          <div style={{ flex:1 }}>
             <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Summary Checklist</div>
             <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, color: '#22c55e' }}>✓ {pins.length} Pins Map</div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, color: '#22c55e' }}>✓ {compW}x{compH} Canvas</div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, color: '#22c55e' }}>✓ {svgMode} Visuals</div>
             </div>
          </div>
          <Btn v="ghost" sm onClick={()=>setStep(1)}>Review All Steps</Btn>
       </div>
    </div>
  )

  const stepR = {1:s1,2:s2,3:s3,4:s4,5:s5,6:s6,7:s7,8:s8}
  const cfg = STEPS[step-1]

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 flex flex-col bg-[var(--bg)] text-[var(--text)] font-mono z-[1000]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="h-[60px] bg-[var(--bg2)] border-b border-[var(--border)] flex items-center gap-4 px-6 shrink-0 z-[10]">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            onClick={()=>window.close()||navigate('/simulator')} 
            className="hover:bg-[var(--bg3)]"
            style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--text2)', cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontSize:12, padding:'6px 12px', borderRadius:8, transition: 'all 0.2s' }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 1L4 8l7 7"/></svg>
            Back
          </button>
          <div style={{ height: 24, width: 1, background: 'var(--border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: 'rgba(0, 212, 255, 0.1)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:'var(--text)', lineHeight: 1 }}>Component Studio</div>
              {compType && <div style={{ fontSize:11, color:'var(--text3)', marginTop: 2 }}>{compType}</div>}
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Toolbar Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 3 }}>
            <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={{ background: 'transparent', border: 'none', color: canUndo ? 'var(--text)' : 'var(--text3)', padding: '6px 10px', cursor: canUndo ? 'pointer' : 'default', borderRadius: 8, transition: 'all 0.15s' }} className={canUndo ? "hover:bg-[var(--bg3)]" : ""}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5"/><path d="M20 20v-7a4 4 0 00-4-4H4"/></svg>
            </button>
            <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" style={{ background: 'transparent', border: 'none', color: canRedo ? 'var(--text)' : 'var(--text3)', padding: '6px 10px', cursor: canRedo ? 'pointer' : 'default', borderRadius: 8, transition: 'all 0.15s' }} className={canRedo ? "hover:bg-[var(--bg3)]" : ""}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14l5-5-5-5"/><path d="M4 20v-7a4 4 0 014-4h12"/></svg>
            </button>
          </div>

          <Btn v="yellow" sm onClick={()=>importRef.current?.click()} title="Import .zip">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import
          </Btn>

          <Btn v="ghost" sm onClick={toggleTheme} style={{ padding: '8px 10px' }}>
            {theme==='dark' 
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
            }
          </Btn>

          <div style={{ height: 24, width: 1, background: 'var(--border)' }} />

          <Btn v={canvasOpen?'primary':'ghost'} sm onClick={()=>setCanvasOpen(o=>!o)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/></svg>
            Canvas
          </Btn>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-[240px] border-r border-[var(--border)] bg-[var(--bg2)] flex flex-col py-6 shrink-0 relative">
          <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', letterSpacing:'.12em', padding:'0 24px 12px', textTransform:'uppercase' }}>CREATION STEPS</div>
          
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px' }}>
            {STEPS.map(s=>(
              <button 
                key={s.id} 
                onClick={()=>goToStep(s.id)}
                className="group"
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                  padding: '10px 16px', borderRadius: 12, cursor: 'pointer', border: 'none',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: step === s.id ? 'var(--accent)' : 'transparent',
                  color: step === s.id ? '#fff' : (doneSteps.has(s.id) ? 'var(--text2)' : 'var(--text3)')
                }}
              >
                <div style={{ 
                  width: 24, height: 24, borderRadius: 8, fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyCenter: 'center', flexShrink: 0,
                  background: step === s.id ? 'rgba(255,255,255,0.25)' : (doneSteps.has(s.id) ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg)'),
                  color: step === s.id ? '#fff' : (doneSteps.has(s.id) ? 'var(--green)' : 'var(--text3)'),
                  border: `1px solid ${step === s.id ? 'transparent' : 'var(--border)'}`,
                  justifyContent: 'center'
                }}>
                  {doneSteps.has(s.id) && step !== s.id ? '✓' : s.id}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 13, fontWeight: step === s.id ? 700 : 600 }}>{s.label}</span>
                </div>
              </button>
            ))}
          </nav>

          <div style={{ marginTop:'auto', padding:'20px 16px', borderTop:'1px solid var(--border)' }}>
            <button 
              onClick={()=>goToStep(6)} 
              className="hover:border-[var(--accent)] hover:text-[var(--accent)]"
              style={{ width:'100%', padding:'10px', borderRadius:10, background:'var(--bg)', border:'1px dashed var(--border)', color:'var(--text2)', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', gap:10, fontWeight:600, transition: 'all 0.2s' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              Switch to Code
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 flex flex-col min-w-0 bg-[var(--bg)]">
          {/* Active Step Info */}
          <div style={{ padding: '24px 32px 20px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ padding: '4px 10px', background: 'rgba(0, 212, 255, 0.1)', color: 'var(--accent)', borderRadius: 6, fontSize: 10, fontWeight: 800, letterSpacing: '0.05em' }}>STEP {step} OF {STEPS.length}</span>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--border)' }} />
                  <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>{Math.round((step / STEPS.length) * 100)}% Complete</span>
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0 }}>{cfg.label}</h2>
                <p style={{ fontSize: 14, color: 'var(--text2)', margin: 0 }}>{cfg.desc}</p>
             </div>
             <div style={{ display: 'flex', gap: 6 }}>
                {STEPS.map(s => (
                  <div key={s.id} style={{ width: 8, height: 8, borderRadius: '50%', background: step === s.id ? 'var(--accent)' : (doneSteps.has(s.id) ? 'var(--green)' : 'var(--border)'), border: step === s.id ? '2px solid var(--bg)' : 'none', boxShadow: step === s.id ? '0 0 0 2px var(--accent)' : 'none' }} />
                ))}
             </div>
          </div>

          {/* Step Content */}
          <div className="flex-1 overflow-y-auto scroll-smooth panel-scroll" style={{ padding: '32px' }}>
            {stepR[step]?.()}
          </div>

          {/* Footer Navigation */}
          <footer style={{ height: 72, background: 'var(--bg2)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', zIndex: 5 }}>
            <Btn v="ghost" onClick={goPrev} disabled={step===1}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
              Back
            </Btn>
            
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
               <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{step} / {STEPS.length}</span>
               {step < 8 && (
                  <Btn v="primary" onClick={goNext} style={{ minWidth: 120, justifyContent: 'center' }}>
                    {step === 7 ? 'Finalize' : 'Continue'}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                  </Btn>
               )}
               {step === 8 && (
                  <Btn v="primary" onClick={handleDownload} style={{ minWidth: 160, justifyContent: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download Project
                  </Btn>
               )}
            </div>
          </footer>
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
      <input ref={importRef} type="file" accept=".zip" onChange={handleImport} style={{ display:'none' }} />
    </div>
  )
}

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext.jsx'
import { compileCode } from '../services/simulatorService.js'
import html2canvas from 'html2canvas'

import { wokwiLed as ledIndex, wokwiArduinoUno as unoIndex, wokwiResistor as resistorIndex, wokwiPushbutton as pushbuttonIndex, wokwiPowerSupply as powerSupplyIndex, wokwiNeopixelMatrix as neopixelIndex, wokwiBuzzer as buzzerIndex, wokwiMotor as motorIndex, wokwiServo as servoIndex, wokwiMotorDriver as motorDriverIndex, wokwiSlidePotentiometer as slidePotIndex, wokwiPotentiometer as potIndex } from '@openhw/emulator/src/components/index.ts';

// Web Editor features
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
// Import a Prism theme (or we can inject our own CSS wrapper)
import 'prismjs/themes/prism-tomorrow.css';

// Build Catalog & UI Registry from local imports
const COMPONENT_REGISTRY = {
  'wokwi-led': ledIndex,
  'wokwi-arduino-uno': unoIndex,
  'wokwi-resistor': resistorIndex,
  'wokwi-pushbutton': pushbuttonIndex,
  'wokwi-power-supply': powerSupplyIndex,
  'wokwi-neopixel-matrix': neopixelIndex,
  'wokwi-buzzer': buzzerIndex,
  'wokwi-motor': motorIndex,
  'wokwi-servo': servoIndex,
  'wokwi-motor-driver': motorDriverIndex,
  'wokwi-slide-potentiometer': slidePotIndex,
  'wokwi-potentiometer': potIndex
};

const LOCAL_CATALOG = [];
const LOCAL_PIN_DEFS = {};

Object.values(COMPONENT_REGISTRY).forEach(module => {
  const manifest = module.manifest;
  let group = LOCAL_CATALOG.find(g => g.group === manifest.group);
  if (!group) {
    group = { group: manifest.group, items: [] };
    LOCAL_CATALOG.push(group);
  }

  const { pins, group: _, ...catalogItem } = manifest;
  group.items.push(catalogItem);

  if (pins) {
    LOCAL_PIN_DEFS[manifest.type] = pins;
  }
});

let nextId = 1
let nextWireId = 1

// ─── ROUNDED ORTHOGONAL PATH ───────────────────────────────────────────────
function multiRoutePath(p1, p2, waypoints = []) {
  if (!p1 || !p2) return '';
  const pts = [p1, ...waypoints, p2];
  let orthPts = [];

  // 1. Generate purely orthogonal points
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (i === 0) orthPts.push(a);

    // Midpoint dog-leg logic (same as before but extracting the coordinates)
    const midX = (a.x + b.x) / 2;
    orthPts.push({ x: midX, y: a.y });
    orthPts.push({ x: midX, y: b.y });
    orthPts.push(b);
  }

  // Deduplicate consecutive identical points
  orthPts = orthPts.filter((pt, i, arr) => {
    if (i === 0) return true;
    return pt.x !== arr[i - 1].x || pt.y !== arr[i - 1].y;
  });

  if (orthPts.length < 2) return '';

  const r = 10; // Corner radius (adjust as desired for curvature)
  let d = `M ${orthPts[0].x} ${orthPts[0].y}`;

  // 2. Add arcs at corners
  for (let i = 1; i < orthPts.length - 1; i++) {
    const prev = orthPts[i - 1];
    const curr = orthPts[i];
    const next = orthPts[i + 1];

    // Distance to neighbors
    const distPrev = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const distNext = Math.hypot(next.x - curr.x, next.y - curr.y);

    // Limit radius if segment is too short
    const cornerR = Math.min(r, distPrev / 2, distNext / 2);

    // Calculate start and end points of the curve along the segments
    const pStartPoint = {
      x: curr.x + (prev.x - curr.x) * (cornerR / distPrev) || curr.x,
      y: curr.y + (prev.y - curr.y) * (cornerR / distPrev) || curr.y,
    };
    const pEndPoint = {
      x: curr.x + (next.x - curr.x) * (cornerR / distNext) || curr.x,
      y: curr.y + (next.y - curr.y) * (cornerR / distNext) || curr.y,
    };

    // Draw line to the start of the curve, then the quadratic curve to the end
    d += ` L ${pStartPoint.x} ${pStartPoint.y}`;
    d += ` Q ${curr.x} ${curr.y} ${pEndPoint.x} ${pEndPoint.y}`;
  }

  // Draw final line to the last point
  const last = orthPts[orthPts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function wireColor(pinLabel) {
  if (!pinLabel) return '#2ecc71';
  const l = pinLabel.toUpperCase();
  if (l.includes('GND') || l === 'CATHODE') return '#000000'; // black
  if (l.includes('5V') || l.includes('3.3V') || l === 'VCC' || l === 'ANODE') return '#e74c3c'; // red
  return '#2ecc71'; // green default
}

export default function SimulatorPage() {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()

  // Theme Logic
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark')

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  const [components, setComponents] = useState([])
  const [wires, setWires] = useState([])
  const [showGuestBanner, setShowGuestBanner] = useState(true)
  const [history, setHistory] = useState({ past: [], future: [] })
  const [selected, setSelected] = useState(null)   // comp or wire id
  const [wireStart, setWireStart] = useState(null)   // { compId, pinId, pinLabel, x, y }
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [hoveredPin, setHoveredPin] = useState(null)
  const [board, setBoard] = useState('arduino_uno')
  const [codeTab, setCodeTab] = useState('code')
  const [code, setCode] = useState('void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}\n')
  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const [panelWidth, setPanelWidth] = useState(400)
  const [isDragging, setIsDragging] = useState(false)

  const [validationErrors, setValidationErrors] = useState([])
  const [showValidation, setShowValidation] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [pinStates, setPinStates] = useState({})
  const [neopixelData, setNeopixelData] = useState({})
  const [oopStates, setOopStates] = useState({});
  const [serialHistory, setSerialHistory] = useState([]);
  const [serialInput, setSerialInput] = useState('');
  const [serialPaused, setSerialPaused] = useState(false);
  const serialOutputRef = useRef(null);

  // Plotter State
  const [plotData, setPlotData] = useState([]);
  const [selectedPlotPins, setSelectedPlotPins] = useState(['13', 'A0']);
  const plotterCanvasRef = useRef(null);
  const [plotterPaused, setPlotterPaused] = useState(false);

  // PNG Export State
  const [isExporting, setIsExporting] = useState(false);

  const workerRef = useRef(null)
  const neopixelRefs = useRef({})

  const canvasRef = useRef(null)
  const svgRef = useRef(null)
  const dragPayload = useRef(null)
  const movingComp = useRef(null)

  // ── Library Manager State ───────────────────────────────────────────────────
  const [libQuery, setLibQuery] = useState('')
  const [libResults, setLibResults] = useState([])
  const [libInstalled, setLibInstalled] = useState([])
  const [isSearchingLib, setIsSearchingLib] = useState(false)
  const [installingLib, setInstallingLib] = useState(null)
  const [libMessage, setLibMessage] = useState(null)

  const fetchInstalledLibraries = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/lib-list');
      setLibInstalled(res.data.libraries || []);
    } catch (err) {
      console.error('Failed to fetch installed libraries', err);
    }
  };

  useEffect(() => {
    fetchInstalledLibraries();
  }, []);

  const searchLibraries = async (e) => {
    e.preventDefault();
    if (!libQuery.trim()) return;
    setIsSearchingLib(true);
    setLibMessage(null);
    try {
      const res = await axios.get(`http://localhost:5000/api/lib-search?q=${encodeURIComponent(libQuery)}`);
      setLibResults(res.data.libraries || []);
      if (res.data.libraries?.length === 0) setLibMessage({ type: 'error', text: 'No libraries found.' });
    } catch (err) {
      setLibMessage({ type: 'error', text: 'Failed to search libraries.' });
    } finally {
      setIsSearchingLib(false);
    }
  };

  const installLibrary = async (libName) => {
    setInstallingLib(libName);
    setLibMessage(null);
    try {
      const res = await axios.post('http://localhost:5000/api/lib-install', { name: libName });
      setLibMessage({ type: 'success', text: res.data.message });
      fetchInstalledLibraries(); // Refresh the installed list!
    } catch (err) {
      setLibMessage({ type: 'error', text: 'Failed to install library.' });
    } finally {
      setInstallingLib(null);
    }
  };

  // ── Handle Panel Resize ──────────────────────────────────────────────────────
  const onMouseDownResize = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMouseMove = (moveEvent) => {
      const delta = startX - moveEvent.clientX; // Left drag increases width
      const newWidth = Math.max(250, Math.min(800, startWidth + delta));
      setPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [panelWidth]);

  // ── Load Wokwi bundle ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!customElements.get('wokwi-7segment') && !document.getElementById('wokwi-bundle')) {
      const s = document.createElement('script')
      s.id = 'wokwi-bundle'
      s.src = 'https://unpkg.com/@wokwi/elements@0.48.3/dist/wokwi-elements.bundle.js'
      document.head.appendChild(s)
    }
  }, [])

  // ── Remote Validation ────────────────────────────────────────────────────────
  useEffect(() => {
    // Skipping validation for now as logic moved to frontend worker completely
    // We can add static validateCircuit functions back to the components if needed
    setValidationErrors([]);
  }, [components, wires, isRunning]);

  // ── Load Catalog on Mount ────────────────────────────────────────────────────
  const CATALOG = LOCAL_CATALOG;
  const PIN_DEFS = LOCAL_PIN_DEFS;

  // ── Apply NeoPixel pixel data to DOM elements ──────────────────────────────
  useEffect(() => {
    if (!neopixelData || Object.keys(neopixelData).length === 0) return;
    for (const [compId, pixels] of Object.entries(neopixelData)) {
      const wrapper = neopixelRefs.current[compId];
      if (!wrapper) continue;
      const el = wrapper.querySelector('wokwi-neopixel-matrix');
      if (!el || typeof el.setPixel !== 'function') continue;
      for (const [row, col, rgb] of pixels) {
        el.setPixel(row, col, rgb);
      }
    }
  }, [neopixelData])

  // ── Error component IDs for highlighting ────────────────────────────────────
  const errorCompIds = useMemo(() =>
    new Set(validationErrors.flatMap(e => e.compIds)),
    [validationErrors]
  )

  // ── Serial auto-scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!serialPaused && serialOutputRef.current) {
      serialOutputRef.current.scrollTop = serialOutputRef.current.scrollHeight;
    }
  }, [serialHistory, serialPaused]);

  // ── Plotter Rendering Loop ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = plotterCanvasRef.current;
    if (!canvas || codeTab !== 'plotter' || plotData.length === 0 || selectedPlotPins.length === 0) return;
    if (plotterPaused) return; // Freeze canvas when paused

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const trackHeight = height / selectedPlotPins.length;
    const Y_LABEL_W = 30;

    selectedPlotPins.forEach((pinStr, trackIdx) => {
      const trackBaseY = trackHeight * (trackIdx + 1) - 10;
      const trackTopY = trackHeight * trackIdx + 10;
      const isAnalog = pinStr.startsWith('A');
      const color = isAnalog ? '#3498db' : '#2ecc71';

      // Track separator
      if (trackIdx < selectedPlotPins.length - 1) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, trackHeight * (trackIdx + 1));
        ctx.lineTo(width, trackHeight * (trackIdx + 1));
        ctx.stroke();
      }

      // Baseline (LOW / 0V) dashed guide
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Y_LABEL_W, trackBaseY);
      ctx.lineTo(width, trackBaseY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Y-axis labels
      ctx.font = '9px JetBrains Mono';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.textAlign = 'right';
      ctx.fillText(isAnalog ? '5V' : 'HIGH', Y_LABEL_W - 2, trackTopY + 9);
      ctx.fillText(isAnalog ? '0V' : 'LOW', Y_LABEL_W - 2, trackBaseY);
      ctx.textAlign = 'left';

      // Pin label
      ctx.fillStyle = color;
      ctx.font = 'bold 10px JetBrains Mono';
      ctx.fillText(`Pin ${pinStr}`, Y_LABEL_W + 4, trackTopY + 10);

      // Signal trace
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      const maxPts = width - Y_LABEL_W;
      const pts = plotData.slice(-maxPts);
      const xStep = maxPts / Math.max(pts.length, 1);

      pts.forEach((pt, i) => {
        const x = Y_LABEL_W + (maxPts - ((pts.length - 1 - i) * xStep));
        let val = 0;
        if (isAnalog) {
          const ch = parseInt(pinStr.substring(1));
          val = Math.max(0, Math.min(1, (pt.analog[ch] || 0) / 5.0));
        } else {
          val = pt.pins[pinStr] ? 1 : 0;
        }
        const y = trackBaseY - (val * (trackBaseY - trackTopY));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    // X-axis label
    ctx.font = '9px JetBrains Mono';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.textAlign = 'left';
    ctx.fillText('← time', Y_LABEL_W + 4, height - 4);
  }, [plotData, codeTab, selectedPlotPins, plotterPaused]);

  // ── Get absolute pin position on canvas ────────────────────────────────────
  const getPinPos = useCallback((compId, pinId) => {
    const comp = components.find(c => c.id === compId)
    if (!comp) return null
    const pins = PIN_DEFS[comp.type] || []
    const pin = pins.find(p => p.id === pinId)
    if (!pin) return null
    return { x: comp.x + pin.x, y: comp.y + pin.y }
  }, [components, PIN_DEFS])

  // ── Palette drag start ──────────────────────────────────────────────────────
  const onPaletteDragStart = (e, item) => {
    dragPayload.current = item
    e.dataTransfer.effectAllowed = 'copy'
    const ghost = document.createElement('div')
    ghost.style.cssText = 'position:fixed;top:-999px;width:1px;height:1px'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }

  // ── History & Undo/Redo ────────────────────────────────────────────────────
  const saveHistory = useCallback(() => {
    setHistory(h => ({
      past: [...h.past.slice(-20), { components: JSON.parse(JSON.stringify(components)), wires: JSON.parse(JSON.stringify(wires)) }],
      future: []
    }))
  }, [components, wires])

  const undo = () => {
    if (history.past.length === 0 || isRunning) return
    const prev = history.past[history.past.length - 1]
    setHistory(h => ({ past: h.past.slice(0, -1), future: [{ components: JSON.parse(JSON.stringify(components)), wires: JSON.parse(JSON.stringify(wires)) }, ...h.future] }))
    setComponents(prev.components)
    setWires(prev.wires)
    setSelected(null)
  }

  const redo = () => {
    if (history.future.length === 0 || isRunning) return
    const next = history.future[0]
    setHistory(h => ({ past: [...h.past, { components: JSON.parse(JSON.stringify(components)), wires: JSON.parse(JSON.stringify(wires)) }], future: h.future.slice(1) }))
    setComponents(next.components)
    setWires(next.wires)
    setSelected(null)
  }

  // ── Canvas drop ────────────────────────────────────────────────────────────
  const onCanvasDrop = useCallback((e) => {
    e.preventDefault()
    const item = dragPayload.current
    if (!item) return
    saveHistory();
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - (item.w || 60) / 2
    const y = e.clientY - rect.top - (item.h || 60) / 2
    setComponents(prev => [...prev, {
      id: `${item.type}_${nextId++}`,
      type: item.type, label: item.label,
      x: Math.max(8, x), y: Math.max(8, y),
      w: item.w || 60, h: item.h || 60,
      attrs: item.attrs || {},
    }])
    dragPayload.current = null
  }, [saveHistory])

  // ── Move and Select component ──────────────────────────────────────────────
  const onCompMouseDown = useCallback((e, id) => {
    e.stopPropagation()
    if (isRunning) return; // Restrict movement while running
    const comp = components.find(c => c.id === id)
    movingComp.current = { id, sx: e.clientX, sy: e.clientY, cx: comp.x, cy: comp.y, moved: false, originalComps: JSON.parse(JSON.stringify(components)) }
  }, [components, isRunning])

  const onCompClick = useCallback((e, id) => {
    e.stopPropagation()
    setSelected(id)
  }, [])

  useEffect(() => {
    const onMove = (e) => {
      if (movingComp.current) {
        movingComp.current.moved = true
        const { id, sx, sy, cx, cy } = movingComp.current
        setComponents(prev => prev.map(c =>
          c.id === id ? { ...c, x: Math.max(0, cx + e.clientX - sx), y: Math.max(0, cy + e.clientY - sy) } : c
        ))
      }
      // Track mouse for wire preview
      if (wireStart && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
      }
    }
    const onUp = () => {
      if (movingComp.current?.moved) {
        const origComps = movingComp.current.originalComps;
        setHistory(h => ({ past: [...h.past.slice(-20), { components: origComps, wires: JSON.parse(JSON.stringify(wires)) }], future: [] }));
      }
      movingComp.current = null;
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [wireStart, wires])

  // ── Pin click — start or complete wire ─────────────────────────────────────
  const onPinClick = useCallback((e, compId, pinId, pinLabel) => {
    e.stopPropagation()
    if (isRunning) return; // Restrict wiring while running

    const pos = getPinPos(compId, pinId)
    if (!pos) return

    if (!wireStart) {
      // Start wire
      setWireStart({ compId, pinId, pinLabel, ...pos })
    } else {
      // Complete wire — prevent self-loop
      if (wireStart.compId === compId && wireStart.pinId === pinId) {
        setWireStart(null)
        return
      }
      saveHistory();
      const newWire = {
        id: `w${nextWireId++}`,
        from: `${wireStart.compId}:${wireStart.pinId}`,
        to: `${compId}:${pinId}`,
        fromLabel: wireStart.pinLabel,
        toLabel: pinLabel,
        color: wireColor(wireStart.pinLabel),
        waypoints: wireStart.waypoints || [],
        isBelow: false // Add z-index configuration
      }
      setWires(prev => [...prev, newWire])
      setWireStart(null)
    }
  }, [wireStart, getPinPos, saveHistory, isRunning])

  const updateWireColor = (id, color) => {
    setWires(prev => prev.map(w => w.id === id ? { ...w, color } : w));
  };

  const toggleWireLayer = (id) => {
    saveHistory();
    setWires(prev => prev.map(w => w.id === id ? { ...w, isBelow: !w.isBelow } : w));
  };

  const updateComponentAttr = (id, key, value) => {
    saveHistory();
    setComponents(prev => prev.map(c => {
      if (c.id === id) {
        let newW = c.w;
        let newH = c.h;
        if (c.type === 'wokwi-neopixel-matrix') {
          const rows = key === 'rows' ? (parseInt(value) || 1) : (parseInt(c.attrs?.rows) || 1);
          const cols = key === 'cols' ? (parseInt(value) || 1) : (parseInt(c.attrs?.cols) || 1);
          newW = Math.max(30, cols * 30);
          newH = Math.max(30, rows * 30);
        }
        return { ...c, w: newW, h: newH, attrs: { ...c.attrs, [key]: value } };
      }
      return c;
    }));
  };

  // Cancel wire on Escape / delete selected
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === 'Escape') { setWireStart(null); setSelected(null); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !isRunning) {
        saveHistory();
        if (selected.match(/^w\d+$/)) {
          setWires(prev => prev.filter(w => w.id !== selected))
        } else {
          setComponents(prev => prev.filter(c => c.id !== selected))
          setWires(prev => prev.filter(w => !w.from.startsWith(selected + ':') && !w.to.startsWith(selected + ':')))
        }
        setSelected(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, isRunning, saveHistory])

  const deleteWire = (id) => {
    if (isRunning) return;
    saveHistory();
    setWires(prev => prev.filter(w => w.id !== id))
    if (selected === id) setSelected(null);
  }

  // ─── Simulator Run & Stop Logic ─────────────────────────────────────────────
  const logSerial = (msg, color = 'var(--text)') => {
    // In a real implementation this would push to a serial console state array
    console.log(`[SIM]`, msg);
  };

  const handleRun = async () => {
    try {
      setIsRunning(true);
      logSerial('Compiling...');
      const result = await compileCode(code);
      logSerial('Compiled! Connecting to emulator...');

      // Load Web Worker
      const worker = new Worker(new URL('../worker/simulation.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;

      worker.onmessage = (event) => {
        const msg = event.data;
        if (msg.type === 'state' && msg.pins) {
          setPinStates(msg.pins);
          // Push to plotData history
          setPlotData(prev => {
            const newPt = { time: Date.now(), pins: msg.pins, analog: msg.analog || [] };
            const next = [...prev, newPt];
            if (next.length > 800) return next.slice(next.length - 800);
            return next;
          });
        }
        if (msg.type === 'state' && msg.neopixels) {
          setNeopixelData(msg.neopixels);
        }
        if (msg.type === 'state' && msg.components) {
          setOopStates(prev => {
            const next = { ...prev };
            msg.components.forEach(c => {
              next[c.id] = c.state;
            });
            return next;
          });
        }
        if (msg.type === 'serial') {
          const now = new Date();
          const ts = now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0');
          setSerialHistory(prev => {
            let next = prev.length > 2000 ? prev.slice(prev.length - 1800) : [...prev];
            if (next.length > 0) {
              const last = next[next.length - 1];
              if (last.dir === 'rx' && !last.text.endsWith('\n')) {
                next[next.length - 1] = { ...last, text: last.text + msg.data };
                return next;
              }
            }
            return [...next, { dir: 'rx', text: msg.data, ts }];
          });
        }
      };

      worker.onerror = (err) => {
        console.error('Worker Error:', err);
        logSerial('Worker threw an error', 'var(--red)');
        handleStop();
      };

      logSerial('Simulator started in Web Worker.');

      const neopixelWiring = components
        .filter(c => c.type === 'wokwi-neopixel-matrix')
        .map(c => {
          return null; // Handle Neopixels later
        }).filter(n => n);

      worker.postMessage({
        type: 'START',
        hex: result.hex,
        neopixels: neopixelWiring,
        wires: wires,
        components: components
      });
    } catch (err) {
      setIsRunning(false);
      console.error(err);
      alert(err.message);
    }
  };

  const handleStop = () => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'STOP' });
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsRunning(false);
    setPinStates({});
    setNeopixelData({});
    setOopStates({});
    setSerialHistory([]);
    setPlotData([]);
    setSerialPaused(false);
    setPlotterPaused(false);
  };

  const handleReset = () => {
    if (workerRef.current && isRunning) {
      workerRef.current.postMessage({ type: 'RESET' });
      const now = new Date();
      const ts = now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0');
      setSerialHistory(prev => [...prev, { dir: 'sys', text: '--- BOARD RESET ---', ts }]);
    }
  };

  const sendSerialInput = () => {
    const txt = serialInput.trim();
    if (!txt || !workerRef.current || !isRunning) return;
    workerRef.current.postMessage({ type: 'SERIAL_INPUT', data: txt + '\n' });
    const now = new Date();
    const ts = now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0');
    setSerialHistory(prev => [...prev, { dir: 'tx', text: txt, ts }]);
    setSerialInput('');
  };

  // ── PNG Export ────────────────────────────────────────────────────────────
  const downloadPng = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      // 1. Capture the circuit canvas element
      const circuitCanvas = await html2canvas(canvasRef.current, {
        backgroundColor: '#070b14',
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });

      const CW = circuitCanvas.width;   // circuit width
      const CH = circuitCanvas.height;  // circuit height
      const CODE_W = 340;               // code panel width
      const HEADER_H = 48;              // header bar height
      const FOOTER_H = 140;             // metadata footer height
      const TOTAL_W = CW + CODE_W;
      const TOTAL_H = HEADER_H + Math.max(CH, 400) + FOOTER_H;

      // 2. Create composite canvas
      const out = document.createElement('canvas');
      out.width = TOTAL_W;
      out.height = TOTAL_H;
      const ctx = out.getContext('2d');

      // ── Background
      ctx.fillStyle = '#07080f';
      ctx.fillRect(0, 0, TOTAL_W, TOTAL_H);

      // ── Header bar
      const grad = ctx.createLinearGradient(0, 0, TOTAL_W, 0);
      grad.addColorStop(0, '#0d1525');
      grad.addColorStop(1, '#111827');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, TOTAL_W, HEADER_H);

      // Header bottom border
      ctx.fillStyle = '#1e2d47';
      ctx.fillRect(0, HEADER_H - 1, TOTAL_W, 1);

      // Logo text
      ctx.fillStyle = '#00d4ff';
      ctx.font = 'bold 16px "Space Grotesk", sans-serif';
      ctx.fillText('⚡ OpenHW-Studio', 20, HEADER_H / 2 + 6);

      // Board chip (right side of header)
      const boardLabel = board === 'arduino_uno' ? 'Arduino Uno' : board === 'pico' ? 'Raspberry Pi Pico' : 'ESP32';
      ctx.font = '13px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#8fa3be';
      const boardText = `Board: ${boardLabel}`;
      const boardTW = ctx.measureText(boardText).width;
      ctx.fillText(boardText, TOTAL_W - boardTW - 20, HEADER_H / 2 + 5);

      // Component count chip
      const infoText = `${components.length} components · ${wires.length} wires`;
      const infoTW = ctx.measureText(infoText).width;
      ctx.fillText(infoText, TOTAL_W - boardTW - infoTW - 36, HEADER_H / 2 + 5);

      // ── Circuit image (left column)
      ctx.drawImage(circuitCanvas, 0, HEADER_H);

      // ── Code panel (right column)
      const codeX = CW;
      const codeY = HEADER_H;
      const codeH = TOTAL_H - HEADER_H - FOOTER_H;

      ctx.fillStyle = '#0a0f1a';
      ctx.fillRect(codeX, codeY, CODE_W, codeH);

      // Code panel left border
      ctx.fillStyle = '#1e2d47';
      ctx.fillRect(codeX, codeY, 1, codeH);

      // Code panel header
      ctx.fillStyle = '#0d1525';
      ctx.fillRect(codeX + 1, codeY, CODE_W - 1, 28);
      ctx.fillStyle = '#1e2d47';
      ctx.fillRect(codeX + 1, codeY + 28, CODE_W - 1, 1);
      ctx.fillStyle = '#00d4ff';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText('{ } Code', codeX + 12, codeY + 18);

      // Code lines
      ctx.font = '10px "JetBrains Mono", monospace';
      const LINE_H = 14;
      const MAX_LINES = Math.floor((codeH - 40) / LINE_H);
      const codeLines = code.split('\n');
      const keywords = /\b(void|int|float|bool|char|long|unsigned|return|if|else|for|while|do|switch|case|break|continue|new|delete|true|false|null|nullptr|include|define|const|static|struct|class|public|private|protected)\b/g;
      const callFn = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g;
      codeLines.slice(0, MAX_LINES).forEach((line, i) => {
        const y = codeY + 40 + i * LINE_H;
        // Line number
        ctx.fillStyle = '#3a4a5c';
        ctx.fillText(String(i + 1).padStart(3, ' '), codeX + 6, y);
        // Code text (simplified coloring - green for keywords, blue for calls, white for rest)
        const truncated = line.length > 36 ? line.slice(0, 35) + '…' : line;
        ctx.fillStyle = '#c8d8ea';
        ctx.fillText(truncated, codeX + 32, y);
      });
      if (codeLines.length > MAX_LINES) {
        ctx.fillStyle = '#4d6380';
        ctx.fillText(`… ${codeLines.length - MAX_LINES} more lines`, codeX + 32, codeY + 40 + MAX_LINES * LINE_H);
      }

      // ── Metadata footer
      const footerY = TOTAL_H - FOOTER_H;

      // Footer separator
      ctx.fillStyle = '#1e2d47';
      ctx.fillRect(0, footerY, TOTAL_W, 1);

      ctx.fillStyle = '#0d1220';
      ctx.fillRect(0, footerY + 1, TOTAL_W, FOOTER_H - 1);

      // Build the metadata object matching the spec
      const metadata = {
        board,
        components: components.map(c => ({ id: c.id, type: c.type, label: c.label, x: c.x, y: c.y, attrs: c.attrs })),
        connections: wires.map(w => ({ id: w.id, from: w.from, to: w.to, color: w.color })),
        code: code.length > 500 ? code.slice(0, 497) + '...' : code,
        exported: new Date().toISOString(),
      };
      const jsonStr = JSON.stringify(metadata, null, 0);

      // Footer label
      ctx.fillStyle = '#00d4ff';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText('{ } Metadata', 16, footerY + 18);

      // JSON block
      ctx.font = '9.5px "JetBrains Mono", monospace';
      const footerLines = [
        `board: "${metadata.board}"`,
        `components: [${metadata.components.length} items]`,
        `connections: [${metadata.connections.length} wires]`,
        `code: ${metadata.components.length} sketch lines`,
        `exported: "${metadata.exported}"`,
      ];
      footerLines.forEach((ln, i) => {
        ctx.fillStyle = i % 2 === 0 ? '#8fa3be' : '#6b82a0';
        ctx.fillText(ln, 16, footerY + 34 + i * 16);
      });

      // Branding
      ctx.fillStyle = '#2a3a52';
      ctx.font = '9px "Space Grotesk", sans-serif';
      ctx.fillText('Generated by OpenHW-Studio · openhw.studio', TOTAL_W - 264, TOTAL_H - 10);

      // 3. Encode FULL metadata (no truncation) for machine-readable round-trip
      const fullMetadata = {
        board,
        components: components.map(c => ({ id: c.id, type: c.type, label: c.label, x: c.x, y: c.y, w: c.w, h: c.h, attrs: c.attrs })),
        connections: wires.map(w => ({ id: w.id, from: w.from, to: w.to, color: w.color, waypoints: w.waypoints || [], isBelow: w.isBelow || false, fromLabel: w.fromLabel || '', toLabel: w.toLabel || '' })),
        code,
        exported: new Date().toISOString(),
      };
      const MARKER = '\x00OPENHW_META\x00';
      const jsonPayload = MARKER + JSON.stringify(fullMetadata);

      // 4. Append metadata bytes after PNG IEND → still renders fine in all image viewers
      const dateStr = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-').replace(':', '-');
      const filename = `circuit_${board}_${dateStr}.png`;
      out.toBlob(async (blob) => {
        const pngBuf = await blob.arrayBuffer();
        const pngBytes = new Uint8Array(pngBuf);
        const metaBytes = new TextEncoder().encode(jsonPayload);
        const combined = new Uint8Array(pngBytes.length + metaBytes.length);
        combined.set(pngBytes);
        combined.set(metaBytes, pngBytes.length);
        const finalBlob = new Blob([combined], { type: 'image/png' });
        const url = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }, 'image/png');
    } catch (err) {
      console.error('[PNG Export] Error:', err);
      alert('PNG export failed: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // ── PNG Import ────────────────────────────────────────────────────────────
  const importFileRef = useRef(null);

  const importPng = (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.png')) {
      alert('Please select a valid OpenHW-Studio PNG file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bytes = new Uint8Array(e.target.result);
        // Scan the tail (last 512KB) for the marker to avoid decoding the full PNG image data
        const TAIL_SIZE = Math.min(bytes.length, 524288);
        const tail = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(bytes.length - TAIL_SIZE));
        const MARKER = '\x00OPENHW_META\x00';
        const markerIdx = tail.indexOf(MARKER);
        if (markerIdx === -1) {
          alert('This PNG does not contain OpenHW-Studio circuit data.\nOnly PNGs exported from this simulator can be imported.');
          return;
        }
        const jsonStr = tail.slice(markerIdx + MARKER.length);
        const meta = JSON.parse(jsonStr);

        // Confirm before overwriting current circuit
        const hasExisting = components.length > 0 || wires.length > 0;
        if (hasExisting && !window.confirm(`Import will replace your current circuit (${components.length} components, ${wires.length} wires). Continue?`)) {
          return;
        }

        // Restore state
        saveHistory();
        if (meta.board) setBoard(meta.board);
        if (meta.code) setCode(meta.code);
        if (Array.isArray(meta.components)) setComponents(meta.components);
        if (Array.isArray(meta.connections)) setWires(meta.connections);
        setSelected(null);
        setWireStart(null);
      } catch (err) {
        console.error('[PNG Import] Parse error:', err);
        alert('Failed to parse circuit data from PNG: ' + err.message);
      }
      // Reset the file input so the same file can be re-imported
      if (importFileRef.current) importFileRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const getComponentStateAttrs = (comp) => {
    let attrs = { ...comp.attrs };

    // Remote OOP state takes priority
    const remoteState = oopStates[comp.id];

    if (comp.type === 'wokwi-led') {
      delete attrs.value; // Let ui.tsx handle it
    } else if (comp.type === 'wokwi-servo') {
      if (remoteState && remoteState.angle !== undefined) {
        attrs.angle = remoteState.angle.toString();
      }
    } else if (comp.type === 'wokwi-buzzer') {
      if (remoteState && remoteState.isBuzzing) {
        // Wokwi buzzer visual indicator (if supported) can be driven here
        attrs.color = "red";
      }
    }

    // Pass interactions to the Web Worker
    attrs.onInteract = (event) => {
      console.log(`[SimulatorPage] UI Component ${comp.id} interacted: ${event}. isRunning: ${isRunning}`);

      // Handle physical Arduino board reset button presses
      if (comp.type === 'wokwi-arduino-uno' && event === 'RESET') {
        if (isRunning) handleReset();
        return;
      }

      if (workerRef.current && isRunning) {
        workerRef.current.postMessage({
          type: 'INTERACT',
          compId: comp.id,
          event: event
        });
      }
    };

    return attrs;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>

      {/* TOP BAR */}
      <header style={S.bar}>
        <button style={S.logo} onClick={() => navigate('/')}>⚡ OpenHW-Studio</button>
        <div style={S.barCenter}>
          <select style={S.sel} value={board} onChange={e => setBoard(e.target.value)}>
            <option value="arduino_uno">Arduino Uno</option>
            <option value="pico">Raspberry Pi Pico</option>
            <option value="esp32">ESP32</option>
          </select>
          <Btn color={isRunning ? "var(--border)" : "var(--green)"} disabled={isRunning} onClick={!isRunning ? handleRun : undefined}>{isRunning ? '⏳ Running...' : '▶ Run'}</Btn>
          <Btn color={isRunning ? "var(--red)" : undefined} disabled={!isRunning} onClick={isRunning ? handleStop : undefined}>⏹ Stop</Btn>

          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />
          <Btn onClick={undo} disabled={history.past.length === 0 || isRunning} title="Undo">↩ Undo</Btn>
          <Btn onClick={redo} disabled={history.future.length === 0 || isRunning} title="Redo">↪ Redo</Btn>
          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />

          <Btn color={selected ? "var(--red)" : undefined} disabled={!selected || isRunning} onClick={() => {
            if (!selected || isRunning) return;
            saveHistory();
            if (selected.match(/^w\d+$/)) {
              setWires(prev => prev.filter(w => w.id !== selected));
            } else {
              setComponents(prev => prev.filter(c => c.id !== selected))
              setWires(prev => prev.filter(w => !w.from.startsWith(selected + ':') && !w.to.startsWith(selected + ':')))
            }
            setSelected(null)
          }}>🗑 Delete</Btn>
          <Btn onClick={() => { if (!isRunning) { saveHistory(); setComponents([]); setWires([]); setSelected(null); } }}>↺ Clear All</Btn>

          {/* THEME TOGGLE BUTTON */}
          <Btn onClick={toggleTheme} title="Toggle Dark/Light Mode">
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </Btn>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Hidden file input for PNG import */}
          <input
            ref={importFileRef}
            type="file"
            accept=".png,image/png"
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) importPng(e.target.files[0]); }}
          />
          <Btn color="var(--orange)" onClick={() => importFileRef.current?.click()} title="Import a previously exported OpenHW-Studio PNG to restore the circuit">
            📂 Import PNG
          </Btn>
          <Btn color="var(--purple)" onClick={downloadPng} disabled={isExporting} title="Download circuit as PNG with embedded metadata">
            {isExporting ? '⏳ Exporting...' : '⬇ Export PNG'}
          </Btn>
          {isAuthenticated
            ? <><span style={S.userChip}>👤 {user?.name?.split(' ')[0]}</span><Btn>☁ Save</Btn></>
            : <Btn color="var(--accent)" onClick={() => navigate('/login')}>Sign In to Save</Btn>
          }
        </div>
      </header>

      {/* GUEST BANNER */}
      {(!isAuthenticated && showGuestBanner) && (
        <div style={S.guestBanner}>
          <div style={{ flex: 1 }}>
            ⚠️ <strong>Guest Mode</strong> — No cloud save or progress tracking.
            <button style={{ ...S.bannerBtn, marginLeft: 10 }} onClick={() => navigate('/login')}>Sign in →</button>
          </div>
          <button style={S.bannerCloseBtn} onClick={() => setShowGuestBanner(false)} title="Dismiss">✕</button>
        </div>
      )}

      {/* WIRING MODE HINT */}
      {wireStart && (
        <div style={{ ...S.guestBanner, background: 'rgba(255,170,0,.12)', borderColor: 'rgba(255,170,0,.3)', color: 'var(--orange)' }}>
          〰 <strong>Wiring in progress</strong> — Click another pin to connect. Press Esc to cancel.
          <span style={{ marginLeft: 12 }}>🔵 Started from <strong>{wireStart.compId} [{wireStart.pinLabel}]</strong></span>
        </div>
      )}

      <div style={S.workspace}>

        {/* PALETTE */}
        <aside style={S.palette}>
          <div style={S.paletteHeader}>Components</div>
          <input style={S.paletteSearch} placeholder="🔍 Search..." />
          {CATALOG.map(group => (
            <div key={group.group}>
              <div style={S.groupName}>{group.group}</div>
              {group.items.map(item => (
                <div
                  key={item.type}
                  style={S.paletteItem}
                  draggable
                  onDragStart={e => onPaletteDragStart(e, item)}
                  title={`Drag to canvas to add ${item.label}`}
                >
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>{item.label}</span>
                </div>
              ))}
            </div>
          ))}
          <div style={S.paletteTip}>
            Drag → drop to place<br />
            Click <em>Wire Mode</em> then click pins to connect<br />
            Del key removes selected
          </div>
        </aside>

        {/* CANVAS + SVG WIRE LAYER */}
        <main
          style={{ ...S.canvas, cursor: wireStart ? 'crosshair' : 'default' }}
          ref={canvasRef}
          onDrop={onCanvasDrop}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
          onClick={(e) => {
            if (wireStart) {
              const r = canvasRef.current.getBoundingClientRect();
              const newPt = { x: e.clientX - r.left, y: e.clientY - r.top };
              setWireStart(prev => ({ ...prev, waypoints: [...(prev.waypoints || []), newPt] }));
            } else {
              setSelected(null)
            }
          }}
          onMouseMove={e => {
            if (wireStart && canvasRef.current) {
              const r = canvasRef.current.getBoundingClientRect()
              setMousePos({ x: e.clientX - r.left, y: e.clientY - r.top })
            }
          }}
        >
          {/* BOTTOM SVG layer for wires (Below Components) */}
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}
          >
            {wires.filter(w => w.isBelow === true).map(w => {
              const fromParts = w.from.split(':')
              const toParts = w.to.split(':')
              const p1 = getPinPos(fromParts[0], fromParts[1])
              const p2 = getPinPos(toParts[0], toParts[1])
              if (!p1 || !p2) return null
              const isSelectedWire = selected === w.id;

              return (
                <g key={w.id} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setSelected(w.id); }}>
                  <path d={multiRoutePath(p1, p2, w.waypoints)} stroke="transparent" strokeWidth={16} fill="none" style={{ pointerEvents: 'stroke' }} />
                  <path d={multiRoutePath(p1, p2, w.waypoints)} stroke={isSelectedWire ? 'var(--orange)' : w.color} strokeWidth={isSelectedWire ? 3.5 : 2.5} fill="none" strokeDasharray={isSelectedWire ? "6 4" : "none"} strokeLinecap="round" opacity={0.6} />
                  <circle cx={p1.x} cy={p1.y} r={isSelectedWire ? 5 : 4} fill={isSelectedWire ? 'var(--orange)' : w.color} opacity={0.6} />
                  {(w.waypoints || []).map((pt, i) => <circle key={i} cx={pt.x} cy={pt.y} r={isSelectedWire ? 4 : 3} fill={isSelectedWire ? 'var(--orange)' : w.color} opacity={0.4} />)}
                  <circle cx={p2.x} cy={p2.y} r={isSelectedWire ? 5 : 4} fill={isSelectedWire ? 'var(--orange)' : w.color} opacity={0.6} />
                </g>
              )
            })}
          </svg>

          {/* TOP SVG layer for wires (Above Components) & Context Menu */}
          <svg
            ref={svgRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}
          >
            {/* Placed wires (Top layer) */}
            {wires.filter(w => w.isBelow !== true).map(w => {
              const fromParts = w.from.split(':')
              const toParts = w.to.split(':')
              const p1 = getPinPos(fromParts[0], fromParts[1])
              const p2 = getPinPos(toParts[0], toParts[1])
              if (!p1 || !p2) return null
              const isSelectedWire = selected === w.id;

              return (
                <g key={w.id} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setSelected(w.id); }}>
                  <path d={multiRoutePath(p1, p2, w.waypoints)} stroke="transparent" strokeWidth={16} fill="none" style={{ pointerEvents: 'stroke' }} />
                  <path d={multiRoutePath(p1, p2, w.waypoints)} stroke={isSelectedWire ? 'var(--orange)' : w.color} strokeWidth={isSelectedWire ? 3.5 : 2.5} fill="none" strokeDasharray={isSelectedWire ? "6 4" : "none"} strokeLinecap="round" opacity={0.9} />
                  <circle cx={p1.x} cy={p1.y} r={isSelectedWire ? 5 : 4} fill={isSelectedWire ? 'var(--orange)' : w.color} />
                  {(w.waypoints || []).map((pt, i) => <circle key={i} cx={pt.x} cy={pt.y} r={isSelectedWire ? 4 : 3} fill={isSelectedWire ? 'var(--orange)' : w.color} opacity={0.6} />)}
                  <circle cx={p2.x} cy={p2.y} r={isSelectedWire ? 5 : 4} fill={isSelectedWire ? 'var(--orange)' : w.color} />
                </g>
              )
            })}

            {/* Preview wire while drawing */}
            {wireStart && (
              <path
                d={multiRoutePath({ x: wireStart.x, y: wireStart.y }, mousePos, wireStart.waypoints)}
                stroke="var(--orange)"
                strokeWidth={2}
                strokeDasharray="6 4"
                fill="none"
                strokeLinecap="round"
                opacity={0.8}
              />
            )}
          </svg>

          {/* HTML Overlay for Wire Context Menus (Bypasses SVG foreignObject event bugs) */}
          {(() => {
            const w = wires.find(w => w.id === selected);
            if (!w || isRunning) return null;

            const fromParts = w.from.split(':')
            const toParts = w.to.split(':')
            const p1 = getPinPos(fromParts[0], fromParts[1])
            const p2 = getPinPos(toParts[0], toParts[1])
            if (!p1 || !p2) return null
            const pts = [p1, ...(w.waypoints || []), p2];
            const midPt = pts[Math.floor(pts.length / 2)];

            return (
              <div key={`menu-${w.id}`} style={{
                position: 'absolute',
                left: midPt.x - 65,
                top: midPt.y - 50,
                zIndex: 50,
                background: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.6)', cursor: 'default'
              }}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}>
                <input type="color" value={w.color} onChange={e => updateWireColor(w.id, e.target.value)} style={{ width: 22, height: 22, padding: 0, border: 'none', cursor: 'pointer', background: 'transparent', borderRadius: 4 }} title="Change Color" />
                <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
                <button
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontSize: 16, padding: '2px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
                  onClick={(e) => { e.stopPropagation(); toggleWireLayer(w.id); }}
                  onPointerDown={(e) => { e.stopPropagation(); }}
                  title={w.isBelow ? "Bring to Front" : "Send to Back"}
                >
                  {w.isBelow ? '↑' : '↓'}
                </button>
                <button style={{ background: 'var(--red)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, padding: '4px 8px', borderRadius: 6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }} onPointerDown={(e) => { e.stopPropagation(); deleteWire(w.id); }} onClick={(e) => { e.stopPropagation(); deleteWire(w.id); }} title="Delete Wire">✕</button>
                <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid var(--border)' }} />
                <div style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid var(--bg2)' }} />
              </div>
            )
          })()}

          {/* Empty state */}
          {components.length === 0 && (
            <div style={S.emptyState}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🔌</div>
              <p style={{ fontSize: 16, marginBottom: 8 }}>Drag components from the left panel</p>
              <p style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace' }}>
                Arduino Uno · LED · Resistor · Button · Servo · LCD
              </p>
            </div>
          )}

          {/* Components */}
          {components.map(comp => {
            const pins = PIN_DEFS[comp.type] || []
            const hasError = errorCompIds.has(comp.id)
            const isSelected = selected === comp.id
            return (
              <div
                key={comp.id}
                style={{
                  position: 'absolute',
                  left: comp.x, top: comp.y,
                  width: comp.w, height: comp.h,
                  cursor: wireStart ? 'crosshair' : 'move',
                  zIndex: isSelected ? 5 : 2,
                  userSelect: 'none',
                  pointerEvents: 'all'
                }}
                onMouseDown={e => onCompMouseDown(e, comp.id)}
                onClick={e => onCompClick(e, comp.id)}
              >
                {/* Selection ring */}
                {isSelected && (
                  <div style={{
                    position: 'absolute', inset: -6, borderRadius: 8,
                    border: '2px solid var(--accent)',
                    boxShadow: '0 0 16px var(--glow)',
                    pointerEvents: 'none', zIndex: 10,
                    animation: 'none',
                  }} />
                )}
                {/* Error ring */}
                {hasError && (
                  <div style={{
                    position: 'absolute', inset: -6, borderRadius: 8,
                    border: '2px solid var(--red)',
                    boxShadow: '0 0 16px rgba(255,68,68,.4)',
                    pointerEvents: 'none', zIndex: 10,
                  }} />
                )}

                {/* Component Render */}
                {COMPONENT_REGISTRY[comp.type] ? (
                  // Local UI component rendering SVG
                  React.createElement(COMPONENT_REGISTRY[comp.type].UI, {
                    state: oopStates[comp.id] || {},
                    attrs: getComponentStateAttrs(comp)
                  })
                ) : (
                  // Fallback for unsupported components (if any left)
                  <div
                    style={{ width: '100%', height: '100%', pointerEvents: 'none', background: '#444', border: '1px solid #777' }}
                    ref={el => {
                      if (comp.type === 'wokwi-neopixel-matrix' && el) {
                        neopixelRefs.current[comp.id] = el;
                      }
                    }}
                    dangerouslySetInnerHTML={{
                      __html: `<${comp.type} ${Object.entries(getComponentStateAttrs(comp)).map(([k, v]) => `${k}="${v}"`).join(' ')}></${comp.type}>`,
                    }}
                  />
                )}

                {/* Pins */}
                {pins.map(pin => {
                  const pinStrRef = `${comp.id}:${pin.id}`;
                  const isHovered = hoveredPin === pinStrRef;
                  const isWireStartPin = wireStart?.compId === comp.id && wireStart?.pinId === pin.id;

                  // Check if a wire is connected to this pin
                  const connectedWire = wires.find(w => w.from === pinStrRef || w.to === pinStrRef);
                  const pinColor = connectedWire ? connectedWire.color : (isWireStartPin || isHovered ? '#f1c40f' : 'rgba(255,255,255,0.2)');
                  const pinBorder = connectedWire ? connectedWire.color : (isHovered || isWireStartPin ? '#fff' : 'rgba(255,255,255,0.8)');

                  return (
                    <div
                      key={pin.id}
                      title={`${pin.description || pin.id} — click to wire`}
                      style={{
                        position: 'absolute',
                        left: pin.x, top: pin.y,
                        width: 5, height: 5,
                        background: pinColor,
                        border: `1px solid ${pinBorder}`,
                        borderRadius: '0%', /* matching task3.html */
                        cursor: 'crosshair',
                        zIndex: isHovered ? 30 : 20, /* matching task3.html hover and port z-index */
                        transform: `translate(-50%, -50%)${isHovered ? ' scale(1.5)' : ''}`, /* matching task3.html scale */
                        transition: '0.2s', /* matching task3.html transition */
                        pointerEvents: 'all', /* Fix hit detection */
                      }}
                      onMouseEnter={() => setHoveredPin(pinStrRef)}
                      onMouseLeave={() => setHoveredPin(null)}
                      onClick={e => onPinClick(e, comp.id, pin.id, pin.description || pin.id)}
                    >
                      {/* Pin label tooltip */}
                      {isHovered && (
                        <div style={{
                          position: 'absolute', bottom: 18, left: '50%',
                          transform: 'translateX(-50%)',
                          background: '#111', color: '#fff',
                          padding: '4px 8px', borderRadius: 4,
                          fontSize: 10, whiteSpace: 'nowrap', zIndex: 9999,
                          pointerEvents: 'none', border: '1px solid #444',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
                        }}>
                          {pin.description || pin.id}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Component label */}
                <div style={{
                  position: 'absolute', bottom: -18, left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: 10, color: hasError ? 'var(--red)' : 'var(--text3)',
                  whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace',
                  pointerEvents: 'none',
                }}>
                  {comp.label}
                </div>

                {/* Component Context Menu */}
                {isSelected && !isRunning && (
                  <div style={{
                    position: 'absolute', top: -50, left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.6)', cursor: 'default',
                    pointerEvents: 'all', whiteSpace: 'nowrap', zIndex: 100
                  }}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                  >
                    {comp.type === 'wokwi-led' && (
                      <>
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>Color:</span>
                        <select value={comp.attrs.color || 'red'} onChange={e => updateComponentAttr(comp.id, 'color', e.target.value)} style={{ background: 'var(--bg)', color: 'white', border: '1px solid var(--border)', borderRadius: 4, padding: 2, outline: 'none' }}>
                          <option value="red">Red</option>
                          <option value="green">Green</option>
                          <option value="blue">Blue</option>
                          <option value="yellow">Yellow</option>
                          <option value="orange">Orange</option>
                          <option value="white">White</option>
                        </select>
                      </>
                    )}
                    {comp.type === 'wokwi-resistor' && (
                      <>
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>Res (Ω):</span>
                        <input type="text" value={comp.attrs.value ?? '1000'} onChange={e => updateComponentAttr(comp.id, 'value', e.target.value)} style={{ width: 60, background: 'var(--bg)', color: 'white', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px', outline: 'none' }} />
                      </>
                    )}
                    {comp.type === 'wokwi-power-supply' && (
                      <>
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>Voltage:</span>
                        <input type="number" step="0.1" value={comp.attrs.voltage ?? '5.0'} onChange={e => updateComponentAttr(comp.id, 'voltage', e.target.value)} style={{ width: 50, background: 'var(--bg)', color: 'white', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px', outline: 'none' }} />
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>V</span>
                      </>
                    )}
                    {comp.type === 'wokwi-neopixel-matrix' && (
                      <>
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>Cols:</span>
                        <input type="number" min="1" max="16" value={comp.attrs.cols ?? '8'} onChange={e => updateComponentAttr(comp.id, 'cols', e.target.value)} style={{ width: 40, background: 'var(--bg)', color: 'white', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px', outline: 'none' }} />
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>Rows:</span>
                        <input type="number" min="1" max="16" value={comp.attrs.rows ?? '8'} onChange={e => updateComponentAttr(comp.id, 'rows', e.target.value)} style={{ width: 40, background: 'var(--bg)', color: 'white', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px', outline: 'none' }} />
                      </>
                    )}


                    <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid var(--border)' }} />
                    <div style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid var(--bg2)' }} />
                  </div>
                )}
              </div>
            )
          })}
        </main>

        {/* RIGHT PANEL */}
        <aside style={{ ...S.rightPanel, width: isPanelOpen ? panelWidth : 40, transition: isDragging ? 'none' : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          {/* Drag Handle */}
          {isPanelOpen && (
            <div
              onMouseDown={onMouseDownResize}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 5,
                cursor: 'col-resize',
                zIndex: 10,
                background: 'transparent'
              }}
            />
          )}

          {/* Toggle Button */}
          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            style={{
              position: 'absolute',
              left: isPanelOpen ? 5 : 0,
              top: '50%',
              transform: 'translateY(-50%)',
              height: 48,
              width: 20,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderLeft: 'none',
              borderRadius: '0 8px 8px 0',
              color: 'var(--text3)',
              cursor: 'pointer',
              zIndex: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '2px 0 8px rgba(0,0,0,0.2)'
            }}
          >
            {isPanelOpen ? '▶' : '◀'}
          </button>

          {isPanelOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', paddingLeft: 12 }}>
              {/* Validation panel */}
              {validationErrors.length > 0 && showValidation && (
                <div style={S.validationPanel}>
                  <div style={S.validationHeader}>
                    <span>⚠ Validation ({validationErrors.length})</span>
                    <button style={S.closeBtn} onClick={() => setShowValidation(false)}>✕</button>
                  </div>
                  {validationErrors.map((err, i) => (
                    <div key={i} style={{
                      ...S.validationItem,
                      borderLeftColor: err.type === 'error' ? 'var(--red)' : 'var(--orange)',
                    }}>
                      <span style={{ color: err.type === 'error' ? 'var(--red)' : 'var(--orange)' }}>
                        {err.type === 'error' ? '🔴' : '🟡'} {err.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Wires list */}
              <div style={S.wiresList}>
                <div style={S.wiresHeader}>Connections ({wires.length})</div>
                {wires.length === 0 ? (
                  <div style={{ padding: '12px 12px 16px', fontSize: 12, color: 'var(--text3)' }}>
                    No wires connected.
                  </div>
                ) : (
                  wires.map(w => (
                    <div key={w.id} style={S.wireItem}>
                      <input
                        type="color"
                        value={w.color}
                        onChange={e => updateWireColor(w.id, e.target.value)}
                        style={{ width: 14, height: 14, padding: 0, border: 'none', cursor: 'pointer', background: 'transparent' }}
                        title="Change wire color"
                      />
                      <span style={{ flex: 1, fontSize: 10, color: 'var(--text2)', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {w.from} → {w.to}
                      </span>
                      <button style={S.wireDelete} onClick={() => deleteWire(w.id)}>✕</button>
                    </div>
                  ))
                )}
              </div>

              {/* Code editor */}
              <div style={S.codePanel}>
                <div style={S.codeTabs}>
                  {['code', 'libraries', 'serial', 'plotter'].map(t => (
                    <button
                      key={t}
                      style={{ ...S.codeTab, ...(codeTab === t ? S.codeTabActive : {}) }}
                      onClick={() => setCodeTab(t)}
                    >
                      {t === 'code' ? '{ } Code' : t === 'libraries' ? '📚 Libraries' : t === 'serial' ? '📟 Serial' : '📈 Plotter'}
                    </button>
                  ))}
                </div>
                {codeTab === 'code' && (
                  <div style={{ flex: 1, overflow: 'auto', background: '#070b14' }}>
                    <Editor
                      value={code}
                      onValueChange={code => setCode(code)}
                      highlight={code => Prism.highlight(code, Prism.languages.cpp, 'cpp')}
                      padding={14}
                      style={{
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 12,
                        lineHeight: 1.7,
                        minHeight: '100%',
                        color: '#e8edf5',
                        border: 'none',
                        outline: 'none',
                        resize: 'none'
                      }}
                      textareaClassName="editor-textarea"
                    />
                  </div>
                )}
                {codeTab === 'libraries' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', padding: 12, background: 'var(--bg)' }}>
                    <form onSubmit={searchLibraries} style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                      <input
                        style={S.serialInput}
                        placeholder="Search for an Arduino library..."
                        value={libQuery}
                        onChange={e => setLibQuery(e.target.value)}
                      />
                      <Btn color="var(--accent)" disabled={isSearchingLib}>
                        {isSearchingLib ? '...' : 'Search'}
                      </Btn>
                    </form>

                    {libMessage && (
                      <div style={{ padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13, background: libMessage.type === 'error' ? 'rgba(255,68,68,0.1)' : 'rgba(0,230,118,0.1)', color: libMessage.type === 'error' ? 'var(--red)' : 'var(--green)', border: `1px solid ${libMessage.type === 'error' ? 'rgba(255,68,68,0.3)' : 'rgba(0,230,118,0.3)'}` }}>
                        {libMessage.text}
                      </div>
                    )}

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
                      {libResults.length > 0 && <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 }}>Search Results</div>}
                      {libResults.map((lib, idx) => (
                        <div key={idx} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>{lib.name}</div>
                            <Btn
                              color="var(--green)"
                              disabled={installingLib === lib.name}
                              onClick={() => installLibrary(lib.name)}
                            >
                              {installingLib === lib.name ? 'Installing...' : 'Install'}
                            </Btn>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8, lineHeight: 1.4 }}>{lib.sentence}</div>
                          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace' }}>
                            <span>v{lib.version}</span>
                            <span>{lib.author}</span>
                          </div>
                        </div>
                      ))}

                      {libResults.length === 0 && (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 }}>Installed on Host Server</div>
                          {libInstalled.length === 0 ? (
                            <div style={{ fontSize: 13, color: 'var(--text3)' }}>No external libraries installed.</div>
                          ) : (
                            libInstalled.map((lib, idx) => (
                              <div key={idx} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, opacity: 0.85 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{lib.library.name}</div>
                                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace', marginTop: 6 }}>
                                  <span>v{lib.library.version}</span>
                                  <span>Installed</span>
                                </div>
                              </div>
                            ))
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
                {codeTab === 'serial' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: '#070b14', overflow: 'hidden' }}>
                    {/* Serial Toolbar */}
                    <div style={S.serialToolbar}>
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                        color: serialPaused ? 'var(--text3)' : 'var(--green)'
                      }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: serialPaused ? 'var(--text3)' : 'var(--green)',
                          boxShadow: serialPaused ? 'none' : '0 0 6px var(--green)',
                          animation: (!serialPaused && isRunning) ? 'pulse 1.2s infinite' : 'none',
                          flexShrink: 0
                        }} />
                        {serialPaused ? 'Paused' : isRunning ? 'Live' : 'Idle'}
                      </span>
                      <div style={{ flex: 1 }} />
                      <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {serialHistory.length} lines
                      </span>
                      <button
                        style={S.serialCtrlBtn}
                        onClick={() => setSerialPaused(p => !p)}
                        title={serialPaused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
                      >
                        {serialPaused ? '▶ Resume' : '⏸ Pause'}
                      </button>
                      <button
                        style={{ ...S.serialCtrlBtn, color: 'var(--red)', borderColor: 'rgba(255,68,68,0.3)' }}
                        onClick={() => setSerialHistory([])}
                        title="Clear all output"
                      >
                        🗑 Clear
                      </button>
                    </div>

                    {/* Output Area */}
                    <div ref={serialOutputRef} style={S.serialOutput}>
                      {serialHistory.length === 0 ? (
                        <div style={{ color: 'var(--text3)', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>
                          {isRunning ? 'Waiting for serial output...' : 'Run the simulator to see serial output.'}
                        </div>
                      ) : (
                        serialHistory.map((entry, i) => {
                          const badgeColor = entry.dir === 'rx' ? '#2ecc71' : entry.dir === 'tx' ? '#3498db' : '#888';
                          const badgeBg = entry.dir === 'rx' ? 'rgba(46,204,113,0.12)' : entry.dir === 'tx' ? 'rgba(52,152,219,0.12)' : 'rgba(128,128,128,0.12)';
                          return (
                            <div key={i} style={S.serialLine}>
                              <span style={S.serialTs}>{entry.ts || ''}</span>
                              <span style={{ ...S.serialBadge, color: badgeColor, background: badgeBg, border: `1px solid ${badgeColor}40` }}>
                                {entry.dir?.toUpperCase() || 'RX'}
                              </span>
                              <span style={{ flex: 1, color: entry.dir === 'tx' ? '#3498db' : entry.dir === 'sys' ? '#888' : 'var(--green)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {entry.text}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* TX Input Row */}
                    <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, background: '#0d1220' }}>
                      <input
                        style={{ ...S.serialInput, flex: 1, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}
                        placeholder="Send message to Arduino..."
                        value={serialInput}
                        onChange={e => setSerialInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') sendSerialInput(); }}
                        disabled={!isRunning}
                      />
                      <button
                        onClick={sendSerialInput}
                        disabled={!isRunning || !serialInput.trim()}
                        style={{
                          background: (isRunning && serialInput.trim()) ? 'var(--accent)' : 'transparent',
                          border: '1px solid var(--accent)', color: (isRunning && serialInput.trim()) ? '#fff' : 'var(--text3)',
                          borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700,
                          cursor: (isRunning && serialInput.trim()) ? 'pointer' : 'not-allowed',
                          fontFamily: 'inherit', transition: 'all .15s', whiteSpace: 'nowrap'
                        }}
                      >
                        ↑ Send
                      </button>
                    </div>
                  </div>
                )}
                {codeTab === 'plotter' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--bg)', overflow: 'hidden' }}>
                    {/* Plotter Toolbar */}
                    <div style={S.plotterToolbar}>
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                        color: plotterPaused ? 'var(--text3)' : 'var(--green)'
                      }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: plotterPaused ? 'var(--text3)' : 'var(--green)',
                          boxShadow: plotterPaused ? 'none' : '0 0 6px var(--green)',
                        }} />
                        {plotterPaused ? 'Paused' : isRunning ? 'Plotting live...' : 'Idle'}
                      </span>
                      <div style={{ flex: 1 }} />
                      <button
                        style={S.serialCtrlBtn}
                        onClick={() => setPlotterPaused(p => !p)}
                        title={plotterPaused ? 'Resume plotting' : 'Pause plotting'}
                      >
                        {plotterPaused ? '▶ Resume' : '⏸ Pause'}
                      </button>
                      <button
                        style={{ ...S.serialCtrlBtn, color: 'var(--red)', borderColor: 'rgba(255,68,68,0.3)' }}
                        onClick={() => setPlotData([])}
                        title="Clear plot"
                      >
                        🗑 Clear
                      </button>
                    </div>

                    {/* Pin Selector */}
                    <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>Pins:</span>
                      {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'].map(pin => {
                        const isSel = selectedPlotPins.includes(pin);
                        const isAna = pin.startsWith('A');
                        return (
                          <button
                            key={pin}
                            onClick={() => setSelectedPlotPins(prev => {
                              if (prev.includes(pin)) return prev.filter(p => p !== pin);
                              if (prev.length >= 4) return [...prev.slice(1), pin];
                              return [...prev, pin];
                            })}
                            style={{
                              background: isSel ? (isAna ? 'rgba(52,152,219,0.2)' : 'rgba(46,204,113,0.2)') : 'transparent',
                              border: `1px solid ${isSel ? (isAna ? '#3498db' : '#2ecc71') : 'var(--border)'}`,
                              color: isSel ? (isAna ? '#3498db' : '#2ecc71') : 'var(--text3)',
                              borderRadius: 4, padding: '1px 5px', fontSize: 10, cursor: 'pointer'
                            }}
                          >{pin}</button>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    {selectedPlotPins.length > 0 && (
                      <div style={S.plotterLegend}>
                        {selectedPlotPins.map(pin => (
                          <span key={pin} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: pin.startsWith('A') ? '#3498db' : '#2ecc71', flexShrink: 0 }} />
                            <span style={{ color: 'var(--text2)', fontFamily: 'JetBrains Mono, monospace' }}>Pin {pin}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Canvas */}
                    <div style={{ flex: 1, position: 'relative' }}>
                      {!isRunning && plotData.length === 0 ? (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', gap: 8, fontSize: 13 }}>
                          <span style={{ fontSize: 28 }}>📈</span>
                          Run simulator to trace signals.
                        </div>
                      ) : (
                        <canvas
                          ref={plotterCanvasRef}
                          width={800}
                          height={600}
                          style={{ position: 'absolute', width: '100%', height: '100%', background: '#070b14' }}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

// ─── Tiny button component (Updated to support CSS Variables) ───────────────
function Btn({ children, onClick, color, title, disabled }) {
  const [hov, setHov] = useState(false)
  const isInteractive = !disabled && hov;
  return (
    <button
      title={title}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: disabled ? 'transparent' : (color ? (isInteractive ? color : 'transparent') : isInteractive ? 'var(--border)' : 'var(--card)'),
        border: `1px solid ${color || 'var(--border)'}`,
        color: disabled ? 'var(--text3)' : (color ? (isInteractive ? '#fff' : color) : 'var(--text)'),
        padding: '7px 14px', borderRadius: 8,
        fontFamily: 'Space Grotesk, sans-serif', fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
        fontWeight: color ? 700 : 500,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}

// ─── Styles (Refactored to map strictly to CSS variables) ───────────────────────
const S = {
  page: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg)', fontFamily: "'Space Grotesk',sans-serif", color: 'var(--text)' },
  bar: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' },
  logo: { background: 'none', border: 'none', color: 'var(--accent)', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  barCenter: { display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' },
  sel: { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '7px 12px', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' },
  userChip: { background: 'var(--card)', border: '1px solid var(--border)', padding: '7px 12px', borderRadius: 8, fontSize: 13, color: 'var(--text2)' },
  guestBanner: { background: 'rgba(255,145,0,.1)', borderBottom: '1px solid rgba(255,145,0,.25)', color: 'var(--orange)', padding: '8px 20px', fontSize: 13, display: 'flex', alignItems: 'center', flexShrink: 0 },
  bannerBtn: { background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline', fontFamily: 'inherit', padding: 0 },
  bannerCloseBtn: { background: 'none', border: 'none', color: 'var(--orange)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', opacity: 0.7, padding: '4px 8px' },
  workspace: { display: 'flex', flex: 1, overflow: 'hidden' },

  palette: { width: 182, background: 'var(--bg2)', borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 },
  paletteHeader: { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.1em', padding: '4px 8px 8px' },
  paletteSearch: { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '7px 10px', borderRadius: 8, fontFamily: 'inherit', fontSize: 12, width: '100%', marginBottom: 8, outline: 'none' },
  groupName: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '4px 8px' },
  paletteItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'grab', transition: 'all .15s', border: '1px solid transparent', userSelect: 'none' },
  paletteTip: { marginTop: 'auto', padding: '10px 8px', fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 },

  canvas: {
    flex: 1, position: 'relative', overflow: 'hidden',
    backgroundColor: 'var(--canvas-bg)',
    backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
    backgroundSize: '24px 24px',
  },
  emptyState: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', textAlign: 'center', pointerEvents: 'none' },

  rightPanel: { position: 'relative', background: 'var(--bg2)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden', transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)' },

  validationPanel: { background: 'var(--bg3)', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  validationHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: 'var(--orange)' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' },
  validationItem: { padding: '6px 12px', fontSize: 12, borderLeft: '3px solid', marginBottom: 2, lineHeight: 1.5 },

  wiresList: { background: 'var(--bg3)', borderBottom: '1px solid var(--border)', maxHeight: 140, overflowY: 'auto', flexShrink: 0 },
  wiresHeader: { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '8px 12px 4px' },
  wireItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderBottom: '1px solid var(--border)' },
  wireDelete: { background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', flexShrink: 0 },

  codePanel: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  codeTabs: { display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  codeTab: { flex: 1, padding: '10px 4px', background: 'none', border: 'none', color: 'var(--text3)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', borderBottom: '2px solid transparent', transition: 'all .15s' },
  codeTabActive: { color: 'var(--accent)', borderBottomColor: 'var(--accent)' },
  codeEditor: { flex: 1, color: 'var(--text)', border: 'none', outline: 'none', resize: 'none' },
  codePlaceholder: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', gap: 8 },
  serialOutput: { flex: 1, overflowY: 'auto', padding: '6px 0', display: 'flex', flexDirection: 'column' },
  serialInput: { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '7px 10px', borderRadius: 8, fontFamily: 'inherit', fontSize: 12, outline: 'none' },
  serialToolbar: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: '#0d1220', flexShrink: 0 },
  serialCtrlBtn: { background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  serialLine: { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '2px 12px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', borderBottom: '1px solid rgba(255,255,255,0.03)' },
  serialTs: { color: 'rgba(255,255,255,0.25)', fontSize: 10, minWidth: 84, flexShrink: 0, paddingTop: 1 },
  serialBadge: { display: 'inline-block', fontSize: 9, fontWeight: 700, borderRadius: 3, padding: '1px 4px', flexShrink: 0, marginTop: 1 },
  plotterToolbar: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  plotterLegend: { display: 'flex', flexWrap: 'wrap', gap: '4px 16px', padding: '4px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 },
}
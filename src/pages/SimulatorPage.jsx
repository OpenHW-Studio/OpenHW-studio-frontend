import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext.jsx'
import { compileCode, fetchInstalledLibraries, searchLibraries, installLibrary, submitCustomComponent, fetchInstalledComponentsWithFiles } from '../services/simulatorService.js'
import { getCachedHex, setCachedHex, enqueueComponent, getQueuedComponents, dequeueComponent } from '../services/offlineCache.js'
import { saveProject, loadProject, listProjects, deleteProject, renameProject, generateProjectId, formatProjectDate } from '../services/projectStore.js'
import html2canvas from 'html2canvas'
import JSZip from 'jszip';
import * as Babel from '@babel/standalone';

import * as EmulatorComponents from '@openhw/emulator/src/components/index.ts';

// Web Editor features
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
// Import a Prism theme (or we can inject our own CSS wrapper)
import 'prismjs/themes/prism-tomorrow.css';

// Build Catalog & UI Registry dynamically from local backend imports
const COMPONENT_REGISTRY = {};

Object.entries(EmulatorComponents).forEach(([key, module]) => {
  // Skip the base class
  if (key === 'BaseComponent') return;

  if (module && module.manifest) {
    const compId = module.manifest.type || module.manifest.id || key;
    COMPONENT_REGISTRY[compId] = module;
  }
});

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

// Tracks component types that were dynamically injected from the backend (not built-in).
// Used by the polling loop to detect deletions and purge them from the registry.
const BACKEND_INJECTED_TYPES = new Set();

let nextId = 1
let nextWireId = 1

const EXAMPLES_BASE_URL = import.meta.env.VITE_EXAMPLES_BASE_URL || 'http://localhost:5000/examples';

// ─── RENDER ROUNDED PATH FROM POINT ARRAY ─────────────────────────────────
function renderRoundedPath(pts) {
  if (!pts || pts.length < 2) return '';
  const r = 10;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1], curr = pts[i], next = pts[i + 1];
    const distPrev = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const distNext = Math.hypot(next.x - curr.x, next.y - curr.y);
    const cornerR = Math.min(r, distPrev / 2, distNext / 2);
    if (cornerR < 0.5) { d += ` L ${curr.x} ${curr.y}`; continue; }
    const ps = { x: curr.x + (prev.x - curr.x) * (cornerR / distPrev), y: curr.y + (prev.y - curr.y) * (cornerR / distPrev) };
    const pe = { x: curr.x + (next.x - curr.x) * (cornerR / distNext), y: curr.y + (next.y - curr.y) * (cornerR / distNext) };
    d += ` L ${ps.x} ${ps.y} Q ${curr.x} ${curr.y} ${pe.x} ${pe.y}`;
  }
  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d;
}

// ─── COMPUTE ORTHOGONAL WIRE CORNER POINTS ─────────────────────────────────
// Returns [p1, exitStub1, ...midCorners, exitStub2, p2].
// If waypoints[0]._corner is true, uses those as explicit corners directly.
// Otherwise applies smart-exit routing: flips the stub if it points AWAY from
// the target, so the wire goes toward the destination instead of U-turning.
function computeWireOrthoPoints(p1, e1, e2, p2, waypoints = []) {
  // Explicit corner mode — stored by segment dragging
  if (waypoints.length > 0 && waypoints[0]._corner) {
    const pts = [p1, ...waypoints, p2];
    return pts.filter((pt, i, arr) => i === 0 || pt.x !== arr[i - 1].x || pt.y !== arr[i - 1].y);
  }

  // Smart exit: flip stub when it points away from the other endpoint
  const dx1 = e1.x - p1.x, dy1 = e1.y - p1.y;
  const dx2 = e2.x - p2.x, dy2 = e2.y - p2.y;
  const e1IsVert = Math.abs(dy1) > Math.abs(dx1);
  const e2IsVert = Math.abs(dy2) > Math.abs(dx2);

  let se1 = e1, se2 = e2;
  if (e1IsVert) {
    if (dy1 !== 0 && (p2.y - p1.y) * dy1 < 0) se1 = { x: p1.x, y: p1.y - dy1 };
  } else {
    if (dx1 !== 0 && (p2.x - p1.x) * dx1 < 0) se1 = { x: p1.x - dx1, y: p1.y };
  }
  if (e2IsVert) {
    if (dy2 !== 0 && (p1.y - p2.y) * dy2 < 0) se2 = { x: p2.x, y: p2.y - dy2 };
  } else {
    if (dx2 !== 0 && (p1.x - p2.x) * dx2 < 0) se2 = { x: p2.x - dx2, y: p2.y };
  }

  const sdx1 = se1.x - p1.x, sdy1 = se1.y - p1.y;
  const sdx2 = se2.x - p2.x, sdy2 = se2.y - p2.y;
  const e1Horiz = Math.abs(sdx1) >= Math.abs(sdy1);
  const e2Horiz = Math.abs(sdx2) >= Math.abs(sdy2);

  let midPts;
  if (e1Horiz && e2Horiz) {
    const midX = (se1.x + se2.x) / 2;
    midPts = [{ x: midX, y: se1.y }, { x: midX, y: se2.y }];
  } else if (!e1Horiz && !e2Horiz) {
    const midY = (se1.y + se2.y) / 2;
    midPts = [{ x: se1.x, y: midY }, { x: se2.x, y: midY }];
  } else if (e1Horiz && !e2Horiz) {
    midPts = [{ x: se2.x, y: se1.y }];
  } else {
    midPts = [{ x: se1.x, y: se2.y }];
  }

  let pts = [p1, se1, ...midPts, se2, p2];
  return pts.filter((pt, i, arr) => i === 0 || pt.x !== arr[i - 1].x || pt.y !== arr[i - 1].y);
}

// ─── SINGLE SOURCE OF TRUTH: full orthogonal point list for any wire mode ──
// Mode 1 – explicit corners (_corner:true, from segment dragging): use points as-is.
// Mode 2 – route-hint waypoints (clicked mid-draw, no _corner): midX dog-leg.
// Mode 3 – no waypoints: smart-exit auto-routing.
function getWirePoints(p1, e1, e2, p2, waypoints = []) {
  // Mode 1: explicit corners stored by segment dragging
  if (waypoints.length > 0 && waypoints[0]._corner) {
    let pts = [p1, ...waypoints, p2];
    return pts.filter((pt, i, arr) => i === 0 || pt.x !== arr[i - 1].x || pt.y !== arr[i - 1].y);
  }

  // Mode 2: route-hint waypoints – midX dog-leg between each successive hint
  if (waypoints.length > 0) {
    const hints = [e1, ...waypoints, e2];
    let pts = [p1];
    for (let i = 0; i < hints.length - 1; i++) {
      const a = hints[i], b = hints[i + 1];
      pts.push(a);
      const midX = (a.x + b.x) / 2;
      pts.push({ x: midX, y: a.y });
      pts.push({ x: midX, y: b.y });
    }
    pts.push(e2, p2);
    return pts.filter((pt, i, arr) => i === 0 || pt.x !== arr[i - 1].x || pt.y !== arr[i - 1].y);
  }

  // Mode 3: no waypoints – smart-exit routing
  return computeWireOrthoPoints(p1, e1, e2, p2, []);
}

// Preview wire while drawing (start→cursor with optional in-progress hints)
function multiRoutePath(p1, p2, waypoints = []) {
  if (!p1 || !p2) return '';
  const hints = [p1, ...waypoints, p2];
  let pts = [];
  for (let i = 0; i < hints.length - 1; i++) {
    const a = hints[i], b = hints[i + 1];
    if (i === 0) pts.push(a);
    const midX = (a.x + b.x) / 2;
    pts.push({ x: midX, y: a.y });
    pts.push({ x: midX, y: b.y });
    pts.push(b);
  }
  pts = pts.filter((pt, i, arr) => i === 0 || pt.x !== arr[i - 1].x || pt.y !== arr[i - 1].y);
  return renderRoundedPath(pts);
}

// Builds the SVG path string for a placed wire.
function buildWirePath(p1, e1, e2, p2, waypoints = []) {
  return renderRoundedPath(getWirePoints(p1, e1, e2, p2, waypoints));
}

function wireColor(pinLabel) {
  if (!pinLabel) return '#2ecc71';
  const l = pinLabel.toUpperCase();
  if (l.includes('GND') || l === 'CATHODE') return '#808080'; // gray
  if (l.includes('5V') || l.includes('3.3V') || l === 'VCC' || l === 'ANODE') return '#e74c3c'; // red
  return '#2ecc71'; // green default
}

// ── Palette group visual helpers ─────────────────────────────────────────────
const GROUP_ICON_SVG = {
  'Boards':    (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="18" x2="8" y2="22"/><line x1="16" y1="18" x2="16" y2="22"/><line x1="2" y1="8" x2="6" y2="8"/><line x1="2" y1="16" x2="6" y2="16"/><line x1="18" y1="8" x2="22" y2="8"/><line x1="18" y1="16" x2="22" y2="16"/><rect x="8" y="8" width="8" height="8" rx="1" fill={c} fillOpacity="0.2"/></svg>,
  'Outputs':   (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="5"/><path d="M12 15v4M9 19h6M8.5 7.5A5 5 0 0 1 12 5"/></svg>,
  'Inputs':    (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="10" width="12" height="8" rx="2"/><circle cx="12" cy="10" r="2" fill={c} fillOpacity="0.3"/><line x1="12" y1="2" x2="12" y2="8"/><line x1="4" y1="18" x2="6" y2="18"/><line x1="18" y1="18" x2="20" y2="18"/></svg>,
  'Passives':  (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="12" x2="6" y2="12"/><rect x="6" y="8" width="12" height="8" rx="1"/><line x1="18" y1="12" x2="22" y2="12"/></svg>,
  'Power':     (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="12"/><path d="M7.5 5A8 8 0 1 0 16.5 5"/></svg>,
  'Actuators': (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>,
  'Memory':    (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="14" rx="2"/><line x1="8" y1="5" x2="8" y2="19"/><line x1="12" y1="5" x2="12" y2="19"/><line x1="16" y1="5" x2="16" y2="19"/></svg>,
  'Displays':  (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="14" rx="2"/><line x1="8" y1="22" x2="16" y2="22"/><line x1="12" y1="18" x2="12" y2="22"/></svg>,
  'Sensors':   (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 5.5A11 11 0 0 0 5.5 18.5M18.5 5.5A11 11 0 0 1 18.5 18.5M8.5 8.5A6 6 0 0 0 8.5 15.5M15.5 8.5A6 6 0 0 1 15.5 15.5"/><circle cx="12" cy="12" r="1.5" fill={c}/></svg>,
  'Logic':     (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h8c3.3 0 6 2.7 6 6s-2.7 6-6 6H4z"/><line x1="4" y1="4" x2="4" y2="20"/><line x1="2" y1="11" x2="4" y2="11"/><line x1="2" y1="17" x2="4" y2="17"/><line x1="18" y1="14" x2="22" y2="14"/></svg>,
};
const GROUP_COLORS = {
  'Boards': '#6366f1', 'Outputs': '#22c55e', 'Inputs': '#3b82f6',
  'Passives': '#f59e0b', 'Power': '#ef4444', 'Actuators': '#06b6d4',
  'Memory': '#8b5cf6', 'Displays': '#ec4899', 'Sensors': '#14b8a6', 'Logic': '#8b5cf6',
};

export default function SimulatorPage() {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const { projectName = '' } = useParams()
  const location = useLocation()
  const assessmentParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const assessmentMode = assessmentParams.get('mode') === 'assessment'
  const assessmentProjectName = assessmentParams.get('project') || projectName

  // Theme Logic — defaults to light mode
  const [theme, setTheme] = useState(() => {
    const t = document.documentElement.getAttribute('data-theme') || 'light';
    document.documentElement.setAttribute('data-theme', t);
    return t;
  })

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  const [, setCustomCatalogCounter] = useState(0); // Trigger palette re-render on injection
  const [previewBanner, setPreviewBanner] = useState(null); // { id, label } — set when opened from admin "Test in Simulator"
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false)
  const [components, setComponents] = useState([])
  const [wires, setWires] = useState([])
  const [paletteSearch, setPaletteSearch] = useState('')
  const [showGuestBanner, setShowGuestBanner] = useState(true)
  const [history, setHistory] = useState({ past: [], future: [] })
  const [selected, setSelected] = useState(null)   // comp or wire id
  const [wireStart, setWireStart] = useState(null)   // { compId, pinId, pinLabel, x, y }
  const [wireClickPos, setWireClickPos] = useState(null) // canvas-space position where wire was clicked
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  // Segment-drag: tracks which wire segment handle is being dragged
  // { wireId, segIdx, isHoriz, startMouseCanvas: {x,y}, startPts: [...] }
  const [segDrag, setSegDrag] = useState(null)
  const segDragRef = useRef(null)
  const [hoveredPin, setHoveredPin] = useState(null)
  const [board, setBoard] = useState('arduino_uno')
  const [codeTab, setCodeTab] = useState('code')
  const [code, setCode] = useState('void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}\n')
  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const [panelWidth, setPanelWidth] = useState(400)
  const [isDragging, setIsDragging] = useState(false)
  const [isPaletteHovered, setIsPaletteHovered] = useState(false)
  // Palette redesign state
  const [paletteViewMode, setPaletteViewMode] = useState('list') // 'list' | 'grid'
  const [favoriteComponents, setFavoriteComponents] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('openhw_fav_components') || '[]')); }
    catch { return new Set(); }
  })
  const [showFavorites, setShowFavorites] = useState(true)
  const [paletteContextMenu, setPaletteContextMenu] = useState(null) // { x, y, item }
  const [selectedPaletteItem, setSelectedPaletteItem] = useState(null) // item for description panel
  const [showComponentDesc, setShowComponentDesc] = useState(true) // description panel visible
  const [showCreateComponentModal, setShowCreateComponentModal] = useState(false)
  const paletteContextMenuRef = useRef(null)
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [showCanvasMenu, setShowCanvasMenu] = useState(false)
  const [wirepointsEnabled, setWirepointsEnabled] = useState(false)
  const canvasZoomRef = useRef(1)
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })
  const canvasOffsetRef = useRef({ x: 0, y: 0 })
  const [isCanvasLocked, setIsCanvasLocked] = useState(false)
  const isCanvasLockedRef = useRef(false)
  const [showGrid, setShowGrid] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [quickAdd, setQuickAdd] = useState(null)   // { screenX, screenY, canvasX, canvasY }
  const [quickAddSearch, setQuickAddSearch] = useState('')
  const [quickAddIdx, setQuickAddIdx] = useState(0)
  const quickAddInputRef = useRef(null)
  const pageRef = useRef(null)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const didPanRef = useRef(false)

  const [validationErrors, setValidationErrors] = useState([])
  const [showValidation, setShowValidation] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [isCompiling, setIsCompiling] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
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
  const lastCompiledRef = useRef(null)
  const neopixelRefs = useRef({})

  const serialPlotBufferRef = useRef('');
  const serialPlotLabelsRef = useRef([]);
  const latestParsedSerialRef = useRef([]);

  const canvasRef = useRef(null)
  const svgRef = useRef(null)
  const dragPayload = useRef(null)
  const movingComp = useRef(null)
  const componentZipInputRef = useRef(null);
  // Reactive refs — kept current every render so async effects get fresh values
  const getPinPosRef = useRef(null);
  const componentsRef = useRef([]);
  const pinDefsRef = useRef({});

  // ── Project persistence state ────────────────────────────────────────────────
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [currentProjectName, setCurrentProjectName] = useState('Untitled');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveDialogName, setSaveDialogName] = useState('');
  const [myProjects, setMyProjects] = useState([]);
  const currentProjectIdRef = useRef(null);   // mirror for use inside async callbacks
  const autoSaveTimerRef = useRef(null);
  // My Projects dropdown state
  const [showProjectsDropdown, setShowProjectsDropdown] = useState(false);
  const [renamingProjectId, setRenamingProjectId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const projectsDropdownRef = useRef(null);
  const backupRestoreInputRef = useRef(null);

  const handleUploadZip = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const zip = await JSZip.loadAsync(file);
      let manifestStr = null, uiStr = null, logicStr = null, validationStr = null, indexStr = null, docHtml = null;
      for (const relativePath of Object.keys(zip.files)) {
        if (relativePath.endsWith('manifest.json')) manifestStr = await zip.files[relativePath].async('string');
        if (relativePath.endsWith('ui.tsx') || relativePath.endsWith('ui.jsx')) uiStr = await zip.files[relativePath].async('string');
        if (relativePath.endsWith('logic.ts') || relativePath.endsWith('logic.js')) logicStr = await zip.files[relativePath].async('string');
        if (relativePath.endsWith('validation.ts') || relativePath.endsWith('validation.js')) validationStr = await zip.files[relativePath].async('string');
        if (relativePath.endsWith('index.ts') || relativePath.endsWith('index.js')) indexStr = await zip.files[relativePath].async('string');
        // Doc folder — any HTML file inside doc/ directory
        if (/\/doc\/.*\.html$/i.test(relativePath) || /^doc\/.*\.html$/i.test(relativePath)) {
          docHtml = await zip.files[relativePath].async('string');
        }
      }
      if (!manifestStr || !uiStr || !logicStr || !validationStr || !indexStr) {
        alert('Error: Zip must contain manifest.json, ui.tsx, logic.ts, validation.ts, and index.ts');
        return;
      }
      const manifest = JSON.parse(manifestStr);
      const submitPayload = {
        id: manifest.type, manifest, ui: uiStr, logic: logicStr, validation: validationStr, index: indexStr,
        ...(docHtml ? { doc: docHtml } : {})
      };

      let submitted = false;
      let offlineQueued = false;
      try {
        await submitCustomComponent(submitPayload);
        submitted = true;
      } catch (submitErr) {
        // Network unavailable — queue for later submission when back online
        await enqueueComponent(submitPayload);
        offlineQueued = true;
      }

      // --- ZERO-TOUCH SANDBOX INJECTION ---
      const transpileUI = Babel.transform(uiStr, { filename: 'ui.tsx', presets: ['react', 'typescript', 'env'] }).code;
      const transpileLogic = Babel.transform(logicStr, { filename: 'logic.ts', presets: ['typescript', 'env'] }).code;

      const exportsUI = {};
      const evalUI = new Function('exports', 'require', 'React', transpileUI);
      evalUI(exportsUI, (mod) => {
        if (mod === 'react') return React;
        return null;
      }, React);

      const uiComponent = exportsUI[Object.keys(exportsUI).find(k => k.toLowerCase().endsWith('ui'))] || exportsUI[Object.keys(exportsUI)[0]] || exportsUI.default;
      const contextMenu = exportsUI[Object.keys(exportsUI).find(k => k.toLowerCase().includes('contextmenu'))];

      if (uiComponent) {
        const newCatItem = { ...manifest };
        delete newCatItem.pins;
        delete newCatItem.group;

        let group = LOCAL_CATALOG.find(g => g.group === manifest.group);
        if (!group) {
          group = { group: manifest.group, items: [] };
          LOCAL_CATALOG.push(group);
        }
        group.items = group.items.filter(i => i.type !== manifest.type);
        group.items.push(newCatItem);

        COMPONENT_REGISTRY[manifest.type] = {
          manifest,
          UI: uiComponent,
          ContextMenu: contextMenu,
          contextMenuDuringRun: !!(exportsUI.contextMenuDuringRun || manifest.contextMenuDuringRun),
          contextMenuOnlyDuringRun: !!(exportsUI.contextMenuOnlyDuringRun || manifest.contextMenuOnlyDuringRun),
          logicCode: transpileLogic,
          ...(docHtml ? { doc: docHtml } : {})
        };
        if (manifest.pins) {
          LOCAL_PIN_DEFS[manifest.type] = manifest.pins;
        }
        setCustomCatalogCounter(c => c + 1);
        if (submitted) {
          alert(`Successfully submitted to admin AND injected ${manifest.label} into your local Sandbox Memory!`);
        } else if (offlineQueued) {
          alert(`You are offline. "${manifest.label}" has been injected locally and will be submitted to the admin automatically when you reconnect.`);
        }
      }
    } catch (e) {
      alert(`Error processing ZIP: ${e.message}`);
    }
    event.target.value = '';
  };

  // ── Library Manager State ───────────────────────────────────────────────────
  const [libQuery, setLibQuery] = useState('')
  const [libResults, setLibResults] = useState([])
  const [libInstalled, setLibInstalled] = useState([])
  const [isSearchingLib, setIsSearchingLib] = useState(false)
  const [installingLib, setInstallingLib] = useState(null)
  const [libMessage, setLibMessage] = useState(null)

  const loadLibraries = async () => {
    try {
      const libraries = await fetchInstalledLibraries();
      setLibInstalled(libraries);
      setLibMessage(null);
    } catch (err) {
      console.error('Failed to fetch installed libraries', err);
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || 'Failed to load installed libraries.';
      if (status === 503) {
        setLibMessage({ type: 'error', text: msg });
      }
    }
  };

  useEffect(() => {
    loadLibraries();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDemoProject = async () => {
      if (!projectName) return;

      try {
        const pngName = 'circuit.png';
        const pngUrl = `${EXAMPLES_BASE_URL}/${projectName}/${pngName}`;
        const pngRes = await fetch(pngUrl);
        if (!pngRes.ok) return;
        const blob = await pngRes.blob();
        if (cancelled) return;
        const file = new File([blob], pngName, { type: blob.type || 'image/png' });
        importPng(file);
      } catch (err) {
        console.error(`Failed to load demo project "${projectName}"`, err);
      }
    };

    loadDemoProject();
    return () => { cancelled = true; };
  }, [projectName]);

  // ── Offline component queue: flush to backend when connectivity restores ──
  useEffect(() => {
    const drainQueue = async () => {
      const queued = await getQueuedComponents();
      if (!queued.length) return;
      for (const item of queued) {
        try {
          await submitCustomComponent(item.payload);
          await dequeueComponent(item.queueId);
          console.log(`[Offline Queue] Submitted queued component: ${item.payload.id}`);
        } catch {
          // Still offline or backend unreachable — leave in queue for next attempt
        }
      }
    };

    // Attempt drain on initial mount in case items were queued in a previous session
    if (navigator.onLine) drainQueue();

    window.addEventListener('online', drainQueue);
    return () => window.removeEventListener('online', drainQueue);
  }, []);

  // ── Project: owner string ─────────────────────────────────────────────────
  const getOwner = () => user?.email || 'guest';

  // ── Project: load project list helper ────────────────────────────────────
  const refreshProjectList = async () => {
    const projects = await listProjects(getOwner());
    setMyProjects(projects);
  };

  // ── Project: load most-recent project on first mount ─────────────────────
  // ── Project: load most-recent project on first mount ─────────────────────
  useEffect(() => {
    // Don't auto-load a project if we're in assessment mode or loading a demo
    if (assessmentMode || projectName) return;

    const owner = user?.email || 'guest';
    listProjects(owner).then((projects) => {
      if (projects.length === 0) return;
      const latest = projects[0]; // already sorted newest-first
      setBoard(latest.board || 'arduino_uno');
      setCode(latest.code || '');
      setComponents(latest.components || []);
      setWires(latest.connections || []);
      setCurrentProjectId(latest.id);
      currentProjectIdRef.current = latest.id;
      setCurrentProjectName(latest.name || 'Untitled');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Project: debounced auto-save whenever circuit changes ─────────────────
  useEffect(() => {
    // Don't trigger an empty-project save on initial render
    if (components.length === 0 && wires.length === 0 && code.trim() === '') return;

    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      const owner = user?.email || 'guest';
      let id = currentProjectIdRef.current;
      if (!id) {
        id = generateProjectId();
        currentProjectIdRef.current = id;
        setCurrentProjectId(id);
      }
      await saveProject({
        id,
        name: currentProjectName || 'Untitled',
        board,
        components,
        connections: wires,
        code,
        owner,
      });
    }, 2500);

    return () => clearTimeout(autoSaveTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [components, wires, code, board]);

  useEffect(() => { canvasZoomRef.current = canvasZoom; }, [canvasZoom]);
  useEffect(() => { canvasOffsetRef.current = canvasOffset; }, [canvasOffset]);
  useEffect(() => { isCanvasLockedRef.current = isCanvasLocked; }, [isCanvasLocked]);
  useEffect(() => { segDragRef.current = segDrag; }, [segDrag]);

  // Quick-add menu: auto-focus input when menu opens
  useEffect(() => {
    if (quickAdd && quickAddInputRef.current) {
      quickAddInputRef.current.focus();
    }
  }, [quickAdd]);

  // Quick-add menu: close when clicking outside
  useEffect(() => {
    if (!quickAdd) return;
    const handler = (e) => {
      if (!e.target.closest('[data-quickadd]')) setQuickAdd(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [quickAdd]);

  // My Projects dropdown: close when clicking outside
  useEffect(() => {
    if (!showProjectsDropdown) return;
    const handler = (e) => {
      if (projectsDropdownRef.current && !projectsDropdownRef.current.contains(e.target)) {
        setShowProjectsDropdown(false);
        setRenamingProjectId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProjectsDropdown]);

  // Fullscreen sync
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      pageRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  // ── Admin Preview: inject a pending component passed via sessionStorage ──────
  // When admin clicks "Test in Simulator", AdminPage stores the component in
  // sessionStorage and opens /simulator in a new tab. This effect picks it up,
  // transpiles + injects it into the local registry (browser memory only),
  // and shows a banner so the admin knows it's in preview mode.
  useEffect(() => {
    const previewKey = sessionStorage.getItem('pendingPreviewKey');
    if (!previewKey) return;

    const raw = sessionStorage.getItem(previewKey);
    // Clean up immediately so a manual refresh doesn't re-inject
    sessionStorage.removeItem(previewKey);
    sessionStorage.removeItem('pendingPreviewKey');
    if (!raw) return;

    try {
      const comp = JSON.parse(raw);
      const { manifest, uiRaw, logicRaw } = comp;
      if (!manifest || !uiRaw || !logicRaw) return;

      const compType = manifest.type || comp.id;

      const transpileUI = Babel.transform(uiRaw, { filename: 'ui.tsx', presets: ['react', 'typescript', 'env'] }).code;
      const transpileLogic = Babel.transform(logicRaw, { filename: 'logic.ts', presets: ['typescript', 'env'] }).code;

      const exportsUI = {};
      const evalUI = new Function('exports', 'require', 'React', transpileUI);
      evalUI(exportsUI, (mod) => (mod === 'react' ? React : null), React);

      const uiComponent = exportsUI[Object.keys(exportsUI)[0]] || exportsUI.default;
      if (!uiComponent) {
        console.warn('[SimulatorPage] Preview: UI component could not be evaluated.');
        return;
      }

      // Inject into catalog & registry
      const newCatItem = { ...manifest };
      delete newCatItem.pins;
      delete newCatItem.group;

      let group = LOCAL_CATALOG.find(g => g.group === manifest.group);
      if (!group) {
        group = { group: manifest.group, items: [] };
        LOCAL_CATALOG.push(group);
      }
      group.items = group.items.filter(i => i.type !== compType);
      group.items.push(newCatItem);

      COMPONENT_REGISTRY[compType] = { manifest, UI: uiComponent, logicCode: transpileLogic };
      if (manifest.pins) LOCAL_PIN_DEFS[compType] = manifest.pins;

      setCustomCatalogCounter(c => c + 1);
      setPreviewBanner({ id: comp.id, label: manifest.label || comp.id });
      console.log(`[SimulatorPage] Admin preview: injected "${manifest.label}" (${compType}) into local registry.`);
    } catch (e) {
      console.error('[SimulatorPage] Failed to inject admin preview component:', e.message);
    }
  }, []);

  // ── Auto-sync Approved Backend Components (polls every 12 s, no refresh needed) ──
  // Handles both ADDITIONS (approve) and REMOVALS (delete) without any page refresh.
  useEffect(() => {
    const syncComponents = async () => {
      try {
        const installedComponents = await fetchInstalledComponentsWithFiles();

        // Build a Set of currently-installed types from the backend
        const currentInstalledTypes = new Set();
        let injectedCount = 0;
        let removedCount = 0;

        // ── ADDITIONS: inject any newly-approved components ──────────────────
        for (const comp of installedComponents) {
          const { id, files } = comp;
          if (!files) continue;

          const manifestStr = files['manifest.json'];
          const uiStr = files['ui.tsx'] || files['ui.jsx'];
          const logicStr = files['logic.ts'] || files['logic.js'];
          if (!manifestStr || !uiStr || !logicStr) continue;

          try {
            const manifest = JSON.parse(manifestStr);
            const compType = manifest.type || id;
            currentInstalledTypes.add(compType);

            // Already in registry — nothing to do this cycle
            if (COMPONENT_REGISTRY[compType]) continue;

            const transpileUI = Babel.transform(uiStr, { filename: 'ui.tsx', presets: ['react', 'typescript', 'env'] }).code;
            const transpileLogic = Babel.transform(logicStr, { filename: 'logic.ts', presets: ['typescript', 'env'] }).code;

            const exportsUI = {};
            const evalUI = new Function('exports', 'require', 'React', transpileUI);
            evalUI(exportsUI, (mod) => {
              if (mod === 'react') return React;
              return null;
            }, React);

            const uiComponent = exportsUI[Object.keys(exportsUI)[0]] || exportsUI.default;
            if (!uiComponent) continue;

            // Inject into catalog
            const newCatItem = { ...manifest };
            delete newCatItem.pins;
            delete newCatItem.group;

            let group = LOCAL_CATALOG.find(g => g.group === manifest.group);
            if (!group) {
              group = { group: manifest.group, items: [] };
              LOCAL_CATALOG.push(group);
            }
            group.items = group.items.filter(i => i.type !== compType);
            group.items.push(newCatItem);

            COMPONENT_REGISTRY[compType] = {
              manifest,
              UI: uiComponent,
              ContextMenu: exportsUI[Object.keys(exportsUI).find(k => k.toLowerCase().includes('contextmenu'))],
              contextMenuDuringRun: !!(exportsUI.contextMenuDuringRun || manifest.contextMenuDuringRun),
              contextMenuOnlyDuringRun: !!(exportsUI.contextMenuOnlyDuringRun || manifest.contextMenuOnlyDuringRun),
              logicCode: transpileLogic
            };
            if (manifest.pins) LOCAL_PIN_DEFS[compType] = manifest.pins;

            BACKEND_INJECTED_TYPES.add(compType); // track so we can detect future deletions
            injectedCount++;
          } catch (e) {
            console.warn(`[SimulatorPage] Failed to inject component "${id}":`, e.message);
          }
        }

        // ── REMOVALS: purge any backend-injected type no longer installed ────
        for (const type of BACKEND_INJECTED_TYPES) {
          if (!currentInstalledTypes.has(type)) {
            // Remove from registry
            delete COMPONENT_REGISTRY[type];
            delete LOCAL_PIN_DEFS[type];

            // Remove from catalog groups
            for (const group of LOCAL_CATALOG) {
              group.items = group.items.filter(i => i.type !== type);
            }
            // Clean up empty groups
            const idx = LOCAL_CATALOG.findIndex(g => g.items.length === 0);
            if (idx !== -1) LOCAL_CATALOG.splice(idx, 1);

            BACKEND_INJECTED_TYPES.delete(type);
            removedCount++;
            console.log(`[SimulatorPage] Removed deleted component "${type}" from panel.`);
          }
        }

        if (injectedCount > 0 || removedCount > 0) {
          setCustomCatalogCounter(c => c + 1); // triggers palette re-render
        }
      } catch (e) {
        // Silently ignore — backend may be starting up or unreachable
        console.warn('[SimulatorPage] Component sync skipped:', e.message);
      }
    };

    // Run once immediately on mount, then poll every 12 seconds
    syncComponents();
    const syncInterval = setInterval(syncComponents, 12000);
    return () => clearInterval(syncInterval); // cleanup on unmount
  }, []);

  const handleSearchLibraries = async (e) => {
    e.preventDefault();
    if (!libQuery.trim()) return;
    setIsSearchingLib(true);
    setLibMessage(null);
    try {
      const libraries = await searchLibraries(libQuery);
      setLibResults(libraries);
      if (libraries.length === 0) setLibMessage({ type: 'error', text: 'No libraries found.' });
    } catch (err) {
      setLibMessage({ type: 'error', text: 'Failed to search libraries.' });
    } finally {
      setIsSearchingLib(false);
    }
  };

  const handleInstallLibrary = async (libName) => {
    setInstallingLib(libName);
    setLibMessage(null);
    try {
      const res = await installLibrary(libName);
      setLibMessage({ type: 'success', text: res.message });
      loadLibraries();
      lastCompiledRef.current = null;
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

  // ── Close palette context menu on outside click ──────────────────────────
  useEffect(() => {
    if (!paletteContextMenu) return;
    const close = () => { setPaletteContextMenu(null); setIsPaletteHovered(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [paletteContextMenu]);

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

  // ── Static component descriptions ────────────────────────────────────────────
  const COMPONENT_DESCRIPTIONS = {
    'wokwi-led': 'Light-emitting diode. Emits light when current flows through it. Supports multiple colors.',
    'wokwi-arduino-uno': 'ATmega328P-based microcontroller board. 14 digital I/O pins, 6 analog inputs, USB connectivity.',
    'wokwi-resistor': 'Passive two-terminal component. Limits current flow. Configurable resistance value.',
    'wokwi-pushbutton': 'Momentary tactile push button. Connects circuit while pressed, opens when released.',
    'wokwi-power-supply': 'Provides stable DC power to the circuit. Configurable voltage output.',
    'wokwi-neopixel-matrix': 'Addressable RGB LED matrix. Individually controllable pixels via single data line.',
    'wokwi-buzzer': 'Piezoelectric buzzer. Generates audio tones when driven by PWM or digital signals.',
    'wokwi-motor': 'DC motor. Converts electrical energy to rotational motion. Controlled via H-bridge.',
    'wokwi-servo': 'Hobby servo motor. Precise angular position control via PWM signal (0–180°).',
    'wokwi-motor-driver': 'Dual H-bridge motor driver (L293D). Controls speed and direction of two DC motors.',
    'wokwi-slide-potentiometer': 'Linear slide potentiometer. Provides variable analog voltage via sliding knob.',
    'wokwi-potentiometer': 'Rotary potentiometer. Variable resistor providing analog voltage proportional to rotation.',
    'shift_register': '74HC595 8-bit serial-in, parallel-out shift register. Expands digital outputs.',
  };

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

  // ── Info of currently selected canvas component (for description panel) ──────
  const selectedComponentInfo = useMemo(() => {
    if (!selected) return null;
    const comp = components.find(c => c.id === selected);
    if (!comp) return null;
    for (const group of CATALOG) {
      const item = group.items.find(i => i.type === comp.type);
      if (item) return { ...item, group: group.group };
    }
    return { type: comp.type, label: comp.label || comp.type, group: 'Custom' };
  }, [selected, components]);

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

    const Y_LABEL_W = 35;

    // Separate selected pins into serial vs logic
    const logicPins = selectedPlotPins.filter(p => !isNaN(parseInt(p)) || p.startsWith('A'));
    const serialVars = selectedPlotPins.filter(p => isNaN(parseInt(p)) && !p.startsWith('A'));

    const hasSerial = serialVars.length > 0;
    const logicTrackCount = logicPins.length;
    // Serial track takes up half the height if logic pins exist, otherwise full height
    const serialHeight = hasSerial ? (logicTrackCount > 0 ? height * 0.6 : height) : 0;
    const logicAreaHeight = height - serialHeight;
    const logicTrackHeight = logicTrackCount > 0 ? logicAreaHeight / logicTrackCount : 0;

    // --- Draw Serial Track ---
    if (hasSerial) {
      const trackBaseY = serialHeight - 20;
      const trackTopY = 20;

      // Calculate global min/max for serial vars
      let sMin = Infinity, sMax = -Infinity;
      plotData.forEach(pt => {
        if (!pt.serialVars) return;
        serialVars.forEach(sv => {
          const v = pt.serialVars[sv];
          if (v !== undefined) {
            if (v < sMin) sMin = v;
            if (v > sMax) sMax = v;
          }
        });
      });
      if (sMin === Infinity) { sMin = 0; sMax = 1; }
      if (sMin === sMax) { sMin -= 1; sMax += 1; }

      // Draw grid/guides
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      // zero line
      const zeroY = trackBaseY - ((0 - sMin) / (sMax - sMin) * (trackBaseY - trackTopY));
      if (zeroY >= trackTopY && zeroY <= trackBaseY) {
        ctx.moveTo(Y_LABEL_W, zeroY); ctx.lineTo(width, zeroY);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Axis labels
      ctx.font = '9px JetBrains Mono';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.textAlign = 'right';
      ctx.fillText(sMax.toFixed(2), Y_LABEL_W - 2, trackTopY + 4);
      ctx.fillText(sMin.toFixed(2), Y_LABEL_W - 2, trackBaseY);
      ctx.textAlign = 'left';

      // Draw traces
      const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c'];
      serialVars.forEach((sv, i) => {
        const color = colors[i % colors.length];
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        const maxPts = width - Y_LABEL_W;
        const pts = plotData.slice(-maxPts);
        const xStep = maxPts / Math.max(pts.length, 1);

        let hasStarted = false;
        pts.forEach((pt, idx) => {
          const x = Y_LABEL_W + (maxPts - ((pts.length - 1 - idx) * xStep));
          const v = pt.serialVars?.[sv];
          if (v !== undefined) {
            const y = trackBaseY - ((v - sMin) / (sMax - sMin)) * (trackBaseY - trackTopY);
            if (!hasStarted) { ctx.moveTo(x, y); hasStarted = true; }
            else { ctx.lineTo(x, y); }
          }
        });
        ctx.stroke();

        // Custom Label on graph
        ctx.fillStyle = color;
        ctx.font = 'bold 10px JetBrains Mono';
        ctx.fillText(sv, Y_LABEL_W + 4 + (i * 60), trackTopY - 5);
      });

      // Separator
      if (logicTrackCount > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, serialHeight);
        ctx.lineTo(width, serialHeight);
        ctx.stroke();
      }
    }

    // --- Draw Logic Tracks ---
    logicPins.forEach((pinStr, logicIdx) => {
      const trackBaseY = serialHeight + logicTrackHeight * (logicIdx + 1) - 10;
      const trackTopY = serialHeight + logicTrackHeight * logicIdx + 10;
      const isAnalog = pinStr.startsWith('A');
      const color = isAnalog ? '#3498db' : '#2ecc71';

      // Track separator
      if (logicIdx < logicPins.length - 1) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, serialHeight + logicTrackHeight * (logicIdx + 1));
        ctx.lineTo(width, serialHeight + logicTrackHeight * (logicIdx + 1));
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
  const componentsMap = useMemo(() => {
    const m = new Map();
    for (const c of components) m.set(c.id, c);
    return m;
  }, [components]);

  const getPinPos = useCallback((compId, pinId) => {
    const comp = componentsMap.get(compId)
    if (!comp) return null
    const pins = PIN_DEFS[comp.type] || []
    const pin = pins.find(p => p.id === pinId)
    if (!pin) return null
    const rotation = comp.rotation || 0;
    if (rotation === 0) return { x: comp.x + pin.x, y: comp.y + pin.y }
    // Rotate pin coordinate around component center
    const cx = comp.w / 2, cy = comp.h / 2;
    const rad = rotation * Math.PI / 180;
    const dx = pin.x - cx, dy = pin.y - cy;
    return {
      x: comp.x + cx + dx * Math.cos(rad) - dy * Math.sin(rad),
      y: comp.y + cy + dx * Math.sin(rad) + dy * Math.cos(rad)
    }
  }, [componentsMap, PIN_DEFS])

  // ── Get the point a wire should exit/enter at 90° from a pin ───────────────
  const getPinExitPoint = useCallback((compId, pinId) => {
    const comp = componentsMap.get(compId)
    if (!comp) return null
    const pins = PIN_DEFS[comp.type] || []
    const pin = pins.find(p => p.id === pinId)
    if (!pin) return null
    const stub = 20;
    // Determine dominant exit direction from unrotated pin position relative to component center
    const cx = comp.w / 2, cy = comp.h / 2;
    const dx = pin.x - cx, dy = pin.y - cy;
    let exitDx = 0, exitDy = 0;
    if (Math.abs(dx) >= Math.abs(dy)) {
      exitDx = dx >= 0 ? stub : -stub;
    } else {
      exitDy = dy >= 0 ? stub : -stub;
    }
    // Rotate exit direction with the component
    const rotation = comp.rotation || 0;
    if (rotation !== 0) {
      const rad = rotation * Math.PI / 180;
      const rdx = exitDx * Math.cos(rad) - exitDy * Math.sin(rad);
      const rdy = exitDx * Math.sin(rad) + exitDy * Math.cos(rad);
      exitDx = rdx; exitDy = rdy;
    }
    const pinPos = getPinPos(compId, pinId);
    if (!pinPos) return null;
    return { x: pinPos.x + exitDx, y: pinPos.y + exitDy };
  }, [componentsMap, PIN_DEFS, getPinPos])

  // Keep reactive refs current so async effects always use latest values
  getPinPosRef.current = getPinPos;
  componentsRef.current = components;
  pinDefsRef.current = PIN_DEFS;

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

  // ── Favorites helpers ────────────────────────────────────────────────────────
  const toggleFavorite = useCallback((type) => {
    setFavoriteComponents(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      try { localStorage.setItem('openhw_fav_components', JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  // ── History & Undo/Redo ────────────────────────────────────────────────────
  const saveHistory = useCallback(() => {
    setHistory(h => ({
      past: [...h.past.slice(-20), { components: structuredClone(components), wires: structuredClone(wires) }],
      future: []
    }))
  }, [components, wires])

  const undo = () => {
    if (history.past.length === 0 || isRunning) return
    const prev = history.past[history.past.length - 1]
    setHistory(h => ({ past: h.past.slice(0, -1), future: [{ components: structuredClone(components), wires: structuredClone(wires) }, ...h.future] }))
    setComponents(prev.components)
    setWires(prev.wires)
    setSelected(null)
  }

  const redo = () => {
    if (history.future.length === 0 || isRunning) return
    const next = history.future[0]
    setHistory(h => ({ past: [...h.past, { components: structuredClone(components), wires: structuredClone(wires) }], future: h.future.slice(1) }))
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
    const x = (e.clientX - rect.left - canvasOffsetRef.current.x) / canvasZoomRef.current - (item.w || 60) / 2
    const y = (e.clientY - rect.top - canvasOffsetRef.current.y) / canvasZoomRef.current - (item.h || 60) / 2
    setComponents(prev => [...prev, {
      id: `${item.type}_${nextId++}`,
      type: item.type, label: item.label,
      x: Math.max(8, x), y: Math.max(8, y),
      w: item.w || 60, h: item.h || 60,
      attrs: item.attrs || {},
    }])
    dragPayload.current = null
  }, [saveHistory])

  // ── Quick-add: place component at explicit canvas coordinates ──────────────
  const addComponentAt = useCallback((item, canvasX, canvasY) => {
    saveHistory()
    const x = canvasX - (item.w || 60) / 2
    const y = canvasY - (item.h || 60) / 2
    setComponents(prev => [...prev, {
      id: `${item.type}_${nextId++}`,
      type: item.type, label: item.label,
      x: Math.max(8, x), y: Math.max(8, y),
      w: item.w || 60, h: item.h || 60,
      attrs: item.attrs || {},
    }])
  }, [saveHistory])

  // ── Palette click to add (adds to canvas center) ────────────────────────────
  const addComponentAtCenter = useCallback((item) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = (rect.width / 2 - canvasOffsetRef.current.x) / canvasZoomRef.current;
    const cy = (rect.height / 2 - canvasOffsetRef.current.y) / canvasZoomRef.current;
    addComponentAt(item, cx, cy);
    setSelectedPaletteItem(item);
  }, [addComponentAt]);

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
    setWireClickPos(null)
  }, [])

  useEffect(() => {
    const onMove = (e) => {
      if (movingComp.current) {
        movingComp.current.moved = true
        const { id, sx, sy, cx, cy } = movingComp.current
        setComponents(prev => prev.map(c =>
          c.id === id ? { ...c, x: cx + (e.clientX - sx) / canvasZoomRef.current, y: cy + (e.clientY - sy) / canvasZoomRef.current } : c
        ))
      }
      // Segment handle drag
      const sd = segDragRef.current;
      if (sd && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const mx = (e.clientX - rect.left - canvasOffsetRef.current.x) / canvasZoomRef.current;
        const my = (e.clientY - rect.top - canvasOffsetRef.current.y) / canvasZoomRef.current;
        const ddx = mx - sd.startMouseCanvas.x;
        const ddy = my - sd.startMouseCanvas.y;
        if (Math.abs(ddx) < 1 && Math.abs(ddy) < 1) return; // ignore tiny jitter
        sd.hasMoved = true;
        const newPts = sd.startPts.map(pt => ({ ...pt }));
        const { segIdx, isHoriz } = sd;
        if (isHoriz) {
          newPts[segIdx] = { ...newPts[segIdx], y: newPts[segIdx].y + ddy };
          newPts[segIdx + 1] = { ...newPts[segIdx + 1], y: newPts[segIdx + 1].y + ddy };
        } else {
          newPts[segIdx] = { ...newPts[segIdx], x: newPts[segIdx].x + ddx };
          newPts[segIdx + 1] = { ...newPts[segIdx + 1], x: newPts[segIdx + 1].x + ddx };
        }
        // Store internal corners (skip p1 and p2) as explicit corner waypoints
        const cornerWaypoints = newPts.slice(1, -1).map(pt => ({ x: pt.x, y: pt.y, _corner: true }));
        setWires(prev => prev.map(w => w.id === sd.wireId ? { ...w, waypoints: cornerWaypoints } : w));
        return; // don't pan while segment-dragging
      }
      // Canvas panning
      if (isPanningRef.current && !isCanvasLockedRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        if (!didPanRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
          didPanRef.current = true;
        }
        if (didPanRef.current) {
          const newOffset = { x: panStartRef.current.ox + dx, y: panStartRef.current.oy + dy };
          setCanvasOffset(newOffset);
          canvasOffsetRef.current = newOffset;
        }
      }
      // Track mouse for wire preview (with pin snapping)
      if (wireStart && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        const rawX = (e.clientX - rect.left - canvasOffsetRef.current.x) / canvasZoomRef.current;
        const rawY = (e.clientY - rect.top - canvasOffsetRef.current.y) / canvasZoomRef.current;
        const snapRadius = 15;
        let snapped = null;
        const allComps = componentsRef.current;
        const pinDefs = pinDefsRef.current;
        const getPos = getPinPosRef.current;
        if (getPos) {
          for (let ci = 0; ci < allComps.length && !snapped; ci++) {
            const c = allComps[ci];
            if (c.id === wireStart.compId) continue;
            const pins = pinDefs[c.type] || [];
            for (let pi = 0; pi < pins.length && !snapped; pi++) {
              const pp = getPos(c.id, pins[pi].id);
              if (pp && Math.hypot(pp.x - rawX, pp.y - rawY) < snapRadius) snapped = pp;
            }
          }
        }
        setMousePos(snapped || { x: rawX, y: rawY });
      }
    }
    const onUp = () => {
      if (movingComp.current?.moved) {
        const origComps = movingComp.current.originalComps;
        const movedId = movingComp.current.id;
        setHistory(h => ({ past: [...h.past.slice(-20), { components: origComps, wires: JSON.parse(JSON.stringify(wires)) }], future: [] }));
        // Clear _corner waypoints on wires connected to the moved component so
        // they re-route cleanly from the new pin positions.
        setWires(prev => prev.map(w => {
          if (w.from.startsWith(movedId + ':') || w.to.startsWith(movedId + ':')) {
            if (w.waypoints?.length && w.waypoints[0]._corner) return { ...w, waypoints: [] };
          }
          return w;
        }));
      }
      movingComp.current = null;
      isPanningRef.current = false;
      if (segDragRef.current) {
        if (segDragRef.current.hasMoved) {
          // Save undo snapshot using pre-drag wires captured at drag start
          const pre = segDragRef.current.preWires;
          setHistory(h => ({ past: [...h.past.slice(-20), { components: JSON.parse(JSON.stringify(componentsRef.current)), wires: JSON.parse(JSON.stringify(pre)) }], future: [] }));
          // Prevent the subsequent click event from deselecting the wire
          didPanRef.current = true;
        }
        segDragRef.current = null;
        setSegDrag(null);
      }
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

      if (e.key === 'Escape') { setWireStart(null); setSelected(null); setWireClickPos(null); }
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

  const rotateComponent = (id) => {
    if (isRunning) return;
    saveHistory();
    setComponents(prev => prev.map(c => c.id === id ? { ...c, rotation: ((c.rotation || 0) + 90) % 360 } : c));
  };

  // ─── Project Save / Load Handlers ───────────────────────────────────────────

  /** Open the save dialog. Pre-fills with the current project name. */
  const handleSave = () => {
    setSaveDialogName(currentProjectName || 'Untitled');
    setShowSaveDialog(true);
  };

  /** Commit the save from the dialog. */
  const handleConfirmSave = async () => {
    const name = saveDialogName.trim() || 'Untitled';
    const owner = getOwner();
    let id = currentProjectIdRef.current;
    if (!id) {
      id = generateProjectId();
      currentProjectIdRef.current = id;
      setCurrentProjectId(id);
    }
    setCurrentProjectName(name);
    clearTimeout(autoSaveTimerRef.current);
    await saveProject({ id, name, board, components, connections: wires, code, owner });
    setShowSaveDialog(false);
  };

  /** Create a brand-new blank project. */
  const handleNewProject = () => {
    if (components.length > 0 || wires.length > 0) {
      if (!window.confirm('Start a new project? Unsaved changes will be auto-saved first.')) return;
    }
    const id = generateProjectId();
    currentProjectIdRef.current = id;
    setCurrentProjectId(id);
    setCurrentProjectName('Untitled');
    setBoard('arduino_uno');
    setCode('void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}\n');
    setComponents([]);
    setWires([]);
    setHistory({ past: [], future: [] });
    lastCompiledRef.current = null;
  };

  /** Load a project from the My Projects modal. */
  const handleLoadProject = (proj) => {
    if (isRunning) return;
    setBoard(proj.board || 'arduino_uno');
    setCode(proj.code || '');
    setComponents(proj.components || []);
    setWires(proj.connections || []);
    setCurrentProjectId(proj.id);
    currentProjectIdRef.current = proj.id;
    setCurrentProjectName(proj.name || 'Untitled');
    setHistory({ past: [], future: [] });
    lastCompiledRef.current = null;
    setShowProjectsDropdown(false);
  };

  /** Delete a project from the My Projects modal. */
  const handleDeleteProject = async (id) => {
    if (!window.confirm('Delete this project? This cannot be undone.')) return;
    await deleteProject(id);
    // If the active project was deleted, clear current id
    if (currentProjectIdRef.current === id) {
      currentProjectIdRef.current = null;
      setCurrentProjectId(null);
      setCurrentProjectName('Untitled');
    }
    await refreshProjectList();
  };

  // ─── Inline Rename ─────────────────────────────────────────────────────────
  const handleStartRename = (proj, e) => {
    e.stopPropagation();
    setRenamingProjectId(proj.id);
    setRenameValue(proj.name || 'Untitled');
  };
  const handleConfirmRename = async (id) => {
    const newName = renameValue.trim() || 'Untitled';
    await renameProject(id, newName);
    if (currentProjectIdRef.current === id) setCurrentProjectName(newName);
    setRenamingProjectId(null);
    await refreshProjectList();
  };

  // ─── Backup / Restore ──────────────────────────────────────────────────────
  const handleBackupWorkflow = async () => {
    const zip = new JSZip();
    const data = { name: currentProjectName, board, components, connections: wires, code, exportedAt: new Date().toISOString() };
    zip.file('workflow.json', JSON.stringify(data, null, 2));
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProjectName || 'workflow'}-backup.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const handleRestoreWorkflow = async (file) => {
    if (!file) return;
    try {
      const zip = await JSZip.loadAsync(file);
      const wf = zip.file('workflow.json');
      if (!wf) { alert('Invalid backup: workflow.json not found.'); return; }
      const json = JSON.parse(await wf.async('string'));
      if ((components.length > 0 || wires.length > 0) && !window.confirm('Restore backup? Current unsaved changes will be replaced.')) return;
      setBoard(json.board || 'arduino_uno');
      setCode(json.code || '');
      setComponents(json.components || []);
      setWires(json.connections || []);
      setCurrentProjectName(json.name || 'Untitled');
      setHistory({ past: [], future: [] });
      lastCompiledRef.current = null;
    } catch (e) { alert('Failed to restore backup: ' + e.message); }
  };

  // ─── Cloud Sync (placeholder) ───────────────────────────────────────────────
  const handleSyncToCloud = () => { alert('Sync feature coming soon!'); };

  const handleAssessmentSubmit = async () => {
    if (!assessmentMode) return;
    if (!assessmentProjectName) {
      alert('Assessment project is missing. Please open assessment from the project page.');
      return;
    }
    setIsSubmittingAssessment(true);
    try {
      const payload = {
        projectName: assessmentProjectName,
        submittedAt: new Date().toISOString(),
        components,
        wires,
        code,
      };
      sessionStorage.setItem(`openhw_assessment_submission:${assessmentProjectName}`, JSON.stringify(payload));
      navigate(`/${assessmentProjectName}/assessment`);
    } finally {
      setIsSubmittingAssessment(false);
    }
  };
  // ─── Simulator Run & Stop Logic ─────────────────────────────────────────────
  const logSerial = (msg, color = 'var(--text)') => {
    // In a real implementation this would push to a serial console state array
    console.log(`[SIM]`, msg);
  };

  const handleRun = async () => {
    try {
      setIsRunning(true);
      setIsCompiling(true);

      let result;
      if (lastCompiledRef.current && lastCompiledRef.current.code === code && lastCompiledRef.current.board === board) {
        // Fast path: in-memory hit from this session
        logSerial('Using cached compilation...');
        result = lastCompiledRef.current.result;
      } else {
        // Persistent path: check IndexedDB (survives page refresh + offline)
        const cached = await getCachedHex(code, board);
        if (cached) {
          logSerial('Using locally cached compilation (offline cache)...');
          result = cached;
          lastCompiledRef.current = { code, board, result };
        } else {
          logSerial('Compiling...');
          result = await compileCode(code);
          lastCompiledRef.current = { code, board, result };
          // Persist for future offline use
          setCachedHex(code, board, result);
        }
      }

      setIsCompiling(false);
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
            const serialVars = {};
            latestParsedSerialRef.current.forEach((val, idx) => {
              const lbl = serialPlotLabelsRef.current[idx] || `SVar${idx}`;
              serialVars[lbl] = val;
            });
            const newPt = { time: Date.now(), pins: msg.pins, analog: msg.analog || [], serialVars };
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
          // --- BEGIN SERIAL PLOTTER PARSER ---
          serialPlotBufferRef.current += msg.data;
          const lines = serialPlotBufferRef.current.split('\n');
          if (lines.length > 1) {
            const completeLines = lines.slice(0, -1);
            serialPlotBufferRef.current = lines[lines.length - 1];

            completeLines.forEach(line => {
              const parts = line.split(/[,\s\t]+/).filter(Boolean);
              if (parts.length > 0) {
                const isNumeric = parts.every(p => !isNaN(parseFloat(p)));
                if (!isNumeric) {
                  serialPlotLabelsRef.current = parts;
                  setSelectedPlotPins(prev => {
                    const newPins = [...prev];
                    parts.forEach(l => { if (!newPins.includes(l)) newPins.push(l); });
                    return newPins;
                  });
                } else {
                  latestParsedSerialRef.current = parts.map(p => parseFloat(p));
                  if (serialPlotLabelsRef.current.length < parts.length) {
                    for (let i = serialPlotLabelsRef.current.length; i < parts.length; i++) {
                      serialPlotLabelsRef.current.push(`SVar${i}`);
                    }
                  }
                  setSelectedPlotPins(prev => {
                    let changed = false;
                    const newPins = [...prev];
                    serialPlotLabelsRef.current.slice(0, parts.length).forEach(lbl => {
                      if (!newPins.includes(lbl)) { newPins.push(lbl); changed = true; }
                    });
                    return changed ? newPins : prev;
                  });
                }
              }
            });
          }
          // --- END SERIAL PLOTTER PARSER ---

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

      const customLogics = [];
      components.forEach((c) => {
        if (COMPONENT_REGISTRY[c.type]?.logicCode) {
          customLogics.push({
            type: c.type,
            code: COMPONENT_REGISTRY[c.type].logicCode,
            pins: COMPONENT_REGISTRY[c.type].manifest.pins
          });
        }
      });

      worker.postMessage({
        type: 'START',
        hex: result.hex,
        neopixels: neopixelWiring,
        wires: wires,
        components: components,
        customLogics: customLogics
      });
    } catch (err) {
      setIsRunning(false);
      setIsCompiling(false);
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
    setIsCompiling(false);
    setIsPaused(false);
    setPinStates({});
    setNeopixelData({});
    setOopStates({});
    setSerialHistory([]);
    setPlotData([]);
    setSerialPaused(false);
    setPlotterPaused(false);
    serialPlotBufferRef.current = '';
    serialPlotLabelsRef.current = [];
    latestParsedSerialRef.current = [];
  };

  const handlePause = () => {
    if (workerRef.current) workerRef.current.postMessage({ type: 'PAUSE' });
    setIsPaused(true);
  };

  const handleResume = () => {
    if (workerRef.current) workerRef.current.postMessage({ type: 'RESUME' });
    setIsPaused(false);
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
    <div style={S.page} ref={pageRef} className="min-h-screen">

      {/* ADMIN PREVIEW BANNER — shown when opened via "Test in Simulator" from admin dashboard */}
      {previewBanner && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: 'linear-gradient(90deg, #92400e, #b45309)',
          color: '#fff', padding: '10px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'monospace', fontSize: 13, boxShadow: '0 2px 12px rgba(0,0,0,0.4)'
        }}>
          <span>
            🧪 <strong>Admin Preview Mode</strong> &nbsp;—&nbsp;
            Component <strong style={{ color: '#fde68a' }}>{previewBanner.label}</strong>
            &nbsp;(<code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 3 }}>{previewBanner.id}</code>)
            &nbsp;is injected in <strong>browser memory only</strong>. It is NOT approved or installed on the backend.
          </span>
          <button
            onClick={() => setPreviewBanner(null)}
            style={{ background: 'rgba(0,0,0,0.3)', border: 'none', color: '#fff', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 13 }}
          >✕ Dismiss</button>
        </div>
      )}

      {/* TOP BAR */}
      <header style={S.bar}>
        <button style={S.logo} onClick={() => navigate('/')}> OpenHW-Studio</button>
        <div style={S.barCenter}>
          <select style={S.sel} value={board} onChange={e => setBoard(e.target.value)}>
            <option value="arduino_uno">Arduino Uno</option>
            <option value="pico">Raspberry Pi Pico</option>
            <option value="esp32">ESP32</option>
          </select>
          {/* RUN button */}
          <Btn
            color={isRunning ? (isPaused ? 'var(--orange)' : 'var(--green)') : 'var(--green)'}
            disabled={isRunning}
            onClick={!isRunning ? handleRun : undefined}
            title={isRunning ? (isCompiling ? 'Compiling…' : isPaused ? 'Paused' : 'Running') : 'Run'}
          >
            {isRunning ? (
              isCompiling ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'toolbar-spin 0.9s linear infinite', flexShrink: 0 }}>
                    <path d="M21 12a9 9 0 1 1-4.5-7.8"/>
                  </svg>
                  Compiling…
                </>
              ) : isPaused ? 'Paused' : 'Running…'
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ flexShrink: 0 }}><polygon points="2,1 11,6 2,11"/></svg>
                Run
              </>
            )}
          </Btn>

          {/* STOP button — SVG icon only */}
          <Btn color={isRunning ? 'var(--red)' : undefined} disabled={!isRunning} onClick={isRunning ? handleStop : undefined} title="Stop" iconOnly>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><rect width="13" height="13" rx="2"/></svg>
          </Btn>

          {/* PAUSE / RESUME button — visible only when running and not still compiling */}
          {isRunning && !isCompiling && (
            <Btn
              color={isPaused ? 'var(--green)' : 'var(--orange)'}
              onClick={isPaused ? handleResume : handlePause}
              title={isPaused ? 'Resume' : 'Pause'}
              iconOnly
            >
              {isPaused ? (
                <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><polygon points="2,1 12,6.5 2,12"/></svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><rect x="1.5" y="1" width="3.5" height="11" rx="1"/><rect x="8" y="1" width="3.5" height="11" rx="1"/></svg>
              )}
            </Btn>
          )}

          {assessmentMode && (
            <Btn
              color="var(--accent)"
              disabled={isSubmittingAssessment || !assessmentProjectName}
              onClick={!isSubmittingAssessment ? handleAssessmentSubmit : undefined}
              title={!assessmentProjectName ? 'Assessment project is missing' : 'Submit assessment'}
            >
              {isSubmittingAssessment ? 'Submitting...' : 'Submit Assessment'}
            </Btn>
          )}

          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />

          {/* UNDO — SVG icon only */}
          <Btn onClick={undo} disabled={history.past.length === 0 || isRunning} title="Undo" iconOnly>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7v6h6"/><path d="M3 13A9 9 0 1 0 5.9 5.3"/>
            </svg>
          </Btn>

          {/* REDO — SVG icon only */}
          <Btn onClick={redo} disabled={history.future.length === 0 || isRunning} title="Redo" iconOnly>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 7v6h-6"/><path d="M21 13A9 9 0 1 1 18.1 5.3"/>
            </svg>
          </Btn>

          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />

          {/* DELETE — SVG icon only */}
          <Btn color={selected ? 'var(--red)' : undefined} disabled={!selected || isRunning} onClick={() => {
            if (!selected || isRunning) return;
            saveHistory();
            if (selected.match(/^w\d+$/)) {
              setWires(prev => prev.filter(w => w.id !== selected));
            } else {
              setComponents(prev => prev.filter(c => c.id !== selected))
              setWires(prev => prev.filter(w => !w.from.startsWith(selected + ':') && !w.to.startsWith(selected + ':')))
            }
            setSelected(null)
          }} title="Delete selected" iconOnly>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </Btn>

          {/* ROTATE — SVG icon only, visible when a component is selected */}
          {selected && components.find(c => c.id === selected) && (
            <Btn onClick={() => rotateComponent(selected)} disabled={isRunning} title="Rotate 90°" iconOnly>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </Btn>
          )}

          {/* THEME TOGGLE — SVG icon only */}
          <Btn onClick={toggleTheme} title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'} iconOnly>
            {theme === 'dark' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </Btn>
        </div>

        {/* RIGHT SIDE — right to left: Sign In/User, My Projects, Save, Export, Import */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Hidden file inputs */}
          <input ref={importFileRef} type="file" accept=".png,image/png" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) importPng(e.target.files[0]); }} />
          <input ref={backupRestoreInputRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) { handleRestoreWorkflow(e.target.files[0]); e.target.value = ''; } }} />

          {/* Import PNG */}
          <Btn color="var(--orange)" onClick={() => importFileRef.current?.click()} title="Import a previously exported OpenHW-Studio PNG to restore the circuit"> Import PNG</Btn>
          {/* Export PNG */}
          <Btn color="var(--purple)" onClick={downloadPng} disabled={isExporting} title="Download circuit as PNG with embedded metadata">
            {isExporting ? ' Exporting...' : ' Export PNG'}
          </Btn>
          {/* Save */}
          <Btn color="var(--accent)" onClick={handleSave} title="Save current project"> Save</Btn>

          {/* My Projects — dropdown anchor */}
          <div ref={projectsDropdownRef} style={{ position: 'relative' }}>
            <Btn
              onClick={() => { refreshProjectList(); setShowProjectsDropdown(v => !v); }}
              title="View and manage your saved projects"
            > My Projects</Btn>
            {/* Dropdown panel */}
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 340,
              background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,.45)', zIndex: 9999,
              overflow: 'hidden',
              maxHeight: showProjectsDropdown ? 560 : 0,
              opacity: showProjectsDropdown ? 1 : 0,
              transition: 'max-height 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',
              pointerEvents: showProjectsDropdown ? 'auto' : 'none',
            }}>
              {/* Panel header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>My Projects</span>
                <Btn color="var(--accent)" onClick={() => { setShowProjectsDropdown(false); handleNewProject(); }}>+ New</Btn>
              </div>
              {/* Project list */}
              <div style={{ overflowY: 'auto', maxHeight: 340, padding: '8px' }}>
                {myProjects.length === 0 ? (
                  <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '28px 0' }}>
                    No saved projects yet.<br />Your circuits are auto-saved as you work.
                  </div>
                ) : myProjects.map(proj => (
                  <div key={proj.id} style={{
                    background: proj.id === currentProjectId ? 'rgba(100,180,255,.1)' : 'var(--card)',
                    border: `1px solid ${proj.id === currentProjectId ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 8, padding: '9px 12px', marginBottom: 6,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {renamingProjectId === proj.id ? (
                        <input
                          autoFocus
                          style={{ ...S.paletteSearch, marginBottom: 0, fontSize: 13, padding: '4px 8px', width: '100%' }}
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleConfirmRename(proj.id); if (e.key === 'Escape') setRenamingProjectId(null); }}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {proj.name || 'Untitled'}
                          </span>
                          {proj.id === currentProjectId && <span style={{ fontSize: 10, color: 'var(--accent)', flexShrink: 0 }}>● current</span>}
                          {/* Rename icon */}
                          <button
                            onClick={e => handleStartRename(proj, e)}
                            title="Rename project"
                            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: '2px 4px', fontSize: 12, borderRadius: 4, flexShrink: 0, lineHeight: 1 }}
                          >✎</button>
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                        {proj.board || 'arduino_uno'} · {proj.components?.length ?? 0} components · {formatProjectDate(proj.savedAt)}
                      </div>
                    </div>
                    {renamingProjectId === proj.id ? (
                      <>
                        <Btn color="var(--accent)" onClick={() => handleConfirmRename(proj.id)}>✓</Btn>
                        <Btn onClick={() => setRenamingProjectId(null)}>✕</Btn>
                      </>
                    ) : (
                      <>
                        <Btn onClick={() => { handleLoadProject(proj); setShowProjectsDropdown(false); }} disabled={isRunning}>Load</Btn>
                        <Btn color="var(--red)" onClick={() => handleDeleteProject(proj.id)}>Del</Btn>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {/* Panel footer — Backup / Restore / Sync */}
              <div style={{ borderTop: '1px solid var(--border)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Btn onClick={handleBackupWorkflow} title="Download current workflow as a backup ZIP">↓ Backup</Btn>
                <Btn onClick={() => backupRestoreInputRef.current?.click()} title="Restore workflow from a backup ZIP">↑ Restore</Btn>
                {isAuthenticated && (
                  <Btn color="var(--accent)" onClick={handleSyncToCloud} title="Sync local projects with cloud"> Sync</Btn>
                )}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
                  {!isAuthenticated ? 'Sign in to sync' : `Signed in as ${user?.name?.split(' ')[0]}`}
                </span>
              </div>
            </div>
          </div>

          {/* Sign In or Username (clickable → role dashboard) */}
          {isAuthenticated
            ? <button
                style={{ ...S.userChip, cursor: 'pointer', background: 'var(--card)', border: '1px solid var(--border)' }}
                title={`Go to dashboard (${user?.role || 'user'})`}
                onClick={() => navigate(user?.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard')}
              >
                {user?.name?.split(' ')[0] || 'User'}
              </button>
            : <Btn color="var(--accent)" onClick={() => navigate('/login')} title="Sign in to access projects from any device"> Sign In</Btn>
          }
        </div>
      </header>

      {/* GUEST BANNER */}
      {(!isAuthenticated && showGuestBanner) && (
        <div style={S.guestBanner}>
          <div style={{ flex: 1 }}>
             <strong>Guest Mode</strong> — Your work is auto-saved locally in your browser. Click <strong>My Projects</strong> to see all saved circuits. Sign in to access your projects from any device.
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

        {/* PALETTE — hover to expand (280px), collapse to 38px */}
        <aside
          style={{
            ...S.palette,
            width: isPaletteHovered ? 410 : 38,
            overflow: 'hidden',
            transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            padding: 0,
          }}
          onMouseEnter={() => setIsPaletteHovered(true)}
          onMouseLeave={() => { if (!paletteContextMenu) setIsPaletteHovered(false); }}
        >
          {/* Collapsed indicator — visible only when closed */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
            opacity: isPaletteHovered ? 0 : 1, transition: 'opacity 0.15s', pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', writingMode: 'vertical-rl', letterSpacing: '0.1em' }}>Components</span>
          </div>

          {/* Full palette content — fades in when expanded */}
          <div style={{
            width: 410, opacity: isPaletteHovered ? 1 : 0, transition: 'opacity 0.2s',
            pointerEvents: isPaletteHovered ? 'auto' : 'none',
            display: 'flex', flexDirection: 'column', height: '100%',
          }}>
            {/* Sticky top section */}
            <div style={{ flexShrink: 0, padding: '10px 8px 0', background: 'var(--bg2)' }}>
              <div style={S.paletteHeader}>Components</div>

              {/* Search + View Toggle */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 8, alignItems: 'center' }}>
                <input
                  style={{ ...S.paletteSearch, flex: 1, marginBottom: 0 }}
                  placeholder="Search..."
                  value={paletteSearch}
                  onChange={(e) => setPaletteSearch(e.target.value)}
                />
                <button
                  onClick={() => setPaletteViewMode(m => m === 'list' ? 'grid' : 'list')}
                  style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}
                  title={paletteViewMode === 'list' ? 'Switch to Grid View' : 'Switch to List View'}
                >
                  {paletteViewMode === 'list' ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor"/><rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor"/><rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor"/><rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="2" rx="1" fill="currentColor"/><rect x="1" y="7" width="14" height="2" rx="1" fill="currentColor"/><rect x="1" y="12" width="14" height="2" rx="1" fill="currentColor"/></svg>
                  )}
                </button>
              </div>

              {/* Upload ZIP + Create Component */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                <input type="file" ref={componentZipInputRef} onChange={handleUploadZip} accept=".zip" style={{ display: 'none' }} />
                <button
                  onClick={() => componentZipInputRef.current.click()}
                  style={{ flex: 1, padding: '7px 4px', borderRadius: 6, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3-4 3 4M1 9v1a1 1 0 001 1h8a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  Upload ZIP
                </button>
                <button
                  onClick={() => setShowCreateComponentModal(true)}
                  style={{ flex: 1, padding: '7px 4px', borderRadius: 6, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontWeight: 600 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  Create
                </button>
              </div>

              {/* Favourites section */}
              <div style={{ marginBottom: 6, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', overflow: 'hidden' }}>
                <button
                  onClick={() => setShowFavorites(f => !f)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'var(--bg3)', border: 'none', borderBottom: showFavorites ? '1px solid var(--border)' : 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1l1.5 3H11l-2.5 1.8.9 3L6 7.2 3.6 9.8l.9-3L2 5h3.5z" fill="#f59e0b" stroke="#f59e0b" strokeWidth="0.5"/></svg>
                    Favourites {favoriteComponents.size > 0 ? `(${favoriteComponents.size})` : ''}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    {showFavorites
                      ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 7l3-4 3 4" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      : <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3l3 4 3-4" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    }
                  </span>
                </button>
                {showFavorites && (
                  <div style={{ padding: '6px 8px 8px' }}>
                    {favoriteComponents.size === 0 ? (
                      <div style={{ padding: '6px 2px', fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>Right-click a component to favourite</div>
                    ) : (
                      (() => {
                        const favItems = [];
                        CATALOG.forEach(g => g.items.forEach(item => { if (favoriteComponents.has(item.type)) favItems.push({ ...item, group: g.group }); }));
                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, padding: '2px 0' }}>
                            {favItems.map(item => {
                              const gColor = GROUP_COLORS[item.group] || 'var(--accent)';
                              return (
                                <div
                                  key={`fav-${item.type}`}
                                  draggable
                                  onDragStart={e => onPaletteDragStart(e, item)}
                                  onClick={() => { addComponentAtCenter(item); setSelectedPaletteItem(item); }}
                                  onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setPaletteContextMenu({ x: e.clientX, y: e.clientY, item }); }}
                                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '6px 4px', borderRadius: 7, border: `1px solid ${gColor}44`, background: 'var(--bg)', cursor: 'pointer', userSelect: 'none', transition: 'all .15s', minHeight: 38, boxSizing: 'border-box' }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = gColor; e.currentTarget.style.background = `${gColor}14`; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = `${gColor}44`; e.currentTarget.style.background = 'var(--bg)'; }}
                                >
                                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', textAlign: 'center', lineHeight: 1.2, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 2, paddingRight: 2 }}>{item.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Scrollable component list */}
            <div className="palette-scroll" style={{
              flex: 1, overflowY: 'auto',
              display: paletteViewMode === 'grid' ? 'block' : 'flex',
              flexDirection: 'column', gap: paletteViewMode === 'list' ? 2 : 0,
              padding: '4px 8px 8px',
            }}>
              {CATALOG.map((group, index) => {
                const filteredItems = group.items.filter(item =>
                  item.label.toLowerCase().includes(paletteSearch.toLowerCase()) ||
                  item.type.toLowerCase().includes(paletteSearch.toLowerCase())
                );
                if (filteredItems.length === 0) return null;
                const groupColor = GROUP_COLORS[group.group] || 'var(--accent)';
                return (
                  <div key={group.group || `group-${index}`} style={{ marginBottom: paletteViewMode === 'grid' ? 10 : 4 }}>
                    <div style={{ ...S.groupName, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        {GROUP_ICON_SVG[group.group]?.(groupColor) || <span style={{ width: 6, height: 6, borderRadius: '50%', background: groupColor, display: 'inline-block' }} />}
                      </span>
                      {group.group}
                    </div>

                    {paletteViewMode === 'grid' ? (
                      /* GRID VIEW */
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: '4px 0' }}>
                        {filteredItems.map(item => {
                          const compW = item.w || 60;
                          const compH = item.h || 60;
                          /* 84×66 target visible area with breathing room */
                          const previewW = 84, previewH = 66;
                          const rawScale = Math.min(previewW / compW, previewH / compH);
                          const scale = Math.max(0.22, Math.min(1.6, rawScale));
                          const hasUI = !!COMPONENT_REGISTRY[item.type]?.UI;
                          return (
                            <div
                              key={item.type}
                              draggable
                              onDragStart={e => onPaletteDragStart(e, item)}
                              onClick={() => { addComponentAtCenter(item); setSelectedPaletteItem({ ...item, group: group.group }); }}
                              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setPaletteContextMenu({ x: e.clientX, y: e.clientY, item: { ...item, group: group.group } }); }}
                              title={item.label}
                              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '0 4px 7px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', userSelect: 'none', transition: 'all .15s', height: 104, boxSizing: 'border-box', minWidth: 0, overflow: 'hidden', position: 'relative' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = groupColor; e.currentTarget.style.background = `${groupColor}14`; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card)'; }}
                            >
                              {/* Component SVG — absolutely centred in upper area, no inner box */}
                              {hasUI ? (
                                <div style={{ position: 'absolute', top: 'calc(50% - 7px)', left: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center center', pointerEvents: 'none', lineHeight: 0 }}>
                                  {React.createElement(COMPONENT_REGISTRY[item.type].UI, { state: {}, attrs: {}, isRunning: false })}
                                </div>
                              ) : (
                                <div style={{ position: 'absolute', top: 'calc(50% - 7px)', left: '50%', transform: 'translate(-50%, -50%)' }}>
                                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={groupColor} strokeWidth="1.2" opacity="0.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                                </div>
                              )}
                              {/* Label — pinned to bottom, single line */}
                              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', textAlign: 'center', lineHeight: 1.2, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 2, paddingRight: 2, position: 'relative', zIndex: 1 }}>{item.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* LIST VIEW */
                      filteredItems.map(item => (
                        <div
                          key={item.type}
                          draggable
                          onDragStart={e => onPaletteDragStart(e, item)}
                          onClick={() => { addComponentAtCenter(item); setSelectedPaletteItem({ ...item, group: group.group }); }}
                          onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setPaletteContextMenu({ x: e.clientX, y: e.clientY, item: { ...item, group: group.group } }); }}
                          style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', userSelect: 'none', marginBottom: 4, borderLeft: `3px solid ${groupColor}`, transition: 'all .15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg3)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--card)'; }}
                        >
                          <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>{item.label}</div>
                          <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.4 }}>
                            {COMPONENT_REGISTRY[item.type]?.manifest?.description || COMPONENT_DESCRIPTIONS[item.type] || `${item.type} component`}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
              <div key="palette-tip" style={S.paletteTip}>
                Click or drag → drop to place · Del removes selected
              </div>
            </div>
          </div>
        </aside>

        {/* Palette right-click context menu */}
        {paletteContextMenu && (() => {
          const menuH = 175;
          const adjustedY = paletteContextMenu.y + menuH > window.innerHeight
            ? paletteContextMenu.y - menuH
            : paletteContextMenu.y;
          return (
          <div
            onMouseDown={e => e.stopPropagation()}
            style={{ position: 'fixed', left: paletteContextMenu.x, top: adjustedY, zIndex: 9000, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 200, overflow: 'hidden' }}
          >
            <div style={{ padding: '7px 12px 6px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{paletteContextMenu.item.label}</div>
            {[
              {
                icon: favoriteComponents.has(paletteContextMenu.item.type) ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>,
                label: favoriteComponents.has(paletteContextMenu.item.type) ? 'Remove from Favourites' : 'Add to Favourites',
                color: '#f59e0b',
                action: () => { toggleFavorite(paletteContextMenu.item.type); setPaletteContextMenu(null); setIsPaletteHovered(false); }
              },
              {
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>,
                label: 'Component Documentation',
                color: 'var(--text)',
                action: () => {
                  const doc = COMPONENT_REGISTRY[paletteContextMenu.item.type]?.doc;
                  if (doc) {
                    const b = new Blob([doc], { type: 'text/html' });
                    window.open(URL.createObjectURL(b), '_blank');
                  } else {
                    window.open(`https://wokwi.com/docs/parts/${paletteContextMenu.item.type}`, '_blank');
                  }
                  setPaletteContextMenu(null); setIsPaletteHovered(false);
                }
              },
              {
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
                label: 'Edit a Copy',
                color: 'var(--text)',
                action: () => { setShowCreateComponentModal(true); setPaletteContextMenu(null); setIsPaletteHovered(false); }
              },
            ].map(({ icon, label, color, action }) => (
              <button
                key={label}
                onClick={action}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: 'none', border: 'none', color, padding: '9px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--card)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span>{icon}</span>{label}
              </button>
            ))}
          </div>
          );
        })()}

        {/* Create Component Modal (placeholder) */}
        {showCreateComponentModal && (
          <div style={S.modalOverlay} onClick={() => setShowCreateComponentModal(false)}>
            <div style={S.modalBox} onClick={e => e.stopPropagation()}>
              <div style={S.modalTitle}>Create Component</div>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>
                To create a custom component, build a ZIP package with <code>manifest.json</code>, <code>ui.tsx</code>, <code>logic.ts</code>, and optionally <code>validation.ts</code>, then upload via <strong>Upload ZIP to Test</strong>.
              </p>
              <button
                onClick={() => setShowCreateComponentModal(false)}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Got it
              </button>
            </div>
          </div>
        )}

        {/* CANVAS + SVG WIRE LAYER */}
        <main
          style={{
            ...S.canvas,
            cursor: segDrag ? (segDrag.isHoriz ? 'ns-resize' : 'ew-resize') : wireStart ? 'crosshair' : isCanvasLocked ? 'default' : 'grab',
            backgroundImage: showGrid
              ? 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)'
              : 'none',
          }}
          ref={canvasRef}
          onDrop={onCanvasDrop}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
          onMouseDown={e => {
            if (isCanvasLocked || wireStart || movingComp.current) return;
            if (e.button !== 0 && e.button !== 1) return;
            e.preventDefault();
            didPanRef.current = false;
            isPanningRef.current = true;
            panStartRef.current = { x: e.clientX, y: e.clientY, ox: canvasOffsetRef.current.x, oy: canvasOffsetRef.current.y };
          }}
          onClick={(e) => {
            if (didPanRef.current) return;
            if (wireStart) {
              const r = canvasRef.current.getBoundingClientRect();
              const newPt = { x: (e.clientX - r.left - canvasOffsetRef.current.x) / canvasZoom, y: (e.clientY - r.top - canvasOffsetRef.current.y) / canvasZoom };
              setWireStart(prev => ({ ...prev, waypoints: [...(prev.waypoints || []), newPt] }));
            } else {
              setSelected(null)
              setWireClickPos(null)
            }
          }}
          onMouseMove={e => {
            if (wireStart && canvasRef.current) {
              const r = canvasRef.current.getBoundingClientRect()
              const rawX = (e.clientX - r.left - canvasOffsetRef.current.x) / canvasZoom;
              const rawY = (e.clientY - r.top - canvasOffsetRef.current.y) / canvasZoom;
              const snapRadius = 15;
              let snapped = null;
              outer: for (const c of components) {
                if (c.id === wireStart.compId) continue;
                for (const pin of (PIN_DEFS[c.type] || [])) {
                  const pp = getPinPos(c.id, pin.id);
                  if (pp && Math.hypot(pp.x - rawX, pp.y - rawY) < snapRadius) {
                    snapped = pp; break outer;
                  }
                }
              }
              setMousePos(snapped || { x: rawX, y: rawY });
            }
          }}
          onDoubleClick={e => {
            if (wireStart || isRunning) return;
            // Don't open search if clicking on an input, button, select, textarea, or inside a context menu
            const tag = e.target.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'button' || tag === 'select') return;
            if (e.target.closest('[data-contextmenu]')) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const canvasX = (e.clientX - rect.left - canvasOffsetRef.current.x) / canvasZoomRef.current;
            const canvasY = (e.clientY - rect.top - canvasOffsetRef.current.y) / canvasZoomRef.current;
            setQuickAdd({ screenX: e.clientX, screenY: e.clientY, canvasX, canvasY });
            setQuickAddSearch('');
            setQuickAddIdx(0);
          }}
        >
          {/* Zoom Wrapper — scales all circuit content */}
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: `${100 / canvasZoom}%`, height: `${100 / canvasZoom}%`,
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasZoom})`, transformOrigin: '0 0',
          }}>
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
                const e1 = getPinExitPoint(fromParts[0], fromParts[1]) || p1;
                const e2 = getPinExitPoint(toParts[0], toParts[1]) || p2;
                const isSelectedWire = selected === w.id;
                const wirePath = buildWirePath(p1, e1, e2, p2, w.waypoints);

                return (
                  <g key={w.id} style={{ cursor: 'pointer' }} onClick={(e) => {
                    e.stopPropagation();
                    setSelected(w.id);
                    const rect = canvasRef.current.getBoundingClientRect();
                    setWireClickPos({ x: (e.clientX - rect.left - canvasOffsetRef.current.x) / canvasZoomRef.current, y: (e.clientY - rect.top - canvasOffsetRef.current.y) / canvasZoomRef.current });
                  }} onDoubleClick={e => e.stopPropagation()}>
                    <path d={wirePath} stroke="transparent" strokeWidth={16} fill="none" style={{ pointerEvents: 'stroke' }} />
                    <path d={wirePath} stroke={isSelectedWire ? 'var(--orange)' : w.color} strokeWidth={isSelectedWire ? 2.5 : 1.5} fill="none" strokeDasharray={isSelectedWire ? "6 4" : "none"} strokeLinecap="round" opacity={0.6} />
                    <circle cx={p1.x} cy={p1.y} r={isSelectedWire ? 4 : 3} fill={isSelectedWire ? 'var(--orange)' : w.color} opacity={0.6} />
                    <circle cx={p2.x} cy={p2.y} r={isSelectedWire ? 4 : 3} fill={isSelectedWire ? 'var(--orange)' : w.color} opacity={0.6} />
                    {wirepointsEnabled && getWirePoints(p1, e1, e2, p2, w.waypoints).reduce((acc, _, i, arr) => {
                      // Skip pin-stub segments (first: p1→e1, last: e2→p2) — only show on routing segments
                      if (i < 1 || i >= arr.length - 2) return acc;
                      const a = arr[i], b = arr[i + 1];
                      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
                      if (segLen < 20) return acc;
                      const isHoriz = Math.abs(b.y - a.y) < 1;
                      const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
                      acc.push(
                        <circle key={`sh-${i}`} cx={midX} cy={midY} r={isSelectedWire ? 6 : 4}
                          fill={isSelectedWire ? '#fff' : 'rgba(255,255,255,0.35)'}
                          stroke={isSelectedWire ? 'var(--orange)' : w.color} strokeWidth={1.5}
                          opacity={isSelectedWire ? 1 : 0.55}
                          style={{ pointerEvents: 'all', cursor: isHoriz ? 'ns-resize' : 'ew-resize' }}
                          title={isHoriz ? 'Drag up/down to route' : 'Drag left/right to route'}
                          onMouseDown={ev => {
                            ev.stopPropagation(); ev.preventDefault();
                            if (!isSelectedWire) { setSelected(w.id); return; }
                            const rect = canvasRef.current.getBoundingClientRect();
                            const mx = (ev.clientX - rect.left - canvasOffsetRef.current.x) / canvasZoomRef.current;
                            const my = (ev.clientY - rect.top - canvasOffsetRef.current.y) / canvasZoomRef.current;
                            const dragData = { wireId: w.id, segIdx: i, isHoriz, startMouseCanvas: { x: mx, y: my }, startPts: arr.map(pt => ({ ...pt })), preWires: wires, hasMoved: false };
                            segDragRef.current = dragData;
                            setSegDrag(dragData);
                          }}
                          onClick={ev => ev.stopPropagation()}
                          onDoubleClick={ev => {
                            ev.stopPropagation(); ev.preventDefault();
                            const newCorners = arr.slice(1, -1)
                              .filter((_, ci) => ci !== i - 1 && ci !== i)
                              .map(pt => ({ x: pt.x, y: pt.y, _corner: true }));
                            saveHistory();
                            setWires(prev => prev.map(ww => ww.id === w.id ? { ...ww, waypoints: newCorners } : ww));
                          }}
                        />
                      );
                      return acc;
                    }, [])}
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
                const e1 = getPinExitPoint(fromParts[0], fromParts[1]) || p1;
                const e2 = getPinExitPoint(toParts[0], toParts[1]) || p2;
                const isSelectedWire = selected === w.id;
                const wirePath = buildWirePath(p1, e1, e2, p2, w.waypoints);

                return (
                  <g key={w.id} style={{ cursor: 'pointer' }} onClick={(e) => {
                    e.stopPropagation();
                    setSelected(w.id);
                    const rect = canvasRef.current.getBoundingClientRect();
                    setWireClickPos({ x: (e.clientX - rect.left - canvasOffsetRef.current.x) / canvasZoomRef.current, y: (e.clientY - rect.top - canvasOffsetRef.current.y) / canvasZoomRef.current });
                  }} onDoubleClick={e => e.stopPropagation()}>
                    <path d={wirePath} stroke="transparent" strokeWidth={16} fill="none" style={{ pointerEvents: 'stroke' }} />
                    <path d={wirePath} stroke={isSelectedWire ? 'var(--orange)' : w.color} strokeWidth={isSelectedWire ? 2.3 : 1.3} fill="none" strokeDasharray={isSelectedWire ? "6 4" : "none"} strokeLinecap="round" opacity={0.9} />
                    <circle cx={p1.x} cy={p1.y} r={isSelectedWire ? 3 : 2} fill={isSelectedWire ? 'var(--orange)' : w.color} />
                    <circle cx={p2.x} cy={p2.y} r={isSelectedWire ? 3 : 2} fill={isSelectedWire ? 'var(--orange)' : w.color} />
                    {wirepointsEnabled && getWirePoints(p1, e1, e2, p2, w.waypoints).reduce((acc, _, i, arr) => {
                      // Skip pin-stub segments (first: p1→e1, last: e2→p2) — only show on routing segments
                      if (i < 1 || i >= arr.length - 2) return acc;
                      const a = arr[i], b = arr[i + 1];
                      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
                      if (segLen < 20) return acc;
                      const isHoriz = Math.abs(b.y - a.y) < 1;
                      const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
                      acc.push(
                        <circle key={`sh-${i}`} cx={midX} cy={midY} r={isSelectedWire ? 6 : 4}
                          fill={isSelectedWire ? '#fff' : 'rgba(255,255,255,0.35)'}
                          stroke={isSelectedWire ? 'var(--orange)' : w.color} strokeWidth={1.5}
                          opacity={isSelectedWire ? 1 : 0.55}
                          style={{ pointerEvents: 'all', cursor: isHoriz ? 'ns-resize' : 'ew-resize' }}
                          title={isHoriz ? 'Drag up/down to route' : 'Drag left/right to route'}
                          onMouseDown={ev => {
                            ev.stopPropagation(); ev.preventDefault();
                            if (!isSelectedWire) { setSelected(w.id); return; }
                            const rect = canvasRef.current.getBoundingClientRect();
                            const mx = (ev.clientX - rect.left - canvasOffsetRef.current.x) / canvasZoomRef.current;
                            const my = (ev.clientY - rect.top - canvasOffsetRef.current.y) / canvasZoomRef.current;
                            const dragData = { wireId: w.id, segIdx: i, isHoriz, startMouseCanvas: { x: mx, y: my }, startPts: arr.map(pt => ({ ...pt })), preWires: wires, hasMoved: false };
                            segDragRef.current = dragData;
                            setSegDrag(dragData);
                          }}
                          onClick={ev => ev.stopPropagation()}
                          onDoubleClick={ev => {
                            ev.stopPropagation(); ev.preventDefault();
                            const newCorners = arr.slice(1, -1)
                              .filter((_, ci) => ci !== i - 1 && ci !== i)
                              .map(pt => ({ x: pt.x, y: pt.y, _corner: true }));
                            saveHistory();
                            setWires(prev => prev.map(ww => ww.id === w.id ? { ...ww, waypoints: newCorners } : ww));
                          }}
                        />
                      );
                      return acc;
                    }, [])}
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

            {/* Component Context Menu — rendered at canvas level to avoid overflow:hidden clipping */}
            {(() => {
              const comp = components.find(c => c.id === selected);
              if (!comp) return null;
              const reg = COMPONENT_REGISTRY[comp.type];
              if (!reg?.ContextMenu) return null;
              const showDuringRun = !!reg.contextMenuDuringRun || !!reg.contextMenuOnlyDuringRun;
              if (isRunning && !showDuringRun) return null;
              if (!isRunning && reg.contextMenuOnlyDuringRun) return null;
              return (
                <div key={`cmenu-${comp.id}`} data-contextmenu="true" style={{
                  position: 'absolute',
                  left: comp.x + comp.w / 2,
                  top: comp.y - 14,
                  transform: 'translateX(-50%) translateY(-100%)',
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: '10px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)', cursor: 'default',
                  pointerEvents: 'all', whiteSpace: 'nowrap', zIndex: 200
                }}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                  onDoubleClick={e => e.stopPropagation()}
                >
                  {React.createElement(reg.ContextMenu, {
                    attrs: getComponentStateAttrs(comp),
                    onUpdate: (key, value) => updateComponentAttr(comp.id, key, value)
                  })}
                  <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid var(--border)' }} />
                  <div style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid var(--bg2)' }} />
                </div>
              );
            })()}

            {/* HTML Overlay for Wire Context Menus (Bypasses SVG foreignObject event bugs) */}
            {(() => {
              const w = wires.find(w => w.id === selected);
              if (!w || isRunning) return null;

              const fromParts = w.from.split(':')
              const toParts = w.to.split(':')
              const p1 = getPinPos(fromParts[0], fromParts[1])
              const p2 = getPinPos(toParts[0], toParts[1])
              if (!p1 || !p2) return null

              // Use click position, fall back to wire midpoint
              const pts = [p1, ...(w.waypoints || []), p2];
              const midPt = pts[Math.floor(pts.length / 2)];
              const menuPos = wireClickPos || midPt;

              // Build connection label — "LED [anode]" style, no instance number
              const fromComp = components.find(c => c.id === fromParts[0]);
              const toComp = components.find(c => c.id === toParts[0]);
              const fromLabel = `${fromComp?.label || fromParts[0]} [${w.fromLabel || fromParts[1]}]`;
              const toLabel = `${toComp?.label || toParts[0]} [${w.toLabel || toParts[1]}]`;

              return (
                <div key={`menu-${w.id}`} style={{
                  position: 'absolute',
                  left: menuPos.x,
                  top: menuPos.y - 8,
                  transform: 'translateX(-50%) translateY(-100%)',
                  zIndex: 50,
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', gap: 6,
                  padding: '8px 10px', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.6)', cursor: 'default',
                  minWidth: 180,
                }}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}>
                  {/* Row 1: connection info — two lines, centered */}
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.5, textAlign: 'center' }}
                    title={`${fromLabel} → ${toLabel}`}>
                    <div style={{ fontSize: 9, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{fromLabel}</div>
                    <div style={{ fontSize: 9, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{toLabel}</div>
                  </div>
                  {/* Row 2: controls — centered */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
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
                    <button
                      style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontSize: 13, padding: '4px 7px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
                      title="Reset route to auto"
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => {
                        e.stopPropagation();
                        saveHistory();
                        setWires(prev => prev.map(ww => ww.id === w.id ? { ...ww, waypoints: [] } : ww));
                      }}
                    >↺</button>
                    <button style={{ background: 'var(--red)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, padding: '4px 8px', borderRadius: 6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }} onPointerDown={(e) => { e.stopPropagation(); deleteWire(w.id); }} onClick={(e) => { e.stopPropagation(); deleteWire(w.id); }} title="Delete Wire">✕</button>
                  </div>
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
                    zIndex: isSelected ? 5 : 2,
                    userSelect: 'none',
                    pointerEvents: 'none', // Clicks pass through the manifest wrapper
                    transform: comp.rotation ? `rotate(${comp.rotation}deg)` : undefined,
                    transformOrigin: 'center center',
                  }}
                >
                  {/* Hit Box — captures selection and drag only within BOUNDS */}
                  {(() => {
                    const getBounds = () => {
                      const reg = COMPONENT_REGISTRY[comp.type];
                      if (!reg) return { x: 0, y: 0, w: comp.w, h: comp.h };
                      if (typeof reg.BOUNDS === 'function') return reg.BOUNDS(getComponentStateAttrs(comp));
                      return reg.BOUNDS || { x: 0, y: 0, w: comp.w, h: comp.h };
                    };
                    const b = getBounds();
                    return (
                      <div
                        style={{
                          position: 'absolute',
                          left: b.x, top: b.y,
                          width: b.w, height: b.h,
                          cursor: wireStart ? 'crosshair' : 'move',
                          pointerEvents: 'auto',
                          zIndex: 0, // Below pins and interactive UI elements
                        }}
                        onMouseDown={e => onCompMouseDown(e, comp.id)}
                        onClick={e => onCompClick(e, comp.id)}
                        onDoubleClick={e => e.stopPropagation()}
                      />
                    );
                  })()}

                  {/* Selection ring — uses BOUNDS from ui.tsx for precise sizing */}
                  {isSelected && (() => {
                    const getBounds = () => {
                      const reg = COMPONENT_REGISTRY[comp.type];
                      if (!reg) return { x: 0, y: 0, w: comp.w, h: comp.h };
                      if (typeof reg.BOUNDS === 'function') return reg.BOUNDS(getComponentStateAttrs(comp));
                      return reg.BOUNDS || { x: 0, y: 0, w: comp.w, h: comp.h };
                    };
                    const b = getBounds();
                    return (
                      <div style={{
                        position: 'absolute',
                        left: b.x - 6, top: b.y - 6,
                        width: b.w + 12, height: b.h + 12,
                        borderRadius: 8,
                        border: '2px solid var(--accent)',
                        boxShadow: '0 0 16px var(--glow)',
                        pointerEvents: 'none', zIndex: 10,
                      }} />
                    );
                  })()}
                  {/* Error ring — uses BOUNDS from ui.tsx for precise sizing */}
                  {hasError && (() => {
                    const getBounds = () => {
                      const reg = COMPONENT_REGISTRY[comp.type];
                      if (!reg) return { x: 0, y: 0, w: comp.w, h: comp.h };
                      if (typeof reg.BOUNDS === 'function') return reg.BOUNDS(getComponentStateAttrs(comp));
                      return reg.BOUNDS || { x: 0, y: 0, w: comp.w, h: comp.h };
                    };
                    const b = getBounds();
                    return (
                      <div style={{
                        position: 'absolute',
                        left: b.x - 6, top: b.y - 6,
                        width: b.w + 12, height: b.h + 12,
                        borderRadius: 8,
                        border: '2px solid var(--red)',
                        boxShadow: '0 0 16px rgba(255,68,68,.4)',
                        pointerEvents: 'none', zIndex: 10,
                      }} />
                    );
                  })()}

                  {/* Component Render — wrapped to allow pass-through to Hit Box */}
                  <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, zIndex: 1 }}>
                    {COMPONENT_REGISTRY[comp.type] ? (
                      // Local UI component rendering SVG
                      React.createElement(COMPONENT_REGISTRY[comp.type].UI, {
                        state: oopStates[comp.id] || {},
                        attrs: getComponentStateAttrs(comp),
                        isRunning: isRunning
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
                  </div>

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
                    position: 'absolute',
                    top: (() => {
                      const reg = COMPONENT_REGISTRY[comp.type];
                      const b = typeof reg?.BOUNDS === 'function'
                        ? reg.BOUNDS(getComponentStateAttrs(comp))
                        : (reg?.BOUNDS || { x: 0, y: 0, w: comp.w, h: comp.h });
                      return b.y + b.h + 4;
                    })(),
                    left: (() => {
                      const reg = COMPONENT_REGISTRY[comp.type];
                      const b = typeof reg?.BOUNDS === 'function'
                        ? reg.BOUNDS(getComponentStateAttrs(comp))
                        : (reg?.BOUNDS || { x: 0, y: 0, w: comp.w, h: comp.h });
                      return b.x + b.w / 2;
                    })(),
                    transform: 'translateX(-50%)',
                    fontSize: 10, color: hasError ? 'var(--red)' : 'var(--text3)',
                    whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace',
                    pointerEvents: 'none',
                  }}>
                    {comp.label}
                  </div>

                </div>
              )
            })}
          </div>{/* end zoom wrapper */}

          {/* Component Description Panel — shows info of canvas-selected component */}
          {showComponentDesc && selectedComponentInfo && (
            <div
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              style={{ position: 'absolute', top: 12, right: 12, zIndex: 90, width: 220, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', overflow: 'hidden' }}
            >
              {/* Header */}
              <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{selectedComponentInfo.label}</div>
                <div style={{ display: 'inline-block', fontSize: 10, color: 'var(--text3)', background: `${GROUP_COLORS[selectedComponentInfo.group] || 'var(--accent)'}22`, border: `1px solid ${GROUP_COLORS[selectedComponentInfo.group] || 'var(--accent)'}55`, borderRadius: 4, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {selectedComponentInfo.group}
                </div>
              </div>

              {/* Description */}
              <div style={{ padding: '10px 12px 8px', fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                {COMPONENT_REGISTRY[selectedComponentInfo.type]?.manifest?.description || COMPONENT_DESCRIPTIONS[selectedComponentInfo.type] || `${selectedComponentInfo.type} component`}
              </div>

              {/* Doc link */}
              <div style={{ padding: '0 12px 10px' }}>
                <button
                  onClick={() => {
                    const doc = COMPONENT_REGISTRY[selectedComponentInfo.type]?.doc;
                    if (doc) {
                      const b = new Blob([doc], { type: 'text/html' });
                      window.open(URL.createObjectURL(b), '_blank');
                    } else {
                      window.open(`https://wokwi.com/docs/parts/${selectedComponentInfo.type}`, '_blank');
                    }
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text2)', cursor: 'pointer', fontSize: 11 }}>
                  📖 Component Documentation
                </button>
              </div>
            </div>
          )}

          {/* Canvas Zoom Toolbar — anchored inside canvas so it moves with code panel resize */}
          <div
            style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 100, display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 6px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          >
            <button
              className="zoom-btn"
              onClick={() => setCanvasZoom(z => Math.max(0.25, parseFloat((z - 0.25).toFixed(2))))}
              style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', lineHeight: 1, padding: '4px 7px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
              title="Zoom Out"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </button>
            <button
              onClick={() => setCanvasZoom(1)}
              style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 11, padding: '2px 6px', borderRadius: 6, minWidth: 40, fontFamily: 'JetBrains Mono, monospace' }}
              title="Reset Zoom"
            >{Math.round(canvasZoom * 100)}%</button>
            <button
              className="zoom-btn"
              onClick={() => setCanvasZoom(z => Math.min(2, parseFloat((z + 0.25).toFixed(2))))}
              style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', lineHeight: 1, padding: '4px 7px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
              title="Zoom In"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </button>
            <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowCanvasMenu(m => !m)}
                style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 16, padding: '2px 7px', borderRadius: 6 }}
                title="Canvas Menu"
              >⋮</button>
              {showCanvasMenu && (
                <div
                  style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 190, zIndex: 200, padding: '4px' }}
                  onMouseLeave={() => setShowCanvasMenu(false)}
                >
                  <button className="canvas-menu-item" onClick={() => { setCanvasZoom(1); setCanvasOffset({ x: 0, y: 0 }); setShowCanvasMenu(false); }}>Fit to Canvas</button>
                  <button className={`canvas-menu-item${history.past.length === 0 || isRunning ? ' canvas-menu-item--disabled' : ''}`} onClick={() => { undo(); setShowCanvasMenu(false); }} disabled={history.past.length === 0 || isRunning}>Undo</button>
                  <button className={`canvas-menu-item${history.future.length === 0 || isRunning ? ' canvas-menu-item--disabled' : ''}`} onClick={() => { redo(); setShowCanvasMenu(false); }} disabled={history.future.length === 0 || isRunning}>Redo</button>
                  <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                  <button className="canvas-menu-item" onClick={() => { setShowGrid(g => !g); setShowCanvasMenu(false); }}>{showGrid ? 'Hide Grid' : 'Show Grid'}</button>
                  <button className="canvas-menu-item" onClick={() => { setIsCanvasLocked(l => !l); setShowCanvasMenu(false); }}>{isCanvasLocked ? 'Unlock Canvas' : 'Lock Canvas'}</button>
                  <button className="canvas-menu-item" onClick={() => { toggleFullscreen(); setShowCanvasMenu(false); }}>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</button>
                  <button className="canvas-menu-item" onClick={() => {
                    const enabling = !wirepointsEnabled;
                    setWirepointsEnabled(enabling);
                    setShowCanvasMenu(false);
                  }}>{wirepointsEnabled ? 'Disable Wire Waypoints' : 'Enable Wire Waypoints'}</button>
                  <button className="canvas-menu-item" onClick={() => { setShowComponentDesc(d => !d); setShowCanvasMenu(false); }}>{showComponentDesc ? 'Hide Component Info' : 'Show Component Info'}</button>
                  <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                  <button className="canvas-menu-item canvas-menu-item--danger" onClick={() => { if (!isRunning) { saveHistory(); setComponents([]); setWires([]); setSelected(null); } setShowCanvasMenu(false); }}>Clear Canvas</button>
                </div>
              )}
            </div>
          </div>

          {/* ── Quick-Add Popup (double-click on canvas) ── */}
          {quickAdd && (() => {
            const q = quickAddSearch.trim().toLowerCase();
            const results = [];
            if (q) {
              outer: for (const group of LOCAL_CATALOG) {
                for (const item of group.items) {
                  if (item.label.toLowerCase().includes(q) || item.type.toLowerCase().includes(q)) {
                    results.push(item);
                    if (results.length >= 4) break outer;
                  }
                }
              }
            }
            const selIdx = Math.max(0, Math.min(quickAddIdx, results.length - 1));
            const VW = window.innerWidth, VH = window.innerHeight;
            const menuW = 240, approxH = 44 + results.length * 38 + (results.length === 0 ? 38 : 0);
            const left = quickAdd.screenX + menuW > VW ? quickAdd.screenX - menuW - 4 : quickAdd.screenX + 4;
            const top = quickAdd.screenY + approxH > VH ? quickAdd.screenY - approxH - 4 : quickAdd.screenY + 4;
            return (
              <div
                data-quickadd="true"
                onMouseDown={e => e.stopPropagation()}
                style={{
                  position: 'fixed', left, top, zIndex: 9999,
                  width: menuW,
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
                  overflow: 'hidden',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {/* Search input */}
                <div style={{ padding: '8px 10px', borderBottom: results.length > 0 ? '1px solid var(--border)' : 'none' }}>
                  <input
                    ref={quickAddInputRef}
                    data-quickadd="true"
                    value={quickAddSearch}
                    onChange={e => { setQuickAddSearch(e.target.value); setQuickAddIdx(0); }}
                    onKeyDown={e => {
                      if (e.key === 'Escape') { e.preventDefault(); setQuickAdd(null); }
                      else if (e.key === 'ArrowDown') { e.preventDefault(); setQuickAddIdx(i => Math.min(i + 1, results.length - 1)); }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setQuickAddIdx(i => Math.max(i - 1, 0)); }
                      else if (e.key === 'Enter' && results.length > 0) {
                        e.preventDefault();
                        addComponentAt(results[selIdx], quickAdd.canvasX, quickAdd.canvasY);
                        setQuickAdd(null);
                      }
                    }}
                    placeholder="Search component..."
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'var(--bg3)', border: '1px solid var(--border2)',
                      color: 'var(--text)', padding: '7px 10px',
                      borderRadius: 7, fontFamily: 'inherit', fontSize: 13, outline: 'none',
                    }}
                  />
                </div>
                {/* Result list */}
                {results.map((item, i) => (
                  <div
                    key={`${item.type}-${i}`}
                    data-quickadd="true"
                    onMouseEnter={() => setQuickAddIdx(i)}
                    onMouseDown={e => { e.preventDefault(); addComponentAt(item, quickAdd.canvasX, quickAdd.canvasY); setQuickAdd(null); }}
                    style={{
                      padding: '8px 12px',
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: i === selIdx ? 'var(--accent)' : 'transparent',
                      color: i === selIdx ? '#fff' : 'var(--text)',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ fontWeight: 600, flex: 1 }}>{item.label}</span>
                    {i === selIdx && <span style={{ fontSize: 10, opacity: 0.75 }}>↵</span>}
                  </div>
                ))}
                {/* Empty state */}
                {q && results.length === 0 && (
                  <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)' }}>No components found</div>
                )}
                {!q && (
                  <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)' }}>Type to search components...</div>
                )}
              </div>
            );
          })()}
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
              <div className="panel-scroll" style={S.wiresList}>
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
                      {t === 'code' ? '{ } Code' : t === 'libraries' ? ' Libraries' : t === 'serial' ? ' Serial' : ' Plotter'}
                    </button>
                  ))}
                </div>
                {codeTab === 'code' && (
                  <div className="panel-scroll" style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
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
                        color: 'var(--text)',
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
                    <form onSubmit={handleSearchLibraries} style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
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

                    <div className="panel-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
                      {libResults.length > 0 && <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 }}>Search Results</div>}
                      {libResults.map((lib, idx) => (
                        <div key={idx} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>{lib.name}</div>
                            <Btn
                              color="var(--green)"
                              disabled={installingLib === lib.name}
                              onClick={() => handleInstallLibrary(lib.name)}
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
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--bg)', overflow: 'hidden' }}>
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
                    <div ref={serialOutputRef} className="panel-scroll" style={S.serialOutput}>
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
                              <span style={{ flex: 1, color: entry.dir === 'tx' ? '#3498db' : entry.dir === 'sys' ? 'var(--text3)' : 'var(--green)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {entry.text}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* TX Input Row */}
                    <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg2)' }}>
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
                      {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', ...serialPlotLabelsRef.current.filter(l => !['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'].includes(l))].map((pin, i) => {
                        const isSel = selectedPlotPins.includes(pin);
                        const isAna = pin.startsWith('A');
                        const isLogic = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'].includes(pin);
                        let bg = isAna ? 'rgba(52,152,219,0.2)' : 'rgba(46,204,113,0.2)';
                        let br = isAna ? '#3498db' : '#2ecc71';
                        if (!isLogic) {
                          const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c'];
                          const c = colors[i % colors.length];
                          bg = `${c}33`; br = c;
                        }
                        return (
                          <button
                            key={pin}
                            onClick={() => setSelectedPlotPins(prev => {
                              if (prev.includes(pin)) return prev.filter(p => p !== pin);
                              if (prev.length >= 8) return [...prev.slice(1), pin];
                              return [...prev, pin];
                            })}
                            style={{
                              background: isSel ? bg : 'transparent',
                              border: `1px solid ${isSel ? br : 'var(--border)'}`,
                              color: isSel ? br : 'var(--text3)',
                              borderRadius: 4, padding: '1px 5px', fontSize: 10, cursor: 'pointer'
                            }}
                          >{pin}</button>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    {selectedPlotPins.length > 0 && (
                      <div style={S.plotterLegend}>
                        {selectedPlotPins.map((pin, i) => {
                          let bg = pin.startsWith('A') ? '#3498db' : '#2ecc71';
                          let lbl = `Pin ${pin}`;
                          if (isNaN(parseInt(pin)) && !pin.startsWith('A')) {
                            const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c'];
                            const serialVars = selectedPlotPins.filter(p => isNaN(parseInt(p)) && !p.startsWith('A'));
                            bg = colors[serialVars.indexOf(pin) % colors.length];
                            lbl = pin;
                          }
                          return (
                            <span key={pin} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, cursor: 'pointer' }}
                              onClick={() => setSelectedPlotPins(prev => prev.filter(p => p !== pin))}
                              title="Click to remove" >
                              <span style={{ width: 10, height: 10, borderRadius: 2, background: bg, flexShrink: 0 }} />
                              <span style={{ color: 'var(--text2)', fontFamily: 'JetBrains Mono, monospace' }}>{lbl}</span>
                            </span>
                          );
                        })}
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

    {/* ── SAVE DIALOG ──────────────────────────────────────────────────────── */}
    {showSaveDialog && (
      <div style={S.modalOverlay} onClick={() => setShowSaveDialog(false)}>
        <div style={S.modalBox} onClick={e => e.stopPropagation()}>
          <div style={S.modalTitle}>Save Project</div>
          <input
            autoFocus
            style={{ ...S.paletteSearch, marginBottom: 16, fontSize: 14, padding: '10px 12px' }}
            placeholder="Project name..."
            value={saveDialogName}
            onChange={e => setSaveDialogName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleConfirmSave(); if (e.key === 'Escape') setShowSaveDialog(false); }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn onClick={() => setShowSaveDialog(false)}>Cancel</Btn>
            <Btn color="var(--accent)" onClick={handleConfirmSave}>Save</Btn>
          </div>
        </div>
      </div>
    )}


    </div>
  )
}

// ─── Tiny button component (Updated to support CSS Variables) ───────────────
function Btn({ children, onClick, color, title, disabled, iconOnly }) {
  const [hov, setHov] = useState(false)
  const [clicked, setClicked] = useState(false)
  const isInteractive = !disabled && hov;

  const handleClick = () => {
    if (disabled) return;
    setClicked(true);
    setTimeout(() => setClicked(false), 280);
    onClick?.();
  };

  return (
    <button
      title={title}
      onClick={handleClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: disabled ? 'transparent' : (color ? (isInteractive ? color : 'transparent') : isInteractive ? 'var(--border)' : 'var(--card)'),
        border: `1px solid ${color || 'var(--border)'}`,
        color: disabled ? 'var(--text3)' : (color ? (isInteractive ? '#fff' : color) : 'var(--text)'),
        padding: iconOnly ? '7px 10px' : '7px 14px', borderRadius: 8,
        fontFamily: 'Space Grotesk, sans-serif', fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s',
        whiteSpace: 'nowrap',
        fontWeight: color ? 700 : 500,
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        animation: clicked ? 'toolbtn-pop 0.26s ease' : 'none',
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
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  modalBox: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 360, boxShadow: '0 8px 40px rgba(0,0,0,.4)' },
  modalTitle: { fontSize: 16, fontWeight: 700, marginBottom: 14, color: 'var(--text)' },
  workspace: { display: 'flex', flex: 1, overflow: 'hidden' },

  palette: { width: 410, background: 'var(--bg2)', borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 },
  paletteHeader: { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.1em', padding: '4px 8px 8px' },
  paletteSearch: { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '7px 10px', borderRadius: 8, fontFamily: 'inherit', fontSize: 12, width: '100%', marginBottom: 8, outline: 'none', boxSizing: 'border-box' },
  groupName: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 },
  paletteItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'grab', transition: 'all .15s', border: '1px solid transparent', userSelect: 'none' },
  paletteTip: { marginTop: 'auto', padding: '10px 8px', fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 },

  canvas: {
    flex: 1, position: 'relative', overflow: 'hidden',
    backgroundColor: 'var(--canvas-bg)',
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
  serialToolbar: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 },
  serialCtrlBtn: { background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  serialLine: { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '2px 12px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', borderBottom: '1px solid var(--border)' },
  serialTs: { color: 'var(--text3)', fontSize: 10, minWidth: 84, flexShrink: 0, paddingTop: 1 },
  serialBadge: { display: 'inline-block', fontSize: 9, fontWeight: 700, borderRadius: 3, padding: '1px 4px', flexShrink: 0, marginTop: 1 },
  plotterToolbar: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  plotterLegend: { display: 'flex', flexWrap: 'wrap', gap: '4px 16px', padding: '4px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 },
}



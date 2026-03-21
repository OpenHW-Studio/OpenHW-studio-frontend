import { TopToolbox } from './TopToolbox';
import { Btn } from './Btn';
import { RightPanel } from './RightPanel';
import { renderRoundedPath, computeWireOrthoPoints, getWirePoints, multiRoutePath, buildWirePath, wireColor } from './wireUtils';
import { useWebSerialHardware } from './webSerialHardware';
import { useHardwareFlashing } from './useHardwareFlashing';
import { SimulationConsolePanel, TerminalIcon, useSimulationConsole } from './SimulationConsole';








import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext.jsx'
import { compileCode, flashFirmware, fetchInstalledLibraries, searchLibraries, installLibrary, submitCustomComponent, fetchInstalledComponentsWithFiles } from '../../services/simulatorService.js'
import { getCachedHex, setCachedHex, enqueueComponent, getQueuedComponents, dequeueComponent } from '../../services/offlineCache.js'
import { saveProject, loadProject, listProjects, deleteProject, renameProject, generateProjectId, formatProjectDate } from '../../services/projectStore.js'
import html2canvas from 'html2canvas'
import JSZip from 'jszip';
import * as Babel from '@babel/standalone';

import * as EmulatorComponents from "@openhw/emulator/src/components/index.ts";

// Web Editor features
import Editor from 'react-simple-code-editor';
import BlocklyEditor from '../../components/BlocklyEditor.jsx';
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

const GROUP_MAPPING = {
  'Basic': 'basic',
  'Passives': 'basic',
  'Power': 'basic',
  'Outputs': 'output',
  'Inputs': 'input',
  'Sensors': 'sensor',
  'Displays': 'display',
  'Memory': 'misc',
  'Logic': 'logic'
};

function normalizeGroupName(name) {
  return GROUP_MAPPING[name] || name;
}

function sortCatalog(catalog) {
  const GROUP_ORDER = ['Boards', 'Basic', 'Display', 'Input', 'Sensor', 'Output', 'Actuators', 'Misc', 'Logic'];
  catalog.sort((a, b) => {
    const idxA = GROUP_ORDER.indexOf(a.group);
    const idxB = GROUP_ORDER.indexOf(b.group);
    if (idxA === -1 && idxB === -1) return a.group.localeCompare(b.group);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
}

function resolveUiExport(exportsUI) {
  if (!exportsUI) return null;

  if (exportsUI.default && typeof exportsUI.default === 'function') return exportsUI.default;
  if (exportsUI.UI && typeof exportsUI.UI === 'function') return exportsUI.UI;

  const keys = Object.keys(exportsUI);
  const blocked = (k) => {
    const l = String(k).toLowerCase();
    return l.includes('contextmenu') || l === 'bounds' || l === 'contextmenuduringrun' || l === 'contextmenuonlyduringrun';
  };

  const fnKey = keys.find((k) => typeof exportsUI[k] === 'function' && !blocked(k));
  if (fnKey) return exportsUI[fnKey];

  const anyKey = keys.find((k) => !blocked(k));
  if (anyKey) return exportsUI[anyKey];

  return null;
}

Object.values(COMPONENT_REGISTRY).forEach(module => {
  const manifest = module.manifest;
  const groupName = normalizeGroupName(manifest.group);
  let group = LOCAL_CATALOG.find(g => g.group === groupName);
  if (!group) {
    group = { group: groupName, items: [] };
    LOCAL_CATALOG.push(group);
  }

  const { pins, group: _, ...catalogItem } = manifest;
  group.items.push(catalogItem);

  if (pins) {
    LOCAL_PIN_DEFS[manifest.type] = pins;
  }
});

sortCatalog(LOCAL_CATALOG);

// Tracks component types that were dynamically injected from the backend (not built-in).
// Used by the polling loop to detect deletions and purge them from the registry.
const BACKEND_INJECTED_TYPES = new Set();

let nextId = 1
let nextWireId = 1

// ─── SYNC ID COUNTERS AFTER LOADING EXTERNAL DATA ──────────────────────────
// Prevents duplicate keys when a saved project has IDs higher than the
// current module-level counter (e.g. loading "wokwi-ili9341_2" with nextId=1
// would let a subsequent add generate the same key again).
function syncNextIds(comps, ws) {
  for (const c of (comps || [])) {
    const m = c.id && c.id.match(/_(\d+)$/);
    if (m) nextId = Math.max(nextId, parseInt(m[1]) + 1);
  }
  for (const w of (ws || [])) {
    const m = w.id && w.id.match(/^w(\d+)$/);
    if (m) nextWireId = Math.max(nextWireId, parseInt(m[1]) + 1);
  }
}

const EXAMPLES_BASE_URL = import.meta.env.VITE_EXAMPLES_BASE_URL || 'http://localhost:5001/examples';

// ── Palette group visual helpers ─────────────────────────────────────────────
const GROUP_ICON_SVG = {
  'Boards': (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="18" x2="8" y2="22" /><line x1="16" y1="18" x2="16" y2="22" /><line x1="2" y1="8" x2="6" y2="8" /><line x1="2" y1="16" x2="6" y2="16" /><line x1="18" y1="8" x2="22" y2="8" /><line x1="18" y1="16" x2="22" y2="16" /><rect x="8" y="8" width="8" height="8" rx="1" fill={c} fillOpacity="0.2" /></svg>,
  'output': (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="5" /><path d="M12 15v4M9 19h6M8.5 7.5A5 5 0 0 1 12 5" /></svg>,
  'input': (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="10" width="12" height="8" rx="2" /><circle cx="12" cy="10" r="2" fill={c} fillOpacity="0.3" /><line x1="12" y1="2" x2="12" y2="8" /><line x1="4" y1="18" x2="6" y2="18" /><line x1="18" y1="18" x2="20" y2="18" /></svg>,
  'basic': (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="12" x2="6" y2="12" /><rect x="6" y="8" width="12" height="8" rx="1" /><line x1="18" y1="12" x2="22" y2="12" /></svg>,
  'Actuators': (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" /></svg>,
  'misc': (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="14" rx="2" /><line x1="8" y1="5" x2="8" y2="19" /><line x1="12" y1="5" x2="12" y2="19" /><line x1="16" y1="5" x2="16" y2="19" /></svg>,
  'display': (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="14" rx="2" /><line x1="8" y1="22" x2="16" y2="22" /><line x1="12" y1="18" x2="12" y2="22" /></svg>,
  'sensor': (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 5.5A11 11 0 0 0 5.5 18.5M18.5 5.5A11 11 0 0 1 18.5 18.5M8.5 8.5A6 6 0 0 0 8.5 15.5M15.5 8.5A6 6 0 0 1 15.5 15.5" /><circle cx="12" cy="12" r="1.5" fill={c} /></svg>,
  'logic': (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h8c3.3 0 6 2.7 6 6s-2.7 6-6 6H4z" /><line x1="4" y1="4" x2="4" y2="20" /><line x1="2" y1="11" x2="4" y2="11" /><line x1="2" y1="17" x2="4" y2="17" /><line x1="18" y1="14" x2="22" y2="14" /></svg>,
};
const GROUP_COLORS = {
  'Boards': '#6366f1', 'output': '#22c55e', 'input': '#3b82f6',
  'basic': '#f59e0b', 'Actuators': '#06b6d4',
  'misc': '#8b5cf6', 'display': '#ec4899', 'sensor': '#14b8a6', 'logic': '#8b5cf6',
};

const BOARD_BAUD_PRESETS = {
  arduino_uno: ['300', '1200', '2400', '4800', '9600', '19200', '38400', '57600', '115200'],
  esp32: ['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600'],
  stm32: ['9600', '19200', '38400', '57600', '115200', '230400', '460800'],
  rp2040: ['9600', '19200', '38400', '57600', '115200', '230400', '460800'],
};

const BOARD_DEFAULT_BAUD = {
  arduino_uno: '9600',
  esp32: '115200',
  stm32: '115200',
  rp2040: '115200',
};

const BOARD_FQBN = {
  arduino_uno: 'arduino:avr:uno',
  esp32: 'esp32:esp32:esp32',
  stm32: 'STMicroelectronics:stm32:GenF1',
  rp2040: 'rp2040:rp2040:rpipico',
};

function normalizeBoardKind(source) {
  const s = String(source || '').toLowerCase();
  if (s.includes('esp32')) return 'esp32';
  if (s.includes('stm32')) return 'stm32';
  if (s.includes('rp2040') || s.includes('pico')) return 'rp2040';
  return 'arduino_uno';
}

function createDefaultMainCode(boardKind, boardId) {
  if (boardKind === 'esp32' || boardKind === 'stm32' || boardKind === 'rp2040') {
    return `// ${boardId} main sketch\nvoid setup() {\n  // Serial.begin(${BOARD_DEFAULT_BAUD[boardKind] || 115200});\n}\n\nvoid loop() {\n  delay(1000);\n}\n`;
  }
  return `// ${boardId} main sketch\nvoid setup() {\n  pinMode(13, OUTPUT);\n  // Serial.begin(${BOARD_DEFAULT_BAUD.arduino_uno});\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}\n`;
}

function fileExt(path) {
  const idx = path.lastIndexOf('.');
  return idx >= 0 ? path.substring(idx).toLowerCase() : '';
}

function isProgrammableBoardType(type) {
  return /(arduino|esp32|stm32|rp2040|pico)/i.test(String(type || ''));
}

function endpointAliases(endpoint) {
  const [compId, pinIdRaw] = String(endpoint || '').split(':');
  const pinId = String(pinIdRaw || '');
  if (!compId || !pinId) return [String(endpoint || '')];

  const aliases = new Set([`${compId}:${pinId}`]);
  if (/^\d+$/.test(pinId)) aliases.add(`${compId}:D${pinId}`);
  if (/^D\d+$/i.test(pinId)) aliases.add(`${compId}:${pinId.substring(1)}`);
  if (/^gnd(_\d+)?$/i.test(pinId) || /^GND$/i.test(pinId)) aliases.add(`${compId}:gnd`);
  if (/^5v$/i.test(pinId) || /^VCC$/i.test(pinId)) aliases.add(`${compId}:5V`);
  return Array.from(aliases);
}

function validateCircuitLocally(components, wires) {
  const errors = [];
  const componentById = new Map((components || []).map((c) => [c.id, c]));

  const programmableBoards = (components || []).filter((c) => isProgrammableBoardType(c.type));
  if (programmableBoards.length === 0) return errors;

  const graph = new Map();
  const addEdge = (a, b) => {
    if (!graph.has(a)) graph.set(a, new Set());
    if (!graph.has(b)) graph.set(b, new Set());
    graph.get(a).add(b);
    graph.get(b).add(a);
  };

  (wires || []).forEach((w) => {
    const fromAliases = endpointAliases(w.from);
    const toAliases = endpointAliases(w.to);
    fromAliases.forEach((fa) => toAliases.forEach((ta) => addEdge(fa, ta)));
  });

  const isMcuDigitalEndpoint = (endpoint) => {
    const [compId, pin] = String(endpoint || '').split(':');
    const comp = componentById.get(compId);
    if (!comp || !isProgrammableBoardType(comp.type)) return false;
    if (!pin) return false;
    return /^D?\d+$/i.test(pin) || /^A\d+$/i.test(pin);
  };

  const bfsReachable = (starts) => {
    const q = [...starts];
    const visited = new Set(starts);
    while (q.length) {
      const n = q.shift();
      for (const nei of graph.get(n) || []) {
        if (visited.has(nei)) continue;
        visited.add(nei);
        q.push(nei);
      }
    }
    return visited;
  };

  programmableBoards.forEach((board) => {
    const powerPins = [`${board.id}:5V`, `${board.id}:3v3`, `${board.id}:VCC`];
    const gndPins = [`${board.id}:gnd`, `${board.id}:gnd_1`, `${board.id}:gnd_2`, `${board.id}:gnd_3`, `${board.id}:GND`];
    const reachable = bfsReachable(powerPins);
    const isShorted = gndPins.some((g) => reachable.has(g) || reachable.has(`${board.id}:gnd`));
    if (isShorted) {
      errors.push({
        type: 'error',
        message: `Potential short circuit on ${board.id}: power net is connected to GND.`,
        compIds: [board.id],
      });
    }
  });

  // LED should not be directly connected between two MCU GPIO pins in this simulator.
  const leds = (components || []).filter((c) => String(c.type || '').toLowerCase() === 'wokwi-led');
  leds.forEach((led) => {
    const anode = `${led.id}:A`;
    const cathode = `${led.id}:K`;
    const anodeN = [...(graph.get(anode) || [])];
    const cathodeN = [...(graph.get(cathode) || [])];

    const anodeMcu = anodeN.filter(isMcuDigitalEndpoint);
    const cathodeMcu = cathodeN.filter(isMcuDigitalEndpoint);

    if (anodeMcu.length > 0 && cathodeMcu.length > 0) {
      const involved = new Set([led.id]);
      [...anodeMcu, ...cathodeMcu].forEach((ep) => involved.add(String(ep).split(':')[0]));
      errors.push({
        type: 'error',
        message: `Invalid LED wiring on ${led.id}: anode and cathode are tied to MCU GPIO pins. Connect LED through a resistor to VCC/GND instead of pin-to-pin drive.`,
        compIds: [...involved],
      });
    }
  });

  return errors;
}

export default function SimulatorPage() {
  const { isAuthenticated, user, loading: authLoading } = useAuth()
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
  const [projectFiles, setProjectFiles] = useState([])
  const [openCodeTabs, setOpenCodeTabs] = useState([])
  const [activeCodeFileId, setActiveCodeFileId] = useState('')
  const [showCodeExplorer, setShowCodeExplorer] = useState(true)
  const suppressCodeSyncRef = useRef(false)
  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const [isPaletteHovered, setIsPaletteHovered] = useState(false)
  const [panelWidth, setPanelWidth] = useState(470)
  const [explorerWidth, setExplorerWidth] = useState(190)
  const [isDragging, setIsDragging] = useState(false)
  const [isExplorerDragging, setIsExplorerDragging] = useState(false)
  // Palette redesign state
  const [paletteViewMode, setPaletteViewMode] = useState('grid') // 'list' | 'grid'
  const [favoriteComponents, setFavoriteComponents] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('openhw_fav_components') || '[]')); }
    catch { return new Set(); }
  })
  const [activeGroupFilter, setActiveGroupFilter] = useState('All')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [showFavorites, setShowFavorites] = useState(true)
  const [paletteContextMenu, setPaletteContextMenu] = useState(null) // { x, y, item }
  const [selectedPaletteItem, setSelectedPaletteItem] = useState(null) // item for description panel
  const [showComponentDesc, setShowComponentDesc] = useState(true) // description panel visible
  const [showCreateComponentModal, setShowCreateComponentModal] = useState(false)
  const paletteContextMenuRef = useRef(null)
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [showCanvasMenu, setShowCanvasMenu] = useState(false)
  const [showConnectionsPanel, setShowConnectionsPanel] = useState(true)
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
  const [validationToast, setValidationToast] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isCompiling, setIsCompiling] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [pinStates, setPinStates] = useState({})
  const [neopixelData, setNeopixelData] = useState({})
  const [oopStates, setOopStates] = useState({});
  const [serialHistory, setSerialHistory] = useState([]);
  const [serialInput, setSerialInput] = useState('');
  const [serialPaused, setSerialPaused] = useState(false);
  const [serialViewMode, setSerialViewMode] = useState('monitor'); // 'monitor' | 'plotter'
  const [serialBoardFilter, setSerialBoardFilter] = useState('all');
  const [serialBaudRate, setSerialBaudRate] = useState('9600');
  const [hardwareBoardId, setHardwareBoardId] = useState('');
  const [hardwareSerialTargetId, setHardwareSerialTargetId] = useState(null);
  const [hardwareStatus, setHardwareStatus] = useState('Not connected');
  const serialOutputRef = useRef(null);
  const lastHardwareStatusRef = useRef('');
  const hardwareSerialTargetRef = useRef(null);

  const {
    consoleEntries,
    isConsoleOpen,
    setIsConsoleOpen,
    consoleHeight,
    setConsoleHeight,
    appendConsoleEntry,
    clearConsoleEntries,
    downloadConsoleLog,
  } = useSimulationConsole();

  // Plotter State
  const [plotData, setPlotData] = useState([]);
  const [selectedPlotPins, setSelectedPlotPins] = useState(['13', 'A0']);
  const plotterCanvasRef = useRef(null);
  const [plotterPaused, setPlotterPaused] = useState(false);

  const serialBoardOptions = useMemo(() => {
    const ids = components
      .filter(c => /(arduino|esp32|stm32|rp2040|pico)/i.test(c.type))
      .map(c => c.id)
      .sort((a, b) => a.localeCompare(b));
    if (hardwareBoardId && !ids.includes(hardwareBoardId)) ids.push(hardwareBoardId);
    if (hardwareSerialTargetId && !ids.includes(hardwareSerialTargetId)) ids.push(hardwareSerialTargetId);
    return ['all', ...ids];
  }, [components, hardwareBoardId, hardwareSerialTargetId]);

  const serialBoardLabels = useMemo(() => {
    const labels = { all: 'All Boards' };
    serialBoardOptions.forEach((id) => {
      if (id === 'all') return;
      if (id.startsWith('hw:')) {
        labels[id] = `${id.slice(3)} (WebSerial)`;
      } else {
        labels[id] = id;
      }
    });
    return labels;
  }, [serialBoardOptions]);

  const serialBoardMap = useMemo(() => {
    const m = new Map();
    components.forEach((c) => m.set(c.id, c));
    return m;
  }, [components]);

  const selectedSerialBoardKind = useMemo(() => {
    if (serialBoardFilter !== 'all') {
      const comp = serialBoardMap.get(serialBoardFilter);
      if (comp) return normalizeBoardKind(comp.type);
    }
    return normalizeBoardKind(board);
  }, [serialBoardFilter, serialBoardMap, board]);

  const serialBaudOptions = useMemo(() => {
    return BOARD_BAUD_PRESETS[selectedSerialBoardKind] || BOARD_BAUD_PRESETS.arduino_uno;
  }, [selectedSerialBoardKind]);

  const projectFileMap = useMemo(() => {
    const m = new Map();
    projectFiles.forEach((f) => m.set(f.id, f));
    return m;
  }, [projectFiles]);

  const activeCodeFile = useMemo(() => projectFileMap.get(activeCodeFileId) || null, [projectFileMap, activeCodeFileId]);

  const boardComponents = useMemo(() => components.filter(c => /(arduino|esp32|stm32|rp2040|pico)/i.test(c.type)), [components]);
  const webSerialSupported = typeof navigator !== 'undefined' && 'serial' in navigator;

  useEffect(() => {
    if (boardComponents.length === 0) {
      setHardwareBoardId('');
      return;
    }
    const hasCurrent = hardwareBoardId && boardComponents.some((b) => b.id === hardwareBoardId);
    if (!hasCurrent) setHardwareBoardId(boardComponents[0].id);
  }, [boardComponents, hardwareBoardId]);

  // PNG Export State
  const [isExporting, setIsExporting] = useState(false);

  // View Panel State
  const [showViewPanel, setShowViewPanel] = useState(false);
  const [viewPanelSection, setViewPanelSection] = useState(null); // null | 'schematic' | 'components'
  const [schematicLoading, setSchematicLoading] = useState(false);
  const [schematicDataUrl, setSchematicDataUrl] = useState(null);

  const workerRef = useRef(null)
  const lastCompiledRef = useRef(null)
  const neopixelRefs = useRef({})

  const serialPlotBufferRef = useRef('');
  const serialPlotLabelsRef = useRef([]);
  const latestParsedSerialRef = useRef([]);

  const canvasRef = useRef(null)
  const svgRef = useRef(null)
  const viewPanelRef = useRef(null)
  const schematicSvgRef = useRef(null)
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
    appendConsoleEntry('info', `ZIP upload started: ${file.name}`, 'zip');
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
        appendConsoleEntry('error', 'ZIP upload failed: required files are missing.', 'zip');
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
        appendConsoleEntry('info', `ZIP submitted to admin: ${manifest.type}`, 'zip');
      } catch (submitErr) {
        // Network unavailable — queue for later submission when back online
        await enqueueComponent(submitPayload);
        offlineQueued = true;
        appendConsoleEntry('warn', `Offline mode: queued ${manifest.type} for later submission.`, 'zip');
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

      const uiComponent = resolveUiExport(exportsUI);
      const contextMenu = exportsUI[Object.keys(exportsUI).find(k => k.toLowerCase().includes('contextmenu'))];

      if (uiComponent) {
        const newCatItem = { ...manifest };
        delete newCatItem.pins;
        delete newCatItem.group;

        const groupName = normalizeGroupName(manifest.group);
        let group = LOCAL_CATALOG.find(g => g.group === groupName);
        if (!group) {
          group = { group: groupName, items: [] };
          LOCAL_CATALOG.push(group);
        }
        group.items = group.items.filter(i => i.type !== manifest.type);
        group.items.push(newCatItem);
        sortCatalog(LOCAL_CATALOG);

        COMPONENT_REGISTRY[manifest.type] = {
          manifest,
          UI: uiComponent,
          BOUNDS: exportsUI.BOUNDS,
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
          appendConsoleEntry('info', `Component injected successfully: ${manifest.label}`, 'zip');
          alert(`Successfully submitted to admin AND injected ${manifest.label} into your local Sandbox Memory!`);
        } else if (offlineQueued) {
          appendConsoleEntry('warn', `Component injected locally while offline: ${manifest.label}`, 'zip');
          alert(`You are offline. "${manifest.label}" has been injected locally and will be submitted to the admin automatically when you reconnect.`);
        }
      }
    } catch (e) {
      appendConsoleEntry('error', `ZIP processing failed: ${e.message}`, 'zip');
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

  // ── Auto-load component from Component Editor ("Test in Simulator") ────────
  useEffect(() => {
    const raw = localStorage.getItem('openhw_pending_component');
    if (!raw) return;
    localStorage.removeItem('openhw_pending_component');
    try {
      const { data, name, label } = JSON.parse(raw);
      fetch(data)
        .then(r => r.blob())
        .then(blob => {
          const file = new File([blob], `${name || 'component'}.zip`, { type: 'application/zip' });
          handleUploadZip({ target: { files: [file] } });
        })
        .catch(err => console.error('[ComponentEditor] Failed to load pending component:', err));
    } catch (e) {
      console.error('[ComponentEditor] Could not parse pending component data:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setProjectFiles(Array.isArray(latest.projectFiles) ? latest.projectFiles : []);
      setOpenCodeTabs(Array.isArray(latest.openCodeTabs) ? latest.openCodeTabs : []);
      setActiveCodeFileId(latest.activeCodeFileId || '');
      syncNextIds(latest.components, latest.connections);
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
        projectFiles,
        openCodeTabs,
        activeCodeFileId,
        owner,
      });
    }, 2500);

    return () => clearTimeout(autoSaveTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [components, wires, code, board, projectFiles, openCodeTabs, activeCodeFileId]);

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

      const uiComponent = resolveUiExport(exportsUI);
      if (!uiComponent) {
        console.warn('[SimulatorPage] Preview: UI component could not be evaluated.');
        return;
      }

      // Inject into catalog & registry
      const newCatItem = { ...manifest };
      delete newCatItem.pins;
      delete newCatItem.group;

      const groupName = normalizeGroupName(manifest.group);
      let group = LOCAL_CATALOG.find(g => g.group === groupName);
      if (!group) {
        group = { group: groupName, items: [] };
        LOCAL_CATALOG.push(group);
      }
      group.items = group.items.filter(i => i.type !== compType);
      group.items.push(newCatItem);
      sortCatalog(LOCAL_CATALOG);

      COMPONENT_REGISTRY[compType] = { manifest, UI: uiComponent, BOUNDS: exportsUI.BOUNDS, logicCode: transpileLogic };
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

            const uiComponent = resolveUiExport(exportsUI);
            if (!uiComponent) continue;

            // Inject into catalog
            const newCatItem = { ...manifest };
            delete newCatItem.pins;
            delete newCatItem.group;

            const groupName = normalizeGroupName(manifest.group);
            let group = LOCAL_CATALOG.find(g => g.group === groupName);
            if (!group) {
              group = { group: groupName, items: [] };
              LOCAL_CATALOG.push(group);
            }
            group.items = group.items.filter(i => i.type !== compType);
            group.items.push(newCatItem);
            sortCatalog(LOCAL_CATALOG);

            COMPONENT_REGISTRY[compType] = {
              manifest,
              UI: uiComponent,
              BOUNDS: exportsUI.BOUNDS,
              ContextMenu: exportsUI[Object.keys(exportsUI).find(k => k.toLowerCase().includes('contextmenu'))],
              contextMenuDuringRun: !!(exportsUI.contextMenuDuringRun || manifest.contextMenuDuringRun),
              contextMenuOnlyDuringRun: !!(exportsUI.contextMenuOnlyDuringRun || manifest.contextMenuOnlyDuringRun),
              logicCode: transpileLogic,
              uiRaw: uiStr,
              logicRaw: logicStr
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

  const onMouseDownConsoleResize = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startHeight = consoleHeight;

    const onMouseMove = (moveEvent) => {
      const delta = startY - moveEvent.clientY;
      const newHeight = Math.max(140, Math.min(540, startHeight + delta));
      setConsoleHeight(newHeight);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [consoleHeight, setConsoleHeight]);

  const onMouseDownExplorerResize = useCallback((e) => {
    e.preventDefault();
    setIsExplorerDragging(true);
  }, []);

  useEffect(() => {
    if (!isExplorerDragging) return;
    const onMouseMove = (e) => {
      const rightPanelStart = window.innerWidth - panelWidth;
      const newWidth = e.clientX - rightPanelStart;
      setExplorerWidth(Math.max(120, Math.min(panelWidth - 100, newWidth)));
    };
    const onMouseUp = () => setIsExplorerDragging(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isExplorerDragging, panelWidth]);

  // ── Close palette context menu on outside click ──────────────────────────
  useEffect(() => {
    if (!paletteContextMenu) return;
    const close = () => { setPaletteContextMenu(null); setIsPaletteHovered(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [paletteContextMenu]);

  // ── Close View panel on outside click ──────────────────────────────────────
  useEffect(() => {
    if (!showViewPanel) return;
    const close = (e) => { if (viewPanelRef.current && !viewPanelRef.current.contains(e.target)) setShowViewPanel(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showViewPanel]);

  // ── Close Filter dropdown on outside click ──────────────────────────────────
  useEffect(() => {
    if (!showFilterDropdown) return;
    const close = (e) => { if (!e.target.closest('.filter-dropdown-container')) setShowFilterDropdown(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showFilterDropdown]);

  // ── Load Wokwi bundle ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!customElements.get('wokwi-7segment') && !document.getElementById('wokwi-bundle')) {
      const s = document.createElement('script')
      s.id = 'wokwi-bundle'
      s.src = 'https://unpkg.com/@wokwi/elements@0.48.3/dist/wokwi-elements.bundle.js'
      document.head.appendChild(s)
    }
  }, [])

  // ── Validation toast auto-dismiss ───────────────────────────────────────────
  useEffect(() => {
    if (!validationToast) return undefined;
    const timer = setTimeout(() => setValidationToast(null), 10000);
    return () => clearTimeout(timer);
  }, [validationToast]);

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

  useEffect(() => {
    if (serialBoardFilter === 'all') return;
    if (!serialBoardOptions.includes(serialBoardFilter)) {
      setSerialBoardFilter(serialBoardOptions.length > 1 ? serialBoardOptions[1] : 'all');
    }
  }, [serialBoardFilter, serialBoardOptions]);

  useEffect(() => {
    setProjectFiles(prev => {
      const next = [...prev];
      const byId = new Map(next.map(f => [f.id, f]));

      // Remove board files for boards no longer present
      const validBoardIds = new Set(boardComponents.map(b => b.id));
      const pruned = next.filter(f => {
        const m = f.path.match(/^project\/([^/]+)\//);
        if (!m) return true;
        return validBoardIds.has(m[1]);
      });

      let changed = pruned.length !== next.length;
      const result = [...pruned];
      const resultIds = new Set(result.map(f => f.id));

      const upsert = (fileObj) => {
        const idx = result.findIndex(f => f.id === fileObj.id);
        if (idx === -1) {
          result.push(fileObj);
          changed = true;
        } else {
          const existing = result[idx];
          if (existing.path !== fileObj.path || existing.name !== fileObj.name || existing.boardId !== fileObj.boardId || existing.boardKind !== fileObj.boardKind) {
            result[idx] = { ...existing, ...fileObj, content: existing.content, dirty: existing.dirty };
            changed = true;
          }
        }
      };

      boardComponents.forEach((bc) => {
        const kind = normalizeBoardKind(bc.type);
        const basePath = `project/${bc.id}`;
        const files = [
          { path: `${basePath}/${bc.id}.ino`, type: 'code', content: createDefaultMainCode(kind, bc.id) },
        ];
        files.forEach((ff) => {
          upsert({
            id: ff.path,
            path: ff.path,
            name: ff.path.split('/').pop(),
            kind: ff.type,
            boardId: bc.id,
            boardKind: kind,
            content: ff.content,
            dirty: false,
          });
        });
      });

      const libraries = (libInstalled || []).map(l => l?.library?.name || l?.name).filter(Boolean);
      const diagramJson = JSON.stringify({
        board,
        components: components.map(c => ({ id: c.id, type: c.type, attrs: c.attrs || {} })),
        connections: wires.map(w => ({ id: w.id, from: w.from, to: w.to })),
      }, null, 2);

      const rootFiles = [
        { id: 'project/diagram.json', path: 'project/diagram.json', name: 'diagram.json', kind: 'root', content: diagramJson, dirty: false },
        { id: 'project/diagram.png', path: 'project/diagram.png', name: 'diagram.png', kind: 'root', content: '[binary png placeholder]', dirty: false },
        { id: 'project/library.txt', path: 'project/library.txt', name: 'library.txt', kind: 'root', content: libraries.join('\n'), dirty: false },
      ];

      rootFiles.forEach((rf) => {
        const idx = result.findIndex(f => f.id === rf.id);
        if (idx === -1) {
          result.push(rf);
          changed = true;
        } else if (result[idx].content !== rf.content) {
          // keep manual edits only for library.txt; diagram files are generated
          if (rf.id === 'project/library.txt' || rf.id === 'project/diagram.json') {
            result[idx] = { ...result[idx], content: rf.content, dirty: false };
            changed = true;
          }
        }
      });

      return changed ? result : prev;
    });
  }, [boardComponents, board, components, wires, libInstalled]);

  useEffect(() => {
    if (projectFiles.length === 0) return;
    if (activeCodeFileId && projectFileMap.has(activeCodeFileId)) return;

    const firstCodeFile = projectFiles.find(f => f.kind === 'code') || projectFiles[0];
    if (!firstCodeFile) return;

    setActiveCodeFileId(firstCodeFile.id);
    setOpenCodeTabs(prev => prev.includes(firstCodeFile.id) ? prev : [...prev, firstCodeFile.id]);
  }, [projectFiles, activeCodeFileId, projectFileMap]);

  useEffect(() => {
    if (!activeCodeFile) return;
    suppressCodeSyncRef.current = true;
    setCode(activeCodeFile.content || '');
  }, [activeCodeFile?.id]);

  useEffect(() => {
    if (!activeCodeFileId) return;
    if (suppressCodeSyncRef.current) {
      suppressCodeSyncRef.current = false;
      return;
    }

    setProjectFiles(prev => prev.map(f => {
      if (f.id !== activeCodeFileId) return f;
      if (f.content === code) return f;
      return { ...f, content: code, dirty: true };
    }));
  }, [code, activeCodeFileId]);

  useEffect(() => {
    const nextDefault = BOARD_DEFAULT_BAUD[selectedSerialBoardKind] || BOARD_DEFAULT_BAUD.arduino_uno;
    setSerialBaudRate(nextDefault);
  }, [selectedSerialBoardKind]);

  // ── Plotter Rendering Loop ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = plotterCanvasRef.current;
    if (!canvas || codeTab !== 'serial' || serialViewMode !== 'plotter' || plotData.length === 0 || selectedPlotPins.length === 0) return;
    if (plotterPaused) return; // Freeze canvas when paused

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const Y_LABEL_W = 35;

    const scopedPlotData = serialBoardFilter === 'all'
      ? plotData
      : plotData.filter(pt => pt.boardId === serialBoardFilter);

    if (scopedPlotData.length === 0) return;

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
      scopedPlotData.forEach(pt => {
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
        const pts = scopedPlotData.slice(-maxPts);
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
      const pts = scopedPlotData.slice(-maxPts);
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
  }, [plotData, codeTab, selectedPlotPins, plotterPaused, serialViewMode, serialBoardFilter]);

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
      try { localStorage.setItem('openhw_fav_components', JSON.stringify([...next])); } catch { }
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

  const openCodeFile = useCallback((fileId) => {
    setOpenCodeTabs(prev => prev.includes(fileId) ? prev : [...prev, fileId]);
    setActiveCodeFileId(fileId);
  }, []);

  const closeCodeTab = useCallback((fileId) => {
    setOpenCodeTabs(prev => {
      const next = prev.filter(id => id !== fileId);
      if (activeCodeFileId === fileId) {
        setActiveCodeFileId(next[next.length - 1] || '');
      }
      return next;
    });
  }, [activeCodeFileId]);

  const saveCodeFile = useCallback((fileId) => {
    setProjectFiles(prev => prev.map(f => f.id === fileId ? { ...f, dirty: false } : f));
  }, []);

  const duplicateCodeFile = useCallback((fileId) => {
    setProjectFiles(prev => {
      const source = prev.find(f => f.id === fileId);
      if (!source) return prev;
      const ext = fileExt(source.name);
      const base = ext ? source.name.slice(0, -ext.length) : source.name;
      let name = `${base}_copy${ext}`;
      let path = `${source.path.substring(0, source.path.lastIndexOf('/') + 1)}${name}`;
      let i = 2;
      while (prev.some(f => f.path === path)) {
        name = `${base}_copy${i}${ext}`;
        path = `${source.path.substring(0, source.path.lastIndexOf('/') + 1)}${name}`;
        i++;
      }
      const dup = { ...source, id: path, path, name, dirty: true };
      return [...prev, dup];
    });
  }, []);

  const renameCodeFile = useCallback((fileId, nextName) => {
    const cleaned = String(nextName || '').trim();
    if (!cleaned) return;
    const source = projectFileMap.get(fileId);
    if (!source) return;
    const parent = source.path.substring(0, source.path.lastIndexOf('/') + 1);
    const nextPath = `${parent}${cleaned}`;

    setProjectFiles(prev => {
      if (prev.some(f => f.id !== fileId && f.path === nextPath)) return prev;
      return prev.map(f => f.id === fileId ? { ...f, id: nextPath, path: nextPath, name: cleaned, dirty: true } : f);
    });
    setOpenCodeTabs(prev => prev.map(id => id === fileId ? nextPath : id));
    if (activeCodeFileId === fileId) {
      setActiveCodeFileId(nextPath);
    }
  }, [activeCodeFileId, projectFileMap]);

  const deleteCodeFile = useCallback((fileId) => {
    setProjectFiles(prev => prev.filter(f => f.id !== fileId));
    setOpenCodeTabs(prev => prev.filter(id => id !== fileId));
    if (activeCodeFileId === fileId) {
      const next = openCodeTabs.find(id => id !== fileId) || '';
      setActiveCodeFileId(next);
    }
  }, [activeCodeFileId, openCodeTabs]);

  const downloadCodeFile = useCallback((fileId) => {
    const file = projectFileMap.get(fileId);
    if (!file) return;
    const blob = new Blob([file.content || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [projectFileMap]);

  const getBoardMainCode = useCallback((boardId) => {
    const preferred = `project/${boardId}/${boardId}.ino`;
    const prefFile = projectFileMap.get(preferred);
    if (prefFile && prefFile.content) return prefFile.content;

    const ino = projectFiles.find(f => f.path.startsWith(`project/${boardId}/`) && fileExt(f.path) === '.ino');
    if (ino?.content) return ino.content;

    return code;
  }, [projectFileMap, projectFiles, code]);

  const getBoardCompileFiles = useCallback((boardId) => {
    const allowed = new Set(['.ino', '.h', '.hpp', '.c', '.cpp']);
    const allFiles = projectFiles
      .filter((f) => f.path.startsWith(`project/${boardId}/`))
      .filter((f) => allowed.has(fileExt(f.path)))
      .map((f) => ({ name: f.name, content: f.content || '' }));

    const preferredMainName = `${boardId}.ino`;
    const main = allFiles.find((f) => f.name === preferredMainName)
      || allFiles.find((f) => fileExt(f.name) === '.ino')
      || null;

    const files = allFiles.filter((f) => !(main && f.name === main.name));

    return {
      mainCode: main?.content || getBoardMainCode(boardId) || code,
      sketchName: boardId,
      files,
    };
  }, [projectFiles, getBoardMainCode, code]);

  const createCodeFile = useCallback((requestedName, openAfterCreate = false) => {
    const cleaned = String(requestedName || '').trim();
    if (!cleaned) return null;

    const activePath = activeCodeFile?.path || '';
    const parent = activePath.includes('/')
      ? activePath.substring(0, activePath.lastIndexOf('/'))
      : 'project';

    const rawExt = fileExt(cleaned);
    const fileNameBase = rawExt ? cleaned.slice(0, -rawExt.length) : cleaned;
    const ext = rawExt || '.ino';
    const safeBase = fileNameBase.replace(/[^a-zA-Z0-9._-]/g, '_') || 'new_file';
    const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '') || '.ino';

    let candidate = `${safeBase}${safeExt}`;
    let candidatePath = `${parent}/${candidate}`;
    let i = 2;

    while (projectFileMap.has(candidatePath)) {
      candidate = `${safeBase}_${i}${safeExt}`;
      candidatePath = `${parent}/${candidate}`;
      i++;
    }

    const boardMatch = candidatePath.match(/^project\/([^/]+)\//);
    const content = safeExt === '.h'
      ? `#pragma once\n\n// ${safeBase} declarations\n`
      : safeExt === '.cpp'
        ? `#include "${safeBase}.h"\n\n// ${safeBase} implementation\n`
        : safeExt === '.ino'
          ? `void setup() {\n}\n\nvoid loop() {\n}\n`
          : '';

    const nextFile = {
      id: candidatePath,
      path: candidatePath,
      name: candidate,
      kind: 'code',
      boardId: boardMatch ? boardMatch[1] : undefined,
      content,
      dirty: true,
    };

    setProjectFiles(prev => [...prev, nextFile]);
    if (openAfterCreate) {
      setOpenCodeTabs(prev => prev.includes(candidatePath) ? prev : [...prev, candidatePath]);
      setActiveCodeFileId(candidatePath);
    }

    return candidatePath;
  }, [activeCodeFile, projectFileMap]);

  const createCodeTab = useCallback((requestedName) => {
    return createCodeFile(requestedName, true);
  }, [createCodeFile]);

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
    await saveProject({ id, name, board, components, connections: wires, code, projectFiles, openCodeTabs, activeCodeFileId, owner });
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
    setProjectFiles([]);
    setOpenCodeTabs([]);
    setActiveCodeFileId('');
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
    setProjectFiles(Array.isArray(proj.projectFiles) ? proj.projectFiles : []);
    setOpenCodeTabs(Array.isArray(proj.openCodeTabs) ? proj.openCodeTabs : []);
    setActiveCodeFileId(proj.activeCodeFileId || '');
    syncNextIds(proj.components, proj.connections);
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
    const data = { name: currentProjectName, board, components, connections: wires, code, projectFiles, openCodeTabs, activeCodeFileId, exportedAt: new Date().toISOString() };
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
      setProjectFiles(Array.isArray(json.projectFiles) ? json.projectFiles : []);
      setOpenCodeTabs(Array.isArray(json.openCodeTabs) ? json.openCodeTabs : []);
      setActiveCodeFileId(json.activeCodeFileId || '');
      syncNextIds(json.components, json.connections);
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

  const runCircuitValidation = useCallback(() => {
    try {
      const errs = validateCircuitLocally(components, wires);
      if (errs.length > 0) {
        setValidationErrors(errs);
        setShowValidation(true);
        setValidationToast({
          title: `Circuit validation failed (${errs.length})`,
          reasons: errs.slice(0, 3).map((e) => e.message),
        });
      } else {
        setValidationErrors([]);
        setValidationToast(null);
      }
      return errs.length === 0;
    } catch (err) {
      console.warn('[Validation] Engine failed, continuing run:', err);
      return true;
    }
  }, [components, wires]);

  const getSerialTimestamp = () => {
    const now = new Date();
    return now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0');
  };

  const parseSerialForPlotter = useCallback((chunk) => {
    serialPlotBufferRef.current += chunk;
    const lines = serialPlotBufferRef.current.split('\n');
    if (lines.length <= 1) return;

    const completeLines = lines.slice(0, -1);
    serialPlotBufferRef.current = lines[lines.length - 1];

    completeLines.forEach((line) => {
      const parts = line.split(/[,\s\t]+/).filter(Boolean);
      if (parts.length === 0) return;

      const isNumeric = parts.every((p) => !isNaN(parseFloat(p)));
      if (!isNumeric) {
        serialPlotLabelsRef.current = parts;
        setSelectedPlotPins((prev) => {
          const nextPins = [...prev];
          parts.forEach((lbl) => { if (!nextPins.includes(lbl)) nextPins.push(lbl); });
          return nextPins;
        });
        return;
      }

      latestParsedSerialRef.current = parts.map((p) => parseFloat(p));
      if (serialPlotLabelsRef.current.length < parts.length) {
        for (let i = serialPlotLabelsRef.current.length; i < parts.length; i++) {
          serialPlotLabelsRef.current.push(`SVar${i}`);
        }
      }

      setSelectedPlotPins((prev) => {
        let changed = false;
        const nextPins = [...prev];
        serialPlotLabelsRef.current.slice(0, parts.length).forEach((lbl) => {
          if (!nextPins.includes(lbl)) {
            nextPins.push(lbl);
            changed = true;
          }
        });
        return changed ? nextPins : prev;
      });
    });
  }, []);

  const pushSerialRxChunk = useCallback((chunk, boardId = 'default', source = 'sim') => {
    parseSerialForPlotter(chunk);
    const ts = getSerialTimestamp();
    setSerialHistory((prev) => {
      let next = prev.length > 2000 ? prev.slice(prev.length - 1800) : [...prev];
      if (next.length > 0) {
        const last = next[next.length - 1];
        if (last.dir === 'rx' && last.boardId === boardId && last.source === source && !last.text.endsWith('\n')) {
          next[next.length - 1] = { ...last, text: last.text + chunk };
          return next;
        }
      }
      return [...next, { dir: 'rx', text: chunk, ts, boardId, source }];
    });
  }, [parseSerialForPlotter]);

  const pushSerialTxLine = useCallback((text, boardId = 'all', source = 'sim') => {
    setSerialHistory((prev) => [...prev, { dir: 'tx', text, ts: getSerialTimestamp(), boardId, source }]);
  }, []);

  const handleHardwareBoardChange = useCallback((nextBoardId) => {
    setHardwareBoardId(nextBoardId);
    if (nextBoardId) setSelected(nextBoardId);
  }, [setSelected]);

  const resolveBoardHex = useCallback(async (boardComp) => {
    if (!boardComp) throw new Error('No board selected for upload.');
    const kind = normalizeBoardKind(boardComp.type);
    const boardHex = boardComp?.attrs?.firmwareHex || boardComp?.attrs?.hex;
    if (typeof boardHex === 'string' && boardHex.trim()) return boardHex;

    const compileUnit = getBoardCompileFiles(boardComp.id);
    const sourceCode = getBoardMainCode(boardComp.id) || code;
    const cacheKeyBoard = `${kind}:${boardComp.id}`;
    const cacheSource = [
      compileUnit.mainCode || sourceCode,
      ...compileUnit.files.map((f) => `${f.name}\n${f.content || ''}`),
      BOARD_FQBN[kind] || BOARD_FQBN.arduino_uno,
    ].join('\n/*__SPLIT__*/\n');

    let compiled = await getCachedHex(cacheSource, cacheKeyBoard);
    if (!compiled) {
      compiled = await compileCode({
        code: compileUnit.mainCode || sourceCode,
        files: compileUnit.files,
        sketchName: compileUnit.sketchName,
        fqbn: BOARD_FQBN[kind] || BOARD_FQBN.arduino_uno,
      });
      setCachedHex(cacheSource, cacheKeyBoard, compiled);
    }
    return compiled.hex;
  }, [code, getBoardCompileFiles, getBoardMainCode]);

  const {
    hardwareAvailablePorts,
    showAllHardwarePorts,
    setShowAllHardwarePorts,
    isLoadingHardwarePorts,
    hardwareBaudRate,
    setHardwareBaudRate,
    hardwareResetMethod,
    setHardwareResetMethod,
    hardwarePortPath,
    setHardwarePortPath,
    resolvedHardwarePort,
    refreshHardwarePorts,
    uploadToHardware,
    isUploadingHardware,
  } = useHardwareFlashing({
    hardwareBoardId,
    boardComponents,
    resolveBoardHex,
    normalizeBoardKind,
    boardFqbn: BOARD_FQBN,
    flashFirmware,
    pushSerialTxLine,
    pushSerialRxChunk,
    setHardwareStatus,
  });

  const {
    hardwareConnected,
    hardwareConnecting,
    connectHardwareSerial,
    disconnectHardwareSerial,
    sendHardwareSerialLine,
  } = useWebSerialHardware({
    hardwareBoardId,
    hardwareSerialTargetRef,
    boardComponents,
    board,
    hardwareBaudRate,
    showAllHardwarePorts,
    normalizeBoardKind,
    boardDefaultBaud: BOARD_DEFAULT_BAUD,
    pushSerialRxChunk,
    pushSerialTxLine,
    setHardwareStatus,
  });

  useEffect(() => {
    if (!hardwareConnected) {
      setHardwareSerialTargetId(null);
      hardwareSerialTargetRef.current = null;
      return;
    }

    const deviceLabel = String(resolvedHardwarePort || '').trim();
    const nextTarget = deviceLabel
      ? `hw:${deviceLabel}`
      : (hardwareBoardId ? `hw:${hardwareBoardId}` : 'hw:connected');

    setHardwareSerialTargetId(nextTarget);
    hardwareSerialTargetRef.current = nextTarget;
  }, [hardwareConnected, resolvedHardwarePort, hardwareBoardId]);

  const handleUploadToHardware = useCallback(async () => {
    // Disconnect browser Web Serial first to release COM port lock for arduino-cli upload.
    if (hardwareConnected) {
      setHardwareStatus('Disconnecting Web Serial before flash...');
      appendConsoleEntry('info', 'Disconnecting Web Serial to release port for flashing...', 'hardware');
      await disconnectHardwareSerial();
    }

    await uploadToHardware();
  }, [hardwareConnected, disconnectHardwareSerial, uploadToHardware, setHardwareStatus, appendConsoleEntry]);

  const handleRun = async () => {
    try {
      appendConsoleEntry('info', 'Run requested.', 'simulator');
      if (!runCircuitValidation()) {
        appendConsoleEntry('warn', 'Run blocked: validation errors found.', 'simulator');
        return;
      }

      setIsRunning(true);
      setIsCompiling(true);
      const boardHexMap = {};
      const boardBaudMap = {};
      const programmableBoards = components.filter(c => /(arduino|esp32|stm32|rp2040|pico)/i.test(c.type));
      let result = null;

      if (programmableBoards.length > 0) {
        for (const boardComp of programmableBoards) {
          const kind = normalizeBoardKind(boardComp.type);
          boardBaudMap[boardComp.id] = Number(BOARD_DEFAULT_BAUD[kind] || BOARD_DEFAULT_BAUD.arduino_uno);

          const boardHex = boardComp?.attrs?.firmwareHex || boardComp?.attrs?.hex;
          if (typeof boardHex === 'string' && boardHex.trim()) {
            boardHexMap[boardComp.id] = boardHex;
            if (!result) result = { hex: boardHex };
            continue;
          }

          const sourceCode = getBoardMainCode(boardComp.id) || code;
          const compileUnit = getBoardCompileFiles(boardComp.id);
          const cacheKeyBoard = `${kind}:${boardComp.id}`;
          const cacheSource = [
            compileUnit.mainCode || sourceCode,
            ...compileUnit.files.map((f) => `${f.name}\n${f.content || ''}`),
          ].join('\n/*__SPLIT__*/\n');

          let compiled = await getCachedHex(cacheSource, cacheKeyBoard);
          if (compiled) {
            logSerial(`Using cached compilation for ${boardComp.id}...`);
          } else {
            logSerial(`Compiling ${boardComp.id}...`);
            compiled = await compileCode({
              code: compileUnit.mainCode || sourceCode,
              files: compileUnit.files,
              sketchName: compileUnit.sketchName,
            });
            setCachedHex(cacheSource, cacheKeyBoard, compiled);
          }

          boardHexMap[boardComp.id] = compiled.hex;
          if (!result) result = compiled;
        }
      }

      if (!result) {
        const cached = await getCachedHex(code, board);
        if (cached) {
          logSerial('Using locally cached compilation (offline cache)...');
          result = cached;
        } else {
          logSerial('Compiling...');
          result = await compileCode(code);
          setCachedHex(code, board, result);
        }
      }

      lastCompiledRef.current = { code, board, result };
      setIsCompiling(false);
      logSerial('Compiled! Connecting to emulator...');

      // Load Web Worker
      const worker = new Worker(new URL('../../worker/simulation.worker.ts', import.meta.url), { type: 'module' });
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
            const newPt = { time: Date.now(), pins: msg.pins, analog: msg.analog || [], serialVars, boardId: msg.boardId || 'default' };
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
          pushSerialRxChunk(msg.data, msg.boardId || 'default', 'sim');
        }
      };

      worker.onerror = (err) => {
        console.error('Worker Error:', err);
        appendConsoleEntry('error', `Worker error: ${err?.message || 'Unknown error'}`, 'simulator');
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
        customLogics: customLogics,
        boardHexMap: Object.keys(boardHexMap).length > 0 ? boardHexMap : undefined,
        boardBaudMap: Object.keys(boardBaudMap).length > 0 ? boardBaudMap : undefined,
        baudRate: Number(serialBaudRate || BOARD_DEFAULT_BAUD[selectedSerialBoardKind] || BOARD_DEFAULT_BAUD.arduino_uno),
      });
    } catch (err) {
      setIsRunning(false);
      setIsCompiling(false);
      appendConsoleEntry('error', `Run failed: ${err?.message || 'Unknown error'}`, 'simulator');
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
    appendConsoleEntry('info', 'Simulation stopped.', 'simulator');
  };

  useEffect(() => {
    if (!hardwareStatus) return;
    if (lastHardwareStatusRef.current === hardwareStatus) return;
    lastHardwareStatusRef.current = hardwareStatus;

    const statusLower = String(hardwareStatus).toLowerCase();
    const level = statusLower.includes('failed') || statusLower.includes('lost') ? 'error' : 'info';
    appendConsoleEntry(level, hardwareStatus, 'hardware');
  }, [hardwareStatus, appendConsoleEntry]);

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

  const sendSerialInput = useCallback(() => {
    const txt = serialInput.trim();
    if (!txt) return;

    if (workerRef.current && isRunning) {
      workerRef.current.postMessage({
        type: 'SERIAL_INPUT',
        data: txt + '\n',
        targetBoardId: serialBoardFilter !== 'all' ? serialBoardFilter : undefined,
        baudRate: serialBaudRate,
      });
      pushSerialTxLine(txt, serialBoardFilter !== 'all' ? serialBoardFilter : 'all', 'sim');
      setSerialInput('');
      return;
    }

    if (hardwareConnected) {
      const targetBoard = serialBoardFilter !== 'all'
        ? serialBoardFilter
        : (hardwareSerialTargetRef.current || hardwareBoardId || 'hardware');
      sendHardwareSerialLine(txt, targetBoard)
        .then(() => setSerialInput(''))
        .catch((err) => {
          console.error('[WebSerial] TX failed:', err);
          alert(`Hardware serial write failed: ${err?.message || 'Unknown error'}`);
        });
      return;
    }

    alert('Run simulator or connect hardware serial before sending data.');
  }, [serialInput, workerRef, isRunning, serialBoardFilter, serialBaudRate, pushSerialTxLine, hardwareConnected, hardwareBoardId, sendHardwareSerialLine]);

  // ── PNG Export ────────────────────────────────────────────────────────────
  const downloadPng = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const canvasEl = canvasRef.current;
      const SCALE = 2;
      const PAD = 60; // padding around content in canvas-space pixels

      // 1. Calculate bounding box of all components + wire waypoints (in canvas-space coords)
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      components.forEach(c => {
        const reg = COMPONENT_REGISTRY[c.type];
        const b = typeof reg?.BOUNDS === 'function'
          ? reg.BOUNDS(getComponentStateAttrs(c))
          : (reg?.BOUNDS || { x: 0, y: 0, w: c.w, h: c.h });
        // component body
        minX = Math.min(minX, c.x + b.x);
        minY = Math.min(minY, c.y + b.y);
        maxX = Math.max(maxX, c.x + b.x + b.w);
        maxY = Math.max(maxY, c.y + b.y + b.h);
        // label below component adds ~20px
        maxY = Math.max(maxY, c.y + b.y + b.h + 20);
        // pins (they're positioned relative to component and can extend beyond its box)
        (PIN_DEFS[c.type] || []).forEach(pin => {
          const pp = getPinPos(c.id, pin.id);
          if (pp) {
            minX = Math.min(minX, pp.x - 4);
            minY = Math.min(minY, pp.y - 4);
            maxX = Math.max(maxX, pp.x + 4);
            maxY = Math.max(maxY, pp.y + 4);
          }
        });
      });
      // wire waypoints
      wires.forEach(w => {
        (w.waypoints || []).forEach(wp => {
          minX = Math.min(minX, wp.x);
          minY = Math.min(minY, wp.y);
          maxX = Math.max(maxX, wp.x);
          maxY = Math.max(maxY, wp.y);
        });
        // wire endpoints (from/to pin positions)
        const [fComp, fPin] = (w.from || '').split(':');
        const [tComp, tPin] = (w.to || '').split(':');
        const fp = getPinPos(fComp, fPin);
        const tp = getPinPos(tComp, tPin);
        if (fp) { minX = Math.min(minX, fp.x); minY = Math.min(minY, fp.y); maxX = Math.max(maxX, fp.x); maxY = Math.max(maxY, fp.y); }
        if (tp) { minX = Math.min(minX, tp.x); minY = Math.min(minY, tp.y); maxX = Math.max(maxX, tp.x); maxY = Math.max(maxY, tp.y); }
      });
      if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 600; }

      minX -= PAD; minY -= PAD; maxX += PAD; maxY += PAD;
      const bboxW = maxX - minX;
      const bboxH = maxY - minY;

      // 2. Hide overlays and temporarily adjust canvas + zoom wrapper for full-content capture
      const overlays = canvasEl.querySelectorAll('[data-export-ignore="true"]');
      overlays.forEach(el => { el.style.visibility = 'hidden'; });
      // Find the zoom wrapper (first absolutely-positioned child)
      const zoomWrapper = canvasEl.querySelector(':scope > div');

      // Save original styles
      const origStyles = {
        canvasOverflow: canvasEl.style.overflow,
        canvasWidth: canvasEl.style.width,
        canvasHeight: canvasEl.style.height,
        canvasFlex: canvasEl.style.flex,
        canvasMinWidth: canvasEl.style.minWidth,
        canvasMinHeight: canvasEl.style.minHeight,
        canvasBackground: canvasEl.style.backgroundImage,
        zoomTransform: zoomWrapper.style.transform,
        zoomWidth: zoomWrapper.style.width,
        zoomHeight: zoomWrapper.style.height,
      };

      // Temporarily reset to fit all content at scale 1
      canvasEl.style.overflow = 'visible';
      canvasEl.style.width = bboxW + 'px';
      canvasEl.style.height = bboxH + 'px';
      canvasEl.style.flex = 'none';
      canvasEl.style.minWidth = bboxW + 'px';
      canvasEl.style.minHeight = bboxH + 'px';
      canvasEl.style.backgroundImage = 'none'; // hide grid dots from export
      zoomWrapper.style.transform = `translate(${-minX}px, ${-minY}px) scale(1)`;
      zoomWrapper.style.width = bboxW + 'px';
      zoomWrapper.style.height = bboxH + 'px';

      // Tag all open shadow-root elements (wokwi web components) so we can
      // inline their shadow DOM in the cloned document — html2canvas cannot
      // capture shadow DOM content on its own, causing the board image to be
      // blank while pin dots render at correct positions (apparent misalignment).
      const shadowHostEls = [];
      canvasEl.querySelectorAll('*').forEach(el => {
        if (el.shadowRoot) {
          el.dataset.h2cShadow = String(shadowHostEls.length);
          shadowHostEls.push(el);
        }
      });

      let circuitCanvas;
      try {
        circuitCanvas = await html2canvas(canvasEl, {
          backgroundColor: '#070b14',
          scale: SCALE,
          useCORS: true,
          allowTaint: true,
          logging: false,
          width: bboxW,
          height: bboxH,
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0,
          onclone: (_clonedDoc, clonedEl) => {
            shadowHostEls.forEach((liveEl, idx) => {
              const cloned = clonedEl.querySelector(`[data-h2c-shadow="${idx}"]`);
              if (!cloned || !liveEl.shadowRoot) return;
              const wrapper = _clonedDoc.createElement('div');
              // Preserve inline styles (transform, size, etc.) from the original element
              Array.from(cloned.style).forEach(p =>
                wrapper.style.setProperty(p, cloned.style.getPropertyValue(p))
              );
              // Deep-copy shadow root children into the wrapper so html2canvas sees them
              liveEl.shadowRoot.childNodes.forEach(node =>
                wrapper.appendChild(_clonedDoc.importNode(node, true))
              );
              cloned.replaceWith(wrapper);
            });
          },
        });
      } finally {
        // Restore all original styles
        canvasEl.style.overflow = origStyles.canvasOverflow;
        canvasEl.style.width = origStyles.canvasWidth;
        canvasEl.style.height = origStyles.canvasHeight;
        canvasEl.style.flex = origStyles.canvasFlex;
        canvasEl.style.minWidth = origStyles.canvasMinWidth;
        canvasEl.style.minHeight = origStyles.canvasMinHeight;
        canvasEl.style.backgroundImage = origStyles.canvasBackground;
        zoomWrapper.style.transform = origStyles.zoomTransform;
        zoomWrapper.style.width = origStyles.zoomWidth;
        zoomWrapper.style.height = origStyles.zoomHeight;
        overlays.forEach(el => { el.style.visibility = ''; });
        // Remove temporary shadow-tracking attributes
        shadowHostEls.forEach(el => { delete el.dataset.h2cShadow; });
      }

      const CW = circuitCanvas.width;
      const CH = circuitCanvas.height;

      // 2. Output canvas — circuit only (no header bar)
      const out = document.createElement('canvas');
      out.width = CW;
      out.height = CH;
      const ctx = out.getContext('2d');

      ctx.fillStyle = '#070b14';
      ctx.fillRect(0, 0, CW, CH);
      ctx.drawImage(circuitCanvas, 0, 0);

      // Branding watermark (bottom-right)
      ctx.fillStyle = '#2a3a52';
      ctx.font = `${9 * SCALE}px "Space Grotesk", sans-serif`;
      ctx.fillText('Generated by OpenHW-Studio', CW - 240 * SCALE, CH - 8 * SCALE);

      // 3. Encode FULL metadata (no truncation) for machine-readable round-trip
      const fullMetadata = {
        board,
        components: components.map(c => ({ id: c.id, type: c.type, label: c.label, x: c.x, y: c.y, w: c.w, h: c.h, attrs: c.attrs })),
        connections: wires.map(w => ({ id: w.id, from: w.from, to: w.to, color: w.color, waypoints: w.waypoints || [], isBelow: w.isBelow || false, fromLabel: w.fromLabel || '', toLabel: w.toLabel || '' })),
        code,
        projectFiles,
        openCodeTabs,
        activeCodeFileId,
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

  // ── View Panel helpers — SVG Schematic Generator ─────────────────────────
  const generateSchematic = useCallback(() => {
    setSchematicLoading(true);
    setSchematicDataUrl(null);
    try {
      const SW = 1122, SH = 794;           // A4 landscape px
      const OM = 10, GL = 20, TH = 65;     // outer-margin, grid-label, title height
      const FX1 = OM + GL, FY1 = OM + GL;
      const FX2 = SW - OM - GL, FY2 = SH - OM - GL - TH;
      const FW = FX2 - FX1, FH = FY2 - FY1;

      // ── SVG micro helpers ───────────────────────────────────────────────
      const ln = (x1, y1, x2, y2, sw = 1.5, col = '#1a1a1a') =>
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${sw}"/>`;
      const bx = (x, y, w, h, fill = 'white', sw = 1.5, rx = 0) =>
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="#1a1a1a" stroke-width="${sw}"/>`;
      const tx = (x, y, t, sz = 9, anchor = 'middle', bold = false, fill = '#1a1a1a', font = 'monospace') =>
        `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${sz}" font-family="${font}" ${bold ? 'font-weight="bold"' : ''} fill="${fill}">${t}</text>`;
      const circ = (cx, cy, r, fill = 'white') =>
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#1a1a1a" stroke-width="1.5"/>`;

      // ── Symbol library ──────────────────────────────────────────────────
      const SYMS = {};

      // LED
      SYMS['wokwi-led'] = {
        w: 72, h: 44, refPrefix: 'D',
        pins: { A: { dx: 0, dy: 22 }, K: { dx: 72, dy: 22 } },
        draw(x, y, comp, ref) {
          const c = comp.attrs?.color || 'red';
          const fill = c === 'green' ? '#2a7a2a30' : c === 'blue' ? '#2a2a9a30' : c === 'yellow' ? '#8a7a0030' : '#c0202030';
          return [
            ln(x, y + 22, x + 16, y + 22),
            `<polygon points="${x + 16},${y + 6} ${x + 16},${y + 38} ${x + 48},${y + 22}" fill="${fill}" stroke="#1a1a1a" stroke-width="1.5"/>`,
            ln(x + 48, y + 6, x + 48, y + 38), ln(x + 48, y + 22, x + 72, y + 22),
            ln(x + 38, y + 6, x + 52, y - 5, 1), ln(x + 32, y + 6, x + 46, y - 5, 1),
            `<polygon points="${x + 50},${y - 7} ${x + 52},${y - 5} ${x + 48},${y - 4}" fill="#1a1a1a"/>`,
            `<polygon points="${x + 44},${y - 7} ${x + 46},${y - 5} ${x + 42},${y - 4}" fill="#1a1a1a"/>`,
            tx(x + 36, y + 54, ref, 9, 'middle', true),
            tx(x + 5, y + 18, '+', 7, 'middle', false, '#777'), tx(x + 64, y + 18, '−', 7, 'middle', false, '#777'),
          ].join('');
        }
      };

      // Resistor
      SYMS['wokwi-resistor'] = {
        w: 70, h: 32, refPrefix: 'R',
        pins: { p1: { dx: 0, dy: 16 }, p2: { dx: 70, dy: 16 } },
        draw(x, y, comp, ref) {
          const v = parseFloat(comp.attrs?.value || 220);
          const u = v >= 1e6 ? `${v / 1e6}M\u03A9` : v >= 1000 ? `${v / 1000}k\u03A9` : `${v}\u03A9`;
          return [ln(x, y + 16, x + 12, y + 16), bx(x + 12, y + 6, 46, 20), ln(x + 58, y + 16, x + 70, y + 16),
          tx(x + 35, y + 44, ref, 9, 'middle', true), tx(x + 35, y + 53, u, 8, 'middle', false, '#555')].join('');
        }
      };

      // Push button
      SYMS['wokwi-pushbutton'] = {
        w: 62, h: 48, refPrefix: 'S',
        pins: { '1': { dx: 0, dy: 28 }, '2': { dx: 62, dy: 28 } },
        draw(x, y, comp, ref) {
          return [
            ln(x, y + 28, x + 16, y + 28), ln(x + 16, y + 14, x + 16, y + 42),
            ln(x + 40, y + 14, x + 40, y + 42), ln(x + 16, y + 14, x + 46, y + 9),
            ln(x + 40, y + 28, x + 62, y + 28),
            ln(x + 28, y + 9, x + 28, y + 2), ln(x + 23, y + 2, x + 33, y + 2, 1.5),
            tx(x + 31, y + 60, ref, 9, 'middle', true),
          ].join('');
        }
      };

      // Buzzer
      SYMS['wokwi-buzzer'] = {
        w: 52, h: 48, refPrefix: 'BZ',
        pins: { '1': { dx: 0, dy: 24 }, '2': { dx: 52, dy: 24 } },
        draw(x, y, comp, ref) {
          return [
            ln(x, y + 24, x + 10, y + 24), bx(x + 10, y + 10, 32, 28),
            `<path d="M${x + 21},${y + 16} Q${x + 26},${y + 11} ${x + 31},${y + 16}" fill="none" stroke="#1a1a1a" stroke-width="1"/>`,
            `<path d="M${x + 17},${y + 13} Q${x + 26},${y + 5} ${x + 35},${y + 13}" fill="none" stroke="#1a1a1a" stroke-width="1"/>`,
            ln(x + 26, y + 24, x + 26, y + 30, 1.5), ln(x + 42, y + 24, x + 52, y + 24),
            tx(x + 6, y + 22, '+', 7, 'middle', false, '#777'),
            tx(x + 26, y + 60, ref, 9, 'middle', true),
          ].join('');
        }
      };

      // Power supply
      SYMS['wokwi-power-supply'] = {
        w: 52, h: 70, refPrefix: 'PS',
        pins: { '5V': { dx: 26, dy: 0 }, 'GND': { dx: 26, dy: 70 } },
        draw(x, y, comp, ref) {
          const v = comp.attrs?.voltage || '5V';
          return [
            ln(x + 26, y, x + 26, y + 16), ln(x + 14, y + 16, x + 38, y + 16, 2),
            ln(x + 26, y + 50, x + 26, y + 70),
            ln(x + 14, y + 50, x + 38, y + 50), ln(x + 18, y + 56, x + 34, y + 56), ln(x + 22, y + 62, x + 30, y + 62),
            tx(x + 26, y - 4, `+${v}`, 9), tx(x + 26, y + 32, ref, 8, 'middle', false, '#555'),
          ].join('');
        }
      };

      // Potentiometer
      SYMS['wokwi-potentiometer'] = {
        w: 80, h: 72, refPrefix: 'RV',
        pins: { '1': { dx: 0, dy: 36 }, '2': { dx: 80, dy: 36 }, 'SIG': { dx: 40, dy: 72 } },
        draw(x, y, comp, ref) {
          const v = parseFloat(comp.attrs?.value || 50000);
          const u = v >= 1e6 ? `${v / 1e6}M\u03A9` : v >= 1000 ? `${v / 1000}k\u03A9` : `${v}\u03A9`;
          return [
            ln(x, y + 36, x + 12, y + 36), bx(x + 12, y + 26, 56, 20), ln(x + 68, y + 36, x + 80, y + 36),
            ln(x + 40, y + 46, x + 40, y + 60),
            `<polygon points="${x + 34},${y + 46} ${x + 46},${y + 46} ${x + 40},${y + 36}" fill="#1a1a1a"/>`,
            ln(x + 40, y + 60, x + 40, y + 72),
            tx(x + 40, y + 22, u, 7), tx(x + 40, y + 84, ref, 9, 'middle', true),
          ].join('');
        }
      };

      // Servo
      SYMS['wokwi-servo'] = {
        w: 90, h: 56, refPrefix: 'SV',
        pins: { 'GND': { dx: 18, dy: 56 }, 'V+': { dx: 45, dy: 56 }, 'PWM': { dx: 72, dy: 56 } },
        draw(x, y, comp, ref) {
          return [
            bx(x + 5, y + 5, 80, 36, undefined, 1.5, 3), tx(x + 45, y + 28, 'SERVO', 10, 'middle', true, '#1a1a1a', 'sans-serif'),
            ln(x + 18, y + 41, x + 18, y + 56), ln(x + 45, y + 41, x + 45, y + 56), ln(x + 72, y + 41, x + 72, y + 56),
            tx(x + 18, y + 66, 'GND', 7), tx(x + 45, y + 66, 'V+', 7), tx(x + 72, y + 66, 'PWM', 7),
            tx(x + 45, y + 76, ref, 9, 'middle', true),
          ].join('');
        }
      };

      // DC Motor
      SYMS['wokwi-motor'] = {
        w: 60, h: 52, refPrefix: 'M',
        pins: { '1': { dx: 0, dy: 26 }, '2': { dx: 60, dy: 26 } },
        draw(x, y, comp, ref) {
          return [ln(x, y + 26, x + 8, y + 26), circ(x + 30, y + 26, 18), tx(x + 30, y + 30, 'M', 14, 'middle', true, '#1a1a1a', 'sans-serif'),
          ln(x + 52, y + 26, x + 60, y + 26), tx(x + 30, y + 56, ref, 9, 'middle', true)].join('');
        }
      };

      // NeoPixel
      SYMS['wokwi-neopixel-matrix'] = {
        w: 80, h: 62, refPrefix: 'NP',
        pins: { 'DIN': { dx: 0, dy: 31 }, 'VCC': { dx: 40, dy: 0 }, 'GND': { dx: 40, dy: 62 } },
        draw(x, y, comp, ref) {
          return [
            bx(x + 10, y + 10, 60, 42, '#111'), ln(x, y + 31, x + 10, y + 31),
            ln(x + 40, y, x + 40, y + 10), ln(x + 40, y + 52, x + 40, y + 62),
            `<circle cx="${x + 30}" cy="${y + 26}" r="5" fill="#f00" opacity="0.9"/>`,
            `<circle cx="${x + 40}" cy="${y + 26}" r="5" fill="#0f0" opacity="0.9"/>`,
            `<circle cx="${x + 50}" cy="${y + 26}" r="5" fill="#00f" opacity="0.9"/>`,
            `<circle cx="${x + 35}" cy="${y + 38}" r="5" fill="#ff0" opacity="0.9"/>`,
            `<circle cx="${x + 45}" cy="${y + 38}" r="5" fill="#0ff" opacity="0.9"/>`,
            tx(x + 40, y + 76, ref, 9, 'middle', true),
          ].join('');
        }
      };

      // 74HC595 Shift Register
      SYMS['shift_register'] = {
        w: 120, h: 210, refPrefix: 'IC',
        pins: {
          vcc: { dx: 60, dy: 0 }, gnd: { dx: 60, dy: 210 },
          ser: { dx: 0, dy: 40 }, srclk: { dx: 0, dy: 58 }, rclk: { dx: 0, dy: 76 }, oe: { dx: 0, dy: 94 }, srclr: { dx: 0, dy: 112 },
          q0: { dx: 120, dy: 40 }, q1: { dx: 120, dy: 58 }, q2: { dx: 120, dy: 76 }, q3: { dx: 120, dy: 94 },
          q4: { dx: 120, dy: 112 }, q5: { dx: 120, dy: 130 }, q6: { dx: 120, dy: 148 }, q7: { dx: 120, dy: 166 }, q7s: { dx: 120, dy: 184 },
        },
        draw(x, y, comp, ref) {
          const LP = [['SER', 40], ['SRCLK', 58], ['RCLK', 76], ['~OE', 94], ['~SRCLR', 112]];
          const RP = [['Q0', 40], ['Q1', 58], ['Q2', 76], ['Q3', 94], ['Q4', 112], ['Q5', 130], ['Q6', 148], ['Q7', 166], ["Q7'", 184]];
          return [
            bx(x + 15, y + 12, 90, 186), tx(x + 60, y + 28, '74HC595', 9, 'middle', true), tx(x + 60, y + 10, ref, 7, 'middle', false, '#555'),
            ln(x + 60, y, x + 60, y + 12), tx(x + 60, y - 2, 'VCC', 7),
            ln(x + 60, y + 198, x + 60, y + 210), tx(x + 60, y + 220, 'GND', 7),
            ...LP.map(([l, dy]) => ln(x, y + dy, x + 15, y + dy) + `<text x="${x + 18}" y="${y + dy + 3}" font-size="6.5" font-family="monospace" fill="#1a1a1a">${l}</text>`),
            ...RP.map(([l, dy]) => ln(x + 105, y + dy, x + 120, y + dy) + `<text x="${x + 102}" y="${y + dy + 3}" text-anchor="end" font-size="6.5" font-family="monospace" fill="#1a1a1a">${l}</text>`),
          ].join('');
        }
      };

      // L298N Motor Driver
      SYMS['wokwi-motor-driver'] = {
        w: 130, h: 170, refPrefix: 'MD',
        pins: {
          ENA: { dx: 0, dy: 30 }, IN1: { dx: 0, dy: 50 }, IN2: { dx: 0, dy: 70 }, IN3: { dx: 0, dy: 90 }, IN4: { dx: 0, dy: 110 }, ENB: { dx: 0, dy: 130 },
          OUT1: { dx: 130, dy: 30 }, OUT2: { dx: 130, dy: 50 }, OUT3: { dx: 130, dy: 90 }, OUT4: { dx: 130, dy: 110 },
          '12V': { dx: 30, dy: 0 }, 'GND': { dx: 65, dy: 0 }, '5V': { dx: 100, dy: 0 },
        },
        draw(x, y, comp, ref) {
          const LP = [['ENA', 30], ['IN1', 50], ['IN2', 70], ['IN3', 90], ['IN4', 110], ['ENB', 130]];
          const RP = [['OUT1', 30], ['OUT2', 50], ['OUT3', 90], ['OUT4', 110]];
          const TP = [['12V', 30], ['GND', 65], ['5V', 100]];
          return [
            bx(x + 15, y + 12, 100, 148), tx(x + 65, y + 34, 'L298N', 10, 'middle', true, '#1a1a1a', 'sans-serif'), tx(x + 65, y + 10, ref, 7, 'middle', false, '#555'),
            ...LP.map(([l, dy]) => ln(x, y + dy, x + 15, y + dy) + `<text x="${x + 18}" y="${y + dy + 3}" font-size="6.5" font-family="monospace" fill="#1a1a1a">${l}</text>`),
            ...RP.map(([l, dy]) => ln(x + 115, y + dy, x + 130, y + dy) + `<text x="${x + 112}" y="${y + dy + 3}" text-anchor="end" font-size="6.5" font-family="monospace" fill="#1a1a1a">${l}</text>`),
            ...TP.map(([l, dx]) => ln(x + dx, y, x + dx, y + 12) + `<text x="${x + dx}" y="${y - 2}" text-anchor="middle" font-size="6.5" font-family="monospace" fill="#1a1a1a">${l}</text>`),
          ].join('');
        }
      };

      // Arduino Uno ─────────────────────────────────────────────────────────
      const UL = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'];
      const UR = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'vin', 'gnd_1', 'gnd_2', 'gnd_3', '5V', '3v3', 'rst', 'ioref'];
      const ULL = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5~', 'D6~', 'D7', 'D8', 'D9~', 'D10~', 'D11~', 'D12', 'D13'];
      const URL2 = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'VIN', 'GND', 'GND', 'GND', '5V', '3.3V', 'RST', 'IOREF'];
      const UPS = 18, UW = 148, UH = UL.length * UPS + 46;
      const unoPins = {};
      UL.forEach((id, i) => { unoPins[id] = { dx: 0, dy: 34 + i * UPS }; });
      UR.forEach((id, i) => { unoPins[id] = { dx: UW, dy: 34 + i * UPS }; });
      SYMS['wokwi-arduino-uno'] = {
        w: UW, h: UH, refPrefix: 'U', pins: unoPins,
        draw(x, y, comp, ref) {
          return [
            bx(x + 16, y + 14, UW - 32, UH - 28),
            tx(x + UW / 2, y + 30, 'Arduino Uno', 10, 'middle', true),
            tx(x + UW / 2, y + 10, ref, 8, 'middle', false, '#555'),
            tx(x + UW / 2, y + 44, 'ATmega328P', 7, 'middle', false, '#777'),
            ...UL.map((id, i) => { const py = y + 34 + i * UPS; return ln(x, py, x + 16, py) + `<text x="${x + 19}" y="${py + 3}" font-size="6.5" font-family="monospace" fill="#1a1a1a">${ULL[i]}</text>`; }),
            ...UR.map((id, i) => { const py = y + 34 + i * UPS; return ln(x + UW - 16, py, x + UW, py) + `<text x="${x + UW - 19}" y="${py + 3}" text-anchor="end" font-size="6.5" font-family="monospace" fill="#1a1a1a">${URL2[i]}</text>`; }),
          ].join('');
        }
      };

      // Generic fallback IC ─────────────────────────────────────────────────
      const makeGenericSym = (comp) => {
        const used = new Set();
        wires.forEach(w => {
          const [ci, pi] = w.from.split(':'); if (ci === comp.id && pi) used.add(pi);
          const [ci2, pi2] = w.to.split(':'); if (ci2 === comp.id && pi2) used.add(pi2);
        });
        const pl = [...used]; const half = Math.ceil(pl.length / 2);
        const lp = pl.slice(0, half), rp = pl.slice(half);
        const rows = Math.max(lp.length, rp.length, 2), gh = rows * 20 + 44, gw = 100;
        const pins = {};
        lp.forEach((id, i) => { pins[id] = { dx: 0, dy: 32 + i * 20 }; });
        rp.forEach((id, i) => { pins[id] = { dx: gw + 30, dy: 32 + i * 20 }; });
        return {
          w: gw + 30, h: gh, refPrefix: 'IC', pins,
          draw(x, y, _c, ref) {
            const sType = _c.type.replace('wokwi-', '');
            return [
              bx(x + 15, y + 12, gw, gh - 24), tx(x + 15 + gw / 2, y + 28, sType, 8, 'middle', true), tx(x + 15 + gw / 2, y + 10, ref, 7, 'middle', false, '#555'),
              ...lp.map((id, i) => ln(x, y + 32 + i * 20, x + 15, y + 32 + i * 20) + `<text x="${x + 18}" y="${y + 36 + i * 20}" font-size="6.5" font-family="monospace" fill="#1a1a1a">${id}</text>`),
              ...rp.map((id, i) => ln(x + gw + 15, y + 32 + i * 20, x + gw + 30, y + 32 + i * 20) + `<text x="${x + gw + 12}" y="${y + 36 + i * 20}" text-anchor="end" font-size="6.5" font-family="monospace" fill="#1a1a1a">${id}</text>`),
            ].join('');
          }
        };
      };

      // ── Layout ────────────────────────────────────────────────────────────
      if (components.length === 0) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}"><rect width="${SW}" height="${SH}" fill="white"/><text x="${SW / 2}" y="${SH / 2}" text-anchor="middle" font-size="18" fill="#aaa" font-family="sans-serif">No components on canvas</text></svg>`;
        schematicSvgRef.current = svg;
        setSchematicDataUrl(`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`);
        return;
      }

      // Assign reference designators (sorted left-to-right by canvas x)
      const sorted = [...components].sort((a, b) => a.x - b.x);
      const refCounts = {}, compSymMap = {}, compRefMap = {};
      sorted.forEach(c => {
        let sym = SYMS[c.type]; if (!sym) sym = makeGenericSym(c);
        compSymMap[c.id] = sym;
        const pre = sym.refPrefix; refCounts[pre] = (refCounts[pre] || 0) + 1;
        compRefMap[c.id] = `${pre}${refCounts[pre]}`;
      });

      // Bounding box (canvas component centers)
      let mnX = 1e9, mnY = 1e9, mxX = -1e9, mxY = -1e9;
      components.forEach(c => {
        const cx = c.x + (c.w || 60) / 2, cy = c.y + (c.h || 60) / 2;
        mnX = Math.min(mnX, cx); mnY = Math.min(mnY, cy); mxX = Math.max(mxX, cx); mxY = Math.max(mxY, cy);
      });

      const PAD = 70;
      const availW = FW - PAD * 2, availH = FH - PAD * 2;
      const srcW = Math.max(mxX - mnX, 1), srcH = Math.max(mxY - mnY, 1);
      const sc = Math.min(availW / srcW, availH / srcH, 1.8);

      const toSch = (cx, cy) => ({ x: FX1 + PAD + (cx - mnX) * sc, y: FY1 + PAD + (cy - mnY) * sc });

      // Symbol top-left positions
      const cPos = {};
      components.forEach(c => {
        const sym = compSymMap[c.id];
        const cx = c.x + (c.w || 60) / 2, cy = c.y + (c.h || 60) / 2;
        const s = toSch(cx, cy);
        cPos[c.id] = { x: s.x - sym.w / 2, y: s.y - sym.h / 2 };
      });

      // Pin world position helper
      const pinXY = (compId, pinId) => {
        const c = components.find(cc => cc.id === compId); if (!c) return null;
        const sym = compSymMap[c.id]; if (!sym) return null;
        const pos = cPos[c.id]; const pin = sym.pins[pinId];
        if (!pin) return { x: pos.x + sym.w, y: pos.y + sym.h / 2 };
        return { x: pos.x + pin.dx, y: pos.y + pin.dy };
      };

      // ── Components SVG ────────────────────────────────────────────────────
      const compsSVG = components.map(c => {
        const sym = compSymMap[c.id]; const pos = cPos[c.id]; const ref = compRefMap[c.id];
        return `<g class="comp" id="${c.id}">${sym.draw(pos.x, pos.y, c, ref)}</g>`;
      }).join('\n');

      // ── Wires SVG ─────────────────────────────────────────────────────────
      const wiresSVG = wires.map(w => {
        const [fC, fP] = w.from.split(':'), [tC, tP] = w.to.split(':');
        const p1 = pinXY(fC, fP), p2 = pinXY(tC, tP); if (!p1 || !p2) return '';
        // Route: horizontal from p1 half-way, then vertical, then horizontal to p2
        const midX = (p1.x + p2.x) / 2;
        const d = `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} L${midX.toFixed(1)},${p1.y.toFixed(1)} L${midX.toFixed(1)},${p2.y.toFixed(1)} L${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
        // Junction dot at middle junction if same Y (direct horizontal)
        const dot = (Math.abs(p1.y - p2.y) < 1) ? '' : `<circle cx="${midX.toFixed(1)}" cy="${p1.y.toFixed(1)}" r="2.5" fill="#1a1a1a"/>`;
        return `<path d="${d}" fill="none" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>${dot}`;
      }).filter(Boolean).join('\n');

      // ── Border + grid coordinates ─────────────────────────────────────────
      const GCOLS = 6, GROWS = 4, GRL = ['A', 'B', 'C', 'D'];
      const cStep = FW / GCOLS, rStep = FH / GROWS;
      let borderSVG = `
        <rect x="${OM}" y="${OM}" width="${SW - OM * 2}" height="${SH - OM * 2}" fill="none" stroke="#cc0000" stroke-width="1.2"/>
        <rect x="${FX1}" y="${FY1}" width="${FW}" height="${FH}" fill="none" stroke="#cc0000" stroke-width="2"/>
      `;
      for (let c = 1; c < GCOLS; c++) {
        const gx = FX1 + c * cStep;
        borderSVG += `${ln(gx, FY1, gx, FY1 - 3, 0.5, '#777')}${ln(gx, FY2, gx, FY2 + 3, 0.5, '#777')}`;
      }
      for (let r = 1; r < GROWS; r++) {
        const gy = FY1 + r * rStep;
        borderSVG += `${ln(FX1, gy, FX1 - 3, gy, 0.5, '#777')}${ln(FX2, gy, FX2 + 3, gy, 0.5, '#777')}`;
      }
      for (let c = 0; c < GCOLS; c++) {
        const cx = FX1 + c * cStep + cStep / 2;
        borderSVG += tx(cx, FY1 - 5, c + 1, 8, 'middle', false, '#444', 'sans-serif');
        borderSVG += tx(cx, FY2 + 14, c + 1, 8, 'middle', false, '#444', 'sans-serif');
      }
      for (let r = 0; r < GROWS; r++) {
        const ry = FY1 + r * rStep + rStep / 2 + 4;
        borderSVG += tx(FX1 - 5, ry, GRL[r], 8, 'end', false, '#444', 'sans-serif');
        borderSVG += tx(FX2 + 5, ry, GRL[r], 8, 'start', false, '#444', 'sans-serif');
      }

      // ── Title block ───────────────────────────────────────────────────────
      const TBY = FY2, TBH2 = SH - OM - GL - FY2, divW = FW / 3;
      const boardLabel = board === 'arduino_uno' ? 'Arduino Uno' : board === 'pico' ? 'Raspberry Pi Pico' : 'ESP32';
      const dateStr = new Date().toISOString().slice(0, 10);
      borderSVG += `
        <rect x="${FX1}" y="${TBY}" width="${FW}" height="${TBH2}" fill="white" stroke="#cc0000" stroke-width="1"/>
        <line x1="${FX1 + divW}" y1="${TBY}" x2="${FX1 + divW}" y2="${TBY + TBH2}" stroke="#bbb" stroke-width="0.5"/>
        <line x1="${FX1 + divW * 2}" y1="${TBY}" x2="${FX1 + divW * 2}" y2="${TBY + TBH2}" stroke="#bbb" stroke-width="0.5"/>
        <text x="${FX1 + 10}" y="${TBY + TBH2 / 2 + 4}" font-size="9" font-family="sans-serif" fill="#666">Made with OpenHW Studio</text>
        <text x="${FX1 + divW * 1.5}" y="${TBY + TBH2 / 2 - 4}" text-anchor="middle" font-size="10" font-weight="bold" font-family="sans-serif" fill="#1a1a1a">Board: ${boardLabel}</text>
        <text x="${FX1 + divW * 1.5}" y="${TBY + TBH2 / 2 + 10}" text-anchor="middle" font-size="8" font-family="sans-serif" fill="#555">${components.length} components · ${wires.length} wires</text>
        <text x="${FX1 + divW * 2.5}" y="${TBY + TBH2 / 2 + 4}" text-anchor="middle" font-size="9" font-family="sans-serif" fill="#444">${dateStr}</text>
        <text x="${FX1 + divW}" y="${TBY + 8}" font-size="6" font-family="sans-serif" fill="#aaa">TITLE</text>
        <text x="${FX1 + divW * 2}" y="${TBY + 8}" font-size="6" font-family="sans-serif" fill="#aaa">DATE</text>
      `;

      // ── Assemble SVG ───────────────────────────────────────────────────────
      const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}">
  <rect width="${SW}" height="${SH}" fill="white"/>
  ${borderSVG}
  <g id="wires" stroke-linecap="round" stroke-linejoin="round">${wiresSVG}</g>
  <g id="components">${compsSVG}</g>
</svg>`;

      schematicSvgRef.current = svgStr;
      const b64 = btoa(unescape(encodeURIComponent(svgStr)));
      setSchematicDataUrl(`data:image/svg+xml;base64,${b64}`);
    } catch (err) {
      console.error('[Schematic]', err);
    } finally {
      setSchematicLoading(false);
    }
  }, [components, wires, board]);

  const downloadSchematicPng = useCallback(() => {
    const svgStr = schematicSvgRef.current;
    if (!svgStr) return;
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 2244; canvas.height = 1588; // 2x high-res
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png', 0.95);
      a.download = 'schematic.png'; a.click();
    };
    img.onerror = () => {
      // Fallback: download SVG
      const a = document.createElement('a'); a.href = url; a.download = 'schematic.svg'; a.click();
    };
    img.src = url;
  }, []);

  const downloadSchematicPdf = useCallback(() => {
    const svgStr = schematicSvgRef.current;
    if (!svgStr) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(
      `<html><head><title>Schematic</title>` +
      `<style>@page{margin:0;size:A4 landscape}body{margin:0;padding:0}svg{width:100%;height:auto;display:block}</style></head>` +
      `<body>${svgStr}<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};}<\/script></body></html>`
    );
    win.document.close();
  }, []);

  const downloadCompCsv = () => {
    const counts = {};
    components.forEach(c => {
      if (!counts[c.type]) counts[c.type] = { type: c.type, label: c.label, count: 0 };
      counts[c.type].count++;
    });
    const rows = Object.values(counts);
    let csv = '#,Component,Type,Quantity\n';
    rows.forEach((row, i) => {
      csv += `${i + 1},"${row.label}","${row.type}",${row.count}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'components.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
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
        const MARKER = '\x00OPENHW_META\x00';
        const markerBytes = new TextEncoder().encode(MARKER);

        // Search full payload from the end so very large metadata remains importable.
        let markerByteIdx = -1;
        for (let i = bytes.length - markerBytes.length; i >= 0; i--) {
          let ok = true;
          for (let j = 0; j < markerBytes.length; j++) {
            if (bytes[i + j] !== markerBytes[j]) {
              ok = false;
              break;
            }
          }
          if (ok) {
            markerByteIdx = i;
            break;
          }
        }

        if (markerByteIdx === -1) {
          alert('This PNG does not contain OpenHW-Studio circuit data.\nOnly PNGs exported from this simulator can be imported.');
          return;
        }

        const payloadBytes = bytes.slice(markerByteIdx + markerBytes.length);
        const jsonStr = new TextDecoder('utf-8', { fatal: false }).decode(payloadBytes);
        const meta = JSON.parse(jsonStr);

        // Confirm before overwriting current circuit
        const hasExisting = components.length > 0 || wires.length > 0;
        if (hasExisting && !window.confirm(`Import will replace your current circuit (${components.length} components, ${wires.length} wires). Continue?`)) {
          return;
        }

        // Restore state
        saveHistory();
        if (meta.board) setBoard(meta.board);
        if (Object.prototype.hasOwnProperty.call(meta, 'code')) setCode(meta.code || '');
        if (Array.isArray(meta.components)) setComponents(meta.components);
        if (Array.isArray(meta.connections)) setWires(meta.connections);

        const importedBoards = Array.isArray(meta.components)
          ? meta.components.filter((c) => /(arduino|esp32|stm32|rp2040|pico)/i.test(c.type))
          : [];

        let normalizedFiles = Array.isArray(meta.projectFiles) ? [...meta.projectFiles] : [];

        // Backward compatibility: older PNG exports had only `code`.
        if (normalizedFiles.length === 0 && typeof meta.code === 'string' && meta.code.trim()) {
          if (importedBoards.length > 0) {
            normalizedFiles = importedBoards.map((bc, idx) => ({
              id: `project/${bc.id}/${bc.id}.ino`,
              path: `project/${bc.id}/${bc.id}.ino`,
              name: `${bc.id}.ino`,
              kind: 'code',
              boardId: bc.id,
              boardKind: normalizeBoardKind(bc.type),
              content: idx === 0 ? meta.code : createDefaultMainCode(normalizeBoardKind(bc.type), bc.id),
              dirty: false,
            }));
          }
        }

        if (normalizedFiles.length > 0 && typeof meta.code === 'string' && meta.code.trim()) {
          const codeFileIdx = normalizedFiles.findIndex((f) => f.kind === 'code' || /\.(ino|h|hpp|c|cpp)$/i.test(f.name || f.path || ''));
          const hasCodeContent = normalizedFiles.some((f) => (f.kind === 'code' || /\.(ino|h|hpp|c|cpp)$/i.test(f.name || f.path || '')) && String(f.content || '').trim().length > 0);
          if (!hasCodeContent && codeFileIdx >= 0) {
            const target = normalizedFiles[codeFileIdx];
            normalizedFiles[codeFileIdx] = { ...target, content: meta.code };
          }
        }

        setProjectFiles(normalizedFiles);
        setOpenCodeTabs(Array.isArray(meta.openCodeTabs) ? meta.openCodeTabs : []);
        setActiveCodeFileId(typeof meta.activeCodeFileId === 'string' ? meta.activeCodeFileId : '');

        syncNextIds(Array.isArray(meta.components) ? meta.components : [], Array.isArray(meta.connections) ? meta.connections : []);
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
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg)] font-sans text-[var(--text)] min-h-screen" ref={pageRef} >

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
              <TopToolbox board={board} setBoard={setBoard} isRunning={isRunning} isPaused={isPaused} handleRun={handleRun} handlePause={handlePause} handleResume={handleResume} handleStop={handleStop} isCompiling={isCompiling} assessmentMode={assessmentMode} assessmentProjectName={assessmentProjectName} isSubmittingAssessment={isSubmittingAssessment} handleAssessmentSubmit={handleAssessmentSubmit} undo={undo} redo={redo} selected={selected} rotateComponent={rotateComponent} theme={theme} toggleTheme={toggleTheme} showViewPanel={showViewPanel} setShowViewPanel={setShowViewPanel} viewPanelSection={viewPanelSection} setViewPanelSection={setViewPanelSection} schematicDataUrl={schematicDataUrl} setSchematicDataUrl={setSchematicDataUrl} schematicLoading={schematicLoading} setSchematicLoading={setSchematicLoading} downloadSchematicPng={downloadSchematicPng} downloadSchematicPdf={downloadSchematicPdf} generateSchematic={generateSchematic} downloadCompCsv={downloadCompCsv} importFileRef={importFileRef} downloadPng={downloadPng} importPng={importPng} handleSave={handleSave} isExporting={isExporting} refreshProjectList={refreshProjectList} showProjectsDropdown={showProjectsDropdown} setShowProjectsDropdown={setShowProjectsDropdown} handleNewProject={handleNewProject} handleStartRename={handleStartRename} handleConfirmRename={handleConfirmRename} renamingProjectId={renamingProjectId} setRenamingProjectId={setRenamingProjectId} renameValue={renameValue} setRenameValue={setRenameValue} handleLoadProject={handleLoadProject} handleDeleteProject={handleDeleteProject} handleBackupWorkflow={handleBackupWorkflow} backupRestoreInputRef={backupRestoreInputRef} handleRestoreWorkflow={handleRestoreWorkflow} handleSyncToCloud={handleSyncToCloud} user={user} navigate={navigate} isAuthenticated={isAuthenticated} myProjects={myProjects} currentProjectId={currentProjectId} formatProjectDate={formatProjectDate} saveHistory={saveHistory} setWires={setWires} setComponents={setComponents} setSelected={setSelected} history={history} components={components} wires={wires} webSerialSupported={webSerialSupported} hardwareBoards={boardComponents} hardwareBoardId={hardwareBoardId} setHardwareBoardId={handleHardwareBoardChange} hardwarePortPath={hardwarePortPath} setHardwarePortPath={setHardwarePortPath} resolvedHardwarePort={resolvedHardwarePort} hardwareAvailablePorts={hardwareAvailablePorts} showAllHardwarePorts={showAllHardwarePorts} setShowAllHardwarePorts={setShowAllHardwarePorts} refreshHardwarePorts={refreshHardwarePorts} isLoadingHardwarePorts={isLoadingHardwarePorts} hardwareBaudRate={hardwareBaudRate} setHardwareBaudRate={setHardwareBaudRate} hardwareResetMethod={hardwareResetMethod} setHardwareResetMethod={setHardwareResetMethod} connectHardwareSerial={connectHardwareSerial} disconnectHardwareSerial={disconnectHardwareSerial} uploadToHardware={handleUploadToHardware} hardwareConnected={hardwareConnected} hardwareConnecting={hardwareConnecting} isUploadingHardware={isUploadingHardware} hardwareStatus={hardwareStatus} />



      {/* WIRING MODE HINT */}
      {wireStart && (
        <div className="bg-[rgba(255,145,0,.1)] border-b border-[rgba(255,145,0,.25)] text-[var(--orange)] px-5 py-2 text-[13px] flex items-center shrink-0" style={{ background: 'rgba(255,170,0,.12)', borderColor: 'rgba(255,170,0,.3)', color: 'var(--orange)' }}>
          〰 <strong>Wiring in progress</strong> — Click another pin to connect. Press Esc to cancel.
          <span style={{ marginLeft: 12 }}>🔵 Started from <strong>{wireStart.compId} [{wireStart.pinLabel}]</strong></span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* PALETTE — hover to expand */}
        <aside
          className="bg-[var(--bg2)] border-r border-[var(--border)] overflow-y-auto overflow-x-hidden flex flex-col shrink-0"
          style={{
            width: isPaletteHovered ? 340 : 38,
            transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            zIndex: 10
          }}
          onMouseEnter={() => setIsPaletteHovered(true)}
          onMouseLeave={() => { if (!paletteContextMenu) { setIsPaletteHovered(false); setShowFilterDropdown(false); } }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {/* Collapsed indicator — visible only when closed */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
            opacity: isPaletteHovered ? 0 : 1, transition: 'opacity 0.15s', pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', writingMode: 'vertical-rl', letterSpacing: '0.1em' }}>Components</span>
          </div>

          {/* Full palette content */}
          <div style={{
            width: 340, opacity: isPaletteHovered ? 1 : 0, transition: 'opacity 0.2s',
            pointerEvents: isPaletteHovered ? 'auto' : 'none',
            display: 'flex', flexDirection: 'column', height: '100%',
          }}>
            {/* Sticky top section */}
            <div style={{ flexShrink: 0, padding: '10px 8px 0', background: 'var(--bg2)' }}>
              <div className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-widest px-2 pt-1 pb-2">Components</div>

              {/* Search + Filter + View Toggle */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                  <input
                    className="bg-[var(--card)] border border-[var(--border)] text-[var(--text)] pl-9 pr-3 rounded-lg text-xs w-full outline-none font-inherit box-border transition-all focus:border-[var(--accent)]"
                    style={{ flex: 1, height: 28, marginBottom: 0 }}
                    placeholder="Search..."
                    value={paletteSearch}
                    onChange={(e) => setPaletteSearch(e.target.value)}
                  />
                  {paletteSearch && (
                    <button onClick={() => setPaletteSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: 0.5, display: 'flex' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>

                <div className="filter-dropdown-container" style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: activeGroupFilter !== 'All' ? 'var(--accent)' : 'var(--card)', color: activeGroupFilter !== 'All' ? '#fff' : 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                    title="Filter by group"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
                  </button>

                  {showFilterDropdown && (
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 100, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', padding: 4, minWidth: 160 }}>
                      <div className="text-[10px] font-bold text-[var(--text3)] uppercase tracking-widest px-3 py-1.5 border-b border-[var(--border)] mb-1">Groups</div>
                      {['All', ...CATALOG.map(g => g.group)].map(group => (
                        <button
                          key={group}
                          onClick={() => { setActiveGroupFilter(group); setShowFilterDropdown(false); }}
                          style={{ width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: 6, border: 'none', background: activeGroupFilter === group ? 'var(--accent)' : 'transparent', color: activeGroupFilter === group ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}
                          onMouseEnter={e => { if (activeGroupFilter !== group) e.currentTarget.style.background = 'var(--bg3)'; }}
                          onMouseLeave={e => { if (activeGroupFilter !== group) e.currentTarget.style.background = 'transparent'; }}
                        >
                          {group === 'All' ? 'All Groups' : group}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setPaletteViewMode(m => m === 'list' ? 'grid' : 'list')}
                  style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}
                  title={paletteViewMode === 'list' ? 'Switch to Grid View' : 'Switch to List View'}
                >
                  {paletteViewMode === 'list' ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" /><rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" /><rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" /><rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" /></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="2" rx="1" fill="currentColor" /><rect x="1" y="7" width="14" height="2" rx="1" fill="currentColor" /><rect x="1" y="12" width="14" height="2" rx="1" fill="currentColor" /></svg>
                  )}
                </button>
              </div>

              {/* Upload ZIP + Create Component */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                <input type="file" ref={componentZipInputRef} onChange={handleUploadZip} accept=".zip" style={{ display: 'none' }} />
                <button
                  onClick={() => componentZipInputRef.current.click()}
                  style={{ flex: 1, padding: '7px 4px', borderRadius: 6, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3-4 3 4M1 9v1a1 1 0 001 1h8a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                  Upload ZIP
                </button>
                <button
                  onClick={() => window.open('/component-editor', '_blank')}
                  style={{ flex: 1, padding: '7px 4px', borderRadius: 6, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontWeight: 600 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  Create
                </button>
              </div>

              {/* Favourites section */}
              <div style={{ marginBottom: 6, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', overflow: 'hidden' }}>
                <button
                  onClick={() => setShowFavorites(f => !f)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'var(--bg3)', border: 'none', borderBottom: showFavorites ? '1px solid var(--border)' : 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1l1.5 3H11l-2.5 1.8.9 3L6 7.2 3.6 9.8l.9-3L2 5h3.5z" fill="#f59e0b" stroke="#f59e0b" strokeWidth="0.5" /></svg>
                    Favourites {favoriteComponents.size > 0 ? `(${favoriteComponents.size})` : ''}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    {showFavorites
                      ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 7l3-4 3 4" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      : <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3l3 4 3-4" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
                const isGroupMatch = activeGroupFilter === 'All' || group.group === activeGroupFilter;
                if (!isGroupMatch) return null;

                const filteredItems = group.items.filter(item =>
                  item.label.toLowerCase().includes(paletteSearch.toLowerCase()) ||
                  item.type.toLowerCase().includes(paletteSearch.toLowerCase())
                );
                if (filteredItems.length === 0) return null;
                const groupColor = GROUP_COLORS[group.group] || 'var(--accent)';
                return (
                  <div key={group.group || `group-${index}`} style={{ marginBottom: paletteViewMode === 'grid' ? 10 : 4 }}>
                    <div className="text-[10px] font-bold text-[var(--text3)] uppercase tracking-widest px-2 py-1 flex items-center gap-1" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
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
                                <div style={{ position: 'absolute', top: 'calc(50% - 7px)', left: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center center', pointerEvents: 'none', lineHeight: 0, width: compW, height: compH }}>
                                  {React.createElement(COMPONENT_REGISTRY[item.type].UI, { state: {}, attrs: {}, isRunning: false })}
                                </div>
                              ) : (
                                <div style={{ position: 'absolute', top: 'calc(50% - 7px)', left: '50%', transform: 'translate(-50%, -50%)' }}>
                                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={groupColor} strokeWidth="1.2" opacity="0.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
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
              <div key="palette-tip" className="mt-auto px-2 py-2.5 text-[11px] text-[var(--text3)] leading-relaxed">
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
                  action: () => {
                    const item = paletteContextMenu.item;
                    const registryInfo = COMPONENT_REGISTRY[item.type];
                    const editCopyData = {
                      manifest: registryInfo?.manifest || item,
                      logic: registryInfo?.logicRaw || '',
                      ui: registryInfo?.uiRaw || '',
                    };
                    localStorage.setItem('openhw_edit_copy', JSON.stringify(editCopyData));
                    window.open('/component-editor', '_blank');
                    setPaletteContextMenu(null);
                    setIsPaletteHovered(false);
                  }
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
          <div className="fixed inset-0 bg-[rgba(0,0,0,.55)] flex items-center justify-center z-[9999]" onClick={() => setShowCreateComponentModal(false)}>
            <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-6 w-[360px] shadow-[0_8px_40px_rgba(0,0,0,.4)]" onClick={e => e.stopPropagation()}>
              <div className="text-base font-bold mb-3.5 text-[var(--text)]">Create Component</div>
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
          className="flex-1 relative overflow-hidden bg-[var(--canvas-bg)] bg-[length:24px_24px]" style={{
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
            width: '10000px', height: '8000px',
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
                  transform: `translateX(-50%) translateY(-100%) scale(${1 / Math.max(canvasZoom, 0.01)})`,
                  transformOrigin: 'bottom center',
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
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--text3)] text-center pointer-events-none">
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
              const isSerialBoardSelected = serialBoardFilter !== 'all' && serialBoardFilter === comp.id
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

                  {/* Serial-target board ring */}
                  {isSerialBoardSelected && (() => {
                    const getBounds = () => {
                      const reg = COMPONENT_REGISTRY[comp.type];
                      if (!reg) return { x: 0, y: 0, w: comp.w, h: comp.h };
                      if (typeof reg.BOUNDS === 'function') return reg.BOUNDS(getComponentStateAttrs(comp));
                      return reg.BOUNDS || { x: 0, y: 0, w: comp.w, h: comp.h };
                    };
                    const b = getBounds();
                    return (
                      <>
                        <div style={{
                          position: 'absolute',
                          left: b.x - 10, top: b.y - 10,
                          width: b.w + 20, height: b.h + 20,
                          borderRadius: 10,
                          border: '2px dashed #38bdf8',
                          boxShadow: '0 0 18px rgba(56,189,248,.45)',
                          pointerEvents: 'none', zIndex: 9,
                        }} />
                        <div style={{
                          position: 'absolute',
                          left: b.x - 10,
                          top: b.y - 26,
                          background: '#0c4a6e',
                          color: '#e0f2fe',
                          border: '1px solid #38bdf8',
                          borderRadius: 6,
                          fontSize: 9,
                          padding: '1px 6px',
                          letterSpacing: '0.04em',
                          fontFamily: 'JetBrains Mono, monospace',
                          pointerEvents: 'none',
                          zIndex: 11,
                        }}>
                          SERIAL TARGET
                        </div>
                      </>
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
              data-export-ignore="true"
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
          {validationToast && (
            <div
              className="validation-toast-canvas"
              role="alert"
              data-export-ignore="true"
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
            >
              <div className="validation-toast-canvas__header">
                <span>{validationToast.title}</span>
                <button
                  type="button"
                  className="validation-toast-canvas__close"
                  onClick={() => setValidationToast(null)}
                  aria-label="Close validation notification"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
              <ul className="validation-toast-canvas__list">
                {validationToast.reasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          <div
            data-export-ignore="true"
            style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 100, display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 6px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onDoubleClick={e => e.stopPropagation()}
          >
            <button
              className="zoom-btn"
              onClick={() => setIsConsoleOpen(v => !v)}
              style={{
                background: isConsoleOpen ? 'var(--card)' : 'none',
                border: isConsoleOpen ? '1px solid var(--accent)' : 'none',
                color: isConsoleOpen ? 'var(--accent)' : 'var(--text)',
                cursor: 'pointer',
                lineHeight: 1,
                padding: '4px 7px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center'
              }}
              title="Toggle Console"
            >
              <TerminalIcon size={16} />
            </button>
            <button
              className="zoom-btn"
              onClick={() => setCanvasZoom(z => Math.max(0.25, parseFloat((z - 0.25).toFixed(2))))}
              style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', lineHeight: 1, padding: '4px 7px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
              title="Zoom Out"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
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
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
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
                  <button className="canvas-menu-item" onClick={() => { setShowConnectionsPanel(p => !p); setShowCanvasMenu(false); }}>{showConnectionsPanel ? 'Hide Connections Panel' : 'Show Connections Panel'}</button>
                  <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                  <button className="canvas-menu-item canvas-menu-item--danger" onClick={() => { if (!isRunning) { saveHistory(); setComponents([]); setWires([]); setSelected(null); } setShowCanvasMenu(false); }}>Clear Canvas</button>
                </div>
              )}
            </div>
          </div>

          <SimulationConsolePanel
            isOpen={isConsoleOpen}
            height={consoleHeight}
            entries={consoleEntries}
            onResizeStart={onMouseDownConsoleResize}
            onClose={() => setIsConsoleOpen(false)}
            onClear={clearConsoleEntries}
            onDownload={downloadConsoleLog}
          />

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
        <RightPanel
          isPanelOpen={isPanelOpen} panelWidth={panelWidth} isDragging={isDragging} onMouseDownResize={onMouseDownResize} setIsPanelOpen={setIsPanelOpen}
          explorerWidth={explorerWidth} isExplorerDragging={isExplorerDragging} onMouseDownExplorerResize={onMouseDownExplorerResize}
          selected={selected} setSelected={setSelected}
          validationErrors={validationErrors} showValidation={showValidation} setShowValidation={setShowValidation}
          codeTab={codeTab} setCodeTab={setCodeTab} code={code} setCode={setCode}
          projectFiles={projectFiles} openCodeTabs={openCodeTabs} activeCodeFileId={activeCodeFileId} showCodeExplorer={showCodeExplorer}
          onToggleCodeExplorer={() => setShowCodeExplorer(v => !v)} onOpenCodeFile={openCodeFile} onCloseCodeTab={closeCodeTab}
          onSaveCodeFile={saveCodeFile} onDuplicateCodeFile={duplicateCodeFile} onRenameCodeFile={renameCodeFile} onDeleteCodeFile={deleteCodeFile} onDownloadCodeFile={downloadCodeFile}
          onCreateCodeFile={createCodeFile} onCreateCodeTab={createCodeTab}
          libQuery={libQuery} setLibQuery={setLibQuery} handleSearchLibraries={handleSearchLibraries} isSearchingLib={isSearchingLib} libMessage={libMessage} libInstalled={libInstalled} libResults={libResults} handleInstallLibrary={handleInstallLibrary} installingLib={installingLib}
          serialPaused={serialPaused} setSerialPaused={setSerialPaused} isRunning={isRunning} serialHistory={serialHistory} setSerialHistory={setSerialHistory} serialOutputRef={serialOutputRef} serialInput={serialInput} setSerialInput={setSerialInput} sendSerialInput={sendSerialInput}
          serialViewMode={serialViewMode} setSerialViewMode={setSerialViewMode} serialBoardFilter={serialBoardFilter} setSerialBoardFilter={setSerialBoardFilter} serialBoardOptions={serialBoardOptions} serialBoardLabels={serialBoardLabels} serialBaudRate={serialBaudRate} setSerialBaudRate={setSerialBaudRate} serialBaudOptions={serialBaudOptions}
          hardwareConnected={hardwareConnected}
          plotterPaused={plotterPaused} setPlotterPaused={setPlotterPaused} plotData={plotData} setPlotData={setPlotData} selectedPlotPins={selectedPlotPins} setSelectedPlotPins={setSelectedPlotPins} plotterCanvasRef={plotterCanvasRef} serialPlotLabelsRef={serialPlotLabelsRef}
          showConnectionsPanel={showConnectionsPanel} wires={wires} updateWireColor={updateWireColor} deleteWire={deleteWire}
        />
      </div>

      {/* ── SAVE DIALOG ──────────────────────────────────────────────────────── */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,.55)] flex items-center justify-center z-[9999]" onClick={() => setShowSaveDialog(false)}>
          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-6 w-[360px] shadow-[0_8px_40px_rgba(0,0,0,.4)]" onClick={e => e.stopPropagation()}>
            <div className="text-base font-bold mb-3.5 text-[var(--text)]">Save Project</div>
            <input
              autoFocus
              className="bg-[var(--card)] border border-[var(--border)] text-[var(--text)] px-2.5 py-1.5 rounded-lg text-xs w-full mb-2 outline-none font-inherit box-border" style={{ marginBottom: 16, fontSize: 14, padding: '10px 12px' }}
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



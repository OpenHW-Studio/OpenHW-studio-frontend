import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useGamification } from "../../context/GamificationContext.jsx";
import { PROJECTS } from "../../services/gamification/ProjectsConfig.js";
import { COMPONENT_MAP } from "../../services/gamification/ComponentsConfig.js";
import {
  compileCode,
  flashFirmware,
  fetchInstalledLibraries,
  searchLibraries,
  installLibrary,
  submitCustomComponent,
  fetchInstalledComponentsWithFiles,
  createSharedSimulation,
  fetchSharedSimulation,
  fetchLiveSimulationSession,
  buildLiveSimulationWsUrl,
  fetchPublicInstalledComponents,
  fetchComponentsVersion,
  API_BASE_URL,
  startEsp32Compile,
  getEsp32CompileStatus
} from '../../services/simulatorService.js'
import { getCachedComponents, getCachedServerHash, setCachedComponents, clearComponentCache } from '../../services/componentCache.js'
import { getMyAssignmentSubmission, submitAssignment } from '../../services/classroomService.js'
import { uploadClassroomFiles } from '../../components/teacher/class-detail/uploadUtils.js'
import StudentAssignmentModal from '../../components/teacher/class-detail/StudentAssignmentModal.jsx'
import { getCachedHex, setCachedHex, enqueueComponent, getQueuedComponents, dequeueComponent } from '../../services/offlineCache.js'
import { saveProject, loadProject, listProjects, deleteProject, renameProject, generateProjectId, formatProjectDate } from '../../services/projectStore.js'
import html2canvas from 'html2canvas'
import JSZip from 'jszip';
import { GENERATED_ROOT_FILE_IDS, fileExt, isFileDisabled, normalizeProjectFiles, getBoardCompileFiles as getBoardCompileFilesShared, extractProjectMetaFromPng } from '../../utils/projectCompilerUtils';

// Modular Imports
import { TopToolbox } from "./TopToolbox";
import { isComponentHidden, getComponentWarning } from "./utils/componentVisibilityConfig";
import {
  calculateProjectPlanApplication,
  getRotatedPoint,
  getComponentWorldPins,
  findNearestBreadboardHole,
  robustSnapComponent,
  mergeCodeSnippet,
  removeCodeSnippet,
  getBoardColors,
  getDefaultMainFileName,
  toBoardRelativePath,
  normalizeOpenCodeTabs,
  buildProjectPayload,
  normalizeImportedCircuitData,
} from "./projectUtils";
import { importWokwiProjectZip } from "./wokwiImportUtils";
import { snapToGrid, resolveAllWiresWaypoints } from "./utils/snappingUtils";
import { resolveUiExport } from "./utils/simulatorUtils";
import { useAutowiring } from "../../hooks/useAutowiring";
import { Btn } from "./Btn";
import { RightPanel } from "./RightPanel";
import { ProjectsSidebarChrome } from "./components/ProjectsSidebar";
import { SerialOutputPane, SerialSendRow } from "./components/SerialMonitor";
import { multiRoutePath, wireColor } from "./wireUtils";
import { getResolvedPinExitSide } from "../../utils/pinExit.js";
import { useSimulatorShortcuts } from "./hooks/useSimulatorShortcuts";
import { simplifyOrthogonalPath } from "./utils/wireHitDetection";
import { useEditorStore } from "./store/useEditorStore";
import { useWebSerialHardware } from "./webSerialHardware";
import { useHardwareFlashing } from "./useHardwareFlashing";
import { useEsp32Engine } from "./hooks/useEsp32Engine.js";
import {
  SimulationConsolePanel,
  TerminalIcon,
  useSimulationConsole,
} from "./SimulationConsole";
import QuickAddPortal from "./QuickAddPortal";
import TourGuide from "./components/TourGuide";
import { useTourLogic } from "./hooks/useTourLogic";
import PalettePanel from "./PalettePanel";
import { useTelemetryManager } from "./services/TelemetryManager";
import { ComponentTelemetrySelectModal } from "./components/ComponentTelemetrySelectModal";

import {
  ComponentContextMenu,
  ComponentRenamePanel,
  ComponentValuePanel,
} from "./ComponentContextMenu";
import { CanvasSceneLayer } from "./components/CanvasSceneLayer";
import { DisplayRenderProvider } from "./context/DisplayRenderContext";
import { CreateComponentModal } from "./components/CreateComponentModal";
import { ComponentInspectorPanel } from "./components/ComponentInspectorPanel";
import { GamificationGuidePanel } from "./components/GamificationGuidePanel";
import { SimulatorDialogsGroup } from "./components/SimulatorDialogsGroup";
import { SimulatorChromeOverlays } from "./components/SimulatorChromeOverlays";
import { SimulatorStatusBanners } from "./components/SimulatorStatusBanners";
import { SimulatorRuntimePanel } from "./components/SimulatorRuntimePanel";
import { CanvasBottomControls } from "./components/CanvasBottomControls";
import { F1MenuOverlay } from "./components/F1MenuOverlay";
import AutofixPreviewPanel from "../../components/AutofixPreviewPanel.jsx";

import * as EmulatorComponents from "@openhw/emulator";

const {
  FullCircuitValidator,
  analyzeCodeHardwareSync,
  runUnifiedValidation,
  ProtocolAnalyzer: SharedProtocolAnalyzer,
} = EmulatorComponents;

import {
  BOARD_BAUD_PRESETS,
  BOARD_DEFAULT_BAUD,
  SERIAL_LINE_ENDINGS,
  BOARD_FQBN,
  BOARD_DISPLAY_NAME,
  UF2_PAYLOAD_PREFIX,
  DEFAULT_PICO_MICROPYTHON_UF2_URL,
  DEFAULT_PICO_CIRCUITPYTHON_UF2_URL,
  DEFAULT_PICO_CIRCUITPYTHON_VERSION,
  DISABLED_FILE_SUFFIX,
  ARDUINO_CODE_EXTENSIONS,
  ROOT_UPLOADABLE_EXTENSIONS,
  RP2040_NATIVE_ALLOWED_EXTENSIONS,
  RP2040_MICROPYTHON_ALLOWED_EXTENSIONS,
  GROUP_MAPPING,
} from "./constants/simulatorConstants";

import { GROUP_ICON_SVG, GROUP_COLORS } from "./constants/groupVisuals";

import {
  COMPONENT_REGISTRY,
  LOCAL_PIN_DEFS,
  BUILTIN_COMPONENT_TYPES,
  LOCAL_CATALOG,
  injectComponentsIntoRegistry,
  buildCatalog,
  buildUiSourceFromRegistry,
  buildLogicSourceFromRegistry,
  buildValidationSourceFromRegistry,
  buildIndexSourceFromRegistry,
  normalizeGroupName,
  sortCatalog,
} from "./utils/componentRegistry";

import {
  fnv1aHash,
  computeRenderSyncHash,
  normalizeHashValue,
  extractCompileSummaryLines,
  formatRunDuration,
  toPascalCase,
  extractFunctionSource,
  allocateComponentId,
  resolveComponentIdFormat,
  arrayBufferToBase64,
} from "./utils/simulatorUtils";

import {
  getBabel,
  getHtml2canvas,
  ensureExportLogo,
  getSerializedShadowSheet,
  cleanupEditCopyPayloadStorage,
  writeEditCopyPayload,
} from "./utils/exportUtils";

import {
  normalizeBoardKind,
  boardKindToDisplayName,
  boardCompToDisplayName,
  resolveBoardFqbnForComponent,
  normalizeRp2040Env,
  createDefaultMainCode,
  isRp2040PythonEnv,
  getRp2040PythonEntryFileName,
  mapRp2040EnvForLegacyContextMenu,
  looksLikeMicroPythonSource,
  arduinoBlinkToMicroPython,
  arduinoSerialToMicroPython,
  prepareRp2040SketchForSimulation,
  resolveRp2040SourceMode,
  resolveComponentAttrString,
  ensureMicroPythonSerialProbe,
  applyRp2040MicroPythonCompat,
  isProgrammableBoardType,
  isBreadboardType,
  isResistorType,
  isMotorType,
  isStepperMotorType,
  endpointAliases,
  hasCategoryIntersection,
  getPinCategory,
} from "./utils/hardwareUtils";

// Web Editor features
import EditorComponent from "react-simple-code-editor";
const Editor = EditorComponent.default || EditorComponent;
import BlocklyEditor from "../../components/BlocklyEditor.jsx";
import Prism from "prismjs/components/prism-core";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/themes/prism-tomorrow.css";

import {
  EXAMPLES_BASE_URL,
  getDemoCircuitUrl,
  loadExampleProjectData,
} from "../../services/exampleLoaderService.js";

const EDIT_COPY_KEY = "openhw_edit_copy";
const EDIT_COPY_PAYLOAD_PREFIX = "openhw_edit_copy_payload_";
const RP2040_SIM_PROTOCOL_VERSION = "rp2040-sim-uart0-v4";
const UNSAFE_DYNAMIC_CODE_PATTERN =
  /\b(?:importScripts|XMLHttpRequest|WebSocket|EventSource|SharedWorker|Worker|navigator\.sendBeacon|document\.cookie|localStorage|sessionStorage|indexedDB)\b|(?:\bfetch\s*\()|(?:\beval\s*\()|(?:\bnew\s+Function\b)/i;

function assertSafeDynamicModule(code, label) {
  const cleanCode = String(code || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(?:^|[^:])\/\/[^\r\n]*/g, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, '')
    .replace(/"(?:[^"\\]|\\.)*"/g, '')
    .replace(/`(?:[^`\\]|\\.)*`/g, '');
  if (UNSAFE_DYNAMIC_CODE_PATTERN.test(cleanCode)) {
    throw new Error(`${label} uses blocked browser APIs in sandbox mode`);
  }
}

function isRp2040CoreMissingError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return (
    msg.includes("platform 'rp2040:rp2040' not found") ||
    msg.includes("platform rp2040:rp2040 is not found") ||
    msg.includes("platform not installed")
  );
}

// Tracks component types that were dynamically injected from the backend (not built-in).
const BACKEND_INJECTED_TYPES = new Set();

// Cache for high-fidelity PNG exports to prevent redundant rendering
const _exportPngResultCache = new Map();

let nextWireId = 1;
const EMPTY_LIVE_STATE = {};

function syncNextIds(components, wires) {
  let max = 0;
  (wires || []).forEach((w) => {
    const m = String(w.id || "").match(/^w(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  nextWireId = max + 1;
}

const autoConnectPowerRails = (newComp, existingComponents, currentWires) => {
  let newWires = [...currentWires];

  const getPinX = (c, p) => {
    if (!p) return 0;
    if (p.x !== undefined) return p.x;
    if (c.type.includes('pico')) {
      const n = parseInt(p.id);
      if (!isNaN(n)) return n <= 20 ? 0 : (c.w || 60);
    }
    return (c.w || 60) / 2;
  };

  const getPinY = (c, p) => {
    if (!p) return 0;
    if (p.y !== undefined) return p.y;
    return (c.h || 60) / 2;
  };

  const getBestPowerPins = (comp, bb) => {
    const pins = LOCAL_PIN_DEFS[comp.type] || [];
    const bbPins = LOCAL_PIN_DEFS[bb.type] || [];

    const bbVccPins = bbPins.filter(p => p.id.startsWith('top_vcc') || p.id.startsWith('bottom_vcc') || p.id === 't+' || p.id === 'b+' || p.id === 'VCC' || p.id === '5V');
    const bbGndPins = bbPins.filter(p => p.id.startsWith('top_gnd') || p.id.startsWith('bottom_gnd') || p.id === 't-' || p.id === 'b-' || p.id === 'GND');

    const isOccupied = (pinId) => newWires.some(w => w.from === `${bb.id}:${pinId}` || w.to === `${bb.id}:${pinId}`);

    const availableBbVccPins = bbVccPins.filter(p => !isOccupied(p.id));
    const availableBbGndPins = bbGndPins.filter(p => !isOccupied(p.id));

    const finalBbVccPins = availableBbVccPins.length > 0 ? availableBbVccPins : (bbVccPins.length > 0 ? [bbVccPins[0]] : []);
    const finalBbGndPins = availableBbGndPins.length > 0 ? availableBbGndPins : (bbGndPins.length > 0 ? [bbGndPins[0]] : []);

    if (finalBbVccPins.length === 0 || finalBbGndPins.length === 0) return null;

    const vccPins = [];
    const gndPins = [];

    pins.forEach(pin => {
      const cats = getPinCategory(pin.id, pin.description || '', comp.type) || [];
      if (cats.includes('POWER') || cats.includes('VIN')) vccPins.push(pin);
      if (cats.includes('GND')) gndPins.push(pin);
    });

    // Force all Arduino boards (Uno, Mega, Nano, etc.) to use 5V by eliminating the 3.3V pin from consideration
    if (comp.type.includes('arduino')) {
      for (let i = vccPins.length - 1; i >= 0; i--) {
        const idAndDesc = ((vccPins[i].id || '') + ' ' + (vccPins[i].description || '')).toUpperCase();
        if (idAndDesc.includes('3.3') || idAndDesc.includes('3V3')) {
          vccPins.splice(i, 1);
        }
      }
    }

    if (vccPins.length === 0 && gndPins.length === 0) return null;

    let bestScore = Infinity;
    let bestPair = { vcc: vccPins[0] || null, gnd: gndPins[0] || null, bbVcc: finalBbVccPins[0].id, bbGnd: finalBbGndPins[0].id };

    const vccList = vccPins.length > 0 ? vccPins : [null];
    const gndList = gndPins.length > 0 ? gndPins : [null];


    vccList.forEach(vcc => {
      const vccX = vcc ? comp.x + getPinX(comp, vcc) : 0;
      const vccY = vcc ? comp.y + getPinY(comp, vcc) : 0;

      let voltageType = null;
      if (vcc) {
        const idAndDesc = ((vcc.id || '') + ' ' + (vcc.description || '')).toUpperCase();
        if (idAndDesc.includes('3.3') || idAndDesc.includes('3V3')) voltageType = '3.3V';
        else if (idAndDesc.includes('5V')) voltageType = '5V';
      }

      gndList.forEach(gnd => {
        const gndX = gnd ? comp.x + getPinX(comp, gnd) : 0;
        const gndY = gnd ? comp.y + getPinY(comp, gnd) : 0;

        finalBbVccPins.forEach(bbVcc => {
          const bbVccX = bb.x + (bbVcc.x || 0);
          const bbVccY = bb.y + (bbVcc.y || 0);
          const distToBbVcc = vcc ? Math.hypot(vccX - bbVccX, vccY - bbVccY) : 0;

          finalBbGndPins.forEach(bbGnd => {
            const bbGndX = bb.x + (bbGnd.x || 0);
            const bbGndY = bb.y + (bbGnd.y || 0);
            const distToBbGnd = gnd ? Math.hypot(gndX - bbGndX, gndY - bbGndY) : 0;

            const pinDist = (vcc && gnd) ? Math.hypot(vccX - gndX, vccY - gndY) : 0;

            let score = (pinDist * 5) + distToBbVcc + distToBbGnd;

            // Offset the wires diagonally so they don't overlap. Always shift in the same direction so consecutive components don't interleave/criss-cross.
            if (vcc && gnd && bbVccX >= bbGndX) {
              score += 100;
            }

            if (voltageType === '3.3V' && (bbVcc.id.startsWith('bottom_') || bbGnd.id.startsWith('bottom_'))) {
              score += 5000;
            } else if (voltageType === '5V' && (bbVcc.id.startsWith('top_') || bbGnd.id.startsWith('top_'))) {
              score += 5000;
            }

            if (score < bestScore) {
              bestScore = score;
              bestPair = { vcc, gnd, bbVcc: bbVcc.id, bbGnd: bbGnd.id };
            }
          });
        });
      });
    });

    return bestPair;
  };

  const connectCompToBb = (comp, bb) => {
    const pair = getBestPowerPins(comp, bb);
    if (!pair) return;

    const bbPins = LOCAL_PIN_DEFS[bb.type] || [];

    const makeCleanWaypoints = (compPin, bbPinId) => {
      const cx = comp.x + getPinX(comp, compPin);
      const cy = comp.y + getPinY(comp, compPin);
      const bbPinDef = bbPins.find(p => p.id === bbPinId);
      const bx = bb.x + (bbPinDef?.x || 0);
      const by = bb.y + (bbPinDef?.y || 0);
      // Clean L-shape: go vertically to the breadboard rail Y, then horizontally
      if (Math.abs(cy - by) > Math.abs(cx - bx)) {
        return [{ x: cx, y: by, _corner: true }];
      }
      // If mostly horizontal, go horizontally first then vertically
      return [{ x: bx, y: cy, _corner: true }];
    };

    if (pair.vcc) {
      const alreadyWired = newWires.some(w =>
        w.from === `${comp.id}:${pair.vcc.id}` || w.to === `${comp.id}:${pair.vcc.id}`
      );
      if (!alreadyWired) {
        // Detect voltage type for wire color: orange for 3.3V, red for 5V
        const vccIdDesc = ((pair.vcc.id || '') + ' ' + (pair.vcc.description || '')).toUpperCase();
        const is3v3 = vccIdDesc.includes('3.3') || vccIdDesc.includes('3V3');
        newWires.push({
          id: `w${nextWireId++}`,
          from: `${comp.id}:${pair.vcc.id}`,
          to: `${bb.id}:${pair.bbVcc}`,
          color: is3v3 ? '#f97316' : 'red',
          isBelow: false,
          waypoints: makeCleanWaypoints(pair.vcc, pair.bbVcc)
        });
      }
    }
    if (pair.gnd) {
      const alreadyWired = newWires.some(w =>
        w.from === `${comp.id}:${pair.gnd.id}` || w.to === `${comp.id}:${pair.gnd.id}`
      );
      if (!alreadyWired) {
        newWires.push({
          id: `w${nextWireId++}`,
          from: `${comp.id}:${pair.gnd.id}`,
          to: `${bb.id}:${pair.bbGnd}`,
          color: 'black',
          isBelow: false,
          waypoints: makeCleanWaypoints(pair.gnd, pair.bbGnd)
        });
      }
    }
  };

  if (isBreadboardType(newComp.type)) {
    existingComponents.forEach(comp => {
      if (!isBreadboardType(comp.type)) {
        connectCompToBb(comp, newComp);
      }
    });
  } else {
    // If a new component is added, find the first breadboard and wire to it
    const bb = existingComponents.find(c => isBreadboardType(c.type));
    if (bb) {
      connectCompToBb(newComp, bb);
    }
  }

  return newWires;
};

export function SimulatorPage({ gamificationMode = false, returnTo = null }) {
  const {
    isAuthenticated,
    isAdminAuthenticated,
    user,
    adminUser,
    token,
    logout,
    loading: authLoading,
  } = useAuth();
  const activeUser = user || adminUser;
  const isAnyAuthenticated = isAuthenticated || isAdminAuthenticated;
  const navigate = useNavigate();
  const { generateAutonomousSetup } = useAutowiring();
  const {
    projectName = "",
    shareId = "",
    classId = "",
    assignmentId = "",
    liveCode = "",
  } = useParams();
  const location = useLocation();
  const [guidedProjectState, setGuidedProjectState] = useState(() => {
    if (location.state?.guidedProject) return { project: location.state.guidedProject, levelColor: location.state.levelColor || '#22c55e' }
    return null
  })
  const [activeBoard, setActiveBoard] = useState('arduino')
  const assessmentParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const assessmentMode = assessmentParams.get("mode") === "assessment";
  const assessmentProjectName = assessmentParams.get("project") || projectName;
  const assignmentMode = Boolean(classId && assignmentId);
  const studentAssignmentMode =
    assignmentMode && activeUser?.role === "student";
  const liveSessionCode = String(liveCode || "")
    .trim()
    .toUpperCase();
  const currentLiveUserId = String(activeUser?._id || activeUser?.id || "");
  const liveRoleParam = String(assessmentParams.get("role") || "")
    .trim()
    .toLowerCase();
  const liveMeetingMode = Boolean(liveSessionCode);
  const isLiveTeacher = liveMeetingMode && liveRoleParam === "teacher";
  const isLiveStudent = liveMeetingMode && !isLiveTeacher;
  const canvasOnly = assessmentParams.get("canvas-only") === "1";
  const readOnly = assessmentParams.get("readonly") === "1";

  // -- Gamification --
  const {
    trackComponentPlaced,
    trackWireDrawn,
    trackSimulationRun,
    isUnlocked,
    coins = 0,
    currentLevel,
    currentLevelData,
    nextLevel,
    xpProgress,
    unlockedComponents,
  } = typeof useGamification === "function" ? useGamification() : {};
  const gamProject = useMemo(
    () =>
      gamificationMode && typeof PROJECTS !== "undefined"
        ? (PROJECTS.find((p) => p.slug === projectName) ?? null)
        : null,
    [gamificationMode, projectName],
  );
  const [gamPanelOpen, setGamPanelOpen] = useState(true);
  const [gamTab, setGamTab] = useState("components");
  const WOKWI_TO_COMP_ID = useMemo(
    () => ({
      "wokwi-led": "led",
      "openhw-led": "led",
      "wokwi-resistor": "resistor",
      "openhw-resistor": "resistor",
      "wokwi-pushbutton": "button",
      "openhw-pushbutton": "button",
      "wokwi-potentiometer": "potentiometer",
      "openhw-potentiometer": "potentiometer",
      "wokwi-slide-potentiometer": "potentiometer",
      "openhw-slide-potentiometer": "potentiometer",
      "wokwi-buzzer": "buzzer",
      "openhw-buzzer": "buzzer",
      "wokwi-rgb-led": "rgb-led",
      "openhw-rgb-led": "rgb-led",
      "wokwi-ntc-temperature-sensor": "dht11",
      "openhw-ntc-temperature-sensor": "dht11",
      "wokwi-dht22": "dht22",
      "openhw-dht22": "dht22",
      "wokwi-hc-sr04": "ultrasonic",
      "openhw-hc-sr04": "ultrasonic",
      "wokwi-servo": "servo",
      "openhw-servo": "servo",
      "wokwi-lcd1602": "lcd",
      "wokwi-lcd1602-i2c": "lcd",
      "openhw-lcd1602-i2c": "lcd",
      "wokwi-lcd2004-i2c": "lcd",
      "openhw-lcd2004-i2c": "lcd",
      "wokwi-analog-joystick": "analog-joystick",
      "openhw-analog-joystick": "analog-joystick",
      "wokwi-membrane-keypad": "keypad",
      "openhw-membrane-keypad": "keypad",
      "wokwi-rotary-encoder": "rotary-encoder",
      "openhw-rotary-encoder": "rotary-encoder",
      "wokwi-nokia-5110": "nokia-5110",
      "openhw-nokia-5110": "nokia-5110",
      "wokwi-soil-moisture-sensor": "soil-moisture-sensor",
      "openhw-soil-moisture-sensor": "soil-moisture-sensor",
      "wokwi-logic-analyzer": "logic-analyzer",
      "openhw-logic-analyzer": "logic-analyzer",
      "wokwi-sd-card": "sd-card",
      "openhw-sd-card": "sd-card",
      "wokwi-ldr-module": "ldr-module",
      "openhw-ldr-module": "ldr-module",
      "wokwi-tm1637-7segment": "tm1637-7segment",
      "openhw-tm1637-7segment": "tm1637-7segment",
      "wokwi-cd74hc4067": "cd74hc4067",
      "openhw-cd74hc4067": "cd74hc4067",
      "wokwi-7segment": "7segment",
      "openhw-7segment": "7segment",
      "wokwi-a4988": "a4988",
      "openhw-a4988": "a4988",
      "wokwi-bmp180": "bmp180",
      "openhw-bmp180": "bmp180",
      "wokwi-bmp180-breakout": "bmp180",
      "openhw-bmp180-breakout": "bmp180",
      "wokwi-ds1307-rtc": "rtc",
      "openhw-ds1307-rtc": "rtc",
      "wokwi-ili9341": "ili9341",
      "openhw-ili9341": "ili9341",
      "wokwi-l293d": "l293d",
      "openhw-l293d": "l293d",
      "wokwi-max7219": "max7219",
      "openhw-max7219": "max7219",
      "wokwi-mpu6050": "mpu6050",
      "openhw-mpu6050": "mpu6050",
      "wokwi-nlsf595": "nlsf595",
      "openhw-nlsf595": "nlsf595",
      "wokwi-pca9685": "pca9685",
      "openhw-pca9685": "pca9685",
      "wokwi-pca9865": "pca9865",
      "openhw-pca9865": "pca9865",
      "wokwi-relay-module": "relay",
      "openhw-relay-module": "relay",
      "wokwi-ssd1306-oled": "oled",
      "openhw-ssd1306-oled": "oled",
      "wokwi-stepper-motor": "stepper",
      "openhw-stepper-motor": "stepper",
      "wokwi-arduino-uno": "uno",
      "openhw-arduino-uno": "uno",
      "wokwi-arduino-mega": "mega",
      "openhw-arduino-mega": "mega",
      "wokwi-arduino-nano": "nano",
      "openhw-arduino-nano": "nano",
      "wokwi-attiny85": "attiny85",
      "openhw-attiny85": "attiny85",
      "wokwi-raspberry-pi-pico": "pico",
      "openhw-pico": "pico",
      "wokwi-raspberry-pi-pico-w": "pico-w",
      "openhw-pico-w": "pico-w",
      "wokwi-power-supply": "power-supply",
      "openhw-power-supply": "power-supply",
      "wokwi-battery": "battery",
      "openhw-battery": "battery",
      "wokwi-charger": "charger",
      "openhw-charger": "charger",
      "wokwi-breadboard": "breadboard",
      "openhw-breadboard": "breadboard",
      "wokwi-breadboard-half": "breadboard",
      "openhw-breadboard-half": "breadboard",
      "wokwi-breadboard-mini": "breadboard",
      "openhw-breadboard-mini": "breadboard",
      "wokwi-neopixel-matrix": "neopixel",
      "openhw-neopixel-matrix": "neopixel",
      "wokwi-neopixel-ring": "neopixel",
      "openhw-neopixel-ring": "neopixel",
      "wokwi-arduino-sensor-shield": "shield",
      "openhw-arduino-sensor-shield": "shield",
    }),
    [],
  );

  const isPaletteItemLocked = useCallback(
    (itemType) => {
      // Lock components for students everywhere based on their progress
      if (activeUser?.role !== 'student') return false;
      const compId = WOKWI_TO_COMP_ID[itemType];
      if (!compId) return false;
      return isUnlocked ? !isUnlocked(itemType) : false;
    },
    [isUnlocked, WOKWI_TO_COMP_ID, activeUser?.role],
  );

  const gamProjectComponents = useMemo(() => {
    if (!gamProject?.components) return [];
    return gamProject.components.map((c) => {
      const compId = WOKWI_TO_COMP_ID[c.type];
      const compDef =
        compId && typeof COMPONENT_MAP !== "undefined"
          ? COMPONENT_MAP[compId]
          : null;
      const isLocked = (compId && isUnlocked && activeUser?.role === 'student') ? !isUnlocked(c.type) : false;
      return { ...c, compId, compDef, isLocked };
    });
  }, [gamProject, isUnlocked, WOKWI_TO_COMP_ID]);

  const gamLockedCount = gamProjectComponents.filter(
    (c) => c.isLocked && c.compId,
  ).length;
  const gamAllUnlockedGlobally = unlockedComponents === '*';
  const gamAllUnlocked = gamProject ? gamLockedCount === 0 : gamAllUnlockedGlobally;

  const handleAssessmentSubmit = async () => {
    if (!assessmentMode && !gamificationMode) return;
    const assessmentName = assessmentMode ? assessmentProjectName : projectName;
    if (!assessmentName) {
      alert(
        "Assessment project is missing. Please open assessment from the project page.",
      );
      return;
    }
    setIsSubmittingAssessment(true);
    try {
      const payload = {
        projectName: assessmentName,
        submittedAt: new Date().toISOString(),
        components,
        wires,
        code,
      };
      sessionStorage.setItem(`openhw_assessment_submission:${assessmentName}`, JSON.stringify(payload));
      // Preserve classId when navigating to assessment page to maintain class context
      const targetPath = classId
        ? `/${assessmentName}/assessment?classId=${encodeURIComponent(classId)}`
        : `/${assessmentName}/assessment`;
      // If running in iframe (guided mode), navigate parent window to replace the whole page
      if (window.self !== window.top) {
        window.parent.location.href = targetPath;
      } else {
        navigate(targetPath);
      }
    } finally {
      setIsSubmittingAssessment(false);
    }
  };

  const handleGamificationSubmit = useCallback(() => {
    if (!gamAllUnlocked) {
      alert(
        `Unlock ${gamLockedCount} component${gamLockedCount > 1 ? "s" : ""} first!`,
      );
      return;
    }
    handleAssessmentSubmit();
  }, [gamAllUnlocked, gamLockedCount, handleAssessmentSubmit]);

  // Incremented whenever backend components are injected/updated so catalog consumers re-render
  const [customCatalogVersion, setCustomCatalogVersion] = useState(0);

  // Theme Logic — defaults to light mode
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "dark",
  );
  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme); // Save choice
  };

  const [, setCustomCatalogCounter] = useState(0); // Trigger palette re-render on injection
  const [previewBanner, setPreviewBanner] = useState(null); // { id, label } — set when opened from admin "Test in Simulator"
  const [lockToast, setLockToast] = useState(null);
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false);
  const [autoWiringEnabled, setAutoWiringEnabled] = useState(false);
  const [autoBreadboardEnabled, setAutoBreadboardEnabled] = useState(false);
  const [autoCodingEnabled, setAutoCodingEnabled] = useState(false);
  const [isWiring, setIsWiring] = useState(false);
  const [wiringStartPin, setWiringStartPin] = useState(null);
  const [components, setComponents] = useState([]);
  const [wires, setWires] = useState([]);

  const [isLoadingGuidedSchema, setIsLoadingGuidedSchema] = useState(false)
  const [showComingSoon, setShowComingSoon] = useState(false)

  const doLoadGuidedSchema = (schema, label) => {
    setIsLoadingGuidedSchema(true)
    applyImportedProjectMeta(schema, label)
    setTimeout(() => {
      setIsLoadingGuidedSchema(false)
      fitToView("fit")
    }, 800)
  }

  const lastLoadedSlugRef = useRef(null)
  useEffect(() => {
    const project = guidedProjectState?.project
    const slug = project?.slug || (gamificationMode ? projectName : null)

    if (!slug || lastLoadedSlugRef.current === slug) return
    lastLoadedSlugRef.current = slug

    const loadFromSchema = () => {
      if (project?.schemas?.arduino) {
        doLoadGuidedSchema(project.schemas.arduino, 'Guided Project')
      } else {
        setIsLoadingGuidedSchema(false)
      }
    }

    const tryLoadFromPng = async () => {
      const result = await loadExampleProjectData(slug, EXAMPLES_BASE_URL);
      if (!result?.meta) throw new Error('Could not load example circuit data');
      applyImportedProjectMeta(result.meta, `Guided Project (${result.source})`);
    }

    setShowComingSoon(false)
    setIsLoadingGuidedSchema(true)
    tryLoadFromPng()
      .then(() => setTimeout(() => { setIsLoadingGuidedSchema(false); fitToView("fit") }, 800))
      .catch(async () => {
        if (project?.schemas?.arduino) {
          loadFromSchema()
        } else if ((canvasOnly || gamificationMode) && slug) {
          try {
            const data = await import("../../services/guidedProjects.json")
            const root = data.default || data
            for (const level of Object.values(root)) {
              for (const cat of Object.values(level.categories || {})) {
                const found = cat.projects.find(p => p.slug === slug)
                if (found?.schemas?.arduino) {
                  setGuidedProjectState({ project: found, levelColor: '#22c55e' })
                  doLoadGuidedSchema(found.schemas.arduino, 'Guided Project')
                  return
                }
              }
            }
          } catch { }
          setIsLoadingGuidedSchema(false)
          setShowComingSoon(true)
        } else {
          setIsLoadingGuidedSchema(false)
          setShowComingSoon(true)
        }
      })
  }, [guidedProjectState, gamificationMode, projectName, canvasOnly])

  const [history, setHistory] = useState({ past: [], future: [] });
  const [selected, setSelected] = useState(null); // comp or wire id
  const [wireStart, setWireStart] = useState(null); // { compId, pinId, pinLabel, x, y }
  const [wireClickPos, setWireClickPos] = useState(null); // canvas-space position where wire was clicked
  // Segment-drag: tracks which wire segment handle is being dragged
  // { wireId, segIdx, isHoriz, startMouseCanvas: {x,y}, startPts: [...] }
  const [segDrag, setSegDrag] = useState(null);
  const segDragRef = useRef(null);
  const [hoveredPin, setHoveredPin] = useState(null);
  const [board, setBoard] = useState("arduino_uno");
  const [restoreProjectPrompt, setRestoreProjectPrompt] = useState(null);
  const [codeTab, setCodeTab] = useState("code");
  const { code, setCode } = useEditorStore();
  const [solverMode, setSolverMode] = useState("logic");
  const [webGpuSupported, setWebGpuSupported] = useState(false);
  const [blocklyXml, setBlocklyXml] = useState("");
  const [compContextMenu, setCompContextMenu] = useState(null); // { x, y, compId }
  const [renameState, setRenameState] = useState({ id: null, x: 0, y: 0 });
  const [valueState, setValueState] = useState({ id: null, x: 0, y: 0, key: 'value' });
  const [showEngineSelector, setShowEngineSelector] = useState(false)
  const [esp32SimulationMode, setEsp32SimulationMode] = useState(() => {
    try {
      return localStorage.getItem('openhw.esp32.simulationMode') || 'qemu';
    } catch (_) {
      return 'qemu';
    }
  });

  const updateEsp32SimulationMode = useCallback((mode) => {
    setEsp32SimulationMode(mode);
    try {
      localStorage.setItem('openhw.esp32.simulationMode', mode);
    } catch (_) { }
  }, []);

  useEffect(() => {
    if (navigator.gpu) {
      setWebGpuSupported(true);
    }
  }, []);

  const [blocklyGeneratedCode, setBlocklyGeneratedCode] = useState("");
  const [useBlocklyCode, setUseBlocklyCode] = useState(false);
  const [blocklyDisabled, setBlocklyDisabled] = useState(() => {
    try {
      const saved = localStorage.getItem("ohw_blockly_disabled");
      // Default is DISABLED (true) if never explicitly set
      return saved === null ? true : saved === "true";
    } catch (_) {
      return true;
    }
  });
  const {
    projectFiles,
    setProjectFiles,
    openCodeTabs,
    setOpenCodeTabs,
    activeCodeFileId,
    setActiveCodeFileId,
    showCodeExplorer,
    setShowCodeExplorer,
    openCodeFile,
    closeCodeTab,
    saveCodeFile,
    duplicateCodeFile,
    renameCodeFile,
    toggleCodeFileDisabled,
    deleteCodeFile,
  } = useEditorStore();
  const projectFilesRef = useRef(projectFiles);
  useEffect(() => {
    projectFilesRef.current = projectFiles;
  }, [projectFiles]);
  const suppressCodeSyncRef = useRef(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(580);
  const [explorerWidth, setExplorerWidth] = useState(190);
  const [isDragging, setIsDragging] = useState(false);
  const [isExplorerDragging, setIsExplorerDragging] = useState(false);
  const [isComponentDragging, setIsComponentDragging] = useState(false);
  const [showCreateComponentModal, setShowCreateComponentModal] =
    useState(false);
  const handleCloseCreateComponentModal = useCallback(() => {
    setShowCreateComponentModal(false);
  }, []);
  const [showComponentDesc, setShowComponentDesc] = useState(false); // description panel visible
  const [showInspector, setShowInspector] = useState(false);
  const [hoveredElement, setHoveredElement] = useState(null); // { type: 'wire'|'pin'|'comp', id, data }
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const rightPanelRef = useRef(null);
  const isDraggingRef = useRef(false);
  const isExplorerDraggingRef = useRef(false);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);
  useEffect(() => {
    isExplorerDraggingRef.current = isExplorerDragging;
  }, [isExplorerDragging]);

  useEffect(() => {
    if (!components || components.length === 0 || !wires || wires.length === 0)
      return;
    const hasUnresolved = wires.some(
      (w) =>
        Array.isArray(w.routingInstructions) &&
        w.routingInstructions.length > 0,
    );
    if (!hasUnresolved) return;
    setWires((prev) =>
      resolveAllWiresWaypoints(prev, components, LOCAL_PIN_DEFS),
    );
  }, [components, wires]);

  const [serialViewMode, setSerialViewMode] = useState("monitor"); // 'monitor' | 'plotter'
  const [isPaletteHovered, setIsPaletteHovered] = useState(false);

  const {
    showTour,
    setShowTour,
    tourActiveStep,
    setTourActiveStep,
    handleFinishTour,
    handleTourDemoAction,
  } = useTourLogic({
    setComponents,
    setWires,
    setCodeTab,
    setIsPanelOpen,
    openCodeFile,
    setSerialViewMode,
    setIsPaletteHovered,
  });

  useEffect(() => {
    if (showInspector) {
      setIsWiring(false);
      setWiringStartPin(null);
    }
  }, [showInspector]);

  const [canvasZoom, setCanvasZoom] = useState(1);
  const [showCanvasMenu, setShowCanvasMenu] = useState(false);
  const [showConnectionsPanel, setShowConnectionsPanel] = useState(false);
  const [wirepointsEnabled, setWirepointsEnabled] = useState(false);
  const canvasZoomRef = useRef(1);
  const stateSabRef = useRef(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const canvasOffsetRef = useRef({ x: 0, y: 0 });
  const [isCanvasLocked, setIsCanvasLocked] = useState(false);
  const isCanvasLockedRef = useRef(false);
  const [showGrid, setShowGrid] = useState(true);
  const [isPinMappingExpanded, setIsPinMappingExpanded] = useState(false);
  const [pendingPinColors, setPendingPinColors] = useState({}); // { [pinIdStr]: color }
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wiresAlwaysOnTop, setWiresAlwaysOnTop] = useState(true);

  // Reset Pin Mapping expansion when a new component is selected
  useEffect(() => {
    setIsPinMappingExpanded(false);
  }, [selected]);
  // quickAdd state lives in QuickAddPortal — opened via custom DOM event
  const addComponentAtRef = useRef(null);
  const pageRef = useRef(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const didPanRef = useRef(false);

  const [validationErrors, setValidationErrors] = useState([]);
  const [pendingVerificationRule, setPendingVerificationRule] = useState(null);

  const [autofixPlan, setAutofixPlan] = useState(null);
  const [autofixStatus, setAutofixStatus] = useState("Ready");
  const [autofixLog, setAutofixLog] = useState([]);
  const [showAutofix, setShowAutofix] = useState(false);
  const autofixWorkerRef = useRef(null);

  const autofixDebounceTimerRef = useRef(null);

  const triggerAutofixAnalysis = useCallback(
    (
      forcedViolations = null,
      overriddenComponents = null,
      overriddenWires = null,
    ) => {
      if (autofixDebounceTimerRef.current) {
        clearTimeout(autofixDebounceTimerRef.current);
      }

      const run = () => {
        // PERFORMANCE OPTIMIZATION: Only run analysis if the panel is open or if explicitly forced
        if (!showAutofix && !forcedViolations) return;

        const violations = forcedViolations || validationErrors;
        const targetComponents = overriddenComponents || components;
        const targetWires = overriddenWires || wires;

        if (!violations || violations.length === 0) return;

        // Lazy-start worker if needed
        const worker = ensureAutofixWorker();
        if (!worker) return;

        setAutofixStatus("Analyzing...");
        setAutofixPlan(null);

        // Filter connections to remove ':' for engine compatibility
        const engineConnections = (targetWires || []).map((w) => ({
          from: String(w.from || ""),
          to: String(w.to || ""),
          color: w.color,
        }));

        setAutofixLog((prev) => [
          ...prev.slice(-19),
          {
            time: new Date().toLocaleTimeString(),
            msg: `🚀 Ingesting ${targetComponents?.length || 0} components and ${targetWires?.length || 0} wires...`,
          },
          {
            time: new Date().toLocaleTimeString(),
            msg: `🔍 Analyzing ${violations?.length || 0} circuit violations...`,
          },
        ]);

        autofixWorkerRef.current.postMessage({
          type: "analyze",
          payload: {
            diagram: {
              components: targetComponents,
              connections: engineConnections,
            },
            violations: violations,
            // v3: pass pin definitions and component registry so the autowire
            // engine can resolve board pins and look up helper-component rules
            pinDefs: LOCAL_PIN_DEFS,
            registry: Object.keys(COMPONENT_REGISTRY).reduce((acc, key) => {
              acc[key] = { manifest: JSON.parse(JSON.stringify(COMPONENT_REGISTRY[key]?.manifest || {})) };
              return acc;
            }, {}),
          },
        });
      };

      if (overriddenComponents || overriddenWires || forcedViolations) {
        run(); // Instant run for forced analysis
      } else {
        autofixDebounceTimerRef.current = setTimeout(run, 200); // 200ms debounce for manual changes
      }
    },
    [validationErrors, components, wires],
  );

  const ensureAutofixWorker = useCallback(() => {
    if (autofixWorkerRef.current) return autofixWorkerRef.current;

    console.log("[Autofix] Lazy-initializing worker...");
    const worker = new Worker(
      new URL("../../worker/autofix.worker.ts", import.meta.url),
      { type: "module" },
    );
    autofixWorkerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === "status") {
        setAutofixStatus(payload);
        setAutofixLog((prev) => [
          ...prev.slice(-19),
          { time: new Date().toLocaleTimeString(), msg: payload },
        ]);
      }
      if (type === "results") {
        setAutofixStatus("Ready");
        setAutofixLog((prev) => [
          ...prev.slice(-19),
          {
            time: new Date().toLocaleTimeString(),
            msg: `✅ Analysis complete. Found ${payload.planCount} repair strategies.`,
          },
        ]);
        if (payload.planCount > 0) {
          setAutofixPlan(payload.suggestions[0]);
        } else {
          setAutofixPlan(null);
        }
      }
    };

    // v3: no separate 'init' handshake — worker lazy-inits WASM on first 'analyze'
    return worker;
  }, []);

  // Terminate worker on unmount
  useEffect(() => {
    return () => {
      if (autofixWorkerRef.current) {
        autofixWorkerRef.current.terminate();
        autofixWorkerRef.current = null;
      }
    };
  }, []);

  const [showValidation, setShowValidation] = useState(true);
  const [validationToast, setValidationToast] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [pinStates, setPinStates] = useState({});
  const [oopStates, setOopStates] = useState({});
  const [isQueuedForTeacherKey, setIsQueuedForTeacherKey] = useState(false);

  // Inject safety pulse animation
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes safetyPulse {
        0% { transform: scale(1); opacity: 0.8; box-shadow: 0 0 10px rgba(239,68,68,0.4); }
        50% { transform: scale(1.02); opacity: 1; box-shadow: 0 0 25px rgba(239,68,68,0.7); }
        100% { transform: scale(1); opacity: 0.8; box-shadow: 0 0 10px rgba(239,68,68,0.4); }
      }
      @keyframes overloadGlow {
        0% { filter: blur(8px) brightness(1); transform: scale(1); opacity: 0.5; }
        100% { filter: blur(12px) brightness(1.5); transform: scale(1.1); opacity: 0.8; }
      }
      .safety-pulse {
        animation: safetyPulse 2s infinite ease-in-out;
      }
      .overload-glow {
        animation: overloadGlow 0.8s infinite alternate ease-in-out;
      }
      @keyframes autofixWirePulse {
        from { stroke-dashoffset: 0; }
        to { stroke-dashoffset: 20; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isBooting, setIsBooting] = useState(false); // TODO: Declare booting state tracking
  const [isPaused, setIsPaused] = useState(false);
  /** true while firmware is in deep/light sleep — shows a sleeping badge in UI */
  const [isDeviceSleeping, setIsDeviceSleeping] = useState(false);

  // ── I2S Audio playback (Web Audio API) ────────────────────────────────────
  // The AudioContext is lazily created on first I2S_AUDIO message so it starts
  // inside a user-gesture context (the Run button click).
  // i2sNextScheduledTimeRef: { [port]: number } — gapless scheduling clock per I2S port.
  // This mirrors exactly how the Buzzer component works, but for streaming PCM.
  const i2sAudioCtxRef = useRef(null);
  const i2sNextScheduledTimeRef = useRef({});

  const [protocolLogs, setProtocolLogs] = useState([]);
  const [healthScore, setHealthScore] = useState(100);
  const protocolAnalyzerRef = useRef(new SharedProtocolAnalyzer());
  const pendingProtocolLogsRef = useRef([]);
  const protocolLogsTimerRef = useRef(null);
  const lastRenderSyncCacheRef = useRef({}); // { [boardId]: { hash, timestamp, pins, analog, components, neopixels } }
  const [serialPanelOpen, setSerialPanelOpen] = useState(false);
  const [serialPanelPos, setSerialPanelPos] = useState(null);
  const serialPanelDragging = useRef(false);
  const [serialPanelGrabbing, setSerialPanelGrabbing] = useState(false);
  const serialPanelDragOffset = useRef({ x: 0, y: 0 });
  const serialRelayActiveRef = useRef(false);
  const lastRelayedLengthRef = useRef(0);
  const [serialHistory, setSerialHistory] = useState([]);
  const serialHistoryRef = useRef([]);
  serialHistoryRef.current = serialHistory;
  const [serialInput, setSerialInput] = useState("");
  const [serialPaused, setSerialPaused] = useState(false);
  const [serialBoardFilter, setSerialBoardFilter] = useState("all");
  const [serialBaudRate, setSerialBaudRate] = useState("9600");
  const [serialLineEnding, setSerialLineEnding] = useState(() => {
    try {
      const saved = String(
        localStorage.getItem("openhw.serial.lineEnding") || "",
      ).toLowerCase();
      return Object.prototype.hasOwnProperty.call(SERIAL_LINE_ENDINGS, saved)
        ? saved
        : "nl";
    } catch (e) {
      return "nl";
    }
  });
  const [boardLineEndings, setBoardLineEndings] = useState({}); // { boardId: string }
  const [boardAutoscrolls, setBoardAutoscrolls] = useState({}); // { boardId: boolean }
  const [boardBaudRates, setBoardBaudRates] = useState({}); // { boardId: number }
  const [boardPausedStates, setBoardPausedStates] = useState({}); // { boardId: boolean }
  const [boardInputs, setBoardInputs] = useState({}); // { boardId: string }
  const [isSerialSplit, setIsSerialSplit] = useState(false);
  const [serialSplitRatio, setSerialSplitRatio] = useState(0.5);
  const [serialBoardFilter2, setSerialBoardFilter2] = useState("all");
  const [rp2040DebugTelemetryEnabled, setRp2040DebugTelemetryEnabled] =
    useState(() => {
      try {
        const saved = String(
          localStorage.getItem("openhw.rp2040.debugTelemetry") || "",
        ).toLowerCase();
        return saved === "1" || saved === "true" || saved === "on";
      } catch (e) {
        return false;
      }
    });
  const [hardwareBoardId, setHardwareBoardId] = useState("");
  const [hardwareSerialTargetId, setHardwareSerialTargetId] = useState(null);
  const [hardwareStatus, setHardwareStatus] = useState("Not connected");
  const serialOutputRef = useRef(null);
  const lastHardwareStatusRef = useRef("");
  const hardwareSerialTargetRef = useRef(null);
  const renderPinsByBoardRef = useRef({});
  const renderAnalogByBoardRef = useRef({});
  const renderComponentsByBoardRef = useRef({});
  const renderNeopixelsByBoardRef = useRef({});
  /** Dedicated OffscreenCanvas Render Worker — owns all display canvas contexts. */
  const renderWorkerRef = useRef(null);
  /** State mirror of renderWorkerRef so Provider re-renders when worker starts/stops. */
  const [renderWorker, setRenderWorker] = useState(null);

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

  // --- Autofix Speak & Hear Implementation ---

  // Validation Ear: Listen for validation errors and trigger autofix analysis
  useEffect(() => {
    if (validationErrors && validationErrors.length > 0) {
      // Don't auto-trigger if we just finished a fix (wait for fresh validation pass to stabilize)
      if (!pendingVerificationRule) {
        triggerAutofixAnalysis(validationErrors);
      }
    } else {
      setAutofixPlan(null);
    }
  }, [validationErrors, triggerAutofixAnalysis, pendingVerificationRule]);

  // Fix Verification Loop: Check if a previously applied fix worked
  useEffect(() => {
    if (pendingVerificationRule && validationErrors.length >= 0) {
      const stillHasRule = (validationErrors || []).some(
        (v) => (v.ruleId || v.id) === pendingVerificationRule,
      );
      if (!stillHasRule) {
        appendConsoleEntry(
          "success",
          `✅ [Verification] Fix successful! Rule '${pendingVerificationRule}' resolved.`,
          "simulator",
        );
        setPendingVerificationRule(null);
      }
    }
  }, [validationErrors, pendingVerificationRule, appendConsoleEntry]);

  // Pinch-to-zoom state refs

  // Plotter State
  const plotDataRef = useRef([]);
  const [selectedPlotPins, setSelectedPlotPins] = useState([]); // Array<{ boardId, pinId }>
  const [plotterPaused, setPlotterPaused] = useState(false);
  const [plotterTimeDiv, setPlotterTimeDiv] = useState(1000); // ms per division (not used as divisions yet, but as total window size)

  const serializedStateEquals = (a, b) => {
    if (a === b) return true;
    if (!a || !b) return false;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (e) {
      return false;
    }
  };

  const serialBoardOptions = useMemo(() => {
    const ids = components
      .filter((c) => /(arduino|esp32|stm32|rp2040|pico)/i.test(c.type))
      .map((c) => c.id)
      .sort((a, b) => a.localeCompare(b));
    if (hardwareBoardId && !ids.includes(hardwareBoardId))
      ids.push(hardwareBoardId);
    if (hardwareSerialTargetId && !ids.includes(hardwareSerialTargetId))
      ids.push(hardwareSerialTargetId);
    return ["all", ...ids];
  }, [components, hardwareBoardId, hardwareSerialTargetId]);

  const boardColors = useMemo(
    () => getBoardColors(serialBoardOptions),
    [serialBoardOptions],
  );

  const serialBoardLabels = useMemo(() => {
    const labels = { all: "All Boards" };
    serialBoardOptions.forEach((id) => {
      if (id === "all") return;
      if (id.startsWith("hw:")) {
        labels[id] = `${id.slice(3)} (WebSerial)`;
      } else {
        labels[id] = id;
      }
    });
    return labels;
  }, [serialBoardOptions]);

  const serialBoardKinds = useMemo(() => {
    const kinds = {};
    components
      .filter((c) => /(arduino|esp32|stm32|rp2040|pico)/i.test(c.type))
      .forEach((c) => {
        kinds[c.id] = normalizeBoardKind(c.type);
      });
    return kinds;
  }, [components]);

  const serialBoardMap = useMemo(() => {
    const m = new Map();
    components.forEach((c) => m.set(c.id, c));
    return m;
  }, [components]);

  const selectedSerialBoardKind = useMemo(() => {
    if (serialBoardFilter !== "all") {
      const comp = serialBoardMap.get(serialBoardFilter);
      if (comp) return normalizeBoardKind(comp.type);
    }
    return normalizeBoardKind(board);
  }, [serialBoardFilter, serialBoardMap, board]);

  const serialBaudOptions = useMemo(() => {
    return (
      BOARD_BAUD_PRESETS[selectedSerialBoardKind] ||
      BOARD_BAUD_PRESETS.arduino_uno
    );
  }, [selectedSerialBoardKind]);

  const projectFileMap = useMemo(() => {
    const m = new Map();
    (projectFiles || []).forEach((f) => m.set(f.id, f));
    return m;
  }, [projectFiles]);

  const activeCodeFile = useMemo(
    () => projectFileMap.get(activeCodeFileId) || null,
    [projectFileMap, activeCodeFileId],
  );

  const boardComponents = useMemo(
    () =>
      components.filter((c) =>
        /(arduino|esp32|stm32|rp2040|pico)/i.test(c.type),
      ),
    [components],
  );
  const boardComponentMap = useMemo(() => {
    const map = new Map();
    (boardComponents || []).forEach((component) => {
      map.set(component.id, component);
    });
    return map;
  }, [boardComponents]);
  const rp2040BoardSourceModes = useMemo(() => {
    const modes = {};
    boardComponents.forEach((component) => {
      if (normalizeBoardKind(component.type) !== "rp2040") return;
      modes[component.id] = normalizeRp2040Env(
        resolveComponentAttrString(component?.attrs, "env", "native"),
      );
    });
    return modes;
  }, [boardComponents]);
  const firmwareBoardOptions = useMemo(() => {
    return boardComponents
      .map((comp) => ({
        id: comp.id,
        label: boardCompToDisplayName(comp, normalizeBoardKind(comp.type)),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [boardComponents]);
  const webSerialSupported =
    typeof navigator !== "undefined" && "serial" in navigator;

  useEffect(() => {
    if (boardComponents.length === 0) {
      setHardwareBoardId("");
      return;
    }
    const hasCurrent =
      hardwareBoardId && boardComponents.some((b) => b.id === hardwareBoardId);
    if (!hasCurrent) setHardwareBoardId(boardComponents[0].id);
  }, [boardComponents, hardwareBoardId]);

  // PNG Export State
  const [isExporting, setIsExporting] = useState(false);
  const [showFirmwareDownloadDialog, setShowFirmwareDownloadDialog] =
    useState(false);
  const [firmwareDownloadTarget, setFirmwareDownloadTarget] = useState("");
  const [showFirmwareUploadDialog, setShowFirmwareUploadDialog] =
    useState(false);
  const [firmwareUploadTarget, setFirmwareUploadTarget] = useState("");
  const [firmwareUploadFile, setFirmwareUploadFile] = useState(null);
  const [isApplyingFirmwareUpload, setIsApplyingFirmwareUpload] =
    useState(false);
  const [runStartedAtMs, setRunStartedAtMs] = useState(null);
  const [runDurationSec, setRunDurationSec] = useState(0);

  // View Panel State
  const [showViewPanel, setShowViewPanel] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [viewPanelSection, setViewPanelSection] = useState(null); // null | 'schematic' | 'components'
  const [schematicLoading, setSchematicLoading] = useState(false);
  const [schematicDataUrl, setSchematicDataUrl] = useState(null);

  const showLockToast = useCallback((label, compId) => {
    setLockToast({ label, compId });
    setTimeout(() => setLockToast(null), 3500);
  }, []);

  useEffect(() => {
    if (!showFirmwareDownloadDialog) return;

    if (
      firmwareDownloadTarget === "__all__" ||
      firmwareDownloadTarget === "__latest__"
    ) {
      return;
    }

    const hasTarget = firmwareBoardOptions.some(
      (opt) => opt.id === firmwareDownloadTarget,
    );
    if (!hasTarget) {
      setFirmwareDownloadTarget(firmwareBoardOptions[0]?.id || "__latest__");
    }
  }, [
    showFirmwareDownloadDialog,
    firmwareDownloadTarget,
    firmwareBoardOptions,
  ]);

  useEffect(() => {
    if (!showFirmwareUploadDialog) return;
    const hasTarget = firmwareBoardOptions.some(
      (opt) => opt.id === firmwareUploadTarget,
    );
    if (!hasTarget) {
      setFirmwareUploadTarget(firmwareBoardOptions[0]?.id || "");
    }
  }, [showFirmwareUploadDialog, firmwareUploadTarget, firmwareBoardOptions]);

  const getBoardMainCode = useCallback(
    (boardId) => {
      const preferred = `project/${boardId}/${boardId}.ino`;
      const prefFile = projectFileMap.get(preferred);
      if (prefFile && prefFile.content && !isFileDisabled(prefFile.path))
        return prefFile.content;

      const ino = (projectFiles || []).find(
        (f) =>
          f.path.startsWith(`project/${boardId}/`) &&
          fileExt(f.path) === ".ino" &&
          !isFileDisabled(f.path),
      );
      if (ino?.content) return ino.content;

      return "";
    },
    [projectFileMap, projectFiles],
  );

  const getBoardCompileFiles = useCallback(
    (boardId, preferredMainPath = "") => {
      // Virtualize project files to include current editor changes
      const virtualProjectFiles = (projectFiles || []).map((f) => ({
        ...f,
        content: f.id === activeCodeFileId ? code : f.content || "",
      }));

      return getBoardCompileFilesShared(
        { projectFiles: virtualProjectFiles },
        boardId,
      );
    },
    [projectFiles, activeCodeFileId, code],
  );

  const logSerial = (msg, color = "var(--text)") => {
    // In a real implementation this would push to a serial console state array
    console.log(`[SIM]`, msg);
  };

  const lastCompiledRef = useRef(null);
  const captureThumbnailRef = useRef(null);
  const micropythonUf2PayloadRef = useRef(null);
  const circuitPythonUf2PayloadRef = useRef(null);
  const rp2040DebugLastLogRef = useRef(new Map());
  const rp2040WirelessLastLogRef = useRef(new Map());
  const rp2040GdbLastLogRef = useRef(new Map());
  const rp2040UartMicroPythonBoardsRef = useRef(new Set());
  const rp2040UartSilentWarnedBoardsRef = useRef(new Set());
  const runComponentUpdateCountsRef = useRef({});
  const runPinTransitionCountsRef = useRef({});
  const runLagTelemetryLastStateRef = useRef(new Map());
  const runLagTelemetryLastLogRef = useRef(new Map());
  const runFpsTelemetryLastLogRef = useRef(new Map());
  const runLastBoardPinsRef = useRef(new Map());
  const validationRunCacheRef = useRef({
    signature: "",
    allowRun: true,
    errors: [],
    healthScore: 100,
    toast: null,
  });
  const neopixelRefs = useRef({});
  const livePinStatesRef = useRef({});
  const liveNeopixelDataRef = useRef({});
  const liveOopStatesRef = useRef({});
  const liveOopStateListenersRef = useRef(new Map());
  const buttonInteractStartTimeRef = useRef(null);

  const serialPlotBufferRef = useRef("");
  const serialPlotLabelsRef = useRef([]);
  const latestParsedSerialRef = useRef([]);
  const serialIngressArbitrationRef = useRef(new Map());
  const serialPausedRef = useRef(false);
  const serialPausedQueueRef = useRef([]);
  const pendingSerialLogsRef = useRef([]);

  const canvasRef = useRef(null);
  const innerCanvasRef = useRef(null); // ref to the zoom-wrapper div — used for CSS-transform panning (Fix #4)
  const rafMoveRef = useRef(null); // pending rAF id for mousemove throttle (Fixes #1-#4)
  const pendingMoveRef = useRef(null); // latest computed move data, read by the rAF callback
  const rafZoomRef = useRef(null);
  const pendingZoomRef = useRef(null);
  const svgRef = useRef(null);
  const viewPanelRef = useRef(null);
  const schematicSvgRef = useRef(null);
  const dragPayload = useRef(null);
  const movingComp = useRef(null);
  const componentZipInputRef = useRef(null);
  const firmwareUploadInputRef = useRef(null);
  // Reactive refs — kept current every render so async effects get fresh values
  const getPinPosRef = useRef(null);
  const componentsRef = useRef([]);
  const wiresRef = useRef([]);
  const pinDefsRef = useRef({});
  const zoomTextTimerRef = useRef(null);

  const getLiveOopStateSnapshot = useCallback(
    (compId) => liveOopStatesRef.current[compId] || EMPTY_LIVE_STATE,
    [],
  );
  const subscribeLiveOopState = useCallback((compId, listener) => {
    let listeners = liveOopStateListenersRef.current.get(compId);
    if (!listeners) {
      listeners = new Set();
      liveOopStateListenersRef.current.set(compId, listeners);
    }
    listeners.add(listener);
    return () => {
      const currentListeners = liveOopStateListenersRef.current.get(compId);
      if (!currentListeners) return;
      currentListeners.delete(listener);
      if (currentListeners.size === 0) {
        liveOopStateListenersRef.current.delete(compId);
      }
    };
  }, []);

  const getComponentStateAttrs = (comp, liveStateOverride = null) => {
    let attrs = { ...comp.attrs };

    if (normalizeBoardKind(comp.type) === "rp2040") {
      attrs.env = mapRp2040EnvForLegacyContextMenu(
        resolveComponentAttrString(attrs, "env", "native"),
      );
    }

    // Remote OOP state takes priority
    const remoteState = liveStateOverride || liveOopStatesRef.current[comp.id];

    if (comp.type === "wokwi-led" || comp.type === "openhw-led") {
      delete attrs.value; // Let ui.tsx handle it
    } else if (comp.type === "wokwi-servo" || comp.type === "openhw-servo") {
      if (remoteState && remoteState.angle !== undefined) {
        attrs.angle = remoteState.angle.toString();
      }
    } else if (
      comp.type === "wokwi-stepper-motor" ||
      comp.type === "openhw-stepper-motor"
    ) {
      if (remoteState && remoteState.angle !== undefined) {
        attrs.angle = remoteState.angle.toString();
      }
    } else if (comp.type === "wokwi-buzzer" || comp.type === "openhw-buzzer") {
      if (remoteState && remoteState.isBuzzing) {
        // Wokwi buzzer visual indicator (if supported) can be driven here
        attrs.color = "red";
      }
    }

    // Pass interactions to the Web Worker
    attrs.onInteract = (event) => {
      // console.log(`[SimulatorPage] UI Component ${comp.id} interacted: ${event}. isRunning: ${isRunning}`);

      // Track keydown/press start time for latency monitoring
      if (event === "press") {
        buttonInteractStartTimeRef.current = {
          compId: comp.id,
          time: performance.now(),
        };
        console.log(
          `[Latency Trace] [START] Interaction 'press' initiated on component ${comp.id}`,
        );
      }

      // Handle physical board reset button presses
      if (isProgrammableBoardType(comp.type) && event === "RESET") {
        if (isRunning) handleReset();
        return;
      }

      // Persist input values (e.g. potentiometer position) to project state immediately
      if (
        typeof event === "object" &&
        event?.type === "input" &&
        event.value !== undefined
      ) {
        if (comp.type === "openhw-hc-sr04" || comp.type === "wokwi-hc-sr04") {
          updateComponentAttr(comp.id, "distance", event.value);
        } else {
          updateComponentAttr(comp.id, "value", event.value);
        }
      }

      if (workerRef.current && isRunning) {
        workerRef.current.postMessage({
          type: "INTERACT",
          compId: comp.id,
          event: event,
        });
      }

      if (handleEsp32Interaction(comp, event)) return;
    };

    return attrs;
  };

  const notifyLiveOopStateListeners = useCallback(
    (compId) => {
      const listeners = liveOopStateListenersRef.current.get(compId);
      if (!listeners || listeners.size === 0) return;
      listeners.forEach((listener) => listener());
    },
    [liveOopStateListenersRef],
  );
  const updateLiveOopStates = useCallback(
    (componentsState) => {
      if (!Array.isArray(componentsState) || componentsState.length === 0)
        return;
      const nextStates = liveOopStatesRef.current;
      const changedIds = [];
      componentsState.forEach((comp) => {
        const compId = String(comp?.id || "").trim();
        if (!compId) return;
        const nextState = comp.state || {};

        // Hybrid Mode: Native Web Component DOM bypass
        const nativeEl = document.getElementById(compId);
        if (nativeEl && typeof nativeEl.setSimulationState === 'function') {
          nativeEl.setSimulationState(nextState);
          return; // Bypass React entirely!
        }

        if (serializedStateEquals(nextStates[compId], nextState)) return;
        nextStates[compId] = nextState;
        changedIds.push(compId);
      });
      changedIds.forEach(notifyLiveOopStateListeners);
    },
    [notifyLiveOopStateListeners],
  );
  const clearLiveOopStates = useCallback(() => {
    const prevIds = Object.keys(liveOopStatesRef.current);
    liveOopStatesRef.current = {};
    prevIds.forEach(notifyLiveOopStateListeners);
  }, [notifyLiveOopStateListeners]);

  const workerRef = useRef(null);

  // Global SharedArrayBuffer Web Component Ticker Loop (Bypasses React)
  useEffect(() => {
    let active = true;
    const tickLoop = () => {
      if (!active) return;
      const w = window;
      if (w.__sabTickers) {
        w.__sabTickers.forEach((t) => {
          if (typeof t.tick === 'function') {
            t.tick();
          }
        });
      }
      requestAnimationFrame(tickLoop);
    };
    requestAnimationFrame(tickLoop);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleDownloadPcap = (e) => {
      const { componentId } = e.detail;
      if (isRunning && workerRef.current) {
        workerRef.current.postMessage({
          type: 'DOWNLOAD_PCAP',
          boardId: componentId
        });
      }
    };
    window.addEventListener('network:download-pcap', handleDownloadPcap);
    return () => window.removeEventListener('network:download-pcap', handleDownloadPcap);
  }, [isRunning]);
  const pushSerialRxChunkRef = useRef(null);
  const runStartGuardRef = useRef(false);
  const {
    handleEsp32Interaction,
    startEsp32Session,
    stopEsp32Session,
    esp32Socket,
  } = useEsp32Engine({
    workerRef,
    components,
    wires,
    setOopStates,
    pinStates,
    setPinStates,
    pushSerialRxChunkRef,
    logSerial,
    setIsRunning,
    setIsCompiling,
    setIsBooting, // TODO: Pass booting state setter to ESP32 engine
    runStartGuardRef,
    appendConsoleEntry,
    getBoardCompileFiles,
    getBoardMainCode,
    code,
    useBlocklyCode,
    blocklyGeneratedCode,
    isRunning,
    getLiveOopStateSnapshot,
    updateLiveOopStates,
    esp32SimulationMode
  });
  const applyLiveNeopixelData = useCallback((neopixelState) => {
    liveNeopixelDataRef.current = neopixelState || {};
    if (
      !liveNeopixelDataRef.current ||
      Object.keys(liveNeopixelDataRef.current).length === 0
    )
      return;
    for (const [compId, pixels] of Object.entries(
      liveNeopixelDataRef.current,
    )) {
      const wrapper = neopixelRefs.current[compId];
      if (!wrapper) continue;
      const el = wrapper.querySelector("wokwi-neopixel-matrix");
      if (!el || typeof el.setPixel !== "function") continue;
      for (const [row, col, rgb] of pixels) {
        el.setPixel(row, col, rgb);
      }
    }
  }, []);
  const clearLiveNeopixelData = useCallback(() => {
    liveNeopixelDataRef.current = {};
  }, []);

  // ── Project persistence state ────────────────────────────────────────────────
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [currentProjectName, setCurrentProjectName] = useState("Untitled");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showF1Menu, setShowF1Menu] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1.0);
  const simulationSpeedPercent = Math.max(0, Math.round(simulationSpeed * 100));
  const [showSpeedDialog, setShowSpeedDialog] = useState(false);

  const [componentTelemetryEnabled, setComponentTelemetryEnabled] =
    useState(false);
  const [deepSiliconDebuggingEnabled, setDeepSiliconDebuggingEnabled] =
    useState(() => {
      return localStorage.getItem("openhw.deepSiliconDebugging") === "true";
    });
  useEffect(() => {
    localStorage.setItem(
      "openhw.deepSiliconDebugging",
      deepSiliconDebuggingEnabled ? "true" : "false",
    );
  }, [deepSiliconDebuggingEnabled]);

  const [respectExitSide, setRespectExitSide] = useState(() => {
    const val = localStorage.getItem("openhw.respectExitSide");
    return val !== "false"; // Defaults to true
  });
  useEffect(() => {
    localStorage.setItem(
      "openhw.respectExitSide",
      respectExitSide ? "true" : "false",
    );
  }, [respectExitSide]);

  const [telemetryMode, setTelemetryMode] = useState("detail");
  const [telemetrySampleInterval, setTelemetrySampleInterval] = useState(250);
  const [selectedTelemetryComponentIds, setSelectedTelemetryComponentIds] =
    useState([]);
  const [showTelemetrySelectModal, setShowTelemetrySelectModal] =
    useState(false);

  const {
    handleTelemetryStateMessage,
    telemetryWatchedParamsMap,
    setTelemetryWatchedParamsMap,
  } = useTelemetryManager({
    workerRef,
    appendConsoleEntry,
    simulationSpeed,
    componentTelemetryEnabled,
    setComponentTelemetryEnabled,
    telemetryMode,
    setTelemetryMode,
    telemetrySampleInterval,
    selectedTelemetryComponentIds,
    setSelectedTelemetryComponentIds,
    isBooting,
    isCompiling,
  });

  const handleTelemetryStateMessageRef = useRef(handleTelemetryStateMessage);
  useEffect(() => {
    handleTelemetryStateMessageRef.current = handleTelemetryStateMessage;
  }, [handleTelemetryStateMessage]);

  const [saveDialogName, setSaveDialogName] = useState("");
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [shareVisibility, setShareVisibility] = useState("public");
  const [shareLinkType, setShareLinkType] = useState("snapshot");
  const [liveMeetingShareCode, setLiveMeetingShareCode] =
    useState(liveSessionCode);
  const [liveMeetingStatus, setLiveMeetingStatus] = useState(
    liveMeetingMode ? "Connecting…" : "",
  );
  const [liveMeetingMeta, setLiveMeetingMeta] = useState(null);
  const [liveMeetingParticipantCounts, setLiveMeetingParticipantCounts] =
    useState({ total: 0, teachers: 0, students: 0, others: 0 });
  const [liveGrantedEditorIds, setLiveGrantedEditorIds] = useState([]);
  const [liveGrantedEditors, setLiveGrantedEditors] = useState([]);
  const [livePendingEditRequests, setLivePendingEditRequests] = useState([]);
  const [liveEditRequestPending, setLiveEditRequestPending] = useState(false);
  const [myProjects, setMyProjects] = useState([]);
  const [isSharingSimulation, setIsSharingSimulation] = useState(false);
  const [showProjectsDropdown, setShowProjectsDropdown] = useState(false);
  const [assignmentSubmissionOpen, setAssignmentSubmissionOpen] =
    useState(false);
  const [assignmentSubmissionAssignment, setAssignmentSubmissionAssignment] =
    useState(null);
  const [assignmentSubmissionState, setAssignmentSubmissionState] = useState({
    loading: false,
    saving: false,
    error: "",
    data: null,
  });
  const [assignmentSubmissionForm, setAssignmentSubmissionForm] = useState({
    notes: "",
    links: [""],
    attachments: [],
  });
  const currentProjectIdRef = useRef(null); // mirror for use inside async callbacks
  const autoSaveTimerRef = useRef(null);
  const justSharedRef = useRef(null);
  const liveSocketRef = useRef(null);
  const liveSyncTimerRef = useRef(null);
  const liveApplyingRemoteRef = useRef(false);
  const lastLiveSyncPayloadRef = useRef("");
  const lastLiveSyncTimeRef = useRef(0);
  // My Projects sidebar state
  const [showProjectsSidebar, setShowProjectsSidebar] = useState(false);
  const [projectsSidebarTab, setProjectsSidebarTab] = useState("projects"); // 'favourites' | 'projects' | 'custom' | 'settings'
  const [favouriteProjectIds, setFavouriteProjectIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("ohw_favourite_projects") || "[]");
    } catch (e) {
      return [];
    }
  });
  const [projContextMenu, setProjContextMenu] = useState(null); // { proj, x, y }
  const [snappingHoles, setSnappingHoles] = useState([]); // Array<{ bbId, holeId, x, y }>
  const [renamingProjectId, setRenamingProjectId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => {
    try {
      const val = localStorage.getItem("ohw_autosave_enabled");
      return val === null ? true : val === "true";
    } catch (e) {
      return true;
    }
  });
  const backupRestoreInputRef = useRef(null);
  const wokwiImportInputRef = useRef(null);

  const handleUploadZip = useCallback(
    async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      appendConsoleEntry("info", `ZIP upload started: ${file.name}`, "zip");
      try {
        const zip = await JSZip.loadAsync(file);
        let manifestStr = null,
          uiStr = null,
          logicStr = null,
          validationStr = null,
          indexStr = null,
          docHtml = null;
        for (const relativePath of Object.keys(zip.files)) {
          if (relativePath.endsWith("manifest.json"))
            manifestStr = await zip.files[relativePath].async("string");
          if (
            relativePath.endsWith("ui.tsx") ||
            relativePath.endsWith("ui.jsx")
          )
            uiStr = await zip.files[relativePath].async("string");
          if (
            relativePath.endsWith("logic.ts") ||
            relativePath.endsWith("logic.js")
          )
            logicStr = await zip.files[relativePath].async("string");
          if (
            relativePath.endsWith("validation.ts") ||
            relativePath.endsWith("validation.js")
          )
            validationStr = await zip.files[relativePath].async("string");
          if (
            relativePath.endsWith("index.ts") ||
            relativePath.endsWith("index.js")
          )
            indexStr = await zip.files[relativePath].async("string");
          // Doc folder — any HTML file inside doc/ or docs/ directory
          if (
            /\/(?:doc|docs)\/.*\.html$/i.test(relativePath) ||
            /^(?:doc|docs)\/.*\.html$/i.test(relativePath)
          ) {
            docHtml = await zip.files[relativePath].async("string");
          }
        }
        if (
          !manifestStr ||
          !uiStr ||
          !logicStr ||
          !validationStr ||
          !indexStr
        ) {
          appendConsoleEntry(
            "error",
            "ZIP upload failed: required files are missing.",
            "zip",
          );
          alert(
            "Error: Zip must contain manifest.json, ui.tsx, logic.ts, validation.ts, and index.ts",
          );
          return;
        }
        const manifest = JSON.parse(manifestStr);
        const submitPayload = {
          id: manifest.type,
          manifest,
          ui: uiStr,
          logic: logicStr,
          validation: validationStr,
          index: indexStr,
          ...(docHtml ? { doc: docHtml } : {}),
        };

        let submitted = false;
        let offlineQueued = false;
        try {
          await submitCustomComponent(submitPayload);
          submitted = true;
          appendConsoleEntry(
            "info",
            `ZIP submitted to admin: ${manifest.type}`,
            "zip",
          );
        } catch (submitErr) {
          // Network unavailable — queue for later submission when back online
          await enqueueComponent(submitPayload);
          offlineQueued = true;
          appendConsoleEntry(
            "warn",
            `Offline mode: queued ${manifest.type} for later submission.`,
            "zip",
          );
        }

        // --- ZERO-TOUCH SANDBOX INJECTION ---
        const Babel = await getBabel();
        const transpileUI = Babel.transform(uiStr, {
          filename: "ui.tsx",
          presets: ["react", "typescript", "env"],
        }).code;
        const transpileLogic = Babel.transform(logicStr, {
          filename: "logic.ts",
          presets: ["typescript", "env"],
        }).code;

        // Skip protection for SUBMITTED components (the user wants to preview their own work)
        // but we still assert safety
        assertSafeDynamicModule(transpileUI, "ui.tsx");
        assertSafeDynamicModule(transpileLogic, "logic.ts");

        const exportsUI = {};
        const evalUI = new Function("exports", "require", "React", transpileUI);
        evalUI(
          exportsUI,
          (mod) => {
            if (mod === "react") return React;
            if (mod.endsWith("manifest.json")) return manifest;
            return null;
          },
          React,
        );

        const uiComponent = resolveUiExport(exportsUI);
        const contextMenu =
          exportsUI[
          Object.keys(exportsUI).find((k) =>
            k.toLowerCase().includes("contextmenu"),
          )
          ];

        if (uiComponent) {
          const newCatItem = { ...manifest };
          delete newCatItem.pins;
          delete newCatItem.group;

          const groupName =
            GROUP_MAPPING[manifest.group] || manifest.group || "Misc";
          let group = LOCAL_CATALOG.find((g) => g.group === groupName);
          if (!group) {
            group = { group: groupName, items: [] };
            LOCAL_CATALOG.push(group);
          }
          group.items = group.items.filter((i) => i.type !== manifest.type);
          group.items.push(newCatItem);
          sortCatalog(LOCAL_CATALOG);

          COMPONENT_REGISTRY[manifest.type] = {
            manifest,
            UI: uiComponent,
            BOUNDS: exportsUI.BOUNDS,
            ContextMenu: contextMenu,
            contextMenuDuringRun: !!(
              exportsUI.contextMenuDuringRun || manifest.contextMenuDuringRun
            ),
            contextMenuOnlyDuringRun: !!(
              exportsUI.contextMenuOnlyDuringRun ||
              manifest.contextMenuOnlyDuringRun
            ),
            logicCode: transpileLogic,
            uiRaw: uiStr,
            logicRaw: logicStr,
            validationRaw: validationStr,
            indexRaw: indexStr,
            ...(docHtml ? { doc: docHtml } : {}),
            isDynamic: true,
          };
          if (manifest.pins) {
            LOCAL_PIN_DEFS[manifest.type] = manifest.pins;
          }
          setCustomCatalogCounter((c) => c + 1);
          if (submitted) {
            appendConsoleEntry(
              "info",
              `Component injected successfully: ${manifest.label}`,
              "zip",
            );
            alert(
              `Successfully submitted to admin AND injected ${manifest.label} into your local Sandbox Memory!`,
            );
          } else if (offlineQueued) {
            appendConsoleEntry(
              "warn",
              `Component injected locally while offline: ${manifest.label}`,
              "zip",
            );
            alert(
              `You are offline. "${manifest.label}" has been injected locally and will be submitted to the admin automatically when you reconnect.`,
            );
          }
        }
      } catch (e) {
        appendConsoleEntry(
          "error",
          `ZIP processing failed: ${e.message}`,
          "zip",
        );
        alert(`Error processing ZIP: ${e.message}`);
      }
      event.target.value = "";
    },
    [appendConsoleEntry],
  );

  // ── Library Manager State ───────────────────────────────────────────────────
  const [libQuery, setLibQuery] = useState("");
  const [libResults, setLibResults] = useState([]);
  const [libInstalled, setLibInstalled] = useState([]);
  const [isSearchingLib, setIsSearchingLib] = useState(false);
  const [installingLib, setInstallingLib] = useState(null);
  const [libMessage, setLibMessage] = useState(null);
  const libSearchCache = useRef({});

  useEffect(() => {
    if (!libQuery.trim() || libQuery.trim().length < 2) {
      setLibResults([]);
      return;
    }

    // Check cache first
    if (libSearchCache.current[libQuery.trim()]) {
      setLibResults(libSearchCache.current[libQuery.trim()]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingLib(true);
      try {
        const results = await searchLibraries(libQuery);
        libSearchCache.current[libQuery.trim()] = results;
        setLibResults(results);
      } catch (err) {
        console.error("[Library Search Error]", err);
      } finally {
        setIsSearchingLib(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [libQuery]);

  const loadLibraries = async () => {
    try {
      const libraries = await fetchInstalledLibraries();
      setLibInstalled(libraries);
      setLibMessage(null);
    } catch (err) {
      console.error("Failed to fetch installed libraries", err);
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.error || "Failed to load installed libraries.";
      if (status === 503) {
        setLibMessage({ type: "error", text: msg });
      }
    }
  };

  // loadLibraries is called from the demo-load effect below when no demo is loading,
  // or deferred so that circuit.png gets exclusive network priority on demo pages.

  // ── Auto-load component from Component Editor ("Test in Simulator") ────────
  useEffect(() => {
    const raw = localStorage.getItem("openhw_pending_component");
    if (!raw) return;
    localStorage.removeItem("openhw_pending_component");
    try {
      const { data, name, label } = JSON.parse(raw);
      fetch(data)
        .then((r) => r.blob())
        .then((blob) => {
          const file = new File([blob], `${name || "component"}.zip`, {
            type: "application/zip",
          });
          handleUploadZip({ target: { files: [file] } });
        })
        .catch((err) =>
          console.error(
            "[ComponentEditor] Failed to load pending component:",
            err,
          ),
        );
    } catch (e) {
      console.error(
        "[ComponentEditor] Could not parse pending component data:",
        e,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (gamificationMode) return;
    if (guidedProjectState) {
      loadLibraries();
      return;
    }

    let cancelled = false;
    let deferTimer = null;

    const loadDemoProject = async () => {
      if (!projectName) {
        // No demo loading — run library fetch immediately
        loadLibraries();
        return;
      }

      try {
        const result = await loadExampleProjectData(projectName, EXAMPLES_BASE_URL);
        if (result && result.meta && !cancelled) {
          applyImportedProjectMeta(result.meta, `Demo Project (${result.source})`);
        }
      } catch (err) {
        console.error(`Failed to load demo project "${projectName}"`, err);
      } finally {
        // Defer lib list until after the demo circuit starts painting
        if (!cancelled) {
          deferTimer = window.setTimeout(() => {
            if (!cancelled) loadLibraries();
          }, 0);
        }
      }
    };

    loadDemoProject();
    return () => {
      cancelled = true;
      if (deferTimer !== null) window.clearTimeout(deferTimer);
    };
  }, [projectName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load circuit data from bankProjectCriteria (opened from Project Bank Editor) ──
  useEffect(() => {
    if (!returnTo) return;

    // Check if we have circuit data from Project Bank Editor
    const stored = localStorage.getItem("bankProjectCriteria");
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);
      // Only load if it has the full payload format (components/connections)
      if (parsed && Array.isArray(parsed.components) && Array.isArray(parsed.connections)) {
        const { components: normalizedComponents, wires: normalizedConnections } =
          normalizeImportedCircuitData(parsed.components, parsed.connections);

        setBoard(parsed.board || "arduino_uno");
        setComponents(normalizedComponents);
        setWires(normalizedConnections);
        setCode(parsed.code || "");
        syncNextIds(normalizedComponents, normalizedConnections);
      }
    } catch (e) {
      console.warn("[BankProjectCriteria] Failed to parse circuit data:", e);
    }
  }, [returnTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Offline component queue: flush to backend when connectivity restores ──
  useEffect(() => {
    const drainQueue = async () => {
      const queued = await getQueuedComponents();
      if (!queued.length) return;
      for (const item of queued) {
        try {
          await submitCustomComponent(item.payload);
          await dequeueComponent(item.queueId);
          console.log(
            `[Offline Queue] Submitted queued component: ${item.payload.id}`,
          );
        } catch (e) {
          // Still offline or backend unreachable — leave in queue for next attempt
        }
      }
    };

    // Attempt drain on initial mount in case items were queued in a previous session
    if (navigator.onLine) drainQueue();

    window.addEventListener("online", drainQueue);
    return () => window.removeEventListener("online", drainQueue);
  }, []);

  // ── Sync backend custom components (cache-first, version-checked) ──────────
  // On every page load:
  //  1. Read IndexedDB cache → inject immediately (no network, instant palette)
  //  2. GET /api/components/version (~40 bytes) → compare hash
  //  3. Only fetch + transpile when the hash actually changed
  //  Note: In Adventure/Classroom mode, clear cache to ensure component filtering
  //  is based on fresh unlock data from the API.
  useEffect(() => {
    let cancelled = false;

    const syncBackendComponents = async () => {
      // ── Step 1: Serve from cache immediately ──────────────────────────────
      const cached = await getCachedComponents();
      if (cached.length > 0 && !cancelled) {
        injectComponentsIntoRegistry(cached);
        setCustomCatalogVersion((v) => v + 1);
        console.log(
          `[ComponentCache] Injected ${cached.length} components from IDB cache.`,
        );
      }

      // ── Step 2: Lightweight version check ────────────────────────────────
      const serverVersion = await fetchComponentsVersion();
      if (!serverVersion || cancelled) return;

      const cachedHash = await getCachedServerHash();

      if (serverVersion === cachedHash) {
        console.log("[ComponentCache] Cache is fresh, skipping re-fetch.");
        return;
      }

      // ── Step 3: Fetch full sources (only when something changed) ──────────
      console.log(
        "[ComponentCache] Version mismatch — fetching updated components...",
      );
      const components = await fetchPublicInstalledComponents();
      if (cancelled) return;

      if (!components.length) {
        await clearComponentCache();
        return;
      }

      // ── Step 4: Transpile with Babel ──────────────────────────────────────
      const Babel = await getBabel();
      const injected = [];

      for (const comp of components) {
        if (cancelled) return;
        try {
          const files = comp.files || {};
          const uiRaw = files["ui.tsx"] || files["ui.jsx"] || "";
          const logicRaw = files["logic.ts"] || files["logic.js"] || "";
          const validationRaw =
            files["validation.ts"] || files["validation.js"] || "";
          const indexRaw = files["index.ts"] || files["index.js"] || "";
          const manifest = JSON.parse(files["manifest.json"] || "{}");

          const transpiledUI = Babel.transform(uiRaw, {
            filename: "ui.tsx",
            presets: ["react", "typescript", "env"],
          }).code;
          const transpiledLogic = Babel.transform(logicRaw, {
            filename: "logic.ts",
            presets: ["typescript", "env"],
          }).code;

          injected.push({
            id: comp.id,
            manifest,
            uiRaw,
            logicRaw,
            validationRaw,
            indexRaw,
            transpiledUI,
            transpiledLogic,
          });
        } catch (err) {
          console.warn(
            `[ComponentCache] Transpile failed for ${comp.id}:`,
            err,
          );
        }
      }

      if (cancelled || !injected.length) return;

      // ── Step 5: Persist to IDB + update palette ───────────────────────────
      await setCachedComponents(injected, serverVersion);
      injectComponentsIntoRegistry(injected);
      setCustomCatalogVersion((v) => v + 1);
      console.log(
        `[ComponentCache] Updated cache with ${injected.length} components (hash: ${serverVersion}).`,
      );
    };

    // If a demo project is loading, give it a 1.5s head-start on the network
    // before we fire any component-sync requests.
    const delay = projectName ? 1500 : 0;
    const timer = window.setTimeout(() => {
      if (!cancelled)
        syncBackendComponents().catch((err) =>
          console.warn("[ComponentCache] Sync error:", err),
        );
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Project: owner string ─────────────────────────────────────────────────
  const getOwner = () => user?.email || "guest";

  // ── Project: load project list helper ────────────────────────────────────
  const refreshProjectList = async () => {
    const projects = await listProjects(getOwner());
    setMyProjects(projects);
  };
  const buildLiveMeetingSnapshot = useCallback(
    () => ({
      name: currentProjectName || "Live Simulation",
      board,
      components,
      connections: wires,
      code,
      projectFiles,
      openCodeTabs,
      activeCodeFileId,
    }),
    [
      activeCodeFileId,
      board,
      code,
      components,
      currentProjectName,
      openCodeTabs,
      projectFiles,
      wires,
    ],
  );
  const replaceFilePath = useCallback(
    (oldPath, newPath) => {
      const nextName = String(newPath || "")
        .split("/")
        .pop();
      if (nextName) renameCodeFile(oldPath, nextName);
    },
    [renameCodeFile],
  );

  const applyLiveMeetingSnapshot = useCallback((snapshot) => {
    const normalizedSnapshot =
      snapshot && typeof snapshot === "object" ? snapshot : {};
    lastLiveSyncPayloadRef.current = JSON.stringify(normalizedSnapshot);
    const normalizedCircuit = normalizeImportedCircuitData(
      Array.isArray(normalizedSnapshot.components)
        ? normalizedSnapshot.components
        : [],
      Array.isArray(normalizedSnapshot.connections)
        ? normalizedSnapshot.connections
        : [],
    );
    const normalizedFiles = normalizeProjectFiles(
      Array.isArray(normalizedSnapshot.projectFiles)
        ? normalizedSnapshot.projectFiles
        : [],
    );
    const normalizedTabs = normalizeOpenCodeTabs(
      Array.isArray(normalizedSnapshot.openCodeTabs)
        ? normalizedSnapshot.openCodeTabs
        : [],
      normalizedFiles,
    );
    const preferredActive = String(
      normalizedSnapshot.activeCodeFileId || "",
    ).trim();
    const activeId = normalizedFiles.some((file) => file.id === preferredActive && file.id !== "project/diagram.json")
      ? preferredActive
      : normalizedTabs.find((t) => t !== "project/diagram.json") || normalizedFiles.find((f) => f.id !== "project/diagram.json")?.id || "";
    liveApplyingRemoteRef.current = true;
    setBoard(normalizedSnapshot.board || "arduino_uno");
    setCode(normalizedSnapshot.code || "");
    setComponents(normalizedCircuit.components);
    setWires(normalizedCircuit.wires);
    setProjectFiles(normalizedFiles);
    setOpenCodeTabs(normalizedTabs);
    setActiveCodeFileId(activeId);
    setCurrentProjectName(normalizedSnapshot.name || "Live Simulation");
    currentProjectIdRef.current = null;
    setCurrentProjectId(null);
    setHistory({ past: [], future: [] });
    lastCompiledRef.current = null;
    syncNextIds(normalizedCircuit.components, normalizedCircuit.wires);
    window.clearTimeout(liveSyncTimerRef.current);
    liveSyncTimerRef.current = window.setTimeout(() => {
      liveApplyingRemoteRef.current = false;
    }, 60);
  }, []);
  const liveCanEdit =
    !liveMeetingMode ||
    isLiveTeacher ||
    liveGrantedEditorIds.includes(currentLiveUserId);
  const liveEditingDisabled = (liveMeetingMode && !liveCanEdit) || readOnly;
  const handleRequestLiveEditAccess = useCallback(() => {
    if (!liveMeetingMode || isLiveTeacher || liveCanEdit) return;
    if (
      !liveSocketRef.current ||
      liveSocketRef.current.readyState !== WebSocket.OPEN
    )
      return;
    liveSocketRef.current.send(
      JSON.stringify({ type: "student:request-edit" }),
    );
    setLiveEditRequestPending(true);
    setLiveMeetingStatus("Edit request sent");
  }, [isLiveTeacher, liveCanEdit, liveMeetingMode]);

  const handleRespondToLiveEditRequest = useCallback(
    (requestUserId, decision) => {
      if (!isLiveTeacher) return;
      if (
        !liveSocketRef.current ||
        liveSocketRef.current.readyState !== WebSocket.OPEN
      )
        return;
      liveSocketRef.current.send(
        JSON.stringify({
          type: "teacher:set-student-edit-access",
          userId: requestUserId,
          decision,
        }),
      );
    },
    [isLiveTeacher],
  );

  const handleEndLiveEditAccess = useCallback(() => {
    if (!liveCanEdit || isLiveTeacher) return;
    if (
      !liveSocketRef.current ||
      liveSocketRef.current.readyState !== WebSocket.OPEN
    )
      return;
    liveSocketRef.current.send(
      JSON.stringify({ type: "student:end-edit-access" }),
    );
    setLiveMeetingStatus("Edit access ended");
  }, [isLiveTeacher, liveCanEdit]);

  // ── Project: load most-recent project on first mount ─────────────────────
  useEffect(() => {
    // Don't auto-load a project if we're in assessment mode or loading a demo or circuit from URL
    if (
      assessmentMode ||
      projectName ||
      shareId ||
      liveSessionCode ||
      assessmentParams.get("circuit")
    )
      return;

    const owner = user?.email || "guest";
    listProjects(owner).then((projects) => {
      if (projects.length === 0) return;
      const latest = projects[0]; // already sorted newest-first

      const isSessionActive = sessionStorage.getItem("ohw_session_active");
      if (isSessionActive) {
        handleLoadProject(latest);
      } else {
        sessionStorage.setItem("ohw_session_active", "1");
        setRestoreProjectPrompt(latest);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load project from dashboard card click ────────────────────
  useEffect(() => {
    const loadId = location.state?.loadProjectId;
    if (!loadId) return;
    import('../../services/projectStore.js').then(({ loadProject }) => {
      loadProject(loadId).then((proj) => {
        if (proj) handleLoadProject(proj);
      });
    });
    window.history.replaceState({}, document.title);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!shareId || shareId === "new") return;
    if (justSharedRef.current === shareId) {
      justSharedRef.current = null;
      return;
    }

    let cancelled = false;

    const loadSharedProject = async () => {
      try {
        const sharedProject = await fetchSharedSimulation(shareId);
        if (!sharedProject || cancelled) return;

        setBoard(sharedProject.board || "arduino_uno");
        setCode(sharedProject.code || "");
        setComponents(sharedProject.components || []);
        setWires(sharedProject.connections || []);
        setProjectFiles(
          Array.isArray(sharedProject.projectFiles)
            ? sharedProject.projectFiles
            : [],
        );
        setOpenCodeTabs(
          Array.isArray(sharedProject.openCodeTabs)
            ? sharedProject.openCodeTabs
            : [],
        );
        setActiveCodeFileId(sharedProject.activeCodeFileId || "");
        syncNextIds(
          sharedProject.components || [],
          sharedProject.connections || [],
        );
        currentProjectIdRef.current = null;
        setCurrentProjectId(null);
        setCurrentProjectName(sharedProject.name || "Shared Simulation");
        setHistory({ past: [], future: [] });
        lastCompiledRef.current = null;
      } catch (error) {
        console.error("Failed to load shared simulation", error);
        if (!cancelled) {
          alert(
            error?.response?.data?.message ||
            error.message ||
            "Failed to load shared simulation.",
          );
        }
      }
    };

    loadSharedProject();
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  useEffect(() => {
    if (!liveSessionCode || !token) return;

    let cancelled = false;

    const loadLiveSession = async () => {
      try {
        const session = await fetchLiveSimulationSession(liveSessionCode);
        if (!session || cancelled) return;

        setLiveMeetingShareCode(session.sessionCode || liveSessionCode);
        setLiveMeetingMeta(session);
        setLiveMeetingParticipantCounts(
          session.participantCounts || {
            total: 0,
            teachers: 0,
            students: 0,
            others: 0,
          },
        );
        setLiveGrantedEditorIds(session.permissions?.grantedEditorIds || []);
        setLiveGrantedEditors(session.permissions?.grantedEditors || []);
        setLivePendingEditRequests(
          session.permissions?.pendingEditRequests || [],
        );
        setLiveMeetingStatus(
          isLiveTeacher ? "Hosting live session" : "Connected to live session",
        );
        applyLiveMeetingSnapshot(session.snapshot || {});
      } catch (error) {
        console.error("Failed to load live simulation", error);
        if (!cancelled) {
          setLiveMeetingStatus("Connection failed");
          alert(
            error?.response?.data?.message ||
            error.message ||
            "Failed to load live simulation.",
          );
        }
      }
    };

    loadLiveSession();
    return () => {
      cancelled = true;
    };
  }, [applyLiveMeetingSnapshot, isLiveTeacher, liveSessionCode, token]);

  useEffect(() => {
    if (!liveMeetingMode || !token) return;

    const socketUrl = buildLiveSimulationWsUrl(
      liveSessionCode,
      isLiveTeacher ? "teacher" : "student",
    );
    const socket = new WebSocket(socketUrl);
    liveSocketRef.current = socket;
    setLiveMeetingStatus(
      isLiveTeacher ? "Connecting teacher session…" : "Joining live session…",
    );

    socket.onopen = () => {
      setLiveMeetingStatus(
        isLiveTeacher ? "Hosting live session" : "Watching teacher updates",
      );
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "session:welcome" && payload.session) {
          setLiveMeetingMeta(payload.session);
          setLiveMeetingShareCode(
            payload.session.sessionCode || liveSessionCode,
          );
          setLiveMeetingParticipantCounts(
            payload.session.participantCounts || {
              total: 0,
              teachers: 0,
              students: 0,
              others: 0,
            },
          );
          setLiveGrantedEditorIds(
            payload.session.permissions?.grantedEditorIds || [],
          );
          setLiveGrantedEditors(
            payload.session.permissions?.grantedEditors || [],
          );
          setLivePendingEditRequests(
            payload.session.permissions?.pendingEditRequests || [],
          );
          applyLiveMeetingSnapshot(payload.session.snapshot || {});
        }

        if (payload.type === "session:update") {
          const sourceRole = String(payload.sourceRole || "").trim();
          const sourceUserId = String(payload.sourceUserId || "").trim();
          setLiveMeetingStatus(
            sourceRole === "student"
              ? "Receiving collaborator updates"
              : "Receiving live updates",
          );
          if (sourceUserId !== currentLiveUserId) {
            applyLiveMeetingSnapshot(payload.snapshot || {});
          }
        }

        if (payload.type === "session:participants") {
          setLiveMeetingParticipantCounts(
            payload.participantCounts || {
              total: 0,
              teachers: 0,
              students: 0,
              others: 0,
            },
          );
        }

        if (payload.type === "permissions:update") {
          setLiveGrantedEditorIds(payload.permissions?.grantedEditorIds || []);
          setLiveGrantedEditors(payload.permissions?.grantedEditors || []);
          setLivePendingEditRequests(
            payload.permissions?.pendingEditRequests || [],
          );
          if (
            !isLiveTeacher &&
            String(payload.userId || "") === currentLiveUserId
          ) {
            setLiveEditRequestPending(false);
            setLiveMeetingStatus(
              payload.decision === "approve"
                ? "Edit access granted"
                : payload.decision === "deny"
                  ? "Edit request declined"
                  : liveMeetingStatus,
            );
          }
        }
      } catch (error) {
        console.error("Failed to parse live simulation message", error);
      }
    };

    socket.onerror = () => {
      setLiveMeetingStatus("WebSocket error");
    };

    socket.onclose = () => {
      if (liveSocketRef.current === socket) {
        liveSocketRef.current = null;
      }
      setLiveMeetingStatus("Disconnected");
    };

    return () => {
      if (liveSocketRef.current === socket) {
        liveSocketRef.current = null;
      }
      socket.close();
    };
  }, [
    applyLiveMeetingSnapshot,
    currentLiveUserId,
    isLiveTeacher,
    liveMeetingMode,
    liveSessionCode,
    token,
  ]);

  useEffect(() => {
    if (!liveMeetingMode || !liveCanEdit) return;
    if (
      !liveSocketRef.current ||
      liveSocketRef.current.readyState !== WebSocket.OPEN
    )
      return;
    if (liveApplyingRemoteRef.current) return;

    const nextSnapshot = buildLiveMeetingSnapshot();
    const serializedSnapshot = JSON.stringify(nextSnapshot);
    if (serializedSnapshot === lastLiveSyncPayloadRef.current) return;
    lastLiveSyncPayloadRef.current = serializedSnapshot;

    const now = Date.now();
    const timeSinceLastSync = now - lastLiveSyncTimeRef.current;
    const syncInterval = 100; // Throttle to 10Hz for smooth real-time drag/sync

    const sendUpdate = () => {
      try {
        if (liveSocketRef.current?.readyState === WebSocket.OPEN) {
          liveSocketRef.current.send(
            JSON.stringify({
              type: isLiveTeacher ? "teacher:sync" : "student:sync",
              snapshot: nextSnapshot,
            }),
          );
          lastLiveSyncTimeRef.current = Date.now();
          setLiveMeetingStatus(
            isLiveTeacher ? "Broadcasting updates" : "Sharing your edits",
          );
        }
      } catch (error) {
        console.error("Failed to send live simulation update", error);
      }
    };

    if (timeSinceLastSync >= syncInterval) {
      sendUpdate();
    } else {
      const timeoutId = window.setTimeout(
        sendUpdate,
        syncInterval - timeSinceLastSync,
      );
      return () => window.clearTimeout(timeoutId);
    }
  }, [
    activeCodeFileId,
    board,
    buildLiveMeetingSnapshot,
    code,
    components,
    currentProjectName,
    isLiveTeacher,
    liveCanEdit,
    liveMeetingMode,
    openCodeTabs,
    projectFiles,
    wires,
  ]);

  const isAssignmentSubmissionClosed = useCallback(
    (assignment) =>
      Boolean(assignment?.dueDate) && new Date(assignment.dueDate) < new Date(),
    [],
  );

  useEffect(() => {
    if (!assignmentMode || user?.role !== "student") return;

    let cancelled = false;

    const loadAssignmentSubmission = async () => {
      setAssignmentSubmissionState({
        loading: true,
        saving: false,
        error: "",
        data: null,
      });
      try {
        const response = await getMyAssignmentSubmission(classId, assignmentId);
        if (cancelled) return;

        const submission = response?.submission || null;
        setAssignmentSubmissionAssignment(response?.assignment || null);
        setAssignmentSubmissionState({
          loading: false,
          saving: false,
          error: "",
          data: submission,
        });
        setAssignmentSubmissionForm({
          notes: submission?.notes || "",
          links: submission?.links?.length ? submission.links : [""],
          attachments: submission?.attachments || submission?.files || [],
        });
      } catch (error) {
        if (cancelled) return;
        setAssignmentSubmissionState({
          loading: false,
          saving: false,
          error: error.message || "Failed to load assignment submission.",
          data: null,
        });
      }
    };

    loadAssignmentSubmission();
    return () => {
      cancelled = true;
    };
  }, [assignmentMode, classId, assignmentId, user?.role]);

  // ── Auto-load circuit from URL (?circuit=JSON_ENCODED) ──────────────────────
  useEffect(() => {
    const urlCircuit = assessmentParams.get("circuit");
    if (!urlCircuit) return;

    try {
      const payload = JSON.parse(decodeURIComponent(urlCircuit));
      if (!payload || typeof payload !== "object") return;

      const normalized = normalizeImportedCircuitData(
        payload.components || [],
        payload.connections || [],
      );
      setBoard(payload.board || "arduino_uno");
      setComponents(normalized.components);
      setWires(normalized.wires);
      setCode(payload.code || "");
      syncNextIds(normalized.components, normalized.wires);

      // Clear project state so we don't accidentally overwrite the user's project
      setCurrentProjectName("Sample Circuit");
      setCurrentProjectId(null);
      currentProjectIdRef.current = null;
      setHistory({ past: [], future: [] });
    } catch (e) {
      console.error("[URL Circuit] Failed to parse circuit from URL:", e);
    }
  }, [assessmentParams]);

  const handleAssignmentSubmissionFilesChange = async (event) => {
    if (isAssignmentSubmissionClosed(assignmentSubmissionAssignment)) {
      setAssignmentSubmissionState((current) => ({
        ...current,
        error: "This assignment is closed. You can no longer upload files.",
      }));
      event.target.value = "";
      return;
    }

    try {
      const uploadedFiles = await uploadClassroomFiles(event.target.files, {
        classId,
        category: "submissions",
        maxFiles: 8,
        allowedTypes: ["application/pdf", "image"],
      });

      setAssignmentSubmissionForm((current) => ({
        ...current,
        attachments: [...current.attachments, ...uploadedFiles],
      }));
      setAssignmentSubmissionState((current) => ({ ...current, error: "" }));
    } catch (error) {
      setAssignmentSubmissionState((current) => ({
        ...current,
        error: error.message || "Failed to upload submission files.",
      }));
    } finally {
      event.target.value = "";
    }
  };

  const handleRemoveAssignmentSubmissionFile = (index) => {
    setAssignmentSubmissionForm((current) => ({
      ...current,
      attachments: current.attachments.filter((_, idx) => idx !== index),
    }));
  };

  const handleSubmitClassAssignment = async () => {
    if (!assignmentSubmissionAssignment) {
      return;
    }

    if (isAssignmentSubmissionClosed(assignmentSubmissionAssignment)) {
      setAssignmentSubmissionState((current) => ({
        ...current,
        saving: false,
        error: "This assignment is closed. Submissions are no longer accepted.",
      }));
      return;
    }

    setAssignmentSubmissionState((current) => ({
      ...current,
      saving: true,
      error: "",
    }));

    try {
      const shareResponse = await createSharedSimulation({
        name: `${assignmentSubmissionAssignment.title || "Assignment"} Submission`,
        isPublic: true,
        classId,
        assignmentId,
        board,
        components,
        connections: wires,
        code,
        projectFiles,
        openCodeTabs,
        activeCodeFileId,
      });
      const simulationShareId = shareResponse.shareId;
      if (!simulationShareId) {
        throw new Error("Failed to create simulation link for submission.");
      }
      const simulationUrl = `${window.location.origin}/simulator/share/${simulationShareId}`;

      // Auto-capture PNG of the current circuit
      let finalAttachments = [...assignmentSubmissionForm.attachments];
      try {
        const pngBlob = await downloadPng({ returnBlob: true });
        if (pngBlob) {
          console.log("[Submission] Captured circuit PNG, uploading...");
          // Cache locally for immediate feedback after redirect
          try {
            const dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(pngBlob);
            });
            sessionStorage.setItem(`ohw_preview_${assignmentId}`, dataUrl);
          } catch (e) {
            console.warn("[Submission] Failed to cache preview locally:", e);
          }

          const pngFile = new File(
            [pngBlob],
            `submission_${assignmentId}_${Date.now()}.png`,
            { type: "image/png" },
          );
          const uploadedUrls = await uploadClassroomFiles([pngFile], {
            classId,
            category: "submissions",
          });

          if (uploadedUrls && uploadedUrls.length > 0) {
            console.log(
              "[Submission] PNG uploaded successfully:",
              uploadedUrls[0],
            );
            finalAttachments.push(uploadedUrls[0]);
          } else {
            console.error("[Submission] PNG upload returned no URLs");
          }
        }
      } catch (pngErr) {
        console.warn(
          "[Submission] Failed to auto-capture circuit PNG:",
          pngErr,
        );
      }

      // Store as a draft in sessionStorage for the dashboard modal to pick up
      const draftData = {
        notes: assignmentSubmissionForm.notes,
        attachments: finalAttachments,
        simulationShareId: simulationShareId,
        simulationUrl: simulationUrl,
        isDraft: true,
        updatedAt: new Date().toISOString(),
      };

      console.log("[Submission] Saving draft to sessionStorage:", draftData);
      sessionStorage.setItem(
        `ohw_submission_draft_${assignmentId}`,
        JSON.stringify(draftData),
      );

      setAssignmentSubmissionState({
        loading: false,
        saving: false,
        error: "",
        data: assignmentSubmissionState.data,
      });

      const targetClassId = classId || assignmentSubmissionAssignment?.classId;
      const targetAssignmentId =
        assignmentId || assignmentSubmissionAssignment?._id;
      const targetUrl = `/student/classes/${targetClassId}?openAssignment=${targetAssignmentId}`;

      console.log("[Submission] Stored draft and redirecting", {
        classId,
        assignmentId,
        targetUrl,
      });

      if (targetClassId && targetAssignmentId) {
        navigate(targetUrl);
      } else {
        alert(
          "Simulation captured! Please return to your dashboard to finalize submission.",
        );
      }
    } catch (error) {
      setAssignmentSubmissionState((current) => ({
        ...current,
        saving: false,
        error: error.message || "Failed to submit assignment.",
      }));
    }
  };

  // ── Project: debounced auto-save whenever circuit changes ─────────────────
  useEffect(() => {
    // Don't trigger auto-save if disabled or if waiting on toaster
    if (!autoSaveEnabled || restoreProjectPrompt) return;

    // Don't save if nothing is on the canvas
    if (components.length === 0 && wires.length === 0) return;

    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      const owner = user?.email || "guest";
      let id = currentProjectIdRef.current;
      if (!id) {
        id = generateProjectId();
        currentProjectIdRef.current = id;
        setCurrentProjectId(id);
      }
      const finalName = await saveProject({
        id,
        name: currentProjectName || "Untitled",
        board,
        components,
        connections: wires,
        code,
        blocklyXml,
        blocklyGeneratedCode,
        useBlocklyCode,
        projectFiles,
        openCodeTabs,
        activeCodeFileId,
        owner,
      });
      if (finalName && finalName !== currentProjectName) {
        setCurrentProjectName(finalName);
      }
      setTimeout(() => captureThumbnailRef.current?.(), 1500);
    }, 2500);

    return () => clearTimeout(autoSaveTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    components,
    wires,
    code,
    blocklyXml,
    blocklyGeneratedCode,
    useBlocklyCode,
    board,
    projectFiles,
    openCodeTabs,
    activeCodeFileId,
    autoSaveEnabled,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem("ohw_autosave_enabled", String(autoSaveEnabled));
    } catch (e) {
      // no-op
    }
  }, [autoSaveEnabled]);

  useEffect(() => {
    canvasZoomRef.current = canvasZoom;
  }, [canvasZoom]);
  useEffect(() => {
    canvasOffsetRef.current = canvasOffset;
  }, [canvasOffset]);
  useEffect(() => {
    isCanvasLockedRef.current = isCanvasLocked;
  }, [isCanvasLocked]);
  useEffect(() => {
    segDragRef.current = segDrag;
  }, [segDrag]);

  useEffect(() => {
    if (
      !isRunning &&
      !isComponentDragging &&
      !isDragging &&
      !isExplorerDragging &&
      !segDrag
    ) {
      return;
    }

    let rafId = 0;
    let frameStart = performance.now();
    let lastFrameAt = frameStart;
    let frameCount = 0;
    let worstFrameMs = 0;
    let lastFlushAt = 0;

    const sample = (now) => {
      frameCount += 1;
      const frameDeltaMs = now - lastFrameAt;
      lastFrameAt = now;
      if (frameDeltaMs > worstFrameMs) {
        worstFrameMs = frameDeltaMs;
      }

      if (workerRef.current) {
        // If the user is actively panning or dragging, throttle visual updates to ~12fps
        // This frees up the main thread to prioritize DOM layout and mouse events, fixing the drag lag.
        const isInteracting =
          isPanningRef.current ||
          movingComp.current ||
          isComponentDragging ||
          segDragRef.current ||
          isExplorerDraggingRef.current;

        const threshold = isInteracting ? 80 : 30; // 12fps during drag, ~33fps when running
        if (now - lastFlushAt >= threshold) {
          workerRef.current.postMessage({ type: "FLUSH_VISUALS" });
          lastFlushAt = now;
        }
      }

      const windowMs = now - frameStart;
      if (windowMs >= 1000) {
        const fps = (frameCount * 1000) / windowMs;
        // Canonicalize FPS telemetry modes to only three buckets the user requested:
        // - 'component-drag' : moving a component or dragging wires/segments
        // - 'canvas-pan'     : panning the whole canvas
        // - 'running'        : simulation running without active pan/drag
        // Fallback: 'idle' when none apply.
        const dragMode =
          movingComp.current || isComponentDragging || segDragRef.current
            ? "component-drag"
            : isPanningRef.current
              ? "canvas-pan"
              : isRunning
                ? "running"
                : "idle";
        const signature = `${dragMode}:${Math.round(fps)}:${Math.round(worstFrameMs)}:${solverMode}`;
        const prev = runFpsTelemetryLastLogRef.current.get("browser") || null;

        if (prev !== signature && !isDragging && !isExplorerDragging) {
          const line = [
            "FPS browser",
            `mode=${dragMode}`,
            `fps=${fps.toFixed(1)}`,
            `worstDelta=${worstFrameMs.toFixed(1)}ms`,
            `solver=${solverMode}`,
          ].join(" | ");

          appendConsoleEntry(
            fps < 45 || worstFrameMs > 24 ? "warn" : "info",
            line,
            "debug",
          );
          runFpsTelemetryLastLogRef.current.set("browser", signature);
        }

        if (workerRef.current) {
          workerRef.current.postMessage({
            type: "REAL_METRICS",
            canvasFps: fps,
            uiMainThreadBlockedTimeMs: worstFrameMs,
          });
        }

        frameStart = now;
        lastFrameAt = now;
        frameCount = 0;
        worstFrameMs = 0;
      }

      if (
        isRunning ||
        isComponentDragging ||
        isDragging ||
        isExplorerDragging ||
        segDrag ||
        movingComp.current
      ) {
        rafId = requestAnimationFrame(sample);
      }
    };

    rafId = requestAnimationFrame(sample);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [
    isRunning,
    isComponentDragging,
    isDragging,
    isExplorerDragging,
    segDrag,
    solverMode,
  ]);

  // Persist favourite projects
  useEffect(() => {
    localStorage.setItem(
      "ohw_favourite_projects",
      JSON.stringify(favouriteProjectIds),
    );
  }, [favouriteProjectIds]);

  // Fullscreen sync
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      pageRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  // ── Fetch and inject dynamically installed components from the backend ──────
  useEffect(() => {
    (async () => {
      try {
        const installedComps = await fetchPublicInstalledComponents();
        if (!installedComps || installedComps.length === 0) return;

        const Babel = await getBabel();
        let injectedCount = 0;

        for (const comp of installedComps) {
          const { id, files } = comp;
          if (
            !files ||
            !files["manifest.json"] ||
            !files["ui.tsx"] ||
            !files["logic.ts"]
          )
            continue;

          try {
            const manifest = JSON.parse(files["manifest.json"]);
            const uiRaw = files["ui.tsx"];
            const logicRaw = files["logic.ts"];
            const compType = manifest.type || id;

            // Skip if it's a core component or already compiled natively into the frontend
            if (BUILTIN_COMPONENT_TYPES.has(compType)) continue;
            if (
              COMPONENT_REGISTRY[compType] &&
              !COMPONENT_REGISTRY[compType].isDynamic
            )
              continue;

            const transpileUI = Babel.transform(uiRaw, {
              filename: "ui.tsx",
              presets: ["react", "typescript", "env"],
            }).code;
            const transpileLogic = Babel.transform(logicRaw, {
              filename: "logic.ts",
              presets: ["typescript", "env"],
            }).code;
            assertSafeDynamicModule(transpileUI, "ui.tsx");
            assertSafeDynamicModule(transpileLogic, "logic.ts");

            const exportsUI = {};
            const evalUI = new Function(
              "exports",
              "require",
              "React",
              transpileUI,
            );
            evalUI(
              exportsUI,
              (mod) => {
                if (mod === "react") return React;
                if (mod.endsWith("manifest.json")) return manifest;
                return null;
              },
              React,
            );

            const uiComponent = resolveUiExport(exportsUI);
            if (!uiComponent) continue;

            // Inject into catalog
            const newCatItem = { ...manifest };
            delete newCatItem.pins;
            delete newCatItem.group;

            const groupName =
              GROUP_MAPPING[manifest.group] || manifest.group || "Misc";
            let group = LOCAL_CATALOG.find((g) => g.group === groupName);
            if (!group) {
              group = { group: groupName, items: [] };
              LOCAL_CATALOG.push(group);
            }
            group.items = group.items.filter((i) => i.type !== compType);
            group.items.push(newCatItem);
            sortCatalog(LOCAL_CATALOG);

            COMPONENT_REGISTRY[compType] = {
              manifest,
              UI: uiComponent,
              BOUNDS: exportsUI.BOUNDS,
              ContextMenu:
                exportsUI[
                Object.keys(exportsUI).find((k) =>
                  k.toLowerCase().includes("contextmenu"),
                )
                ],
              contextMenuDuringRun: !!(
                exportsUI.contextMenuDuringRun || manifest.contextMenuDuringRun
              ),
              contextMenuOnlyDuringRun: !!(
                exportsUI.contextMenuOnlyDuringRun ||
                manifest.contextMenuOnlyDuringRun
              ),
              logicCode: transpileLogic,
              uiRaw,
              logicRaw,
              isDynamic: true, // Flag to distinguish dynamically injected components
            };
            if (manifest.pins) LOCAL_PIN_DEFS[compType] = manifest.pins;
            injectedCount++;
          } catch (err) {
            console.error(
              `[SimulatorPage] Failed to inject dynamically installed component ${id}:`,
              err,
            );
          }
        }

        if (injectedCount > 0) {
          sortCatalog(LOCAL_CATALOG);
          setCustomCatalogCounter((c) => c + 1);
          console.log(
            `[SimulatorPage] Successfully injected ${injectedCount} permanently installed custom components.`,
          );
        }
      } catch (err) {
        console.error(
          "[SimulatorPage] Failed to fetch permanently installed components:",
          err,
        );
      }
    })();
  }, []);

  // ── Admin Preview: inject a pending component passed via sessionStorage ──────
  // When admin clicks "Test in Simulator", AdminPage stores the component in
  // sessionStorage and opens /simulator in a new tab. This effect picks it up,
  // transpiles + injects it into the local registry (browser memory only),
  // and shows a banner so the admin knows it's in preview mode.
  useEffect(() => {
    const previewKey = sessionStorage.getItem("pendingPreviewKey");
    if (!previewKey) return;

    const raw = sessionStorage.getItem(previewKey);
    // Clean up immediately so a manual refresh doesn't re-inject
    sessionStorage.removeItem(previewKey);
    sessionStorage.removeItem("pendingPreviewKey");
    if (!raw) return;

    try {
      const comp = JSON.parse(raw);
      const { manifest, uiRaw, logicRaw } = comp;
      if (!manifest || !uiRaw || !logicRaw) return;

      const compType = manifest.type || comp.id;

      // Use async IIFE so await getBabel() is valid inside useEffect
      (async () => {
        const Babel = await getBabel();
        const transpileUI = Babel.transform(uiRaw, {
          filename: "ui.tsx",
          presets: ["react", "typescript", "env"],
        }).code;
        const transpileLogic = Babel.transform(logicRaw, {
          filename: "logic.ts",
          presets: ["typescript", "env"],
        }).code;
        assertSafeDynamicModule(transpileUI, "ui.tsx");
        assertSafeDynamicModule(transpileLogic, "logic.ts");

        const exportsUI = {};
        const evalUI = new Function("exports", "require", "React", transpileUI);
        evalUI(
          exportsUI,
          (mod) => {
            if (mod === "react") return React;
            if (mod.endsWith("manifest.json")) return manifest;
            return null;
          },
          React,
        );

        const uiComponent = resolveUiExport(exportsUI);
        if (!uiComponent) {
          console.warn(
            "[SimulatorPage] Preview: UI component could not be evaluated.",
          );
          return;
        }

        // Inject into catalog & registry
        const newCatItem = { ...manifest };
        delete newCatItem.pins;
        delete newCatItem.group;

        const groupName =
          GROUP_MAPPING[manifest.group] || manifest.group || "Misc";
        let group = LOCAL_CATALOG.find((g) => g.group === groupName);
        if (!group) {
          group = { group: groupName, items: [] };
          LOCAL_CATALOG.push(group);
        }
        group.items = group.items.filter((i) => i.type !== compType);
        group.items.push(newCatItem);
        sortCatalog(LOCAL_CATALOG);

        COMPONENT_REGISTRY[compType] = {
          manifest,
          UI: uiComponent,
          BOUNDS: exportsUI.BOUNDS,
          ContextMenu:
            exportsUI[
            Object.keys(exportsUI).find((k) =>
              k.toLowerCase().includes("contextmenu"),
            )
            ],
          contextMenuDuringRun: !!(
            exportsUI.contextMenuDuringRun || manifest.contextMenuDuringRun
          ),
          contextMenuOnlyDuringRun: !!(
            exportsUI.contextMenuOnlyDuringRun ||
            manifest.contextMenuOnlyDuringRun
          ),
          logicCode: transpileLogic,
          uiRaw,
          logicRaw,
        };
        if (manifest.pins) LOCAL_PIN_DEFS[compType] = manifest.pins;

        setCustomCatalogCounter((c) => c + 1);
        setPreviewBanner({ id: comp.id, label: manifest.label || comp.id });
        console.log(
          `[SimulatorPage] Admin preview: injected "${manifest.label}" (${compType}) into local registry.`,
        );
      })().catch((e) =>
        console.error(
          "[SimulatorPage] Failed to inject admin preview component:",
          e.message,
        ),
      );
    } catch (e) {
      console.error(
        "[SimulatorPage] Failed to inject admin preview component:",
        e.message,
      );
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

          const manifestStr = files["manifest.json"];
          const uiStr = files["ui.tsx"] || files["ui.jsx"];
          const logicStr = files["logic.ts"] || files["logic.js"];
          if (!manifestStr || !uiStr || !logicStr) continue;

          try {
            const manifest = JSON.parse(manifestStr);
            const compType = manifest.type || id;
            currentInstalledTypes.add(compType);

            // Skip if it's a core component or already in registry
            if (BUILTIN_COMPONENT_TYPES.has(compType)) continue;
            if (COMPONENT_REGISTRY[compType]) continue;

            const Babel = await getBabel();
            const transpileUI = Babel.transform(uiStr, {
              filename: "ui.tsx",
              presets: ["react", "typescript", "env"],
            }).code;
            const transpileLogic = Babel.transform(logicStr, {
              filename: "logic.ts",
              presets: ["typescript", "env"],
            }).code;
            assertSafeDynamicModule(transpileUI, "ui.tsx");
            assertSafeDynamicModule(transpileLogic, "logic.ts");

            const exportsUI = {};
            const evalUI = new Function(
              "exports",
              "require",
              "React",
              transpileUI,
            );
            evalUI(
              exportsUI,
              (mod) => {
                if (mod === "react") return React;
                if (mod.endsWith("manifest.json")) return manifest;
                return null;
              },
              React,
            );

            const uiComponent = resolveUiExport(exportsUI);
            if (!uiComponent) continue;

            // Inject into catalog
            const newCatItem = { ...manifest };
            delete newCatItem.pins;
            delete newCatItem.group;

            const groupName =
              GROUP_MAPPING[manifest.group] || manifest.group || "Misc";
            let group = LOCAL_CATALOG.find((g) => g.group === groupName);
            if (!group) {
              group = { group: groupName, items: [] };
              LOCAL_CATALOG.push(group);
            }
            group.items = group.items.filter((i) => i.type !== compType);
            group.items.push(newCatItem);
            sortCatalog(LOCAL_CATALOG);

            COMPONENT_REGISTRY[compType] = {
              manifest,
              UI: uiComponent,
              BOUNDS: exportsUI.BOUNDS,
              ContextMenu:
                exportsUI[
                Object.keys(exportsUI).find((k) =>
                  k.toLowerCase().includes("contextmenu"),
                )
                ],
              contextMenuDuringRun: !!(
                exportsUI.contextMenuDuringRun || manifest.contextMenuDuringRun
              ),
              contextMenuOnlyDuringRun: !!(
                exportsUI.contextMenuOnlyDuringRun ||
                manifest.contextMenuOnlyDuringRun
              ),
              logicCode: transpileLogic,
              uiRaw: uiStr,
              logicRaw: logicStr,
              validationRaw:
                files["validation.ts"] || files["validation.js"] || "",
              indexRaw: files["index.ts"] || files["index.js"] || "",
              ...(files["docs/index.html"]
                ? { doc: files["docs/index.html"] }
                : {}),
            };
            if (manifest.pins) LOCAL_PIN_DEFS[compType] = manifest.pins;

            BACKEND_INJECTED_TYPES.add(compType); // track so we can detect future deletions
            injectedCount++;
          } catch (e) {
            console.warn(
              `[SimulatorPage] Failed to inject component "${id}":`,
              e.message,
            );
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
              group.items = group.items.filter((i) => i.type !== type);
            }
            // Clean up empty groups
            const idx = LOCAL_CATALOG.findIndex((g) => g.items.length === 0);
            if (idx !== -1) LOCAL_CATALOG.splice(idx, 1);

            BACKEND_INJECTED_TYPES.delete(type);
            removedCount++;
            console.log(
              `[SimulatorPage] Removed deleted component "${type}" from panel.`,
            );
          }
        }

        if (injectedCount > 0 || removedCount > 0) {
          setCustomCatalogCounter((c) => c + 1); // triggers palette re-render
        }
      } catch (e) {
        // Silently ignore — backend may be starting up or unreachable
        console.warn("[SimulatorPage] Component sync skipped:", e.message);
      }
    };

    // Run once immediately on mount, then poll every 60 seconds.
    // Skip polling when the browser tab is hidden to avoid wasted work.
    syncComponents();
    const syncInterval = setInterval(() => {
      if (!document.hidden) syncComponents();
    }, 60000);
    return () => clearInterval(syncInterval); // cleanup on unmount
  }, []);

  const handleSearchLibraries = async (e) => {
    if (e) e.preventDefault();
    if (!libQuery.trim()) return;

    // Check cache first
    if (libSearchCache.current[libQuery.trim()]) {
      setLibResults(libSearchCache.current[libQuery.trim()]);
      setLibMessage(null);
      return;
    }

    setIsSearchingLib(true);
    setLibMessage(null);
    try {
      const libraries = await searchLibraries(libQuery);
      libSearchCache.current[libQuery.trim()] = libraries;
      setLibResults(libraries);
      if (libraries.length === 0)
        setLibMessage({ type: "error", text: "No libraries found." });
    } catch (err) {
      setLibMessage({ type: "error", text: "Failed to search libraries." });
    } finally {
      setIsSearchingLib(false);
    }
  };

  const handleInstallLibrary = async (libName) => {
    setInstallingLib(libName);
    setLibMessage(null);
    try {
      const res = await installLibrary(libName);
      setLibMessage({ type: "success", text: res.message });
      loadLibraries();
      lastCompiledRef.current = null;
    } catch (err) {
      setLibMessage({ type: "error", text: "Failed to install library." });
    } finally {
      setInstallingLib(null);
    }
  };

  // ── Handle Panel Resize ──────────────────────────────────────────────────────
  const onMouseDownResize = useCallback(
    (e) => {
      e.preventDefault();
      const startWidth = panelWidth;
      if (rightPanelRef.current?.aside) {
        rightPanelRef.current.aside.style.setProperty(
          "--panel-width",
          `${startWidth}px`,
        );
      }
      setIsDragging(true);
      const startX = e.clientX;
      let finalWidth = startWidth;

      const onMouseMove = (moveEvent) => {
        const start = performance.now();
        const delta = startX - moveEvent.clientX; // Left drag increases width
        const maxWidth = Math.min(1100, window.innerWidth * 0.7);
        finalWidth = Math.max(250, Math.min(maxWidth, startWidth + delta));
        if (rightPanelRef.current?.aside) {
          rightPanelRef.current.aside.style.setProperty(
            "--panel-width",
            `${finalWidth}px`,
          );
        }
        const duration = performance.now() - start;
        if (duration > 5) {
          console.warn(
            `[Performance] onMouseDownResize.onMouseMove took ${duration.toFixed(2)}ms`,
          );
        }
      };

      const onMouseUp = () => {
        setIsDragging(false);
        setPanelWidth(finalWidth);
        if (rightPanelRef.current?.aside) {
          rightPanelRef.current.aside.style.removeProperty("--panel-width");
        }
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [panelWidth],
  );

  const onMouseDownConsoleResize = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startY = e.clientY;
      const startHeight = consoleHeight;
      const consoleEl = document.querySelector(
        '[data-simulation-console="true"]',
      );
      if (consoleEl) {
        consoleEl.style.setProperty("--console-height", `${startHeight}px`);
      }
      let finalHeight = startHeight;

      const onMouseMove = (moveEvent) => {
        const delta = startY - moveEvent.clientY;
        const newHeight = Math.max(140, Math.min(540, startHeight + delta));
        finalHeight = newHeight;
        if (consoleEl) {
          consoleEl.style.setProperty("--console-height", `${finalHeight}px`);
        }
      };

      const onMouseUp = () => {
        setConsoleHeight(finalHeight);
        if (consoleEl) {
          consoleEl.style.removeProperty("--console-height");
        }
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [consoleHeight, setConsoleHeight],
  );

  const onMouseDownExplorerResize = useCallback(
    (e) => {
      e.preventDefault();
      if (rightPanelRef.current?.explorer) {
        rightPanelRef.current.explorer.style.setProperty(
          "--explorer-width",
          `${explorerWidth}px`,
        );
      }
      setIsExplorerDragging(true);
    },
    [explorerWidth],
  );

  useEffect(() => {
    if (!isExplorerDragging) return;
    let finalExpWidth = explorerWidth;
    const onMouseMove = (e) => {
      const start = performance.now();
      const rightPanelStart = window.innerWidth - panelWidth;
      finalExpWidth = Math.max(
        120,
        Math.min(200, panelWidth - 100, e.clientX - rightPanelStart),
      );
      if (rightPanelRef.current?.explorer) {
        rightPanelRef.current.explorer.style.setProperty(
          "--explorer-width",
          `${finalExpWidth}px`,
        );
      }
      const duration = performance.now() - start;
      if (duration > 5) {
        console.warn(
          `[Performance] onMouseDownExplorerResize.onMouseMove took ${duration.toFixed(2)}ms`,
        );
      }
    };
    const onMouseUp = () => {
      setIsExplorerDragging(false);
      setExplorerWidth(finalExpWidth);
      if (rightPanelRef.current?.explorer) {
        rightPanelRef.current.explorer.style.removeProperty("--explorer-width");
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isExplorerDragging, panelWidth, explorerWidth]);

  // ── Close palette context menu on outside click ──────────────────────────
  // paletteContextMenu effect moved to PalettePanel

  // ── Close View panel on outside click ──────────────────────────────────────
  useEffect(() => {
    if (!showViewPanel) return;
    const close = (e) => {
      if (viewPanelRef.current && !viewPanelRef.current.contains(e.target))
        setShowViewPanel(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showViewPanel]);

  // Filter dropdown effect moved to PalettePanel

  // ── Load Wokwi bundle ───────────────────────────────────────────────────────
  useEffect(() => {
    if (
      !customElements.get("wokwi-7segment") &&
      !document.getElementById("wokwi-bundle")
    ) {
      const s = document.createElement("script");
      s.id = "wokwi-bundle";
      s.src =
        "/wokwi-elements.bundle.js";
      document.head.appendChild(s);
    }
  }, []);

  // ── Smart Prefetching for Simulation Runners ───────────────────────────────
  const preloadedBoardsRef = useRef(new Set());
  useEffect(() => {
    if (!components) return;
    const currentBoardTypes = components
      .filter((c) => /arduino|esp32|stm32|pico|rp2040|attiny/i.test(c.type))
      .map((c) => c.type);

    const newTypesToPreload = currentBoardTypes.filter(type => !preloadedBoardsRef.current.has(type));
    if (newTypesToPreload.length > 0) {
      newTypesToPreload.forEach(t => preloadedBoardsRef.current.add(t));
      const prefetchWorker = new Worker(new URL("../../worker/simulation.worker.ts", import.meta.url), { type: "module" });
      const dummyComponents = newTypesToPreload.map(type => ({ type }));
      prefetchWorker.postMessage({ type: "PRELOAD_RUNNERS", components: dummyComponents });

      const timer = setTimeout(() => prefetchWorker.terminate(), 5000);
      return () => { clearTimeout(timer); prefetchWorker.terminate(); };
    }
  }, [components]);

  // ── Validation toast auto-dismiss ───────────────────────────────────────────
  useEffect(() => {
    if (!validationToast) return undefined;
    const timer = setTimeout(() => setValidationToast(null), 10000);
    return () => clearTimeout(timer);
  }, [validationToast]);

  // ── Load Catalog on Mount ────────────────────────────────────────────────────
  const CATALOG = useMemo(() => {
    // Return a shallow copy so React detects the update and re-renders the palette
    return LOCAL_CATALOG.map((group) => ({
      ...group,
      items: [...group.items],
    }));
  }, [customCatalogVersion]);
  const PIN_DEFS = LOCAL_PIN_DEFS;

  // ── Static component descriptions ────────────────────────────────────────────
  const COMPONENT_DESCRIPTIONS = {
    "wokwi-led":
      "Light-emitting diode. Emits light when current flows through it. Supports multiple colors.",
    "openhw-led":
      "Light-emitting diode. Emits light when current flows through it. Supports multiple colors.",
    "wokwi-arduino-uno":
      "ATmega328P-based microcontroller board. 14 digital I/O pins, 6 analog inputs, USB connectivity.",
    "openhw-arduino-uno":
      "ATmega328P-based microcontroller board. 14 digital I/O pins, 6 analog inputs, USB connectivity.",
    "wokwi-arduino-mega":
      "ATmega2560-based microcontroller board. 54 digital I/O pins, 16 analog inputs, 4 UARTs.",
    "openhw-arduino-mega":
      "ATmega2560-based microcontroller board. 54 digital I/O pins, 16 analog inputs, 4 UARTs.",
    "wokwi-arduino-nano":
      "Compact ATmega328P-based board. Similar to Uno but in a breadboard-friendly form factor.",
    "openhw-arduino-nano":
      "Compact ATmega328P-based board. Similar to Uno but in a breadboard-friendly form factor.",
    "wokwi-attiny85":
      "Small 8-pin microcontroller. Perfect for simple, low-power projects.",
    "openhw-attiny85":
      "Small 8-pin microcontroller. Perfect for simple, low-power projects.",
    "wokwi-raspberry-pi-pico":
      "Dual-core ARM Cortex-M0+ microcontroller. High performance and flexible digital interfaces.",
    "openhw-pico":
      "Dual-core ARM Cortex-M0+ microcontroller. High performance and flexible digital interfaces.",
    "wokwi-breadboard":
      "Full-size solderless breadboard. 830 tie points for prototyping circuits.",
    "openhw-breadboard":
      "Full-size solderless breadboard. 830 tie points for prototyping circuits.",
    "wokwi-breadboard-half":
      "Half-size solderless breadboard. 400 tie points for smaller circuits.",
    "openhw-breadboard-half":
      "Half-size solderless breadboard. 400 tie points for smaller circuits.",
    "wokwi-breadboard-mini":
      "Mini solderless breadboard. 170 tie points for very compact prototypes.",
    "openhw-breadboard-mini":
      "Mini solderless breadboard. 170 tie points for very compact prototypes.",
    "wokwi-resistor":
      "Passive two-terminal component. Limits current flow. Configurable resistance value.",
    "openhw-resistor":
      "Passive two-terminal component. Limits current flow. Configurable resistance value.",
    "wokwi-pushbutton":
      "Momentary tactile push button. Connects circuit while pressed, opens when released.",
    "openhw-pushbutton":
      "Momentary tactile push button. Connects circuit while pressed, opens when released.",
    "wokwi-power-supply":
      "Provides stable DC power to the circuit. Configurable voltage output.",
    "openhw-power-supply":
      "Provides stable DC power to the circuit. Configurable voltage output.",
    "wokwi-neopixel-matrix":
      "Addressable RGB LED matrix. Individually controllable pixels via single data line.",
    "openhw-neopixel-matrix":
      "Addressable RGB LED matrix. Individually controllable pixels via single data line.",
    "wokwi-buzzer":
      "Piezoelectric buzzer. Generates audio tones when driven by PWM or digital signals.",
    "openhw-buzzer":
      "Piezoelectric buzzer. Generates audio tones when driven by PWM or digital signals.",
    "wokwi-motor":
      "DC motor. Converts electrical energy to rotational motion. Controlled via H-bridge.",
    "openhw-motor":
      "DC motor. Converts electrical energy to rotational motion. Controlled via H-bridge.",
    "wokwi-servo":
      "Hobby servo motor. Precise angular position control via PWM signal (0–180°).",
    "openhw-servo":
      "Hobby servo motor. Precise angular position control via PWM signal (0–180°).",
    "wokwi-motor-driver":
      "Dual H-bridge motor driver (L293D). Controls speed and direction of two DC motors.",
    "openhw-motor-driver":
      "Dual H-bridge motor driver (L293D). Controls speed and direction of two DC motors.",
    "wokwi-slide-potentiometer":
      "Linear slide potentiometer. Provides variable analog voltage via sliding knob.",
    "openhw-slide-potentiometer":
      "Linear slide potentiometer. Provides variable analog voltage via sliding knob.",
    "wokwi-potentiometer":
      "Rotary potentiometer. Variable resistor providing analog voltage proportional to rotation.",
    "openhw-potentiometer":
      "Rotary potentiometer. Variable resistor providing analog voltage proportional to rotation.",
    "wokwi-analog-joystick":
      "2-axis analog joystick. Provides X and Y axis voltage limits along with a push button.",
    "openhw-analog-joystick":
      "2-axis analog joystick. Provides X and Y axis voltage limits along with a push button.",
    shift_register:
      "74HC595 8-bit serial-in, parallel-out shift register. Expands digital outputs.",
    "wokwi-membrane-keypad":
      "4x4 Membrane Keypad. Provides a matrix of 16 buttons for code input or navigation.",
    "openhw-membrane-keypad":
      "4x4 Membrane Keypad. Provides a matrix of 16 buttons for code input or navigation.",
    "wokwi-rgb-led": "RGB LED. Emits red, green, blue, or mixed colors.",
    "openhw-rgb-led": "RGB LED. Emits red, green, blue, or mixed colors.",
    "wokwi-nokia-5110":
      "Nokia 5110 LCD Screen. 84x48 monochrome graphic display.",
    "openhw-nokia-5110":
      "Nokia 5110 LCD Screen. 84x48 monochrome graphic display.",
    "wokwi-soil-moisture-sensor":
      "Soil moisture sensor module. Outputs analog/digital moisture level.",
    "openhw-soil-moisture-sensor":
      "Soil moisture sensor module. Outputs analog/digital moisture level.",
    "wokwi-logic-analyzer":
      "8-channel logic analyzer for debugging digital signals.",
    "openhw-logic-analyzer":
      "8-channel logic analyzer for debugging digital signals.",
    "wokwi-sd-card": "MicroSD card module for SPI data logging and storage.",
    "openhw-sd-card": "MicroSD card module for SPI data logging and storage.",
    "wokwi-ldr-module":
      "Light-dependent resistor module with digital and analog outputs.",
    "openhw-ldr-module":
      "Light-dependent resistor module with digital and analog outputs.",
    "wokwi-tm1637-7segment": "TM1637 4-digit 7-segment display module.",
    "openhw-tm1637-7segment": "TM1637 4-digit 7-segment display module.",
    "wokwi-cd74hc4067": "CD74HC4067 16-channel analog/digital multiplexer.",
    "openhw-cd74hc4067": "CD74HC4067 16-channel analog/digital multiplexer.",
    "wokwi-7segment": "7-segment LED display.",
    "openhw-7segment": "7-segment LED display.",
    "wokwi-a4988": "A4988 stepper motor driver.",
    "openhw-a4988": "A4988 stepper motor driver.",
    "wokwi-bmp180": "BMP180 barometric pressure and temperature sensor.",
    "openhw-bmp180": "BMP180 barometric pressure and temperature sensor.",
    "wokwi-bmp180-breakout":
      "BMP180 barometric pressure and temperature sensor breakout.",
    "openhw-bmp180-breakout":
      "BMP180 barometric pressure and temperature sensor breakout.",
    "wokwi-ds1307-rtc": "DS1307 Real-Time Clock module.",
    "openhw-ds1307-rtc": "DS1307 Real-Time Clock module.",
    "wokwi-hc-sr04": "HC-SR04 ultrasonic distance sensor.",
    "openhw-hc-sr04": "HC-SR04 ultrasonic distance sensor.",
    "wokwi-ili9341": "ILI9341 2.8 inch TFT LCD display.",
    "openhw-ili9341": "ILI9341 2.8 inch TFT LCD display.",
    "wokwi-l293d": "L293D motor driver IC.",
    "openhw-l293d": "L293D motor driver IC.",
    "wokwi-lcd1602-i2c": "16x2 LCD display with I2C backpack.",
    "openhw-lcd1602-i2c": "16x2 LCD display with I2C backpack.",
    "wokwi-lcd2004-i2c": "20x4 LCD display with I2C backpack.",
    "openhw-lcd2004-i2c": "20x4 LCD display with I2C backpack.",
    "wokwi-max7219": "MAX7219 8x8 LED matrix module.",
    "openhw-max7219": "MAX7219 8x8 LED matrix module.",
    "wokwi-mpu6050": "MPU6050 6-axis accelerometer and gyroscope.",
    "openhw-mpu6050": "MPU6050 6-axis accelerometer and gyroscope.",
    "wokwi-nlsf595": "NLSF595 tri-state shift register.",
    "openhw-nlsf595": "NLSF595 tri-state shift register.",
    "wokwi-pca9685": "PCA9685 16-channel 12-bit PWM/servo driver.",
    "openhw-pca9685": "PCA9685 16-channel 12-bit PWM/servo driver.",
    "wokwi-pca9865": "PCA9865 16-channel PWM module.",
    "openhw-pca9865": "PCA9865 16-channel PWM module.",
    "wokwi-relay-module": "Relay module for controlling high-power devices.",
    "openhw-relay-module": "Relay module for controlling high-power devices.",
    "wokwi-ssd1306-oled": "SSD1306 128x64 OLED display.",
    "openhw-ssd1306-oled": "SSD1306 128x64 OLED display.",
    "wokwi-stepper-motor": "Bipolar stepper motor.",
    "openhw-stepper-motor": "Bipolar stepper motor.",
  };

  // ── Error component IDs for highlighting ────────────────────────────────────
  const errorCompIds = useMemo(
    () => new Set(validationErrors.flatMap((e) => e.compIds)),
    [validationErrors],
  );

  // ── Info of currently selected canvas component (for description panel) ──────
  const selectedComponentInfo = useMemo(() => {
    if (!selected) return null;
    const comp = components.find((c) => c.id === selected);
    if (!comp) return null;
    for (const group of CATALOG) {
      const item = group.items.find((i) => i.type === comp.type);
      if (item) return { ...item, group: group.group };
    }
    return { type: comp.type, label: comp.label || comp.type, group: "Custom" };
  }, [selected, components]);

  // ── Serial auto-scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    const activeAutoscroll = boardAutoscrolls[serialBoardFilter] ?? true;
    const activePaused = boardPausedStates[serialBoardFilter] ?? serialPaused;
    if (activeAutoscroll && !activePaused && serialOutputRef.current) {
      serialOutputRef.current.scrollTop = serialOutputRef.current.scrollHeight;
    }
  }, [serialHistory, serialPaused, serialBoardFilter, boardAutoscrolls, boardPausedStates]);

  useEffect(() => {
    serialPausedRef.current = serialPaused;
  }, [serialPaused]);

  useEffect(() => {
    try {
      localStorage.setItem("openhw.serial.lineEnding", serialLineEnding);
    } catch (e) {
      // no-op: storage may be unavailable in restricted contexts
    }
  }, [serialLineEnding]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "openhw.rp2040.debugTelemetry",
        rp2040DebugTelemetryEnabled ? "1" : "0",
      );
    } catch (e) {
      // no-op: storage may be unavailable in restricted contexts
    }
  }, [rp2040DebugTelemetryEnabled]);

  useEffect(() => {
    if (serialBoardFilter === "all") return;
    if (!serialBoardOptions.includes(serialBoardFilter)) {
      setSerialBoardFilter(
        serialBoardOptions.length > 1 ? serialBoardOptions[1] : "all",
      );
    }
  }, [serialBoardFilter, serialBoardOptions]);

  useEffect(() => {
    setProjectFiles((prev) => {
      const normalized = normalizeProjectFiles(prev);
      let changed = normalized.length !== prev.length;
      let result = [...normalized];

      // Preserve and migrate board files for boards no longer present
      const validBoardIds = new Set(boardComponents.map((b) => b.id));
      const pruned = [];

      // If boardComponents is empty (e.g. during initial mount/project loading before React setComponents commits,
      // or when canvas is cleared/only contains non-board components), do not prune project files or generate board code
      // to prevent wiping out loaded code files. However, we MUST still generate/update project/diagram.json.
      if (boardComponents.length === 0) {
        const diagramPayload = buildProjectPayload({
          board,
          components,
          wires,
          code,
          includeCode: false,
          blocklyXml,
          blocklyGeneratedCode,
          useBlocklyCode,
          projectFiles: result,
          openCodeTabs,
          activeCodeFileId,
        });
        const diagramJsonPayload = { ...diagramPayload };
        delete diagramJsonPayload.schemaVersion;
        if (diagramJsonPayload.board === "arduino_uno")
          delete diagramJsonPayload.board;
        if (
          !diagramJsonPayload.components ||
          diagramJsonPayload.components.length === 0
        )
          delete diagramJsonPayload.components;
        if (
          !diagramJsonPayload.connections ||
          diagramJsonPayload.connections.length === 0
        )
          delete diagramJsonPayload.connections;
        if (!diagramJsonPayload.blocklyXml)
          delete diagramJsonPayload.blocklyXml;
        delete diagramJsonPayload.blocklyGeneratedCode;
        if (!diagramJsonPayload.useBlocklyCode)
          delete diagramJsonPayload.useBlocklyCode;
        delete diagramJsonPayload.projectFiles;
        delete diagramJsonPayload.openCodeTabs;
        delete diagramJsonPayload.activeCodeFileId;
        const diagramJson = JSON.stringify(diagramJsonPayload, null, 2);

        const generatedRootFiles = [
          {
            id: "project/diagram.json",
            path: "project/diagram.json",
            name: "diagram.json",
            kind: "root",
            content: diagramJson,
            dirty: false,
          },
        ];

        generatedRootFiles.forEach((rootFile) => {
          const idx = result.findIndex((file) => file.id === rootFile.id);
          if (idx === -1) {
            result.push(rootFile);
            changed = true;
            return;
          }

          const current = result[idx];
          if (
            current.path !== rootFile.path ||
            current.name !== rootFile.name ||
            current.kind !== rootFile.kind ||
            current.content !== rootFile.content ||
            current.dirty !== false
          ) {
            result[idx] = {
              ...current,
              path: rootFile.path,
              name: rootFile.name,
              kind: rootFile.kind,
              content: rootFile.content,
              dirty: false,
            };
            changed = true;
          }
        });

        return changed ? normalizeProjectFiles(result) : prev;
      }

      result.forEach((f) => {
        const m = f.path.match(/^project\/([^/]+)\//);
        if (!m) {
          pruned.push(f);
          return;
        }
        const fileBoardId = m[1];
        if (validBoardIds.has(fileBoardId)) {
          pruned.push(f);
        } else if (boardComponents.length > 0) {
          // Adopt orphan files into the first board that doesn't already have code files
          const targetBoard = boardComponents.find(
            (b) =>
              !result.some(
                (existing) =>
                  existing.boardId === b.id && existing.kind === "code",
              ),
          );
          if (targetBoard) {
            const targetKind = normalizeBoardKind(targetBoard.type);
            let newName = f.name;
            if (f.name.startsWith(fileBoardId)) {
              newName = f.name.replace(fileBoardId, targetBoard.id);
            }
            const newPath = `project/${targetBoard.id}/${newName}`;
            if (
              !result.some(
                (existing) =>
                  existing.boardId === targetBoard.id &&
                  existing.path === newPath,
              )
            ) {
              pruned.push({
                ...f,
                id: newPath,
                path: newPath,
                name: newName,
                boardId: targetBoard.id,
                boardKind: targetKind,
              });
              changed = true;
            }
          }
        }
      });

      if (pruned.length !== result.length) changed = true;
      result = [...pruned];

      const replaceFilePath = (fromPath, toPath) => {
        if (!fromPath || !toPath || fromPath === toPath) return;
        const sourceIdx = result.findIndex((file) => file.id === fromPath);
        if (sourceIdx === -1) return;

        const duplicateIdx = result.findIndex(
          (file, idx) => idx !== sourceIdx && file.id === toPath,
        );
        if (duplicateIdx !== -1) {
          result.splice(sourceIdx, 1);
          changed = true;
          return;
        }

        const source = result[sourceIdx];
        result[sourceIdx] = {
          ...source,
          id: toPath,
          path: toPath,
          name: toPath.split("/").pop() || source.name,
        };
        changed = true;
      };

      const upsert = (fileObj) => {
        const idx = result.findIndex((f) => f.id === fileObj.id);
        if (idx === -1) {
          result.push(fileObj);
          changed = true;
        } else {
          const existing = result[idx];
          if (
            existing.path !== fileObj.path ||
            existing.name !== fileObj.name ||
            existing.boardId !== fileObj.boardId ||
            existing.boardKind !== fileObj.boardKind
          ) {
            result[idx] = {
              ...existing,
              ...fileObj,
              content: existing.content,
              dirty: existing.dirty,
            };
            changed = true;
          }
        }
      };

      const libraries = (libInstalled || [])
        .map((l) => l?.library?.name || l?.name)
        .filter(Boolean);

      boardComponents.forEach((bc) => {
        const kind = normalizeBoardKind(bc.type);
        const basePath = `project/${bc.id}`;
        const rp2040Mode =
          kind === "rp2040"
            ? normalizeRp2040Env(
              resolveComponentAttrString(bc?.attrs, "env", "native"),
            )
            : "native";

        for (let i = 0; i < result.length; i += 1) {
          const file = result[i];
          if (!file.path.startsWith(`${basePath}/`)) continue;
          if (file.boardId !== bc.id || file.boardKind !== kind) {
            result[i] = { ...file, boardId: bc.id, boardKind: kind };
            changed = true;
          }
        }

        const expectedMainName = getDefaultMainFileName(kind, bc.id, {
          rp2040Mode,
        });
        const expectedMainPath = `${basePath}/${expectedMainName}`;
        const expectedMainDisabledPath = `${expectedMainPath}${DISABLED_FILE_SUFFIX}`;
        if (
          !result.some((file) => file.id === expectedMainPath) &&
          result.some((file) => file.id === expectedMainDisabledPath)
        ) {
          replaceFilePath(expectedMainDisabledPath, expectedMainPath);
        }

        const hasEnabledMainForMode = result.some((file) => {
          if (!file.path.startsWith(`${basePath}/`)) return false;
          if (isFileDisabled(file.path)) return false;
          const ext = fileExt(file.path);
          if (kind !== "rp2040") return ext === ".ino";
          return isRp2040PythonEnv(rp2040Mode) ? ext === ".py" : ext === ".ino";
        });

        if (!hasEnabledMainForMode) {
          const defaultContent = createDefaultMainCode(kind, bc.id, {
            rp2040Mode,
          });
          upsert({
            id: expectedMainPath,
            path: expectedMainPath,
            name: expectedMainName,
            kind: "code",
            boardId: bc.id,
            boardKind: kind,
            content: defaultContent,
            dirty: false,
          });
        }

        if (kind === "rp2040") {
          const boardFilePaths = result
            .filter((file) => file.path.startsWith(`${basePath}/`))
            .map((file) => file.path);

          boardFilePaths.forEach((pathLike) => {
            const ext = fileExt(pathLike);
            const disabled = isFileDisabled(pathLike);
            const shouldDisable = isRp2040PythonEnv(rp2040Mode)
              ? ARDUINO_CODE_EXTENSIONS.has(ext)
              : ext === ".py";

            if (shouldDisable && !disabled) {
              replaceFilePath(pathLike, `${pathLike}${DISABLED_FILE_SUFFIX}`);
            }
          });
        }

        const libPath = `${basePath}/library.txt`;
        upsert({
          id: libPath,
          path: libPath,
          name: "library.txt",
          kind: "code",
          boardId: bc.id,
          boardKind: kind,
          content: `# Add your libraries here (one per line, e.g. ArduinoJson@6.21.3)\n`,
          dirty: false,
        });
      });

      const diagramPayload = buildProjectPayload({
        board,
        components,
        wires,
        code,
        includeCode: false,
        blocklyXml,
        blocklyGeneratedCode,
        useBlocklyCode,
        projectFiles: result,
        openCodeTabs,
        activeCodeFileId,
      });
      const diagramJsonPayload = { ...diagramPayload };
      // Omit noisy/default fields — keep diagram.json clean in the explorer
      delete diagramJsonPayload.schemaVersion;
      if (diagramJsonPayload.board === "arduino_uno")
        delete diagramJsonPayload.board;
      if (
        !diagramJsonPayload.components ||
        diagramJsonPayload.components.length === 0
      )
        delete diagramJsonPayload.components;
      if (
        !diagramJsonPayload.connections ||
        diagramJsonPayload.connections.length === 0
      )
        delete diagramJsonPayload.connections;
      delete diagramJsonPayload.blocklyXml;
      delete diagramJsonPayload.blocklyGeneratedCode;
      delete diagramJsonPayload.useBlocklyCode;
      // Always strip file-tree / tab state — not useful to display
      delete diagramJsonPayload.projectFiles;
      delete diagramJsonPayload.openCodeTabs;
      delete diagramJsonPayload.activeCodeFileId;
      const diagramJson = JSON.stringify(diagramJsonPayload, null, 2);

      const generatedRootFiles = [
        {
          id: "project/diagram.json",
          path: "project/diagram.json",
          name: "diagram.json",
          kind: "root",
          content: diagramJson,
          dirty: false,
        },
      ];

      const oldLibIdx = result.findIndex((f) => f.id === "project/library.txt");
      if (oldLibIdx !== -1) {
        result.splice(oldLibIdx, 1);
        changed = true;
      }

      generatedRootFiles.forEach((rootFile) => {
        const idx = result.findIndex((file) => file.id === rootFile.id);
        if (idx === -1) {
          result.push(rootFile);
          changed = true;
          return;
        }

        const current = result[idx];
        if (
          current.path !== rootFile.path ||
          current.name !== rootFile.name ||
          current.kind !== rootFile.kind ||
          current.content !== rootFile.content ||
          current.dirty !== false
        ) {
          result[idx] = {
            ...current,
            path: rootFile.path,
            name: rootFile.name,
            kind: rootFile.kind,
            content: rootFile.content,
            dirty: false,
          };
          changed = true;
        }
      });

      return changed ? normalizeProjectFiles(result) : prev;
    });
  }, [
    boardComponents,
    board,
    components,
    wires,
    libInstalled,
    code,
    blocklyXml,
    blocklyGeneratedCode,
    useBlocklyCode,
    openCodeTabs,
    activeCodeFileId,
  ]);

  useEffect(() => {
    if (projectFiles.length === 0) return;
    // If activeCodeFileId is null, it means it was explicitly deselected
    if (activeCodeFileId === null) return;
    if (activeCodeFileId && projectFileMap.has(activeCodeFileId)) return;

    const firstCodeFile =
      projectFiles.find((f) => f.kind === "code") || projectFiles[0];
    if (!firstCodeFile) return;

    setActiveCodeFileId(firstCodeFile.id);
    setOpenCodeTabs((prev) =>
      prev.includes(firstCodeFile.id) ? prev : [...prev, firstCodeFile.id],
    );
  }, [projectFiles, activeCodeFileId, projectFileMap]);

  const currentCodeRef = useRef(code);
  useEffect(() => {
    currentCodeRef.current = code;
  }, [code]);

  const previousActiveCodeFileIdRef = useRef(activeCodeFileId);

  useEffect(() => {
    if (!activeCodeFile) {
      suppressCodeSyncRef.current = true;
      setCode("");
      return;
    }
    if (activeCodeFile.id === "project/diagram.json") return; // Safety measure

    suppressCodeSyncRef.current = true;
    setCode(activeCodeFile.content || "");
  }, [activeCodeFile?.id]);

  useEffect(() => {
    if (previousActiveCodeFileIdRef.current !== activeCodeFileId) {
      previousActiveCodeFileIdRef.current = activeCodeFileId;
      return;
    }
    if (!activeCodeFileId) return;
    if (suppressCodeSyncRef.current) {
      suppressCodeSyncRef.current = false;
      return;
    }

    setProjectFiles((prev) =>
      prev.map((f) => {
        if (f.id !== activeCodeFileId) return f;
        if (f.content === code) return f;
        return { ...f, content: code, dirty: true };
      }),
    );
  }, [code, activeCodeFileId]);

  useEffect(() => {
    const nextDefault =
      BOARD_DEFAULT_BAUD[selectedSerialBoardKind] ||
      BOARD_DEFAULT_BAUD.arduino_uno;
    setSerialBaudRate(nextDefault);
  }, [selectedSerialBoardKind]);

  useEffect(() => {
    if (!isRunning || !workerRef.current) return;
    const parsedBaud = Number(serialBaudRate);
    if (!Number.isFinite(parsedBaud)) return;

    workerRef.current.postMessage({
      type: "SERIAL_SET_BAUD",
      baudRate: parsedBaud,
      targetBoardId:
        serialBoardFilter !== "all" ? serialBoardFilter : undefined,
    });
  }, [isRunning, serialBaudRate, serialBoardFilter]);

  // -- Get absolute pin position on canvas --
  const componentsMap = useMemo(() => {
    const m = new Map();
    for (const c of components) m.set(c.id, c);
    return m;
  }, [components]);

  const getPinPosForComp = useCallback(
    (comp, pinId) => {
      if (!comp) return null;
      const pins = PIN_DEFS[comp.type] || [];
      const searchId = String(pinId).toLowerCase();

      // Normalize aliases
      const normalize = (id) => {
        let s = String(id).toLowerCase();
        if (s === "p1") return "1";
        if (s === "p2") return "2";
        if (s === "a") return "anode";
        if (s === "k") return "cathode";
        if (s === "s" || s === "sig") return "sig";
        if (s === "v" || s === "vcc") return "vcc";
        if (s === "g" || s === "gnd") return "gnd";
        if (s === "3.3v" || s === "3v3") return "3v3";
        return s.replace(/[:.]/g, "_");
      };

      const normSearch = normalize(searchId);

      let pin = pins.find((p) => {
        const pid = String(p.id).toLowerCase();
        return pid === searchId || normalize(pid) === normSearch;
      });

      if (!pin) {
        // Resilience: Try to find a pin that starts with the ID (e.g. "GND" matches "GND.1" or "gnd_1")
        pin = pins.find((p) => {
          const pid = String(p.id).toLowerCase();
          const normPid = normalize(pid);
          return (
            pid === searchId ||
            normPid.startsWith(normSearch + "_") ||
            normPid.startsWith(normSearch + ".") ||
            pid.startsWith(searchId + ".") ||
            pid.startsWith(searchId + "_")
          );
        });
      }
      if (!pin) {
        return {
          x: comp.x + (comp.w || 40) / 2,
          y: comp.y + (comp.h || 40) / 2,
          isFallback: true,
        };
      }
      const rotation = comp.rotation || 0;
      const cw = comp.w || 0;
      const ch = comp.h || 0;
      if (rotation === 0) return { x: comp.x + pin.x, y: comp.y + pin.y };

      // Rotate pin coordinate around component center
      const cx = cw / 2,
        cy = ch / 2;
      const rad = (rotation * Math.PI) / 180;
      const dx = pin.x - cx,
        dy = pin.y - cy;
      return {
        x: comp.x + cx + dx * Math.cos(rad) - dy * Math.sin(rad),
        y: comp.y + cy + dx * Math.sin(rad) + dy * Math.cos(rad),
      };
    },
    [PIN_DEFS],
  );

  const getPinPos = useCallback(
    (compId, pinId) => {
      return getPinPosForComp(componentsMap.get(compId), pinId);
    },
    [componentsMap, getPinPosForComp],
  );

  const getComponentBounds = useCallback(
    (comp) => {
      if (!comp) return { x: 0, y: 0, w: 0, h: 0 };
      const reg = COMPONENT_REGISTRY[comp.type];
      if (!reg) return { x: 0, y: 0, w: comp.w || 0, h: comp.h || 0 };
      if (typeof reg.BOUNDS === "function")
        return reg.BOUNDS(getComponentStateAttrs(comp));
      return reg.BOUNDS || { x: 0, y: 0, w: comp.w || 0, h: comp.h || 0 };
    },
    [COMPONENT_REGISTRY, getComponentStateAttrs],
  );

  // -- Get the point a wire should exit/enter at 90 deg from a pin --
  const getPinExitPoint = useCallback(
    (compId, pinId, offset = 0, targetPos = null) => {
      const comp = componentsMap.get(compId);
      if (!comp) return null;
      const pins = PIN_DEFS[comp.type] || [];
      const searchId = String(pinId).toLowerCase();

      const normalize = (id) => {
        let s = String(id).toLowerCase();
        if (s === "p1") return "1";
        if (s === "p2") return "2";
        if (s === "a") return "anode";
        if (s === "k") return "cathode";
        if (s === "3.3v" || s === "3v3") return "3v3";
        return s.replace(/[:.]/g, "_");
      };

      const normSearch = normalize(searchId);

      let pin = pins.find((p) => {
        const pid = String(p.id).toLowerCase();
        return pid === searchId || normalize(pid) === normSearch;
      });

      if (!pin) {
        pin = pins.find((p) => {
          const pid = String(p.id).toLowerCase();
          const normPid = normalize(pid);
          return (
            pid === searchId ||
            normPid.startsWith(normSearch + "_") ||
            normPid.startsWith(normSearch + ".") ||
            pid.startsWith(searchId + ".") ||
            pid.startsWith(searchId + "_")
          );
        });
      }

      if (!pin) {
        return {
          x: comp.x + (comp.w || 40) / 2,
          y: comp.y + (comp.h || 40) / 2,
          isFallback: true,
        };
      }
      const pPos = getPinPosForComp(comp, pinId);
      if (!pPos) return null;

      const bounds = getComponentBounds(comp);
      const localX = (Number(pin.x) || 0) - (Number(bounds.x) || 0);
      const localY = (Number(pin.y) || 0) - (Number(bounds.y) || 0);
      const distLeft = localX;
      const distRight = (Number(bounds.w) || comp.w || 0) - localX;
      const distTop = localY;
      const distBottom = (Number(bounds.h) || comp.h || 0) - localY;
      const bodyEdgeGap = 3;
      const rotation = comp.rotation || 0;
      // Spread grouped wires along the exit edge, then step outward.
      const laneOffset = Number(offset) || 0; // preserved for logging, not used in the initial stub
      let dx = 0,
        dy = 0;

      const dir = getResolvedPinExitSide(comp, pin, pins, bounds);
      if (!dir) return { x: pPos.x, y: pPos.y, dir: "bottom" };
      // Compute an exit stub that first moves strictly perpendicular to the component
      // by at least `MIN_EXIT_STUB` pixels before any lateral offsets are applied.
      // The lateral bundle offset is applied later by the router; we avoid adding
      // it to the initial stub so the first segment stays axis-aligned.
      const MIN_EXIT_STUB = 30; // pixels: minimum stub length outward from component
      if (dir === "left") {
        dx = -Math.max(distLeft + bodyEdgeGap, MIN_EXIT_STUB);
        dy = 0;
      } else if (dir === "right") {
        dx = Math.max(distRight + bodyEdgeGap, MIN_EXIT_STUB);
        dy = 0;
      } else if (dir === "top") {
        dx = 0;
        dy = -Math.max(distTop + bodyEdgeGap, MIN_EXIT_STUB);
      } else if (dir === "bottom") {
        dx = 0;
        dy = Math.max(distBottom + bodyEdgeGap, MIN_EXIT_STUB);
      }

      const rad = (rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const rawExitX = pPos.x + (dx * cos - dy * sin);
      const rawExitY = pPos.y + (dx * sin + dy * cos);

      let exitX = rawExitX;
      let exitY = rawExitY;
      if (Math.abs(rawExitX - pPos.x) < 0.1) {
        exitX = pPos.x;
        exitY = Math.round(rawExitY / 15) * 15;
      } else {
        exitX = Math.round(rawExitX / 15) * 15;
        exitY = pPos.y;
      }

      try {
        console.debug("[getPinExitPoint]", {
          compId: comp.id,
          pinId: pin.id,
          bounds,
          localX,
          localY,
          dir,
          laneOffset,
          exitX,
          exitY,
        });
      } catch (e) { }
      return {
        x: exitX,
        y: exitY,
        dir,
      };
    },
    [componentsMap, PIN_DEFS, getPinPosForComp],
  );

  // Developer helper: call `window.debugPinExits()` in browser console to list exit edges
  try {
    // eslint-disable-next-line no-undef
    window.debugPinExits = () => {
      const interestingTypes = new Set([
        "openhw-arduino-uno",
        "openhw-a4988",
        "openhw-stepper-motor",
        "wokwi-arduino-uno",
        "wokwi-stepper-motor",
      ]);
      (components || []).forEach((comp) => {
        if (!interestingTypes.has(comp.type)) return;
        const pins = PIN_DEFS[comp.type] || [];
        const bounds = getComponentBounds(comp);
        console.groupCollapsed(
          `pin exits for ${comp.id} (${comp.type}) at ${comp.x},${comp.y}`,
        );
        console.log("bounds", bounds);
        pins.forEach((pin) => {
          const exitSide = getResolvedPinExitSide(
            comp,
            pin,
            pins,
            getComponentBounds(comp),
          );
          const exitPt = getPinExitPoint(comp.id, pin.id, 0, null);
          const localX = (Number(pin.x) || 0) - (Number(bounds.x) || 0);
          const localY = (Number(pin.y) || 0) - (Number(bounds.y) || 0);
          console.log(pin.id, "->", exitSide, exitPt, { localX, localY });
        });
        console.groupEnd();
      });
    };
  } catch (e) { }

  const getPinPosWithGhosts = useCallback(
    (compId, pinId) => {
      let comp = componentsMap.get(compId);
      if (!comp && autofixPlan?.addedComponents) {
        comp = autofixPlan.addedComponents.find((c) => c.id === compId);
      }
      return getPinPosForComp(comp, pinId);
    },
    [componentsMap, autofixPlan?.addedComponents, getPinPosForComp],
  );

  // -- Intelligent Centering & Zoom to Fit --
  const fitToView = useCallback(
    (mode = "reset") => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      if (components.length === 0) {
        setCanvasZoom(1);
        setCanvasOffset({ x: 0, y: 0 });
        return;
      }

      const pinPosCache = new Map();
      const getCachedPinPos = (compId, pinId) => {
        const key = `${compId}:${pinId}`;
        if (!pinPosCache.has(key))
          pinPosCache.set(key, getPinPos(compId, pinId));
        return pinPosCache.get(key);
      };

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      components.forEach((c) => {
        const reg = COMPONENT_REGISTRY[c.type];
        const b =
          typeof reg?.BOUNDS === "function"
            ? reg.BOUNDS(getComponentStateAttrs(c))
            : reg?.BOUNDS || { x: 0, y: 0, w: c.w || 80, h: c.h || 60 };
        minX = Math.min(minX, c.x + b.x);
        minY = Math.min(minY, c.y + b.y);
        maxX = Math.max(maxX, c.x + b.x + b.w);
        maxY = Math.max(maxY, c.y + b.y + b.h);
        maxY = Math.max(maxY, c.y + b.y + b.h + 20); // Label padding
        (PIN_DEFS[c.type] || []).forEach((pin) => {
          const pp = getCachedPinPos(c.id, pin.id);
          if (pp) {
            minX = Math.min(minX, pp.x - 4);
            minY = Math.min(minY, pp.y - 4);
            maxX = Math.max(maxX, pp.x + 4);
            maxY = Math.max(maxY, pp.y + 4);
          }
        });
      });
      wires.forEach((w) => {
        (w.waypoints || []).forEach((wp) => {
          minX = Math.min(minX, wp.x);
          minY = Math.min(minY, wp.y);
          maxX = Math.max(maxX, wp.x);
          maxY = Math.max(maxY, wp.y);
        });
        const [fComp, fPin] = (w.from || "").split(":");
        const [tComp, tPin] = (w.to || "").split(":");
        const fp = getCachedPinPos(fComp, fPin);
        const tp = getCachedPinPos(tComp, tPin);
        if (fp) {
          minX = Math.min(minX, fp.x);
          minY = Math.min(minY, fp.y);
          maxX = Math.max(maxX, fp.x);
          maxY = Math.max(maxY, fp.y);
        }
        if (tp) {
          minX = Math.min(minX, tp.x);
          minY = Math.min(minY, tp.y);
          maxX = Math.max(maxX, tp.x);
          maxY = Math.max(maxY, tp.y);
        }
      });

      if (!isFinite(minX)) {
        minX = 0;
        minY = 0;
        maxX = 800;
        maxY = 600;
      }

      const PAD = 120;
      const circuitW = maxX - minX + PAD;
      const circuitH = maxY - minY + PAD;

      let finalZoom = canvasZoom;
      if (mode === "reset") finalZoom = 1;
      else if (mode === "fit") {
        const zoomX = rect.width / circuitW;
        const zoomY = rect.height / circuitH;
        finalZoom = Math.min(zoomX, zoomY, 1.25);
        finalZoom = Math.max(0.25, parseFloat(finalZoom.toFixed(2)));
      }

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      setCanvasZoom(finalZoom);
      setCanvasOffset({
        x: rect.width / 2 - centerX * finalZoom,
        y: rect.height / 2 - centerY * finalZoom,
      });
    },
    [
      components,
      wires,
      canvasZoom,
      COMPONENT_REGISTRY,
      getComponentStateAttrs,
      PIN_DEFS,
      getPinPos,
    ],
  );

  const handleZoomTextClick = (e) => {
    e.stopPropagation();
    if (zoomTextTimerRef.current) {
      clearTimeout(zoomTextTimerRef.current);
      zoomTextTimerRef.current = null;
      fitToView("center"); // Double click: Center only
    } else {
      zoomTextTimerRef.current = setTimeout(() => {
        zoomTextTimerRef.current = null;
        fitToView("reset"); // Single click: Reset Zoom & Center
      }, 250);
    }
  };

  const applyZoomAtCenter = useCallback((newZoom) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;

    const currentZoom = canvasZoomRef.current;
    const currentOffset = canvasOffsetRef.current;

    const cx = (mx - currentOffset.x) / currentZoom;
    const cy = (my - currentOffset.y) / currentZoom;

    const newOffsetX = mx - cx * newZoom;
    const newOffsetY = my - cy * newZoom;

    setCanvasZoom(newZoom);
    setCanvasOffset({ x: newOffsetX, y: newOffsetY });

    // Update refs immediately so subsequent clicks use fresh values
    canvasZoomRef.current = newZoom;
    canvasOffsetRef.current = { x: newOffsetX, y: newOffsetY };

    // Update DOM directly for zero-latency response
    if (innerCanvasRef.current) {
      innerCanvasRef.current.style.transform = `translate(${newOffsetX}px, ${newOffsetY}px) scale(${newZoom})`;
    }
  }, []);

  // Keep reactive refs current
  getPinPosRef.current = getPinPos;
  componentsRef.current = components;
  wiresRef.current = wires;
  pinDefsRef.current = PIN_DEFS;

  // -- Palette drag start --
  const onPaletteDragStart = (e, item) => {
    dragPayload.current = item;
    e.dataTransfer.effectAllowed = "copy";
    const ghost = document.createElement("div");
    ghost.style.cssText = "position:fixed;top:-999px;width:1px;height:1px";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  // ── Favorites helpers ────────────────────────────────────────────────────────
  // toggleFavorite moved to PalettePanel

  // ── History & Undo/Redo ────────────────────────────────────────────────────
  const saveHistory = useCallback(() => {
    setHistory((h) => ({
      past: [
        ...h.past.slice(-20),
        {
          components: structuredClone(components),
          wires: structuredClone(wires),
        },
      ],
      future: [],
    }));
  }, [components, wires]);

  // ── Component addition with autonomous WASM setup ───────────────────────────
  const addComponentInternal = useCallback(
    async (item, x, y) => {
      if (liveEditingDisabled) return;
      saveHistory();

      const warningMsg = getComponentWarning(item.type);
      if (warningMsg) {
        console.warn(`[Component Warning] ${item.label || item.type}: ${warningMsg}`);
      }

      const usedIds = new Set(components.map((c) => String(c.id || "")));
      const id = allocateComponentId(item.type, usedIds);
      const pins = LOCAL_PIN_DEFS[item.type] || [];
      const anchorPin = pins[0];
      let initialX = Math.max(8, x);
      let initialY = Math.max(8, y);
      if (anchorPin) {
        const w = item.w || 60;
        const h = item.h || 60;
        const cx = initialX + w / 2;
        const cy = initialY + h / 2;
        const anchorWorld = getRotatedPoint(
          initialX + anchorPin.x,
          initialY + anchorPin.y,
          0,
          cx,
          cy,
        );
        const snappedAnchorX = snapToGrid(anchorWorld.x);
        const snappedAnchorY = snapToGrid(anchorWorld.y);
        initialX += snappedAnchorX - anchorWorld.x;
        initialY += snappedAnchorY - anchorWorld.y;
      } else {
        initialX = snapToGrid(initialX);
        initialY = snapToGrid(initialY);
      }

      const newCompBase = {
        id,
        type: item.type,
        label: item.label,
        x: initialX,
        y: initialY,
        w: item.w || 60,
        h: item.h || 60,
        attrs: item.attrs || {},
      };

      const catalogItem = COMPONENT_REGISTRY[item.type];
      const manifest = catalogItem?.manifest || catalogItem;

      if (
        catalogItem &&
        !isProgrammableBoardType(item.type) &&
        !isBreadboardType(item.type) &&
        !isResistorType(item.type)
      ) {
        if (autoWiringEnabled || autoCodingEnabled) {
          const plan = await generateAutonomousSetup(
            components,
            wires,
            newCompBase,
            manifest,
            null, // Let WASM select the nearest board
            PIN_DEFS,
            autoBreadboardEnabled,
          );

          if (plan) {
            // ── IMMEDIATE ERROR DETECTION ──
            if (plan.reasoning) {
              console.log("[Autowiring Debug] Reasoning:", plan.reasoning);
              const critical = plan.reasoning.find((r) =>
                r.toUpperCase().includes("CRITICAL"),
              );
              if (critical) {
                console.error("[Autowiring Critical]", critical);
                appendConsoleEntry(
                  "error",
                  `[Autowiring] ${critical}`,
                  "simulator",
                );
                setTimeout(() => {
                  setIsConsoleOpen(true);
                  alert(`Autowiring Critical Error:\n\n${critical}`);
                }, 100);
              }
            }

            const mainCompWithPos = {
              ...newCompBase,
              x: plan.main_component.x,
              y: plan.main_component.y,
            };
            const adjustedPlan = {
              ...plan,
              added_components: [
                mainCompWithPos,
                ...(plan.added_components || []),
              ],
            };

            const result = calculateProjectPlanApplication(
              adjustedPlan,
              components,
              wires,
              PIN_DEFS,
            );
            setComponents(result.components);
            setWires(result.wires);

            // ── JS Fallback: manually wire if WASM left component unwired ──
            const autowiringConns = manifest?.autowiring?.connections;
            if (autowiringConns && autowiringConns.length > 0) {
              const compId = mainCompWithPos.id;
              const hasAnyWire = result.wires.some(
                w => (w.from || '').startsWith(compId + ':') || (w.to || '').startsWith(compId + ':')
              );
              if (!hasAnyWire) {
                const boardComp = result.components.find(c => isProgrammableBoardType(c.type));
                if (boardComp) {
                  const newComponents = [...result.components];
                  const newWires = [...result.wires];
                  const bb = result.components.find(c => isBreadboardType(c.type));
                  const boardPins = LOCAL_PIN_DEFS[boardComp.type] || [];

                  for (let ci = 0; ci < autowiringConns.length; ci++) {
                    const conn = autowiringConns[ci];
                    let target = conn.to || '';
                    let fromPin = conn.from;

                    if (target.startsWith('arduino:')) {
                      const pinId = target.split(':')[1];
                      const match = boardPins.find(p => p.id.toLowerCase().startsWith(pinId.toLowerCase()));
                      if (match) target = `${boardComp.id}:${match.id}`;
                      else target = `${boardComp.id}:${pinId}`;
                    }

                    const fromEndpoint = `${compId}:${fromPin}`;

                    if (conn.via) {
                      const viaId = `${conn.via}_${Date.now()}_${ci}`;
                      const viaType = conn.via;
                      const viaComp = {
                        id: viaId,
                        type: viaType,
                        label: 'Resistor',
                        x: mainCompWithPos.x + 60 + ci * 30,
                        y: mainCompWithPos.y + 20 + ci * 20,
                        w: 60,
                        h: 12,
                        attrs: conn.attrs || {},
                      };

                      if (bb) {
                        const bbPins = LOCAL_PIN_DEFS[bb.type] || [];
                        const viaHole = bbPins.find(p => p.id.endsWith('f'));
                        if (viaHole) {
                          const vWorld = getRotatedPoint(
                            bb.x + viaHole.x, bb.y + viaHole.y,
                            bb.rotation || 0, bb.x + bb.w / 2, bb.y + bb.h / 2
                          );
                          viaComp.x = vWorld.x - 30;
                          viaComp.y = vWorld.y - 6;
                        }
                      }

                      newComponents.push(viaComp);

                      const needsResistorToGnd = target.toLowerCase().includes('gnd');
                      const midX = viaComp.x + viaComp.w / 2;
                      const midY = viaComp.y + viaComp.h / 2;

                      if (bb) {
                        const sourceHole = `${bb.id}:${ci === 0 ? 'top_f' : 'top_e'}`;
                        newWires.push({
                          id: `w_via_in_${Date.now()}_${ci}`,
                          from: sourceHole,
                          to: `${viaId}:p1`,
                          color: 'green',
                          isSocket: true,
                        });
                        newWires.push({
                          id: `w_via_out_${Date.now()}_${ci}`,
                          from: `${viaId}:p2`,
                          to: target,
                          color: needsResistorToGnd ? 'black' : 'blue',
                        });
                      } else {
                        newWires.push({
                          id: `w_manual_${Date.now()}_${ci}_a`,
                          from: fromEndpoint,
                          to: `${viaId}:p1`,
                          color: 'green',
                          waypoints: [{ x: midX, y: mainCompWithPos.y + 20 }],
                        });
                        newWires.push({
                          id: `w_manual_${Date.now()}_${ci}_b`,
                          from: `${viaId}:p2`,
                          to: target,
                          color: needsResistorToGnd ? 'black' : 'blue',
                        });
                      }
                    } else {
                      newWires.push({
                        id: `w_manual_${Date.now()}_${ci}`,
                        from: fromEndpoint,
                        to: target,
                        color: target.toLowerCase().includes('gnd') ? 'black' : 'green',
                      });
                    }
                  }

                  setComponents(newComponents);
                  setWires(newWires);
                }
              }
            }

            // ── Restore Library Installation ──
            if (plan.libraries && plan.libraries.length > 0) {
              for (const libName of plan.libraries) {
                const alreadyInstalled = libInstalled?.some(
                  (l) => (l?.library?.name || l?.name) === libName,
                );
                if (!alreadyInstalled) {
                  console.log(
                    `[Autonomous] Auto-installing library: ${libName}`,
                  );
                  try {
                    await handleInstallLibrary(libName);
                  } catch (err) {
                    console.warn(
                      `[Autonomous] API install failed for ${libName}, falling back to library.txt:`,
                      err,
                    );
                  }
                }
              }
              // Fallback: write libraries to library.txt for runtime resolution
              const boardComp = result.components.find((c) =>
                isProgrammableBoardType(c.type),
              );
              if (boardComp) {
                const libPath = `project/${boardComp.id}/library.txt`;
                setProjectFiles((prev) => {
                  const fileObj = prev.find((f) => f.id === libPath);
                  let currentContent = fileObj
                    ? fileObj.content || ''
                    : '# Add your libraries here (one per line, e.g. ArduinoJson@6.21.3)\n';
                  const lines = currentContent.split('\n').map((l) => l.trim());
                  const existingSet = new Set(
                    lines
                      .filter((l) => l && !l.startsWith('#'))
                      .map((l) => l.split('@')[0].trim().toLowerCase()),
                  );
                  const linesToAdd = [];
                  plan.libraries.forEach((lib) => {
                    const cleanLib = String(lib).trim();
                    const libNameOnly = cleanLib
                      .split('@')[0]
                      .trim()
                      .toLowerCase();
                    if (!existingSet.has(libNameOnly)) {
                      linesToAdd.push(cleanLib);
                    }
                  });
                  if (linesToAdd.length > 0) {
                    const newLines = [...currentContent.split('\n')];
                    linesToAdd.forEach((lib) => {
                      if (
                        newLines.length > 0 &&
                        newLines[newLines.length - 1].trim() !== ''
                      ) {
                        newLines.push(lib);
                      } else {
                        newLines.splice(newLines.length, 0, lib);
                      }
                    });
                    const nextContent = newLines.join('\n');
                    return prev.map((f) =>
                      f.id === libPath
                        ? { ...f, content: nextContent, dirty: true }
                        : f,
                    );
                  }
                  return prev;
                });
              }
            }

            // ── Restore Code Merging ──
            if (plan.code_snippet) {
              const snippetOwnerId = mainCompWithPos.id;
              const nextCode = mergeCodeSnippet(
                currentCodeRef.current || code,
                plan.code_snippet,
                snippetOwnerId,
                plan.reasoning || [],
              );
              setCode(nextCode);
              if (activeCodeFileId) {
                setProjectFiles((prev) =>
                  prev.map((f) =>
                    f.id === activeCodeFileId
                      ? { ...f, content: nextCode, dirty: true }
                      : f,
                  ),
                );
              }
              setCodeTab("code");
              setIsPanelOpen(true);
            }

            // ── Restore Reasoning Logs ──
            if (plan.reasoning) {
              console.log("[Autonomous] Reasoning:", plan.reasoning);
            }
          } else {
            // WASM returned no plan — fallback: place component and wire manually
            const boardComp = components.find(c => isProgrammableBoardType(c.type));
            let fallbackComps = [newCompBase];
            let fallbackWires = [...wires];

            const autowiringConns = manifest?.autowiring?.connections;
            if (autowiringConns && autowiringConns.length > 0 && boardComp) {
              const boardPins = LOCAL_PIN_DEFS[boardComp.type] || [];
              const bb = components.find(c => isBreadboardType(c.type));
              for (let ci = 0; ci < autowiringConns.length; ci++) {
                const conn = autowiringConns[ci];
                let target = conn.to || '';
                if (target.startsWith('arduino:')) {
                  const pinId = target.split(':')[1];
                  const match = boardPins.find(p => p.id.toLowerCase().startsWith(pinId.toLowerCase()));
                  target = match ? `${boardComp.id}:${match.id}` : `${boardComp.id}:${pinId}`;
                }
                if (conn.via) {
                  const viaId = `${conn.via}_${Date.now()}_${ci}`;
                  const viaComp = {
                    id: viaId, type: conn.via, label: 'Resistor',
                    x: newCompBase.x + 60 + ci * 30, y: newCompBase.y + 20 + ci * 20,
                    w: 60, h: 12, attrs: conn.attrs || {},
                  };
                  if (bb) {
                    const bbPins = LOCAL_PIN_DEFS[bb.type] || [];
                    const viaHole = bbPins.find(p => p.id.endsWith('f'));
                    if (viaHole) {
                      const vWorld = getRotatedPoint(bb.x + viaHole.x, bb.y + viaHole.y, bb.rotation || 0, bb.x + bb.w / 2, bb.y + bb.h / 2);
                      viaComp.x = vWorld.x - 30; viaComp.y = vWorld.y - 6;
                    }
                  }
                  fallbackComps.push(viaComp);
                  fallbackWires.push({ id: `w_via_in_${Date.now()}_${ci}`, from: `${newCompBase.id}:${conn.from}`, to: `${viaId}:p1`, color: 'green' });
                  fallbackWires.push({ id: `w_via_out_${Date.now()}_${ci}`, from: `${viaId}:p2`, to: target, color: target.toLowerCase().includes('gnd') ? 'black' : 'blue' });
                } else {
                  fallbackWires.push({ id: `w_manual_${Date.now()}_${ci}`, from: `${newCompBase.id}:${conn.from}`, to: target, color: target.toLowerCase().includes('gnd') ? 'black' : 'green' });
                }
              }
            } else {
              fallbackWires = autoConnectPowerRails(newCompBase, components, wires);
            }

            setComponents(prev => {
              const merged = [...prev];
              for (const fc of fallbackComps) {
                if (!merged.find(c => c.id === fc.id)) merged.push(fc);
              }
              return merged;
            });
            setWires(fallbackWires);
          }
        } else {
          setComponents((prev) => [...prev, newCompBase]);
          setWires((prev) => autoConnectPowerRails(newCompBase, components, prev));
        }
      } else {
        setComponents((prev) => [...prev, newCompBase]);
        setWires((prev) => autoConnectPowerRails(newCompBase, components, prev));
      }
    },
    [
      liveEditingDisabled,
      saveHistory,
      components,
      wires,
      code,
      autoWiringEnabled,
      autoCodingEnabled,
      generateAutonomousSetup,
    ],
  );

  const onPaletteItemClick = useCallback(
    async (item) => {
      if (liveEditingDisabled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x =
        (rect.width / 2 - canvasOffsetRef.current.x) / canvasZoomRef.current -
        (item.w || 60) / 2;
      const y =
        (rect.height / 2 - canvasOffsetRef.current.y) / canvasZoomRef.current -
        (item.h || 60) / 2;
      await addComponentInternal(item, x, y);
    },
    [liveEditingDisabled, addComponentInternal],
  );

  const undo = () => {
    if (history.past.length === 0 || isRunning) return;
    const prev = history.past[history.past.length - 1];
    setHistory((h) => ({
      past: h.past.slice(0, -1),
      future: [
        {
          components: structuredClone(components),
          wires: structuredClone(wires),
        },
        ...h.future,
      ],
    }));
    setComponents(prev.components);
    setWires(prev.wires);
    setSelected(null);
  };

  const redo = () => {
    if (history.future.length === 0 || isRunning) return;
    const next = history.future[0];
    setHistory((h) => ({
      past: [
        ...h.past,
        {
          components: structuredClone(components),
          wires: structuredClone(wires),
        },
      ],
      future: h.future.slice(1),
    }));
    setComponents(next.components);
    setWires(next.wires);
    setSelected(null);
  };

  // ── Canvas drop ────────────────────────────────────────────────────────────
  const onCanvasDrop = useCallback(
    async (e) => {
      if (liveEditingDisabled) return;
      e.preventDefault();
      const item = dragPayload.current;
      if (!item) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x =
        (e.clientX - rect.left - canvasOffsetRef.current.x) /
        canvasZoomRef.current -
        (item.w || 60) / 2;
      const y =
        (e.clientY - rect.top - canvasOffsetRef.current.y) /
        canvasZoomRef.current -
        (item.h || 60) / 2;
      await addComponentInternal(item, x, y);
      dragPayload.current = null;
    },
    [liveEditingDisabled, addComponentInternal],
  );

  // ── Quick-add: place component at explicit canvas coordinates ──────────────
  const addComponentAt = useCallback(
    async (item, canvasX, canvasY) => {
      if (liveEditingDisabled) return;
      const x = canvasX - (item.w || 60) / 2;
      const y = canvasY - (item.h || 60) / 2;
      await addComponentInternal(item, x, y);
    },
    [liveEditingDisabled, addComponentInternal],
  );

  // ── Palette click to add (adds to canvas center, offset if overlapping) ──────
  const addComponentAtCenter = useCallback(
    async (item) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      let cx =
        (rect.width / 2 - canvasOffsetRef.current.x) / canvasZoomRef.current;
      let cy =
        (rect.height / 2 - canvasOffsetRef.current.y) / canvasZoomRef.current;

      // Nudge position so new components don't stack exactly on top of existing ones
      const OFFSET_STEP = 30; // px diagonal offset per overlap
      const OVERLAP_THRESHOLD = 20; // px — consider "same spot" if within this range
      const currentComps = componentsRef.current || [];
      let attempts = 0;
      while (attempts < 15) {
        const overlapping = currentComps.some(c => {
          const compCx = c.x + (c.w || 60) / 2;
          const compCy = c.y + (c.h || 60) / 2;
          return Math.abs(compCx - cx) < OVERLAP_THRESHOLD && Math.abs(compCy - cy) < OVERLAP_THRESHOLD;
        });
        if (!overlapping) break;
        cx += OFFSET_STEP;
        cy += OFFSET_STEP;
        attempts++;
      }

      await addComponentAt(item, cx, cy);
    },
    [addComponentAt],
  );

  // ── Enhanced Zooming (Pinch Only) ──────────────────────────────────────────
  const initialTouchDistanceRef = useRef(null);
  const initialCanvasZoomRef = useRef(null);
  const initialTouchCenterCanvasRef = useRef(null);

  const onTouchStart = useCallback((e) => {
    if (isCanvasLockedRef.current || e.touches.length !== 2) {
      initialTouchDistanceRef.current = null;
      return;
    }
    const t1 = e.touches[0],
      t2 = e.touches[1];
    const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    initialTouchDistanceRef.current = dist;
    initialCanvasZoomRef.current = canvasZoomRef.current;

    const rect = canvasRef.current.getBoundingClientRect();
    const mx = (t1.clientX + t2.clientX) / 2 - rect.left;
    const my = (t1.clientY + t2.clientY) / 2 - rect.top;

    // Position on canvas relative to 0,0
    initialTouchCenterCanvasRef.current = {
      x: (mx - canvasOffsetRef.current.x) / canvasZoomRef.current,
      y: (my - canvasOffsetRef.current.y) / canvasZoomRef.current,
    };
  }, []);

  const onTouchMove = useCallback((e) => {
    if (
      isCanvasLockedRef.current ||
      e.touches.length !== 2 ||
      !initialTouchDistanceRef.current
    )
      return;
    if (e.cancelable) e.preventDefault();

    const t1 = e.touches[0],
      t2 = e.touches[1];
    const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

    const scale = dist / initialTouchDistanceRef.current;
    const newZoom = Math.min(
      3,
      Math.max(0.25, initialCanvasZoomRef.current * scale),
    );

    const rect = canvasRef.current.getBoundingClientRect();
    const mx = (t1.clientX + t2.clientX) / 2 - rect.left;
    const my = (t1.clientY + t2.clientY) / 2 - rect.top;

    // We want initialTouchCenterCanvasRef.current to be at (mx, my) in screen space
    const newOffsetX = mx - initialTouchCenterCanvasRef.current.x * newZoom;
    const newOffsetY = my - initialTouchCenterCanvasRef.current.y * newZoom;

    setCanvasZoom(newZoom);
    canvasZoomRef.current = newZoom;
    setCanvasOffset({ x: newOffsetX, y: newOffsetY });
    canvasOffsetRef.current = { x: newOffsetX, y: newOffsetY };
  }, []);

  const onTouchEnd = useCallback(() => {
    initialTouchDistanceRef.current = null;
  }, []);

  // Pinch-to-zoom via trackpad (Ctrl + Wheel)
  // Key insight: NEVER update React state mid-pinch — that causes React to re-render
  // which overwrites our DOM transform on the SAME frame, creating the vibration.
  // Instead: apply only the CSS transform during pinch, update refs for correctness,
  // then flush to React state via a debounce AFTER the gesture ends.
  const onWheel = useCallback((e) => {
    if (isCanvasLockedRef.current) return;
    e.preventDefault();

    // ─── ZOOM LOGIC (scroll wheel always zooms) ─────────────────────────────
    const zoomSpeed = 0.002;
    const delta = -e.deltaY * zoomSpeed;
    const currentZoom = canvasZoomRef.current;
    const newZoom = Math.min(3, Math.max(0.25, currentZoom * (1 + delta)));

    if (newZoom === currentZoom) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const cx = (mx - canvasOffsetRef.current.x) / currentZoom;
    const cy = (my - canvasOffsetRef.current.y) / currentZoom;

    const newOffsetX = mx - cx * newZoom;
    const newOffsetY = my - cy * newZoom;

    canvasZoomRef.current = newZoom;
    canvasOffsetRef.current = { x: newOffsetX, y: newOffsetY };

    // Apply directly to DOM for zero-latency 60fps movement
    if (innerCanvasRef.current) {
      innerCanvasRef.current.style.transform = `translate(${canvasOffsetRef.current.x}px, ${canvasOffsetRef.current.y}px) scale(${canvasZoomRef.current})`;
      innerCanvasRef.current.style.transformOrigin = "0 0";
    }

    // While running, keep the interaction in refs/DOM only so the simulator tree
    // does not rerender on every pan/zoom tick.
    if (isRunning) return;

    // Debounce the React state flush to avoid re-render lag during interaction
    if (rafZoomRef.current) clearTimeout(rafZoomRef.current);
    rafZoomRef.current = setTimeout(() => {
      rafZoomRef.current = null;
      setCanvasZoom(canvasZoomRef.current);
      setCanvasOffset({ ...canvasOffsetRef.current });
    }, 150);
  }, []);

  // ── Move and Select component ──────────────────────────────────────────────
  const onCompMouseDown = useCallback(
    (e, id) => {
      e.stopPropagation();
      if (isRunning) return; // Restrict movement while running
      const comp = components.find((c) => c.id === id);
      if (!comp) return;

      const dragData = {
        id,
        sx: e.clientX,
        sy: e.clientY,
        cx: comp.x,
        cy: comp.y,
        type: comp.type,
        w: comp.w,
        h: comp.h,
        rotation: comp.rotation || 0,
        anchorPinId: comp.anchorPinId,
        moved: false,
        originalComps: JSON.parse(JSON.stringify(components)),
      };

      dragData.breadboards = components.filter((c) => isBreadboardType(c.type));

      // Performance: If breadboard, pre-calculate children once here
      if (isBreadboardType(comp.type)) {
        const childComps = components.filter((c) => {
          if (c.id === id) return false;
          return wires.some(
            (w) =>
              w.isSocket &&
              (w.from.startsWith(c.id + ":") || w.to.startsWith(c.id + ":")) &&
              (w.from.startsWith(id + ":") || w.to.startsWith(id + ":")),
          );
        });

        if (childComps.length > 0) {
          dragData.childIds = childComps.map((c) => c.id);
          dragData.childrenStart = {};
          childComps.forEach((c) => {
            dragData.childrenStart[c.id] = { x: c.x, y: c.y };
          });
        }
      }

      movingComp.current = dragData;
      setIsComponentDragging(true);
    },
    [components, wires, isRunning],
  );

  const onCompClick = useCallback((e, id) => {
    e.stopPropagation();
    setSelected(id);
    setWireClickPos(null);
  }, []);

  useEffect(() => {
    // ───── RAF-throttled mousemove (Fixes #1 #2 #3 #4) ──────────────────────────
    // Instead of calling React state setters on every raw mousemove (which can
    // fire at 200Hz), we synchronously extract all needed data from the event,
    // store it in a ref, then schedule one rAF callback to do all state updates.
    // This caps React renders at 60fps regardless of mouse polling rate.
    const onMove = (e) => {
      // If we are resizing panels, BAIL OUT of all canvas mouse tracking to save CPU and prevent re-renders
      if (isDraggingRef.current || isExplorerDraggingRef.current) return;

      // ── Synchronously read event data ───
      let compUpdate = null;
      let wireUpdate = null;
      let panUpdate = null;
      let mousePosUpdate = null;
      const sd = segDragRef.current;

      if (movingComp.current) {
        movingComp.current.moved = true;
        const { id, type, sx, sy, cx, cy, w, h, rotation, breadboards } =
          movingComp.current;
        const zoom = canvasZoomRef.current;
        let nx = cx + (e.clientX - sx) / zoom;
        let ny = cy + (e.clientY - sy) / zoom;

        compUpdate = { id, newX: nx, newY: ny, snappingHoles: [] };

        if (type && isBreadboardType(type)) {
          // Breadboard movement propagation
          const dx = nx - cx;
          const dy = ny - cy;

          if (movingComp.current.childIds) {
            compUpdate.childUpdates = movingComp.current.childIds.map(
              (childId) => ({
                id: childId,
                newX:
                  (movingComp.current.childrenStart?.[childId]?.x ?? 0) + dx,
                newY:
                  (movingComp.current.childrenStart?.[childId]?.y ?? 0) + dy,
              }),
            );
          }
        } else if (type) {
          // Snapping Logic (Multi-pin)
          const pins = LOCAL_PIN_DEFS[type] || [];
          const anchorPinId = movingComp.current.anchorPinId || pins[0]?.id;
          const anchorPin = pins.find((p) => p.id === anchorPinId) || pins[0];

          if (anchorPin) {
            const finalCenterX = nx + (w || 0) / 2;
            const finalCenterY = ny + (h || 0) / 2;
            const anchorWorld = getRotatedPoint(
              nx + anchorPin.x,
              ny + anchorPin.y,
              rotation,
              finalCenterX,
              finalCenterY,
            );

            // Use cached breadboards list for speed
            const hole = findNearestBreadboardHole(
              anchorWorld.x,
              anchorWorld.y,
              breadboards || [],
              LOCAL_PIN_DEFS,
            );
            if (hole) {
              // Apply snapping offset
              nx += hole.x - anchorWorld.x;
              ny += hole.y - anchorWorld.y;
              compUpdate.newX = nx;
              compUpdate.newY = ny;

              // Identify all pins that align with holes
              const finalCenterX = nx + (w || 0) / 2;
              const finalCenterY = ny + (h || 0) / 2;
              const currentSnaps = [];
              pins.forEach((p) => {
                const pWorld = getRotatedPoint(
                  nx + p.x,
                  ny + p.y,
                  rotation,
                  finalCenterX,
                  finalCenterY,
                );
                const h = findNearestBreadboardHole(
                  pWorld.x,
                  pWorld.y,
                  breadboards || [],
                  LOCAL_PIN_DEFS,
                );
                if (h && Math.hypot(pWorld.x - h.x, pWorld.y - h.y) < 1) {
                  currentSnaps.push({ ...h, compPinId: p.id });
                }
              });
              compUpdate.snappingHoles = currentSnaps;
            }
          }
        }
      } else if (sd && canvasRef.current) {
        // Advanced Wire Interaction: Segment or Waypoint drag
        const rect = canvasRef.current.getBoundingClientRect();
        const mx =
          (e.clientX - rect.left - canvasOffsetRef.current.x) /
          canvasZoomRef.current;
        const my =
          (e.clientY - rect.top - canvasOffsetRef.current.y) /
          canvasZoomRef.current;
        const ddx = mx - sd.startMouseCanvas.x;
        const ddy = my - sd.startMouseCanvas.y;

        if (Math.abs(ddx) >= 1 || Math.abs(ddy) >= 1) {
          sd.hasMoved = true;
          const newPts = sd.startPts.map((pt) => ({ ...pt }));
          const { segIdx, isHoriz, mode } = sd;

          if (mode === "waypoint") {
            // Free move waypoint
            newPts[segIdx].x = sd.startPts[segIdx].x + ddx;
            newPts[segIdx].y = sd.startPts[segIdx].y + ddy;
          } else {
            // Orthogonal segment drag
            if (isHoriz) {
              const newY = sd.startPts[segIdx].y + ddy;
              newPts[segIdx] = { ...newPts[segIdx], y: newY };
              newPts[segIdx + 1] = { ...newPts[segIdx + 1], y: newY };
            } else {
              const newX = sd.startPts[segIdx].x + ddx;
              newPts[segIdx] = { ...newPts[segIdx], x: newX };
              newPts[segIdx + 1] = { ...newPts[segIdx + 1], x: newX };
            }
          }
          const finalWaypoints = [];
          if (newPts[0] && sd.startPts[0] && (newPts[0].x !== sd.startPts[0].x || newPts[0].y !== sd.startPts[0].y)) {
            finalWaypoints.push({ x: newPts[0].x, y: newPts[0].y, _corner: true });
          }
          for (let i = 1; i < newPts.length - 1; i++) {
            if (newPts[i]) finalWaypoints.push({ x: newPts[i].x, y: newPts[i].y, _corner: true });
          }
          const lastIdx = newPts.length - 1;
          if (lastIdx > 0 && newPts[lastIdx] && sd.startPts[lastIdx] && (newPts[lastIdx].x !== sd.startPts[lastIdx].x || newPts[lastIdx].y !== sd.startPts[lastIdx].y)) {
            finalWaypoints.push({ x: newPts[lastIdx].x, y: newPts[lastIdx].y, _corner: true });
          }

          wireUpdate = {
            wireId: sd.wireId,
            cornerWaypoints: finalWaypoints.filter(pt => pt && isFinite(pt.x) && isFinite(pt.y)),
          };
        }
      } else if (isPanningRef.current && !isCanvasLockedRef.current) {
        // Fix #4 ─ canvas panning via direct DOM transform (zero React renders mid-pan)
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        if (!didPanRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
          didPanRef.current = true;
        }
        if (didPanRef.current) {
          const newOffset = {
            x: panStartRef.current.ox + dx,
            y: panStartRef.current.oy + dy,
          };
          canvasOffsetRef.current = newOffset;
          // Apply transform directly to DOM — NO React state update mid-pan
          if (innerCanvasRef.current) {
            innerCanvasRef.current.style.transform = `translate(${newOffset.x}px, ${newOffset.y}px) scale(${canvasZoomRef.current})`;
          }
          panUpdate = newOffset; // stored so onUp can commit to React state
        }
      } else if (wireStart && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const rawX = snapToGrid(
          (e.clientX - rect.left - canvasOffsetRef.current.x) /
          canvasZoomRef.current,
        );
        const rawY = snapToGrid(
          (e.clientY - rect.top - canvasOffsetRef.current.y) /
          canvasZoomRef.current,
        );
        mousePosUpdate = { x: rawX, y: rawY };
      } else {
        // Fix #5 ─ mouse position and inspector hover tracking (throttled)
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const rawX =
            (e.clientX - rect.left - canvasOffsetRef.current.x) /
            canvasZoomRef.current;
          const rawY =
            (e.clientY - rect.top - canvasOffsetRef.current.y) /
            canvasZoomRef.current;
          mousePosUpdate = { x: rawX, y: rawY };

          if (showInspector) {
            // Inspector hover detection (throttled)
            // 1. Detect Pin Hover
            const pinMatch = Array.from(
              document.querySelectorAll('[id^="pin-dot-"]'),
            ).find((el) => {
              const b = el.getBoundingClientRect();
              return (
                e.clientX >= b.left &&
                e.clientX <= b.right &&
                e.clientY >= b.top &&
                e.clientY <= b.bottom
              );
            });

            if (pinMatch) {
              const parts = pinMatch.id.split("-");
              const compId = parts[2];
              const pinId = parts.slice(3).join("-");
              const instState = liveOopStatesRef.current[compId];
              const pinVoltage = instState?.pins?.[pinId]?.voltage ?? 0;
              // We'll use a direct state setter here, but since it's inside RAF it's fine
              setHoveredElement({
                type: "pin",
                id: pinMatch.id,
                label: `${compId}:${pinId}`,
                voltage: pinVoltage,
                history: instState?.vHistory || [],
              });
            } else {
              // 2. Detect Wire Hover
              let foundWire = false;
              for (const w of wiresRef.current) {
                const fromParts = w.from.split(":");
                const toParts = w.to.split(":");
                // Use getPinPosRef to avoid expensive re-renders
                const p1 = getPinPosRef.current?.(
                  fromParts[0],
                  fromParts.slice(1).join(":"),
                );
                const p2 = getPinPosRef.current?.(
                  toParts[0],
                  toParts.slice(1).join(":"),
                );
                if (!p1 || !p2) continue;

                const pts = [p1, ...(w.waypoints || []), p2];
                for (let i = 0; i < pts.length - 1; i++) {
                  const dist = distToSegment(rawX, rawY, pts[i], pts[i + 1]);
                  if (dist < 5) {
                    const inst1 = liveOopStatesRef.current[fromParts[0]];
                    const v1 =
                      inst1?.pins?.[fromParts.slice(1).join(":")]?.voltage ?? 0;
                    const v2 =
                      liveOopStatesRef.current[toParts[0]]?.pins?.[
                        toParts.slice(1).join(":")
                      ]?.voltage ?? 0;
                    setHoveredElement({
                      type: "wire",
                      id: w.id,
                      label: `Wire ${w.id}`,
                      voltage: Math.max(v1, v2),
                      current: Math.abs(v1 - v2) * 1000,
                      history: inst1?.vHistory || [],
                    });
                    foundWire = true;
                    break;
                  }
                }
                if (foundWire) break;
              }

              if (!foundWire) {
                // 3. Detect Component Body Hover
                const compMatch = componentsRef.current.find((c) => {
                  const dx = rawX - c.x - c.w / 2;
                  const dy = rawY - c.y - c.h / 2;
                  return Math.abs(dx) < c.w / 2 && Math.abs(dy) < c.h / 2;
                });

                if (compMatch) {
                  const instState = liveOopStatesRef.current[compMatch.id];
                  const vDrop = instState?.voltageDrop ?? 0;
                  const current = instState?.current ?? 0;
                  setHoveredElement({
                    type: "comp",
                    id: compMatch.id,
                    label: compMatch.label || compMatch.type,
                    voltageDrop: vDrop,
                    current,
                    power: instState?.power ?? vDrop * current,
                    history: instState?.vHistory || [],
                  });
                } else {
                  setHoveredElement(null);
                }
              }
            }
          }
        }
      }

      // ── Schedule a single rAF to flush state updates (cap at 60fps) ───────
      pendingMoveRef.current = { compUpdate, wireUpdate, mousePosUpdate };
      if (!rafMoveRef.current) {
        rafMoveRef.current = requestAnimationFrame(() => {
          rafMoveRef.current = null;
          const { compUpdate, wireUpdate, mousePosUpdate } =
            pendingMoveRef.current || {};

          if (compUpdate) {
            const {
              id,
              newX,
              newY,
              snappingHoles: holes,
              childUpdates,
            } = compUpdate;

            // 1. Direct DOM Update for Components (Master Wrapper)
            const updateMasterPos = (cid, x, y) => {
              const master = document.getElementById(`comp-master-${cid}`);
              if (master) {
                master.style.left = `${x}px`;
                master.style.top = `${y}px`;
              }
            };

            updateMasterPos(id, newX, newY);
            if (childUpdates) {
              childUpdates.forEach((u) =>
                updateMasterPos(u.id, u.newX, u.newY),
              );
            }

            // 2. Direct DOM Update for Wires (Lightweight Straight Lines)
            const affectedCompIds = new Set([
              id,
              ...(childUpdates?.map((u) => u.id) || []),
            ]);
            const affectedWires = wiresRef.current.filter((w) => {
              const fromId = w.from.split(":")[0];
              const toId = w.to.split(":")[0];
              return affectedCompIds.has(fromId) || affectedCompIds.has(toId);
            });

            // Create a quick lookup map for components for O(1) access
            const compMap = new Map();
            componentsRef.current.forEach((c) => compMap.set(c.id, c));

            affectedWires.forEach((w) => {
              const fromParts = w.from.split(":");
              const toParts = w.to.split(":");

              const getLivePos = (cid, pid) => {
                const c = compMap.get(cid);
                if (!c) return null;
                let curX = c.x,
                  curY = c.y;
                if (cid === id) {
                  curX = newX;
                  curY = newY;
                } else if (childUpdates) {
                  const u = childUpdates.find((cu) => cu.id === cid);
                  if (u) {
                    curX = u.newX;
                    curY = u.newY;
                  }
                }
                const pins = LOCAL_PIN_DEFS[c.type] || [];
                const searchId = String(pid).toLowerCase();

                const normalize = (id) => {
                  let s = String(id).toLowerCase();
                  if (s === "p1") return "1";
                  if (s === "p2") return "2";
                  if (s === "a") return "anode";
                  if (s === "k") return "cathode";
                  if (s === "3.3v" || s === "3v3") return "3v3";
                  return s.replace(/[:.]/g, "_");
                };

                const normSearch = normalize(searchId);

                let pDef = pins.find((p) => {
                  const pId = String(p.id).toLowerCase();
                  return pId === searchId || normalize(pId) === normSearch;
                });

                if (!pDef) {
                  pDef = pins.find((p) => {
                    const pId = String(p.id).toLowerCase();
                    const normPid = normalize(pId);
                    return (
                      pId === searchId ||
                      normPid.startsWith(normSearch + "_") ||
                      normPid.startsWith(normSearch + ".") ||
                      pId.startsWith(searchId + ".") ||
                      pId.startsWith(searchId + "_")
                    );
                  });
                }
                if (!pDef) return null;
                const rotation = c.rotation || 0;
                return getRotatedPoint(
                  curX + pDef.x,
                  curY + pDef.y,
                  rotation,
                  curX + c.w / 2,
                  curY + c.h / 2,
                );
              };

              const p1 = getLivePos(fromParts[0], fromParts.slice(1).join(":"));
              const p2 = getLivePos(toParts[0], toParts.slice(1).join(":"));
              if (p1 && p2) {
                // LIGHTWEIGHT: Use simple straight line during drag for maximum performance
                const pathStr = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
                const pathUi = document.getElementById(`wire-path-ui-${w.id}`);
                const pathHit = document.getElementById(
                  `wire-path-hit-${w.id}`,
                );
                const circFrom = document.getElementById(
                  `wire-circ-from-${w.id}`,
                );
                const circTo = document.getElementById(`wire-circ-to-${w.id}`);

                if (pathUi) pathUi.setAttribute("d", pathStr);
                if (pathHit) pathHit.setAttribute("d", pathStr);
                if (circFrom) {
                  circFrom.setAttribute("cx", p1.x);
                  circFrom.setAttribute("cy", p1.y);
                }
                if (circTo) {
                  circTo.setAttribute("cx", p2.x);
                  circTo.setAttribute("cy", p2.y);
                }
              }
            });

            // 3. Direct DOM Update for Snapping Feedback
            // First, clear previous snapping highlights (using a cached list or just clearing everything is too slow)
            // Better: only clear the holes that were previously snapped
            if (window._prevSnaps) {
              window._prevSnaps.forEach((h) => {
                const holeEl = document.getElementById(
                  `pin-dot-${h.bbId}-${h.holeId}`,
                );
                if (holeEl) {
                  holeEl.style.background = "rgba(255,255,255,0.2)";
                  holeEl.style.boxShadow = "none";
                  holeEl.style.borderColor = "rgba(255,255,255,0.8)";
                }
                const pinEl = document.getElementById(
                  `pin-dot-${movingComp.current.id}-${h.compPinId}`,
                );
                if (pinEl) {
                  pinEl.style.background = "rgba(255,255,255,0.2)";
                  pinEl.style.boxShadow = "none";
                  pinEl.style.borderColor = "rgba(255,255,255,0.8)";
                }
              });
            }
            if (holes) {
              holes.forEach((h) => {
                const holeEl = document.getElementById(
                  `pin-dot-${h.bbId}-${h.holeId}`,
                );
                if (holeEl) {
                  holeEl.style.background = "#2ecc71";
                  holeEl.style.boxShadow = "0 0 10px #2ecc71";
                  holeEl.style.borderColor = "#fff";
                }
                const pinEl = document.getElementById(
                  `pin-dot-${id}-${h.compPinId}`,
                );
                if (pinEl) {
                  pinEl.style.background = "#2ecc71";
                  pinEl.style.boxShadow = "0 0 10px #2ecc71";
                  pinEl.style.borderColor = "#fff";
                }
              });
            }
            window._prevSnaps = holes || [];

            // IMPORTANT: No setSnappingHoles or setComponents here!
            // This ensures ZERO React re-renders during the drag.
          }

          if (wireUpdate) {
            const { wireId, cornerWaypoints } = wireUpdate;
            setWires((prev) =>
              prev.map((w) =>
                w.id === wireId ? { ...w, waypoints: cornerWaypoints } : w,
              ),
            );
          }
          if (mousePosUpdate && !compUpdate && !isPanningRef.current) {
            // Only update mouse pos for wire pulling, not component dragging
            setMousePos(mousePosUpdate);
          }
        });
      }
    };
    const onUp = () => {
      // Cancel any pending rAF on mouse up to avoid a ghost render
      if (rafMoveRef.current) {
        cancelAnimationFrame(rafMoveRef.current);
        rafMoveRef.current = null;
      }
      // Fix #4 ─ commit final pan offset to React state once (1 render total for entire pan)
      if (isPanningRef.current && canvasOffsetRef.current) {
        setCanvasOffset({ ...canvasOffsetRef.current });
      }
      if (movingComp.current?.moved) {
        const origComps = movingComp.current.originalComps;
        const movedId = movingComp.current.id;
        const childIds = movingComp.current.childIds;

        // 1. Sync final positions from DOM to React State with grid snapping on release
        const masterElem = document.getElementById(`comp-master-${movedId}`);
        const finalX = masterElem ? parseFloat(masterElem.style.left) : 0;
        const finalY = masterElem ? parseFloat(masterElem.style.top) : 0;

        let snappedX = finalX;
        let snappedY = finalY;
        if (!window._prevSnaps || window._prevSnaps.length === 0) {
          const comp = componentsRef.current.find((c) => c.id === movedId);
          const pins = (comp && LOCAL_PIN_DEFS[comp.type]) || [];
          const anchorPin = pins[0];
          if (comp && anchorPin) {
            const cx = finalX + (comp.w || 0) / 2;
            const cy = finalY + (comp.h || 0) / 2;
            const anchorWorld = getRotatedPoint(
              finalX + anchorPin.x,
              finalY + anchorPin.y,
              comp.rotation || 0,
              cx,
              cy,
            );
            const snappedAnchorX = snapToGrid(anchorWorld.x);
            const snappedAnchorY = snapToGrid(anchorWorld.y);
            snappedX = finalX + (snappedAnchorX - anchorWorld.x);
            snappedY = finalY + (snappedAnchorY - anchorWorld.y);
          } else {
            snappedX = snapToGrid(finalX);
            snappedY = snapToGrid(finalY);
          }
        }
        const snapDiffX = snappedX - finalX;
        const snapDiffY = snappedY - finalY;

        if (masterElem) {
          masterElem.style.left = `${snappedX}px`;
          masterElem.style.top = `${snappedY}px`;
        }
        if (childIds) {
          childIds.forEach((childId) => {
            const childMaster = document.getElementById(
              `comp-master-${childId}`,
            );
            if (childMaster) {
              const cx = parseFloat(childMaster.style.left) + snapDiffX;
              const cy = parseFloat(childMaster.style.top) + snapDiffY;
              childMaster.style.left = `${cx}px`;
              childMaster.style.top = `${cy}px`;
            }
          });
        }

        setComponents((prev) => {
          let next = prev.map((c) =>
            c.id === movedId ? { ...c, x: snappedX, y: snappedY } : c,
          );
          if (childIds) {
            next = next.map((c) => {
              if (childIds.includes(c.id)) {
                const childMaster = document.getElementById(
                  `comp-master-${c.id}`,
                );
                if (childMaster) {
                  return {
                    ...c,
                    x: parseFloat(childMaster.style.left) + snapDiffX,
                    y: parseFloat(childMaster.style.top) + snapDiffY,
                  };
                }
              }
              return c;
            });
          }
          return next;
        });

        setHistory((h) => ({
          past: [
            ...h.past.slice(-20),
            { components: origComps, wires: JSON.parse(JSON.stringify(wires)) },
          ],
          future: [],
        }));

        // DETACHMENT: Remove old socket wires for this component (ONLY if moving a component, NOT a breadboard)
        const isBreadboard = isBreadboardType(
          componentsRef.current.find((c) => c.id === movedId)?.type,
        );
        if (!isBreadboard) {
          setWires((prev) =>
            prev.filter((w) => {
              const isFrom = w.from.startsWith(movedId + ":");
              const isTo = w.to.startsWith(movedId + ":");
              return !(w.isSocket && (isFrom || isTo));
            }),
          );
        }

        // ATTACHMENT: Auto-create socket wires if snapped
        const comp = componentsRef.current.find((c) => c.id === movedId);
        const finalComp = comp ? { ...comp, x: finalX, y: finalY } : null;
        if (finalComp && !isBreadboardType(finalComp.type)) {
          const { snappedWires } = robustSnapComponent(
            finalComp,
            componentsRef.current,
            LOCAL_PIN_DEFS,
          );
          if (snappedWires.length > 0) {
            setWires((prev) => [...prev, ...snappedWires]);
          }
        }

        // 2. Finalize snapping and cleanup
        if (window._prevSnaps) {
          window._prevSnaps.forEach((h) => {
            const holeEl = document.getElementById(
              `pin-dot-${h.bbId}-${h.holeId}`,
            );
            if (holeEl) {
              holeEl.style.background = "";
              holeEl.style.boxShadow = "";
              holeEl.style.borderColor = "";
            }
            const pinEl = document.getElementById(
              `pin-dot-${movedId}-${h.compPinId}`,
            );
            if (pinEl) {
              pinEl.style.background = "";
              pinEl.style.boxShadow = "";
              pinEl.style.borderColor = "";
            }
          });
          window._prevSnaps = null;
        }
        setSnappingHoles([]);

        // 3. Clear _corner waypoints
        setWires((prev) =>
          prev.map((w) => {
            if (
              w.from.startsWith(movedId + ":") ||
              w.to.startsWith(movedId + ":")
            ) {
              if (w.waypoints?.length && w.waypoints[0]._corner)
                return { ...w, waypoints: [] };
            }
            return w;
          }),
        );
      }
      movingComp.current = null;
      setIsComponentDragging(false);
      setSnappingHoles([]);
      isPanningRef.current = false;
      if (segDragRef.current) {
        if (segDragRef.current.hasMoved) {
          const wireId = segDragRef.current.wireId;
          // Apply simplification to clean up redundant segments/waypoints
          setWires((prev) =>
            prev.map((w) => {
              if (w.id === wireId) {
                let updatedWaypoints = w.waypoints;
                if (w.waypoints?.length) {
                  const snappedWaypoints = w.waypoints.map((pt) => ({
                    ...pt,
                    x: snapToGrid(pt.x),
                    y: snapToGrid(pt.y),
                  }));
                  const fromParts = w.from.split(":");
                  const toParts = w.to.split(":");
                  const p1 = getPinPosRef.current(
                    fromParts[0],
                    fromParts.slice(1).join(":"),
                  );
                  const p2 = getPinPosRef.current(
                    toParts[0],
                    toParts.slice(1).join(":"),
                  );
                  if (p1 && p2) {
                    const fullPath = [p1, ...snappedWaypoints, p2];
                    const simplified = simplifyOrthogonalPath(fullPath);
                    updatedWaypoints = simplified.slice(1, -1);
                  } else {
                    updatedWaypoints = snappedWaypoints;
                  }
                }
                return {
                  ...w,
                  waypoints: updatedWaypoints,
                  routingInstructions: undefined,
                };
              }
              return w;
            }),
          );

          // Save undo snapshot using pre-drag wires captured at drag start
          const pre = segDragRef.current.preWires;
          setHistory((h) => ({
            past: [
              ...h.past.slice(-20),
              {
                components: JSON.parse(JSON.stringify(componentsRef.current)),
                wires: JSON.parse(JSON.stringify(pre)),
              },
            ],
            future: [],
          }));
          // Prevent the subsequent click event from deselecting the wire
          didPanRef.current = true;
        }
        segDragRef.current = null;
        setSegDrag(null);
      }
      setIsComponentDragging(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [wireStart, wires]);

  const updateComponentAttr = (id, key, value) => {
    if (liveEditingDisabled) return;
    saveHistory();
    setComponents((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          let newW = c.w;
          let newH = c.h;
          const nextValue =
            key === "env" && normalizeBoardKind(c.type) === "rp2040"
              ? normalizeRp2040Env(value)
              : value;
          if (
            c.type === "wokwi-neopixel-matrix" ||
            c.type === "openhw-neopixel-matrix"
          ) {
            const rows =
              key === "rows"
                ? parseInt(nextValue) || 1
                : parseInt(c.attrs?.rows) || 1;
            const cols =
              key === "cols"
                ? parseInt(nextValue) || 1
                : parseInt(c.attrs?.cols) || 1;
            newW = Math.max(30, cols * 30);
            newH = Math.max(30, rows * 30);
          }
          return {
            ...c,
            w: newW,
            h: newH,
            attrs: { ...c.attrs, [key]: nextValue },
          };
        }
        return c;
      }),
    );
  };

  const onCompContextMenu = useCallback((e, compId) => {
    e.preventDefault();
    e.stopPropagation();
    setCompContextMenu({ x: e.clientX, y: e.clientY, compId });
    setRenameState({ id: null, x: 0, y: 0 }); // Close rename panel if open
    setValueState({ id: null, x: 0, y: 0, key: "value" }); // Close value panel if open
  }, []);

  const handleRenameComponentId = useCallback(
    (oldId, newId) => {
      if (!newId || oldId === newId) {
        setRenameState({ id: null, x: 0, y: 0 });
        return;
      }

      // Check for ID conflicts
      if (components.some((c) => c.id === newId)) {
        console.warn(`[Rename] ID conflict: ${newId} already exists.`);
        setRenameState({ id: null, x: 0, y: 0 });
        return;
      }

      saveHistory();

      // Update component ID
      setComponents((prev) =>
        prev.map((c) => (c.id === oldId ? { ...c, id: newId } : c)),
      );

      // Update all wires referencing this component
      setWires((prev) =>
        prev.map((w) => {
          let from = w.from;
          let to = w.to;
          const [fromComp, ...fromPin] = from.split(":");
          const [toComp, ...toPin] = to.split(":");

          if (fromComp === oldId) {
            from = `${newId}:${fromPin.join(":")}`;
          }
          if (toComp === oldId) {
            to = `${newId}:${toPin.join(":")}`;
          }

          return { ...w, from, to };
        }),
      );

      if (selected === oldId) setSelected(newId);
      setRenameState({ id: null, x: 0, y: 0 });
    },
    [components, saveHistory, selected],
  );

  // ── Block default browser zoom/scroll with non-passive listeners ───────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.closest('[data-simulation-console="true"]') ||
          e.target.closest('[data-no-canvas-scroll="true"]'))
      )
        return;
      onWheel(e);
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [onWheel]);

  // ── Pin click — start or complete wire ─────────────────────────────────────
  const onPinClick = useCallback(
    (e, compId, pinId, pinLabel) => {
      e.stopPropagation();
      if (isRunning || liveEditingDisabled) return; // Restrict wiring while running

      const pos = getPinPos(compId, pinId);
      if (!pos) return;

      if (!wireStart) {
        // Start wire
        setWireStart({ compId, pinId, pinLabel, ...pos });
      } else {
        // Complete wire — prevent self-loop
        if (wireStart.compId === compId && wireStart.pinId === pinId) {
          setWireStart(null);
          return;
        }
        saveHistory();
        const color1 = wireColor(wireStart.pinLabel);
        const color2 = wireColor(pinLabel);

        // Logic: If the second pin has a more "specific" color (comms, power, etc.)
        // and the first is generic green, use the specific color.
        const isGeneric = (c) => c === "#2ecc71" || c === "#10b981";
        let finalColor = !isGeneric(color2) && isGeneric(color1) ? color2 : color1;
        if (color1 === 'black' || color2 === 'black') finalColor = 'black';

        const newWire = {
          id: `w${nextWireId++}`,
          from: `${wireStart.compId}:${wireStart.pinId}`,
          to: `${compId}:${pinId}`,
          fromLabel: wireStart.pinLabel,
          toLabel: pinLabel,
          color: finalColor,
          waypoints: wireStart.waypoints || [],
          isBelow: false,
        };
        setWires((prev) => [...prev, newWire]);
        setWireStart(null);
      }
    },
    [wireStart, getPinPos, saveHistory, isRunning, liveEditingDisabled],
  );

  const updateWireColor = (id, color) => {
    setWires((prev) => prev.map((w) => (w.id === id ? { ...w, color } : w)));
  };

  const toggleWireLayer = (id) => {
    saveHistory();
    setWires((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isBelow: !w.isBelow } : w)),
    );
  };

  const handleWireToBoard = async (compId, targetBoardId) => {
    const comp = components.find((c) => c.id === compId);
    if (!comp) return;

    saveHistory();

    const manifest = COMPONENT_REGISTRY[comp.type]?.manifest || {};

    // Trigger WASM setup with isRewire flag
    // The worker will handle cleaning up old wires and helper components
    const plan = await generateAutonomousSetup(
      components,
      wires,
      comp,
      manifest,
      targetBoardId,
      PIN_DEFS,
      autoBreadboardEnabled,
      true, // isRewire
    );

    if (plan) {
      if (plan.reasoning) {
        const critical = plan.reasoning.find((r) =>
          r.toUpperCase().includes("CRITICAL"),
        );
        if (critical) {
          alert(`Autowiring Critical Error:\n\n${critical}`);
          return;
        }
      }

      // Re-map IDs for added components to ensure uniqueness during re-wiring
      const mainCompId = compId;
      const adjustedPlan = {
        ...plan,
        added_components: plan.added_components || [],
      };

      const result = calculateProjectPlanApplication(
        adjustedPlan,
        components,
        wires,
        PIN_DEFS,
      );

      // Persist the target board selection in attributes for UI selection state
      const finalComponents = result.components.map((c) =>
        c.id === compId
          ? { ...c, attrs: { ...c.attrs, targetBoard: targetBoardId } }
          : c,
      );

      setComponents(finalComponents);
      setWires(result.wires);

      // Remove any existing autocoded snippet for this component from all project files
      setProjectFiles((prev) =>
        prev.map((f) => {
          if (f.content) {
            const newContent = removeCodeSnippet(f.content, compId);
            if (activeCodeFileId === f.id && code !== newContent) {
              setCode(newContent);
            }
            return { ...f, content: newContent };
          }
          return f;
        }),
      );
    }
  };

  const handleOpenCode = (comp) => {
    console.log(
      "[handleOpenCode] Triggered for component:",
      comp.id,
      comp.type,
    );
    const boardKind = normalizeBoardKind(comp.type);
    const filename = getDefaultMainFileName(boardKind, comp.id, {
      rp2040Mode: comp.attrs?.env || "native",
    });

    // Try to find existing file by boardId or filename or just the first code file
    let targetFile = projectFiles.find(
      (f) => f.boardId === comp.id || f.id === filename || f.name === filename,
    );
    if (!targetFile) {
      // Fallback: if there's only one code file, just use it
      const codeFiles = projectFiles.filter(
        (f) => f.kind === "code" || /\.(ino|py|c|cpp)$/i.test(f.name),
      );
      if (codeFiles.length > 0) {
        targetFile = codeFiles[0];
        console.log(
          "[handleOpenCode] Fallback to first code file:",
          targetFile.id,
        );
      } else {
        console.log(
          "[handleOpenCode] File not found, creating new file:",
          filename,
        );
        // Create the file
        targetFile = {
          id: filename,
          path: filename,
          name: filename,
          kind: "code",
          boardId: comp.id,
          boardKind: boardKind,
          content: createDefaultMainCode(boardKind, comp.id, {
            rp2040Mode: comp.attrs?.env || "native",
          }),
          dirty: false,
        };
        setProjectFiles((prev) => [...prev, targetFile]);
      }
    } else {
      console.log("[handleOpenCode] Found existing file:", targetFile.id);
    }

    if (!openCodeTabs.includes(targetFile.id)) {
      setOpenCodeTabs((prev) => [...prev, targetFile.id]);
    }
    setActiveCodeFileId(targetFile.id);
    setCodeTab("code");
    setIsPanelOpen(true);
    setShowCodeExplorer(true);
  };

  const handleAutoCode = async (compId, options = {}) => {
    const { silent = false, openEditor = true } = options;
    console.log("[handleAutoCode] Triggered for component:", compId);
    const comp = components.find((c) => c.id === compId);
    if (!comp) {
      console.error("[handleAutoCode] Component not found in state:", compId);
      return;
    }

    // Find the board it is connected to (Recursive Tracing)
    const findConnectedBoardId = (currentId, visited = new Set()) => {
      if (visited.has(currentId)) return null;
      visited.add(currentId);

      // Check if current is a board
      const comp = components.find((c) => c.id === currentId);
      if (comp && isProgrammableBoardType(comp.type)) return comp.id;

      // Find all neighbors via wires
      for (const w of wires) {
        const fromParts = w.from.split(":");
        const toParts = w.to.split(":");

        let neighborId = null;
        if (fromParts[0] === currentId) neighborId = toParts[0];
        else if (toParts[0] === currentId) neighborId = fromParts[0];

        if (neighborId) {
          const boardId = findConnectedBoardId(neighborId, visited);
          if (boardId) return boardId;
        }
      }
      return null;
    };

    let targetBoardId = findConnectedBoardId(compId);

    if (!targetBoardId) {
      console.warn(
        "[handleAutoCode] No target board found for component:",
        compId,
      );
      if (!silent) alert("Component must be wired to a board first to generate code.");
      return;
    }

    console.log("[handleAutoCode] Target board found:", targetBoardId);
    const manifest = COMPONENT_REGISTRY[comp.type]?.manifest || {};

    // Call the worker
    console.log("[handleAutoCode] Sending request to worker...");
    const worker = new Worker(
      new URL("../../workers/autowiring.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.postMessage({
      type: "GENERATE_CODE_SNIPPET",
      payload: { compId, wires, manifest, components },
    });

    worker.onmessage = async (e) => {
      const { type, payload } = e.data;
      if (type === "AUTONOMOUS_RESULT") {
        const snippet = payload.code_snippet;
        console.log("[handleAutoCode] Worker returned snippet:", snippet);
        if (snippet) {
          const boardComp = components.find((c) => c.id === targetBoardId);
          const boardKind = normalizeBoardKind(boardComp.type);
          const filename = getDefaultMainFileName(boardKind, targetBoardId, {
            rp2040Mode: boardComp.attrs?.env || "native",
          });

          // Inject libraries if any
          if (payload.libraries && payload.libraries.length > 0) {
            console.log('[handleAutoCode] Libraries required:', payload.libraries);
            const libPath = `project/${targetBoardId}/library.txt`;
            setProjectFiles(prev => {
              const fileObj = prev.find(f => f.id === libPath);
              let currentContent = '';
              if (fileObj) {
                currentContent = activeCodeFileId === libPath ? code : (fileObj.content || '');
              } else {
                currentContent = `# Add your libraries here (one per line, e.g. ArduinoJson@6.21.3)\n`;
              }
              const lines = currentContent.split('\n').map(l => l.trim());
              const existingSet = new Set(
                lines
                  .filter(l => l && !l.startsWith('#'))
                  .map(l => l.split('@')[0].trim().toLowerCase())
              );
              const linesToAdd = [];
              payload.libraries.forEach(lib => {
                const cleanLib = String(lib).trim();
                const libNameOnly = cleanLib.split('@')[0].trim().toLowerCase();
                if (!existingSet.has(libNameOnly)) {
                  linesToAdd.push(cleanLib);
                }
              });
              if (linesToAdd.length > 0) {
                const newLines = [...currentContent.split('\n')];
                linesToAdd.forEach(lib => {
                  if (newLines.length > 0 && newLines[newLines.length - 1].trim() !== '') {
                    newLines.push(lib);
                  } else if (newLines.length > 0 && newLines[newLines.length - 1].trim() === '') {
                    newLines[newLines.length - 1] = lib;
                  } else {
                    newLines.push(lib);
                  }
                });
                const nextContent = newLines.join('\n');
                if (activeCodeFileId === libPath) {
                  setCode(nextContent);
                }
                if (fileObj) {
                  return prev.map(f => f.id === libPath ? { ...f, content: nextContent } : f);
                } else {
                  return [...prev, {
                    id: libPath,
                    path: libPath,
                    name: 'library.txt',
                    kind: 'code',
                    boardId: targetBoardId,
                    boardKind: boardKind,
                    content: nextContent,
                    dirty: true
                  }];
                }
              }
              return prev;
            });
          }

          let resolvedTargetFileId = filename;
          setProjectFiles((prev) => {
            let nextFiles = prev;
            let targetFile = nextFiles.find(
              (f) =>
                f.boardId === targetBoardId ||
                f.id === filename ||
                f.name === filename,
            );
            if (!targetFile) {
              const codeFiles = nextFiles.filter(
                (f) => f.kind === "code" || /\.(ino|py|c|cpp)$/i.test(f.name),
              );
              if (codeFiles.length > 0) {
                targetFile = codeFiles[0];
              } else {
                console.log(
                  "[handleAutoCode] Creating new file for injection:",
                  filename,
                );
                targetFile = {
                  id: filename,
                  path: filename,
                  name: filename,
                  kind: "code",
                  boardId: targetBoardId,
                  boardKind: boardKind,
                  content: createDefaultMainCode(boardKind, targetBoardId, {
                    rp2040Mode: boardComp.attrs?.env || "native",
                  }),
                  dirty: false,
                };
                nextFiles = [...nextFiles, targetFile];
              }
            }
            resolvedTargetFileId = targetFile.id;

            console.log(
              "[handleAutoCode] Injecting code into file:",
              targetFile.id,
            );
            return nextFiles.map((f) => {
              if (f.id === targetFile.id) {
                const currentContent =
                  activeCodeFileId === f.id || activeCodeFileId === f.name
                    ? currentCodeRef.current
                    : f.content;
                const newContent = mergeCodeSnippet(
                  currentContent,
                  snippet,
                  compId,
                );
                // Also update live code if it's the active file
                if (activeCodeFileId === targetFile.id) {
                  setCode(newContent);
                }
                return { ...f, content: newContent, dirty: true };
              }
              return f;
            });
          });

          if (openEditor) {
            setOpenCodeTabs((prevTabs) =>
              prevTabs.includes(resolvedTargetFileId)
                ? prevTabs
                : [...prevTabs, resolvedTargetFileId],
            );
            setActiveCodeFileId(resolvedTargetFileId);
            setCodeTab("code");
            setIsPanelOpen(true);
            setShowCodeExplorer(true);
          }
        } else {
          console.warn("[handleAutoCode] Worker returned empty snippet.");
        }
      }
      worker.terminate();
    };
  };

  useEffect(() => {
    if (!autoCodingEnabled || isRunning || liveEditingDisabled) return;

    const hasAutocodeSnippet = (compId) =>
      projectFilesRef.current.some((file) =>
        String(file.content || "").includes(`autocoding for ${compId} start`),
      );

    const touchesBoard = (compId) => {
      const visited = new Set();
      const stack = [compId];
      while (stack.length > 0) {
        const current = stack.pop();
        if (!current || visited.has(current)) continue;
        visited.add(current);
        const comp = components.find((c) => c.id === current);
        if (comp && isProgrammableBoardType(comp.type)) return true;
        for (const wire of wires) {
          const [fromComp] = String(wire.from || "").split(":");
          const [toComp] = String(wire.to || "").split(":");
          if (fromComp === current && !visited.has(toComp)) stack.push(toComp);
          if (toComp === current && !visited.has(fromComp)) stack.push(fromComp);
        }
      }
      return false;
    };

    const timer = window.setTimeout(() => {
      components
        .filter((comp) =>
          !isProgrammableBoardType(comp.type) &&
          !isBreadboardType(comp.type) &&
          !isResistorType(comp.type) &&
          !hasAutocodeSnippet(comp.id) &&
          touchesBoard(comp.id),
        )
        .slice(0, 3)
        .forEach((comp) => {
          handleAutoCode(comp.id, { silent: true, openEditor: false });
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [autoCodingEnabled, components, wires, isRunning, liveEditingDisabled]);

  const deleteWire = (id) => {
    if (isRunning || liveEditingDisabled) return;
    saveHistory();
    setWires((prev) => prev.filter((w) => w.id !== id));
    if (selected === id) setSelected(null);
  };

  const rotateComponent = (id) => {
    if (isRunning || liveEditingDisabled) return;
    saveHistory();

    setComponents((prev) => {
      const comp = prev.find((c) => c.id === id);
      if (!comp) return prev;

      const newRotation = ((comp.rotation || 0) + 90) % 360;

      // If breadboard, rotate children
      if (isBreadboardType(comp.type)) {
        const childIds = new Set(
          wiresRef.current
            .filter(
              (w) =>
                w.isSocket &&
                (w.from.startsWith(id + ":") || w.to.startsWith(id + ":")),
            )
            .map((w) => {
              const fromId = w.from.split(":")[0];
              const toId = w.to.split(":")[0];
              return fromId === id ? toId : fromId;
            }),
        );

        const bbCenterX = comp.x + comp.w / 2;
        const bbCenterY = comp.y + comp.h / 2;

        return prev.map((c) => {
          if (c.id === id) return { ...c, rotation: newRotation };
          if (childIds.has(c.id)) {
            // Rotate child center around breadboard center
            const childCenterX = c.x + c.w / 2;
            const childCenterY = c.y + c.h / 2;
            const rotated = getRotatedPoint(
              childCenterX,
              childCenterY,
              90,
              bbCenterX,
              bbCenterY,
            );

            return {
              ...c,
              x: rotated.x - c.w / 2,
              y: rotated.y - c.h / 2,
              rotation: ((c.rotation || 0) + 90) % 360,
            };
          }
          return c;
        });
      }

      return prev.map((c) =>
        c.id === id ? { ...c, rotation: newRotation } : c,
      );
    });
  };

  const downloadCodeFile = useCallback(
    (fileId) => {
      const file = projectFileMap.get(fileId);
      if (!file) return;
      const blob = new Blob([file.content || ""], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    },
    [projectFileMap],
  );

  const getBoardFirmwareAssets = useCallback(
    (boardId) => {
      const boardFiles = projectFiles
        .filter((f) => f.path.startsWith(`project/${boardId}/`))
        .filter((f) => !isFileDisabled(f.path));
      const uf2File = boardFiles.find(
        (f) =>
          fileExt(f.path) === ".uf2" &&
          typeof f.content === "string" &&
          f.content.trim(),
      );
      const pyFiles = boardFiles
        .filter((f) => fileExt(f.path) === ".py")
        .map((f) => ({
          path: toBoardRelativePath(boardId, f.path),
          name: f.name,
          content: String(f.content || ""),
        }));

      const mainPy =
        pyFiles.find((f) => f.name.toLowerCase() === "main.py") ||
        pyFiles[0] ||
        null;

      let uf2Payload = null;
      if (uf2File?.content) {
        const raw = String(uf2File.content).trim();
        uf2Payload = raw.startsWith(UF2_PAYLOAD_PREFIX)
          ? raw
          : `${UF2_PAYLOAD_PREFIX}${raw}`;
      }

      return { uf2Payload, mainPy, pythonFiles: pyFiles };
    },
    [projectFiles],
  );

  const fetchDefaultMicroPythonUf2Payload = useCallback(async () => {
    if (micropythonUf2PayloadRef.current)
      return micropythonUf2PayloadRef.current;

    const response = await fetch(
      `${DEFAULT_PICO_MICROPYTHON_UF2_URL}?v=uart0`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      throw new Error(
        `Unable to fetch default MicroPython UF2 (${response.status})`,
      );
    }

    const buffer = await response.arrayBuffer();
    const payload = `${UF2_PAYLOAD_PREFIX}${arrayBufferToBase64(buffer)}`;
    micropythonUf2PayloadRef.current = payload;
    return payload;
  }, []);

  const fetchDefaultCircuitPythonUf2Payload = useCallback(async () => {
    if (circuitPythonUf2PayloadRef.current)
      return circuitPythonUf2PayloadRef.current;

    const version = encodeURIComponent(DEFAULT_PICO_CIRCUITPYTHON_VERSION);
    const response = await fetch(
      `${DEFAULT_PICO_CIRCUITPYTHON_UF2_URL}?v=${version}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      throw new Error(
        `Unable to fetch default CircuitPython UF2 (${response.status})`,
      );
    }

    const buffer = await response.arrayBuffer();
    const payload = `${UF2_PAYLOAD_PREFIX}${arrayBufferToBase64(buffer)}`;
    circuitPythonUf2PayloadRef.current = payload;
    return payload;
  }, []);

  const resolveFolderFilePolicy = useCallback(
    (parentPath = "project") => {
      const normalizedParent =
        String(parentPath || "project").trim() || "project";
      const boardMatch = normalizedParent.match(/^project\/([^/]+)(?:\/|$)/);
      if (!boardMatch) {
        return {
          parent: normalizedParent,
          boardId: "",
          boardKind: "root",
          rp2040Mode: "native",
          defaultExt: ".ino",
          allowedExtensions: ROOT_UPLOADABLE_EXTENSIONS,
        };
      }

      const boardId = boardMatch[1];
      const boardComp = boardComponentMap.get(boardId);
      const boardKind = normalizeBoardKind(boardComp?.type || "");
      if (boardKind !== "rp2040") {
        return {
          parent: normalizedParent,
          boardId,
          boardKind,
          rp2040Mode: "native",
          defaultExt: ".ino",
          allowedExtensions: RP2040_NATIVE_ALLOWED_EXTENSIONS,
        };
      }

      const rp2040Mode = rp2040BoardSourceModes[boardId] || "native";
      return {
        parent: normalizedParent,
        boardId,
        boardKind,
        rp2040Mode,
        defaultExt: isRp2040PythonEnv(rp2040Mode) ? ".py" : ".ino",
        allowedExtensions: isRp2040PythonEnv(rp2040Mode)
          ? RP2040_MICROPYTHON_ALLOWED_EXTENSIONS
          : RP2040_NATIVE_ALLOWED_EXTENSIONS,
      };
    },
    [boardComponentMap, rp2040BoardSourceModes],
  );

  const createCodeFile = useCallback(
    (requestedName, openAfterCreate = false, customParent = null) => {
      const cleaned = String(requestedName || "").trim();
      if (!cleaned) return null;

      let parent = "project";
      if (customParent) {
        parent = customParent;
      } else {
        const activePath = activeCodeFile?.path || "";
        parent = activePath.includes("/")
          ? activePath.substring(0, activePath.lastIndexOf("/"))
          : "project";
      }

      const folderPolicy = resolveFolderFilePolicy(parent);

      const defaultExt = folderPolicy.defaultExt || ".ino";
      const rawExt = fileExt(cleaned);
      const fileNameBase = rawExt ? cleaned.slice(0, -rawExt.length) : cleaned;
      const ext = rawExt || defaultExt;
      const safeBase =
        fileNameBase.replace(/[^a-zA-Z0-9._-]/g, "_") || "new_file";
      const safeExt = (
        ext.replace(/[^a-zA-Z0-9.]/g, "") || defaultExt
      ).toLowerCase();

      if (!folderPolicy.allowedExtensions.has(safeExt)) {
        if (folderPolicy.boardKind === "rp2040") {
          const modeLabel = isRp2040PythonEnv(folderPolicy.rp2040Mode)
            ? ".py"
            : ".ino";
          alert(
            `RP2040 board ${folderPolicy.boardId} currently allows ${modeLabel} workflow files. "${safeExt}" is disabled for this env.`,
          );
        } else {
          alert(`Unsupported file type: ${safeExt}`);
        }
        return null;
      }

      let candidate = `${safeBase}${safeExt}`;
      let candidatePath = `${parent}/${candidate}`;
      let i = 2;

      while (projectFileMap.has(candidatePath)) {
        candidate = `${safeBase}_${i}${safeExt}`;
        candidatePath = `${parent}/${candidate}`;
        i++;
      }

      const boardMatch = candidatePath.match(/^project\/([^/]+)\//);
      const content =
        safeExt === ".h"
          ? `#pragma once\n\n// ${safeBase} declarations\n`
          : safeExt === ".cpp"
            ? `#include "${safeBase}.h"\n\n// ${safeBase} implementation\n`
            : safeExt === ".ino"
              ? `void setup() {\n}\n\nvoid loop() {\n}\n`
              : safeExt === ".py"
                ? `from machine import Pin\nfrom time import sleep\n\nled = Pin('LED', Pin.OUT)\n\nwhile True:\n  led.toggle()\n  sleep(0.5)\n`
                : "";

      const nextFile = {
        id: candidatePath,
        path: candidatePath,
        name: candidate,
        kind: "code",
        boardId: boardMatch ? boardMatch[1] : undefined,
        boardKind: boardMatch ? folderPolicy.boardKind : undefined,
        content,
        dirty: true,
      };

      setProjectFiles((prev) => [...prev, nextFile]);
      if (openAfterCreate) {
        setOpenCodeTabs((prev) =>
          prev.includes(candidatePath) ? prev : [...prev, candidatePath],
        );
        setActiveCodeFileId(candidatePath);
      }

      return candidatePath;
    },
    [activeCodeFile, projectFileMap, resolveFolderFilePolicy],
  );

  const createCodeTab = useCallback(
    (requestedName) => {
      return createCodeFile(requestedName, true);
    },
    [createCodeFile],
  );

  const uploadCodeFile = useCallback(
    (customParent = null) => {
      let parent = "project";
      if (customParent) {
        parent = customParent;
      } else {
        const activePath = activeCodeFile?.path || "";
        parent = activePath.includes("/")
          ? activePath.substring(0, activePath.lastIndexOf("/"))
          : "project";
      }

      const folderPolicy = resolveFolderFilePolicy(parent);
      const input = document.createElement("input");
      input.type = "file";
      input.accept = Array.from(folderPolicy.allowedExtensions).join(",");
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const rawExt = fileExt(file.name);
        const readAsBinary = rawExt === ".uf2";
        const reader = new FileReader();
        reader.onload = (re) => {
          let content = re.target.result;
          if (readAsBinary) {
            const base64 = arrayBufferToBase64(content);
            content = `${UF2_PAYLOAD_PREFIX}${base64}`;
          }

          const fileNameBase = rawExt
            ? file.name.slice(0, -rawExt.length)
            : file.name;
          const ext = rawExt || folderPolicy.defaultExt || ".ino";
          const safeBase =
            fileNameBase.replace(/[^a-zA-Z0-9._-]/g, "_") || "uploaded";
          const safeExt = (
            ext.replace(/[^a-zA-Z0-9.]/g, "") || ".ino"
          ).toLowerCase();

          if (!folderPolicy.allowedExtensions.has(safeExt)) {
            if (folderPolicy.boardKind === "rp2040") {
              const modeLabel = isRp2040PythonEnv(folderPolicy.rp2040Mode)
                ? ".py"
                : ".ino";
              alert(
                `RP2040 board ${folderPolicy.boardId} currently allows ${modeLabel} workflow files. "${safeExt}" cannot be uploaded in this env.`,
              );
            } else {
              alert(`Unsupported file type: ${safeExt}`);
            }
            return;
          }

          let candidate = `${safeBase}${safeExt}`;
          let candidatePath = `${parent}/${candidate}`;
          let i = 2;

          while (projectFileMap.has(candidatePath)) {
            candidate = `${safeBase}_${i}${safeExt}`;
            candidatePath = `${parent}/${candidate}`;
            i++;
          }

          const boardMatch = candidatePath.match(/^project\/([^/]+)\//);
          const nextFile = {
            id: candidatePath,
            path: candidatePath,
            name: candidate,
            kind: "code",
            boardId: boardMatch ? boardMatch[1] : undefined,
            boardKind: boardMatch ? folderPolicy.boardKind : undefined,
            content,
            dirty: true,
          };

          setProjectFiles((prev) => [...prev, nextFile]);
          setOpenCodeTabs((prev) =>
            prev.includes(candidatePath) ? prev : [...prev, candidatePath],
          );
          setActiveCodeFileId(candidatePath);

          appendConsoleEntry("info", `File uploaded: ${candidate}`, "code");
        };
        if (readAsBinary) reader.readAsArrayBuffer(file);
        else reader.readAsText(file);
      };
      input.click();
    },
    [
      activeCodeFile,
      projectFileMap,
      appendConsoleEntry,
      resolveFolderFilePolicy,
    ],
  );

  // ─── Project Save / Load Handlers ───────────────────────────────────────────

  const sanitizeDownloadStem = useCallback((value, fallback = "firmware") => {
    const cleaned = String(value || "")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    return cleaned || fallback;
  }, []);

  const resolveFirmwareBoardFileStem = useCallback(
    (boardId = "") => {
      const normalizedBoardId = String(boardId || "").trim();
      if (!normalizedBoardId) return "";

      const boardComp = boardComponentMap.get(normalizedBoardId);
      const boardLabel = String(boardComp?.label || "").trim();
      return sanitizeDownloadStem(boardLabel || normalizedBoardId, "firmware");
    },
    [boardComponentMap, sanitizeDownloadStem],
  );

  const buildSimulationJsonPayload = useCallback(() => {
    return buildProjectPayload({
      name: currentProjectName,
      board,
      components,
      wires,
      code,
      blocklyXml,
      blocklyGeneratedCode,
      useBlocklyCode,
      projectFiles,
      openCodeTabs,
      activeCodeFileId,
      exportedAt: new Date().toISOString(),
    });
  }, [
    currentProjectName,
    board,
    components,
    wires,
    code,
    blocklyXml,
    blocklyGeneratedCode,
    useBlocklyCode,
    projectFiles,
    openCodeTabs,
    activeCodeFileId,
  ]);

  const downloadSimulationJson = useCallback(() => {
    try {
      const payload = buildSimulationJsonPayload();
      const fileBase = sanitizeDownloadStem(
        currentProjectName || "simulation",
        "simulation",
      );
      const fileName = `${fileBase}.json`;

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      appendConsoleEntry(
        "info",
        `Simulation JSON downloaded: ${fileName}`,
        "simulator",
      );
    } catch (err) {
      appendConsoleEntry(
        "error",
        `Simulation JSON download failed: ${err?.message || "Unknown error"}`,
        "simulator",
      );
    }
  }, [
    appendConsoleEntry,
    buildSimulationJsonPayload,
    currentProjectName,
    sanitizeDownloadStem,
  ]);

  const parseFirmwareUploadFile = useCallback((file) => {
    return new Promise((resolve, reject) => {
      if (!(file instanceof File)) {
        reject(new Error("No firmware file selected."));
        return;
      }

      const rawExt = fileExt(file.name).toLowerCase();
      if (rawExt !== ".hex" && rawExt !== ".uf2") {
        reject(
          new Error(
            "Unsupported firmware file. Use .hex (all boards) or .uf2 (RP2040).",
          ),
        );
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
      reader.onload = () => {
        try {
          if (rawExt === ".uf2") {
            const buffer = reader.result;
            if (!(buffer instanceof ArrayBuffer)) {
              throw new Error("UF2 payload read failed.");
            }
            const payload = `${UF2_PAYLOAD_PREFIX}${arrayBufferToBase64(buffer)}`;
            resolve({ payload, ext: rawExt, fileName: file.name });
            return;
          }

          const payload = String(reader.result || "").trim();
          resolve({ payload, ext: rawExt, fileName: file.name });
        } catch (err) {
          reject(
            err instanceof Error
              ? err
              : new Error("Failed to parse firmware file."),
          );
        }
      };

      if (rawExt === ".uf2") reader.readAsArrayBuffer(file);
      else reader.readAsText(file);
    });
  }, []);

  const normalizeFirmwareFileName = useCallback(
    (artifactName, boardId, firmwarePayload) => {
      const cleaned = String(artifactName || "").trim();
      const isUf2 =
        typeof firmwarePayload === "string" &&
        firmwarePayload.startsWith(UF2_PAYLOAD_PREFIX);
      const defaultExt = isUf2 ? ".uf2" : ".hex";

      const boardStem = resolveFirmwareBoardFileStem(boardId);
      if (boardStem) {
        return `${boardStem}${defaultExt}`;
      }

      if (cleaned) {
        return /\.[a-z0-9]+$/i.test(cleaned)
          ? sanitizeDownloadStem(cleaned, "firmware") +
          cleaned.match(/\.[a-z0-9]+$/i)[0]
          : `${sanitizeDownloadStem(cleaned, "firmware")}${defaultExt}`;
      }

      return `firmware${defaultExt}`;
    },
    [resolveFirmwareBoardFileStem, sanitizeDownloadStem],
  );

  const triggerFirmwareDownload = useCallback((firmwarePayload, fileName) => {
    if (!firmwarePayload) return;

    let content = firmwarePayload;
    let mimeType = "text/plain";

    if (
      typeof firmwarePayload === "string" &&
      firmwarePayload.startsWith(UF2_PAYLOAD_PREFIX)
    ) {
      const base64 = firmwarePayload.substring(UF2_PAYLOAD_PREFIX.length);
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      content = bytes;
      mimeType = "application/octet-stream";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, []);

  const resolveStoredFirmwareArtifact = useCallback((targetBoardId = "") => {
    const normalizedBoardId = String(targetBoardId || "").trim();

    const readStoredArtifact = (storageKey) => {
      try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) || "null");
        return parsed && typeof parsed === "object" ? parsed : null;
      } catch (e) {
        return null;
      }
    };

    if (normalizedBoardId) {
      const byBoard = readStoredArtifact(
        `openhw_gdb_artifact_${normalizedBoardId}`,
      );
      if (byBoard?.firmware) {
        return {
          boardId: normalizedBoardId,
          firmware: byBoard.firmware,
          artifactName: byBoard.artifactName || byBoard.elfName || "",
        };
      }
    }

    const latest = readStoredArtifact("openhw_gdb_last_artifact");
    if (latest?.firmware) {
      const latestBoardId = String(latest.boardId || "").trim();
      if (
        !normalizedBoardId ||
        !latestBoardId ||
        latestBoardId === normalizedBoardId
      ) {
        return {
          boardId: latestBoardId || normalizedBoardId,
          firmware: latest.firmware,
          artifactName: latest.artifactName || latest.elfName || "",
        };
      }
    }

    if (!normalizedBoardId) {
      const fallback = lastCompiledRef.current?.result;
      if (fallback?.hex) {
        return {
          boardId: "latest",
          firmware: fallback.hex,
          artifactName: fallback.artifactName || "",
        };
      }
    }

    return null;
  }, []);

  const handleDownloadFirmware = useCallback(
    async (target = "__latest__") => {
      try {
        const normalizedTarget =
          String(target || "__latest__").trim() || "__latest__";

        if (normalizedTarget === "__all__") {
          const boardIds = firmwareBoardOptions.map((opt) => opt.id);

          if (boardIds.length === 0) {
            const latest = resolveStoredFirmwareArtifact("");
            if (!latest?.firmware) {
              appendConsoleEntry(
                "error",
                "No firmware available. Compile the project first.",
                "simulator",
              );
              return;
            }
            const fileName = normalizeFirmwareFileName(
              latest.artifactName,
              latest.boardId || "latest",
              latest.firmware,
            );
            triggerFirmwareDownload(latest.firmware, fileName);
            appendConsoleEntry(
              "info",
              `Firmware downloaded: ${fileName}`,
              "simulator",
            );
            return;
          }

          const missingBoards = [];
          let downloadedCount = 0;

          boardIds.forEach((boardId, idx) => {
            const artifact = resolveStoredFirmwareArtifact(boardId);
            if (!artifact?.firmware) {
              missingBoards.push(boardId);
              return;
            }

            const fileName = normalizeFirmwareFileName(
              artifact.artifactName,
              boardId,
              artifact.firmware,
            );
            setTimeout(
              () => triggerFirmwareDownload(artifact.firmware, fileName),
              idx * 120,
            );
            downloadedCount += 1;
          });

          if (downloadedCount === 0) {
            appendConsoleEntry(
              "error",
              "No board firmware found. Compile each board first.",
              "simulator",
            );
            return;
          }

          appendConsoleEntry(
            "info",
            `Downloaded firmware for ${downloadedCount} board(s).`,
            "simulator",
          );
          if (missingBoards.length > 0) {
            appendConsoleEntry(
              "warn",
              `Missing firmware for: ${missingBoards.join(", ")}`,
              "simulator",
            );
          }
          return;
        }

        const targetBoardId =
          normalizedTarget === "__latest__" ? "" : normalizedTarget;
        const artifact = resolveStoredFirmwareArtifact(targetBoardId);

        if (!artifact?.firmware) {
          const missingLabel = targetBoardId
            ? `No firmware found for ${targetBoardId}. Compile this board first.`
            : "No firmware available. Compile the project first.";
          appendConsoleEntry("error", missingLabel, "simulator");
          return;
        }

        const fileName = normalizeFirmwareFileName(
          artifact.artifactName,
          artifact.boardId || targetBoardId || "firmware",
          artifact.firmware,
        );

        triggerFirmwareDownload(artifact.firmware, fileName);
        appendConsoleEntry(
          "info",
          `Firmware downloaded: ${fileName}`,
          "simulator",
        );
      } catch (err) {
        appendConsoleEntry(
          "error",
          `Download failed: ${err.message}`,
          "simulator",
        );
      }
    },
    [
      appendConsoleEntry,
      firmwareBoardOptions,
      normalizeFirmwareFileName,
      resolveStoredFirmwareArtifact,
      triggerFirmwareDownload,
    ],
  );

  const openFirmwareDownloadDialog = useCallback(() => {
    setFirmwareDownloadTarget(firmwareBoardOptions[0]?.id || "__latest__");
    setShowFirmwareDownloadDialog(true);
  }, [firmwareBoardOptions]);

  const openFirmwareUploadDialog = useCallback(() => {
    setFirmwareUploadTarget(firmwareBoardOptions[0]?.id || "");
    setFirmwareUploadFile(null);
    setShowFirmwareUploadDialog(true);
    if (firmwareUploadInputRef.current) {
      firmwareUploadInputRef.current.value = "";
    }
  }, [firmwareBoardOptions]);

  const toggleBoardFirmwareSource = useCallback(
    (boardId, useUploaded) => {
      saveHistory();
      setComponents((prev) =>
        prev.map((comp) => {
          if (comp.id !== boardId) return comp;
          return {
            ...comp,
            attrs: {
              ...(comp.attrs || {}),
              useUploadedFirmware: !!useUploaded,
            },
          };
        }),
      );

      const label = boardComponentMap.get(boardId)?.id || boardId;
      appendConsoleEntry(
        "info",
        `Board ${label} set to use ${useUploaded ? "uploaded firmware override" : "code editor source"}.`,
        "simulator",
      );
    },
    [saveHistory, setComponents, appendConsoleEntry, boardComponentMap],
  );

  const applyUploadedFirmwareToBoard = useCallback(
    async (targetBoardId, file) => {
      if (!targetBoardId) {
        appendConsoleEntry(
          "warn",
          "Pick a board target before uploading firmware.",
          "simulator",
        );
        return;
      }
      if (!(file instanceof File)) {
        appendConsoleEntry(
          "warn",
          "Select a firmware file before uploading.",
          "simulator",
        );
        return;
      }

      const targetBoardComp = boardComponentMap.get(targetBoardId);
      if (!targetBoardComp) {
        appendConsoleEntry(
          "error",
          `Board ${targetBoardId} is no longer available on canvas.`,
          "simulator",
        );
        return;
      }

      setIsApplyingFirmwareUpload(true);
      try {
        const parsed = await parseFirmwareUploadFile(file);
        const boardKind = normalizeBoardKind(targetBoardComp.type);

        // Format validation
        if (boardKind !== "rp2040" && parsed.ext === ".uf2") {
          throw new Error(
            `Board ${targetBoardId} (${boardKind}) does not support .uf2 files. Please use a .hex file.`,
          );
        }
        if (!parsed.payload) {
          throw new Error("Firmware file is empty.");
        }

        saveHistory();
        setComponents((prev) =>
          prev.map((comp) => {
            if (comp.id !== targetBoardId) return comp;
            return {
              ...comp,
              attrs: {
                ...(comp.attrs || {}),
                firmwareHex: parsed.payload,
                hex: parsed.payload,
                firmwareArtifactName: String(parsed.fileName || ""),
                useUploadedFirmware: true, // Auto-enable on upload
              },
            };
          }),
        );

        lastCompiledRef.current = null;

        const boardLabel = boardCompToDisplayName(targetBoardComp, boardKind);
        const firmwareKind = parsed.ext === ".uf2" ? "UF2" : "HEX";
        appendConsoleEntry(
          "info",
          `Assigned ${firmwareKind} firmware (${parsed.fileName}) to ${boardLabel}. Now using uploaded override.`,
          "simulator",
        );

        setFirmwareUploadFile(null);
        if (firmwareUploadInputRef.current) {
          firmwareUploadInputRef.current.value = "";
        }
      } catch (err) {
        appendConsoleEntry(
          "error",
          `Firmware upload failed: ${err?.message || "Unknown error"}`,
          "simulator",
        );
      } finally {
        setIsApplyingFirmwareUpload(false);
      }
    },
    [
      appendConsoleEntry,
      boardComponentMap,
      parseFirmwareUploadFile,
      saveHistory,
      setComponents,
    ],
  );

  const handleStartGDB = () => {
    appendConsoleEntry("info", "Connecting to GDB Session...", "simulator");
    // Note: requires backend running wokwi-gdbserver (e.g. gdbserver.js) on port 3333
    appendConsoleEntry(
      "info",
      "Opening local GDB session on http://localhost:3333...",
      "simulator",
    );
    window.open("http://localhost:3333", "_blank");
  };

  /** Open the save dialog. Pre-fills with the current project name. */
  const handleSave = () => {
    setSaveDialogName(currentProjectName || "Untitled");
    setShowSaveDialog(true);
  };

  /** Commit the save from the dialog. */
  const handleConfirmSave = async () => {
    const name = saveDialogName.trim() || "Untitled";
    const owner = getOwner();
    let id = currentProjectIdRef.current;
    if (!id) {
      id = generateProjectId();
      currentProjectIdRef.current = id;
      setCurrentProjectId(id);
    }
    clearTimeout(autoSaveTimerRef.current);
    const finalName = await saveProject({
      id,
      name,
      board,
      components,
      connections: wires,
      code,
      blocklyXml,
      blocklyGeneratedCode,
      useBlocklyCode,
      projectFiles,
      openCodeTabs,
      activeCodeFileId,
      owner,
    });
    setCurrentProjectName(finalName || name);
    setShowSaveDialog(false);
    setTimeout(() => captureThumbnailRef.current?.(), 1500);
  };

  /** Create a brand-new blank project. */
  const handleNewProject = () => {
    if (components.length > 0 || wires.length > 0) {
      if (
        !window.confirm(
          "Start a new project? Unsaved changes will be auto-saved first.",
        )
      )
        return;
    }
    const id = generateProjectId();
    currentProjectIdRef.current = id;
    setCurrentProjectId(id);
    setCurrentProjectName("Untitled");
    setBoard("arduino_uno");
    setCode(
      "void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(15000);\n  digitalWrite(13, LOW);\n  delay(15000);\n}\n",
    );
    setComponents([]);
    setWires([]);
    setBlocklyXml("");
    setProjectFiles([]);
    setOpenCodeTabs([]);
    setActiveCodeFileId("");
    setHistory({ past: [], future: [] });
    lastCompiledRef.current = null;
  };

  /** Load a project from the My Projects modal. */
  const handleLoadProject = (proj) => {
    if (isRunning) return;
    const normalizedCircuit = normalizeImportedCircuitData(
      proj.components,
      proj.connections,
    );
    const normalizedFiles = normalizeProjectFiles(proj.projectFiles);
    const normalizedTabs = normalizeOpenCodeTabs(
      proj.openCodeTabs,
      normalizedFiles,
    );
    const preferredActive = String(proj.activeCodeFileId || "").trim();
    const activeId = normalizedFiles.some((f) => f.id === preferredActive && f.id !== "project/diagram.json")
      ? preferredActive
      : normalizedTabs.find((t) => t !== "project/diagram.json") || normalizedFiles.find((f) => f.id !== "project/diagram.json")?.id || "";
    setBoard(proj.board || "arduino_uno");
    setCode(proj.code || "");
    setBlocklyXml(proj.blocklyXml || "");
    setBlocklyGeneratedCode(proj.blocklyGeneratedCode || "");
    setUseBlocklyCode(!!proj.useBlocklyCode);
    setComponents(normalizedCircuit.components);
    setWires(normalizedCircuit.wires);
    setProjectFiles(normalizedFiles);
    setOpenCodeTabs(normalizedTabs);
    setActiveCodeFileId(activeId);
    if (activeId) openCodeFile(activeId);
    syncNextIds(normalizedCircuit.components, normalizedCircuit.wires);
    setCurrentProjectId(proj.id);
    currentProjectIdRef.current = proj.id;
    setCurrentProjectName(proj.name || "Untitled");
    setHistory({ past: [], future: [] });
    lastCompiledRef.current = null;
    setShowProjectsSidebar(false);
    setTimeout(() => captureThumbnailRef.current?.(), 1500);
  };

  /** Delete a project from the My Projects modal. */
  const handleDeleteProject = async (id) => {
    if (!window.confirm("Delete this project? This cannot be undone.")) return;
    await deleteProject(id, getOwner());
    if (currentProjectIdRef.current === id) {
      currentProjectIdRef.current = null;
      setCurrentProjectId(null);
      setCurrentProjectName("Untitled");
    }
    await refreshProjectList();
  };

  // ─── Inline Rename ─────────────────────────────────────────────────────────
  const handleStartRename = (proj, e) => {
    e.stopPropagation();
    setRenamingProjectId(proj.id);
    setRenameValue(proj.name || "Untitled");
  };
  const handleConfirmRename = async (id) => {
    if (!id) {
      setRenamingProjectId(null);
      return;
    }
    const newName = renameValue.trim() || "Untitled";
    const finalName = await renameProject(id, newName, getOwner());
    if (currentProjectIdRef.current === id)
      setCurrentProjectName(finalName || newName);
    setRenamingProjectId(null);
    await refreshProjectList();
  };

  const toggleFavourite = (id) => {
    setFavouriteProjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleCopyProject = async (proj) => {
    const newId = generateProjectId();
    const newName = (proj.name || "Untitled") + " Copy";
    const projectData = {
      ...proj,
      id: newId,
      name: newName,
      savedAt: Date.now(),
    };
    await saveProject(projectData);
    await refreshProjectList();
  };

  // ─── Backup / Restore ──────────────────────────────────────────────────────
  const handleBackupWorkflow = async () => {
    const zip = new JSZip();

    // 1. Generate full project payload (workflow.json)
    const data = buildProjectPayload({
      name: currentProjectName,
      board,
      components,
      wires,
      code,
      blocklyXml,
      blocklyGeneratedCode,
      useBlocklyCode,
      projectFiles,
      openCodeTabs,
      activeCodeFileId,
      exportedAt: new Date().toISOString(),
    });
    zip.file("workflow.json", JSON.stringify(data, null, 2));

    // 2. Generate diagram.json (stripped version of payload)
    const diagramJsonPayload = { ...data };
    delete diagramJsonPayload.schemaVersion;
    delete diagramJsonPayload.projectFiles;
    delete diagramJsonPayload.openCodeTabs;
    delete diagramJsonPayload.activeCodeFileId;
    delete diagramJsonPayload.exportedAt;
    if (diagramJsonPayload.board === "arduino_uno")
      delete diagramJsonPayload.board;
    if (
      !diagramJsonPayload.components ||
      diagramJsonPayload.components.length === 0
    )
      delete diagramJsonPayload.components;
    if (
      !diagramJsonPayload.connections ||
      diagramJsonPayload.connections.length === 0
    )
      delete diagramJsonPayload.connections;
    if (!diagramJsonPayload.blocklyXml) delete diagramJsonPayload.blocklyXml;
    delete diagramJsonPayload.blocklyGeneratedCode;
    if (!diagramJsonPayload.useBlocklyCode)
      delete diagramJsonPayload.useBlocklyCode;
    zip.file("diagram.json", JSON.stringify(diagramJsonPayload, null, 2));

    // 4. Organize files into board-specific folders
    (projectFiles || []).forEach((file) => {
      // file.id is typically "project/<boardId>/<filename>"
      const parts = file.id.split("/");
      if (parts[0] === "project" && parts.length >= 3) {
        const boardId = parts[1];
        const fileName = parts.slice(2).join("/");
        zip.folder(boardId).file(fileName, file.content || "");
      } else if (parts[0] === "project" && parts.length === 2) {
        // Root files that aren't the special ones we just handled
        const fileName = parts[1];
        const reservedNames = ["workflow.json", "diagram.json"];
        if (!reservedNames.includes(fileName)) {
          zip.file(fileName, file.content || "");
        }
      }
    });

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentProjectName || "workflow"}-backup.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const handleRestoreWorkflow = async (file) => {
    if (!file) return;
    try {
      const zip = await JSZip.loadAsync(file);
      const wf = zip.file("workflow.json");
      if (!wf) {
        alert("Invalid backup: workflow.json not found.");
        return;
      }
      const json = JSON.parse(await wf.async("string"));
      if (
        (components.length > 0 || wires.length > 0) &&
        !window.confirm(
          "Restore backup? Current unsaved changes will be replaced.",
        )
      )
        return;
      const normalizedCircuit = normalizeImportedCircuitData(
        json.components,
        Array.isArray(json.connections) ? json.connections : json.wires,
      );
      const normalizedFiles = normalizeProjectFiles(
        Array.isArray(json.projectFiles) ? json.projectFiles : [],
      );
      const normalizedTabs = normalizeOpenCodeTabs(
        Array.isArray(json.openCodeTabs) ? json.openCodeTabs : [],
        normalizedFiles,
      );
      const preferredActive = String(json.activeCodeFileId || "").trim();
      const activeId = normalizedFiles.some((f) => f.id === preferredActive && f.id !== "project/diagram.json")
        ? preferredActive
        : normalizedTabs.find((t) => t !== "project/diagram.json") || normalizedFiles.find((f) => f.id !== "project/diagram.json")?.id || "";
      setBoard(json.board || "arduino_uno");
      setCode(json.code || "");
      setBlocklyXml(json.blocklyXml || "");
      setBlocklyGeneratedCode(json.blocklyGeneratedCode || "");
      setUseBlocklyCode(!!json.useBlocklyCode);
      setComponents(normalizedCircuit.components);
      setWires(normalizedCircuit.wires);
      setProjectFiles(normalizedFiles);
      setOpenCodeTabs(normalizedTabs);
      setActiveCodeFileId(activeId);
      if (activeId) openCodeFile(activeId);
      syncNextIds(normalizedCircuit.components, normalizedCircuit.wires);
      setCurrentProjectName(json.name || "Untitled");
      setHistory({ past: [], future: [] });
      lastCompiledRef.current = null;
    } catch (e) {
      alert("Failed to restore backup: " + e.message);
    }
  };

  const handleImportWokwiZip = async (file) => {
    if (!file) return;
    try {
      const result = await importWokwiProjectZip(file, components, wires);
      if (!result) return;

      const newId = generateProjectId();
      currentProjectIdRef.current = newId;
      setCurrentProjectId(newId);
      setCurrentProjectName(result.projectName);
      setBoard(result.board);
      setComponents(result.components);
      setWires(result.wires);
      setProjectFiles(result.projectFiles);
      setOpenCodeTabs(result.openCodeTabs);
      setActiveCodeFileId(result.activeCodeFileId);
      syncNextIds(result.components, result.wires);
      setHistory({ past: [], future: [] });
      lastCompiledRef.current = null;

      const owner = getOwner();
      const finalName = await saveProject({
        id: newId,
        name: result.projectName,
        board: result.board,
        components: result.components,
        connections: result.wires,
        code: result.code || "",
        blocklyXml: "",
        blocklyGeneratedCode: "",
        useBlocklyCode: false,
        projectFiles: result.projectFiles,
        openCodeTabs: result.openCodeTabs,
        activeCodeFileId: result.activeCodeFileId,
        owner,
      });
      setCurrentProjectName(finalName || result.projectName);
      await refreshProjectList();
    } catch (e) {
      alert(e.message);
    }
  };

  // ─── Cloud Sync (placeholder) ───────────────────────────────────────────────
  const handleSyncToCloud = () => {
    alert("Sync feature coming soon!");
  };

  const handleGenerateShareUrl = async () => {
    setIsSharingSimulation(true);
    try {
      // 1. Save the project to Cloud & IndexedDB first
      const name = currentProjectName || "Untitled";
      const owner = getOwner();
      let id = currentProjectIdRef.current;
      if (!id) {
        id = generateProjectId();
        currentProjectIdRef.current = id;
        setCurrentProjectId(id);
      }
      clearTimeout(autoSaveTimerRef.current);
      const finalName = await saveProject({
        id,
        name,
        board,
        components,
        connections: wires,
        code,
        blocklyXml,
        blocklyGeneratedCode,
        useBlocklyCode,
        projectFiles,
        openCodeTabs,
        activeCodeFileId,
        owner,
      });
      setCurrentProjectName(finalName || name);
      await refreshProjectList();
      setTimeout(() => captureThumbnailRef.current?.(), 1500);

      // 2. Create the Shared Simulation snapshot with chosen visibility
      const response = await createSharedSimulation({
        name: finalName || name || "Untitled",
        isPublic: shareVisibility === "public",
        parentProjectId: shareLinkType === "live" ? id : "",
        board,
        components,
        connections: wires,
        code,
        projectFiles,
        openCodeTabs,
        activeCodeFileId,
      });

      const url = `${window.location.origin}/simulator/share/${response.shareId}`;
      setShareUrl(url);
      setShareCopied(false);

      // 3. Update browser address bar to the shared simulation link
      justSharedRef.current = response.shareId;
      navigate(`/simulator/share/${response.shareId}`);

      return url;
    } catch (error) {
      console.error("Failed to share simulation", error);
      alert(
        error?.response?.data?.message ||
        error.message ||
        "Failed to share simulation.",
      );
      return "";
    } finally {
      setIsSharingSimulation(false);
    }
  };

  const handleShareSimulation = async () => {
    console.log(
      "[SimulatorPage] handleShareSimulation - activeUser:",
      activeUser,
    );
    if (!["teacher", "user", "admin"].includes(activeUser?.role)) {
      alert("Only signed-in teachers and users can share simulator templates.");
      return;
    }

    if (!isAnyAuthenticated) {
      alert("Please sign in to share this simulation.");
      navigate("/login");
      return;
    }

    if (shareId) {
      setShareUrl(`${window.location.origin}/simulator/share/${shareId}`);
    } else {
      setShareUrl("");
    }
    setShareCopied(false);
    setShareVisibility("public");
    setShareLinkType("snapshot");
    setShowShareDialog(true);
  };

  const handleShareVisibilityChange = (val) => {
    setShareVisibility(val);
    setShareUrl("");
  };

  const handleShareLinkTypeChange = (val) => {
    setShareLinkType(val);
    setShareUrl("");
  };

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
    } catch (error) {
      console.error("Failed to copy share URL", error);
      alert("Failed to copy share URL.");
    }
  };

  // ─── Simulator Run & Stop Logic ─────────────────────────────────────────────

  const logCompileSummary = useCallback(
    (compiledResult, boardComp, boardKind) => {
      const summaryLines = extractCompileSummaryLines(
        compiledResult?.stdout || "",
      );
      if (summaryLines.length === 0) return;

      const boardLabel = boardCompToDisplayName(boardComp, boardKind);
      summaryLines.forEach((line) => {
        appendConsoleEntry("info", `[${boardLabel}] ${line}`, "simulator");
      });
    },
    [appendConsoleEntry],
  );

  const registerGdbArtifact = useCallback(
    (boardId, boardKind, compiledResult) => {
      const compiled =
        compiledResult && typeof compiledResult === "object"
          ? compiledResult
          : null;
      if (!compiled || !boardId) return;

      const elfPayload = typeof compiled.elf === "string" ? compiled.elf : "";
      const gdbMeta =
        compiled.gdb && typeof compiled.gdb === "object" ? compiled.gdb : null;
      if (!elfPayload && !gdbMeta) return;

      const artifact = {
        boardId,
        boardKind,
        ts: Date.now(),
        elf: elfPayload,
        elfName: compiled.elfName || "",
        firmware: compiled.hex || "",
        artifactType: compiled.artifactType || "",
        gdb: gdbMeta,
      };

      try {
        localStorage.setItem(
          `openhw_gdb_artifact_${boardId}`,
          JSON.stringify(artifact),
        );
        localStorage.setItem(
          "openhw_gdb_last_artifact",
          JSON.stringify(artifact),
        );
      } catch (e) {
        // ignore storage failures
      }

      const gdbName = gdbMeta?.gdb || "gdb-multiarch";
      const remoteTarget = gdbMeta?.targetRemote || "localhost:3333";
      const elfLabel = artifact.elfName ? ` (${artifact.elfName})` : "";
      appendConsoleEntry(
        "info",
        `GDB artifact ready for ${boardId}: ${gdbName} -> target remote ${remoteTarget}${elfLabel}`,
        "debug",
      );
      appendConsoleEntry(
        "info",
        "Web GDB reference: https://wokwi.github.io/web-gdb/",
        "debug",
      );
    },
    [appendConsoleEntry],
  );

  const buildValidationSignature = useCallback(() => {
    const normalizedComponents = (components || [])
      .map((comp) => ({
        id: comp?.id || "",
        type: comp?.type || "",
        attrs: comp?.attrs || {},
      }))
      .sort((a, b) => `${a.id}|${a.type}`.localeCompare(`${b.id}|${b.type}`));

    const normalizedWires = (wires || [])
      .map((wire) => ({
        from: String(wire?.from || ""),
        to: String(wire?.to || ""),
      }))
      .sort((a, b) => `${a.from}|${a.to}`.localeCompare(`${b.from}|${b.to}`));

    return JSON.stringify({
      components: normalizedComponents,
      wires: normalizedWires,
      activeCodeFileId: activeCodeFileId || "",
      code: (useBlocklyCode || codeTab === 'block') ? blocklyGeneratedCode || code || "" : code || "",
    });
  }, [
    components,
    wires,
    activeCodeFileId,
    useBlocklyCode,
    codeTab,
    blocklyGeneratedCode,
    code,
  ]);

  const runCircuitValidation = useCallback(
    (overriddenComponents, overriddenWires) => {
      try {
        if (isRunning) return true;

        const targetComponents = overriddenComponents || components;
        const targetWires = overriddenWires || wires;

        // Skip signature check if we are forcing a validation with overridden state
        if (!overriddenComponents && !overriddenWires) {
          const validationSignature = buildValidationSignature();
          const cachedValidation = validationRunCacheRef.current;
          if (cachedValidation.signature === validationSignature) {
            setValidationErrors(cachedValidation.errors || []);
            setValidationToast(cachedValidation.toast || null);
            setHealthScore(
              Number.isFinite(cachedValidation.healthScore)
                ? cachedValidation.healthScore
                : 100,
            );
            if ((cachedValidation.errors || []).length > 0) {
              setShowValidation(true);
              if (typeof setIsPanelOpen === "function") setIsPanelOpen(true);
            }
            return cachedValidation.allowRun !== false;
          }
        }

        const projectData = {
          components: targetComponents,
          connections: targetWires,
          code: (useBlocklyCode || codeTab === 'block') ? blocklyGeneratedCode || code || "" : code || "",
          activeCodeFileId,
        };

        // USE UNIFIED ENGINE (Locally)
        const { safe, physicsSafe, errors, healthScore } = runUnifiedValidation(
          projectData,
          {
            profile: "balanced",
            incremental: true,
            incrementalScope: "webui",
            registry: EmulatorComponents, // Pass the full component library for rule discovery
          },
        );

        setHealthScore(healthScore);
        setValidationErrors(errors);

        const hasFatalPhysics = errors.some(
          (e) => e.severity === "error" || e.type === "error",
        );
        const allowRun = physicsSafe && !hasFatalPhysics; // Block if physics is unsafe (short circuit etc)

        let nextToast = null;
        if (!safe) {
          if (errors.length > 0 && showAutofix) {
            triggerAutofixAnalysis(errors, targetComponents, targetWires);
          }
          setShowValidation(true);
          if (typeof setIsPanelOpen === "function") setIsPanelOpen(true);

          nextToast = {
            title: hasFatalPhysics ? `🛑 Circuit Error` : `⚠️ Circuit Warning`,
            reasons: errors.slice(0, 3).map((e) => e.message),
          };
          setValidationToast(nextToast);
        } else {
          setValidationToast(null);
        }

        validationRunCacheRef.current = {
          signature: overriddenComponents
            ? "invalidated"
            : buildValidationSignature(),
          allowRun,
          errors,
          healthScore,
          toast: nextToast,
        };

        return allowRun;
      } catch (err) {
        console.warn("[Validation] Engine failed, continuing run:", err);
        return true;
      }
    },
    [
      components,
      wires,
      code,
      useBlocklyCode,
      blocklyGeneratedCode,
      activeCodeFileId,
      isRunning,
      buildValidationSignature,
    ],
  );

  const applyFix = useCallback(
    async (error) => {
      if (!error.remediation && !error.ruleId) {
        appendConsoleEntry(
          "warn",
          "⚠️ Cannot fix: No remediation found",
          "simulator",
        );
        return;
      }

      saveHistory();
      const projectData = { components, connections: wires };
      const circuitBefore = JSON.parse(JSON.stringify(projectData));

      // Apply the fix using enhanced fixer
      const result = sharedApplyCircuitFix(projectData, error, {
        appliedBy: "webui",
      });

      if (!result.applied) {
        appendConsoleEntry(
          "warn",
          `⚠️ Fix not applied: ${result.reason || "Check circuit connectivity"}`,
          "simulator",
        );
        return;
      }

      // Update the circuit
      setComponents(result.components);
      setWires(result.connections);

      // Log applied fix
      const fixDesc =
        result.appliedFixes?.[0]?.description || error.remediation;
      appendConsoleEntry("info", `🔧 Applied: ${fixDesc}`, "simulator");

      // CRITICAL: Clear validation cache so next run re-validates from scratch
      validationRunCacheRef.current = {};

      // Re-run validation to verify the fix worked
      try {
        const validator = new FullCircuitValidator({
          components: result.components,
          connections: result.connections,
        });
        const verifyResult = await validator.runValidation({
          profile: "balanced",
          incrementalScope: "webui",
        });

        const errorStillExists = verifyResult.errors?.some(
          (e) => (e.id || e.ruleId) === (error.id || error.ruleId),
        );

        const newErrors =
          verifyResult.errors?.filter(
            (newErr) =>
              !validationErrors.some(
                (oldErr) =>
                  (oldErr.id || oldErr.ruleId) === (newErr.id || newErr.ruleId),
              ),
          ) || [];

        if (!errorStillExists) {
          if (newErrors.length === 0) {
            appendConsoleEntry(
              "success",
              `✅ Fix successful! Error resolved.`,
              "simulator",
            );
          } else {
            const errorCount = newErrors.filter(
              (e) => e.severity === "error",
            ).length;
            const warnCount = newErrors.filter(
              (e) => e.severity === "warn",
            ).length;
            appendConsoleEntry(
              "warn",
              `✅ Original error fixed, but introduced ${errorCount} error(s) and ${warnCount} warning(s). Review changes.`,
              "simulator",
            );
          }
        } else {
          appendConsoleEntry(
            "error",
            `❌ Fix did not resolve the error. Try a different approach.`,
            "simulator",
          );
        }
      } catch (verifyErr) {
        console.warn(
          "[Verification] Revalidation failed after fix:",
          verifyErr,
        );
        appendConsoleEntry(
          "info",
          `✅ Applied: ${fixDesc} (verification skipped)`,
          "simulator",
        );
      }
    },
    [components, wires, saveHistory, validationErrors],
  );

  // Autofix preview/apply-all integration
  // Unified project change application (shared by Autofix and future Autowiring engines)
  const applyProjectChangePlan = useCallback(
    (plan) => {
      if (!plan) return;

      // Set for verification loop
      if (plan.targetRuleId) {
        setPendingVerificationRule(plan.targetRuleId);
      }

      // Calculate the new project state using the centralized utility
      const { components: nextComponents, wires: nextWires } =
        calculateProjectPlanApplication(
          plan,
          components,
          wires,
          LOCAL_PIN_DEFS,
        );

      setComponents(nextComponents);
      setWires(nextWires);
      saveHistory();

      appendConsoleEntry(
        "info",
        `🔧 Project Plan Applied: ${plan.addedComponents?.length || 0} components, ${plan.addedWires?.length || 0} wires.`,
        "simulator",
      );

      // Force re-validation after fix to continue "Speak & Hear" loop
      // We pass nextComponents/nextWires directly to bypass React's async state update
      setTimeout(async () => {
        validationRunCacheRef.current = {}; // Clear cache

        // 1) Trigger Local Simulator Validation check against new topology
        runCircuitValidation(nextComponents, nextWires);

        appendConsoleEntry(
          "info",
          "📡 Re-validating circuit after repair...",
          "simulator",
        );
      }, 150);
    },
    [components, wires, saveHistory, appendConsoleEntry, runCircuitValidation],
  );

  const handleApplyPlan = useCallback(() => {
    if (!autofixPlan) return;
    applyProjectChangePlan(autofixPlan);
    setAutofixPlan(null); // Clear preview
  }, [autofixPlan, applyProjectChangePlan]);

  const getSerialTimestamp = () => {
    const now = new Date();
    return (
      now.toTimeString().slice(0, 8) +
      "." +
      String(now.getMilliseconds()).padStart(3, "0")
    );
  };

  const parseSerialForPlotter = useCallback((chunk) => {
    serialPlotBufferRef.current += chunk;
    const lines = serialPlotBufferRef.current.split("\n");
    if (lines.length <= 1) return;

    const completeLines = lines.slice(0, -1);
    serialPlotBufferRef.current = lines[lines.length - 1];

    completeLines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // 1. Key:Value format (e.g., "Temperature:24.5" or "Temp: 24.5, Humidity: 60.0")
      if (trimmed.includes(':')) {
        const pairs = trimmed.split(/[,\t]+/).filter(Boolean);
        const parsedVars = {};
        let validPairCount = 0;

        pairs.forEach(pair => {
          const colonIdx = pair.indexOf(':');
          if (colonIdx > 0) {
            const label = pair.slice(0, colonIdx).trim();
            const valStr = pair.slice(colonIdx + 1).trim();
            const val = parseFloat(valStr);
            if (label && /^[A-Za-z0-9_ -]+$/.test(label) && !isNaN(val)) {
              parsedVars[label] = val;
              validPairCount++;
            }
          }
        });

        if (validPairCount > 0) {
          const labels = Object.keys(parsedVars);
          labels.forEach(lbl => {
            if (!serialPlotLabelsRef.current.includes(lbl)) {
              serialPlotLabelsRef.current.push(lbl);
            }
          });
          latestParsedSerialRef.current = Object.values(parsedVars);
          return;
        }
      }

      // 2. Purely numeric values (e.g. "24.5, 60.0" or "24.5 60.0")
      const parts = trimmed.split(/[,\s\t]+/).filter(Boolean);
      if (parts.length === 0) return;

      const isNumeric = parts.every((p) => !isNaN(parseFloat(p)));
      if (isNumeric) {
        latestParsedSerialRef.current = parts.map((p) => parseFloat(p));
        if (serialPlotLabelsRef.current.length < parts.length) {
          for (let i = serialPlotLabelsRef.current.length; i < parts.length; i++) {
            serialPlotLabelsRef.current.push(`SVar${i}`);
          }
        }
        return;
      }

      // 3. Potential Header Line (e.g. "Temperature, Humidity")
      // Ignore text lines if they contain sentence punctuation (!, ?, ., ;, etc.) or error log words
      const hasSentencePunctuation = /[!?.;"']/.test(trimmed);
      const isCleanHeader = parts.length <= 8 && parts.every(p => /^[A-Za-z0-9_\-]+$/.test(p));
      const hasLogWords = /^(failed|error|warning|info|connecting|connected|initializing|setup|reading|booting)$/i.test(parts[0]);

      if (!hasSentencePunctuation && isCleanHeader && !hasLogWords) {
        serialPlotLabelsRef.current = parts;
      }
    });
  }, []);

  const appendSerialRxChunk = useCallback(
    (chunk, boardId = "default", source = "sim") => {
      const normalizedBoardId = String(boardId || "default");
      const normalizedSource = String(source || "sim");
      const nowMs = Date.now();
      const arbState = serialIngressArbitrationRef.current.get(
        normalizedBoardId,
      ) || { source: "", lastAcceptedAt: 0 };

      if (!arbState.source) {
        arbState.source = normalizedSource;
      } else if (arbState.source !== normalizedSource) {
        const recentlyAccepted =
          nowMs - Number(arbState.lastAcceptedAt || 0) <= 240;
        // Keep one ingress stream active per board for a short window to avoid
        // USB/UART mirrored duplicate output bursts from RP2040 firmware.
        if (recentlyAccepted) {
          return;
        }
        arbState.source = normalizedSource;
      }

      arbState.lastAcceptedAt = nowMs;
      serialIngressArbitrationRef.current.set(normalizedBoardId, arbState);

      parseSerialForPlotter(chunk);
      const ts = getSerialTimestamp();

      if (!isRunning) {
        // If simulation is not running (e.g. static debug output), update state immediately
        setSerialHistory((prev) => {
          let next =
            prev.length > 2000 ? prev.slice(prev.length - 1800) : [...prev];
          if (next.length > 0) {
            const last = next[next.length - 1];
            if (
              last.dir === "rx" &&
              last.boardId === normalizedBoardId &&
              last.source === normalizedSource &&
              !last.text.endsWith("\n")
            ) {
              next[next.length - 1] = { ...last, text: last.text + chunk };
              return next;
            }
          }
          return [
            ...next,
            {
              dir: "rx",
              text: chunk,
              ts,
              boardId: normalizedBoardId,
              source: normalizedSource,
            },
          ];
        });
      } else {
        // Queue serial output chunks to batch-update state and prevent main-thread re-render choking
        pendingSerialLogsRef.current.push({
          chunk,
          boardId: normalizedBoardId,
          source: normalizedSource,
          ts,
        });
      }
    },
    [parseSerialForPlotter, isRunning],
  );

  const pushSerialRxChunk = useCallback(
    (chunk, boardId = "default", source = "sim") => {
      if (serialPausedRef.current) {
        const queue = serialPausedQueueRef.current;
        queue.push({ chunk, boardId, source });
        if (queue.length > 1000) {
          queue.splice(0, queue.length - 1000);
        }
        return;
      }
      appendSerialRxChunk(chunk, boardId, source);
    },
    [appendSerialRxChunk],
  );

  useEffect(() => {
    pushSerialRxChunkRef.current = pushSerialRxChunk;
  }, [pushSerialRxChunk]);

  useEffect(() => {
    if (serialPaused) return;
    const queue = serialPausedQueueRef.current;
    if (!queue.length) return;

    const pending = queue.splice(0, queue.length);
    pending.forEach((entry) => {
      appendSerialRxChunk(entry.chunk, entry.boardId, entry.source);
    });
  }, [serialPaused, appendSerialRxChunk]);

  const flushSerialLogs = useCallback(() => {
    const logsToFlush = pendingSerialLogsRef.current;
    if (logsToFlush.length === 0) return;
    pendingSerialLogsRef.current = [];

    setSerialHistory((prev) => {
      let next = prev.length > 2000 ? prev.slice(prev.length - 1800) : [...prev];

      logsToFlush.forEach(({ chunk, boardId, source, ts }) => {
        if (next.length > 0) {
          const last = next[next.length - 1];
          if (
            last.dir === "rx" &&
            last.boardId === boardId &&
            last.source === source &&
            !last.text.endsWith("\n")
          ) {
            next[next.length - 1] = { ...last, text: last.text + chunk };
            return;
          }
        }
        next.push({
          dir: "rx",
          text: chunk,
          ts,
          boardId,
          source,
        });
      });

      if (next.length > 2000) {
        next = next.slice(next.length - 1800);
      }
      return next;
    });
  }, []);

  // Periodic flush loop to batch-update console logs every 100ms
  useEffect(() => {
    if (!isRunning) {
      if (pendingSerialLogsRef.current.length > 0) {
        flushSerialLogs();
      }
      return;
    }

    const interval = setInterval(() => {
      flushSerialLogs();
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, flushSerialLogs]);

  const pushSerialTxLine = useCallback(
    (text, boardId = "all", source = "sim") => {
      setSerialHistory((prev) => [
        ...prev,
        { dir: "tx", text, ts: getSerialTimestamp(), boardId, source },
      ]);
    },
    [],
  );

  const clearSerialMonitor = useCallback(() => {
    setSerialHistory([]);
    serialPlotBufferRef.current = "";
    serialPlotLabelsRef.current = [];
    latestParsedSerialRef.current = [];
    serialIngressArbitrationRef.current.clear();
    serialPausedQueueRef.current = [];
  }, []);

  const handleHardwareBoardChange = useCallback(
    (nextBoardId) => {
      setHardwareBoardId(nextBoardId);
      if (nextBoardId) setSelected(nextBoardId);
    },
    [setSelected],
  );

  const resolveBoardHex = useCallback(
    async (boardComp) => {
      if (!boardComp) throw new Error("No board selected for upload.");
      const kind = normalizeBoardKind(boardComp.type);
      const fqbn = resolveBoardFqbnForComponent(boardComp, kind);
      const boardHex = boardComp?.attrs?.firmwareHex || boardComp?.attrs?.hex;
      if (typeof boardHex === "string" && boardHex.trim()) return boardHex;

      const compileUnit = getBoardCompileFiles(boardComp.id);
      if (!compileUnit.hasMainFile) {
        throw new Error(`No enabled .ino file found for ${boardComp.id}. Enable at least one .ino file before uploading.`);
      }
      const sourceCode = compileUnit.mainCode || '';
      const cacheKeyBoard = `${kind}:${boardComp.id}`;
      const rp2040Builder = resolveComponentAttrString(boardComp?.attrs, 'builder', 'arduino-pico') || 'arduino-pico';
      const buildEngine = kind === 'rp2040' ? rp2040Builder : 'arduino-cli';

      const libFile = (projectFiles || []).find(f => f.path === `project/${boardComp.id}/library.txt`);
      const librariesTxt = libFile
        ? (libFile.id === activeCodeFileId ? code : (libFile.content || ''))
        : '';

      const cacheSource = [
        sourceCode,
        ...compileUnit.files.map((f) => `${f.name}\n${f.content || ''}`),
        fqbn,
        buildEngine,
        librariesTxt,
        'targetEngine:hardware'
      ].join('\n/*__SPLIT__*/\n');

      let compiled = await getCachedHex(cacheSource, cacheKeyBoard);
      if (!compiled) {
        if (kind === 'esp32') {
          const startRes = await startEsp32Compile({
            code: sourceCode,
            libraries_txt: librariesTxt,
            targetEngine: 'hardware'
          });
          if (!startRes || (!startRes.jobId && !startRes.buildId)) {
            throw new Error('Failed to start ESP32 compilation.');
          }
          const jobId = startRes.jobId || startRes.buildId;
          let pollCount = 0;
          while (true) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const statusRes = await getEsp32CompileStatus(jobId);
            if (!statusRes) continue;

            if (statusRes.status === 'success') {
              if (!statusRes.binary_content) {
                throw new Error('Compilation succeeded but no binary content was returned.');
              }
              compiled = { hex: statusRes.binary_content };
              break;
            } else if (statusRes.status === 'failed') {
              throw new Error(statusRes.error || 'ESP32 compilation failed.');
            }

            pollCount++;
            if (pollCount > 180) {
              throw new Error('ESP32 compilation timed out after 90 seconds.');
            }
          }
        } else {
          compiled = await compileCode({
            code: sourceCode,
            files: compileUnit.files,
            sketchName: compileUnit.sketchName,
            fqbn,
            target: kind,
            libraries_txt: librariesTxt,
            ...(kind === 'rp2040' ? { builder: rp2040Builder } : {}),
          });
        }
        setCachedHex(cacheSource, cacheKeyBoard, compiled);
      }
      return compiled.hex;
    }, [getBoardCompileFiles, projectFiles, activeCodeFileId, code]);

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
    resolveBoardFqbn: resolveBoardFqbnForComponent,
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

    const deviceLabel = String(resolvedHardwarePort || "").trim();
    const nextTarget = deviceLabel
      ? `hw:${deviceLabel}`
      : hardwareBoardId
        ? `hw:${hardwareBoardId}`
        : "hw:connected";

    setHardwareSerialTargetId(nextTarget);
    hardwareSerialTargetRef.current = nextTarget;
  }, [hardwareConnected, resolvedHardwarePort, hardwareBoardId]);

  const handleUploadToHardware = useCallback(async () => {
    // RUN VALIDATION BEFORE FLASHING
    appendConsoleEntry(
      "info",
      "🔍 Validating circuit health before hardware flash...",
      "hardware",
    );
    if (!runCircuitValidation()) {
      appendConsoleEntry(
        "error",
        "❌ Flash blocked: The circuit has electrical/safety violations. Fix them first.",
        "hardware",
      );
      setHardwareStatus("Flash blocked: validation failed");
      return;
    }

    // Disconnect browser Web Serial first to release COM port lock for arduino-cli upload.
    if (hardwareConnected) {
      setHardwareStatus("Disconnecting Web Serial before flash...");
      appendConsoleEntry(
        "info",
        "Disconnecting Web Serial to release port for flashing...",
        "hardware",
      );
      await disconnectHardwareSerial();
      await new Promise(r => setTimeout(r, 3500));
    }

    await uploadToHardware({
      wasConnected: hardwareConnected,
      disconnectFn: disconnectHardwareSerial,
      connectFn: connectHardwareSerial,
    });
  }, [
    hardwareConnected,
    disconnectHardwareSerial,
    connectHardwareSerial,
    uploadToHardware,
    setHardwareStatus,
    appendConsoleEntry,
    runCircuitValidation,
  ]);

  const handleRun = async (options = {}) => {
    try {
      if (runStartGuardRef.current || isRunning || isCompiling) {
        appendConsoleEntry("info", "Run is already in progress.", "simulator");
        return;
      }

      runStartGuardRef.current = true;

      // 1. Unified Validation Gate (BLOCKING)
      appendConsoleEntry(
        "info",
        "🔍 Validating circuit health...",
        "simulator",
      );
      if (!runCircuitValidation()) {
        appendConsoleEntry(
          "error",
          "❌ Run blocked: The circuit has electrical or safety violations.",
          "simulator",
        );
        runStartGuardRef.current = false;
        return;
      }
      appendConsoleEntry(
        "info",
        "✅ Circuit validated. Initializing simulation...",
        "simulator",
      );

      appendConsoleEntry("info", "Run requested.", "simulator");
      rp2040GdbLastLogRef.current.clear();
      rp2040WirelessLastLogRef.current.clear();
      rp2040UartMicroPythonBoardsRef.current.clear();
      rp2040UartSilentWarnedBoardsRef.current.clear();
      serialIngressArbitrationRef.current.clear();
      serialPausedQueueRef.current = [];
      runComponentUpdateCountsRef.current = {};
      runPinTransitionCountsRef.current = {};
      runLagTelemetryLastStateRef.current.clear();
      runLagTelemetryLastLogRef.current.clear();
      runFpsTelemetryLastLogRef.current.clear();
      runLastBoardPinsRef.current = new Map();

      setIsCompiling(true);
      setRunStartedAtMs(Date.now());
      setRunDurationSec(0);
      const parsedRunBaud = Number(serialBaudRate);
      const selectedRunBaud = Number.isFinite(parsedRunBaud)
        ? parsedRunBaud
        : Number(
          BOARD_DEFAULT_BAUD[selectedSerialBoardKind] ||
          BOARD_DEFAULT_BAUD.arduino_uno,
        );
      const selectedRunBoardId =
        serialBoardFilter !== "all" && serialBoardMap.has(serialBoardFilter)
          ? serialBoardFilter
          : "";
      const boardHexMap = {};
      const boardPythonMap = {};
      const boardPythonFilesMap = {};
      const boardRuntimeEnvMap = {};
      const boardBaudMap = {};
      const programmableBoards = components.filter(c => /(arduino|esp32|stm32|rp2040|pico)/i.test(c.type));
      const hasEsp32 = programmableBoards.some(c => normalizeBoardKind(c.type) === 'esp32');
      if (hasEsp32) {
        const engineText = esp32SimulationMode === 'frontend' ? 'Frontend Engine' : 'Backend QEMU';
        console.log(`[SimulatorPage] Selected ESP32 Emulation Engine: ${engineText}`);
        appendConsoleEntry('info', `Selected ESP32 Emulation Engine: ${engineText}`, 'simulator');
      }

      const isBackendProxy = await startEsp32Session(programmableBoards);
      const singleProgrammableBoardId =
        programmableBoards.length === 1 ? programmableBoards[0]?.id : "";
      const boardsWithoutCompilableSketch = [];
      let result = null;

      if (!result && canvasOnly && readOnly && projectName) {
        // 1. Check precompiledBinaries.js (statically imported hex data)
        const { getPrecompiledBinary } = await import("../../services/precompiledBinaries.js");
        const precompiled = getPrecompiledBinary(projectName);
        if (precompiled?.hex) {
          appendConsoleEntry("info", `Using pre-compiled firmware for ${projectName}.`, "simulator");
          result = { hex: precompiled.hex };
          for (const boardComp of programmableBoards) {
            const kind = normalizeBoardKind(boardComp.type);
            boardHexMap[boardComp.id] = precompiled.hex;
            boardBaudMap[boardComp.id] = Number(
              boardBaudRates[boardComp.id] || BOARD_DEFAULT_BAUD[kind] || 115200,
            );
          }
        }

        // 2. Fall back to localStorage cache (compiled on a prior visit)
        if (!result) {
          const { getGuidedHex } = await import("../../services/guidedProjectHexes.js");
          const cachedHex = getGuidedHex(projectName);
          if (cachedHex) {
            appendConsoleEntry("info", `Using cached firmware for ${projectName}.`, "simulator");
            result = { hex: cachedHex };
            for (const boardComp of programmableBoards) {
              const kind = normalizeBoardKind(boardComp.type);
              boardHexMap[boardComp.id] = cachedHex;
              boardBaudMap[boardComp.id] = Number(
                boardBaudRates[boardComp.id] || BOARD_DEFAULT_BAUD[kind] || 115200,
              );
            }
          }
        }
      }

      if (isBackendProxy) {
        result = {
          hex: "",
          components: components,
          connections: wires,
        };
      } else if (!result && programmableBoards.length > 0) {
        for (const boardComp of programmableBoards) {
          const kind = normalizeBoardKind(boardComp.type);
          const targetFqbn = resolveBoardFqbnForComponent(boardComp, kind);
          const defaultBaud = Number(
            BOARD_DEFAULT_BAUD[kind] || BOARD_DEFAULT_BAUD.arduino_uno,
          );
          boardBaudMap[boardComp.id] = Number(
            boardBaudRates[boardComp.id] || selectedRunBaud,
          );

          const useUploaded = !!boardComp?.attrs?.useUploadedFirmware;
          const uploadedFirmware = useUploaded
            ? String(
              resolveComponentAttrString(
                boardComp?.attrs,
                "firmwareHex",
                "",
              ) || resolveComponentAttrString(boardComp?.attrs, "hex", ""),
            ).trim()
            : "";

          if (useUploaded && uploadedFirmware) {
            boardHexMap[boardComp.id] = uploadedFirmware;
            const uploadKind = uploadedFirmware.startsWith(UF2_PAYLOAD_PREFIX)
              ? "UF2"
              : "HEX";
            appendConsoleEntry(
              "info",
              `Using uploaded ${uploadKind} firmware for ${boardCompToDisplayName(boardComp, kind)}.`,
              "simulator",
            );
            if (!result) {
              result = {
                hex: uploadedFirmware,
                artifactName: normalizeFirmwareFileName(
                  "",
                  boardComp.id,
                  uploadedFirmware,
                ),
              };
            }
            continue;
          } else if (useUploaded && !uploadedFirmware) {
            appendConsoleEntry(
              "warn",
              `Board ${boardComp.id} is set to use uploaded firmware, but none is assigned. Falling back to code editor.`,
              "simulator",
            );
          }

          const firmwareAssets = getBoardFirmwareAssets(boardComp.id);
          const activeFilePath = String(activeCodeFile?.path || "");
          const activeFileExt = fileExt(activeFilePath);
          const activeFileContent = String(code || "");
          const activeBoardFile = activeFilePath.startsWith(
            `project/${boardComp.id}/`,
          )
            ? activeCodeFile
            : null;
          const activeFileTargetsBoard =
            !!activeBoardFile || singleProgrammableBoardId === boardComp.id;
          const activeBoardExt = activeBoardFile
            ? fileExt(activeBoardFile.path)
            : "";
          const activePythonSource =
            activeFileExt === ".py" &&
              activeFileTargetsBoard &&
              !isFileDisabled(activeFilePath)
              ? activeBoardFile
                ? String(activeBoardFile.content || "")
                : activeFileContent
              : "";
          const boardEnabledFiles = projectFiles
            .filter((f) => f.path.startsWith(`project/${boardComp.id}/`))
            .filter((f) => !isFileDisabled(f.path));
          const boardEnabledPyFiles = boardEnabledFiles.filter(
            (f) => fileExt(f.path) === ".py",
          );
          const pythonSource =
            activePythonSource || String(firmwareAssets.mainPy?.content || "");
          const hasPythonSource =
            boardEnabledPyFiles.some((f) => String(f.content || "").trim()) ||
            !!pythonSource.trim();
          const activePrefersIno =
            activeFileExt === ".ino" && activeFileTargetsBoard;
          const activePrefersPy =
            activeFileExt === ".py" && activeFileTargetsBoard;
          const preferredMainPath =
            activeBoardExt === ".ino" &&
              activeBoardFile &&
              !isFileDisabled(activeBoardFile.path)
              ? activeBoardFile.path
              : "";
          const compileUnit = getBoardCompileFiles(
            boardComp.id,
            preferredMainPath,
          );
          const compileSource = useBlocklyCode
            ? blocklyGeneratedCode
            : activeFileExt === ".py" && activeFileTargetsBoard
              ? String(activeCodeFile?.content || "") || String(code || "")
              : compileUnit.mainCode ||
              getBoardMainCode(boardComp.id) ||
              String(code || "");

          if (kind !== "rp2040" && !compileUnit.hasMainFile) {
            boardsWithoutCompilableSketch.push(boardComp.id);
            continue;
          }

          // ── RP2040: emulate UF2 on rp2040js and boot user files from flash filesystem ──
          if (kind === "rp2040") {
            const configuredEnv = normalizeRp2040Env(
              resolveComponentAttrString(boardComp?.attrs, "env", "native"),
            );
            boardRuntimeEnvMap[boardComp.id] = configuredEnv;

            const configuredMode =
              configuredEnv === "native" ? "ino" : configuredEnv;
            const configuredBuilder =
              resolveComponentAttrString(
                boardComp?.attrs,
                "builder",
                "arduino-pico",
              ) || "arduino-pico";
            const hasNativeSketch =
              compileUnit.hasMainFile ||
              (activePrefersIno && !!compileSource.trim());
            const hasExplicitPython = activePrefersPy || hasPythonSource;
            const prefersNativeFromSyntax =
              /\bvoid\s+setup\s*\(|\bvoid\s+loop\s*\(|#include\s*</.test(
                String(compileSource || ""),
              );
            const selectedSourceMode = resolveRp2040SourceMode({
              configuredMode,
              activePrefersIno,
              activePrefersPy,
              hasNativeSketch,
              hasPythonSource: hasExplicitPython,
              prefersNativeFromSyntax,
            });
            const useMicroPythonPath = selectedSourceMode === "py";
            const useCircuitPythonPath = selectedSourceMode === "cp";
            const usePythonPath = useMicroPythonPath || useCircuitPythonPath;

            if (selectedSourceMode === "ino" && !hasNativeSketch) {
              const msg = `RP2040 source mode is set to .ino for ${boardComp.id}, but no enabled .ino sketch was found.`;
              appendConsoleEntry("warn", msg, "simulator");
              logSerial(msg, "var(--orange)");
              boardsWithoutCompilableSketch.push(boardComp.id);
              continue;
            }

            if (usePythonPath) {
              const runtimeEnv = useCircuitPythonPath
                ? "circuitpython"
                : "micropython";
              const entryFileName = getRp2040PythonEntryFileName(runtimeEnv);
              const firmwareEntryPy =
                runtimeEnv === "circuitpython"
                  ? (firmwareAssets.pythonFiles || []).find(
                    (f) => String(f.name || "").toLowerCase() === "code.py",
                  )
                  : firmwareAssets.mainPy;

              let pyToRun =
                String(firmwareEntryPy?.content || "").trim() ||
                pythonSource.trim();
              if (!pyToRun && looksLikeMicroPythonSource(compileSource)) {
                pyToRun = compileSource;
              }
              if (!pyToRun && runtimeEnv === "micropython") {
                pyToRun = arduinoSerialToMicroPython(
                  compileSource,
                  boardComp.id,
                );
              }
              if (!pyToRun && runtimeEnv === "micropython") {
                pyToRun = arduinoBlinkToMicroPython(
                  compileSource,
                  boardComp.id,
                );
              }
              if (!pyToRun) {
                pyToRun = createDefaultMainCode("rp2040", boardComp.id, {
                  rp2040Mode: runtimeEnv,
                });
              }

              if (runtimeEnv === "micropython") {
                pyToRun = applyRp2040MicroPythonCompat(pyToRun);
              }

              const runtimeFiles = {};
              boardEnabledFiles.forEach((fileObj) => {
                const ext = fileExt(fileObj.path);
                if (!ext) return;
                if (ext === ".uf2") return;
                if (ARDUINO_CODE_EXTENSIONS.has(ext)) return;

                const relPath = toBoardRelativePath(boardComp.id, fileObj.path);
                if (!relPath) return;

                const fileContent =
                  fileObj.id === activeCodeFileId
                    ? String(code || "")
                    : String(fileObj.content || "");
                runtimeFiles[relPath] = fileContent;
              });

              if (!String(runtimeFiles[entryFileName] || "").trim()) {
                runtimeFiles[entryFileName] = pyToRun;
              }

              const rp2040Firmware =
                firmwareAssets.uf2Payload ||
                (runtimeEnv === "circuitpython"
                  ? await fetchDefaultCircuitPythonUf2Payload()
                  : await fetchDefaultMicroPythonUf2Payload());
              boardHexMap[boardComp.id] = rp2040Firmware;
              boardPythonMap[boardComp.id] = pyToRun;
              boardPythonFilesMap[boardComp.id] = runtimeFiles;

              const runtimeLabel =
                runtimeEnv === "circuitpython"
                  ? "CircuitPython"
                  : "MicroPython";
              appendConsoleEntry(
                "info",
                `RP2040 running via rp2040js + ${runtimeLabel} flash filesystem on ${boardComp.id} (env: ${configuredEnv}).`,
                "simulator",
              );
              if (!result) result = { hex: rp2040Firmware || "" };
              continue;
            }

            const nativeCompileSource =
              prepareRp2040SketchForSimulation(compileSource);
            if (nativeCompileSource !== compileSource) {
              appendConsoleEntry(
                "info",
                `RP2040: routed Serial output to UART0 monitor for ${boardComp.id}.`,
                "simulator",
              );
            }

            const libFile = (projectFiles || []).find(f => f.path === `project/${boardComp.id}/library.txt`);
            const librariesTxt = libFile
              ? (libFile.id === activeCodeFileId ? code : (libFile.content || ''))
              : '';

            const cacheKeyBoard = `${kind}:${boardComp.id}`;
            const builder = configuredBuilder;
            const cacheSource = [
              RP2040_SIM_PROTOCOL_VERSION,
              builder,
              configuredMode,
              targetFqbn,
              nativeCompileSource,
              ...compileUnit.files.map((f) => `${f.name}\n${f.content || ''}`),
              librariesTxt,
            ].join('\n/*__SPLIT__*/\n');

            appendConsoleEntry(
              "info",
              `Compiling for ${boardCompToDisplayName(boardComp, kind)}...`,
              "simulator",
            );
            let compiled = await getCachedHex(cacheSource, cacheKeyBoard);
            if (compiled) {
              logSerial(`Using cached compilation for ${boardComp.id}...`);
            } else {
              logSerial(`Compiling ${boardComp.id}...`);
              try {
                compiled = await compileCode({
                  code: nativeCompileSource,
                  files: compileUnit.files,
                  sketchName: compileUnit.sketchName,
                  fqbn: targetFqbn,
                  target: kind,
                  builder,
                  libraries_txt: librariesTxt,
                });
                setCachedHex(cacheSource, cacheKeyBoard, compiled);
              } catch (compileErr) {
                const errStr = String(
                  compileErr?.message || compileErr || "",
                ).toLowerCase();
                const isRpCoreMissing =
                  errStr.includes("platform 'rp2040:rp2040' not found") ||
                  errStr.includes("platform rp2040:rp2040 is not found") ||
                  errStr.includes("platform not installed");
                if (isRpCoreMissing) {
                  appendConsoleEntry(
                    "error",
                    `RP2040 core is not installed for ${boardComp.id}. Native .ino mode cannot run without Arduino-Pico core.`,
                    "simulator",
                  );
                }
                throw compileErr;
              }
            }

            boardHexMap[boardComp.id] = compiled.hex;
            logCompileSummary(compiled, boardComp, kind);
            registerGdbArtifact(boardComp.id, kind, compiled);
            appendConsoleEntry(
              "info",
              `RP2040 native firmware compiled and running on ${boardComp.id}.`,
              "simulator",
            );
            if (!result) result = compiled;
            continue;
          }

          const libFile = (projectFiles || []).find(f => f.path === `project/${boardComp.id}/library.txt`);
          const librariesTxt = libFile
            ? (libFile.id === activeCodeFileId ? code : (libFile.content || ''))
            : '';

          const cacheKeyBoard = `${kind}:${boardComp.id}`;
          const cacheSource = [
            compileSource,
            targetFqbn,
            ...compileUnit.files.map((f) => `${f.name}\n${f.content || ''}`),
            librariesTxt,
            kind === 'esp32' ? esp32SimulationMode : '',
          ].join('\n/*__SPLIT__*/\n');

          appendConsoleEntry(
            "info",
            `Compiling for ${boardCompToDisplayName(boardComp, kind)}...`,
            "simulator",
          );
          let compiled = await getCachedHex(cacheSource, cacheKeyBoard);
          if (compiled) {
            logSerial(`Using cached compilation for ${boardComp.id}...`);
          } else {
            logSerial(`Compiling ${boardComp.id}...`);
            try {
              if (kind === 'esp32' && esp32SimulationMode === 'frontend') {
                const startRes = await startEsp32Compile({
                  code: compileSource,
                  libraries_txt: librariesTxt,
                  targetEngine: 'frontend'
                });

                if (!startRes || (!startRes.jobId && !startRes.buildId)) {
                  throw new Error('Failed to start ESP32 compilation.');
                }

                if (startRes.cache === 'hit') {
                  logSerial(`Using server-cached compilation for ${boardComp.id}...`);
                }

                const jobId = startRes.jobId || startRes.buildId;
                let pollCount = 0;
                let lastPrintedProgressLen = 0;

                while (true) {
                  await new Promise(resolve => setTimeout(resolve, 500));
                  const statusRes = await getEsp32CompileStatus(jobId);

                  if (!statusRes) continue;

                  const progressLines = statusRes.progress || [];
                  if (progressLines.length > lastPrintedProgressLen) {
                    for (let i = lastPrintedProgressLen; i < progressLines.length; i++) {
                      logSerial(progressLines[i]);
                    }
                    lastPrintedProgressLen = progressLines.length;
                  }

                  if (statusRes.status === 'success') {
                    if (!statusRes.binary_content) {
                      throw new Error('Compilation succeeded but no binary content was returned.');
                    }
                    compiled = {
                      hex: statusRes.binary_content,
                      stdout: statusRes.stdout || '',
                      stderr: statusRes.stderr || ''
                    };
                    break;
                  } else if (statusRes.status === 'failed') {
                    const errMsg = statusRes.error || 'ESP32 compilation failed.';
                    throw new Error(errMsg);
                  }

                  pollCount++;
                  if (pollCount > 180) {
                    throw new Error('ESP32 compilation timed out after 90 seconds.');
                  }
                }
              } else {
                compiled = await compileCode({
                  code: compileSource,
                  files: compileUnit.files,
                  sketchName: compileUnit.sketchName,
                  fqbn: targetFqbn,
                  target: kind,
                  libraries_txt: librariesTxt,
                });
              }
              setCachedHex(cacheSource, cacheKeyBoard, compiled);
            } catch (compileErr) {
              throw compileErr;
            }
          }

          boardHexMap[boardComp.id] = compiled.hex;
          logCompileSummary(compiled, boardComp, kind);
          registerGdbArtifact(boardComp.id, kind, compiled);
          if (!result) result = compiled;
        }
      }

      if (!result && programmableBoards.length > 0) {
        const blockedMsg =
          boardsWithoutCompilableSketch.length > 0
            ? `Run blocked: no enabled .ino sketch found for ${boardsWithoutCompilableSketch.join(", ")}.`
            : "Run blocked: no firmware was produced for programmable boards.";
        appendConsoleEntry("warn", blockedMsg, "simulator");
        logSerial(blockedMsg, "var(--orange)");
        setIsCompiling(false);
        setIsRunning(false);
        setRunStartedAtMs(null);
        setRunDurationSec(0);
        runStartGuardRef.current = false;
        return;
      }

      if (!result) {
        const finalCode = useBlocklyCode ? blocklyGeneratedCode : code;
        const fallbackKind = normalizeBoardKind(board);
        const engine = fallbackKind === 'rp2040' ? 'arduino-pico' : 'arduino-cli';

        const libFile = (projectFiles || []).find(f => f.path.endsWith('/library.txt') || f.name === 'library.txt');
        const librariesTxt = libFile
          ? (libFile.id === activeCodeFileId ? code : (libFile.content || ''))
          : '';

        const cacheStr = [finalCode, engine, librariesTxt].join('\n/*__SPLIT__*/\n');
        appendConsoleEntry('info', `Compiling for ${boardKindToDisplayName(fallbackKind)}...`, 'simulator');

        const cached = await getCachedHex(cacheStr, board);
        if (cached) {
          logSerial("Using locally cached compilation (offline cache)...");
          result = cached;
        } else {
          logSerial("Compiling...");
          result = await compileCode({
            code: finalCode,
            fqbn: BOARD_FQBN[fallbackKind] || BOARD_FQBN.arduino_uno,
            target: fallbackKind,
            libraries_txt: librariesTxt,
            ...(fallbackKind === 'rp2040' ? { builder: 'arduino-pico' } : {}),
          });
          setCachedHex(cacheStr, board, result);
          registerGdbArtifact(board || "default", fallbackKind, result);
        }
        logCompileSummary(result, null, fallbackKind);
      }

      lastCompiledRef.current = { code, board, result };
      setIsCompiling(false);

      if (canvasOnly && readOnly && projectName && result?.hex) {
        const { setGuidedHex } = await import("../../services/guidedProjectHexes.js");
        setGuidedHex(projectName, result.hex);
      }

      if (!isBackendProxy) {
        setIsRunning(true);
        setIsBooting(true);
      }
      logSerial(
        isBackendProxy
          ? "Backend connected! Starting physics worker..."
          : "Compiled! Connecting to emulator...",
      );

      // ── Render Worker: create before sim worker so port is ready ──────────
      const renderWorker = new Worker(
        new URL("../../worker/display.render.worker.ts", import.meta.url),
        { type: "module" },
      );
      renderWorkerRef.current = renderWorker;
      setRenderWorker(renderWorker); // Triggers Provider re-render so display UIs receive the worker
      if (typeof window !== "undefined") {
        window.__displayRenderWorker = renderWorker;
        window.dispatchEvent(
          new CustomEvent("display-render-worker-changed", {
            detail: renderWorker,
          }),
        );
      }

      // Set up a MessageChannel so the Simulation Worker can post display frames
      // directly to the Render Worker — zero-copy, no main-thread involvement.
      const { port1: simPort, port2: renderPort } = new MessageChannel();
      // Give port1 to the Render Worker (it listens for DISPLAY_FRAME here)
      renderWorker.postMessage({ type: "SET_SIM_PORT", port: renderPort }, [
        renderPort,
      ]);

      // Load Simulation Web Worker
      const worker = new Worker(
        new URL("../../worker/simulation.worker.ts", import.meta.url),
        { type: "module" },
      );
      workerRef.current = worker;
      // Give port2 to the Simulation Worker (it sends DISPLAY_FRAME here)
      worker.postMessage({ type: "SET_RENDER_PORT", port: simPort }, [simPort]);

      // ── Network Worker: isolated WiFi/IP stack ─────────────────────────────
      // Create a dedicated network worker so DNS/TCP/UDP I/O is completely
      // isolated from the RP2040 CPU simulation loop — zero-copy frame transfers.
      try {
        const netWorker = new Worker(
          new URL('../../workers/network.worker.ts', import.meta.url),
          { type: 'module', name: 'OpenHW-NetWorker' }
        );
        const { port1: simNetPort, port2: netWorkerPort } = new MessageChannel();
        // Give the network worker its command port (receives START_BOARD, FRAME_OUT, etc.)
        netWorker.postMessage({ type: 'SET_NET_PORT', port: netWorkerPort }, [netWorkerPort]);
        // Give the sim worker a port to forward Ethernet frames to the network worker
        // and receive FRAME_IN / WIFI_STATUS / PCAP_DATA back
        worker.postMessage({ type: 'SET_NET_PORT', port: simNetPort }, [simNetPort]);
        // Announce any WiFi AP components that are already on the canvas
        const wifiApComponents = components.filter(c => c.type === 'openhw-wifi-ap' || c.type === 'wokwi-wifi-ap');
        for (const ap of wifiApComponents) {
          netWorker.postMessage({
            type: 'ANNOUNCE_AP',
            componentId: ap.id,
            ssid: ap.attrs?.ssid ?? 'OpenHW-GUEST',
            password: ap.attrs?.password ?? '',
            channel: Number(ap.attrs?.channel ?? 6),
            internet: String(ap.attrs?.internet ?? '1') !== '0',
          });
        }
        console.log('[SimPage] Network Worker started and linked to simulation worker');
      } catch (netErr) {
        console.warn('[SimPage] Network Worker failed to start (WiFi will be in-process):', netErr);
      }

      worker.onmessage = async (event) => {
        const msg = event.data;
        const msgArrivalMs = performance.now();

        if (msg.type === "error") {
          appendConsoleEntry(
            "error",
            `[SIM] ${msg.message || "Runner error"}`,
            "simulator",
          );
          logSerial(
            `Runner error: ${msg.message || "Unknown error"}`,
            "var(--red)",
          );
          handleStop();
          return;
        }

        if (msg.type === "toast") {
          setValidationToast({
            level: msg.level || "info",
            message: msg.message,
          });
          return;
        }

        if (msg.type === "TEACHER_KEY_CAPTURE_COMPLETE") {
          appendConsoleEntry("info", "Visual telemetry capture complete! Compiling WASM binary...", "simulator");

          // Spin up a temporary grading worker to bundle the WASM key
          const GradingWorker = (await import("../../worker/grading-engine.worker.ts?worker")).default;
          const grader = new GradingWorker();

          grader.onmessage = (ge) => {
            const gMsg = ge.data;
            if (gMsg.type === 'KEY_GENERATED') {
              const blob = new Blob([gMsg.key], { type: "application/octet-stream" });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              anchor.href = url;
              // Use the requested naming format: [board]_[component].bin
              anchor.download = `${msg.board}_${msg.component}.bin`;
              anchor.click();
              setTimeout(() => URL.revokeObjectURL(url), 1500);
              appendConsoleEntry("info", `Teacher reference key downloaded: ${anchor.download}`, "simulator");
              grader.terminate();
            } else if (gMsg.type === 'LOG') {
              console.log("[Grader for TeacherKey]", gMsg.msg);
            }
          };

          grader.postMessage({
            type: 'GENERATE_KEY_FROM_TELEMETRY',
            projectJson: msg.projectJson,
            telemetry: msg.telemetry
          });
          return;
        }

        if (
          msg.type === "state" ||
          (msg.type === "debug" && msg.category === "rp2040-runtime")
        ) {
          if (!isBackendProxy) {
            setIsBooting(false);
          }
        }

        if (msg.type === "debug" && msg.category === "rp2040-runtime") {
          const incomingBoardId = String(msg.boardId || "").trim();
          const hasKnownBoard =
            incomingBoardId &&
            boardComponents.some((b) => b.id === incomingBoardId);
          const singleBoardFallback =
            boardComponents.length === 1 ? boardComponents[0]?.id : "";
          const resolvedBoardId = hasKnownBoard
            ? incomingBoardId
            : singleBoardFallback || incomingBoardId || "default";

          const metrics = msg.metrics || {};
          const reason = String(msg.reason || "tick");
          const pc = Number(metrics.pc);
          const sp = Number(metrics.sp);
          const gp20 = !!metrics.gp20;
          const gp25 = !!metrics.gp25;
          const tx = Number(metrics.serialTxBytes || 0);
          const rx = Number(metrics.serialRxBytes || 0);
          const inq = Number(metrics.serialInputQueue || 0);
          const cycles = Number(metrics.cycles || 0);
          const steps = Number(metrics.stepCount || 0);
          const stall = Number(metrics.pcStallTicks || 0);
          const running = !!metrics.running;
          const entry =
            metrics.entry && typeof metrics.entry === "object"
              ? metrics.entry
              : null;
          const ledId = String(metrics.ledId || "").trim();
          const ledOn =
            typeof metrics.ledOn === "boolean" ? metrics.ledOn : null;
          const ledAnodeV = Number.isFinite(Number(metrics.ledAnodeV))
            ? Number(metrics.ledAnodeV)
            : null;
          const ledCathodeV = Number.isFinite(Number(metrics.ledCathodeV))
            ? Number(metrics.ledCathodeV)
            : null;
          const ledDeltaV = Number.isFinite(Number(metrics.ledDeltaV))
            ? Number(metrics.ledDeltaV)
            : null;
          const primask = !!metrics.primask;
          const stepsSinceLastEmit = Number(metrics.stepsSinceLastEmit || 0);

          const pcHex = Number.isFinite(pc)
            ? `0x${(pc >>> 0).toString(16)}`
            : "n/a";
          const spHex = Number.isFinite(sp)
            ? `0x${(sp >>> 0).toString(16)}`
            : "n/a";
          const entryVectorHex = Number.isFinite(Number(entry?.vectorBase))
            ? `0x${(Number(entry.vectorBase) >>> 0).toString(16)}`
            : "n/a";
          const entryResolvedHex = Number.isFinite(Number(entry?.resolvedPC))
            ? `0x${(Number(entry.resolvedPC) >>> 0).toString(16)}`
            : "n/a";

          const debugBoardComp =
            components.find((c) => c.id === resolvedBoardId) ||
            boardComponents.find((b) => b.id === resolvedBoardId);
          const isRp2040DebugBoard =
            normalizeBoardKind(debugBoardComp?.type || "") === "rp2040";
          const startupFallbackEntry =
            reason === "start" && !!entry?.usedFallback;
          if (startupFallbackEntry && isRp2040DebugBoard) {
            appendConsoleEntry(
              "warn",
              `RP2040 startup vector fallback detected on ${resolvedBoardId}; automatic recovery is disabled in deterministic mode.`,
              "simulator",
            );
            logSerial(
              `RP2040 startup fallback on ${resolvedBoardId}. Automatic recovery is disabled in deterministic mode.`,
              "var(--orange)",
            );
          }

          const isUartMicroPythonBoard =
            rp2040UartMicroPythonBoardsRef.current.has(resolvedBoardId);
          const queueDrained = inq <= 0;
          const shouldWarnUartSilent =
            reason === "tick" &&
            isUartMicroPythonBoard &&
            tx === 0 &&
            rx >= 512 &&
            (queueDrained || rx >= 2048) &&
            stall >= 3 &&
            cycles >= 120_000_000 &&
            !rp2040UartSilentWarnedBoardsRef.current.has(resolvedBoardId);

          if (shouldWarnUartSilent) {
            rp2040UartSilentWarnedBoardsRef.current.add(resolvedBoardId);
            appendConsoleEntry(
              "warn",
              `RP2040 MicroPython UART injection appears silent on ${resolvedBoardId} (tx=0, rx=${rx}, inq=${inq}, stall=${stall}). Check script startup logs and wiring.`,
              "simulator",
            );
            logSerial(
              `RP2040 ${resolvedBoardId}: UART injection is silent (tx=0, rx=${rx}, inq=${inq}). Verify script startup and board wiring.`,
              "var(--orange)",
            );
          }

          const prev =
            rp2040DebugLastLogRef.current.get(resolvedBoardId) || null;
          const now = Date.now();
          const changed =
            !prev ||
            prev.pcHex !== pcHex ||
            prev.gp20 !== gp20 ||
            prev.gp25 !== gp25 ||
            prev.tx !== tx ||
            prev.rx !== rx ||
            prev.ledOn !== ledOn ||
            prev.ledDeltaV !== ledDeltaV ||
            reason !== "tick";

          const highPins = Array.isArray(metrics.highPins)
            ? metrics.highPins
            : [];
          const highPinsLabel =
            highPins.length > 0
              ? `${highPins.slice(0, 12).join(",")}${highPins.length > 12 ? ",+" : ""}`
              : "-";
          const pinBitmap =
            typeof metrics.pinBitmap === "string" ? metrics.pinBitmap : "";

          if (changed || now - (prev?.ts || 0) > 2500) {
            const line = [
              `RP2040 dbg ${resolvedBoardId}`,
              `reason=${reason}`,
              `run=${running ? "1" : "0"}`,
              `pc=${pcHex}`,
              `sp=${spHex}`,
              `cyc=${cycles}`,
              `steps=${steps}`,
              `gp20=${gp20 ? "H" : "L"}`,
              `gp25=${gp25 ? "H" : "L"}`,
              `uart=${metrics.activeUart ?? "n/a"}`,
              `usb=${metrics.usbCdcReady ? "1" : "0"}`,
              `tx=${tx}`,
              `rx=${rx}`,
              `inq=${inq}`,
              `stall=${stall}`,
              Number.isFinite(Number(metrics.lastRunLoopMs))
                ? `loop=${Number(metrics.lastRunLoopMs).toFixed(2)}ms`
                : "",
              Number.isFinite(Number(metrics.lastPhysicsMs))
                ? `phys=${Number(metrics.lastPhysicsMs).toFixed(2)}ms`
                : "",
              Number.isFinite(Number(metrics.lastComponentUpdateMs))
                ? `comp=${Number(metrics.lastComponentUpdateMs).toFixed(2)}ms`
                : "",
              `pri=${primask ? "1" : "0"}`,
              `dSteps=${stepsSinceLastEmit}`,
              `high=${highPinsLabel}`,
              pinBitmap ? `pins=${pinBitmap}` : "",
              entry
                ? `entry=${entryVectorHex}->${entryResolvedHex}${entry.usedFallback ? ":fallback" : ""}${entry.strategy ? `:${entry.strategy}` : ""}`
                : "",
              entry && Number.isFinite(Number(entry.probe0100SP))
                ? `probe0100=sp:0x${(Number(entry.probe0100SP) >>> 0).toString(16)},pc:0x${(Number(entry.probe0100PC) >>> 0).toString(16)}`
                : "",
              entry && Number.isFinite(Number(entry.probe0000SP))
                ? `probe0000=sp:0x${(Number(entry.probe0000SP) >>> 0).toString(16)},pc:0x${(Number(entry.probe0000PC) >>> 0).toString(16)}`
                : "",
              ledId
                ? `led=${ledId}:${ledOn === null ? "n/a" : ledOn ? "on" : "off"}`
                : "",
              ledAnodeV !== null ? `vA=${ledAnodeV.toFixed(2)}` : "",
              ledCathodeV !== null ? `vK=${ledCathodeV.toFixed(2)}` : "",
              ledDeltaV !== null ? `dV=${ledDeltaV.toFixed(2)}` : "",
              metrics.lastGpioPin ? `lastPin=${metrics.lastGpioPin}` : "",
            ]
              .filter(Boolean)
              .join(" | ");

            const warn = reason === "fault" || stall > 180;
            appendConsoleEntry(warn ? "warn" : "info", line, "debug");
            rp2040DebugLastLogRef.current.set(resolvedBoardId, {
              ts: now,
              pcHex,
              gp20,
              gp25,
              tx,
              rx,
              ledOn,
              ledDeltaV,
            });
          }

          return;
        }
        // ── Network Worker: real WiFi stack status (from dedicated network worker) ──
        if (msg.type === 'wifi_status') {
          const resolvedBoardId = String(msg.boardId || '').trim() || 'default';
          const status = String(msg.status || 'idle');
          const ssid = String(msg.ssid || '');
          const ip = String(msg.ip || '');
          const packets = Number(msg.packetCount || 0);
          const connected = status === 'connected' || status === 'got_ip';

          liveOopStatesRef.current[resolvedBoardId] = {
            ...(liveOopStatesRef.current[resolvedBoardId] || {}),
            wirelessMode: 'full',
            wirelessStatus: status,
            wirelessConnected: connected,
            wirelessSsid: ssid,
            wirelessIp: ip,
            wirelessPackets: packets,
          };
          notifyLiveOopStateListeners(resolvedBoardId);

          // Log status changes to console (deduplicated)
          const sig = `${status}:${ssid}:${ip}`;
          const lastSig = rp2040WirelessLastLogRef.current.get(resolvedBoardId);
          if (lastSig !== sig) {
            rp2040WirelessLastLogRef.current.set(resolvedBoardId, sig);
            const emoji = status === 'got_ip' ? '🌐' : status === 'connected' ? '📶' : '📡';
            appendConsoleEntry(
              connected ? 'info' : 'warn',
              `${emoji} Pico W WiFi [${resolvedBoardId}] status=${status} ssid=${ssid || '-'} ip=${ip || '-'} packets=${packets}`,
              'debug',
            );
          }
          return;
        }
        // ── Network Worker: PCAP file download ────────────────────────────────────
        if (msg.type === 'wifi_pcap') {
          const boardId = String(msg.boardId || 'board');
          const data = msg.data instanceof ArrayBuffer ? new Uint8Array(msg.data) : null;
          if (data) {
            let binary = '';
            for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]);
            const url = `data:application/vnd.tcpdump.pcap;base64,${btoa(binary)}`;
            const a = document.createElement('a');
            a.href = url;
            a.download = `picow_${boardId}.pcap`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            appendConsoleEntry('info', `📥 PCAP downloaded: picow_${boardId}.pcap (${data.length} bytes)`, 'simulator');
          }
          return;
        }
        if (msg.type === 'debug' && msg.category === 'rp2040-wireless-stub') {
          const incomingBoardId = String(msg.boardId || '').trim();
          const hasKnownBoard = incomingBoardId && boardComponents.some((b) => b.id === incomingBoardId);
          const singleBoardFallback = boardComponents.length === 1 ? boardComponents[0]?.id : '';
          const resolvedBoardId = hasKnownBoard
            ? incomingBoardId
            : singleBoardFallback || incomingBoardId || "default";

          const wireless =
            msg.wireless && typeof msg.wireless === "object"
              ? msg.wireless
              : {};
          const mode = String(wireless.mode || "compat-stub");
          const status = String(
            wireless.status || (mode === "off" ? "off" : "booting"),
          );
          const connected = !!wireless.connected;
          const ssid = String(wireless.ssid || "");
          const ip = String(wireless.ip || "");
          const note = String(wireless.note || "");

          liveOopStatesRef.current[resolvedBoardId] = {
            ...(liveOopStatesRef.current[resolvedBoardId] || {}),
            wirelessMode: mode,
            wirelessStatus: status,
            wirelessConnected: connected,
            wirelessSsid: ssid,
            wirelessIp: ip,
            wirelessNote: note,
          };
          notifyLiveOopStateListeners(resolvedBoardId);

          const signature = `${mode}:${status}:${connected ? "1" : "0"}:${ssid}:${ip}`;
          const lastSignature =
            rp2040WirelessLastLogRef.current.get(resolvedBoardId);
          if (lastSignature !== signature) {
            const line = [
              `Pico W wireless ${resolvedBoardId}`,
              `mode=${mode}`,
              `status=${status}`,
              `connected=${connected ? "1" : "0"}`,
              `ssid=${ssid || "-"}`,
              `ip=${ip || "-"}`,
              note,
            ]
              .filter(Boolean)
              .join(" | ");
            appendConsoleEntry(
              connected || status === "off" ? "info" : "warn",
              line,
              "debug",
            );
            rp2040WirelessLastLogRef.current.set(resolvedBoardId, signature);
          }
          return;
        }
        if (msg.type === "debug" && msg.category === "rp2040-gdb") {
          const incomingBoardId = String(msg.boardId || "").trim();
          const hasKnownBoard =
            incomingBoardId &&
            boardComponents.some((b) => b.id === incomingBoardId);
          const singleBoardFallback =
            boardComponents.length === 1 ? boardComponents[0]?.id : "";
          const resolvedBoardId = hasKnownBoard
            ? incomingBoardId
            : singleBoardFallback || incomingBoardId || "default";

          const gdb = msg.gdb && typeof msg.gdb === "object" ? msg.gdb : {};
          const status = String(gdb.status || "unknown");
          const reason = String(msg.reason || status);
          const detail = String(gdb.detail || gdb.lastError || "").trim();
          const signature = `${reason}:${status}:${detail}`;
          const lastSignature =
            rp2040GdbLastLogRef.current.get(resolvedBoardId);

          if (lastSignature !== signature) {
            const line = [
              `RP2040 GDB ${resolvedBoardId}`,
              `status=${status}`,
              `reason=${reason}`,
              detail,
            ]
              .filter(Boolean)
              .join(" | ");

            const level =
              status === "error" || status === "closed" ? "warn" : "info";
            appendConsoleEntry(level, line, "debug");
            rp2040GdbLastLogRef.current.set(resolvedBoardId, signature);
          }
          return;
        }
        if (msg.type === "debug" && msg.category === "rp2040-spi") {
          const incomingBoardId = String(msg.boardId || "").trim();
          const hasKnownBoard =
            incomingBoardId &&
            boardComponents.some((b) => b.id === incomingBoardId);
          const singleBoardFallback =
            boardComponents.length === 1 ? boardComponents[0]?.id : "";
          const resolvedBoardId = hasKnownBoard
            ? incomingBoardId
            : singleBoardFallback || incomingBoardId || "default";

          const spi = msg.spi && typeof msg.spi === "object" ? msg.spi : {};
          const reason = String(msg.reason || "spi");
          const bus = String(spi.bus || "spi?");
          const byte = Number(spi.byte ?? Number.NaN);
          const byteIndex = Number(spi.byteIndex ?? Number.NaN);
          const frameBytes = Number(spi.frameBytes ?? Number.NaN);
          const deviceCount = Number(spi.deviceCount || 0);
          const txBytes = Number(spi.txBytes || 0);
          const txTransactions = Number(spi.txTransactions || 0);
          const deviceIds = Array.isArray(spi.deviceIds)
            ? spi.deviceIds.join(",")
            : "";
          const framePreview = Array.isArray(spi.framePreview)
            ? spi.framePreview
              .slice(0, 8)
              .map((v) => `0x${Number(v).toString(16).padStart(2, "0")}`)
              .join(",")
            : "";
          const command = Number.isFinite(Number(spi.command))
            ? `cmd=0x${Number(spi.command).toString(16).padStart(2, "0")}`
            : "";
          const powerOn =
            spi.powerOn === undefined ? "" : `powerOn=${spi.powerOn ? 1 : 0}`;
          const writeCount = Number.isFinite(Number(spi.writeCount))
            ? `writeCount=${Number(spi.writeCount)}`
            : "";
          const fill = Number.isFinite(Number(spi.vramFillPercentage))
            ? `fill=${Number(spi.vramFillPercentage)}`
            : "";
          const role = spi.role ? `role=${String(spi.role)}` : "";
          const boardPin = spi.boardPin
            ? `boardPin=${String(spi.boardPin)}`
            : "";
          const componentPin = spi.componentPin
            ? `pin=${String(spi.componentPin)}`
            : "";
          const isHigh =
            spi.isHigh === undefined ? "" : `isHigh=${spi.isHigh ? 1 : 0}`;
          const voltage = Number.isFinite(Number(spi.voltage))
            ? `voltage=${Number(spi.voltage).toFixed(1)}`
            : "";
          const buses = Array.isArray(spi.buses)
            ? `buses=${spi.buses.join(",")}`
            : "";

          const line = [
            `RP2040 SPI ${resolvedBoardId}`,
            `reason=${reason}`,
            `bus=${bus}`,
            Number.isFinite(byte)
              ? `byte=0x${byte.toString(16).padStart(2, "0")}`
              : "",
            Number.isFinite(byteIndex) ? `index=${byteIndex}` : "",
            Number.isFinite(frameBytes) ? `frameBytes=${frameBytes}` : "",
            `devices=${deviceCount}`,
            `txBytes=${txBytes}`,
            `txFrames=${txTransactions}`,
            command,
            powerOn,
            writeCount,
            fill,
            role,
            boardPin,
            componentPin,
            isHigh,
            voltage,
            buses,
            framePreview ? `preview=${framePreview}` : "",
            deviceIds ? `ids=${deviceIds}` : "",
          ]
            .filter(Boolean)
            .join(" | ");

          if (rp2040DebugTelemetryEnabled) {
            appendConsoleEntry("info", line, "debug");
          }
          return;
        }
        if (msg.type === "sync_heartbeat") {
          if (!rp2040DebugTelemetryEnabled) {
            return;
          }

          const boardId = String(msg.boardId || "default").trim() || "default";
          const frameId = Number(msg.frameId || 0);

          const pins = renderPinsByBoardRef.current[boardId] || {};
          const analog = renderAnalogByBoardRef.current[boardId] || [];
          const components = renderComponentsByBoardRef.current[boardId] || {};
          const neopixels = renderNeopixelsByBoardRef.current[boardId] || {};

          const cache = lastRenderSyncCacheRef.current[boardId];
          const now = Date.now();
          let renderedHash;

          if (
            cache &&
            now - cache.timestamp < 33 &&
            cache.pins === pins &&
            cache.analog === analog &&
            cache.components === components &&
            cache.neopixels === neopixels
          ) {
            renderedHash = cache.hash;
          } else {
            const renderPayload = { pins, analog, components, neopixels };
            renderedHash = computeRenderSyncHash(renderPayload);
            lastRenderSyncCacheRef.current[boardId] = {
              hash: renderedHash,
              timestamp: now,
              pins,
              analog,
              components,
              neopixels,
            };
          }

          workerRef.current?.postMessage({
            type: "RENDER_REPORT",
            boardId,
            frameId,
            hash: renderedHash,
            renderedAt: Date.now(),
          });
          return;
        }
        if (msg.type === "sync_fault") {
          const boardId = String(msg.boardId || "default").trim() || "default";
          appendConsoleEntry(
            "warn",
            `SYNC_FAULT ${boardId}: expected=${String(msg.expectedHash || "")} rendered=${String(msg.renderedHash || "")} mismatches=${Number(msg.mismatches || 0)}`,
            "simulator",
          );
          return;
        }
        if (msg.type === "fault") {
          const boardId = String(msg.boardId || "");
          const pcHex = Number.isFinite(Number(msg.pc))
            ? `0x${Number(msg.pc).toString(16)}`
            : "unknown";
          appendConsoleEntry(
            "error",
            `RP2040 runtime fault on ${msg.boardId || "board"} at ${pcHex}: ${msg.reason || "invalid execution state"}`,
            "simulator",
          );
          logSerial(
            "Simulation stopped due to RP2040 runtime fault.",
            "var(--red)",
          );
          handleStop();
          return;
        }
        if (msg.type === "state" && msg.pins) {
          const boardIdKey = String(msg.boardId || "default");
          const prevPins = runLastBoardPinsRef.current.get(boardIdKey) || {};
          Object.keys(msg.pins).forEach((pinId) => {
            const prevValue = !!prevPins[pinId];
            const nextValue = !!msg.pins[pinId];
            if (prevValue !== nextValue) {
              const key = `${boardIdKey}:${pinId}`;
              runPinTransitionCountsRef.current[key] =
                (runPinTransitionCountsRef.current[key] || 0) + 1;
            }
          });
          runLastBoardPinsRef.current.set(boardIdKey, { ...msg.pins });
          renderPinsByBoardRef.current[boardIdKey] = { ...msg.pins };
          if (Object.prototype.hasOwnProperty.call(msg, "analog")) {
            renderAnalogByBoardRef.current[boardIdKey] = Array.isArray(
              msg.analog,
            )
              ? [...msg.analog]
              : msg.analog;
          }

          livePinStatesRef.current = msg.pins;
          if (!plotterPaused) {
            // Record plot history when simulation state arrives
            const serialVars = {};
            latestParsedSerialRef.current.forEach((val, idx) => {
              const lbl = serialPlotLabelsRef.current[idx] || `SVar${idx}`;
              serialVars[lbl] = val;
            });
            const newPt = {
              time: Date.now(),
              pins: msg.pins,
              analog: msg.analog || [],
              serialVars,
              boardId: msg.boardId || "default",
            };

            plotDataRef.current.push(newPt);
            if (plotDataRef.current.length > 1000) {
              plotDataRef.current.shift();
            }
          }
        }
        if (msg.type === "state" && msg.neopixels) {
          const boardIdKey = String(msg.boardId || "default");
          renderNeopixelsByBoardRef.current[boardIdKey] = msg.neopixels;
          applyLiveNeopixelData(msg.neopixels);
        }
        if (msg.type === "state" && msg.components) {
          const boardIdKey = String(msg.boardId || "default");
          const boardComponentState = {
            ...(renderComponentsByBoardRef.current[boardIdKey] || {}),
          };

          msg.components.forEach((c) => {
            const compId = String(c?.id || "").trim();
            if (!compId) return;
            runComponentUpdateCountsRef.current[compId] =
              (runComponentUpdateCountsRef.current[compId] || 0) + 1;
            boardComponentState[compId] = c.state;

            // Trace latency when buzzer starts buzzing
            if (
              c.id === "buzzer" &&
              c.state?.isBuzzing &&
              buttonInteractStartTimeRef.current
            ) {
              const latency =
                performance.now() - buttonInteractStartTimeRef.current.time;
              const sourceBtnId = buttonInteractStartTimeRef.current.compId;
              console.log(
                `%c[Latency Trace] [SUCCESS] Keypress round-trip took: ${latency.toFixed(1)}ms (Button: ${sourceBtnId} -> Buzzer Sound)`,
                "color: #22c55e; font-weight: bold; font-size: 11px;",
              );
              if (latency > 80) {
                console.warn(
                  `[Latency Trace] High round-trip latency detected (${latency.toFixed(1)}ms)! Thread contention or frame drops may be causing audible lag.`,
                );
              }
              buttonInteractStartTimeRef.current = null; // Reset tracking
            }
          });

          renderComponentsByBoardRef.current[boardIdKey] = boardComponentState;

          updateLiveOopStates(msg.components);
          handleTelemetryStateMessageRef.current(msg);
        }
        if (msg.type === "state") {
          if (msg.wifi && typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("OPENHW_WIFI_STATS", {
                detail: { boardId: msg.boardId, ...msg.wifi },
              })
            );
          }
          const boardIdKey = String(msg.boardId || "default");
          const boardComp =
            components.find((c) => c.id === boardIdKey) ||
            boardComponents.find((b) => b.id === boardIdKey);
          const boardKind = normalizeBoardKind(boardComp?.type || "");
          const nowMs = Date.now();
          const prevState =
            runLagTelemetryLastStateRef.current.get(boardIdKey) || null;
          const prevLag =
            runLagTelemetryLastLogRef.current.get(boardIdKey) || null;
          const stateGapMs = prevState ? nowMs - prevState.ts : null;
          runLagTelemetryLastStateRef.current.set(boardIdKey, { ts: nowMs });
          const perf =
            msg.perf && typeof msg.perf === "object" ? msg.perf : null;
          const telemetryLogIntervalMs = 1500;
          const telemetryLogEligible =
            !prevLag ||
            nowMs - prevLag.ts >= telemetryLogIntervalMs ||
            (Number.isFinite(Number(perf?.lastRunLoopMs)) &&
              Number(perf.lastRunLoopMs) > 20) ||
            (Number.isFinite(Number(perf?.lastPhysicsMs)) &&
              Number(perf.lastPhysicsMs) > 12) ||
            (Number.isFinite(Number(perf?.lastComponentUpdateMs)) &&
              Number(perf.lastComponentUpdateMs) > 12);

          // Emit sequence tracking
          const emitSeq = Number(msg._emitSeq || -1);
          const emitTimeMs = Number(msg._emitTime || 0);
          if (emitSeq >= 0 && emitTimeMs > 0 && telemetryLogEligible) {
            const msgAgeMs = performance.now() - msgArrivalMs + emitTimeMs;
            /*
                        appendConsoleEntry('info', `EMIT_TRACE ${boardIdKey} | seq=${emitSeq} | workerEmitTime=${emitTimeMs.toFixed(0)}ms | age=${msgAgeMs.toFixed(1)}ms`, 'debug');
            */
          }
          const perfRunMs = Number(perf?.lastRunLoopMs);
          const perfPhysicsMs = Number(perf?.lastPhysicsMs);
          const perfComponentMs = Number(perf?.lastComponentUpdateMs);
          const perfPresent =
            Number.isFinite(perfRunMs) ||
            Number.isFinite(perfPhysicsMs) ||
            Number.isFinite(perfComponentMs);
          const pinsCount =
            msg.pins && typeof msg.pins === "object"
              ? Object.keys(msg.pins).length
              : 0;
          const componentsCount = Array.isArray(msg.components)
            ? msg.components.length
            : 0;
          const slowStateGap = stateGapMs !== null && stateGapMs > 60;
          const slowWorker =
            (Number.isFinite(perfRunMs) && perfRunMs > 12) ||
            (Number.isFinite(perfPhysicsMs) && perfPhysicsMs > 8) ||
            (Number.isFinite(perfComponentMs) && perfComponentMs > 8);
          const msgHandleTimeMs = performance.now() - msgArrivalMs;
          if (
            telemetryLogEligible &&
            (slowStateGap || slowWorker || !prevLag)
          ) {
            const line = [
              `LAG ${boardIdKey}`,
              `board=${boardKind || "unknown"}`,
              `solver=${solverMode}`,
              `stateGap=${stateGapMs === null ? "n/a" : `${stateGapMs.toFixed(1)}ms`}`,
              `handleMs=${msgHandleTimeMs.toFixed(1)}`,
              `workerRun=${perfPresent ? `${Number.isFinite(perfRunMs) ? perfRunMs.toFixed(2) : "n/a"}ms` : "n/a"}`,
              `workerPhysics=${perfPresent ? `${Number.isFinite(perfPhysicsMs) ? perfPhysicsMs.toFixed(2) : "n/a"}ms` : "n/a"}`,
              `workerComponent=${perfPresent ? `${Number.isFinite(perfComponentMs) ? perfComponentMs.toFixed(2) : "n/a"}ms` : "n/a"}`,
              `pins=${pinsCount}`,
              `components=${componentsCount}`,
            ];

            /*
                        appendConsoleEntry(slowStateGap || slowWorker ? 'warn' : 'info', line.join(' | '), 'debug');
            */
            runLagTelemetryLastLogRef.current.set(boardIdKey, { ts: nowMs });
          }
        }
        if (msg.type === "backendGpioSync") {
          if (esp32Socket && typeof esp32Socket.sendGpio === "function") {
            esp32Socket.sendGpio(msg.pin, msg.value ? 1 : 0);
          }
        }
        if (msg.type === "debug_telemetry") {
          appendConsoleEntry("info", msg.message, "simulator");
        }
        if (msg.type === "serial") {
          const incomingBoardId = String(msg.boardId || "").trim();
          const hasKnownBoard =
            incomingBoardId &&
            boardComponents.some((b) => b.id === incomingBoardId);
          const singleBoardFallback =
            boardComponents.length === 1 ? boardComponents[0]?.id : "";
          const resolvedBoardId = hasKnownBoard
            ? incomingBoardId
            : singleBoardFallback || incomingBoardId || "default";
          pushSerialRxChunk(msg.data, resolvedBoardId, msg.source || "sim");
        }

        // ── 8B: SERIAL_OUTPUT from WASM runner (line-buffered complete lines) ──
        if (msg.type === "SERIAL_OUTPUT") {
          const incomingBoardId = String(msg.boardId || "").trim();
          const hasKnownBoard =
            incomingBoardId &&
            boardComponents.some((b) => b.id === incomingBoardId);
          const singleBoardFallback =
            boardComponents.length === 1 ? boardComponents[0]?.id : "";
          const resolvedBoardId = hasKnownBoard
            ? incomingBoardId
            : singleBoardFallback || incomingBoardId || "default";
          // Feed the complete line to the serial monitor
          if (msg.text) {
            pushSerialRxChunk(msg.text + "\n", resolvedBoardId, msg.source || "wasm");
          }
          // Also log to protocol analyzer
          const log = protocolAnalyzerRef.current.processSerial(msg);
          pendingProtocolLogsRef.current.push(log.message);
        }

        // ════════════════════════════════════════════════════════════════════
        // PROTOCOL OBSERVER BLOCK — LOGGING ONLY
        // ════════════════════════════════════════════════════════════════════
        // Everything below is OBSERVATION ONLY. The actual signal routing
        // (buzzer tone, LED color, servo angle, etc.) is already handled
        // inside simulation.worker.ts → runner → collectConnectedComponentPins.
        //
        // These handlers just feed the Protocol Analyzer log panel in the UI.
        // To disable a specific protocol's logging, delete its if-block below.
        // To disable ALL protocol logging, delete from here to END PROTOCOL OBSERVER.
        //
        // Where to find the log panel UI: search "protocolLogs" in this file.
        // Where to find ProtocolAnalyzer: src/circuit-validation/protocol-analyzer.js
        // ════════════════════════════════════════════════════════════════════

        // ── I2C (already hooked up from the original implementation) ──────────
        // LOG ONLY: actual I2C bus is handled by runner's onI2CWrite/onI2CRead
        if (msg.type === "protocol:i2c") {
          const log = protocolAnalyzerRef.current.processI2C(msg);
          pendingProtocolLogsRef.current.push(log.message);
        }
        // LOG ONLY: ESP32-specific I2C transaction (different event type from AVR's protocol:i2c)
        if (msg.type === "esp32:i2c:transaction") {
          const log = protocolAnalyzerRef.current.processI2C({
            address: msg.addr, data: msg.data, isWrite: true
          });
          pendingProtocolLogsRef.current.push(log.message);
        }
        // ── SPI (already hooked up from the original implementation) ──────────
        // LOG ONLY: actual SPI bus is handled by runner's onSPIByte/onSPIBuffer
        if (msg.type === "protocol:spi") {
          const log = protocolAnalyzerRef.current.processSPI(msg);
          pendingProtocolLogsRef.current.push(log.message);
        }

        // ── GPIO ─────────────────────────────────────────────────────────────
        // LOG ONLY: actual GPIO state is applied by runner's setState()
        if (msg.type === "GPIO_SYNC") {
          const log = protocolAnalyzerRef.current.processGpio(msg);
          pendingProtocolLogsRef.current.push(log.message);
        }
        // ── PWM (analogWrite) ─────────────────────────────────────────────────
        // LOG ONLY: actual PWM duty is applied by runner's onPwmDuty()
        if (msg.type === "PWM_SYNC" || (msg.type === "state" && msg.pwm !== undefined)) {
          const log = protocolAnalyzerRef.current.processPwm(msg);
          pendingProtocolLogsRef.current.push(log.message);
        }
        // ── LEDC PWM (ESP32 hardware PWM) ─────────────────────────────────────
        // LOG ONLY: actual LEDC routing is handled by runner's ledcChannelMap + onPwmDuty()
        if (msg.type === "LEDC_SYNC") {
          const log = protocolAnalyzerRef.current.processLedc(msg);
          pendingProtocolLogsRef.current.push(log.message);
        }
        // ── DAC ───────────────────────────────────────────────────────────────
        // LOG ONLY: actual DAC voltage is applied by runner's onAnalogVoltage()
        if (msg.type === "DAC_SYNC" || msg.type === "esp32:dac:sync") {
          const log = protocolAnalyzerRef.current.processDac(msg);
          pendingProtocolLogsRef.current.push(log.message);
        }
        // ── ADC (analogRead) ──────────────────────────────────────────────────
        // LOG ONLY: ADC values are injected by useEsp32Engine → esp32Socket.setAdcValue()
        if (msg.type === "esp32:adc:sync") {
          const log = protocolAnalyzerRef.current.processAdc(msg);
          pendingProtocolLogsRef.current.push(log.message);
        }
        // ── TONE (buzzer/speaker/piezo) ───────────────────────────────────────
        // LOG ONLY: actual TONE is routed via syncTone() → collectConnectedComponentPins → onTone()
        // Signal path: sim_tone() → >SIM:TONE:< → _handleSimFrame → worker → syncTone → component.onTone()
        if (msg.type === "TONE") {
          const log = protocolAnalyzerRef.current.processTone(msg);
          pendingProtocolLogsRef.current.push(log.message);
        }
        // ── Serial RX (UART component → firmware) ─────────────────────────────
        // LOG ONLY: actual serial injection is handled by runner's serialRx()
        if (msg.type === "esp32:uart:rx") {
          const log = protocolAnalyzerRef.current.processSerialRx(msg);
          pendingProtocolLogsRef.current.push(log.message);
        }
        // ── TWAI / CAN Bus ────────────────────────────────────────────────────
        // LOG ONLY: actual CAN frame delivery is handled by runner's onCanFrame()
        if (msg.type === "TWAI_TX") {
          const log = protocolAnalyzerRef.current.processTwai(msg);
          pendingProtocolLogsRef.current.push(log.message);
        }
        // ── RMT / IR pulses ───────────────────────────────────────────────────
        // LOG ONLY: actual RMT pulse delivery is handled by runner's onRmtPulse() / onInfraredSignal()
        if (msg.type === "RMT_PULSE") {
          const log = protocolAnalyzerRef.current.processRmt(msg);
          pendingProtocolLogsRef.current.push(log.message);
        }
        // ── PCNT (pulse counter) ──────────────────────────────────────────────
        // LOG ONLY: actual counter value is injected by runner's onPulseCount()
        if (msg.type === "PCNT_UPDATE") {
          const log = protocolAnalyzerRef.current.processPcnt(msg);
          pendingProtocolLogsRef.current.push(log.message);
        }
        // ── WS2812 / NeoPixel ─────────────────────────────────────────────────
        // LOG ONLY: actual pixel data is applied by runner's updatePixels()
        if (msg.type === "state" && msg.neopixels && Object.keys(msg.neopixels).length > 0) {
          Object.entries(msg.neopixels).forEach(([ch, pixels]) => {
            const log = protocolAnalyzerRef.current.processNeopixel({ channel: ch, pixels });
            pendingProtocolLogsRef.current.push(log.message);
          });
        }

        // ── Deep Sleep / Wake ─────────────────────────────────────────────────
        // NOTE: sim:sleep/sim:wake are NOT logging-only — they also update isDeviceSleeping state
        // and print a console banner. Only the protocolAnalyzer.process* call is logging-only.
        if (msg.type === "sim:sleep") {
          setIsDeviceSleeping(true);
          const sec = msg.duration_us ? (msg.duration_us / 1_000_000).toFixed(2) + 's' : '∞';
          appendConsoleEntry("info", `💤 Device entering deep sleep (${sec})`, "simulator");
          const log = protocolAnalyzerRef.current.processSleep(msg); // ← LOG ONLY line
          pendingProtocolLogsRef.current.push(log.message);            // ← LOG ONLY line
        }
        if (msg.type === "sim:wake") {
          setIsDeviceSleeping(false);
          appendConsoleEntry("info", "☀️ Device woke from deep sleep", "simulator");
          const log = protocolAnalyzerRef.current.processWake(msg); // ← LOG ONLY line
          pendingProtocolLogsRef.current.push(log.message);           // ← LOG ONLY line
        }
        // ════ END PROTOCOL OBSERVER BLOCK ════════════════════════════════════

        // ── I2S Audio Playback (Web Audio API) ────────────────────────────────
        // NOT inside the protocol observer — this actually plays audio.
        // Signal path: sim_i2s_write() → >SIM:I2S:< → qemuRunner → worker → here
        //
        // To disable I2S audio: delete from here to "END I2S AUDIO".
        // The ProtocolAnalyzer log for I2S is handled inside processI2S() below.
        if (msg.type === "I2S_AUDIO" && msg.pcm_b64) {
          try {
            // 1. Lazy-create AudioContext (must be after user gesture; Run button counts)
            if (!i2sAudioCtxRef.current) {
              i2sAudioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = i2sAudioCtxRef.current;
            if (ctx.state === "suspended") ctx.resume();

            const port = msg.port ?? 0;
            const sampleRate = msg.sampleRate || 44100;
            const bits = msg.bits || 16;

            // 2. Decode base64 → raw bytes
            const binStr = atob(msg.pcm_b64);
            const rawBytes = new Uint8Array(binStr.length);
            for (let i = 0; i < binStr.length; i++) rawBytes[i] = binStr.charCodeAt(i);

            // 3. Interpret as Int16 PCM → Float32 normalised [-1, 1]
            //    (16-bit signed little-endian is the default from sim_i2s_write)
            const bytesPerSample = bits === 32 ? 4 : (bits === 24 ? 3 : 2);
            const sampleCount = Math.floor(rawBytes.length / bytesPerSample);
            const f32 = new Float32Array(sampleCount);
            const view = new DataView(rawBytes.buffer);
            for (let i = 0; i < sampleCount; i++) {
              const byteOff = i * bytesPerSample;
              if (bits === 32) {
                f32[i] = view.getInt32(byteOff, true) / 0x80000000;
              } else if (bits === 24) {
                const lo = view.getUint8(byteOff);
                const mi = view.getUint8(byteOff + 1);
                const hi = view.getInt8(byteOff + 2);
                f32[i] = ((hi << 16) | (mi << 8) | lo) / 0x800000;
              } else {
                f32[i] = view.getInt16(byteOff, true) / 32768;
              }
            }

            // 4. Create AudioBuffer and schedule gaplessly
            if (sampleCount > 0) {
              const buf = ctx.createBuffer(1, sampleCount, sampleRate);
              buf.copyToChannel(f32, 0);
              const src = ctx.createBufferSource();
              src.buffer = buf;
              src.connect(ctx.destination);

              // nextTime per port — schedules chunks back-to-back without gaps
              const now = ctx.currentTime;
              const portKey = String(port);
              const nextTime = i2sNextScheduledTimeRef.current[portKey] ?? now;
              const startAt = Math.max(now, nextTime);
              src.start(startAt);
              i2sNextScheduledTimeRef.current[portKey] = startAt + buf.duration;
            }
          } catch (i2sErr) {
            // Silently swallow — audio errors should not crash the simulation
            console.warn("[I2S] Web Audio playback error:", i2sErr);
          }

          // LOG ONLY: record to protocol panel
          if (protocolAnalyzerRef.current?.processI2S) {
            const log = protocolAnalyzerRef.current.processI2S(msg);
            pendingProtocolLogsRef.current.push(log.message);
          }
        }
        // ── END I2S AUDIO ─────────────────────────────────────────────────────

        // ── Batch-flush all pending protocol log entries to the panel ─────────
        const PROTOCOL_EVENT_TYPES = new Set([
          "protocol:i2c", "protocol:spi",
          "SERIAL_OUTPUT", "GPIO_SYNC", "PWM_SYNC",
          "LEDC_SYNC", "DAC_SYNC", "esp32:dac:sync",
          "esp32:adc:sync", "TONE", "esp32:uart:rx",
          "TWAI_TX", "RMT_PULSE", "PCNT_UPDATE",
          "sim:sleep", "sim:wake",
          "I2S_AUDIO",  // I2S PCM audio frames from sim_i2s_write
        ]);
        if (
          (PROTOCOL_EVENT_TYPES.has(msg.type) ||
            (msg.type === "state" && msg.neopixels && Object.keys(msg.neopixels).length > 0)) &&
          !protocolLogsTimerRef.current
        ) {
          protocolLogsTimerRef.current = setTimeout(() => {
            protocolLogsTimerRef.current = null;
            const pending = pendingProtocolLogsRef.current;
            if (pending.length === 0) return;
            pendingProtocolLogsRef.current = [];

            // Limit batch to prevent dropping frames
            const batch = pending.length > 200 ? pending.slice(-200) : pending;

            setProtocolLogs((prev) => {
              const next = [...prev, ...batch];
              return next.length > 200 ? next.slice(-200) : next;
            });
          }, 150);
        }
      };

      worker.onerror = (err) => {
        console.error("Worker Error:", err);
        let errorMsg = "Unknown error";
        if (err && typeof err === "object") {
          if (err.message) errorMsg = err.message;
          else if (err.type) errorMsg = `Event type: ${err.type}`;
        }
        appendConsoleEntry(
          "error",
          `[SIM] Worker crash: ${errorMsg}`,
          "simulator",
        );
        logSerial("Worker threw an error", "var(--red)");
        handleStop();
      };

      logSerial("Simulator started in Web Worker.");

      const neopixelWiring = components
        .filter(
          (c) =>
            c.type === "wokwi-neopixel-matrix" ||
            c.type === "openhw-neopixel-matrix",
        )
        .map((c) => {
          return null; // Handle Neopixels later
        })
        .filter((n) => n);

      const customLogics = [];
      components.forEach((c) => {
        if (COMPONENT_REGISTRY[c.type]?.logicCode) {
          customLogics.push({
            type: c.type,
            code: COMPONENT_REGISTRY[c.type].logicCode,
            pins: COMPONENT_REGISTRY[c.type].manifest.pins,
          });
        }
      });

      let cleanComponents = components;
      let cleanWires = wires;
      try {
        cleanComponents = JSON.parse(JSON.stringify(components));
        cleanWires = JSON.parse(JSON.stringify(wires));
      } catch (e) {
        console.warn('Failed to stringify components/wires for worker', e);
      }

      console.warn(`[SimulatorPage] Sending hex payload to worker. Base64 Length: ${result.hex ? result.hex.length : 0} characters`);

      const componentSabOffsets = {};
      let currentSabOffset = 0;
      components.forEach((c) => {
        componentSabOffsets[c.id] = currentSabOffset;
        if (c.type === "openhw-neopixel-matrix" || c.type === "wokwi-neopixel-matrix") {
          const rows = parseInt(c.attrs?.rows || "8", 10);
          const cols = parseInt(c.attrs?.cols || "8", 10);
          currentSabOffset += (rows * cols * 4); // 4 bytes per pixel (RGBA)
        } else {
          currentSabOffset += 8; // Default 8 bytes per component (e.g. 1 Float64 or 2 Float32s)
        }
      });

      // Align buffer to nearest 4KB block
      const bufferSize = Math.max(4096, Math.ceil(currentSabOffset / 4096) * 4096);
      stateSabRef.current = new SharedArrayBuffer(bufferSize);

      // Expose to window for Web Components
      const isTeacherKeyCapture = !!options?.isTeacherKeyCapture;
      let teacherKeyBoardId = null;
      let teacherKeyComponentId = null;
      let teacherKeyProjectJson = null;

      if (isTeacherKeyCapture) {
        const boardComp = components.find((c) => c.id.toLowerCase().includes("uno") || c.id.toLowerCase().includes("pico") || c.id.toLowerCase().includes("esp32"));
        const peripheralComp = components.find((c) => c.id !== boardComp?.id);
        teacherKeyBoardId = boardComp ? boardComp.type.split("-").pop() : "board";
        teacherKeyComponentId = peripheralComp ? peripheralComp.type.split("_").pop() : "circuit";
        const payload = buildSimulationJsonPayload();
        teacherKeyProjectJson = JSON.stringify(payload, null, 2);
      }

      worker.postMessage({
        type: "START",
        isTeacherKeyCapture,
        teacherKeyBoardId,
        teacherKeyComponentId,
        teacherKeyProjectJson,
        teacherKeyDurationMs: 7900,
        sab: stateSabRef.current,
        sabOffsets: componentSabOffsets,
        networkRoomCode: localStorage.getItem("NETWORK_ROOM_CODE") || "",
        hex: result.hex,
        neopixels: neopixelWiring,
        wires: cleanWires,
        components: cleanComponents,
        customLogics: customLogics,
        boardHexMap:
          Object.keys(boardHexMap).length > 0 ? boardHexMap : undefined,
        boardPythonMap:
          Object.keys(boardPythonMap).length > 0 ? boardPythonMap : undefined,
        boardPythonFilesMap:
          Object.keys(boardPythonFilesMap).length > 0
            ? boardPythonFilesMap
            : undefined,
        boardRuntimeEnvMap:
          Object.keys(boardRuntimeEnvMap).length > 0
            ? boardRuntimeEnvMap
            : undefined,
        boardBaudMap:
          Object.keys(boardBaudMap).length > 0 ? boardBaudMap : undefined,
        baudRate: selectedRunBaud,
        debugRp2040: rp2040DebugTelemetryEnabled,
        debugSyncHeartbeat: rp2040DebugTelemetryEnabled,
        speed: simulationSpeed,
        telemetryEnabled:
          componentTelemetryEnabled && !isBooting && !isCompiling,
        telemetryMode: telemetryMode,
        watchedParamsMap: telemetryWatchedParamsMap,
        deepSilicon: deepSiliconDebuggingEnabled,
        esp32SimulationMode: esp32SimulationMode,
      });

      runStartGuardRef.current = false;
    } catch (err) {
      runStartGuardRef.current = false;
      rp2040GdbLastLogRef.current.clear();
      rp2040WirelessLastLogRef.current.clear();
      rp2040UartMicroPythonBoardsRef.current.clear();
      rp2040UartSilentWarnedBoardsRef.current.clear();
      setIsRunning(false);
      setIsCompiling(false);
      setIsBooting(false); // TODO: Reset booting state on error
      setRunStartedAtMs(null);
      setRunDurationSec(0);
      appendConsoleEntry(
        "error",
        `Run failed: ${err?.message || "Unknown error"}`,
        "simulator",
      );
      console.error(err);
      alert(err.message);
    }
  };

  const runFnRef = useRef(null)
  runFnRef.current = handleRun
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'RUN_SIMULATION') {
        runFnRef.current?.()
      }
      if (e.data?.type === 'serial-toggle' && canvasOnly) {
        serialRelayActiveRef.current = !serialRelayActiveRef.current;
        lastRelayedLengthRef.current = 0;
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [canvasOnly])

  useEffect(() => {
    if (!canvasOnly) return
    const timer = setInterval(() => {
      if (!serialRelayActiveRef.current) return
      const history = serialHistoryRef.current
      if (history.length > lastRelayedLengthRef.current) {
        const newEntries = history.slice(lastRelayedLengthRef.current)
        lastRelayedLengthRef.current = history.length
        window.parent?.postMessage({ type: 'serial-entry', entries: newEntries }, '*')
      }
    }, 200)
    return () => clearInterval(timer)
  }, [canvasOnly])

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!serialPanelDragging.current) return
      setSerialPanelPos({
        x: Math.max(0, e.clientX - serialPanelDragOffset.current.x),
        y: Math.max(0, e.clientY - serialPanelDragOffset.current.y),
      })
    }
    const handleMouseUp = () => {
      serialPanelDragging.current = false
      setSerialPanelGrabbing(false)
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const dispatchTeacherKeyCapture = useCallback(() => {
    if (!workerRef.current) {
      alert("Worker failed to start. Cannot capture key.");
      return;
    }

    const boardComp = components.find((c) => c.id.toLowerCase().includes("uno") || c.id.toLowerCase().includes("pico") || c.id.toLowerCase().includes("esp32"));
    const peripheralComp = components.find((c) => c.id !== boardComp?.id);
    const boardName = boardComp ? boardComp.type.split("-").pop() : "board";
    const peripheralName = peripheralComp ? peripheralComp.type.split("_").pop() : "circuit";

    const payload = buildSimulationJsonPayload();
    const projectJson = JSON.stringify(payload, null, 2);

    workerRef.current.postMessage({
      type: "START_KEY_CAPTURE",
      durationMs: 7900,
      projectJson: projectJson,
      board: boardName,
      component: peripheralName
    });
  }, [components, buildSimulationJsonPayload]);

  useEffect(() => {
    if (isRunning && isQueuedForTeacherKey) {
      setIsQueuedForTeacherKey(false);
      appendConsoleEntry("info", "Simulation running! Visual telemetry recording started for 8 seconds...", "simulator");
    }
  }, [isRunning, isQueuedForTeacherKey, appendConsoleEntry]);

  const generateTeacherKey = useCallback(async () => {
    if (!isRunning) {
      appendConsoleEntry("info", "Compiling and starting simulation to capture teacher key...", "simulator");
      setIsQueuedForTeacherKey(true);
      await handleRun({ isTeacherKeyCapture: true });
    } else {
      appendConsoleEntry("info", "Starting visual telemetry recording for 8 seconds...", "simulator");
      dispatchTeacherKeyCapture();
    }
  }, [isRunning, handleRun, dispatchTeacherKeyCapture, appendConsoleEntry]);

  const handleStop = () => {
    const wasRunning = isRunning;
    runStartGuardRef.current = false;
    stopEsp32Session();
    rp2040GdbLastLogRef.current.clear();
    rp2040WirelessLastLogRef.current.clear();
    rp2040UartMicroPythonBoardsRef.current.clear();
    rp2040UartSilentWarnedBoardsRef.current.clear();
    runLagTelemetryLastStateRef.current.clear();
    runLagTelemetryLastLogRef.current.clear();
    runFpsTelemetryLastLogRef.current.clear();

    if (wasRunning) {
      const componentSummary = Object.entries(
        runComponentUpdateCountsRef.current,
      )
        .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
        .slice(0, 10)
        .map(([id, count]) => `${id}:${count}`);
      const pinSummary = Object.entries(runPinTransitionCountsRef.current)
        .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
        .slice(0, 12)
        .map(([id, count]) => `${id}:${count}`);

      if (componentSummary.length > 0) {
        appendConsoleEntry(
          "info",
          `Runtime verification (component updates): ${componentSummary.join(", ")}`,
          "simulator",
        );
      }
      if (pinSummary.length > 0) {
        appendConsoleEntry(
          "info",
          `Runtime verification (pin transitions): ${pinSummary.join(", ")}`,
          "simulator",
        );
      }
      if (componentSummary.length === 0 && pinSummary.length === 0) {
        appendConsoleEntry(
          "warn",
          "Runtime verification: no component updates or pin transitions detected.",
          "simulator",
        );
      }
    }

    runComponentUpdateCountsRef.current = {};
    runPinTransitionCountsRef.current = {};
    runLastBoardPinsRef.current = new Map();
    renderPinsByBoardRef.current = {};
    renderAnalogByBoardRef.current = {};
    renderComponentsByBoardRef.current = {};
    renderNeopixelsByBoardRef.current = {};

    const neopixelOffStates = {};
    const neopixelOffPixels = {};
    components.forEach((comp) => {
      if (!/(neopixel|ws2812|ws2821)/i.test(String(comp?.type || ""))) return;

      const rows = Math.max(
        1,
        Number.parseInt(String(comp?.attrs?.rows ?? "8"), 10) || 1,
      );
      const cols = Math.max(
        1,
        Number.parseInt(String(comp?.attrs?.cols ?? "8"), 10) || 1,
      );
      const pixelCount = rows * cols;
      const attrsState =
        comp?.attrs && typeof comp.attrs === "object" ? comp.attrs : {};

      neopixelOffStates[comp.id] = {
        ...attrsState,
        rows: String(rows),
        cols: String(cols),
        pixels: new Array(pixelCount).fill(0),
      };

      const pixelTriples = [];
      for (let index = 0; index < pixelCount; index++) {
        pixelTriples.push([
          Math.floor(index / cols),
          index % cols,
          { r: 0, g: 0, b: 0 },
        ]);
      }
      neopixelOffPixels[comp.id] = pixelTriples;
    });

    if (workerRef.current) {
      workerRef.current.postMessage({ type: "STOP" });
      workerRef.current.terminate();
      workerRef.current = null;
    }
    // Terminate the Render Worker and tell it to release all canvas resources.
    if (renderWorkerRef.current) {
      renderWorkerRef.current.postMessage({ type: "DISPLAY_CLEAR_ALL" });
      renderWorkerRef.current.terminate();
      renderWorkerRef.current = null;
      setRenderWorker(null); // Clear Provider so display UIs see null worker
      if (typeof window !== "undefined") {
        window.__displayRenderWorker = null;
        window.dispatchEvent(
          new CustomEvent("display-render-worker-changed", { detail: null }),
        );
      }
    }
    setIsRunning(false);
    setIsCompiling(false);
    setIsBooting(false); // TODO: Reset booting state on stop
    setIsPaused(false);
    setRunStartedAtMs(null);
    setRunDurationSec(0);
    livePinStatesRef.current = {};
    clearLiveNeopixelData();
    applyLiveNeopixelData(neopixelOffPixels);
    liveOopStatesRef.current = neopixelOffStates;
    Object.keys(neopixelOffStates).forEach(notifyLiveOopStateListeners);
    setSerialHistory([]);
    plotDataRef.current = [];
    setSerialPaused(false);
    setPlotterPaused(false);
    serialPlotBufferRef.current = "";
    serialPlotLabelsRef.current = [];
    latestParsedSerialRef.current = [];
    serialIngressArbitrationRef.current.clear();
    serialPausedQueueRef.current = [];
    appendConsoleEntry("info", "Simulation stopped.", "simulator");
  };

  const bootStartedAtRef = useRef(null);

  // Track when boot starts
  useEffect(() => {
    if (isBooting && !isRunning) {
      if (!bootStartedAtRef.current) {
        bootStartedAtRef.current = Date.now();
      }
    }
  }, [isBooting, isRunning]);

  // Reset run start time when simulation actually starts running
  useEffect(() => {
    if (isRunning && !isCompiling && !isBooting) {
      let startTime = Date.now();
      if (bootStartedAtRef.current) {
        const bootDuration = Date.now() - bootStartedAtRef.current;
        startTime -= bootDuration;
      }
      setRunStartedAtMs(startTime);
    } else if (!isRunning) {
      bootStartedAtRef.current = null;
    }
  }, [isRunning, isCompiling, isBooting]);

  useEffect(() => {
    if (!isRunning || !runStartedAtMs || isCompiling || isBooting) return;

    const updateElapsed = () => {
      setRunDurationSec(Math.max(0, (Date.now() - runStartedAtMs) / 1000));
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 250);
    return () => clearInterval(timer);
  }, [isRunning, runStartedAtMs, isCompiling, isBooting]);

  useEffect(() => {
    if (!hardwareStatus) return;
    if (lastHardwareStatusRef.current === hardwareStatus) return;
    lastHardwareStatusRef.current = hardwareStatus;

    const statusLower = String(hardwareStatus).toLowerCase();
    const level =
      statusLower.includes("failed") || statusLower.includes("lost")
        ? "error"
        : "info";
    appendConsoleEntry(level, hardwareStatus, "hardware");
  }, [hardwareStatus, appendConsoleEntry]);

  const handlePause = () => {
    if (workerRef.current) workerRef.current.postMessage({ type: "PAUSE" });
    setIsPaused(true);
  };

  const handleResume = () => {
    if (workerRef.current) workerRef.current.postMessage({ type: "RESUME" });
    setIsPaused(false);
  };

  const handleReset = () => {
    if (workerRef.current && isRunning) {
      workerRef.current.postMessage({ type: "RESET" });
      const now = new Date();
      const ts =
        now.toTimeString().slice(0, 8) +
        "." +
        String(now.getMilliseconds()).padStart(3, "0");
      setSerialHistory((prev) => [
        ...prev,
        { dir: "sys", text: "--- BOARD RESET ---", ts },
      ]);
    }
  };

  const sendSerialInput = useCallback(
    (
      targetBoardOverride,
      inputOverride,
      lineEndingOverride,
      baudRateOverride,
    ) => {
      const txt = String(
        inputOverride !== undefined ? inputOverride : serialInput || "",
      );
      if (!txt.trim()) return;
      const lineEnding =
        SERIAL_LINE_ENDINGS[lineEndingOverride || serialLineEnding] ?? "\n";
      const payload = txt + lineEnding;

      const requestedBoard = targetBoardOverride || serialBoardFilter;
      const targetBoardId =
        requestedBoard !== "all" ? requestedBoard : undefined;

      const baudRate = baudRateOverride || serialBaudRate;

      if (workerRef.current && isRunning) {
        workerRef.current.postMessage({
          type: "SERIAL_INPUT",
          data: payload,
          targetBoardId,
          baudRate: baudRate,
        });
        pushSerialTxLine(txt, targetBoardId || "all", "sim");
        if (inputOverride === undefined) setSerialInput("");
        return;
      }

      if (hardwareConnected) {
        const targetBoard = targetBoardId
          ? targetBoardId
          : hardwareSerialTargetRef.current || hardwareBoardId || "hardware";
        sendHardwareSerialLine(payload, targetBoard, txt)
          .then(() => {
            if (inputOverride === undefined) setSerialInput("");
          })
          .catch((err) => {
            console.error("[WebSerial] TX failed:", err);
            alert(
              `Hardware serial write failed: ${err?.message || "Unknown error"}`,
            );
          });
        return;
      }

      alert("Run simulator or connect hardware serial before sending data.");
    },
    [
      serialInput,
      serialLineEnding,
      workerRef,
      isRunning,
      serialBoardFilter,
      serialBaudRate,
      pushSerialTxLine,
      hardwareConnected,
      hardwareBoardId,
      sendHardwareSerialLine,
      setSerialInput,
    ],
  );

  const updateBoardBaudRate = useCallback(
    (boardId, baud) => {
      setBoardBaudRates((prev) => ({ ...prev, [boardId]: baud }));
      if (workerRef.current && isRunning) {
        workerRef.current.postMessage({
          type: "SERIAL_SET_BAUD",
          targetBoardId: boardId !== "all" ? boardId : undefined,
          baudRate: baud,
        });
      }
    },
    [isRunning],
  );

  const updateGlobalBaudRate = useCallback(
    (baud) => {
      setSerialBaudRate(baud);
      if (workerRef.current && isRunning) {
        workerRef.current.postMessage({
          type: "SERIAL_SET_BAUD",
          baudRate: baud,
        });
      }
    },
    [isRunning],
  );

  const openComponentEditor = useCallback(() => {
    try {
      navigate("/component-editor");
    } catch (_) {
      window.location.assign("/component-editor");
    }
  }, [navigate]);

  // ── PNG Export ────────────────────────────────────────────────────────────
  const downloadPng = async (options = {}) => {
    const { returnBlob = false } = options;
    if (isExporting) return;
    setIsExporting(true);
    try {
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      const canvasEl = canvasRef.current;
      const SCALE = 1.5; // High-res (Retina) but uses ~44% less RAM than 2.0
      const PAD = 40; // Exact 40px equal padding on all four sides
      const pinPosCache = new Map();
      const getCachedPinPos = (compId, pinId) => {
        const key = `${compId}:${pinId}`;
        if (!pinPosCache.has(key))
          pinPosCache.set(key, getPinPos(compId, pinId));
        return pinPosCache.get(key);
      };

      const isValidPos = (pos) =>
        pos &&
        typeof pos.x === "number" &&
        typeof pos.y === "number" &&
        !pos.isFallback &&
        (pos.x !== 0 || pos.y !== 0) &&
        isFinite(pos.x) &&
        isFinite(pos.y);

      // 1. Calculate bounding box of all components + wire waypoints (in canvas-space coords)
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      components.forEach((c) => {
        const reg = COMPONENT_REGISTRY[c.type];
        const b =
          typeof reg?.BOUNDS === "function"
            ? reg.BOUNDS(getComponentStateAttrs(c))
            : reg?.BOUNDS || { x: 0, y: 0, w: c.w, h: c.h };
        const bw = b.w || c.w || 0;
        const bh = b.h || c.h || 0;
        const cx = typeof c.x === "number" ? c.x : 0;
        const cy = typeof c.y === "number" ? c.y : 0;

        if (bw > 0 || bh > 0 || cx > 0 || cy > 0) {
          minX = Math.min(minX, cx + (b.x || 0));
          minY = Math.min(minY, cy + (b.y || 0));
          maxX = Math.max(maxX, cx + (b.x || 0) + bw);
          maxY = Math.max(maxY, cy + (b.y || 0) + bh);
        }

        // pins (they're positioned relative to component and can extend beyond its box)
        (PIN_DEFS[c.type] || []).forEach((pin) => {
          const pp = getCachedPinPos(c.id, pin.id);
          if (isValidPos(pp)) {
            minX = Math.min(minX, pp.x - 4);
            minY = Math.min(minY, pp.y - 4);
            maxX = Math.max(maxX, pp.x + 4);
            maxY = Math.max(maxY, pp.y + 4);
          }
        });
      });

      // wire waypoints & endpoints
      wires.forEach((w) => {
        (w.waypoints || []).forEach((wp) => {
          if (isValidPos(wp)) {
            minX = Math.min(minX, wp.x);
            minY = Math.min(minY, wp.y);
            maxX = Math.max(maxX, wp.x);
            maxY = Math.max(maxY, wp.y);
          }
        });
        const [fComp, fPin] = (w.from || "").split(":");
        const [tComp, tPin] = (w.to || "").split(":");
        const fp = getCachedPinPos(fComp, fPin);
        const tp = getCachedPinPos(tComp, tPin);
        if (isValidPos(fp)) {
          minX = Math.min(minX, fp.x);
          minY = Math.min(minY, fp.y);
          maxX = Math.max(maxX, fp.x);
          maxY = Math.max(maxY, fp.y);
        }
        if (isValidPos(tp)) {
          minX = Math.min(minX, tp.x);
          minY = Math.min(minY, tp.y);
          maxX = Math.max(maxX, tp.x);
          maxY = Math.max(maxY, tp.y);
        }
      });

      // Query live component DOM elements inside zoomWrapper for custom component DOM bounds
      if (innerCanvasRef.current) {
        const liveElements = innerCanvasRef.current.querySelectorAll(
          '[data-comp-id], [id^="comp-"], .openhw-component-node',
        );
        liveElements.forEach((el) => {
          const left = parseFloat(el.style.left);
          const top = parseFloat(el.style.top);
          const w = el.offsetWidth || parseFloat(el.style.width) || 0;
          const h = el.offsetHeight || parseFloat(el.style.height) || 0;
          if (
            !isNaN(left) &&
            !isNaN(top) &&
            left > 0 &&
            top > 0 &&
            w > 0 &&
            h > 0
          ) {
            minX = Math.min(minX, left);
            minY = Math.min(minY, top);
            maxX = Math.max(maxX, left + w);
            maxY = Math.max(maxY, top + h);
          }
        });
      }

      if (!isFinite(minX) || !isFinite(minY)) {
        minX = 0;
        minY = 0;
        maxX = 800;
        maxY = 600;
      }

      // DIAGNOSTIC LOG: See the calculated bounds
      console.log("[PNG Export] Raw Bounds:", { minX, minY, maxX, maxY });

      minX -= PAD;
      minY -= PAD;
      maxX += PAD;
      maxY += PAD;
      const bboxW = maxX - minX;
      const bboxH = maxY - minY;

      // Build a minimal export-signature payload (exclude timestamps) so identical circuits reuse PNG.
      const exportSignaturePayload = {
        board,
        components,
        wires,
        code,
        blocklyXml,
        blocklyGeneratedCode,
        useBlocklyCode: !!useBlocklyCode,
        projectFiles: (projectFiles || []).map((f) => ({
          id: f.id,
          content:
            typeof f.content === "string" ? f.content : String(f.content || ""),
        })),
        openCodeTabs: openCodeTabs || [],
        activeCodeFileId: activeCodeFileId || "",
        options: { SCALE: 2.0, PAD },
      };
      const signature = computeRenderSyncHash(exportSignaturePayload);

      // Fast return if we have a cached PNG for this signature and it's fresh
      const CACHE_TTL = 1000 * 60 * 10; // 10 minutes
      const cached = _exportPngResultCache.get(signature);
      if (cached && Date.now() - cached.createdAt < CACHE_TTL) {
        try {
          const combined = cached.bytes;
          const finalBlob = new Blob([combined], { type: "image/png" });
          if (returnBlob) {
            setIsExporting(false);
            return finalBlob;
          }
          const url = URL.createObjectURL(finalBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = cached.filename || `circuit_${board}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          setIsExporting(false);
          return;
        } catch (err) {
          // cache read failed — fall through and regenerate
          console.warn("[PNG Export] cache hit failed, regenerating:", err);
        }
      }

      // 2. Capture the canvas
      const t_start = performance.now();
      console.log("[PNG Export] signature:", signature);

      const MAX_EXPORT_DIM = 4000;
      const actualW = Math.min(bboxW, MAX_EXPORT_DIM);
      const actualH = Math.min(bboxH, MAX_EXPORT_DIM);

      // 1. Deep Tagging with Identity Mapping
      const t_tag_start = performance.now();
      let tagCount = 0;
      const elementMap = new Map(); // id -> liveElement
      const zoomWrapper = innerCanvasRef.current;
      if (!zoomWrapper) throw new Error("Zoom wrapper not found");

      const deepTag = (root) => {
        const elements = [root, ...Array.from(root.querySelectorAll("*"))];
        elements.forEach((el) => {
          if (!el.getAttribute) return;
          const id = `h2c-p-${tagCount++}`;
          el.setAttribute("data-h2c-id", id);
          elementMap.set(id, el);
          if (el.shadowRoot) deepTag(el.shadowRoot);
        });
      };

      deepTag(zoomWrapper);
      const shadowHostEls = Array.from(elementMap.values()).filter(
        (el) => !!el.shadowRoot,
      );
      console.log(
        `[PNG Export] Mapped ${tagCount} elements in ${Math.round(performance.now() - t_tag_start)}ms`,
      );

      // Dummy canvas used to filter itself out in ignoreElements
      const filterCanvas = document.createElement("canvas");

      let circuitCanvas;
      try {
        const h2c = await getHtml2canvas();
        const t_prep_start = performance.now();
        console.log("[PNG Export] Initializing Isolated Iframe...");

        // 1. Create a hidden iframe to isolate the DOM tree
        const iframe = document.createElement("iframe");
        Object.assign(iframe.style, {
          position: "fixed",
          left: "-10000px",
          top: "-10000px",
          width: actualW + "px",
          height: actualH + "px",
        });
        document.body.appendChild(iframe);

        const idoc = iframe.contentDocument || iframe.contentWindow.document;
        idoc.open();
        idoc.write(
          '<!DOCTYPE html><html><head></head><body style="margin:0;padding:0;background:transparent;"></body></html>',
        );
        idoc.close();

        // 2. NO Stylesheet Copying (Massive RAM saver)
        // We will inline only what's absolutely necessary below
        const styleReset = idoc.createElement("style");
        styleReset.textContent = `
          * { box-sizing: border-box; filter: none !important; box-shadow: none !important; }
          text, span, div { font-family: sans-serif; }
        `;
        idoc.head.appendChild(styleReset);

        const filterKiller = idoc.createElement("style");
        filterKiller.textContent =
          "* { filter: none !important; box-shadow: none !important; }";
        idoc.head.appendChild(filterKiller);

        // 3. Clone and Inject
        const circuitClone = idoc.importNode(zoomWrapper, true);
        idoc.body.appendChild(circuitClone);

        // 4. Filtered Style Teleportation (Live HTML Mode)
        console.log(
          `[PNG Export] Teleporting styles for ${tagCount} elements...`,
        );

        // 4a. Inline Shadow DOM Content as Live HTML
        let inlinedCount = 0;
        shadowHostEls.forEach((liveEl) => {
          const dataId = liveEl.getAttribute("data-h2c-id");
          const clonedHost = idoc.querySelector(`[data-h2c-id="${dataId}"]`);
          if (!clonedHost) return;

          inlinedCount++;
          // Copy adopted styles (the component's internal design)
          if (liveEl.shadowRoot.adoptedStyleSheets) {
            liveEl.shadowRoot.adoptedStyleSheets.forEach((sheet) => {
              const styleEl = idoc.createElement("style");
              styleEl.textContent = getSerializedShadowSheet(sheet);
              clonedHost.appendChild(styleEl);
            });
          }

          // Inline the actual graphics/nodes
          for (let i = 0; i < liveEl.shadowRoot.childNodes.length; i++) {
            clonedHost.appendChild(
              idoc.importNode(liveEl.shadowRoot.childNodes[i], true),
            );
          }
        });
        console.log(
          `[PNG Export] Inlined shadow content for ${inlinedCount}/${shadowHostEls.length} components`,
        );

        // 4b. Total Parity Style Teleportation
        console.log(`[PNG Export] Teleporting styles for ${tagCount} nodes...`);

        const propsToCopy = [
          "display",
          "position",
          "left",
          "top",
          "width",
          "height",
          "transform",
          "transformOrigin",
          "color",
          "fontSize",
          "fontWeight",
          "fontFamily",
          "textAlign",
          "visibility",
          "opacity",
          "backgroundColor",
          "zIndex",
          "border",
          "borderWidth",
          "borderStyle",
          "borderColor",
          "borderRadius",
          "padding",
          "margin",
          "lineHeight",
          "overflow",
          "boxSizing",
          "clipPath",
          "mask",
          "filter",
          "mixBlendMode",
          "outline",
          "boxShadow",
          "textShadow",
          "cursor",
        ];

        const svgProps = [
          "fill",
          "stroke",
          "stroke-width",
          "stroke-linecap",
          "stroke-linejoin",
          "stroke-miterlimit",
          "stroke-dasharray",
          "stroke-dashoffset",
          "stroke-opacity",
          "fill-opacity",
          "fill-rule",
          "marker-start",
          "marker-mid",
          "marker-end",
        ];

        const clonedNodes = [
          idoc.body,
          ...Array.from(idoc.body.querySelectorAll("*")),
        ];
        let styleCount = 0;
        let wireCount = 0;

        clonedNodes.forEach((cloned) => {
          if (cloned === circuitClone) return;

          const dataId = cloned.getAttribute("data-h2c-id");
          if (!dataId) return;

          const liveEl = elementMap.get(dataId);
          if (!liveEl) return;

          styleCount++;
          if (cloned.tagName === "path" || cloned.tagName === "line")
            wireCount++;

          const s = window.getComputedStyle(liveEl);

          // Copy Layout and Visual Styles with FORCED priority
          propsToCopy.forEach((p) => {
            // SAFETY: Prevent Giant Text bug
            if (
              p === "fontSize" &&
              (cloned.tagName === "text" || cloned.tagName === "tspan")
            )
              return;
            cloned.style.setProperty(p, s.getPropertyValue(p), "important");
          });

          // Copy SVG-specific properties with FORCED priority
          if (
            [
              "path",
              "circle",
              "rect",
              "line",
              "polygon",
              "text",
              "ellipse",
              "g",
              "svg",
            ].includes(cloned.tagName)
          ) {
            svgProps.forEach((attr) => {
              const val = liveEl.getAttribute(attr) || s.getPropertyValue(attr);
              if (val) {
                const finalVal = val.includes("color(") ? "#777" : val;
                cloned.setAttribute(attr, finalVal);
                // Also set as important style if it's a CSS-mappable property
                if (
                  [
                    "fill",
                    "stroke",
                    "stroke-width",
                    "opacity",
                    "visibility",
                  ].includes(attr)
                ) {
                  cloned.style.setProperty(attr, finalVal, "important");
                }
              }
            });

            // Hardcode width/height attributes to match computed logical size
            const w = s.getPropertyValue("width");
            const h = s.getPropertyValue("height");
            if (w && w !== "auto" && w !== "100%") {
              cloned.setAttribute("width", w.replace("px", ""));
              cloned.style.setProperty("width", w, "important");
            }
            if (h && h !== "auto" && h !== "100%") {
              cloned.setAttribute("height", h.replace("px", ""));
              cloned.style.setProperty("height", h, "important");
            }
          }

          // Final Safety: Ensure nothing is accidentally hidden
          cloned.style.setProperty("visibility", "visible", "important");
          cloned.style.setProperty("opacity", s.opacity || "1", "important");
          if (liveEl.shadowRoot) {
            cloned.style.setProperty("overflow", "visible", "important");
          }
        });

        console.log(
          `[PNG Export] Successfully styled ${styleCount} elements, including ${wireCount} wires`,
        );
        elementMap.clear();

        // Ensure all components are visible
        idoc.body.style.overflow = "visible";
        circuitClone.style.overflow = "visible";

        // 5. Adjust clone for capture with FORCED priority to override any live pan/zoom
        circuitClone.style.setProperty("transform", `translate(${-minX}px, ${-minY}px) scale(1)`, "important");
        circuitClone.style.setProperty("transform-origin", "0 0", "important");
        circuitClone.style.setProperty("width", `${actualW}px`, "important");
        circuitClone.style.setProperty("height", `${actualH}px`, "important");
        circuitClone.style.setProperty("position", "absolute", "important");
        circuitClone.style.setProperty("left", "0px", "important");
        circuitClone.style.setProperty("top", "0px", "important");
        circuitClone.style.setProperty("margin", "0px", "important");
        circuitClone.style.setProperty("padding", "0px", "important");
        circuitClone.style.setProperty("display", "block", "important");

        console.log(
          `[PNG Export] Isolation prep finished. Nodes in iframe: ${idoc.querySelectorAll("*").length}`,
        );

        const t_html2c_start = performance.now();
        circuitCanvas = await h2c(idoc.body, {
          backgroundColor: null, // transparent background
          scale: SCALE,
          useCORS: true,
          allowTaint: false,
          logging: true,
          imageTimeout: 10000,
          skipFonts: true,
          width: actualW,
          height: actualH,
          onclone: (_clonedDoc, clonedEl) => {
            // Selective color fix: Target graphics but SPARE the text
            clonedEl
              .querySelectorAll("path, rect, circle, polygon")
              .forEach((el) => {
                const fill = el.getAttribute("fill");
                if (fill && fill.includes("color("))
                  el.setAttribute("fill", "#777");
                const stroke = el.getAttribute("stroke");
                if (stroke && stroke.includes("color("))
                  el.setAttribute("stroke", "#777");
              });
            // Ensure labels have proper color (transparent bg — let computed styles come through)
            clonedEl.querySelectorAll("text, span, div").forEach((el) => {
              if (el.style.color && el.style.color.includes("color("))
                el.style.color = "#1e293b";
            });
          },
        });

        // Memory Flush: Clear the iframe content immediately to free RAM
        idoc.body.innerHTML = "";
        idoc.head.innerHTML = "";
        document.body.removeChild(iframe);
        const t_html2c_end = performance.now();
        console.log(
          "[PNG Export] Isolated html2canvas ms:",
          Math.round(t_html2c_end - t_html2c_start),
        );
      } finally {
        // Remove temporary classes from live elements
        shadowHostEls.forEach((el) => {
          const classId = Array.from(el.classList).find((c) =>
            c.startsWith("h2c-shadow-host-"),
          );
          if (classId) el.classList.remove(classId);
        });
      }

      const t_compose_start = performance.now();
      const CW = circuitCanvas.width;
      const CH = circuitCanvas.height;

      // 2. Output canvas — circuit only (no header bar)
      const out = document.createElement("canvas");
      out.width = CW;
      out.height = CH;
      const ctx = out.getContext("2d");

      // No background fill — keep transparent so PNG has alpha channel
      ctx.drawImage(circuitCanvas, 0, 0);

      // Branding logo (bottom-right)
      try {
        const logo = await ensureExportLogo();
        if (logo) {
          const logoW = Math.min(
            Math.round(130 * SCALE),
            Math.max(96 * SCALE, Math.round(CW * 0.16)),
          );
          const logoH = Math.round(logoW * (logo.height / logo.width));
          ctx.save();
          ctx.globalAlpha = 0.62;
          ctx.drawImage(
            logo,
            CW - logoW - 14 * SCALE,
            CH - logoH - 14 * SCALE,
            logoW,
            logoH,
          );
          ctx.restore();
        }
      } catch (logoErr) {
        // Ignore logo load failures so export still succeeds.
      }

      // 3. Encode FULL metadata (no truncation) for machine-readable round-trip
      const fullMetadata = buildProjectPayload({
        board,
        components,
        wires,
        code,
        blocklyXml,
        blocklyGeneratedCode,
        useBlocklyCode,
        projectFiles,
        openCodeTabs,
        activeCodeFileId,
        exportedAt: new Date().toISOString(),
      });
      const jsonPayload = "\x00OPENHW_META\x00" + JSON.stringify(fullMetadata);

      // 4. Append metadata bytes after PNG IEND → still renders fine in all image viewers
      const dateStr = new Date()
        .toISOString()
        .slice(0, 16)
        .replace("T", "_")
        .replace(":", "-")
        .replace(":", "-");
      const filename = `circuit_${board}_${dateStr}.png`;
      const blobResult = await new Promise((resolve) => {
        out.toBlob(async (blob) => {
          const t_blob_start = performance.now();
          const pngBuf = await blob.arrayBuffer();
          const pngBytes = new Uint8Array(pngBuf);
          const metaBytes = new TextEncoder().encode(jsonPayload);
          const combined = new Uint8Array(pngBytes.length + metaBytes.length);
          combined.set(pngBytes);
          combined.set(metaBytes, pngBytes.length);
          const finalBlob = new Blob([combined], { type: "image/png" });
          const t_blob_end = performance.now();
          console.log(
            "[PNG Export] compose+blob ms:",
            Math.round(t_blob_end - t_blob_start),
          );
          console.log(
            "[PNG Export] total ms:",
            Math.round(t_blob_end - t_start),
          );

          if (returnBlob) {
            resolve(finalBlob);
            return;
          }

          const url = URL.createObjectURL(finalBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          // Cache combined bytes for identical future exports in this session
          try {
            _exportPngResultCache.set(signature, {
              bytes: combined,
              filename,
              createdAt: Date.now(),
            });
          } catch (err) {
            // Best-effort cache; ignore failures silently
            console.warn("[PNG Export] cache store failed", err);
          }
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          resolve(null);
        }, "image/png");
      });

      if (returnBlob) return blobResult;
    } catch (err) {
      console.error("[PNG Export] Error:", err);
      alert("PNG export failed: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // ── Captures a small thumbnail (320×180) and saves to IndexedDB ───────
  const captureThumbnail = useCallback(async () => {
    if (!components.length) return;
    const { saveProject, loadProject } = await import('../../services/projectStore.js');
    const id = currentProjectIdRef.current;
    if (!id) return;
    const THUMB_W = 320;
    const THUMB_H = 180;
    const PAD = 20;

    // 1. Calculate bounding box of all components + wire waypoints (canvas-space)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    components.forEach((c) => {
      const reg = COMPONENT_REGISTRY[c.type];
      const b = typeof reg?.BOUNDS === 'function' ? reg.BOUNDS(getComponentStateAttrs(c)) : reg?.BOUNDS || { x: 0, y: 0, w: c.w, h: c.h };
      minX = Math.min(minX, c.x + b.x);
      minY = Math.min(minY, c.y + b.y);
      maxX = Math.max(maxX, c.x + b.x + b.w);
      maxY = Math.max(maxY, c.y + b.y + b.h + 20);
      (PIN_DEFS[c.type] || []).forEach((pin) => {
        const pp = getPinPos(c.id, pin.id);
        if (pp) { minX = Math.min(minX, pp.x - 4); minY = Math.min(minY, pp.y - 4); maxX = Math.max(maxX, pp.x + 4); maxY = Math.max(maxY, pp.y + 4); }
      });
    });
    wires.forEach((w) => {
      (w.waypoints || []).forEach((wp) => { minX = Math.min(minX, wp.x); minY = Math.min(minY, wp.y); maxX = Math.max(maxX, wp.x); maxY = Math.max(maxY, wp.y); });
      [w.from, w.to].forEach((ref) => {
        if (!ref) return;
        const [cId, pId] = ref.split(':');
        const pp = getPinPos(cId, pId);
        if (pp) { minX = Math.min(minX, pp.x); minY = Math.min(minY, pp.y); maxX = Math.max(maxX, pp.x); maxY = Math.max(maxY, pp.y); }
      });
    });
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 600; }
    minX -= PAD; minY -= PAD; maxX += PAD; maxY += PAD;
    const bboxW = maxX - minX;
    const bboxH = maxY - minY;

    try {
      // 2. Use the same isolated iframe + style teleportation approach as PNG export
      const zoomWrapper = innerCanvasRef.current;
      if (!zoomWrapper) return;

      let tagCount = 0;
      const elementMap = new Map();
      const deepTag = (root) => {
        [root, ...Array.from(root.querySelectorAll("*"))].forEach((el) => {
          if (!el.getAttribute) return;
          const tid = `thumb-p-${tagCount++}`;
          el.setAttribute("data-thumb-id", tid);
          elementMap.set(tid, el);
          if (el.shadowRoot) deepTag(el.shadowRoot);
        });
      };
      deepTag(zoomWrapper);
      const shadowHostEls = Array.from(elementMap.values()).filter((el) => !!el.shadowRoot);

      const iframe = document.createElement("iframe");
      Object.assign(iframe.style, { position: "fixed", left: "-10000px", top: "-10000px", width: bboxW + "px", height: bboxH + "px" });
      document.body.appendChild(iframe);
      const idoc = iframe.contentDocument || iframe.contentWindow.document;
      idoc.open();
      idoc.write('<!DOCTYPE html><html><head></head><body style="margin:0;padding:0;background:#ffffff;"></body></html>');
      idoc.close();

      const styleReset = idoc.createElement("style");
      styleReset.textContent = '* { box-sizing: border-box; filter: none !important; box-shadow: none !important; } text, span, div { font-family: sans-serif; }';
      idoc.head.appendChild(styleReset);

      const circuitClone = idoc.importNode(zoomWrapper, true);
      idoc.body.appendChild(circuitClone);

      // Inline shadow DOM
      shadowHostEls.forEach((liveEl) => {
        const dataId = liveEl.getAttribute("data-thumb-id");
        const clonedHost = idoc.querySelector(`[data-thumb-id="${dataId}"]`);
        if (!clonedHost) return;
        if (liveEl.shadowRoot.adoptedStyleSheets) {
          liveEl.shadowRoot.adoptedStyleSheets.forEach((sheet) => {
            const se = idoc.createElement("style");
            se.textContent = getSerializedShadowSheet(sheet);
            clonedHost.appendChild(se);
          });
        }
        for (let i = 0; i < liveEl.shadowRoot.childNodes.length; i++) {
          clonedHost.appendChild(idoc.importNode(liveEl.shadowRoot.childNodes[i], true));
        }
      });

      // Teleport computed styles
      const propsToCopy = ["display", "position", "left", "top", "width", "height", "transform", "transformOrigin", "color", "fontSize", "fontWeight", "fontFamily", "textAlign", "visibility", "opacity", "backgroundColor", "zIndex", "border", "borderWidth", "borderStyle", "borderColor", "borderRadius", "padding", "margin", "lineHeight", "overflow", "boxSizing", "clipPath", "mask", "filter", "mixBlendMode", "outline", "boxShadow", "textShadow", "cursor"];
      const svgProps = ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "stroke-opacity", "fill-opacity", "fill-rule", "marker-start", "marker-mid", "marker-end"];

      [idoc.body, ...Array.from(idoc.body.querySelectorAll("*"))].forEach((cloned) => {
        const dataId = cloned.getAttribute("data-thumb-id");
        if (!dataId) return;
        const liveEl = elementMap.get(dataId);
        if (!liveEl) return;
        const s = window.getComputedStyle(liveEl);
        propsToCopy.forEach((p) => {
          if (p === "fontSize" && (cloned.tagName === "text" || cloned.tagName === "tspan")) return;
          cloned.style.setProperty(p, s.getPropertyValue(p), "important");
        });
        if (["path", "circle", "rect", "line", "polygon", "text", "ellipse", "g", "svg"].includes(cloned.tagName)) {
          svgProps.forEach((attr) => {
            const val = liveEl.getAttribute(attr) || s.getPropertyValue(attr);
            if (val) {
              const fv = val.includes("color(") ? "#777" : val;
              cloned.setAttribute(attr, fv);
              if (["fill", "stroke", "stroke-width", "opacity", "visibility"].includes(attr)) cloned.style.setProperty(attr, fv, "important");
            }
          });
          const w = s.getPropertyValue("width");
          const h = s.getPropertyValue("height");
          if (w && w !== "auto" && w !== "100%") { cloned.setAttribute("width", w.replace("px", "")); cloned.style.setProperty("width", w, "important"); }
          if (h && h !== "auto" && h !== "100%") { cloned.setAttribute("height", h.replace("px", "")); cloned.style.setProperty("height", h, "important"); }
        }
        cloned.style.setProperty("visibility", "visible", "important");
        cloned.style.setProperty("opacity", s.opacity || "1", "important");
        if (liveEl.shadowRoot) cloned.style.setProperty("overflow", "visible", "important");
      });
      elementMap.clear();

      idoc.body.style.overflow = "visible";
      circuitClone.style.overflow = "visible";
      Object.assign(circuitClone.style, {
        transform: `translate(${-minX}px, ${-minY}px) scale(1)`,
        transformOrigin: "0 0",
        width: bboxW + "px",
        height: bboxH + "px",
        display: "block", margin: "0", padding: "0",
      });

      // 3. Capture at full resolution then shrink to thumbnail size
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const h2c = await getHtml2canvas();
      const rawCanvas = await h2c(idoc.body, {
        backgroundColor: "#ffffff",
        scale: 1,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 5000,
        skipFonts: true,
        width: bboxW,
        height: bboxH,
        onclone: (_d, el) => {
          el.querySelectorAll("path, rect, circle, polygon").forEach((e) => {
            const fill = e.getAttribute("fill");
            if (fill && fill.includes("color(")) e.setAttribute("fill", "#777");
            const stroke = e.getAttribute("stroke");
            if (stroke && stroke.includes("color(")) e.setAttribute("stroke", "#777");
          });
          el.querySelectorAll("text, span, div").forEach((e) => {
            if (e.style.color && e.style.color.includes("color(")) e.style.color = "#1e293b";
          });
        },
      });

      // Clean up iframe
      idoc.body.innerHTML = "";
      idoc.head.innerHTML = "";
      document.body.removeChild(iframe);

      // 4. Shrink to thumbnail dimensions
      const out = document.createElement("canvas");
      out.width = THUMB_W;
      out.height = THUMB_H;
      const ctx = out.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, THUMB_W, THUMB_H);
      ctx.drawImage(rawCanvas, 0, 0, rawCanvas.width, rawCanvas.height, 0, 0, THUMB_W, THUMB_H);

      const dataUrl = out.toDataURL("image/png", 0.7);
      const existing = await loadProject(id);
      if (existing) {
        await saveProject({ ...existing, thumbnail: dataUrl });
      } else {
        await saveProject({ id, thumbnail: dataUrl });
      }
    } catch (err) {
      console.warn("[Thumbnail] capture failed:", err);
    }
  }, [components, wires, board, currentProjectIdRef]);
  captureThumbnailRef.current = captureThumbnail;

  // ── View Panel helpers — SVG Schematic Generator ─────────────────────────
  const generateSchematic = useCallback(() => {
    setSchematicLoading(true);
    setSchematicDataUrl(null);
    try {
      const SW = 1122,
        SH = 794; // A4 landscape px
      const OM = 10,
        GL = 20,
        TH = 65; // outer-margin, grid-label, title height
      const FX1 = OM + GL,
        FY1 = OM + GL;
      const FX2 = SW - OM - GL,
        FY2 = SH - OM - GL - TH;
      const FW = FX2 - FX1,
        FH = FY2 - FY1;

      // ── SVG micro helpers ───────────────────────────────────────────────
      const ln = (x1, y1, x2, y2, sw = 1.5, col = "#1a1a1a") =>
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${sw}"/>`;
      const bx = (x, y, w, h, fill = "white", sw = 1.5, rx = 0) =>
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="#1a1a1a" stroke-width="${sw}"/>`;
      const tx = (
        x,
        y,
        t,
        sz = 9,
        anchor = "middle",
        bold = false,
        fill = "#1a1a1a",
        font = "monospace",
      ) =>
        `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${sz}" font-family="${font}" ${bold ? 'font-weight="bold"' : ""} fill="${fill}">${t}</text>`;
      const circ = (cx, cy, r, fill = "white") =>
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#1a1a1a" stroke-width="1.5"/>`;

      // ── Symbol library ──────────────────────────────────────────────────
      const SYMS = {};

      // LED
      SYMS["wokwi-led"] = {
        w: 72,
        h: 44,
        refPrefix: "D",
        pins: { A: { dx: 0, dy: 22 }, K: { dx: 72, dy: 22 } },
        draw(x, y, comp, ref) {
          const c = comp.attrs?.color || "red";
          const fill =
            c === "green"
              ? "#2a7a2a30"
              : c === "blue"
                ? "#2a2a9a30"
                : c === "yellow"
                  ? "#8a7a0030"
                  : "#c0202030";
          return [
            ln(x, y + 22, x + 16, y + 22),
            `<polygon points="${x + 16},${y + 6} ${x + 16},${y + 38} ${x + 48},${y + 22}" fill="${fill}" stroke="#1a1a1a" stroke-width="1.5"/>`,
            ln(x + 48, y + 6, x + 48, y + 38),
            ln(x + 48, y + 22, x + 72, y + 22),
            ln(x + 38, y + 6, x + 52, y - 5, 1),
            ln(x + 32, y + 6, x + 46, y - 5, 1),
            `<polygon points="${x + 50},${y - 7} ${x + 52},${y - 5} ${x + 48},${y - 4}" fill="#1a1a1a"/>`,
            `<polygon points="${x + 44},${y - 7} ${x + 46},${y - 5} ${x + 42},${y - 4}" fill="#1a1a1a"/>`,
            tx(x + 36, y + 54, ref, 9, "middle", true),
            tx(x + 5, y + 18, "+", 7, "middle", false, "#777"),
            tx(x + 64, y + 18, "−", 7, "middle", false, "#777"),
          ].join("");
        },
      };

      // Resistor
      SYMS["wokwi-resistor"] = {
        w: 70,
        h: 32,
        refPrefix: "R",
        pins: { p1: { dx: 0, dy: 16 }, p2: { dx: 70, dy: 16 } },
        draw(x, y, comp, ref) {
          const v = parseFloat(comp.attrs?.value || 220);
          const u =
            v >= 1e6
              ? `${v / 1e6}M\u03A9`
              : v >= 1000
                ? `${v / 1000}k\u03A9`
                : `${v}\u03A9`;
          return [
            ln(x, y + 16, x + 12, y + 16),
            bx(x + 12, y + 6, 46, 20),
            ln(x + 58, y + 16, x + 70, y + 16),
            tx(x + 35, y + 44, ref, 9, "middle", true),
            tx(x + 35, y + 53, u, 8, "middle", false, "#555"),
          ].join("");
        },
      };

      // Push button
      SYMS["wokwi-pushbutton"] = {
        w: 62,
        h: 48,
        refPrefix: "S",
        pins: { 1: { dx: 0, dy: 28 }, 2: { dx: 62, dy: 28 } },
        draw(x, y, comp, ref) {
          return [
            ln(x, y + 28, x + 16, y + 28),
            ln(x + 16, y + 14, x + 16, y + 42),
            ln(x + 40, y + 14, x + 40, y + 42),
            ln(x + 16, y + 14, x + 46, y + 9),
            ln(x + 40, y + 28, x + 62, y + 28),
            ln(x + 28, y + 9, x + 28, y + 2),
            ln(x + 23, y + 2, x + 33, y + 2, 1.5),
            tx(x + 31, y + 60, ref, 9, "middle", true),
          ].join("");
        },
      };

      // Buzzer
      SYMS["wokwi-buzzer"] = {
        w: 52,
        h: 48,
        refPrefix: "BZ",
        pins: { 1: { dx: 0, dy: 24 }, 2: { dx: 52, dy: 24 } },
        draw(x, y, comp, ref) {
          return [
            ln(x, y + 24, x + 10, y + 24),
            bx(x + 10, y + 10, 32, 28),
            `<path d="M${x + 21},${y + 16} Q${x + 26},${y + 11} ${x + 31},${y + 16}" fill="none" stroke="#1a1a1a" stroke-width="1"/>`,
            `<path d="M${x + 17},${y + 13} Q${x + 26},${y + 5} ${x + 35},${y + 13}" fill="none" stroke="#1a1a1a" stroke-width="1"/>`,
            ln(x + 26, y + 24, x + 26, y + 30, 1.5),
            ln(x + 42, y + 24, x + 52, y + 24),
            tx(x + 46, y + 22, "+", 7, "middle", false, "#777"),
            tx(x + 26, y + 60, ref, 9, "middle", true),
          ].join("");
        },
      };

      // Power supply
      SYMS["wokwi-power-supply"] = {
        w: 52,
        h: 70,
        refPrefix: "PS",
        pins: { "5V": { dx: 26, dy: 0 }, GND: { dx: 26, dy: 70 } },
        draw(x, y, comp, ref) {
          const v = comp.attrs?.voltage || "5V";
          return [
            ln(x + 26, y, x + 26, y + 16),
            ln(x + 14, y + 16, x + 38, y + 16, 2),
            ln(x + 26, y + 50, x + 26, y + 70),
            ln(x + 14, y + 50, x + 38, y + 50),
            ln(x + 18, y + 56, x + 34, y + 56),
            ln(x + 22, y + 62, x + 30, y + 62),
            tx(x + 26, y - 4, `+${v}`, 9),
            tx(x + 26, y + 32, ref, 8, "middle", false, "#555"),
          ].join("");
        },
      };

      // Potentiometer
      SYMS["wokwi-potentiometer"] = {
        w: 80,
        h: 72,
        refPrefix: "RV",
        pins: {
          1: { dx: 0, dy: 36 },
          2: { dx: 80, dy: 36 },
          SIG: { dx: 40, dy: 72 },
        },
        draw(x, y, comp, ref) {
          const v = parseFloat(comp.attrs?.value || 50000);
          const u =
            v >= 1e6
              ? `${v / 1e6}M\u03A9`
              : v >= 1000
                ? `${v / 1000}k\u03A9`
                : `${v}\u03A9`;
          return [
            ln(x, y + 36, x + 12, y + 36),
            bx(x + 12, y + 26, 56, 20),
            ln(x + 68, y + 36, x + 80, y + 36),
            ln(x + 40, y + 46, x + 40, y + 60),
            `<polygon points="${x + 34},${y + 46} ${x + 46},${y + 46} ${x + 40},${y + 36}" fill="#1a1a1a"/>`,
            ln(x + 40, y + 60, x + 40, y + 72),
            tx(x + 40, y + 22, u, 7),
            tx(x + 40, y + 84, ref, 9, "middle", true),
          ].join("");
        },
      };

      // Servo
      SYMS["wokwi-servo"] = {
        w: 90,
        h: 56,
        refPrefix: "SV",
        pins: {
          GND: { dx: 18, dy: 56 },
          "V+": { dx: 45, dy: 56 },
          PWM: { dx: 72, dy: 56 },
        },
        draw(x, y, comp, ref) {
          return [
            bx(x + 5, y + 5, 80, 36, undefined, 1.5, 3),
            tx(
              x + 45,
              y + 28,
              "SERVO",
              10,
              "middle",
              true,
              "#1a1a1a",
              "sans-serif",
            ),
            ln(x + 18, y + 41, x + 18, y + 56),
            ln(x + 45, y + 41, x + 45, y + 56),
            ln(x + 72, y + 41, x + 72, y + 56),
            tx(x + 18, y + 66, "GND", 7),
            tx(x + 45, y + 66, "V+", 7),
            tx(x + 72, y + 66, "PWM", 7),
            tx(x + 45, y + 76, ref, 9, "middle", true),
          ].join("");
        },
      };

      // DC Motor
      SYMS["wokwi-motor"] = {
        w: 60,
        h: 52,
        refPrefix: "M",
        pins: { 1: { dx: 0, dy: 26 }, 2: { dx: 60, dy: 26 } },
        draw(x, y, comp, ref) {
          return [
            ln(x, y + 26, x + 8, y + 26),
            circ(x + 30, y + 26, 18),
            tx(
              x + 30,
              y + 30,
              "M",
              14,
              "middle",
              true,
              "#1a1a1a",
              "sans-serif",
            ),
            ln(x + 52, y + 26, x + 60, y + 26),
            tx(x + 30, y + 56, ref, 9, "middle", true),
          ].join("");
        },
      };

      // NeoPixel
      SYMS["wokwi-neopixel-matrix"] = {
        w: 80,
        h: 62,
        refPrefix: "NP",
        pins: {
          DIN: { dx: 0, dy: 31 },
          VCC: { dx: 40, dy: 0 },
          GND: { dx: 40, dy: 62 },
        },
        draw(x, y, comp, ref) {
          return [
            bx(x + 10, y + 10, 60, 42, "#111"),
            ln(x, y + 31, x + 10, y + 31),
            ln(x + 40, y, x + 40, y + 10),
            ln(x + 40, y + 52, x + 40, y + 62),
            `<circle cx="${x + 30}" cy="${y + 26}" r="5" fill="#f00" opacity="0.9"/>`,
            `<circle cx="${x + 40}" cy="${y + 26}" r="5" fill="#0f0" opacity="0.9"/>`,
            `<circle cx="${x + 50}" cy="${y + 26}" r="5" fill="#00f" opacity="0.9"/>`,
            `<circle cx="${x + 35}" cy="${y + 38}" r="5" fill="#ff0" opacity="0.9"/>`,
            `<circle cx="${x + 45}" cy="${y + 38}" r="5" fill="#0ff" opacity="0.9"/>`,
            tx(x + 40, y + 76, ref, 9, "middle", true),
          ].join("");
        },
      };

      // 74HC595 Shift Register
      SYMS["shift_register"] = {
        w: 120,
        h: 210,
        refPrefix: "IC",
        pins: {
          vcc: { dx: 60, dy: 0 },
          gnd: { dx: 60, dy: 210 },
          ser: { dx: 0, dy: 40 },
          srclk: { dx: 0, dy: 58 },
          rclk: { dx: 0, dy: 76 },
          oe: { dx: 0, dy: 94 },
          srclr: { dx: 0, dy: 112 },
          q0: { dx: 120, dy: 40 },
          q1: { dx: 120, dy: 58 },
          q2: { dx: 120, dy: 76 },
          q3: { dx: 120, dy: 94 },
          q4: { dx: 120, dy: 112 },
          q5: { dx: 120, dy: 130 },
          q6: { dx: 120, dy: 148 },
          q7: { dx: 120, dy: 166 },
          q7s: { dx: 120, dy: 184 },
        },
        draw(x, y, comp, ref) {
          const LP = [
            ["SER", 40],
            ["SRCLK", 58],
            ["RCLK", 76],
            ["~OE", 94],
            ["~SRCLR", 112],
          ];
          const RP = [
            ["Q0", 40],
            ["Q1", 58],
            ["Q2", 76],
            ["Q3", 94],
            ["Q4", 112],
            ["Q5", 130],
            ["Q6", 148],
            ["Q7", 166],
            ["Q7'", 184],
          ];
          return [
            bx(x + 15, y + 12, 90, 186),
            tx(x + 60, y + 28, "74HC595", 9, "middle", true),
            tx(x + 60, y + 10, ref, 7, "middle", false, "#555"),
            ln(x + 60, y, x + 60, y + 12),
            tx(x + 60, y - 2, "VCC", 7),
            ln(x + 60, y + 198, x + 60, y + 210),
            tx(x + 60, y + 220, "GND", 7),
            ...LP.map(
              ([l, dy]) =>
                ln(x, y + dy, x + 15, y + dy) +
                `<text x="${x + 18}" y="${y + dy + 3}" font-size="6.5" font-family="monospace" fill="#1a1a1a">${l}</text>`,
            ),
            ...RP.map(
              ([l, dy]) =>
                ln(x + 105, y + dy, x + 120, y + dy) +
                `<text x="${x + 102}" y="${y + dy + 3}" text-anchor="end" font-size="6.5" font-family="monospace" fill="#1a1a1a">${l}</text>`,
            ),
          ].join("");
        },
      };

      // L298N Motor Driver
      SYMS["wokwi-motor-driver"] = {
        w: 130,
        h: 170,
        refPrefix: "MD",
        pins: {
          ENA: { dx: 0, dy: 30 },
          IN1: { dx: 0, dy: 50 },
          IN2: { dx: 0, dy: 70 },
          IN3: { dx: 0, dy: 90 },
          IN4: { dx: 0, dy: 110 },
          ENB: { dx: 0, dy: 130 },
          OUT1: { dx: 130, dy: 30 },
          OUT2: { dx: 130, dy: 50 },
          OUT3: { dx: 130, dy: 90 },
          OUT4: { dx: 130, dy: 110 },
          "12V": { dx: 30, dy: 0 },
          GND: { dx: 65, dy: 0 },
          "5V": { dx: 100, dy: 0 },
        },
        draw(x, y, comp, ref) {
          const LP = [
            ["ENA", 30],
            ["IN1", 50],
            ["IN2", 70],
            ["IN3", 90],
            ["IN4", 110],
            ["ENB", 130],
          ];
          const RP = [
            ["OUT1", 30],
            ["OUT2", 50],
            ["OUT3", 90],
            ["OUT4", 110],
          ];
          const TP = [
            ["12V", 30],
            ["GND", 65],
            ["5V", 100],
          ];
          return [
            bx(x + 15, y + 12, 100, 148),
            tx(
              x + 65,
              y + 34,
              "L298N",
              10,
              "middle",
              true,
              "#1a1a1a",
              "sans-serif",
            ),
            tx(x + 65, y + 10, ref, 7, "middle", false, "#555"),
            ...LP.map(
              ([l, dy]) =>
                ln(x, y + dy, x + 15, y + dy) +
                `<text x="${x + 18}" y="${y + dy + 3}" font-size="6.5" font-family="monospace" fill="#1a1a1a">${l}</text>`,
            ),
            ...RP.map(
              ([l, dy]) =>
                ln(x + 115, y + dy, x + 130, y + dy) +
                `<text x="${x + 112}" y="${y + dy + 3}" text-anchor="end" font-size="6.5" font-family="monospace" fill="#1a1a1a">${l}</text>`,
            ),
            ...TP.map(
              ([l, dx]) =>
                ln(x + dx, y, x + dx, y + 12) +
                `<text x="${x + dx}" y="${y - 2}" text-anchor="middle" font-size="6.5" font-family="monospace" fill="#1a1a1a">${l}</text>`,
            ),
          ].join("");
        },
      };

      // Arduino Uno ─────────────────────────────────────────────────────────
      const UL = [
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10",
        "11",
        "12",
        "13",
      ];
      const UR = [
        "A0",
        "A1",
        "A2",
        "A3",
        "A4",
        "A5",
        "vin",
        "gnd_1",
        "gnd_2",
        "gnd_3",
        "5V",
        "3v3",
        "rst",
        "ioref",
      ];
      const ULL = [
        "D0",
        "D1",
        "D2",
        "D3",
        "D4",
        "D5~",
        "D6~",
        "D7",
        "D8",
        "D9~",
        "D10~",
        "D11~",
        "D12",
        "D13",
      ];
      const URL2 = [
        "A0",
        "A1",
        "A2",
        "A3",
        "A4",
        "A5",
        "VIN",
        "GND",
        "GND",
        "GND",
        "5V",
        "3.3V",
        "RST",
        "IOREF",
      ];
      const UPS = 18,
        UW = 148,
        UH = UL.length * UPS + 46;
      const unoPins = {};
      UL.forEach((id, i) => {
        unoPins[id] = { dx: 0, dy: 34 + i * UPS };
      });
      UR.forEach((id, i) => {
        unoPins[id] = { dx: UW, dy: 34 + i * UPS };
      });
      SYMS["wokwi-arduino-uno"] = {
        w: UW,
        h: UH,
        refPrefix: "U",
        pins: unoPins,
        draw(x, y, comp, ref) {
          return [
            bx(x + 16, y + 14, UW - 32, UH - 28),
            tx(x + UW / 2, y + 30, "Arduino Uno", 10, "middle", true),
            tx(x + UW / 2, y + 10, ref, 8, "middle", false, "#555"),
            tx(x + UW / 2, y + 44, "ATmega328P", 7, "middle", false, "#777"),
            ...UL.map((id, i) => {
              const py = y + 34 + i * UPS;
              return (
                ln(x, py, x + 16, py) +
                `<text x="${x + 19}" y="${py + 3}" font-size="6.5" font-family="monospace" fill="#1a1a1a">${ULL[i]}</text>`
              );
            }),
            ...UR.map((id, i) => {
              const py = y + 34 + i * UPS;
              return (
                ln(x + UW - 16, py, x + UW, py) +
                `<text x="${x + UW - 19}" y="${py + 3}" text-anchor="end" font-size="6.5" font-family="monospace" fill="#1a1a1a">${URL2[i]}</text>`
              );
            }),
          ].join("");
        },
      };

      // Aliases for openhw- rebranded components
      SYMS["openhw-led"] = SYMS["wokwi-led"];
      SYMS["openhw-resistor"] = SYMS["wokwi-resistor"];
      SYMS["openhw-pushbutton"] = SYMS["wokwi-pushbutton"];
      SYMS["openhw-buzzer"] = SYMS["wokwi-buzzer"];
      SYMS["openhw-power-supply"] = SYMS["wokwi-power-supply"];
      SYMS["openhw-potentiometer"] = SYMS["wokwi-potentiometer"];
      SYMS["openhw-servo"] = SYMS["wokwi-servo"];
      SYMS["openhw-motor"] = SYMS["wokwi-motor"];
      SYMS["openhw-neopixel-matrix"] = SYMS["wokwi-neopixel-matrix"];
      SYMS["openhw-motor-driver"] = SYMS["wokwi-motor-driver"];
      SYMS["openhw-arduino-uno"] = SYMS["wokwi-arduino-uno"];

      // Generic fallback IC ─────────────────────────────────────────────────
      const makeGenericSym = (comp) => {
        const used = new Set();
        wires.forEach((w) => {
          const [ci, pi] = w.from.split(":");
          if (ci === comp.id && pi) used.add(pi);
          const [ci2, pi2] = w.to.split(":");
          if (ci2 === comp.id && pi2) used.add(pi2);
        });
        const pl = [...used];
        const half = Math.ceil(pl.length / 2);
        const lp = pl.slice(0, half),
          rp = pl.slice(half);
        const rows = Math.max(lp.length, rp.length, 2),
          gh = rows * 20 + 44,
          gw = 100;
        const pins = {};
        lp.forEach((id, i) => {
          pins[id] = { dx: 0, dy: 32 + i * 20 };
        });
        rp.forEach((id, i) => {
          pins[id] = { dx: gw + 30, dy: 32 + i * 20 };
        });
        return {
          w: gw + 30,
          h: gh,
          refPrefix: "IC",
          pins,
          draw(x, y, _c, ref) {
            const sType = _c.type.replace(/^(wokwi-|openhw-)/, "");
            return [
              bx(x + 15, y + 12, gw, gh - 24),
              tx(x + 15 + gw / 2, y + 28, sType, 8, "middle", true),
              tx(x + 15 + gw / 2, y + 10, ref, 7, "middle", false, "#555"),
              ...lp.map(
                (id, i) =>
                  ln(x, y + 32 + i * 20, x + 15, y + 32 + i * 20) +
                  `<text x="${x + 18}" y="${y + 36 + i * 20}" font-size="6.5" font-family="monospace" fill="#1a1a1a">${id}</text>`,
              ),
              ...rp.map(
                (id, i) =>
                  ln(
                    x + gw + 15,
                    y + 32 + i * 20,
                    x + gw + 30,
                    y + 32 + i * 20,
                  ) +
                  `<text x="${x + gw + 12}" y="${y + 36 + i * 20}" text-anchor="end" font-size="6.5" font-family="monospace" fill="#1a1a1a">${id}</text>`,
              ),
            ].join("");
          },
        };
      };

      // ── Layout ────────────────────────────────────────────────────────────
      if (components.length === 0) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}"><rect width="${SW}" height="${SH}" fill="white"/><text x="${SW / 2}" y="${SH / 2}" text-anchor="middle" font-size="18" fill="#aaa" font-family="sans-serif">No components on canvas</text></svg>`;
        schematicSvgRef.current = svg;
        setSchematicDataUrl(
          `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`,
        );
        return;
      }

      // Assign reference designators (sorted left-to-right by canvas x)
      const sorted = [...components].sort((a, b) => a.x - b.x);
      const refCounts = {},
        compSymMap = {},
        compRefMap = {};
      sorted.forEach((c) => {
        let sym = SYMS[c.type];
        if (!sym) sym = makeGenericSym(c);
        compSymMap[c.id] = sym;
        const pre = sym.refPrefix;
        refCounts[pre] = (refCounts[pre] || 0) + 1;
        compRefMap[c.id] = `${pre}${refCounts[pre]}`;
      });

      // Bounding box (canvas component centers)
      let mnX = 1e9,
        mnY = 1e9,
        mxX = -1e9,
        mxY = -1e9;
      components.forEach((c) => {
        const cx = c.x + (c.w || 60) / 2,
          cy = c.y + (c.h || 60) / 2;
        mnX = Math.min(mnX, cx);
        mnY = Math.min(mnY, cy);
        mxX = Math.max(mxX, cx);
        mxY = Math.max(mxY, cy);
      });

      const PAD = 70;
      const availW = FW - PAD * 2,
        availH = FH - PAD * 2;
      const srcW = Math.max(mxX - mnX, 1),
        srcH = Math.max(mxY - mnY, 1);
      const sc = Math.min(availW / srcW, availH / srcH, 1.8);

      const toSch = (cx, cy) => ({
        x: FX1 + PAD + (cx - mnX) * sc,
        y: FY1 + PAD + (cy - mnY) * sc,
      });

      // Symbol top-left positions
      const cPos = {};
      components.forEach((c) => {
        const sym = compSymMap[c.id];
        const cx = c.x + (c.w || 60) / 2,
          cy = c.y + (c.h || 60) / 2;
        const s = toSch(cx, cy);
        cPos[c.id] = { x: s.x - sym.w / 2, y: s.y - sym.h / 2 };
      });

      // Pin world position helper
      const pinXY = (compId, pinId) => {
        const c = components.find((cc) => cc.id === compId);
        if (!c) return null;
        const sym = compSymMap[c.id];
        if (!sym) return null;
        const pos = cPos[c.id];
        const pin = sym.pins[pinId];
        if (!pin) return { x: pos.x + sym.w, y: pos.y + sym.h / 2 };
        return { x: pos.x + pin.dx, y: pos.y + pin.dy };
      };

      // ── Components SVG ────────────────────────────────────────────────────
      const compsSVG = components
        .map((c) => {
          const sym = compSymMap[c.id];
          const pos = cPos[c.id];
          const ref = compRefMap[c.id];
          return `<g class="comp" id="${c.id}">${sym.draw(pos.x, pos.y, c, ref)}</g>`;
        })
        .join("\n");

      // ── Wires SVG ─────────────────────────────────────────────────────────
      const wiresSVG = wires
        .map((w) => {
          const [fC, fP] = w.from.split(":"),
            [tC, tP] = w.to.split(":");
          const p1 = pinXY(fC, fP),
            p2 = pinXY(tC, tP);
          if (!p1 || !p2) return "";
          // Route: horizontal from p1 half-way, then vertical, then horizontal to p2
          const midX = (p1.x + p2.x) / 2;
          const d = `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} L${midX.toFixed(1)},${p1.y.toFixed(1)} L${midX.toFixed(1)},${p2.y.toFixed(1)} L${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
          // Junction dot at middle junction if same Y (direct horizontal)
          const dot =
            Math.abs(p1.y - p2.y) < 1
              ? ""
              : `<circle cx="${midX.toFixed(1)}" cy="${p1.y.toFixed(1)}" r="2.5" fill="#1a1a1a"/>`;
          return `<path d="${d}" fill="none" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>${dot}`;
        })
        .filter(Boolean)
        .join("\n");

      // ── Border + grid coordinates ─────────────────────────────────────────
      const GCOLS = 6,
        GROWS = 4,
        GRL = ["A", "B", "C", "D"];
      const cStep = FW / GCOLS,
        rStep = FH / GROWS;
      let borderSVG = `
        <rect x="${OM}" y="${OM}" width="${SW - OM * 2}" height="${SH - OM * 2}" fill="none" stroke="#cc0000" stroke-width="1.2"/>
        <rect x="${FX1}" y="${FY1}" width="${FW}" height="${FH}" fill="none" stroke="#cc0000" stroke-width="2"/>
      `;
      for (let c = 1; c < GCOLS; c++) {
        const gx = FX1 + c * cStep;
        borderSVG += `${ln(gx, FY1, gx, FY1 - 3, 0.5, "#777")}${ln(gx, FY2, gx, FY2 + 3, 0.5, "#777")}`;
      }
      for (let r = 1; r < GROWS; r++) {
        const gy = FY1 + r * rStep;
        borderSVG += `${ln(FX1, gy, FX1 - 3, gy, 0.5, "#777")}${ln(FX2, gy, FX2 + 3, gy, 0.5, "#777")}`;
      }
      for (let c = 0; c < GCOLS; c++) {
        const cx = FX1 + c * cStep + cStep / 2;
        borderSVG += tx(
          cx,
          FY1 - 5,
          c + 1,
          8,
          "middle",
          false,
          "#444",
          "sans-serif",
        );
        borderSVG += tx(
          cx,
          FY2 + 14,
          c + 1,
          8,
          "middle",
          false,
          "#444",
          "sans-serif",
        );
      }
      for (let r = 0; r < GROWS; r++) {
        const ry = FY1 + r * rStep + rStep / 2 + 4;
        borderSVG += tx(
          FX1 - 5,
          ry,
          GRL[r],
          8,
          "end",
          false,
          "#444",
          "sans-serif",
        );
        borderSVG += tx(
          FX2 + 5,
          ry,
          GRL[r],
          8,
          "start",
          false,
          "#444",
          "sans-serif",
        );
      }

      // ── Title block ───────────────────────────────────────────────────────
      const TBY = FY2,
        TBH2 = SH - OM - GL - FY2,
        divW = FW / 3;
      const boardLabel =
        board === "arduino_uno"
          ? "Arduino Uno"
          : board === "pico"
            ? "Raspberry Pi Pico"
            : "ESP32";
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
      console.error("[Schematic]", err);
    } finally {
      setSchematicLoading(false);
    }
  }, [components, wires, board]);

  const downloadSchematicPng = useCallback(() => {
    const svgStr = schematicSvgRef.current;
    if (!svgStr) return;
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 2244;
      canvas.height = 1588; // 2x high-res
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png", 0.95);
      a.download = "schematic.png";
      a.click();
    };
    img.onerror = () => {
      // Fallback: download SVG
      const a = document.createElement("a");
      a.href = url;
      a.download = "schematic.svg";
      a.click();
    };
    img.src = url;
  }, []);

  const downloadSchematicPdf = useCallback(() => {
    const svgStr = schematicSvgRef.current;
    if (!svgStr) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      `<html><head><title>Schematic</title>` +
      `<style>@page{margin:0;size:A4 landscape}body{margin:0;padding:0}svg{width:100%;height:auto;display:block}</style></head>` +
      `<body>${svgStr}<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};}<\/script></body></html>`,
    );
    win.document.close();
  }, []);

  const downloadCompCsv = () => {
    const counts = {};
    components.forEach((c) => {
      if (!counts[c.type])
        counts[c.type] = { type: c.type, label: c.label, count: 0 };
      counts[c.type].count++;
    });
    const rows = Object.values(counts);
    let csv = "#,Component,Type,Quantity\n";
    rows.forEach((row, i) => {
      csv += `${i + 1},"${row.label}","${row.type}",${row.count}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "components.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  };

  // ── PNG Import ────────────────────────────────────────────────────────────
  const importFileRef = useRef(null);

  const applyImportedProjectMeta = (meta, sourceLabel = "Import") => {
    const importedComponents = Array.isArray(meta?.components)
      ? meta.components
      : [];
    const importedConnections = Array.isArray(meta?.connections)
      ? meta.connections
      : Array.isArray(meta?.wires)
        ? meta.wires
        : [];
    const { components: normalizedComponents, wires: normalizedConnections } =
      normalizeImportedCircuitData(importedComponents, importedConnections);

    const hasExisting = components.length > 0 || wires.length > 0;
    if (
      hasExisting &&
      !window.confirm(
        `Import will replace your current circuit (${components.length} components, ${wires.length} wires). Continue?`,
      )
    ) {
      return;
    }

    saveHistory();
    if (meta?.board) setBoard(meta.board);
    if (Object.prototype.hasOwnProperty.call(meta || {}, "code"))
      setCode(String(meta.code || ""));
    if (Object.prototype.hasOwnProperty.call(meta || {}, "blocklyXml"))
      setBlocklyXml(String(meta.blocklyXml || ""));
    if (
      Object.prototype.hasOwnProperty.call(meta || {}, "blocklyGeneratedCode")
    )
      setBlocklyGeneratedCode(String(meta.blocklyGeneratedCode || ""));
    if (Object.prototype.hasOwnProperty.call(meta || {}, "useBlocklyCode"))
      setUseBlocklyCode(!!meta.useBlocklyCode);

    setComponents(normalizedComponents);
    setWires(normalizedConnections);

    const importedBoards = normalizedComponents.filter((c) =>
      /(arduino|esp32|stm32|rp2040|pico)/i.test(c.type),
    );
    let normalizedFiles = normalizeProjectFiles(
      Array.isArray(meta?.projectFiles) ? meta.projectFiles : [],
    );

    // Backward compatibility: older exports stored only top-level `code`.
    if (
      normalizedFiles.length === 0 &&
      typeof meta?.code === "string" &&
      meta.code.trim()
    ) {
      if (importedBoards.length > 0) {
        normalizedFiles = importedBoards.map((bc, idx) => {
          const boardKind = normalizeBoardKind(bc.type);
          const rp2040Mode =
            boardKind === "rp2040"
              ? normalizeRp2040Env(
                resolveComponentAttrString(bc?.attrs, "env", "native"),
              )
              : "native";
          const fileName = getDefaultMainFileName(boardKind, bc.id, {
            rp2040Mode,
          });
          const path = `project/${bc.id}/${fileName}`;
          return {
            id: path,
            path,
            name: fileName,
            kind: "code",
            boardId: bc.id,
            boardKind,
            content:
              idx === 0
                ? meta.code
                : createDefaultMainCode(boardKind, bc.id, { rp2040Mode }),
            dirty: false,
          };
        });
      }
    }

    if (
      normalizedFiles.length > 0 &&
      typeof meta?.code === "string" &&
      meta.code.trim()
    ) {
      const codeFileIdx = normalizedFiles.findIndex(
        (f) =>
          f.kind === "code" ||
          /\.(ino|h|hpp|c|cpp|py)$/i.test(f.name || f.path || ""),
      );
      const hasCodeContent = normalizedFiles.some((f) => {
        if (
          !(
            f.kind === "code" ||
            /\.(ino|h|hpp|c|cpp|py)$/i.test(f.name || f.path || "")
          )
        )
          return false;
        return String(f.content || "").trim().length > 0;
      });
      if (!hasCodeContent && codeFileIdx >= 0) {
        const target = normalizedFiles[codeFileIdx];
        normalizedFiles[codeFileIdx] = { ...target, content: meta.code };
      }
    }

    normalizedFiles = normalizeProjectFiles(normalizedFiles);
    const normalizedTabs = normalizeOpenCodeTabs(
      Array.isArray(meta?.openCodeTabs) ? meta.openCodeTabs : [],
      normalizedFiles,
    );
    const preferredActive =
      typeof meta?.activeCodeFileId === "string"
        ? meta.activeCodeFileId.trim()
        : "";
    const activeId = normalizedFiles.some((f) => f.id === preferredActive && f.id !== "project/diagram.json")
      ? preferredActive
      : normalizedTabs.find((t) => t !== "project/diagram.json") || normalizedFiles.find((f) => f.id !== "project/diagram.json")?.id || "";

    setProjectFiles(normalizedFiles);
    setOpenCodeTabs(normalizedTabs);
    setActiveCodeFileId(activeId);

    syncNextIds(normalizedComponents, normalizedConnections);
    setSelected(null);
    setWireStart(null);
    lastCompiledRef.current = null;
    if (canvasOnly) {
      window.parent?.postMessage({ type: 'circuit-ready' }, '*');
    }
    appendConsoleEntry(
      "info",
      `${sourceLabel} imported: ${normalizedComponents.length} components, ${normalizedConnections.length} connections.`,
      "simulator",
    );
  };

  const importPng = (file) => {
    if (!file) return;
    if (isRunning || isCompiling) {
      alert("Stop the current simulation before importing a project file.");
      if (importFileRef.current) importFileRef.current.value = "";
      return;
    }

    const fileName = String(file.name || "").toLowerCase();
    const isPng = fileName.endsWith(".png");
    const isJson = fileName.endsWith(".json");

    if (!isPng && !isJson) {
      alert("Please select an OpenHW-Studio PNG or JSON file.");
      if (importFileRef.current) importFileRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (isPng) {
          const meta = extractProjectMetaFromPng(
            new Uint8Array(e.target.result),
          );
          applyImportedProjectMeta(meta, "PNG project");
          return;
        }

        const jsonText = String(e.target.result || "");
        const meta = JSON.parse(jsonText);
        applyImportedProjectMeta(meta, "JSON project");
      } catch (err) {
        const sourceLabel = isPng ? "PNG" : "JSON";
        console.error(`[${sourceLabel} Import] Parse error:`, err);
        alert(
          `Failed to parse circuit data from ${sourceLabel}: ${err.message}`,
        );
      } finally {
        // Reset the file input so the same file can be re-imported.
        if (importFileRef.current) importFileRef.current.value = "";
      }
    };

    if (isPng) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return SimulatorPageContent();

  function SimulatorPageContent() {
    const chrome = {
      setShowCanvasMenu,
      setShowInspector,
      setShowGrid,
      setIsCanvasLocked,
      setShowComponentDesc,
      setShowConnectionsPanel,
      setShowF1Menu,
      setShowSpeedDialog,
      setShowSaveDialog,
    };

    // Global Keyboard Shortcuts
    useSimulatorShortcuts({
      selected,
      isRunning,
      liveEditingDisabled,
      saveHistory,
      handleSave,
      undo,
      redo,
      handleRun,
      handleStop,
      rotateComponent,
      components,
      setShowShortcuts,
      setCanvasZoom,
      setCanvasOffset,
      setShowProjectsSidebar,
      setProjectsSidebarTab,
      wireStart,
      setWireStart,
      setSelected,
      setWireClickPos,
      setWires,
      setComponents,
      applyZoomAtCenter,
      showProjectsSidebar,
      handleNewProject,
      setIsConsoleOpen,
      setShowGrid,
      setIsCanvasLocked,
      isPanelOpen,
      setIsPanelOpen,
      codeTab,
      setCodeTab,
      fitToView,
      setWiresAlwaysOnTop,
      setShowCodeExplorer,
      setShowF1Menu,
      canvasZoomRef,
      canvasOffsetRef,
      innerCanvasRef,
      setProjectFiles,
      activeCodeFileId,
      code,
      setCode,
      handleExportPng: downloadPng,
      handleImportPng: () => importFileRef.current?.click(),
    });

    return (
      <div
        className="flex flex-col h-screen overflow-hidden bg-[var(--bg)] font-sans text-[var(--text)] min-h-screen"
        ref={pageRef}
      >
        {/* Restore Session Toaster */}
        {restoreProjectPrompt && (
          <div
            style={{
              position: "fixed",
              top: "80px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--card)",
              border: "1px solid var(--accent)",
              boxShadow:
                "0 8px 32px rgba(0, 212, 255, 0.15), 0 0 0 1px rgba(0, 212, 255, 0.3)",
              borderRadius: "12px",
              padding: "16px 24px",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              gap: "20px",
              color: "var(--text)",
              animation: "panelContentIn 0.3s ease-out",
              pointerEvents: "auto",
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ flex: 1 }}>
              <h4
                style={{
                  margin: "0 0 4px 0",
                  fontSize: "15px",
                  fontWeight: "bold",
                  color: "var(--text)",
                }}
              >
                Restore previous session?
              </h4>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text2)" }}>
                We found your project{" "}
                <strong>"{restoreProjectPrompt.name || "Untitled"}"</strong>{" "}
                from your last visit.
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNewProject();
                  setRestoreProjectPrompt(null);
                }}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text2)",
                  padding: "8px 14px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  transition: "all 0.2s",
                  pointerEvents: "auto",
                }}
                onMouseEnter={(e) =>
                  (e.target.style.background = "var(--card2)")
                }
                onMouseLeave={(e) =>
                  (e.target.style.background = "transparent")
                }
              >
                Start Fresh
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    handleLoadProject(restoreProjectPrompt);
                  } catch (err) {
                    console.error("Error during project restore", err);
                  } finally {
                    setRestoreProjectPrompt(null);
                  }
                }}
                style={{
                  background: "var(--accent)",
                  border: "none",
                  color: "#000",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "700",
                  boxShadow: "0 4px 12px rgba(0, 212, 255, 0.3)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = "translateY(-1px)";
                  e.target.style.boxShadow =
                    "0 6px 16px rgba(0, 212, 255, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = "none";
                  e.target.style.boxShadow =
                    "0 4px 12px rgba(0, 212, 255, 0.3)";
                }}
              >
                Restore Project
              </button>
            </div>
          </div>
        )}

        {/* TOP BAR */}
        {!canvasOnly && (
          <TopToolbox
            board={board}
            setBoard={setBoard}
            isRunning={isRunning}
            isPaused={isPaused}
            handleRun={handleRun}
            handlePause={handlePause}
            handleResume={handleResume}
            handleStop={handleStop}
            isCompiling={isCompiling}
            isBooting={isBooting}
            assessmentMode={assessmentMode}
            assessmentProjectName={assessmentProjectName}
            isSubmittingAssessment={isSubmittingAssessment}
            handleAssessmentSubmit={handleAssessmentSubmit}
            undo={undo}
            redo={redo}
            selected={selected}
            rotateComponent={rotateComponent}
            theme={theme}
            toggleTheme={toggleTheme}
            showViewPanel={showViewPanel}
            setShowViewPanel={setShowViewPanel}
            viewPanelSection={viewPanelSection}
            setViewPanelSection={setViewPanelSection}
            schematicDataUrl={schematicDataUrl}
            setSchematicDataUrl={setSchematicDataUrl}
            schematicLoading={schematicLoading}
            setSchematicLoading={setSchematicLoading}
            downloadSchematicPng={downloadSchematicPng}
            downloadSchematicPdf={downloadSchematicPdf}
            generateSchematic={generateSchematic}
            downloadCompCsv={downloadCompCsv}
            importFileRef={importFileRef}
            downloadPng={downloadPng}
            importPng={importPng}
            downloadSimulationJson={downloadSimulationJson}
            handleSave={handleSave}
            isExporting={isExporting}
            handleShareSimulation={handleShareSimulation}
            isSharingSimulation={isSharingSimulation}
            refreshProjectList={refreshProjectList}
            showProjectsDropdown={showProjectsDropdown}
            setShowProjectsDropdown={setShowProjectsDropdown}
            handleNewProject={handleNewProject}
            handleStartRename={handleStartRename}
            handleConfirmRename={handleConfirmRename}
            renamingProjectId={renamingProjectId}
            setRenamingProjectId={setRenamingProjectId}
            renameValue={renameValue}
            setRenameValue={setRenameValue}
            handleLoadProject={handleLoadProject}
            handleDeleteProject={handleDeleteProject}
            handleBackupWorkflow={handleBackupWorkflow}
            backupRestoreInputRef={backupRestoreInputRef}
            wokwiImportInputRef={wokwiImportInputRef}
            handleImportWokwiZip={handleImportWokwiZip}
            handleRestoreWorkflow={handleRestoreWorkflow}
            handleSyncToCloud={handleSyncToCloud}
            user={activeUser}
            gamPanelOpen={gamPanelOpen}
            setGamPanelOpen={setGamPanelOpen}
            gamificationMode={gamificationMode}
            navigate={navigate}
            isAuthenticated={isAnyAuthenticated}
            myProjects={myProjects}
            currentProjectId={currentProjectId}
            projectName={currentProjectName}
            formatProjectDate={formatProjectDate}
            saveHistory={saveHistory}
            setWires={setWires}
            setComponents={setComponents}
            setSelected={setSelected}
            history={history}
            components={components}
            wires={wires}
            webSerialSupported={webSerialSupported}
            hardwareBoards={boardComponents}
            hardwareBoardId={hardwareBoardId}
            setHardwareBoardId={handleHardwareBoardChange}
            hardwarePortPath={hardwarePortPath}
            setHardwarePortPath={setHardwarePortPath}
            resolvedHardwarePort={resolvedHardwarePort}
            hardwareAvailablePorts={hardwareAvailablePorts}
            showAllHardwarePorts={showAllHardwarePorts}
            setShowAllHardwarePorts={setShowAllHardwarePorts}
            refreshHardwarePorts={refreshHardwarePorts}
            isLoadingHardwarePorts={isLoadingHardwarePorts}
            hardwareBaudRate={hardwareBaudRate}
            setHardwareBaudRate={setHardwareBaudRate}
            hardwareResetMethod={hardwareResetMethod}
            setHardwareResetMethod={setHardwareResetMethod}
            connectHardwareSerial={connectHardwareSerial}
            disconnectHardwareSerial={disconnectHardwareSerial}
            uploadToHardware={handleUploadToHardware}
            hardwareConnected={hardwareConnected}
            hardwareConnecting={hardwareConnecting}
            isUploadingHardware={isUploadingHardware}
            hardwareStatus={hardwareStatus}
            editingDisabled={liveEditingDisabled}
            setShowProjectsSidebar={setShowProjectsSidebar}
            setProjectsSidebarTab={setProjectsSidebarTab}
            validationErrors={validationErrors}
            autofixPlan={autofixPlan}
            autofixStatus={autofixStatus}
            autofixLog={autofixLog}
            onApplyPlan={handleApplyPlan}
            onRefresh={triggerAutofixAnalysis}
            autoWiringEnabled={autoWiringEnabled}
            setAutoWiringEnabled={setAutoWiringEnabled}
            autoBreadboardEnabled={autoBreadboardEnabled}
            setAutoBreadboardEnabled={setAutoBreadboardEnabled}
            autoCodingEnabled={autoCodingEnabled}
            setAutoCodingEnabled={setAutoCodingEnabled}
            showAutofix={showAutofix}
            setShowAutofix={setShowAutofix}
            showShortcuts={showShortcuts}
            setShowShortcuts={setShowShortcuts}
            useBlocklyCode={useBlocklyCode}
            setUseBlocklyCode={setUseBlocklyCode}
            onStartTour={() => {
              localStorage.removeItem("openhw-tour-completed");
              setShowTour(true);
            }}
            returnTo={location.search.includes("returnTo") ? new URLSearchParams(location.search).get("returnTo") : null}
            code={code}
          />
        )}

        {!canvasOnly && (<>
          <SimulatorStatusBanners
            studentAssignmentMode={studentAssignmentMode}
            assignmentSubmissionAssignment={assignmentSubmissionAssignment}
            isAssignmentSubmissionClosed={isAssignmentSubmissionClosed}
            assignmentSubmissionState={assignmentSubmissionState}
            handleSubmitClassAssignment={handleSubmitClassAssignment}
            liveMeetingMode={liveMeetingMode}
            isLiveTeacher={isLiveTeacher}
            liveCanEdit={liveCanEdit}
            liveMeetingShareCode={liveMeetingShareCode}
            liveSessionCode={liveSessionCode}
            liveMeetingStatus={liveMeetingStatus}
            liveMeetingParticipantCounts={liveMeetingParticipantCounts}
            liveEditRequestPending={liveEditRequestPending}
            handleRequestLiveEditAccess={handleRequestLiveEditAccess}
            handleEndLiveEditAccess={handleEndLiveEditAccess}
            liveGrantedEditors={liveGrantedEditors}
            handleRespondToLiveEditRequest={handleRespondToLiveEditRequest}
            livePendingEditRequests={livePendingEditRequests}
          />

          <SimulatorDialogsGroup
            activeUser={activeUser}
            showShareDialog={showShareDialog}
            setShowShareDialog={setShowShareDialog}
            isSharingSimulation={isSharingSimulation}
            shareUrl={shareUrl}
            handleCopyShareUrl={handleCopyShareUrl}
            shareCopied={shareCopied}
            shareVisibility={shareVisibility}
            setShareVisibility={handleShareVisibilityChange}
            shareLinkType={shareLinkType}
            setShareLinkType={handleShareLinkTypeChange}
            handleGenerateShareUrl={handleGenerateShareUrl}
            showSaveDialog={showSaveDialog}
            setShowSaveDialog={setShowSaveDialog}
            saveDialogName={saveDialogName}
            setSaveDialogName={setSaveDialogName}
            handleConfirmSave={handleConfirmSave}
            showFirmwareDownloadDialog={showFirmwareDownloadDialog}
            setShowFirmwareDownloadDialog={setShowFirmwareDownloadDialog}
            firmwareDownloadTarget={firmwareDownloadTarget}
            setFirmwareDownloadTarget={setFirmwareDownloadTarget}
            firmwareBoardOptions={firmwareBoardOptions}
            handleDownloadFirmware={handleDownloadFirmware}
            showFirmwareUploadDialog={showFirmwareUploadDialog}
            setShowFirmwareUploadDialog={setShowFirmwareUploadDialog}
            boardComponentMap={boardComponentMap}
            normalizeBoardKind={normalizeBoardKind}
            toggleBoardFirmwareSource={toggleBoardFirmwareSource}
            setFirmwareUploadTarget={setFirmwareUploadTarget}
            firmwareUploadInputRef={firmwareUploadInputRef}
            firmwareUploadTarget={firmwareUploadTarget}
            applyUploadedFirmwareToBoard={applyUploadedFirmwareToBoard}
          />

          <SimulatorChromeOverlays
            previewBanner={previewBanner}
            setPreviewBanner={setPreviewBanner}
            isExporting={isExporting}
            gamificationMode={gamificationMode}
            gamProject={gamProject}
            navigate={navigate}
            currentLevelData={currentLevelData}
            currentLevel={currentLevel}
            xpProgress={xpProgress}
            nextLevel={nextLevel}
            coins={coins}
            gamAllUnlocked={gamAllUnlocked}
            gamLockedCount={gamLockedCount}
            gamPanelOpen={gamPanelOpen}
            setGamPanelOpen={setGamPanelOpen}
            handleGamificationSubmit={handleGamificationSubmit}
            lockToast={lockToast}
            wireStart={wireStart}
          />
        </>)}

        <F1MenuOverlay
          showF1Menu={showF1Menu}
          setShowF1Menu={setShowF1Menu}
          downloadSimulationJson={downloadSimulationJson}
          generateTeacherKey={generateTeacherKey}
          openFirmwareDownloadDialog={openFirmwareDownloadDialog}
          openFirmwareUploadDialog={openFirmwareUploadDialog}
          rp2040DebugTelemetryEnabled={rp2040DebugTelemetryEnabled}
          setRp2040DebugTelemetryEnabled={setRp2040DebugTelemetryEnabled}
          componentTelemetryEnabled={componentTelemetryEnabled}
          setComponentTelemetryEnabled={setComponentTelemetryEnabled}
          deepSiliconDebuggingEnabled={deepSiliconDebuggingEnabled}
          setDeepSiliconDebuggingEnabled={setDeepSiliconDebuggingEnabled}
          telemetryMode={telemetryMode}
          setTelemetryMode={setTelemetryMode}
          respectExitSide={respectExitSide}
          setRespectExitSide={setRespectExitSide}
          onOpenTelemetryModal={() => setShowTelemetrySelectModal(true)}
          setShowSpeedDialog={setShowSpeedDialog}
          simulationSpeed={simulationSpeed}
          setSimulationSpeed={setSimulationSpeed}
          isRunning={isRunning}
          workerRef={workerRef}
          handleStartGDB={handleStartGDB}
          esp32SimulationMode={esp32SimulationMode}
          setEsp32SimulationMode={updateEsp32SimulationMode}
        />

        <div
          className="flex flex-1 overflow-hidden"
          onClick={() => setProjContextMenu(null)}
        >
          {!canvasOnly && (
            <>
              {/* PALETTE — hover to expand */}
              <PalettePanel
                isPaletteHovered={isPaletteHovered}
                setIsPaletteHovered={setIsPaletteHovered}
                theme={theme}
                liveEditingDisabled={liveEditingDisabled}
                addComponentAtCenter={addComponentAtCenter}
                onPaletteDragStart={onPaletteDragStart}
                handleUploadZip={handleUploadZip}
                openComponentEditor={openComponentEditor}
                showLockToast={showLockToast}
                isPaletteItemLocked={isPaletteItemLocked}
                CATALOG={LOCAL_CATALOG}
                GROUP_COLORS={GROUP_COLORS}
                GROUP_ICON_SVG={GROUP_ICON_SVG}
                COMPONENT_REGISTRY={COMPONENT_REGISTRY}
                COMPONENT_DESCRIPTIONS={COMPONENT_DESCRIPTIONS}
                WOKWI_TO_COMP_ID={WOKWI_TO_COMP_ID}
                componentZipInputRef={componentZipInputRef}
                buildLogicSourceFromRegistry={buildLogicSourceFromRegistry}
                buildUiSourceFromRegistry={buildUiSourceFromRegistry}
                buildValidationSourceFromRegistry={
                  buildValidationSourceFromRegistry
                }
                buildIndexSourceFromRegistry={buildIndexSourceFromRegistry}
                forceExpand={
                  tourActiveStep === "palette" || tourActiveStep === "drag-demo"
                }
                writeEditCopyPayload={writeEditCopyPayload}
              />

              <CreateComponentModal
                open={showCreateComponentModal}
                onClose={handleCloseCreateComponentModal}
              />
            </>)}

          {/* CANVAS + SVG WIRE LAYER */}
          <main
            className="flex-1 relative overflow-hidden bg-[var(--canvas-bg)]"
            style={{
              cursor: showInspector
                ? "url(\"data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='4' fill='%2338bdf8'/%3E%3Cpath d='M12 2v6M12 16v6M2 12h6M16 12h6' stroke='%2338bdf8' stroke-width='2'/%3E%3C/svg%3E\") 12 12, crosshair"
                : segDrag
                  ? segDrag.isHoriz
                    ? "ns-resize"
                    : "ew-resize"
                  : wireStart
                    ? "crosshair"
                    : isCanvasLocked
                      ? "default"
                      : "grab",
              touchAction: "none", // Block browser pinch-to-zoom
              opacity: readOnly ? 0.8 : 1,
              marginLeft: canvasOnly ? "0" : "38px",
              transform: canvasOnly ? "none" : `translateX(${isPaletteHovered ? "302px" : "0"})`,
              transition: canvasOnly ? "none" : "transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)",
              willChange: canvasOnly ? "auto" : "transform",
            }}
            ref={canvasRef}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onDrop={onCanvasDrop}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onMouseMove={() => { }}
            onMouseDown={(e) => {
              if (isCanvasLocked || wireStart || movingComp.current) return;
              if (e.button !== 0 && e.button !== 1) return;
              e.preventDefault();
              didPanRef.current = false;
              isPanningRef.current = true;
              panStartRef.current = {
                x: e.clientX,
                y: e.clientY,
                ox: canvasOffsetRef.current.x,
                oy: canvasOffsetRef.current.y,
              };
            }}
            onClick={(e) => {
              if (didPanRef.current) return;
              if (wireStart) {
                const r = canvasRef.current.getBoundingClientRect();
                const newPt = {
                  x: snapToGrid(
                    (e.clientX - r.left - canvasOffsetRef.current.x) /
                    canvasZoom,
                  ),
                  y: snapToGrid(
                    (e.clientY - r.top - canvasOffsetRef.current.y) /
                    canvasZoom,
                  ),
                };
                setWireStart((prev) => ({
                  ...prev,
                  waypoints: [...(prev.waypoints || []), newPt],
                }));
              } else {
                setSelected(null);
                setWireClickPos(null);
              }
            }}
            onDoubleClick={(e) => {
              if (wireStart || isRunning) return;
              // Don't open search if clicking on an input, button, select, textarea, or inside a context menu
              const tag = e.target.tagName.toLowerCase();
              if (
                tag === "input" ||
                tag === "textarea" ||
                tag === "button" ||
                tag === "select"
              )
                return;
              if (e.target.closest("[data-contextmenu]")) return;
              const rect = canvasRef.current.getBoundingClientRect();
              const canvasX =
                (e.clientX - rect.left - canvasOffsetRef.current.x) /
                canvasZoomRef.current;
              const canvasY =
                (e.clientY - rect.top - canvasOffsetRef.current.y) /
                canvasZoomRef.current;
              window.dispatchEvent(
                new CustomEvent("quick-add-open", {
                  detail: {
                    screenX: e.clientX,
                    screenY: e.clientY,
                    canvasX,
                    canvasY,
                  },
                }),
              );
            }}
          >
            {/* Zoom Wrapper — scales all circuit content */}
            {/* Fix #4: innerCanvasRef is used to apply CSS transform directly during panning.
               React state (canvasOffset) is only committed once on mouseup. */}
            <DisplayRenderProvider renderWorker={renderWorker}>
              <CanvasSceneLayer
                innerCanvasRef={innerCanvasRef}
                canvasOffset={canvasOffset}
                canvasZoom={canvasZoom}
                showGrid={showGrid}
                wires={wires}
                wiresAlwaysOnTop={wiresAlwaysOnTop}
                selected={selected}
                components={components}
                getPinPos={getPinPos}
                getPinExitPoint={getPinExitPoint}
                wirepointsEnabled={wirepointsEnabled}
                respectExitSide={respectExitSide}
                theme={theme}
                setSelected={setSelected}
                canvasRef={canvasRef}
                setWireClickPos={setWireClickPos}
                canvasOffsetRef={canvasOffsetRef}
                canvasZoomRef={canvasZoomRef}
                setSegDrag={setSegDrag}
                segDragRef={segDragRef}
                autofixPlan={autofixPlan}
                getPinPosWithGhosts={getPinPosWithGhosts}
                wireStart={wireStart}
                mousePos={mousePos}
                multiRoutePath={multiRoutePath}
                svgRef={svgRef}
                isRunning={isRunning}
                isComponentDragging={isComponentDragging}
                COMPONENT_REGISTRY={COMPONENT_REGISTRY}
                getComponentStateAttrs={getComponentStateAttrs}
                updateComponentAttr={updateComponentAttr}
                wireClickPos={wireClickPos}
                updateWireColor={updateWireColor}
                saveHistory={saveHistory}
                setWires={setWires}
                deleteWire={deleteWire}
                PIN_DEFS={PIN_DEFS}
                errorCompIds={errorCompIds}
                serialBoardFilter={serialBoardFilter}
                onCompContextMenu={onCompContextMenu}
                onCompMouseDown={onCompMouseDown}
                onCompClick={onCompClick}
                getLiveOopStateSnapshot={getLiveOopStateSnapshot}
                subscribeLiveOopState={subscribeLiveOopState}
                neopixelRefs={neopixelRefs}
                hoveredPin={hoveredPin}
                setHoveredPin={setHoveredPin}
                snappingHoles={snappingHoles}
                getPinCategory={getPinCategory}
                hasCategoryIntersection={hasCategoryIntersection}
                onPinClick={onPinClick}
                setWireStart={setWireStart}
              />
            </DisplayRenderProvider>

            <SimulatorRuntimePanel
              isRunning={isRunning}
              isCompiling={isCompiling}
              isPaused={isPaused}
              runDurationSec={runDurationSec}
              simulationSpeedPercent={simulationSpeedPercent}
              formatRunDuration={formatRunDuration}
            />

            {canvasOnly && (
              <div style={{
                position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 90,
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                padding: '8px 16px', pointerEvents: 'auto',
                boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
              }}>
                {!isRunning ? (
                  <>
                    <button
                      onClick={handleRun}
                      disabled={isCompiling}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'var(--accent)', border: 'none', color: '#000',
                        padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                        cursor: isCompiling ? 'wait' : 'pointer',
                        opacity: isCompiling ? 0.6 : 1, transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => { if (!isCompiling) { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 4px 12px rgba(0,212,255,0.4)' } }}
                      onMouseLeave={(e) => { e.target.style.transform = 'none'; e.target.style.boxShadow = 'none' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                      {isCompiling ? 'Compiling...' : 'Run'}
                    </button>
                    <button
                      onClick={() => {
                        const url = `/${projectName}/demo`
                        if (window.self !== window.top) {
                          window.parent.location.href = url
                        } else {
                          window.location.href = url
                        }
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                        color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,0.2)' }}
                      onMouseLeave={(e) => { e.target.style.background = 'rgba(255,255,255,0.1)' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                      Edit
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={isPaused ? handleResume : handlePause}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: isPaused ? 'var(--orange, #f59e0b)' : 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.15)', color: '#fff',
                        padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => { e.target.style.background = isPaused ? '#d97706' : 'rgba(255,255,255,0.2)' }}
                      onMouseLeave={(e) => { e.target.style.background = isPaused ? 'var(--orange, #f59e0b)' : 'rgba(255,255,255,0.1)' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        {isPaused ? <polygon points="5 3 19 12 5 21 5 3" /> : <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>}
                      </svg>
                      {isPaused ? 'Resume' : 'Pause'}
                    </button>
                    <button onClick={handleStop} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)',
                      color: '#ef4444', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                      onMouseEnter={(e) => { e.target.style.background = 'rgba(239,68,68,0.3)' }}
                      onMouseLeave={(e) => { e.target.style.background = 'rgba(239,68,68,0.2)' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
                      Stop
                    </button>
                  </>
                )}
              </div>
            )}

            <ComponentInspectorPanel
              selectedComponentInfo={selectedComponentInfo}
              showComponentDesc={showComponentDesc}
              setShowComponentDesc={setShowComponentDesc}
              selected={selected}
              components={components}
              wires={wires}
              COMPONENT_REGISTRY={COMPONENT_REGISTRY}
              GROUP_COLORS={GROUP_COLORS}
              LOCAL_PIN_DEFS={LOCAL_PIN_DEFS}
              getPinCategory={getPinCategory}
              hasCategoryIntersection={hasCategoryIntersection}
              pendingPinColors={pendingPinColors}
              setPendingPinColors={setPendingPinColors}
              updateWireColor={updateWireColor}
              setWires={setWires}
              setWireStart={setWireStart}
              isPinMappingExpanded={isPinMappingExpanded}
              setIsPinMappingExpanded={setIsPinMappingExpanded}
            />

            <CanvasBottomControls
              validationToast={validationToast}
              setValidationToast={setValidationToast}
              isConsoleOpen={isConsoleOpen}
              setIsConsoleOpen={setIsConsoleOpen}
              consoleHeight={consoleHeight}
              consoleEntries={consoleEntries}
              protocolLogs={protocolLogs}
              setProtocolLogs={setProtocolLogs}
              components={components}
              componentTelemetryEnabled={componentTelemetryEnabled}
              setComponentTelemetryEnabled={setComponentTelemetryEnabled}
              telemetryMode={telemetryMode}
              setTelemetryMode={setTelemetryMode}
              telemetrySampleInterval={telemetrySampleInterval}
              setTelemetrySampleInterval={setTelemetrySampleInterval}
              selectedTelemetryComponentIds={selectedTelemetryComponentIds}
              setSelectedTelemetryComponentIds={
                setSelectedTelemetryComponentIds
              }
              onOpenTelemetryModal={() => setShowTelemetrySelectModal(true)}
              onMouseDownConsoleResize={onMouseDownConsoleResize}
              clearConsoleEntries={clearConsoleEntries}
              downloadConsoleLog={downloadConsoleLog}
              showCanvasMenu={showCanvasMenu}
              setShowCanvasMenu={setShowCanvasMenu}
              theme={theme}
              history={history}
              isRunning={isRunning}
              showInspector={showInspector}
              showGrid={showGrid}
              isCanvasLocked={isCanvasLocked}
              isFullscreen={isFullscreen}
              wirepointsEnabled={wirepointsEnabled}
              showComponentDesc={showComponentDesc}
              showConnectionsPanel={showConnectionsPanel}
              blocklyDisabled={blocklyDisabled}
              fitToView={fitToView}
              undo={undo}
              redo={redo}
              toggleFullscreen={toggleFullscreen}
              setWirepointsEnabled={setWirepointsEnabled}
              setWiresAlwaysOnTop={setWiresAlwaysOnTop}
              wiresAlwaysOnTop={wiresAlwaysOnTop}
              saveHistory={saveHistory}
              setComponents={setComponents}
              setWires={setWires}
              setProjectFiles={setProjectFiles}
              setCode={setCode}
              setSelected={setSelected}
              chrome={{
                setShowInspector: chrome.setShowInspector,
                setShowGrid: chrome.setShowGrid,
                setIsCanvasLocked: chrome.setIsCanvasLocked,
                setShowComponentDesc: chrome.setShowComponentDesc,
                setShowConnectionsPanel: chrome.setShowConnectionsPanel,
                setBlocklyDisabled: setBlocklyDisabled,
              }}
              applyZoomAtCenter={applyZoomAtCenter}
              canvasZoomRef={canvasZoomRef}
              canvasZoom={canvasZoom}
              handleZoomTextClick={handleZoomTextClick}
            />

            <ComponentTelemetrySelectModal
              isOpen={showTelemetrySelectModal}
              onClose={() => setShowTelemetrySelectModal(false)}
              components={components}
              selectedIds={selectedTelemetryComponentIds}
              onChangeSelectedIds={setSelectedTelemetryComponentIds}
              watchedParamsMap={telemetryWatchedParamsMap}
              onChangeWatchedParamsMap={setTelemetryWatchedParamsMap}
            />

            {/* ── Quick-Add Portal — rendered to document.body, isolated from canvas re-renders ── */}
            {((addComponentAtRef.current = addComponentAt), null)}
          </main>

          {!canvasOnly && (
            <>
              {/* ── QuickAddPortal — mounts to document.body, zero canvas re-render cost ── */}
              <QuickAddPortal
                catalog={LOCAL_CATALOG}
                onAddComponentRef={addComponentAtRef}
                isPaletteItemLocked={isPaletteItemLocked}
                showLockToast={showLockToast}
              />

              {/* RIGHT PANEL */}
              <RightPanel
                ref={rightPanelRef}
                isPanelOpen={isPanelOpen}
                panelWidth={panelWidth}
                isDragging={isDragging}
                onMouseDownResize={onMouseDownResize}
                setIsPanelOpen={setIsPanelOpen}
                explorerWidth={explorerWidth}
                isExplorerDragging={isExplorerDragging}
                onMouseDownExplorerResize={onMouseDownExplorerResize}
                selected={selected}
                setSelected={setSelected}
                theme={theme}
                projectName={currentProjectName}
                validationErrors={validationErrors}
                showValidation={showValidation}
                setShowValidation={setShowValidation}
                healthScore={healthScore}
                applyFix={applyFix}
                codeTab={codeTab}
                setCodeTab={setCodeTab}
                code={code}
                setCode={setCode}
                blocklyXml={blocklyXml}
                setBlocklyXml={setBlocklyXml}
                blocklyGeneratedCode={blocklyGeneratedCode}
                setBlocklyGeneratedCode={setBlocklyGeneratedCode}
                useBlocklyCode={useBlocklyCode}
                setUseBlocklyCode={setUseBlocklyCode}
                blocklyDisabled={blocklyDisabled}
                setBlocklyDisabled={setBlocklyDisabled}
                projectFiles={projectFiles}
                openCodeTabs={openCodeTabs}
                activeCodeFileId={activeCodeFileId}
                showCodeExplorer={showCodeExplorer}
                onToggleCodeExplorer={() => setShowCodeExplorer((v) => !v)}
                onOpenCodeFile={openCodeFile}
                onCloseCodeTab={closeCodeTab}
                onSaveCodeFile={saveCodeFile}
                onDuplicateCodeFile={duplicateCodeFile}
                onRenameCodeFile={renameCodeFile}
                onDeleteCodeFile={deleteCodeFile}
                onDownloadCodeFile={downloadCodeFile}
                onToggleCodeFileDisabled={toggleCodeFileDisabled}
                onCreateCodeFile={createCodeFile}
                onCreateCodeTab={createCodeTab}
                onUploadCodeFile={uploadCodeFile}
                libQuery={libQuery}
                setLibQuery={setLibQuery}
                handleSearchLibraries={handleSearchLibraries}
                isSearchingLib={isSearchingLib}
                libMessage={libMessage}
                libInstalled={libInstalled}
                libResults={libResults}
                handleInstallLibrary={handleInstallLibrary}
                installingLib={installingLib}
                serialPaused={serialPaused}
                setSerialPaused={setSerialPaused}
                isRunning={isRunning}
                serialHistory={serialHistory}
                setSerialHistory={setSerialHistory}
                serialOutputRef={serialOutputRef}
                serialInput={serialInput}
                setSerialInput={setSerialInput}
                sendSerialInput={sendSerialInput}
                clearSerialMonitor={clearSerialMonitor}
                serialViewMode={serialViewMode}
                setSerialViewMode={setSerialViewMode}
                serialBoardFilter={serialBoardFilter}
                setSerialBoardFilter={setSerialBoardFilter}
                serialBoardOptions={serialBoardOptions}
                serialBoardLabels={serialBoardLabels}
                serialBoardKinds={serialBoardKinds}
                serialBoardSourceModes={rp2040BoardSourceModes}
                serialBaudRate={serialBaudRate}
                setSerialBaudRate={updateGlobalBaudRate}
                serialBaudOptions={serialBaudOptions}
                serialLineEnding={serialLineEnding}
                setSerialLineEnding={setSerialLineEnding}
                hardwareConnected={hardwareConnected}
                plotterPaused={plotterPaused}
                setPlotterPaused={setPlotterPaused}
                plotDataRef={plotDataRef}
                selectedPlotPins={selectedPlotPins}
                setSelectedPlotPins={setSelectedPlotPins}
                serialPlotLabelsRef={serialPlotLabelsRef}
                plotterTimeDiv={plotterTimeDiv}
                setPlotterTimeDiv={setPlotterTimeDiv}
                showConnectionsPanel={showConnectionsPanel}
                wires={wires}
                updateWireColor={updateWireColor}
                deleteWire={deleteWire}
                boardComponentMap={boardComponentMap}
                onToggleBoardFirmwareSource={toggleBoardFirmwareSource}
                editingDisabled={liveEditingDisabled}
                editingDisabledMessage={
                  liveMeetingMode
                    ? "Teacher approval is required before you can edit this live simulation."
                    : "Editing is disabled."
                }
                boardLineEndings={boardLineEndings}
                setBoardLineEndings={setBoardLineEndings}
                boardAutoscrolls={boardAutoscrolls}
                setBoardAutoscrolls={setBoardAutoscrolls}
                boardBaudRates={boardBaudRates}
                setBoardBaudRates={updateBoardBaudRate}
                boardPausedStates={boardPausedStates}
                setBoardPausedStates={setBoardPausedStates}
                boardInputs={boardInputs}
                setBoardInputs={setBoardInputs}
                isSerialSplit={isSerialSplit}
                setIsSerialSplit={setIsSerialSplit}
                serialSplitRatio={serialSplitRatio}
                setSerialSplitRatio={setSerialSplitRatio}
                serialBoardFilter2={serialBoardFilter2}
                setSerialBoardFilter2={setSerialBoardFilter2}
              />

              <ProjectsSidebarChrome
                showProjectsSidebar={showProjectsSidebar}
                setShowProjectsSidebar={setShowProjectsSidebar}
                projectsSidebarTab={projectsSidebarTab}
                setProjectsSidebarTab={setProjectsSidebarTab}
                favouriteProjectIds={favouriteProjectIds}
                myProjects={myProjects}
                currentProjectId={currentProjectId}
                renamingProjectId={renamingProjectId}
                setRenamingProjectId={setRenamingProjectId}
                renameValue={renameValue}
                setRenameValue={setRenameValue}
                handleConfirmRename={handleConfirmRename}
                formatProjectDate={formatProjectDate}
                handleNewProject={handleNewProject}
                handleLoadProject={handleLoadProject}
                isRunning={isRunning}
                isAnyAuthenticated={isAnyAuthenticated}
                isAuthenticated={isAuthenticated}
                activeUser={activeUser}
                navigate={navigate}
                logout={logout}
                autoSaveEnabled={autoSaveEnabled}
                setAutoSaveEnabled={setAutoSaveEnabled}
                handleBackupWorkflow={handleBackupWorkflow}
                backupRestoreInputRef={backupRestoreInputRef}
                wokwiImportInputRef={wokwiImportInputRef}
                handleSyncToCloud={handleSyncToCloud}
                setShowCreateComponentModal={setShowCreateComponentModal}
                projContextMenu={projContextMenu}
                toggleFavourite={toggleFavourite}
                handleCopyProject={handleCopyProject}
                handleStartRename={handleStartRename}
                handleDeleteProject={handleDeleteProject}
                setProjContextMenu={setProjContextMenu}
                gamificationMode={gamificationMode}
                assessmentMode={assessmentMode}
              />

              {gamificationMode && gamPanelOpen && gamProject && (
                <GamificationGuidePanel
                  gamTab={gamTab}
                  setGamTab={setGamTab}
                  gamProject={gamProject}
                  gamAllUnlocked={gamAllUnlocked}
                  gamLockedCount={gamLockedCount}
                  gamProjectComponents={gamProjectComponents}
                  navigate={navigate}
                  handleGamificationSubmit={handleGamificationSubmit}
                />
              )}

              {/* ── SIMULATION SPEED DIALOG ─────────────────────────────────────── */}
              {showSpeedDialog && (
                <div
                  className="fixed inset-0 bg-[rgba(0,0,0,.55)] flex items-center justify-center z-[9999]"
                  onClick={() => chrome.setShowSpeedDialog(false)}
                >
                  <div
                    className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-6 w-[380px] shadow-[0_8px_40px_rgba(0,0,0,.4)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-base font-bold mb-2 text-[var(--text)]">
                      Simulation Speed
                    </div>
                    <div className="text-xs text-[var(--text3)] mb-6 leading-relaxed">
                      Adjust how fast the simulation runs relative to real-time.
                      Higher speeds may impact UI responsiveness.
                    </div>

                    <div className="mb-6">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-[var(--text2)] uppercase tracking-wider">
                          Current Rate
                        </span>
                        <span className="text-sm font-mono font-bold text-[var(--accent)]">
                          {simulationSpeed.toFixed(1)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="10"
                        step="0.1"
                        value={simulationSpeed}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setSimulationSpeed(val);
                          if (isRunning && workerRef.current) {
                            workerRef.current.postMessage({
                              type: "SET_SPEED",
                              speed: val,
                            });
                          }
                        }}
                        className="w-full accent-[var(--accent)] h-1.5 bg-[var(--border)] rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between mt-2 text-[9px] text-[var(--text3)] font-mono">
                        <span>0.1x</span>
                        <span>1.0x</span>
                        <span>5.0x</span>
                        <span>10.0x</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-6">
                      {[0.1, 0.5, 1.0, 2.0, 5.0, 10.0].map((val) => (
                        <Btn
                          key={val}
                          onClick={() => {
                            setSimulationSpeed(val);
                            if (isRunning && workerRef.current) {
                              workerRef.current.postMessage({
                                type: "SET_SPEED",
                                speed: val,
                              });
                            }
                          }}
                          color={simulationSpeed === val ? "var(--accent)" : ""}
                          style={{ fontSize: "11px", padding: "6px 0" }}
                        >
                          {val === 1.0 ? "Normal" : `${val}x`}
                        </Btn>
                      ))}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        justifyContent: "flex-end",
                        borderTop: "1px solid var(--border)",
                        paddingTop: "16px",
                      }}
                    >
                      <Btn
                        onClick={() => {
                          const resetSpeed = 1.0;
                          setSimulationSpeed(resetSpeed);
                          if (isRunning && workerRef.current) {
                            workerRef.current.postMessage({
                              type: "SET_SPEED",
                              speed: resetSpeed,
                            });
                          }
                        }}
                      >
                        Reset
                      </Btn>
                      <Btn
                        color="var(--accent)"
                        onClick={() => chrome.setShowSpeedDialog(false)}
                      >
                        Done
                      </Btn>
                    </div>
                  </div>
                </div>
              )}

              {/* ── ENGINE SELECTOR DIALOG ─────────────────────────────────────── */}
              {showEngineSelector && (
                <div
                  className="fixed inset-0 bg-[rgba(0,0,0,.6)] backdrop-blur-sm flex items-center justify-center z-[9999]"
                  onClick={() => setShowEngineSelector(false)}
                >
                  <div
                    className="bg-[var(--bg2)] border border-[var(--border)] rounded-2xl p-8 w-[480px] shadow-[0_20px_60px_rgba(0,0,0,.6)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-xl font-bold mb-2 text-[var(--text)] tracking-tight">
                      Select Simulation Engine
                    </div>
                    <div className="text-sm text-[var(--text3)] mb-8 leading-relaxed">
                      Choose the computational engine that best fits your simulation
                      needs. Changes are applied in real-time.
                    </div>

                    <div className="space-y-4 mb-8">
                      {/* Classic Logic Option */}
                      <div
                        className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${solverMode === "logic" ? "border-[var(--accent)] bg-[rgba(var(--accent-rgb),0.05)]" : "border-[var(--border)] hover:border-[var(--border-hover)]"}`}
                        onClick={() => {
                          setSolverMode("logic");
                        }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-[var(--text)]">
                            Classic Logic
                          </span>
                          {solverMode === "logic" && (
                            <span className="text-[10px] bg-[var(--accent)] text-white px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                              This is Current Engine
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--text2)] leading-normal">
                          High-performance Boolean propagation. Ideal for large
                          digital circuits and low-end hardware.
                        </div>
                      </div>
                    </div>

                    <Btn
                      onClick={() => setShowEngineSelector(false)}
                      style={{
                        width: "100%",
                        padding: "14px",
                        borderRadius: "12px",
                      }}
                      className="font-bold tracking-wide"
                    >
                      Continue with Classic Logic
                    </Btn>
                  </div>
                </div>
              )}

              {/* COMPONENT INSPECTOR HUD - High Performance Telemetry */}
              {showInspector && hoveredElement && (
                <div
                  style={{
                    position: "fixed",
                    left:
                      mousePos.x * canvasZoom +
                      canvasOffset.x +
                      (canvasRef.current?.getBoundingClientRect().left || 0) +
                      20,
                    top:
                      mousePos.y * canvasZoom +
                      canvasOffset.y +
                      (canvasRef.current?.getBoundingClientRect().top || 0) +
                      20,
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "12px",
                    padding: "14px",
                    zIndex: 100000,
                    color: "#f8fafc",
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: "11px",
                    pointerEvents: "none",
                    boxShadow: "0 20px 50px -12px rgba(0, 0, 0, 0.6)",
                    minWidth: "200px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "10px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "9px",
                        color: "#94a3b8",
                        fontWeight: "800",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Electrical Telemetry
                    </div>
                    <div
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "#4ade80",
                        boxShadow: "0 0 8px #4ade80",
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: "12px" }}>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "800",
                        color: "#fff",
                        marginBottom: "2px",
                      }}
                    >
                      {hoveredElement.label}
                    </div>
                    <div style={{ fontSize: "10px", color: "#64748b" }}>
                      Node ID: {hoveredElement.id}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                      marginBottom: "14px",
                    }}
                  >
                    <div
                      style={{
                        background: "#1e293b",
                        padding: "8px",
                        borderRadius: "8px",
                        border: "1px solid #334155",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "9px",
                          color: "#94a3b8",
                          marginBottom: "4px",
                        }}
                      >
                        VOLTAGE
                      </div>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: "700",
                          color: "#38bdf8",
                        }}
                      >
                        {hoveredElement.voltage?.toFixed(2) ??
                          (hoveredElement.voltageDrop?.toFixed(2) || "0.00")}
                        V
                      </div>
                    </div>
                    {hoveredElement.current !== undefined && (
                      <div
                        style={{
                          background: "#1e293b",
                          padding: "8px",
                          borderRadius: "8px",
                          border: "1px solid #334155",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "9px",
                            color: "#94a3b8",
                            marginBottom: "4px",
                          }}
                        >
                          CURRENT
                        </div>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: "700",
                            color: "#4ade80",
                          }}
                        >
                          {(hoveredElement.current * 1000).toFixed(1)}mA
                        </div>
                      </div>
                    )}
                  </div>

                  {hoveredElement.power !== undefined && (
                    <div
                      style={{
                        background: "rgba(244, 114, 182, 0.1)",
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid rgba(244, 114, 182, 0.2)",
                        marginBottom: "14px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "9px",
                            color: "#f472b6",
                            fontWeight: "700",
                          }}
                        >
                          POWER DISSIPATION
                        </span>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: "800",
                            color: "#f472b6",
                          }}
                        >
                          {(hoveredElement.power * 1000).toFixed(1)}mW
                        </span>
                      </div>
                    </div>
                  )}

                  {/* MINI-OSCILLOSCOPE SPARKLINE */}
                  {hoveredElement.history && hoveredElement.history.length > 1 && (
                    <div style={{ marginTop: "4px" }}>
                      <div
                        style={{
                          fontSize: "9px",
                          color: "#94a3b8",
                          marginBottom: "6px",
                          fontWeight: "600",
                        }}
                      >
                        Signal Integrity (200ms)
                      </div>
                      <div
                        style={{
                          height: "35px",
                          background: "rgba(0,0,0,0.3)",
                          borderRadius: "6px",
                          padding: "2px",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <svg
                          width="100%"
                          height="100%"
                          viewBox="0 0 140 35"
                          preserveAspectRatio="none"
                          style={{ overflow: "visible" }}
                        >
                          <polyline
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={hoveredElement.history
                              .map(
                                (v, i) =>
                                  `${(i / (hoveredElement.history.length - 1)) * 140},${35 - (Math.min(v, 5) / 5) * 30}`,
                              )
                              .join(" ")}
                          />
                        </svg>
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: "10px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "9px",
                      color: "#475569",
                    }}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                    <span>WASM MNA Engine Active</span>
                  </div>
                </div>
              )}

              {/* MODAL / OVERLAY LAYER (Global) */}
              <ComponentContextMenu
                x={compContextMenu?.x}
                y={compContextMenu?.y}
                comp={components.find((c) => c.id === compContextMenu?.compId)}
                info={(() => {
                  const comp = components.find(
                    (c) => c.id === compContextMenu?.compId,
                  );
                  if (!comp) return null;
                  for (const g of LOCAL_CATALOG) {
                    const item = g.items.find((i) => i.type === comp.type);
                    if (item) return { ...item, group: g.group };
                  }
                  return {
                    label: comp.label || comp.id,
                    group: "Universal",
                    description: "Interactive Simulator Component",
                  };
                })()}
                visible={!!compContextMenu}
                onClose={() => setCompContextMenu(null)}
                onRename={() => {
                  const id = compContextMenu.compId;
                  const comp = components.find((c) => c.id === id);
                  if (comp && canvasRef.current) {
                    const rect = canvasRef.current.getBoundingClientRect();
                    const vx =
                      (comp.x + (comp.w || 0) / 2) * canvasZoom +
                      canvasOffset.x +
                      rect.left;
                    const vy = comp.y * canvasZoom + canvasOffset.y + rect.top;
                    setRenameState({ id, x: vx, y: vy });
                  }
                }}
                onPinMap={() => {
                  const id = compContextMenu.compId;
                  setSelected(id);
                  setShowComponentDesc(true);
                  // Small delay to ensure the [selected] effect (which collapses mapping) runs first
                  setTimeout(() => setIsPinMappingExpanded(true), 50);
                }}
                onRotate={() => rotateComponent(compContextMenu.compId)}
                onDelete={() => {
                  if (liveEditingDisabled) return;
                  saveHistory();
                  const id = compContextMenu.compId;
                  // Shared Ownership Cleanup: Only delete if no other owners exist
                  setComponents((prev) =>
                    prev
                      .map((c) => {
                        if (c.ownerIds?.includes(id)) {
                          return {
                            ...c,
                            ownerIds: c.ownerIds.filter((oid) => oid !== id),
                          };
                        }
                        return c;
                      })
                      .filter(
                        (c) =>
                          c.id !== id && (!c.ownerIds || c.ownerIds.length > 0),
                      ),
                  );

                  setWires((prev) =>
                    prev
                      .map((w) => {
                        if (w.ownerIds?.includes(id)) {
                          return {
                            ...w,
                            ownerIds: w.ownerIds.filter((oid) => oid !== id),
                          };
                        }
                        return w;
                      })
                      .filter(
                        (w) =>
                          !w.from.startsWith(id + ":") &&
                          !w.to.startsWith(id + ":") &&
                          (!w.ownerIds || w.ownerIds.length > 0),
                      ),
                  );

                  // Remove AutoCode snippet
                  if (id) {
                    setProjectFiles((prev) =>
                      prev.map((f) => {
                        if (f.content) {
                          const newContent = removeCodeSnippet(f.content, id);
                          if (activeCodeFileId === f.id && code !== newContent) {
                            setCode(newContent);
                          }
                          return { ...f, content: newContent };
                        }
                        return f;
                      }),
                    );
                  }
                  if (selected === id) setSelected(null);
                }}
                onDoc={() => {
                  const comp = components.find(
                    (c) => c.id === compContextMenu.compId,
                  );
                  const reg = COMPONENT_REGISTRY[comp?.type];
                  const helpUrl = reg?.manifest?.helpUrl || reg?.helpUrl;
                  if (helpUrl) window.open(helpUrl, "_blank");
                }}
                updateComponentAttr={updateComponentAttr}
                onValueEdit={(id, key = "value") => {
                  const comp = components.find((c) => c.id === id);
                  if (comp && canvasRef.current) {
                    const rect = canvasRef.current.getBoundingClientRect();
                    const vx =
                      (comp.x + (comp.w || 0) / 2) * canvasZoom +
                      canvasOffset.x +
                      rect.left;
                    const vy = comp.y * canvasZoom + canvasOffset.y + rect.top;
                    setValueState({ id, x: vx, y: vy, key });
                  }
                }}
                theme={theme}
                programmableBoards={components.filter((c) =>
                  isProgrammableBoardType(c.type),
                )}
                boardColors={boardColors}
                onWireToBoard={handleWireToBoard}
                onOpenCode={handleOpenCode}
                onAutoCode={handleAutoCode}
              />

              <ComponentRenamePanel
                comp={components.find((c) => c.id === renameState.id)}
                x={renameState.x}
                y={renameState.y}
                visible={!!renameState.id && renameState.x !== 0}
                onConfirm={(newId) =>
                  handleRenameComponentId(renameState.id, newId)
                }
                onCancel={() => setRenameState({ id: null, x: 0, y: 0 })}
                theme={theme}
              />

              {showTour && (
                <TourGuide
                  onFinish={handleFinishTour}
                  onStepChange={setTourActiveStep}
                  onDemoAction={handleTourDemoAction}
                />
              )}

              <ComponentValuePanel
                comp={components.find((c) => c.id === valueState.id)}
                attrKey={valueState.key}
                x={valueState.x}
                y={valueState.y}
                visible={!!valueState.id && valueState.x !== 0}
                onConfirm={(val) => {
                  updateComponentAttr(valueState.id, valueState.key, val);
                  setValueState({ id: null, x: 0, y: 0, key: "value" });
                }}
                onCancel={() =>
                  setValueState({ id: null, x: 0, y: 0, key: "value" })
                }
                theme={theme}
              />
            </>)}
        </div>

        {/* Guided project schema loading overlay */}
        {isLoadingGuidedSchema && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(15,23,42,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(2px)',
            }}
          >
            <div
              style={{
                background: '#ffffff', borderRadius: 16,
                padding: '32px 40px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              }}
            >
              <div
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: '3px solid #e2e8f0',
                  borderTopColor: '#2563eb',
                  animation: 'guided-spin 0.7s linear infinite',
                }}
              />
              <style>{`@keyframes guided-spin{to{transform:rotate(360deg)}}`}</style>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                Loading circuit...
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Placing components and wiring connections
              </div>
            </div>
          </div>
        )}

        {showComingSoon && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(15,23,42,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div
              style={{
                background: '#ffffff', borderRadius: 16,
                padding: '40px 48px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                maxWidth: 400,
                textAlign: 'center',
              }}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
                Coming Soon
              </div>
              <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
                This guided project is under development and will be available soon.
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  onClick={() => navigate(-1)}
                  style={{
                    padding: '10px 28px',
                    border: 'none',
                    borderRadius: 8,
                    background: '#2563eb',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Go Back
                </button>
                <button
                  onClick={() => setShowComingSoon(false)}
                  style={{
                    padding: '10px 28px',
                    border: '1px solid var(--border, rgba(255,255,255,0.2))',
                    borderRadius: 8,
                    background: 'transparent',
                    color: 'var(--text, #e2e8f0)',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Open Simulator
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default SimulatorPage;


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
// Perf: COMPONENT_MAP (758KB gamification ComponentsConfig) is only needed in
// gamification/assessment mode to resolve locked-component metadata. Lazy it
// so the default simulator route never downloads it.
let _componentMapCache = null;
const getComponentMap = async () => {
  if (!_componentMapCache) {
    const mod = await import("../../services/gamification/ComponentsConfig.js");
    _componentMapCache = mod.COMPONENT_MAP;
  }
  return _componentMapCache;
};
import {
  compileCode,
  flashFirmware,
  submitCustomComponent,
  fetchInstalledComponentsWithFiles,
  createSharedSimulation,
  fetchSharedSimulation,
  fetchLiveSimulationSession,
  buildLiveSimulationWsUrl,
  fetchPublicInstalledComponents,
  fetchComponentsVersion,
  API_BASE_URL,
} from '../../services/simulatorService.js'
import { getCachedComponents, getCachedServerHash, setCachedComponents, clearComponentCache } from '../../services/componentCache.js'
import { getMyAssignmentSubmission, submitAssignment } from '../../services/classroomService.js'
import { uploadClassroomFiles } from '../../components/teacher/class-detail/uploadUtils.js'
import StudentAssignmentModal from '../../components/teacher/class-detail/StudentAssignmentModal.jsx'
import { getCachedHex, setCachedHex, enqueueComponent, getQueuedComponents, dequeueComponent } from '../../services/offlineCache.js'
import { saveProject, loadProject, listProjects, deleteProject, renameProject, generateProjectId, formatProjectDate } from '../../services/projectStore.js'
// Perf (bundle-split): html2canvas + jszip are NOT statically imported here.
// They load on demand via getHtml2canvas()/getJSZip() in utils/exportUtils.js
// (PNG export, project save/load, Wokwi ZIP import). The SimulatorPage chunk
// previously dragged both (~150KB) into the initial simulator download.
import { GENERATED_ROOT_FILE_IDS, fileExt, isFileDisabled, normalizeProjectFiles, getBoardCompileFiles as getBoardCompileFilesShared, extractProjectMetaFromPng } from '../../utils/projectCompilerUtils';

// Modular Imports
import { TopToolbox } from "./TopToolbox";
import { isComponentHidden, getComponentWarning, resolveComponentDetails } from "./utils/componentVisibilityConfig";
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
import { autoConnectPowerRails, syncWireIds, takeNextWireId } from "./utils/powerRails";
// Shared empty snapshot for components with no live OOP state (stable ref,
// safe to use as a useCallback dependency-free fallback).
const EMPTY_LIVE_STATE = {};
import { resolveUiExport } from "./utils/simulatorUtils";
import { useAutowiring } from "../../hooks/useAutowiring";
import { Btn } from "./Btn";
import { RightPanel } from "./RightPanel";
import { ProjectsSidebarChrome } from "./components/ProjectsSidebar";
import { SerialOutputPane, SerialSendRow } from "./components/SerialMonitor";
import { multiRoutePath, wireColor } from "./wireUtils";
import { handleProtocolObserverMessage } from "./utils/protocolObserver";
import { handleRp2040DebugMessage } from "./utils/rp2040DebugObserver";
import { handleWorkerStateMessage } from "./utils/workerStateIngest";
import { handleWorkerControlMessage } from "./utils/workerControlPlane";
import { compileRp2040Board } from "./utils/rp2040Compile";
import { handleRp2040GdbSpiMessage } from "./utils/rp2040GdbSpi";
import { postWorkerStartMessage } from "./utils/workerStartPostamble";
import { resolveGuidedFirmware } from "./utils/guidedFirmware";
import { compileFallbackBoard } from "./utils/fallbackCompile";
import { setupRunWorkers } from "./runWorkers";
import { compileGenericBoard } from "./utils/genericBoardCompile";
import {
  COMPONENT_DESCRIPTIONS,
  useWokwiToCompId,
} from "./utils/staticContent";
import { resolveBoardLoopPrologue } from "./utils/boardLoopPrologue";
import { runPreflight } from "./utils/runPreflight";
import { getResolvedPinExitSide } from "../../utils/pinExit.js";
import { useSimulatorShortcuts } from "./hooks/useSimulatorShortcuts";
import { useSerialIngress } from "./hooks/useSerialIngress";
import { useProjectImport } from "./hooks/useProjectImport";
import { usePngExport } from "./hooks/usePngExport";
import { useCompCsvExport } from "./hooks/useCompCsvExport";
import { useBackendComponentSync } from "./hooks/useBackendComponentSync";
import { useLibraryManager } from "./hooks/useLibraryManager";
import { serializedStateEquals } from "./utils/stateCompare";
import { usePanelResize } from "./hooks/usePanelResize";
import { useSchematicExport } from "./hooks/useSchematicExport";
import { useCanvasGeometry } from "./hooks/useCanvasGeometry";
import { useComponentPlacement } from "./hooks/useComponentPlacement";
import { useCanvasDragInteractions } from "./hooks/useCanvasDragInteractions";
import { useCanvasTouchGestures } from "./hooks/useCanvasTouchGestures";
import { useWireActions } from "./hooks/useWireActions";
import { useComponentAttrs } from "./hooks/useComponentAttrs";
import { handleWireToBoardAction } from "./utils/wireToBoard";
import { handleOpenCodeAction } from "./utils/openCodeFile";
import { useAutoCode } from "./hooks/useAutoCode";
import { useComponentMove } from "./hooks/useComponentMove";
import { useProjectPersistence } from "./hooks/useProjectPersistence";
import { useComponentZipUpload } from "./hooks/useComponentZipUpload";
import { useLiveMeeting } from "./hooks/useLiveMeeting";
import { useEntryLoadEffects } from "./hooks/useEntryLoadEffects";
import { useClassroomAssignment } from "./hooks/useClassroomAssignment";
import { useShareDialog } from "./hooks/useShareDialog";
import { useCodeFiles } from "./hooks/useCodeFiles";
import { useHardwareUpload } from "./hooks/useHardwareUpload";
import { useRunStop } from "./hooks/useRunStop";
import { useRunControls } from "./hooks/useRunControls";
import { useDebugControls } from "./hooks/useDebugControls";
import { useRunTimingEffects } from "./hooks/useRunTimingEffects";
import { useTeacherKeyCapture } from "./hooks/useTeacherKeyCapture";
import { useCanvasWheelZoom } from "./hooks/useCanvasWheelZoom";
import { launchGdbSession } from "./utils/gdbLauncher";
import { useValidationCore } from "./hooks/useValidationCore";
import { useFirmwareArtifacts } from "./hooks/useFirmwareArtifacts";
import { useFirmwareDialogs } from "./hooks/useFirmwareDialogs";
import { simplifyOrthogonalPath } from "./utils/wireHitDetection";
import { useEditorStore } from "./store/useEditorStore";
import { useWebSerialHardware } from "./webSerialHardware";
import { useHardwareFlashing } from "./useHardwareFlashing";
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
import { DisplayRenderProvider, ensureDisplayRenderContext } from "./context/DisplayRenderContext";
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
import ReportBugModal from "../../components/ReportBugModal.jsx";

// Perf (bundle-split): the 17MB @openhw/emulator package (100 component
// logic+UI modules + circuit-validation + protocol-handlers) is NOT
// statically imported. componentRegistry.js re-exports live references to
// emulatorLoader.js slots, populated by ensureEmulatorRegistry() on mount
// (preloaded, non-blocking) — Run gates behind registry-ready state.
// Named validator entry points resolve through the same loader.
import {
  ensureEmulatorRegistry,
  isEmulatorRegistryReady,
  getEmulator,
  preloadEmulator,
} from "./utils/emulatorLoader";

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
  buildUiSourceFromRegistry,
  buildLogicSourceFromRegistry,
  buildValidationSourceFromRegistry,
  buildIndexSourceFromRegistry,
  sortCatalog,
} from "./utils/componentRegistry";

import {
  fnv1aHash,
  computeRenderSyncHash,
  normalizeHashValue,
  extractCompileSummaryLines,
  formatRunDuration,
  allocateComponentId,
  arrayBufferToBase64,
} from "./utils/simulatorUtils";

import {
  getBabel,
  getHtml2canvas,
  ensureExportLogo,
  getSerializedShadowSheet,
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
  loadExampleProjectData,
} from "../../services/exampleLoaderService.js";

const EDIT_COPY_KEY = "openhw_edit_copy";
const EDIT_COPY_PAYLOAD_PREFIX = "openhw_edit_copy_payload_";
const RP2040_SIM_PROTOCOL_VERSION = "rp2040-sim-uart0-v4";
import { assertSafeDynamicModule } from "./utils/dynamicModuleGuard";
import { BACKEND_INJECTED_TYPES } from "./utils/injectedTypes";

function isRp2040CoreMissingError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return (
    msg.includes("platform 'rp2040:rp2040' not found") ||
    msg.includes("platform rp2040:rp2040 is not found") ||
    msg.includes("platform not installed")
  );
}

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
  const editorModeParam = useMemo(() => {
    const fromQuery = assessmentParams.get("editorMode") || assessmentParams.get("mode");
    if (fromQuery === "blocks" || fromQuery === "block") return "blocks";
    if (fromQuery === "code") return "code";
    if (location.state?.editorMode === "blocks") return "blocks";
    if (location.state?.editorMode === "code") return "code";
    const fromStorage = localStorage.getItem("openhw_demo_editor_mode");
    if (fromStorage === "blocks") return "blocks";
    return "code";
  }, [assessmentParams, location.state]);

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
  // Canonical gamification ids per palette type (memoized, same [] deps).
  // Lives in utils/staticContent.js.
  const WOKWI_TO_COMP_ID = useWokwiToCompId();

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
      // Perf: COMPONENT_MAP loads lazily (see getComponentMap); compDef
      // resolves on the next render after it arrives — gamification mode only.
      const compDef =
        compId && _componentMapCache ? (_componentMapCache[compId] || null) : null;
      const isLocked = (compId && isUnlocked && activeUser?.role === 'student') ? !isUnlocked(c.type) : false;
      return { ...c, compId, compDef, isLocked };
    });
  }, [gamProject, isUnlocked, WOKWI_TO_COMP_ID, gamificationMode]);

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
  // Stable identity: passed to memoized TopToolbox.
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const newTheme = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("theme", newTheme); // Save choice
      return newTheme;
    });
  }, []);

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

    const loadFromSchema = (proj) => {
      const s = proj?.schemas?.arduino;
      if (s) {
        doLoadGuidedSchema({
          ...s,
          blocklyXml: s.blocklyXml || proj.blocklyXml || '',
          blocklyGeneratedCode: s.blocklyGeneratedCode || proj.blocklyGeneratedCode || '',
          useBlocklyCode: s.useBlocklyCode !== undefined ? s.useBlocklyCode : (proj.useBlocklyCode !== undefined ? proj.useBlocklyCode : true),
          code: s.code || proj.code || '',
        }, 'Guided Project');
        return true;
      }
      return false;
    };

    setShowComingSoon(false);
    setIsLoadingGuidedSchema(true);

    if (project?.schemas?.arduino && loadFromSchema(project)) {
      setTimeout(() => { setIsLoadingGuidedSchema(false); fitToView("fit"); }, 600);
      return;
    }

    loadExampleProjectData(slug, EXAMPLES_BASE_URL)
      .then((result) => {
        if (result?.meta) {
          applyImportedProjectMeta(result.meta, `Guided Project (${result.source})`);
          setTimeout(() => { setIsLoadingGuidedSchema(false); fitToView("fit"); }, 600);
        } else {
          throw new Error('No meta');
        }
      })
      .catch(async () => {
        try {
          const data = await import("../../services/guidedProjects.json");
          const root = data.default || data;
          for (const level of Object.values(root)) {
            for (const cat of Object.values(level.categories || {})) {
              const found = cat.projects?.find(p => p.slug === slug);
              if (found && loadFromSchema(found)) {
                setGuidedProjectState({ project: found, levelColor: '#22c55e' });
                setTimeout(() => { setIsLoadingGuidedSchema(false); fitToView("fit"); }, 600);
                return;
              }
            }
          }
        } catch { }
        setIsLoadingGuidedSchema(false);
        setShowComingSoon(true);
      });
  }, [guidedProjectState, gamificationMode, projectName, canvasOnly]);

  const [history, setHistory] = useState({ past: [], future: [] });
  const [selected, setSelected] = useState(null); // comp or wire id
  const [wireStart, setWireStart] = useState(null); // { compId, pinId, pinLabel, x, y }
  const wireStartRef = useRef(null); // ref mirror so onPinClick stays stable
  // Perf: warm the emulator + gamification-metadata chunks without blocking
  // paint. Emulator is needed before Run; COMPONENT_MAP only in gamification
  // mode. Both resolve long before user interaction. Also fills emulatorRef
  // + protocol analyzer (single fulfillment point — see refs below).
  const [, forceRegistryTick] = useState(0);
  useEffect(() => {
    preloadEmulator();
    ensureEmulatorRegistry()
      .then(async (ns) => {
        emulatorRef.current = ns;
        try {
          await ensureDisplayRenderContext();
        } catch (_) {}
        if (!protocolAnalyzerRef.current && ns?.ProtocolAnalyzer) {
          try {
            protocolAnalyzerRef.current = new ns.ProtocolAnalyzer();
          } catch (_) {}
        }
        setEmulatorReady(true);
        forceRegistryTick((t) => t + 1);
      })
      .catch(() => {
        setEmulatorReady(false);
      });
    if (gamificationMode) {
      getComponentMap()
        .then(() => forceRegistryTick((t) => t + 1))
        .catch(() => {});
    }
  }, [gamificationMode]);
  useEffect(() => {
    wireStartRef.current = wireStart;
  }, [wireStart]);
  const [wireClickPos, setWireClickPos] = useState(null); // canvas-space position where wire was clicked
  // Segment-drag: tracks which wire segment handle is being dragged
  // { wireId, segIdx, isHoriz, startMouseCanvas: {x,y}, startPts: [...] }
  const [segDrag, setSegDrag] = useState(null);
  const segDragRef = useRef(null);
  const [hoveredPin, setHoveredPin] = useState(null);
  const [board, setBoard] = useState("arduino_uno");
  const [restoreProjectPrompt, setRestoreProjectPrompt] = useState(null);
  const [codeTab, setCodeTab] = useState(() => {
    return editorModeParam === "blocks" ? "block" : "code";
  });
  const { code, setCode } = useEditorStore();
  const [solverMode, setSolverMode] = useState("logic");
  const [webGpuSupported, setWebGpuSupported] = useState(false);
  const [blocklyXml, setBlocklyXml] = useState("");
  const [compContextMenu, setCompContextMenu] = useState(null); // { x, y, compId }
  const [bugReportComponent, setBugReportComponent] = useState(null); // component targeted for bug reporting
  const [frontendBugModalOpen, setFrontendBugModalOpen] = useState(false); // frontend general bug modal
  const [renameState, setRenameState] = useState({ id: null, x: 0, y: 0 });
  const [valueState, setValueState] = useState({ id: null, x: 0, y: 0, key: 'value' });
  const [showEngineSelector, setShowEngineSelector] = useState(false)

  useEffect(() => {
    if (navigator.gpu) {
      setWebGpuSupported(true);
    }
  }, []);

  const [blocklyGeneratedCode, setBlocklyGeneratedCode] = useState("");
  const [useBlocklyCode, setUseBlocklyCode] = useState(() => {
    return editorModeParam === "blocks";
  });
  const [blocklyDisabled, setBlocklyDisabled] = useState(() => {
    if (editorModeParam === "blocks") return false;
    try {
      const saved = localStorage.getItem("ohw_blockly_disabled");
      return saved === null ? true : saved === "true";
    } catch (_) {
      return true;
    }
  });

  useEffect(() => {
    if (editorModeParam === "blocks") {
      setCodeTab("block");
      setBlocklyDisabled(false);
      setUseBlocklyCode(true);
    } else if (editorModeParam === "code") {
      setCodeTab("code");
      setUseBlocklyCode(false);
    }
  }, [editorModeParam]);
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
  // Wire-preview cursor: ref mirror, NOT state. The rAF mousemove loop writes
  // here directly so pulling a wire re-renders ONLY WirePreviewPath (which
  // subscribes via useSyncExternalStore), instead of the whole 15k-line
  // page component on every mousemove.
  const mousePosRef = useRef({ x: 0, y: 0 });
  const mousePosTickRef = useRef(0);
  const mousePosListenersRef = useRef(new Set());
  const subscribeMousePos = useCallback((onStoreChange) => {
    mousePosListenersRef.current.add(onStoreChange);
    return () => {
      mousePosListenersRef.current.delete(onStoreChange);
    };
  }, []);
  const getMousePosSnapshot = useCallback(() => mousePosTickRef.current, []);
  // Thumbnail ref object: created early (autosave effect above needs the
  // identity); usePngExport() fills .current once its call site runs.
  const captureThumbnailRef = useRef(null);
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
  // Perf: emulator loads async (see ensureEmulatorRegistry below). The
  // analyzer instance is created once the registry is ready; until then the
  // ref stays null and protocol logging is skipped (same as empty-log).
  const protocolAnalyzerRef = useRef(null);
  // Registry-ready gate: Run/validation wait for this (fast — preloaded on
  // mount); UI shows a loading state instead of crashing on missing modules.
  // (Fulfilled by the warm-up effect above; refs declared below it.)
  const [emulatorReady, setEmulatorReady] = useState(() => isEmulatorRegistryReady());
  const emulatorRef = useRef(null);
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
  // Perf: incremental sticky serial bounds (boardId:label -> {min,max}) updated
  // O(channels) per plot point at ingest in workerStateIngest.js, so the
  // canvas never re-scans the buffer per frame. Cleared with plot data on stop.
  const plotBoundsRef = useRef(new Map());
  // Perf: set of subscribed serial labels ("boardId:label"). workerStateIngest
  // only materializes serialVars for subscribed labels while the plotter is
  // visible — otherwise every state message allocates an object for nobody.
  const subscribedSerialKeysRef = useRef(new Set());
  const [selectedPlotPins, setSelectedPlotPins] = useState([]); // Array<{ boardId, pinId }>
  const [plotterPaused, setPlotterPaused] = useState(false);
  const [plotterTimeDiv, setPlotterTimeDiv] = useState(1000); // ms per division (not used as divisions yet, but as total window size)
  // Perf: plotter visibility gate — plot ingest + canvas rAF loop skip all work
  // while the user is on the monitor tab (or the panel is closed).
  // NOTE: plain value (not ref) — worker.onmessage is installed per-Run and
  // closes over the render's values; the ingest path reads the REFS below so
  // late channel subscriptions still take effect mid-run.
  const isPlotterVisible = codeTab === "serial" && serialViewMode === "plotter" && isPanelOpen;
  const plotterPausedRef = useRef(false);
  plotterPausedRef.current = plotterPaused;
  const isPlotterVisibleRef = useRef(false);
  isPlotterVisibleRef.current = isPlotterVisible;

  // Perf: keep the subscribed serial-key set in sync with channel selection so
  // ingest knows which serialVars to materialize (pin channels need no keys).
  // Keys are plain labels (ingest matches against plotter labels, not board).
  useEffect(() => {
    const next = new Set();
    for (const rawChan of selectedPlotPins) {
      const chan = typeof rawChan === "string" ? { boardId: "default", pinId: rawChan } : rawChan;
      if (!chan?.pinId) continue;
      const isAnalog = typeof chan.pinId === "string" && chan.pinId.startsWith("A");
      const isLogic = !Number.isNaN(parseInt(chan.pinId));
      if (!isAnalog && !isLogic) next.add(chan.pinId);
    }
    subscribedSerialKeysRef.current = next;
  }, [selectedPlotPins]);


  const serialBoardOptions = useMemo(() => {
    const ids = components
      .filter((c) => /(arduino|rp2040|pico)/i.test(c.type))
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
      .filter((c) => /(arduino|rp2040|pico)/i.test(c.type))
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
        /(arduino|rp2040|pico)/i.test(c.type),
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

  // Stable identity: passed to useEsp32Engine + called from ~20 compile/run
  // sites. useCallback with zero deps (console.log only) so engine props
  // don't invalidate per render.
  const logSerial = useCallback((msg, color = "var(--text)") => {
    // In a real implementation this would push to a serial console state array
    console.log(`[SIM]`, msg);
  }, []);

  const lastCompiledRef = useRef(null);
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


  const canvasRef = useRef(null);
  const innerCanvasRef = useRef(null); // ref to the zoom-wrapper div — used for CSS-transform panning (Fix #4)
  const rafMoveRef = useRef(null); // pending rAF id for mousemove throttle (Fixes #1-#4)
  const pendingMoveRef = useRef(null); // latest computed move data, read by the rAF callback
  const rafZoomRef = useRef(null);
  const pendingZoomRef = useRef(null);
  const svgRef = useRef(null);
  const viewPanelRef = useRef(null);
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

  // Live-read mirrors: callbacks below stay reference-stable by reading
  // these refs instead of closing over per-render state. This keeps
  // CanvasComponent's custom props-equal comparator (which checks
  // getComponentStateAttrs identity) from invalidating on EVERY parent
  // render — the actual DOM-rebuild-per-keystroke culprit.
  // NOTE: isRunning is declared further below; mirror effects live next to
  // it (search "Keep stable-callback mirrors current") to avoid TDZ crashes.
  // Refs are declared here so callbacks defined anywhere can close over them.
  const isRunningRef = useRef(false);
  const liveEditingDisabledRef = useRef(false);
  const handleResetRef = useRef(null);
  const handleEsp32InteractionRef = useRef(null);

  const getComponentStateAttrs = useCallback((comp, liveStateOverride = null) => {
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
        if (isRunningRef.current) handleResetRef.current?.();
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

      if (workerRef.current && isRunningRef.current) {
        workerRef.current.postMessage({
          type: "INTERACT",
          compId: comp.id,
          event: event,
        });
      }

      if (handleEsp32InteractionRef.current?.(comp, event)) return;
    };

    return attrs;
  }, []);

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
  // SAB reader cursor (main-thread poll state for §12.3 T5). Offsets land in
  // sabOffsetsRef at START (workerStartPostamble return); buffer identity in
  // stateSabRef. Poll is Atomics.load-only — never blocks, never waits.
  const sabOffsetsRef = useRef(null);
  const sabCursorRef = useRef(null);
  const sabPollStatsRef = useRef({ polls: 0, frames: 0, slots: 0, lastSeq: -1 });
  // Command/event ring handles (§10.4): SabCommandWriter (main→worker) +
  // SabEventReader (worker→main), bound at START in workerStartPostamble.
  const cmdWriterRef = useRef(null);
  const evtReaderRef = useRef(null);
  const cmdBufferRef = useRef(null);
  const evtBufferRef = useRef(null);

  // Global SharedArrayBuffer Web Component Ticker Loop (Bypasses React)
  // + SAB state poll (§12.5 step 3): each rAF, after ticking web components,
  // poll dirty slots from the state SAB and mirror into liveOopStatesRef
  // (same shape as the postMessage path). postMessage stays as fallback +
  // slow mirror; SAB is the fast path. Exposes window.__sabPollStats for
  // Playwright verification.
  useEffect(() => {
    let active = true;
    let sabReaderMod = null;
    import("./utils/sabReader.js").then((m) => {
      sabReaderMod = m;
      if (typeof window !== "undefined") window.__sabReaderLoaded = true;
    }).catch(() => { sabReaderMod = null; });
    // Publish verification hooks immediately (before any run) so Playwright
    // and debug tooling can observe reader presence + isolation state.
    if (typeof window !== "undefined") {
      window.__sabPollStats = { ...sabPollStatsRef.current };
      window.__sabReaderLoaded = false;
      if (!("___sabOffsets" in window)) window.__sabOffsets = sabOffsetsRef.current;
    }
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
      try {
        const stats = sabPollStatsRef.current;
        const sab = stateSabRef.current;
        const offsets = sabOffsetsRef.current;
        // Event ring poll (§10.4): worker→main hints (BREAK_HIT/WATCH_HIT/
        // ERROR/TOAST). postMessage stays authoritative; overflow there.
        try {
          const evtReader = evtReaderRef.current
            || (typeof window !== "undefined" ? window.__sabEvtReader : null);
          if (evtReader && sabReaderMod && typeof sabReaderMod.drainSabEvents === "function" && isRunningRef.current) {
            const drained = sabReaderMod.drainSabEvents(evtReader, 16, appendConsoleEntry);
            if (drained && drained.length && typeof window !== "undefined") {
              window.__sabLastEvents = drained.slice(-8);
            }
          }
        } catch { /* event poll never breaks render loop */ }
        if (sabReaderMod && sab && offsets && isRunningRef.current) {
          if (!sabCursorRef.current) sabCursorRef.current = sabReaderMod.createSabCursor();
          const frames = sabReaderMod.pollSabFrames(sab, offsets, sabCursorRef.current);
          stats.polls += 1;
          if (Array.isArray(frames) && frames.length > 0) {
            stats.frames += 1;
            stats.slots += frames.length;
            const changed = sabReaderMod.applySabFrames(frames, liveOopStatesRef, runComponentUpdateCountsRef);
            changed.forEach(notifyLiveOopStateListeners);
          }
          const diag = sabReaderMod.getSabDiag(sab);
          if (diag) stats.lastSeq = diag.frameSeq;
        }
        // Publish every tick (even idle) — cheap object spread at rAF rate,
        // keeps __sabPollStats observable before/during/after runs.
        if (typeof window !== "undefined") {
          window.__sabPollStats = {
            ...stats,
            readerLoaded: !!sabReaderMod,
            running: !!(isRunningRef && isRunningRef.current),
          };
        }
      } catch { /* SAB poll must never break render loop */ }
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
  const runStartGuardRef = useRef(false);
  // Serial ingress ref: created here so hooks/effects ABOVE the
  // useSerialIngress() call site can already receive the stable ref object.
  // The hook below fills .current; consumers only dereference at event time.
  const pushSerialRxChunkRef = useRef(null);
  const handleEsp32Interaction = useCallback(() => false, []);
  const startEsp32Session = useCallback(async () => false, []);
  const stopEsp32Session = useCallback(() => {}, []);
  const esp32Socket = null;
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
  const currentProjectNameRef = useRef("Untitled");
  useEffect(() => {
    currentProjectNameRef.current = currentProjectName;
  }, [currentProjectName]);
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

  // Library Manager lives in hooks/useLibraryManager.js (identical behavior).
  const {
    libQuery,
    setLibQuery,
    libResults,
    setLibResults,
    libInstalled,
    setLibInstalled,
    isSearchingLib,
    setIsSearchingLib,
    installingLib,
    setInstallingLib,
    libMessage,
    setLibMessage,
    libSearchCache,
    loadLibraries,
    handleSearchLibraries,
    handleInstallLibrary,
  } = useLibraryManager({ lastCompiledRef });

  // ── Custom-component ZIP upload ───────────────────────────────────────────
  // Lives in hooks/useComponentZipUpload.js (identical gates + injection).
  const { handleUploadZip } = useComponentZipUpload({
    appendConsoleEntry,
    setCustomCatalogCounter,
  });

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
        syncWireIds(normalizedComponents, normalizedConnections);
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
  // ── Project: owner string ─────────────────────────────────────────────────
  const getOwner = () => user?.email || "guest";

  // ── Project: load project list helper ────────────────────────────────────
  const refreshProjectList = async () => {
    const projects = await listProjects(getOwner());
    setMyProjects(projects);
  };
  // ── Live-meeting collaboration (snapshots/handshake) ───────────────────────
  // Lives in hooks/useLiveMeeting.js (identical 60ms window + shapes).
  const {
    buildLiveMeetingSnapshot,
    replaceFilePath,
    applyLiveMeetingSnapshot,
    liveCanEdit,
    liveEditingDisabled,
    handleRequestLiveEditAccess,
    handleRespondToLiveEditRequest,
    handleEndLiveEditAccess,
  } = useLiveMeeting({
    currentProjectName,
    board,
    components,
    wires,
    code,
    projectFiles,
    openCodeTabs,
    activeCodeFileId,
    renameCodeFile,
    setBoard,
    setCode,
    setComponents,
    setWires,
    setProjectFiles,
    setOpenCodeTabs,
    setActiveCodeFileId,
    setCurrentProjectName,
    setCurrentProjectId,
    currentProjectIdRef,
    setHistory,
    lastCompiledRef,
    lastLiveSyncPayloadRef,
    liveApplyingRemoteRef,
    liveSyncTimerRef,
    liveMeetingMode,
    isLiveTeacher,
    liveGrantedEditorIds,
    currentLiveUserId,
    readOnly,
    liveSocketRef,
    setLiveEditRequestPending,
    setLiveMeetingStatus,
    isRunningRef,
    liveEditingDisabledRef,
    isRunning,
  });


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

  // Backend component sync (initial fetch, admin preview, IDB cache,
  // 12s...60s poller) lives in hooks/useBackendComponentSync.js.
  useBackendComponentSync({
    projectName,
    setCustomCatalogCounter,
    setCustomCatalogVersion,
    setPreviewBanner,
  });

  // ── Handle Panel Resize ──────────────────────────────────────────────────────
  // Panel-resize drags live in hooks/usePanelResize.js (identical clamps).
  const {
    onMouseDownResize,
    onMouseDownConsoleResize,
    onMouseDownExplorerResize,
  } = usePanelResize({
    panelWidth,
    setPanelWidth,
    setIsDragging,
    consoleHeight,
    setConsoleHeight,
    explorerWidth,
    setExplorerWidth,
    setIsExplorerDragging,
    isExplorerDragging,
    rightPanelRef,
  });



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
      .filter((c) => /arduino|pico|rp2040|attiny/i.test(c.type))
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
  // ── Static component descriptions ────────────────────────────────────────────
  // Lives in utils/staticContent.js (identical blurbs).
  // (COMPONENT_DESCRIPTIONS imported at module top.)

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

  // ── Serial auto-scroll (sticky + rAF-throttled) ───────────────────────────
  // Perf: only scrolls when the user is already near the bottom, and the DOM
  // write is deferred to rAF so the 100ms serial flush never forces sync layout.
  // (RightPanel owns an identical effect for its own pane refs; this covers the
  // page-level serialOutputRef.)
  useEffect(() => {
    const activeAutoscroll = boardAutoscrolls[serialBoardFilter] ?? true;
    const activePaused = boardPausedStates[serialBoardFilter] ?? serialPaused;
    const el = serialOutputRef.current;
    if (!activeAutoscroll || activePaused || !el) return;
    const raf = requestAnimationFrame(() => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
      if (nearBottom) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [serialHistory, serialPaused, serialBoardFilter, boardAutoscrolls, boardPausedStates]);

  // Serial-console ingress pipeline (plotter parse, arbitration, pause
  // queue, 100ms batch flush). Extracted to hooks/useSerialIngress.js —
  // behavior identical, verified by serial Playwright checks. The
  // pushSerialRxChunkRef object is created above (needed by useEsp32Engine)
  // and filled by the hook — hence excluded from destructuring.
  const {
    serialPlotBufferRef,
    serialPlotLabelsRef,
    latestParsedSerialRef,
    serialIngressArbitrationRef,
    serialPausedRef,
    serialPausedQueueRef,
    pendingSerialLogsRef,
    serialOverflowRef,
    parseSerialForPlotter,
    appendSerialRxChunk,
    pushSerialRxChunk,
    flushSerialLogs,
    pushSerialTxLine,
    clearSerialMonitor,
  } = useSerialIngress({ isRunning, serialPaused, setSerialHistory, pushSerialRxChunkRef });

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
  // ── Canvas geometry (pin resolution, exit stubs, fit/zoom) ───────────────
  // Lives in hooks/useCanvasGeometry.js (identical aliases, stub, fit semantics).
  const {
    componentsMap,
    getPinPosForComp,
    getPinPos,
    getComponentBounds,
    getPinExitPoint,
    getPinPosWithGhosts,
    fitToView,
    handleZoomTextClick,
    applyZoomAtCenter,
  } = useCanvasGeometry({
    components,
    wires,
    canvasZoom,
    canvasRef,
    innerCanvasRef,
    canvasZoomRef,
    canvasOffsetRef,
    zoomTextTimerRef,
    setCanvasZoom,
    setCanvasOffset,
    getComponentStateAttrs,
    COMPONENT_REGISTRY,
    PIN_DEFS,
    autofixPlan,
  });

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

  // ── Component placement (add/undo/drop/center) ─────────────────────────
  // Lives in hooks/useComponentPlacement.js (identical ids, snap, WASM+fallback).
  const {
    addComponentInternal,
    onPaletteItemClick,
    undo,
    redo,
    onCanvasDrop,
    addComponentAt,
    addComponentAtCenter,
  } = useComponentPlacement({
    liveEditingDisabled,
    saveHistory,
    components,
    wires,
    code,
    autoWiringEnabled,
    autoCodingEnabled,
    generateAutonomousSetup,
    PIN_DEFS,
    autoBreadboardEnabled,
    appendConsoleEntry,
    setIsConsoleOpen,
    libInstalled,
    handleInstallLibrary,
    setProjectFiles,
    currentCodeRef,
    activeCodeFileId,
    setCode,
    setCodeTab,
    setIsPanelOpen,
    canvasRef,
    canvasOffsetRef,
    canvasZoomRef,
    dragPayload,
    isRunningRef,
    componentsRef,
    wiresRef,
    setHistory,
    setComponents,
    setWires,
    setSelected,
  });
  // ── Enhanced Zooming (Pinch Only) ──────────────────────────────────────────
  // ── Canvas touch gestures (pinch zoom) ────────────────────────────────
  // Lives in hooks/useCanvasTouchGestures.js (identical clamps + flush).
  const {
    initialTouchDistanceRef,
    initialCanvasZoomRef,
    initialTouchCenterCanvasRef,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  } = useCanvasTouchGestures({
    isCanvasLockedRef,
    canvasZoomRef,
    canvasOffsetRef,
    canvasRef,
    setCanvasZoom,
    setCanvasOffset,
  });

  // Pinch-to-zoom via trackpad (Ctrl + Wheel)
  // Key insight: NEVER update React state mid-pinch — that causes React to re-render
  // which overwrites our DOM transform on the SAME frame, creating the vibration.
  // Instead: apply only the CSS transform during pinch, update refs for correctness,
  // then flush to React state via a debounce AFTER the gesture ends.
  // ── Canvas wheel zoom (DOM-first, debounced flush) ──────────────────────────
  // Lives in hooks/useCanvasWheelZoom.js (identical clamp + anchor math).
  const { onWheel } = useCanvasWheelZoom({
    isCanvasLockedRef,
    canvasZoomRef,
    canvasOffsetRef,
    canvasRef,
    innerCanvasRef,
    isRunning,
    rafZoomRef,
    setCanvasZoom,
    setCanvasOffset,
  });

  // ── Move and Select component ──────────────────────────────────────────────

  // Stable identity: passed to every memoized CanvasComponent.
  // ── Canvas drag interactions (move/snap/pan/hover/commit) ──────────────
  // Lives in hooks/useCanvasDragInteractions.js (identical RAF loop + commit).
  // NOTE: intentionally [] deps inside — values flow via refs, never resubscribe.
  const { onCompClick } = useCanvasDragInteractions({
    setSelected,
    setWireClickPos,
    isDraggingRef,
    isExplorerDraggingRef,
    movingComp,
    canvasZoomRef,
    canvasOffsetRef,
    canvasRef,
    innerCanvasRef,
    segDragRef,
    isPanningRef,
    panStartRef,
    didPanRef,
    isCanvasLockedRef,
    wireStartRef,
    showInspector,
    liveOopStatesRef,
    getPinPosRef,
    wiresRef,
    componentsRef,
    mousePosRef,
    mousePosTickRef,
    mousePosListenersRef,
    rafMoveRef,
    pendingMoveRef,
    setHoveredElement,
    setCanvasOffset,
    setComponents,
    setWires,
    setHistory,
    setIsComponentDragging,
    setSnappingHoles,
    setSegDrag,
  });


  // Stable identity: CanvasComponent comparator checks updateComponentAttr
  // indirectly via getComponentStateAttrs closure chain — must not churn.
  // ── Component attrs/rename ────────────────────────────────────────────
  // Lives in hooks/useComponentAttrs.js (identical memo shape).
  const { updateComponentAttr, onCompContextMenu, handleRenameComponentId } =
    useComponentAttrs({
      liveEditingDisabledRef,
      saveHistory,
      setComponents,
      components,
      selected,
      setSelected,
      setCompContextMenu,
      setRenameState,
      setValueState,
    });
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

  // ── Wire actions (create/recolor/layer) ─────────────────────────────────
  // Lives in hooks/useWireActions.js (identical guards + color pick).
  const { onPinClick, updateWireColor, toggleWireLayer, deleteWire } =
    useWireActions({
      getPinPos,
      saveHistory,
      wireStartRef,
      isRunningRef,
      liveEditingDisabledRef,
      setWireStart,
      setWires,
      setSelected,
    });

  // ── Rewire to board ─────────────────────────────────────────────────────
  // Lives in utils/wireToBoard.js (identical plan + snippet strip).
  const handleWireToBoard = (compId, targetBoardId) =>
    handleWireToBoardAction({
      compId,
      targetBoardId,
      components,
      wires,
      saveHistory,
      generateAutonomousSetup,
      PIN_DEFS,
      autoBreadboardEnabled,
      setComponents,
      setWires,
      setProjectFiles,
      activeCodeFileId,
      code,
      setCode,
    });
  // ── Open code file ──────────────────────────────────────────────────────
  // Lives in utils/openCodeFile.js (identical resolve/create/open).
  const handleOpenCode = (comp) =>
    handleOpenCodeAction({
      comp,
      projectFiles,
      setProjectFiles,
      openCodeTabs,
      setOpenCodeTabs,
      setActiveCodeFileId,
      setCodeTab,
      setIsPanelOpen,
      setShowCodeExplorer,
    });
  // ── Auto-code (worker snippet + 250ms auto-effect) ──────────────────────
  // Lives in hooks/useAutoCode.js (identical trace/merge/effect).
  const { handleAutoCode } = useAutoCode({
    components,
    wires,
    setProjectFiles,
    activeCodeFileId,
    code,
    currentCodeRef,
    setCode,
    setOpenCodeTabs,
    setActiveCodeFileId,
    setCodeTab,
    setIsPanelOpen,
    setShowCodeExplorer,
    autoCodingEnabled,
    isRunning,
    liveEditingDisabled,
    projectFilesRef,
  });
  // Stable identity: reads live state via refs so the memoized canvas
  // tree isn't invalidated on unrelated renders.

  // Stable identity (same ref-mirror rationale as deleteWire above).
  // ── Component move/rotate ───────────────────────────────────────────────
  // Lives in hooks/useComponentMove.js (identical snapshot/orbit/guards).
  const { onCompMouseDown, rotateComponent } = useComponentMove({
    components,
    wires,
    isRunning,
    movingComp,
    setIsComponentDragging,
    isRunningRef,
    liveEditingDisabledRef,
    saveHistory,
    setComponents,
    wiresRef,
  });
  // ── Code-file management (create/upload/download/UF2) ───────────────────────
  // Lives in hooks/useCodeFiles.js (identical templates + gates).
  const {
    downloadCodeFile,
    getBoardFirmwareAssets,
    fetchDefaultMicroPythonUf2Payload,
    fetchDefaultCircuitPythonUf2Payload,
    resolveFolderFilePolicy,
    createCodeFile,
    createCodeTab,
    uploadCodeFile,
  } = useCodeFiles({
    projectFileMap,
    projectFiles,
    boardComponentMap,
    rp2040BoardSourceModes,
    activeCodeFile,
    setProjectFiles,
    setOpenCodeTabs,
    setActiveCodeFileId,
    appendConsoleEntry,
    micropythonUf2PayloadRef,
    circuitPythonUf2PayloadRef,
  });
  // ── Firmware/download artifacts ───────────────────────────────────────────
  // Lives in hooks/useFirmwareArtifacts.js (identical bytes + dep arrays).
  const {
    sanitizeDownloadStem,
    resolveFirmwareBoardFileStem,
    buildSimulationJsonPayload,
    downloadSimulationJson,
    parseFirmwareUploadFile,
    normalizeFirmwareFileName,
    triggerFirmwareDownload,
    resolveStoredFirmwareArtifact,
    handleDownloadFirmware,
  } = useFirmwareArtifacts({
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
    appendConsoleEntry,
    boardComponentMap,
    firmwareBoardOptions,
    selected,
    lastCompiledRef,
  });
  // ── Firmware dialogs/upload ───────────────────────────────────────────────
  // Lives in hooks/useFirmwareDialogs.js (identical validation + override).
  const {
    openFirmwareDownloadDialog,
    openFirmwareUploadDialog,
    toggleBoardFirmwareSource,
    applyUploadedFirmwareToBoard,
  } = useFirmwareDialogs({
    firmwareBoardOptions,
    setFirmwareDownloadTarget,
    setShowFirmwareDownloadDialog,
    setFirmwareUploadTarget,
    setFirmwareUploadFile,
    setShowFirmwareUploadDialog,
    firmwareUploadInputRef,
    saveHistory,
    setComponents,
    boardComponentMap,
    appendConsoleEntry,
    setIsApplyingFirmwareUpload,
    parseFirmwareUploadFile,
    lastCompiledRef,
  });
  // GDB launcher lives in utils/gdbLauncher.js (identical session URL).
  const handleStartGDB = () => launchGdbSession({ appendConsoleEntry });

  // ── Project persistence (save/load/backup/restore/wokwi) ───────────────────
  // Lives in hooks/useProjectPersistence.js (identical gates + stripping).
  const {
    handleSave,
    handleConfirmSave,
    handleNewProject,
    handleLoadProject,
    handleDeleteProject,
    handleStartRename,
    handleConfirmRename,
    toggleFavourite,
    handleCopyProject,
    handleBackupWorkflow,
    handleRestoreWorkflow,
    handleImportWokwiZip,
  } = useProjectPersistence({
    saveDialogName,
    setSaveDialogName,
    setShowSaveDialog,
    currentProjectNameRef,
    currentProjectIdRef,
    setCurrentProjectId,
    autoSaveTimerRef,
    getOwner,
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
    setCurrentProjectName,
    setBoard,
    setCode,
    setBlocklyXml,
    setBlocklyGeneratedCode,
    setUseBlocklyCode,
    setComponents,
    setWires,
    setProjectFiles,
    setOpenCodeTabs,
    setActiveCodeFileId,
    openCodeFile,
    setHistory,
    lastCompiledRef,
    isRunning,
    componentsRef,
    wiresRef,
    renameValue,
    setRenameValue,
    setRenamingProjectId,
    setFavouriteProjectIds,
    setShowProjectsSidebar,
    currentProjectName,
    captureThumbnailRef,
    refreshProjectList,
  });
  // ── Entry-load effects (restore/share/live-socket) ──────────────────────────
  // Lives in hooks/useEntryLoadEffects.js (identical guards + throttle).
  useEntryLoadEffects({
    assessmentMode,
    projectName,
    shareId,
    liveSessionCode,
    assessmentParams,
    user,
    handleLoadProject,
    setRestoreProjectPrompt,
    location,
    justSharedRef,
    setBoard,
    setCode,
    setComponents,
    setWires,
    setProjectFiles,
    setOpenCodeTabs,
    setActiveCodeFileId,
    setCurrentProjectId,
    currentProjectIdRef,
    setCurrentProjectName,
    setHistory,
    lastCompiledRef,
    token,
    setLiveMeetingShareCode,
    setLiveMeetingMeta,
    setLiveMeetingParticipantCounts,
    setLiveGrantedEditorIds,
    setLiveGrantedEditors,
    setLivePendingEditRequests,
    setLiveMeetingStatus,
    isLiveTeacher,
    applyLiveMeetingSnapshot,
    liveMeetingMode,
    liveSocketRef,
    liveApplyingRemoteRef,
    liveCanEdit,
    buildLiveMeetingSnapshot,
    lastLiveSyncPayloadRef,
    lastLiveSyncTimeRef,
    currentLiveUserId,
    setLiveEditRequestPending,
    activeCodeFileId,
    board,
    code,
    components,
    currentProjectName,
    openCodeTabs,
    projectFiles,
    wires,
  });


  // ── Share dialog (snapshot/live links) ────────────────────────────────────
  // Lives in hooks/useShareDialog.js (identical dedup + gates).
  const {
    handleSyncToCloud,
    handleGenerateShareUrl,
    handleShareSimulation,
    handleShareVisibilityChange,
    handleShareLinkTypeChange,
    handleCopyShareUrl,
  } = useShareDialog({
    currentProjectName,
    currentProjectIdRef,
    setCurrentProjectId,
    autoSaveTimerRef,
    getOwner,
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
    setCurrentProjectName,
    refreshProjectList,
    captureThumbnailRef,
    shareVisibility,
    setShareVisibility,
    shareLinkType,
    setShareLinkType,
    setShareUrl,
    setShareCopied,
    shareUrl,
    justSharedRef,
    navigate,
    setIsSharingSimulation,
    activeUser,
    isAnyAuthenticated,
    shareId,
    setShowShareDialog,
  });
  // ── Validation/autofix core ───────────────────────────────────────────────
  // Lives in hooks/useValidationCore.js (identical cache + bypass + apply).
  const {
    logCompileSummary,
    registerGdbArtifact,
    buildValidationSignature,
    runCircuitValidation,
    applyFix,
    applyProjectChangePlan,
    handleApplyPlan,
  } = useValidationCore({
    appendConsoleEntry,
    validationErrors,
    setValidationErrors,
    setValidationToast,
    setAutofixPlan,
    components,
    wires,
    // Perf: validator entry points resolve lazily from the emulator chunk.
    // Wrappers below throw a clear error if Run is attempted before ready
    // (UI gates on emulatorReady instead — see handleRun preflight).
    runUnifiedValidation: (...a) => {
      if (!emulatorRef.current?.runUnifiedValidation) throw new Error('Emulator still loading');
      return emulatorRef.current.runUnifiedValidation(...a);
    },
    FullCircuitValidator: new Proxy(function () {}, {
      construct(_t, args) {
        if (!emulatorRef.current?.FullCircuitValidator) throw new Error('Emulator still loading');
        return new emulatorRef.current.FullCircuitValidator(...args);
      },
    }),
    analyzeCodeHardwareSync: (...a) => {
      if (!emulatorRef.current?.analyzeCodeHardwareSync) throw new Error('Emulator still loading');
      return emulatorRef.current.analyzeCodeHardwareSync(...a);
    },
    boardComponents,
    code,
    codeTab,
    useBlocklyCode,
    blocklyGeneratedCode,
    activeCodeFile,
    activeCodeFileId,
    projectFiles,
    saveHistory,
    setComponents,
    setWires,
    setProjectFiles,
    setSelected,
    setWireStart,
    wireStartRef,
    setSnappingHoles,
    movingComp,
    setIsComponentDragging,
    autofixPlan,
    sharedApplyCircuitFix: (...a) => {
      if (!emulatorRef.current?.applyCircuitFix) throw new Error('Emulator still loading');
      return emulatorRef.current.applyCircuitFix(...a);
    },
    isRunning,
    setHealthScore,
    setShowValidation,
    setPendingVerificationRule,
    triggerAutofixAnalysis,
    validationRunCacheRef,
    EmulatorComponents: new Proxy({}, {
      get(_t, prop) {
        const ns = emulatorRef.current;
        if (!ns) throw new Error('Emulator still loading');
        return ns[prop];
      },
    }),
    setIsPanelOpen,
  });
  // ── Hardware flash (ports/resolve/upload) ───────────────────────────────────
  // Lives in hooks/useHardwareUpload.js (identical key + poll + release).
  const {
    handleHardwareBoardChange,
    resolveBoardHex,
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
    hardwareConnected,
    hardwareConnecting,
    connectHardwareSerial,
    disconnectHardwareSerial,
    sendHardwareSerialLine,
    handleUploadToHardware,
  } = useHardwareUpload({
    setHardwareBoardId,
    setSelected,
    getBoardCompileFiles,
    resolveBoardFqbnForComponent,
    projectFiles,
    activeCodeFileId,
    code,
    hardwareBoardId,
    boardComponents,
    BOARD_FQBN,
    flashFirmware,
    pushSerialTxLine,
    pushSerialRxChunk,
    setHardwareStatus,
    board,
    BOARD_DEFAULT_BAUD,
    hardwareSerialTargetRef,
    setHardwareSerialTargetId,
    appendConsoleEntry,
    runCircuitValidation,
  });
  const handleRun = async (options = {}) => {
    try {
      // Perf: gate Run behind emulator readiness. The emulator chunk loads in
      // the background on mount (usually warm by the time the user hits Run);
      // if not, wait for it with a loading toast instead of crashing.
      if (!isEmulatorRegistryReady()) {
        appendConsoleEntry("info", "Loading component library…", "simulator");
        try {
          const ns = await ensureEmulatorRegistry();
          emulatorRef.current = ns;
          if (!protocolAnalyzerRef.current && ns?.ProtocolAnalyzer) {
            try {
              protocolAnalyzerRef.current = new ns.ProtocolAnalyzer();
            } catch (_) {}
          }
          setEmulatorReady(true);
        } catch (err) {
          appendConsoleEntry("error", "Component library failed to load. Check connection and retry.", "simulator");
          return;
        }
      }
      // ── Run preflight (guard/validation/baud) ─────────────
      // Lives in utils/runPreflight.js (identical guard + reset semantics).
      // NOTE: selectedRunBoardId is a dead value in the original (computed,
      // never consumed) — still returned for shape parity, not destructured.
      const preflight = await runPreflight(
        {
          isRunning,
          isCompiling,
          components,
          serialBaudRate,
          serialBoardFilter,
        },
        {
          runStartGuardRef,
          runCircuitValidation,
          appendConsoleEntry,
          setIsCompiling,
          setRunStartedAtMs,
          setRunDurationSec,
          rp2040GdbLastLogRef,
          rp2040WirelessLastLogRef,
          rp2040UartMicroPythonBoardsRef,
          rp2040UartSilentWarnedBoardsRef,
          serialIngressArbitrationRef,
          serialPausedQueueRef,
          runComponentUpdateCountsRef,
          runPinTransitionCountsRef,
          runLagTelemetryLastStateRef,
          runLagTelemetryLastLogRef,
          runFpsTelemetryLastLogRef,
          runLastBoardPinsRef,
          BOARD_DEFAULT_BAUD,
          selectedSerialBoardKind,
          serialBoardMap,
        },
      );
      if (preflight.aborted) return;
      const {
        selectedRunBaud,
        boardHexMap,
        boardPythonMap,
        boardPythonFilesMap,
        boardRuntimeEnvMap,
        boardBaudMap,
        programmableBoards,
        isBackendProxy,
        singleProgrammableBoardId,
        boardsWithoutCompilableSketch,
      } = preflight;
      let { result } = preflight;

      // ── Guided-project firmware shortcut ──────────────────────────────
      // Lives in utils/guidedFirmware.js (identical static/cache priority).
      ({ result } = await resolveGuidedFirmware(
        { canvasOnly, readOnly, projectName, programmableBoards },
        {
          boardHexMap,
          boardBaudMap,
          boardBaudRates,
          BOARD_DEFAULT_BAUD,
          appendConsoleEntry,
          result,
        },
      ));


      if (isBackendProxy) {
        result = {
          hex: "",
          components: components,
          connections: wires,
        };
      } else if (!result && programmableBoards.length > 0) {
        for (const boardComp of programmableBoards) {
          // ── Per-board loop prologue (fqbn/uploaded/source-resolve) ─────────
          // Lives in utils/boardLoopPrologue.js (identical maps + guards).
          const prologue = resolveBoardLoopPrologue(
            {
              boardComp,
              selectedRunBaud,
              singleProgrammableBoardId,
              activeCodeFile,
              code,
              projectFiles,
              useBlocklyCode,
              blocklyGeneratedCode,
            },
            {
              boardBaudMap,
              boardBaudRates,
              boardHexMap,
              boardsWithoutCompilableSketch,
              getBoardCompileFiles,
              getBoardMainCode,
              getBoardFirmwareAssets,
              normalizeFirmwareFileName,
              appendConsoleEntry,
              result,
            },
          );
          result = prologue.result;
          if (prologue.disposition === "continue") continue;
          const {
            kind,
            targetFqbn,
            firmwareAssets,
            activeFileExt,
            activeBoardFile,
            activeFileTargetsBoard,
            boardEnabledFiles,
            pythonSource,
            hasPythonSource,
            activePrefersIno,
            activePrefersPy,
            compileUnit,
            compileSource,
          } = prologue;

          // ── RP2040 per-board compile ────────────────────────────────────
          // Lives in utils/rp2040Compile.js (identical UF2/cache semantics).
          if (kind === "rp2040") {
            const rp2040Out = await compileRp2040Board(
              {
                boardComp,
                kind,
                targetFqbn,
                compileUnit,
                compileSource,
                activePrefersIno,
                activePrefersPy,
                hasPythonSource,
                pythonSource,
                firmwareAssets,
                boardEnabledFiles,
                projectFiles,
                activeCodeFileId,
                code,
              },
              {
                boardHexMap,
                boardPythonMap,
                boardPythonFilesMap,
                boardRuntimeEnvMap,
                boardsWithoutCompilableSketch,
                appendConsoleEntry,
                logSerial,
                logCompileSummary,
                registerGdbArtifact,
                fetchDefaultCircuitPythonUf2Payload,
                fetchDefaultMicroPythonUf2Payload,
                result,
              },
            );
            result = rp2040Out.result;
            continue;
          }


          // ── Generic per-board compile (AVR) ───────────────────
          // Lives in utils/genericBoardCompile.js (identical cache).
          {
            const genericOut = await compileGenericBoard(
              {
                boardComp,
                kind,
                targetFqbn,
                compileUnit,
                compileSource,
                projectFiles,
                activeCodeFileId,
                code,
              },
              {
                boardHexMap,
                appendConsoleEntry,
                logSerial,
                logCompileSummary,
                registerGdbArtifact,
                result,
              },
            );
            result = genericOut.result;
          }
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

      // ── No-board fallback compile ─────────────────────────────────────
      // Lives in utils/fallbackCompile.js (identical offline-cache wrapper).
      ({ result } = await compileFallbackBoard(
        {
          useBlocklyCode,
          blocklyGeneratedCode,
          code,
          board,
          projectFiles,
          activeCodeFileId,
        },
        {
          BOARD_FQBN,
          appendConsoleEntry,
          logSerial,
          logCompileSummary,
          registerGdbArtifact,
          result,
        },
      ));

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

      // ── Run worker setup (render/sim/network) ───────────────────────────
      // Lives in runWorkers.js (identical order + handshakes + AP announce).
      const { renderWorker, worker } = setupRunWorkers({
        components,
        renderWorkerRef,
        workerRef,
        setRenderWorker,
      });


      worker.onmessage = async (event) => {
        const msg = event.data;
        const msgArrivalMs = performance.now();

        // ── Worker control plane (error/toast/teacher-key) ────────────────
        // Lives in utils/workerControlPlane.js (identical download naming).
        if (await handleWorkerControlMessage(msg, {
          appendConsoleEntry,
          logSerial,
          handleStop,
          setValidationToast,
        })) return;

        // ── Debug control-plane replies (DEBUG_STATE / SNAPSHOT / MEM) ────
        // Owns halted/snapshot/memView state; returns true when consumed.
        try {
          if (debugControlsRef.current?.handleDebugMessage?.(msg)) return;
        } catch { /* debug feed never breaks ingest */ }


        if (
          msg.type === "state" ||
          (msg.type === "debug" && msg.category === "rp2040-runtime")
        ) {
          if (!isBackendProxy) {
            setIsBooting(false);
          }
        }

        // ── RP2040 debug (runtime/wifi/wireless-stub) ───────────────────────
        // Lives in utils/rp2040DebugObserver.js (identical dedup + banners).
        handleRp2040DebugMessage(msg, {
          boardComponents,
          components,
          appendConsoleEntry,
          logSerial,
          rp2040UartMicroPythonBoardsRef,
          rp2040UartSilentWarnedBoardsRef,
          rp2040DebugLastLogRef,
          rp2040WirelessLastLogRef,
          liveOopStatesRef,
          notifyLiveOopStateListeners,
        });

        // ── RP2040 GDB/SPI debug ────────────────────────────────────────
        // Lives in utils/rp2040GdbSpi.js (identical dedup + field order).
        handleRp2040GdbSpiMessage(msg, {
          boardComponents,
          rp2040GdbLastLogRef,
          rp2040DebugTelemetryEnabled,
          appendConsoleEntry,
        });

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
        // ── Worker state ingestion (pins/neopixels/components/LAG) ───────
        // Lives in utils/workerStateIngest.js (identical caps + traces).
        handleWorkerStateMessage(msg, msgArrivalMs, {
          runLastBoardPinsRef,
          runPinTransitionCountsRef,
          renderPinsByBoardRef,
          renderAnalogByBoardRef,
          livePinStatesRef,
          plotterPaused: plotterPausedRef.current,
          latestParsedSerialRef,
          serialPlotLabelsRef,
          plotDataRef,
          plotBoundsRef,
          subscribedSerialKeysRef,
          isPlotterVisible: isPlotterVisibleRef.current,
          renderNeopixelsByBoardRef,
          applyLiveNeopixelData,
          runComponentUpdateCountsRef,
          renderComponentsByBoardRef,
          buttonInteractStartTimeRef,
          updateLiveOopStates,
          handleTelemetryStateMessageRef,
          components,
          boardComponents,
          runLagTelemetryLastStateRef,
          runLagTelemetryLastLogRef,
          solverMode,
          appendConsoleEntry,
        });

        // ── Protocol observer (serial/I2C/SPI/…/I2S/flush) ────────────────
        // Lives in utils/protocolObserver.js (identical log-only semantics).
        handleProtocolObserverMessage(msg, {
          boardComponents,
          pushSerialRxChunk,
          protocolAnalyzerRef,
          pendingProtocolLogsRef,
          protocolLogsTimerRef,
          setProtocolLogs,
          appendConsoleEntry,
          setIsDeviceSleeping,
          i2sAudioCtxRef,
          i2sNextScheduledTimeRef,
        });

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

      // ── Worker START postamble (SAB + payload) ──────────────────────────
      // Lives in utils/workerStartPostamble.js (identical layout + maps).
      postWorkerStartMessage(
        worker,
        {
          components,
          wires,
          result,
          selectedRunBaud,
          options,
          buildSimulationJsonPayload,
          boardHexMap,
          boardPythonMap,
          boardPythonFilesMap,
          boardRuntimeEnvMap,
          boardBaudMap,
          rp2040DebugTelemetryEnabled,
          simulationSpeed,
          componentTelemetryEnabled,
          isBooting,
          isCompiling,
          telemetryMode,
          telemetryWatchedParamsMap,
          deepSiliconDebuggingEnabled,
          logSerial,
        },
        { COMPONENT_REGISTRY, stateSabRef, sabOffsetsRef, sabCursorRef, sabPollStatsRef, cmdBufferRef, evtBufferRef, cmdWriterRef, evtReaderRef },
      );


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

  // ── Teacher-key capture + embed bridges ─────────────────────────────────────
  // Lives in hooks/useTeacherKeyCapture.js (identical cadence + shape).
  const { runFnRef, dispatchTeacherKeyCapture, generateTeacherKey } =
    useTeacherKeyCapture({
      handleRun,
      canvasOnly,
      serialRelayActiveRef,
      lastRelayedLengthRef,
      serialHistoryRef,
      serialPanelDragging,
      serialPanelDragOffset,
      setSerialPanelPos,
      setSerialPanelGrabbing,
      components,
      buildSimulationJsonPayload,
      workerRef,
      isRunning,
      isQueuedForTeacherKey,
      setIsQueuedForTeacherKey,
      appendConsoleEntry,
    });
  // ── Run stop (teardown + summaries + blackout) ──────────────────────────────
  // Lives in hooks/useRunStop.js (identical [] deps + event).
  const { handleStop } = useRunStop({
    isRunningRef,
    runStartGuardRef,
    rp2040GdbLastLogRef,
    rp2040WirelessLastLogRef,
    rp2040UartMicroPythonBoardsRef,
    rp2040UartSilentWarnedBoardsRef,
    runLagTelemetryLastStateRef,
    runLagTelemetryLastLogRef,
    runFpsTelemetryLastLogRef,
    runComponentUpdateCountsRef,
    runPinTransitionCountsRef,
    runLastBoardPinsRef,
    renderPinsByBoardRef,
    renderAnalogByBoardRef,
    renderComponentsByBoardRef,
    renderNeopixelsByBoardRef,
    componentsRef,
    workerRef,
    renderWorkerRef,
    setRenderWorker,
    setIsRunning,
    setIsCompiling,
    setIsBooting,
    setIsPaused,
    setRunStartedAtMs,
    setRunDurationSec,
    livePinStatesRef,
    clearLiveNeopixelData,
    applyLiveNeopixelData,
    liveOopStatesRef,
    notifyLiveOopStateListeners,
    setSerialHistory,
    plotDataRef,
    plotBoundsRef,
    setSerialPaused,
    setPlotterPaused,
    serialPlotBufferRef,
    serialPlotLabelsRef,
    latestParsedSerialRef,
    serialIngressArbitrationRef,
    serialPausedQueueRef,
    pendingSerialLogsRef,
    serialOverflowRef,
    appendConsoleEntry,
  });
  // ── Run timing/status effects ───────────────────────────────────────────────
  // Lives in hooks/useRunTimingEffects.js (identical backdate + ticker).
  const { bootStartedAtRef } = useRunTimingEffects({
    isBooting,
    isRunning,
    isCompiling,
    setRunStartedAtMs,
    setRunDurationSec,
    runStartedAtMs,
    hardwareStatus,
    lastHardwareStatusRef,
    appendConsoleEntry,
  });
  // ── Run controls (pause/reset/serial/baud) ──────────────────────────────────
  // Lives in hooks/useRunControls.js (identical routing + dep arrays).
  const {
    handlePause,
    handleResume,
    handleReset,
    sendSerialInput,
    updateBoardBaudRate,
    updateGlobalBaudRate,
  } = useRunControls({
    workerRef,
    setIsPaused,
    setSerialHistory,
    isRunningRef,
    serialInput,
    serialLineEnding,
    isRunning,
    serialBoardFilter,
    serialBaudRate,
    pushSerialTxLine,
    hardwareConnected,
    hardwareSerialTargetRef,
    hardwareBoardId,
    sendHardwareSerialLine,
    setSerialInput,
    setBoardBaudRates,
    setSerialBaudRate,
    cmdWriterRef,
    sabOffsetsRef,
  });

  // ── Debug control-plane (§10.7) ───────────────────────────────────────
  // Ring-first via cmdWriterRef; worker replies (DEBUG_STATE / DEBUG_SNAPSHOT
  // / DEBUG_MEM) are fed from worker.onmessage above via handleDebugMessage.
  // Ref mirror: worker.onmessage is installed per-Run and closes over refs,
  // so the live handleDebugMessage identity is published through this ref.
  const debugControls = useDebugControls({ workerRef, cmdWriterRef, isRunning });
  const debugControlsRef = useRef(null);
  debugControlsRef.current = debugControls;
  const openComponentEditor = useCallback(() => {
    try {
      navigate("/component-editor");
    } catch (_) {
      window.location.assign("/component-editor");
    }
  }, [navigate]);

  // ── PNG Export ────────────────────────────────────────────────────────────


  // Schematic export lives in hooks/useSchematicExport.js (identical SVG).
  const {
    schematicSvgRef,
    generateSchematic,
    downloadSchematicPng,
    downloadSchematicPdf,
  } = useSchematicExport({
    components,
    wires,
    board,
    setSchematicLoading,
    setSchematicDataUrl,
  });

  // BOM CSV export lives in hooks/useCompCsvExport.js (identical output).
  const { downloadCompCsv } = useCompCsvExport({ components });

  // ── PNG Import ────────────────────────────────────────────────────────────
  // importFileRef is created inside useProjectImport (returned below).
  // NOTE: usePngExport is called AFTER buildSimulationJsonPayload is defined
  // (line ~7413) — hook order below respects that (see second call site).
  const { importFileRef, applyImportedProjectMeta, importPng } =
    useProjectImport({
      components,
      wires,
      isRunning,
      isCompiling,
      saveHistory,
      setBoard,
      setCode,
      setBlocklyXml,
      setBlocklyGeneratedCode,
      setUseBlocklyCode,
      setComponents,
      setWires,
      setProjectFiles,
      setOpenCodeTabs,
      setActiveCodeFileId,
      openCodeFile,
      setCurrentProjectId,
      currentProjectIdRef,
      setCurrentProjectName,
      setHistory,
      setShowProjectsSidebar,
      setSelected,
      setWireStart,
      wireStartRef,
      captureThumbnailRef,
      lastCompiledRef,
      canvasOnly,
      appendConsoleEntry,
    });

  // Keep stable-callback mirrors current (runs after every commit).
  useEffect(() => {
    handleResetRef.current = handleReset;
  });
  // PNG export + thumbnail lives in hooks/usePngExport.js (identical bytes).
  // Called here (after buildSimulationJsonPayload exists) — not above.
  const { downloadPng, captureThumbnail } = usePngExport({
    captureThumbnailRef,
    components,
    wires,
    board,
    code,
    blocklyXml,
    blocklyGeneratedCode,
    useBlocklyCode,
    projectFiles,
    openCodeTabs,
    activeCodeFileId,
    currentProjectName,
    isExporting,
    setIsExporting,
    canvasRef,
    innerCanvasRef,
    svgRef,
    getPinPos,
    getComponentStateAttrs,
    appendConsoleEntry,
    buildSimulationJsonPayload,
    currentProjectIdRef,
  });
  // ── Classroom assignment (submit/attach/?circuit=) ─────────────────────────
  // Lives in hooks/useClassroomAssignment.js (identical gates + keys).
  // NOTE: called after usePngExport (downloadPng dep for the submit PNG
  // snapshot) — mount-only effects inside still run on first commit.
  const {
    isAssignmentSubmissionClosed,
    handleAssignmentSubmissionFilesChange,
    handleRemoveAssignmentSubmissionFile,
    handleSubmitClassAssignment,
  } = useClassroomAssignment({
    assignmentMode,
    classId,
    assignmentId,
    user,
    assessmentParams,
    setAssignmentSubmissionAssignment,
    setAssignmentSubmissionState,
    setAssignmentSubmissionForm,
    setBoard,
    setCode,
    setComponents,
    setWires,
    setCurrentProjectName,
    setCurrentProjectId,
    currentProjectIdRef,
    setHistory,
    shareId,
    assignmentSubmissionAssignment,
    assignmentSubmissionForm,
    assignmentSubmissionState,
    downloadPng,
    setAssignmentSubmissionOpen,
    navigate,
  });

  useEffect(() => {
    handleEsp32InteractionRef.current = handleEsp32Interaction;
  });

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
            onReportFrontendBug={() => setFrontendBugModalOpen(true)}
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
                setWireStart((prev) => {
                  const next = {
                    ...prev,
                    waypoints: [...(prev.waypoints || []), newPt],
                  };
                  wireStartRef.current = next;
                  return next;
                });
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
                multiRoutePath={multiRoutePath}
                subscribeMousePos={subscribeMousePos}
                getMousePosSnapshot={getMousePosSnapshot}
                mousePosRef={mousePosRef}
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
                demoEditorMode={editorModeParam}
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
                plotBoundsRef={plotBoundsRef}
                selectedPlotPins={selectedPlotPins}
                setSelectedPlotPins={setSelectedPlotPins}
                serialPlotLabelsRef={serialPlotLabelsRef}
                plotterTimeDiv={plotterTimeDiv}
                setPlotterTimeDiv={setPlotterTimeDiv}
                isPlotterVisible={isPlotterVisible}
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
                debugControls={debugControls}
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

              {/* COMPONENT INSPECTOR HUD - High Performance Telemetry.
                  Positioned from mousePosRef (not state) so hover-follow does
                  not re-render the page; hoveredElement updates drive it. */}
              {showInspector && hoveredElement && (
                <div
                  style={{
                    position: "fixed",
                    left:
                      mousePosRef.current.x * canvasZoom +
                      canvasOffset.x +
                      (canvasRef.current?.getBoundingClientRect().left || 0) +
                      20,
                    top:
                      mousePosRef.current.y * canvasZoom +
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
                  if (!comp) return;
                  const reg = COMPONENT_REGISTRY[comp?.type];
                  const manifest = reg?.manifest || {};
                  const resolved = resolveComponentDetails(comp.type, manifest);
                  const docSlug = resolved?.docSlug || manifest?.docSlug || comp.type;
                  
                  const rawDocsBase = import.meta.env.VITE_DOCS_URL || "https://openhw-studio.fossee.in/docs";
                  const cleanBase = String(rawDocsBase).trim().replace(/\/+$/, "");
                  const docUrl = manifest.helpUrl || `${cleanBase}/components/${docSlug}`;
                  window.open(docUrl, "_blank");
                }}
                updateComponentAttr={updateComponentAttr}
                onReportBug={(targetComp) => {
                  const reg = COMPONENT_REGISTRY[targetComp?.type];
                  const manifest = reg?.manifest || {};
                  setBugReportComponent({
                    type: targetComp?.type,
                    title: manifest.title || manifest.label || targetComp?.type,
                    label: manifest.title || manifest.label || targetComp?.type,
                    working: manifest.working || [],
                    inProgress: manifest.inProgress || [],
                  });
                }}
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

        {/* Global Component Bug Report Modal */}
        <ReportBugModal
          isOpen={!!bugReportComponent}
          onClose={() => setBugReportComponent(null)}
          initialComponent={bugReportComponent}
        />

        {/* Global Frontend Simulator Bug Report Modal */}
        <ReportBugModal
          isOpen={frontendBugModalOpen}
          onClose={() => setFrontendBugModalOpen(false)}
          initialComponent={null}
        />
      </div>
    );
  }
}

export default SimulatorPage;


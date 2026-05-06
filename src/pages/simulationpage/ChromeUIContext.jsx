import React, { createContext, useState, useCallback, useRef } from 'react';

/**
 * ChromeUIContext stores all non-hot UI chrome state (menus, panels, inspectors, dialogs).
 * This context is separate from the main canvas/simulation tree to prevent chrome UI
 * changes from triggering canvas-pan and component-tick rerenders.
 */
export const ChromeUIContext = createContext();

export function ChromeUIProvider({ children }) {
  // Inspector & Canvas UI
  const [showInspector, setShowInspector] = useState(false);
  const [hoveredElement, setHoveredElement] = useState(null); // { type, id, data }
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [showCanvasMenu, setShowCanvasMenu] = useState(false);
  const [isCanvasLocked, setIsCanvasLocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPinMappingExpanded, setIsPinMappingExpanded] = useState(false);
  const [pendingPinColors, setPendingPinColors] = useState({});
  const [wirepointsEnabled, setWirepointsEnabled] = useState(false);

  // Component Description & Connections Panel
  const [showComponentDesc, setShowComponentDesc] = useState(true);
  const [showConnectionsPanel, setShowConnectionsPanel] = useState(false);

  // Quick Add Menu
  const [quickAdd, setQuickAdd] = useState(null); // { screenX, screenY, canvasX, canvasY }
  const [quickAddSearch, setQuickAddSearch] = useState('');
  const [quickAddIdx, setQuickAddIdx] = useState(0);

  // Palette Panel
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isPaletteHovered, setIsPaletteHovered] = useState(false);
  const [panelWidth, setPanelWidth] = useState(580);
  const [explorerWidth, setExplorerWidth] = useState(190);
  const [isDragging, setIsDragging] = useState(false);
  const [isExplorerDragging, setIsExplorerDragging] = useState(false);
  const [isComponentDragging, setIsComponentDragging] = useState(false);
  const [paletteViewMode, setPaletteViewMode] = useState('grid'); // 'list' | 'grid'

  // Palette Filters & Search
  const [activeGroupFilter, setActiveGroupFilter] = useState('All');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showFavorites, setShowFavorites] = useState(true);
  const [paletteContextMenu, setPaletteContextMenu] = useState(null); // { x, y, item }

  // Code & Project UI
  const [showCodeExplorer, setShowCodeExplorer] = useState(true);
  const [showCreateComponentModal, setShowCreateComponentModal] = useState(false);
  const [lockToast, setLockToast] = useState(null);
  const [gamPanelOpen, setGamPanelOpen] = useState(true);
  const [gamTab, setGamTab] = useState('components');

  // Console & Telemetry
  const [activeConsoleTab, setActiveConsoleTab] = useState('console');
  const [serialPaused, setSerialPaused] = useState(false);
  const [serialViewMode, setSerialViewMode] = useState('monitor'); // 'monitor' | 'plotter'
  const [serialBoardFilter, setSerialBoardFilter] = useState('all');
  const [rp2040DebugTelemetryEnabled, setRp2040DebugTelemetryEnabled] = useState(() => {
    try {
      return localStorage.getItem('rp2040DebugTelemetryEnabled') === 'true';
    } catch (e) {
      return false;
    }
  });

  // Validation & View Panel
  const [showValidation, setShowValidation] = useState(true);
  const [validationToast, setValidationToast] = useState(null);
  const [showViewPanel, setShowViewPanel] = useState(false);
  const [viewPanelSection, setViewPanelSection] = useState(null); // null | 'schematic' | 'components'

  // Dialogs & Menus
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showF1Menu, setShowF1Menu] = useState(false);
  const [showSpeedDialog, setShowSpeedDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showProjectsDropdown, setShowProjectsDropdown] = useState(false);
  const [showProjectsSidebar, setShowProjectsSidebar] = useState(false);
  const [showFirmwareDownloadDialog, setShowFirmwareDownloadDialog] = useState(false);
  const [showFirmwareUploadDialog, setShowFirmwareUploadDialog] = useState(false);

  // Projects & Assignments
  const [projectsSidebarTab, setProjectsSidebarTab] = useState('projects');
  const [projContextMenu, setProjContextMenu] = useState(null); // { proj, x, y }
  const [renamingProjectId, setRenamingProjectId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [assignmentSubmissionOpen, setAssignmentSubmissionOpen] = useState(false);

  // Firmware & Export
  const [isExporting, setIsExporting] = useState(false);

  // Theme (chrome-level setting, not hot)
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme') || 'dark';
    } catch (e) {
      return 'dark';
    }
  });

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const newTheme = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('theme', newTheme);
      } catch (e) {
        console.error('Failed to save theme', e);
      }
      return newTheme;
    });
  }, []);

  const value = {
    // Inspector & Canvas
    showInspector, setShowInspector,
    hoveredElement, setHoveredElement,
    mousePos, setMousePos,
    showGrid, setShowGrid,
    showCanvasMenu, setShowCanvasMenu,
    isCanvasLocked, setIsCanvasLocked,
    isFullscreen, setIsFullscreen,
    isPinMappingExpanded, setIsPinMappingExpanded,
    pendingPinColors, setPendingPinColors,
    wirepointsEnabled, setWirepointsEnabled,

    // Component Description & Connections
    showComponentDesc, setShowComponentDesc,
    showConnectionsPanel, setShowConnectionsPanel,

    // Quick Add
    quickAdd, setQuickAdd,
    quickAddSearch, setQuickAddSearch,
    quickAddIdx, setQuickAddIdx,

    // Palette Panel
    isPanelOpen, setIsPanelOpen,
    isPaletteHovered, setIsPaletteHovered,
    panelWidth, setPanelWidth,
    explorerWidth, setExplorerWidth,
    isDragging, setIsDragging,
    isExplorerDragging, setIsExplorerDragging,
    isComponentDragging, setIsComponentDragging,
    paletteViewMode, setPaletteViewMode,

    // Palette Filters
    activeGroupFilter, setActiveGroupFilter,
    showFilterDropdown, setShowFilterDropdown,
    showFavorites, setShowFavorites,
    paletteContextMenu, setPaletteContextMenu,

    // Code & Project UI
    showCodeExplorer, setShowCodeExplorer,
    showCreateComponentModal, setShowCreateComponentModal,
    lockToast, setLockToast,
    gamPanelOpen, setGamPanelOpen,
    gamTab, setGamTab,

    // Console & Telemetry
    activeConsoleTab, setActiveConsoleTab,
    serialPaused, setSerialPaused,
    serialViewMode, setSerialViewMode,
    serialBoardFilter, setSerialBoardFilter,
    rp2040DebugTelemetryEnabled, setRp2040DebugTelemetryEnabled,

    // Validation & View Panel
    showValidation, setShowValidation,
    validationToast, setValidationToast,
    showViewPanel, setShowViewPanel,
    viewPanelSection, setViewPanelSection,

    // Dialogs & Menus
    showSaveDialog, setShowSaveDialog,
    showF1Menu, setShowF1Menu,
    showSpeedDialog, setShowSpeedDialog,
    showShareDialog, setShowShareDialog,
    showProjectsDropdown, setShowProjectsDropdown,
    showProjectsSidebar, setShowProjectsSidebar,
    showFirmwareDownloadDialog, setShowFirmwareDownloadDialog,
    showFirmwareUploadDialog, setShowFirmwareUploadDialog,

    // Projects & Assignments
    projectsSidebarTab, setProjectsSidebarTab,
    projContextMenu, setProjContextMenu,
    renamingProjectId, setRenamingProjectId,
    renameValue, setRenameValue,
    assignmentSubmissionOpen, setAssignmentSubmissionOpen,

    // Firmware & Export
    isExporting, setIsExporting,

    // Theme
    theme, setTheme, toggleTheme,
  };

  return (
    <ChromeUIContext.Provider value={value}>
      {children}
    </ChromeUIContext.Provider>
  );
}

/**
 * Hook to use the ChromeUI context
 */
export function useChromeUI() {
  const context = React.useContext(ChromeUIContext);
  if (!context) {
    throw new Error('useChromeUI must be used within ChromeUIProvider');
  }
  return context;
}

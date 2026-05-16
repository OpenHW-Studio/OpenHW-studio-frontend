# Change Log

## [2026-05-16] Wokwi ZIP Project Importer & Build Error Resolution (Phase 5)
- **Objective**: Implement robust fallback mechanisms to import legacy Wokwi ZIP projects, restructure Wokwi top-level files into board-specific folders, refactor `library.txt` to independent board-specific files, and resolve worker compilation errors.
- **Files Modified**:
  - `src/pages/simulationpage/projectUtils.js`: Added `wokwi-` to `openhw-` fallback normalization and `parseWokwiDiagramJson` helper.
  - `src/pages/simulationpage/wokwiImportUtils.js` [NEW]: Encapsulated Wokwi ZIP parsing, board identification, and file restructuring logic.
  - `src/pages/simulationpage/SimulatorPage.jsx`: Integrated `importWokwiProjectZip`, added `wokwiImportInputRef`, refactored `library.txt` management to board-specific files, and updated backup/restore export logic.
  - `src/pages/simulationpage/TopToolbox.jsx`: Added hidden input for Wokwi ZIP imports.
  - `src/pages/simulationpage/components/ProjectsSidebar.jsx`: Added `Import Wokwi Project` trigger in settings panel.
  - `src/components/openhw-neopixel-matrix` [RENAMED]: Renamed from `src/components/wokwi-neopixel-matrix` to complete OpenHW rebranding.
  - `src/worker/execute.ts`: Deduplicated `LOGIC_REGISTRY` and `COMPONENT_PINS` to restore clean dual-support mapping (`wokwi-` and `openhw-`) and resolve Vite/esbuild compilation errors.
- **Reasoning**: Provide a seamless migration path for legacy Wokwi users and older OpenHW Studio projects while maintaining clean board-centric project architecture and ensuring a flawless, error-free production build.

## [2026-05-12] Serial Monitor UI Refactor
- **Objective**: Modernize Serial Monitor with tabs and resizable split view.
- **Files Modified**:
  - `src/pages/simulationpage/RightPanel.jsx`: Refactored layout, added tabs, implemented split view.
- **Reasoning**: Enhance developer productivity by allowing simultaneous monitoring of multiple boards and providing a cleaner tab-based navigation.

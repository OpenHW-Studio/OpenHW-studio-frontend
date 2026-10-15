import { useCallback, useEffect } from "react";
import { normalizeBoardKind, resolveComponentAttrString } from "../utils/hardwareUtils";
import { getCachedHex, setCachedHex } from "../../../services/offlineCache.js";
import {
  compileCode,
} from "../../../services/simulatorService.js";
import { useHardwareFlashing } from "../useHardwareFlashing";
import { useWebSerialHardware } from "../webSerialHardware";

/**
 * Hardware-flash domain, extracted verbatim from SimulatorPage.jsx.
 * (board-select, resolveBoardHex w/ cache + ESP32-hardware poll,
 *  useHardwareFlashing + useWebSerialHardware wiring, serial-target
 *  mirror effect, validation-gated upload w/ Web-Serial release.)
 *
 * Behavior contract: identical cache key ('targetEngine:hardware'),
 * identical 500ms x180 poll, identical 3500ms COM release, identical
 * hw: target derivation. Hook rules preserved (sub-hooks called
 * unconditionally, same order). Verify via hardware-upload check.
 */
export function useHardwareUpload({
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
}) {
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
          compiled = await compileCode({
            code: sourceCode,
            files: compileUnit.files,
            sketchName: compileUnit.sketchName,
            fqbn,
            target: kind,
            libraries_txt: librariesTxt,
            ...(kind === 'rp2040' ? { builder: rp2040Builder } : {}),
            // Hardware flash needs the runnable image; keep elf for verify.
            artifacts: kind === 'rp2040' ? ['uf2', 'elf'] : ['hex', 'elf'],
          });
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


  return {
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
  };
}

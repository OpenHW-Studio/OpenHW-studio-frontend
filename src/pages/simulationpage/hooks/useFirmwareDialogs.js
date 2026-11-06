import { useCallback } from "react";
import { normalizeBoardKind, boardCompToDisplayName } from "../utils/hardwareUtils";

/**
 * Firmware dialog/upload domain, extracted verbatim from SimulatorPage.jsx.
 * (openFirmwareDownloadDialog, openFirmwareUploadDialog,
 *  toggleBoardFirmwareSource, applyUploadedFirmwareToBoard w/ UF2-vs-board
 *  validation + auto-enable override.)
 *
 * Dep arrays preserved verbatim. UF2 rejection for non-RP2040 boards and
 * the lastCompiledRef invalidation are behavior-critical — keep verbatim.
 * Verify via firmware upload dialog Playwright check.
 */
export function useFirmwareDialogs({
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
}) {
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


  return {
    openFirmwareDownloadDialog,
    openFirmwareUploadDialog,
    toggleBoardFirmwareSource,
    applyUploadedFirmwareToBoard,
  };
}

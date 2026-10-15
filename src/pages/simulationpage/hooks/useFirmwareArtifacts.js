import { useCallback } from "react";
import { buildProjectPayload } from "../projectUtils";
import { arrayBufferToBase64 } from "../utils/simulatorUtils";

/**
 * Firmware/download artifact domain, extracted verbatim from
 * SimulatorPage.jsx.
 * (sanitizeDownloadStem, resolveFirmwareBoardFileStem,
 *  buildSimulationJsonPayload, downloadSimulationJson,
 *  parseFirmwareUploadFile, normalizeFirmwareFileName,
 *  triggerFirmwareDownload, resolveStoredFirmwareArtifact,
 *  handleDownloadFirmware.)
 *
 * Dep arrays preserved verbatim — TopToolbox/ComponentInspector receive
 * these as props and memo on identity. normalizeFirmwareFileName is also
 * consumed by the per-board loop prologue (passed through, same ref).
 * Verify via JSON download + firmware upload/download Playwright checks.
 */
export function useFirmwareArtifacts({
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
}) {
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


  return {
    sanitizeDownloadStem,
    resolveFirmwareBoardFileStem,
    buildSimulationJsonPayload,
    downloadSimulationJson,
    parseFirmwareUploadFile,
    normalizeFirmwareFileName,
    triggerFirmwareDownload,
    resolveStoredFirmwareArtifact,
    handleDownloadFirmware,
  };
}

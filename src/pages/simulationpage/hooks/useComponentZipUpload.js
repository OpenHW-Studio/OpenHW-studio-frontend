import { useCallback } from "react";
import React from "react";
import { submitCustomComponent } from "../../../services/simulatorService.js";
import {
  enqueueComponent,
} from "../../../services/offlineCache.js";
import { getBabel, getJSZip } from "../utils/exportUtils";
import { resolveUiExport } from "../utils/simulatorUtils";
import { assertSafeDynamicModule } from "../utils/dynamicModuleGuard";
import { GROUP_MAPPING } from "../constants/simulatorConstants";
import {
  COMPONENT_REGISTRY,
  LOCAL_CATALOG,
  LOCAL_PIN_DEFS,
  sortCatalog,
} from "../utils/componentRegistry";

/**
 * Custom-component ZIP upload domain, extracted verbatim from
 * SimulatorPage.jsx (handleUploadZip).
 * (manifest/ui/logic/validation/index/doc harvest, required-file gate,
 *  admin submit w/ offline enqueue fallback, zero-touch sandbox injection
 *  with safe-module assert + catalog bump.)
 *
 * Behavior contract: identical missing-file alert, identical
 * submitted/offline alert copy, identical isDynamic injection shape,
 * identical event.target reset. Verify via component-ZIP upload
 * Playwright check.
 */
export function useComponentZipUpload({ appendConsoleEntry, setCustomCatalogCounter }) {
    const handleUploadZip = useCallback(
      async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        appendConsoleEntry("info", `ZIP upload started: ${file.name}`, "zip");
        try {
          const JSZip = await getJSZip();
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

  return { handleUploadZip };
}

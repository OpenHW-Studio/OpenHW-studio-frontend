import { useEffect } from "react";
import {
  fetchPublicInstalledComponents,
  fetchInstalledComponentsWithFiles,
} from "../../../services/simulatorService";
import {
  getCachedComponents,
  getCachedServerHash,
  setCachedComponents,
  clearComponentCache,
} from "../../../services/componentCache";
import { fetchComponentsVersion } from "../../../services/simulatorService";
import {
  COMPONENT_REGISTRY,
  BUILTIN_COMPONENT_TYPES,
  LOCAL_CATALOG,
  LOCAL_PIN_DEFS,
  injectComponentsIntoRegistry,
  sortCatalog,
} from "../utils/componentRegistry";
import { GROUP_MAPPING } from "../constants/simulatorConstants";
import { resolveUiExport } from "../utils/simulatorUtils";
import { getBabel } from "../utils/exportUtils";
import { assertSafeDynamicModule } from "../utils/dynamicModuleGuard";
import { BACKEND_INJECTED_TYPES } from "../utils/injectedTypes";

/**
 * Inject one backend-supplied component (manifest + ui/logic sources) into
 * the in-memory registry + palette catalog. Shared by all four sync paths
 * below (initial fetch, admin preview, IDB-cache refresh, 12s poller).
 *
 * Returns true when the component was newly injected. Identical semantics
 * to the four inline copies previously in SimulatorPage.jsx — including the
 * isDynamic flag, validation/index/doc extras, and deletion tracking.
 */
async function injectOneBackendComponent({ id, files, React, Babel, logPrefix }) {
  const manifestStr = files["manifest.json"];
  const uiStr = files["ui.tsx"] || files["ui.jsx"];
  const logicStr = files["logic.ts"] || files["logic.js"];
  if (!manifestStr || !uiStr || !logicStr) return false;
  const manifest = JSON.parse(manifestStr);
  const compType = manifest.type || id;
  if (BUILTIN_COMPONENT_TYPES.has(compType)) return false;
  if (COMPONENT_REGISTRY[compType]?.isDynamic) return false;
  if (COMPONENT_REGISTRY[compType]) return false;

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
  if (!uiComponent) return false;

  // Inject into catalog
  const newCatItem = { ...manifest };
  delete newCatItem.pins;
  delete newCatItem.group;

  const groupName = GROUP_MAPPING[manifest.group] || manifest.group || "Misc";
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
        Object.keys(exportsUI).find((k) => k.toLowerCase().includes("contextmenu"))
      ],
    contextMenuDuringRun: !!(
      exportsUI.contextMenuDuringRun || manifest.contextMenuDuringRun
    ),
    contextMenuOnlyDuringRun: !!(
      exportsUI.contextMenuOnlyDuringRun || manifest.contextMenuOnlyDuringRun
    ),
    logicCode: transpileLogic,
    uiRaw: uiStr,
    logicRaw: logicStr,
    validationRaw: files["validation.ts"] || files["validation.js"] || "",
    indexRaw: files["index.ts"] || files["index.js"] || "",
    ...(files["docs/index.html"] ? { doc: files["docs/index.html"] } : {}),
    isDynamic: true, // Flag to distinguish dynamically injected components
  };
  if (manifest.pins) LOCAL_PIN_DEFS[compType] = manifest.pins;

  BACKEND_INJECTED_TYPES.add(compType); // track so we can detect future deletions
  return true;
}

/**
 * Backend component sync domain, extracted from SimulatorPage.jsx.
 *
 * Owns four mount effects + the 12s poller:
 *  1. fetchPublicInstalledComponents + inject (initial mount)
 *  2. sessionStorage admin-preview injection ("Test in Simulator" + banner)
 *  3. IDB-cache-first sync with version-hash short-circuit (+60s... no —
 *     this one runs once with a demo-project head-start delay)
 *  4. installed-components poller (ADDITIONS + REMOVALS, 12s, skips hidden tabs)
 *
 * All four only touch the module-level registry/catalog (never canvas
 * state) and bump setCustomCatalogCounter/Version to re-render the palette.
 *
 * Behavior contract: identical inject/remove semantics (incl. isDynamic
 * flag, validation/index/doc extras, deletion tracking, preview banner).
 * Verify via palette population Playwright check.
 */
export function useBackendComponentSync({
  projectName,
  setCustomCatalogCounter,
  setCustomCatalogVersion,
  setPreviewBanner,
}) {
  // ── 1. Fetch and inject dynamically installed components ─────────────────
  useEffect(() => {
    (async () => {
      try {
        const installedComps = await fetchPublicInstalledComponents();
        if (!installedComps || installedComps.length === 0) return;

        const Babel = await getBabel();
        const React = await import("react").then((m) => m.default || m);
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
            const ok = await injectOneBackendComponent({
              id,
              files,
              React,
              Babel,
            });
            if (ok) injectedCount++;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Admin Preview: sessionStorage pending component ───────────────────
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
        const React = await import("react").then((m) => m.default || m);
        const ok = await injectOneBackendComponent({
          id: comp.id,
          files: { "manifest.json": JSON.stringify(manifest), "ui.tsx": uiRaw, "logic.ts": logicRaw },
          React,
          Babel,
        });
        if (!ok) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 3. IDB-cache-first sync (version-hash short-circuit) ─────────────────
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 4. Installed-components poller (ADDITIONS + REMOVALS) ────────────────
  useEffect(() => {
    const syncComponents = async () => {
      try {
        const { fetchInstalledComponentsWithFiles } = await import(
          "../../../services/simulatorService"
        );
        const installedComponents = await fetchInstalledComponentsWithFiles();

        // Build a Set of currently-installed types from the backend
        const currentInstalledTypes = new Set();
        let injectedCount = 0;
        let removedCount = 0;

        // ── ADDITIONS: inject any newly-approved components ──────────────────
        const Babel = await getBabel();
        const React = await import("react").then((m) => m.default || m);
        for (const comp of installedComponents) {
          const { id, files } = comp;
          if (!files) continue;
          try {
            const manifestStr = files["manifest.json"];
            const uiStr = files["ui.tsx"] || files["ui.jsx"];
            const logicStr = files["logic.ts"] || files["logic.js"];
            if (!manifestStr || !uiStr || !logicStr) continue;
            const manifest = JSON.parse(manifestStr);
            currentInstalledTypes.add(manifest.type || id);
            const ok = await injectOneBackendComponent({
              id,
              files,
              React,
              Babel,
            });
            if (ok) injectedCount++;
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
            delete COMPONENT_REGISTRY[type];
            delete LOCAL_PIN_DEFS[type];
            for (const group of LOCAL_CATALOG) {
              const idx = group.items.findIndex((i) => i.type === type);
              if (idx !== -1) group.items.splice(idx, 1);
            }
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

    // NOTE: original header comment says "polls every 12 s" but the timer is 60 s.
    // Preserved as-is (60 s) — behavior identical to before extraction.
    syncComponents();
    const syncInterval = setInterval(() => {
      if (!document.hidden) syncComponents();
    }, 60000);
    return () => clearInterval(syncInterval); // cleanup on unmount
  }, [setCustomCatalogCounter]);
}

import { useCallback, useEffect } from "react";
import {
  getHtml2canvas,
  ensureExportLogo,
  getSerializedShadowSheet,
} from "../utils/exportUtils";
import {
  fnv1aHash,
  computeRenderSyncHash,
  normalizeHashValue,
} from "../utils/simulatorUtils";
import { COMPONENT_REGISTRY, LOCAL_PIN_DEFS } from "../utils/componentRegistry";

/**
 * PNG export + thumbnail domain, extracted verbatim from SimulatorPage.jsx.
 *
 * Owns: downloadPng (high-res canvas PNG w/ embedded project JSON) and
 * captureThumbnail (320x180 IndexedDB thumbnail). Pure derivations of
 * props + DOM reads; no simulation side effects.
 *
 * Behavior contract: identical PNG bytes (same SCALE/PAD/bbox/embed) and
 * identical thumbnail flow. Verify via core-workflow PNG Export steps +
 * thumbnail Playwright checks.
 *
 * @param {object} args
 */
// Cache for high-fidelity PNG exports to prevent redundant rendering
// (module-level: shared across hook instances, same as before extraction).
const _exportPngResultCache = new Map();

export function usePngExport({
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
}) {
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
        (LOCAL_PIN_DEFS[c.type] || []).forEach((pin) => {
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
      const fullMetadata = buildSimulationJsonPayload();
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
    const { saveProject, loadProject } = await import('../../../services/projectStore.js');
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
      (LOCAL_PIN_DEFS[c.type] || []).forEach((pin) => {
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
  return {
    captureThumbnailRef,
    downloadPng,
    captureThumbnail,
  };
}

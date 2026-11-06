import { useCallback, useMemo } from "react";
import { getResolvedPinExitSide } from "../../../utils/pinExit.js";

/**
 * Canvas geometry domain, extracted verbatim from SimulatorPage.jsx.
 * (componentsMap .. applyZoomAtCenter, incl. window.debugPinExits helper.)
 *
 * Pure derivations over components/wires + canvas refs. Zero canvas-state
 * writes except fitToView/applyZoomAtCenter/handleZoomTextClick setters.
 *
 * Behavior contract: identical pin-resolution aliases, identical 30px
 * MIN_EXIT_STUB, identical fit "fit"/"reset"/"center" semantics.
 * Verify via wire-render + fit-to-view Playwright checks.
 *
 * @param {object} args
 */
export function useCanvasGeometry({
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
}) {
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

  return {
    componentsMap,
    getPinPosForComp,
    getPinPos,
    getComponentBounds,
    getPinExitPoint,
    getPinPosWithGhosts,
    fitToView,
    handleZoomTextClick,
    applyZoomAtCenter,
  };
}

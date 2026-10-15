import { useCallback } from "react";
import { takeNextWireId } from "../utils/powerRails";
import { wireColor } from "../wireUtils";

/**
 * Wire create/recolor/layer domain, extracted verbatim from SimulatorPage.jsx.
 * (onPinClick start/complete w/ self-loop guard + specific-color pick,
 *  updateWireColor, toggleWireLayer.)
 *
 * Stable identities preserved verbatim ([getPinPos, saveHistory] /
 * [] / [saveHistory]) so CanvasSceneLayer's memoized tree keeps the same
 * invalidation shape. Wire ids via takeNextWireId (module counter in
 * utils/powerRails — call syncWireIds after bulk imports, unchanged).
 * Verify via wire-draw + recolor + layer Playwright checks.
 */
export function useWireActions({
  getPinPos,
  saveHistory,
  wireStartRef,
  isRunningRef,
  liveEditingDisabledRef,
  setWireStart,
  setWires,
}) {
    // ── Pin click — start or complete wire ─────────────────────────────────────
    // Stable identity: reads wireStart/isRunning/liveEditingDisabled via refs
    // so CanvasSceneLayer's memoized tree isn't invalidated per render.
    const onPinClick = useCallback(
      (e, compId, pinId, pinLabel) => {
        e.stopPropagation();
        if (isRunningRef.current || liveEditingDisabledRef.current) return; // Restrict wiring while running

        const pos = getPinPos(compId, pinId);
        if (!pos) return;

        const ws = wireStartRef.current;
        if (!ws) {
          // Start wire
          wireStartRef.current = { compId, pinId, pinLabel, ...pos };
          setWireStart({ compId, pinId, pinLabel, ...pos });
        } else {
          // Complete wire — prevent self-loop
          if (ws.compId === compId && ws.pinId === pinId) {
            wireStartRef.current = null;
            setWireStart(null);
            return;
          }
          saveHistory();
          const color1 = wireColor(ws.pinLabel);
          const color2 = wireColor(pinLabel);

          // Logic: If the second pin has a more "specific" color (comms, power, etc.)
          // and the first is generic green, use the specific color.
          const isGeneric = (c) => c === "#2ecc71" || c === "#10b981";
          let finalColor = !isGeneric(color2) && isGeneric(color1) ? color2 : color1;
          if (color1 === 'black' || color2 === 'black') finalColor = 'black';

          const newWire = {
            id: takeNextWireId(),
            from: `${ws.compId}:${ws.pinId}`,
            to: `${compId}:${pinId}`,
            fromLabel: ws.pinLabel,
            toLabel: pinLabel,
            color: finalColor,
            waypoints: ws.waypoints || [],
            isBelow: false,
          };
          setWires((prev) => [...prev, newWire]);
          wireStartRef.current = null;
          setWireStart(null);
        }
      },
      [getPinPos, saveHistory],
    );

    // Stable identities: passed deep into memoized canvas children.
    const updateWireColor = useCallback((id, color) => {
      setWires((prev) => prev.map((w) => (w.id === id ? { ...w, color } : w)));
    }, []);

    const toggleWireLayer = useCallback(
      (id) => {
        saveHistory();
        setWires((prev) =>
          prev.map((w) => (w.id === id ? { ...w, isBelow: !w.isBelow } : w)),
        );
      },
      [saveHistory],
    );

  return { onPinClick, updateWireColor, toggleWireLayer };
}

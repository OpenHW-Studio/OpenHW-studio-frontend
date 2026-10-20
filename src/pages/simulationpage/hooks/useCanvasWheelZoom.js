import { useCallback } from "react";

/**
 * Canvas wheel-zoom domain, extracted verbatim from SimulatorPage.jsx.
 * (cursor-anchored zoom 0.25..3, direct-DOM transform for zero-latency,
 *  150ms debounced React-state flush; while running, refs/DOM only so the
 *  sim tree never re-renders mid-zoom.)
 *
 * Behavior contract: identical [] deps (all-ref body), identical 0.002
 * speed, identical clamp + anchor math. This is the smoothness-critical
 * path — keep the DOM-first pattern. Verify via wheel-zoom Playwright
 * check (no page re-render storm).
 */
export function useCanvasWheelZoom({
  isCanvasLockedRef,
  canvasZoomRef,
  canvasOffsetRef,
  canvasRef,
  innerCanvasRef,
  isRunning,
  rafZoomRef,
  setCanvasZoom,
  setCanvasOffset,
}) {
    const onWheel = useCallback((e) => {
      if (isCanvasLockedRef.current) return;
      e.preventDefault();

      // ─── ZOOM LOGIC (scroll wheel always zooms) ─────────────────────────────
      const zoomSpeed = 0.002;
      const delta = -e.deltaY * zoomSpeed;
      const currentZoom = canvasZoomRef.current;
      const newZoom = Math.min(3, Math.max(0.25, currentZoom * (1 + delta)));

      if (newZoom === currentZoom) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const cx = (mx - canvasOffsetRef.current.x) / currentZoom;
      const cy = (my - canvasOffsetRef.current.y) / currentZoom;

      const newOffsetX = mx - cx * newZoom;
      const newOffsetY = my - cy * newZoom;

      canvasZoomRef.current = newZoom;
      canvasOffsetRef.current = { x: newOffsetX, y: newOffsetY };

      // Apply directly to DOM for zero-latency 60fps movement
      if (innerCanvasRef.current) {
        innerCanvasRef.current.style.transform = `translate(${canvasOffsetRef.current.x}px, ${canvasOffsetRef.current.y}px) scale(${canvasZoomRef.current})`;
        innerCanvasRef.current.style.transformOrigin = "0 0";
      }

      // While running, keep the interaction in refs/DOM only so the simulator tree
      // does not rerender on every pan/zoom tick.
      if (isRunning) return;

      // Debounce the React state flush to avoid re-render lag during interaction
      if (rafZoomRef.current) clearTimeout(rafZoomRef.current);
      rafZoomRef.current = setTimeout(() => {
        rafZoomRef.current = null;
        setCanvasZoom(canvasZoomRef.current);
        setCanvasOffset({ ...canvasOffsetRef.current });
      }, 150);
    }, []);

  return { onWheel };
}

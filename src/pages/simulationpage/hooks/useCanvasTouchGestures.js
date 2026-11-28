import { useCallback, useRef } from "react";

/**
 * Canvas touch-gesture domain, extracted verbatim from SimulatorPage.jsx
 * (two-finger pinch refs + onTouchStart/onTouchMove/onTouchEnd).
 *
 * Direct-DOM + ref writes mid-gesture (zero React renders), single state
 * flush per move tick. Clamp 0.25..3 preserved verbatim.
 * Verify via mobile pinch-zoom Playwright check.
 */
export function useCanvasTouchGestures({
  isCanvasLockedRef,
  canvasZoomRef,
  canvasOffsetRef,
  canvasRef,
  setCanvasZoom,
  setCanvasOffset,
}) {
    const initialTouchDistanceRef = useRef(null);
    const initialCanvasZoomRef = useRef(null);
    const initialTouchCenterCanvasRef = useRef(null);

    const onTouchStart = useCallback((e) => {
      if (isCanvasLockedRef.current || e.touches.length !== 2) {
        initialTouchDistanceRef.current = null;
        return;
      }
      const t1 = e.touches[0],
        t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      initialTouchDistanceRef.current = dist;
      initialCanvasZoomRef.current = canvasZoomRef.current;

      const rect = canvasRef.current.getBoundingClientRect();
      const mx = (t1.clientX + t2.clientX) / 2 - rect.left;
      const my = (t1.clientY + t2.clientY) / 2 - rect.top;

      // Position on canvas relative to 0,0
      initialTouchCenterCanvasRef.current = {
        x: (mx - canvasOffsetRef.current.x) / canvasZoomRef.current,
        y: (my - canvasOffsetRef.current.y) / canvasZoomRef.current,
      };
    }, []);

    const onTouchMove = useCallback((e) => {
      if (
        isCanvasLockedRef.current ||
        e.touches.length !== 2 ||
        !initialTouchDistanceRef.current
      )
        return;
      if (e.cancelable) e.preventDefault();

      const t1 = e.touches[0],
        t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

      const scale = dist / initialTouchDistanceRef.current;
      const newZoom = Math.min(
        3,
        Math.max(0.25, initialCanvasZoomRef.current * scale),
      );

      const rect = canvasRef.current.getBoundingClientRect();
      const mx = (t1.clientX + t2.clientX) / 2 - rect.left;
      const my = (t1.clientY + t2.clientY) / 2 - rect.top;

      // We want initialTouchCenterCanvasRef.current to be at (mx, my) in screen space
      const newOffsetX = mx - initialTouchCenterCanvasRef.current.x * newZoom;
      const newOffsetY = my - initialTouchCenterCanvasRef.current.y * newZoom;

      setCanvasZoom(newZoom);
      canvasZoomRef.current = newZoom;
      setCanvasOffset({ x: newOffsetX, y: newOffsetY });
      canvasOffsetRef.current = { x: newOffsetX, y: newOffsetY };
    }, []);

    const onTouchEnd = useCallback(() => {
      initialTouchDistanceRef.current = null;
    }, []);

  return {
    initialTouchDistanceRef,
    initialCanvasZoomRef,
    initialTouchCenterCanvasRef,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}

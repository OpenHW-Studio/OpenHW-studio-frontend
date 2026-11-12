import { useCallback } from "react";
import { isBreadboardType } from "../utils/hardwareUtils";
import { getRotatedPoint } from "../projectUtils";

/**
 * Component move/rotate domain, extracted verbatim from SimulatorPage.jsx.
 * (onCompMouseDown: drag-start snapshot w/ breadboard-children precalc;
 *  rotateComponent: +90 with breadboard-children orbit, ref-mirror guards.)
 *
 * Stable identities preserved verbatim ([components, wires, isRunning] /
 * [saveHistory]) — both flow deep into memoized CanvasComponents.
 * Verify via component-drag + breadboard-drag + rotate Playwright checks.
 */
export function useComponentMove({
  components,
  wires,
  isRunning,
  movingComp,
  setIsComponentDragging,
  isRunningRef,
  liveEditingDisabledRef,
  saveHistory,
  setComponents,
  wiresRef,
}) {
    const onCompMouseDown = useCallback(
      (e, id) => {
        e.stopPropagation();
        if (isRunning) return; // Restrict movement while running
        const comp = components.find((c) => c.id === id);
        if (!comp) return;

        const dragData = {
          id,
          sx: e.clientX,
          sy: e.clientY,
          cx: comp.x,
          cy: comp.y,
          type: comp.type,
          w: comp.w,
          h: comp.h,
          rotation: comp.rotation || 0,
          anchorPinId: comp.anchorPinId,
          moved: false,
          originalComps: JSON.parse(JSON.stringify(components)),
        };

        dragData.breadboards = components.filter((c) => isBreadboardType(c.type));

        // Performance: If breadboard, pre-calculate children once here
        if (isBreadboardType(comp.type)) {
          const childComps = components.filter((c) => {
            if (c.id === id) return false;
            return wires.some(
              (w) =>
                w.isSocket &&
                (w.from.startsWith(c.id + ":") || w.to.startsWith(c.id + ":")) &&
                (w.from.startsWith(id + ":") || w.to.startsWith(id + ":")),
            );
          });

          if (childComps.length > 0) {
            dragData.childIds = childComps.map((c) => c.id);
            dragData.childrenStart = {};
            childComps.forEach((c) => {
              dragData.childrenStart[c.id] = { x: c.x, y: c.y };
            });
          }
        }

        movingComp.current = dragData;
        setIsComponentDragging(true);
      },
      [components, wires, isRunning],
    );
    const rotateComponent = useCallback(
      (id) => {
        if (isRunningRef.current || liveEditingDisabledRef.current) return;
        saveHistory();

      setComponents((prev) => {
        const comp = prev.find((c) => c.id === id);
        if (!comp) return prev;

        const newRotation = ((comp.rotation || 0) + 90) % 360;

        // If breadboard, rotate children
        if (isBreadboardType(comp.type)) {
          const childIds = new Set(
            wiresRef.current
              .filter(
                (w) =>
                  w.isSocket &&
                  (w.from.startsWith(id + ":") || w.to.startsWith(id + ":")),
              )
              .map((w) => {
                const fromId = w.from.split(":")[0];
                const toId = w.to.split(":")[0];
                return fromId === id ? toId : fromId;
              }),
          );

          const bbCenterX = comp.x + comp.w / 2;
          const bbCenterY = comp.y + comp.h / 2;

          return prev.map((c) => {
            if (c.id === id) return { ...c, rotation: newRotation };
            if (childIds.has(c.id)) {
              // Rotate child center around breadboard center
              const childCenterX = c.x + c.w / 2;
              const childCenterY = c.y + c.h / 2;
              const rotated = getRotatedPoint(
                childCenterX,
                childCenterY,
                90,
                bbCenterX,
                bbCenterY,
              );

              return {
                ...c,
                x: rotated.x - c.w / 2,
                y: rotated.y - c.h / 2,
                rotation: ((c.rotation || 0) + 90) % 360,
              };
            }
            return c;
          });
        }

        return prev.map((c) =>
          c.id === id ? { ...c, rotation: newRotation } : c,
        );
      });
      },
      [saveHistory],
    );

  return { onCompMouseDown, rotateComponent };
}

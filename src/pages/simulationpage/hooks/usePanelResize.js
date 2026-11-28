import { useCallback, useEffect } from "react";

/**
 * Panel-resize drag interactions, extracted verbatim from SimulatorPage.jsx.
 *
 * Owns: onMouseDownResize (right panel width), onMouseDownConsoleResize
 * (console height), onMouseDownExplorerResize (code-explorer width) plus the
 * explorer drag-follow effect. All three use direct-DOM CSS-var writes
 * mid-drag and commit to React state once on mouseup — zero re-renders
 * while dragging (same pattern as canvas pan).
 *
 * Behavior contract: identical min/max clamps (panel 250–1100/70vw,
 * console 140–540, explorer 120–200/panel-100) and identical CSS-var
 * names (--panel-width, --console-height, --explorer-width).
 * Verify via panel/console/explorer drag Playwright checks.
 */
export function usePanelResize({
  panelWidth,
  setPanelWidth,
  setIsDragging,
  consoleHeight,
  setConsoleHeight,
  explorerWidth,
  setExplorerWidth,
  setIsExplorerDragging,
  isExplorerDragging,
  rightPanelRef,
}) {
  const onMouseDownResize = useCallback(
    (e) => {
      e.preventDefault();
      const startWidth = panelWidth;
      if (rightPanelRef.current?.aside) {
        rightPanelRef.current.aside.style.setProperty(
          "--panel-width",
          `${startWidth}px`,
        );
      }
      setIsDragging(true);
      const startX = e.clientX;
      let finalWidth = startWidth;

      const onMouseMove = (moveEvent) => {
        const start = performance.now();
        const delta = startX - moveEvent.clientX; // Left drag increases width
        const maxWidth = Math.min(1100, window.innerWidth * 0.7);
        finalWidth = Math.max(250, Math.min(maxWidth, startWidth + delta));
        if (rightPanelRef.current?.aside) {
          rightPanelRef.current.aside.style.setProperty(
            "--panel-width",
            `${finalWidth}px`,
          );
        }
        const duration = performance.now() - start;
        if (duration > 5) {
          console.warn(
            `[Performance] onMouseDownResize.onMouseMove took ${duration.toFixed(2)}ms`,
          );
        }
      };

      const onMouseUp = () => {
        setIsDragging(false);
        setPanelWidth(finalWidth);
        if (rightPanelRef.current?.aside) {
          rightPanelRef.current.aside.style.removeProperty("--panel-width");
        }
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [panelWidth, rightPanelRef, setIsDragging, setPanelWidth],
  );

  const onMouseDownConsoleResize = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startY = e.clientY;
      const startHeight = consoleHeight;
      const consoleEl = document.querySelector(
        '[data-simulation-console="true"]',
      );
      if (consoleEl) {
        consoleEl.style.setProperty("--console-height", `${startHeight}px`);
      }
      let finalHeight = startHeight;

      const onMouseMove = (moveEvent) => {
        const delta = startY - moveEvent.clientY;
        const newHeight = Math.max(140, Math.min(540, startHeight + delta));
        finalHeight = newHeight;
        if (consoleEl) {
          consoleEl.style.setProperty("--console-height", `${finalHeight}px`);
        }
      };

      const onMouseUp = () => {
        setConsoleHeight(finalHeight);
        if (consoleEl) {
          consoleEl.style.removeProperty("--console-height");
        }
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [consoleHeight, setConsoleHeight],
  );

  const onMouseDownExplorerResize = useCallback(
    (e) => {
      e.preventDefault();
      if (rightPanelRef.current?.explorer) {
        rightPanelRef.current.explorer.style.setProperty(
          "--explorer-width",
          `${explorerWidth}px`,
        );
      }
      setIsExplorerDragging(true);
    },
    [explorerWidth, rightPanelRef, setIsExplorerDragging],
  );

  useEffect(() => {
    if (!isExplorerDragging) return;
    let finalExpWidth = explorerWidth;
    const onMouseMove = (e) => {
      const start = performance.now();
      const rightPanelStart = window.innerWidth - panelWidth;
      finalExpWidth = Math.max(
        120,
        Math.min(200, panelWidth - 100, e.clientX - rightPanelStart),
      );
      if (rightPanelRef.current?.explorer) {
        rightPanelRef.current.explorer.style.setProperty(
          "--explorer-width",
          `${finalExpWidth}px`,
        );
      }
      const duration = performance.now() - start;
      if (duration > 5) {
        console.warn(
          `[Performance] onMouseDownExplorerResize.onMouseMove took ${duration.toFixed(2)}ms`,
        );
      }
    };
    const onMouseUp = () => {
      setIsExplorerDragging(false);
      setExplorerWidth(finalExpWidth);
      if (rightPanelRef.current?.explorer) {
        rightPanelRef.current.explorer.style.removeProperty("--explorer-width");
      }
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [
    isExplorerDragging,
    panelWidth,
    explorerWidth,
    rightPanelRef,
    setExplorerWidth,
    setIsExplorerDragging,
  ]);

  return {
    onMouseDownResize,
    onMouseDownConsoleResize,
    onMouseDownExplorerResize,
  };
}

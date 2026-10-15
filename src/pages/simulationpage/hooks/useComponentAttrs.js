import { useCallback } from "react";
import { normalizeBoardKind, normalizeRp2040Env } from "../utils/hardwareUtils";

/**
 * Component attribute/rename domain, extracted verbatim from
 * SimulatorPage.jsx.
 * (updateComponentAttr w/ neopixel resize + rp2040 env normalize,
 *  onCompContextMenu, handleRenameComponentId w/ wire re-pointing.)
 *
 * Stable identities preserved verbatim ([saveHistory] / [] /
 * [components, saveHistory, selected]) — CanvasComponent's comparator
 * reaches updateComponentAttr through the getComponentStateAttrs closure
 * chain, so dep arrays must not churn. Verify via inspector-edit +
 * rename-id Playwright checks.
 */
export function useComponentAttrs({
  liveEditingDisabledRef,
  saveHistory,
  setComponents,
  components,
  selected,
  setSelected,
  setCompContextMenu,
  setRenameState,
  setValueState,
}) {
    const updateComponentAttr = useCallback(
      (id, key, value) => {
        if (liveEditingDisabledRef.current) return;
        saveHistory();
      setComponents((prev) =>
        prev.map((c) => {
          if (c.id === id) {
            let newW = c.w;
            let newH = c.h;
            const nextValue =
              key === "env" && normalizeBoardKind(c.type) === "rp2040"
                ? normalizeRp2040Env(value)
                : value;
            if (
              c.type === "wokwi-neopixel-matrix" ||
              c.type === "openhw-neopixel-matrix"
            ) {
              const rows =
                key === "rows"
                  ? parseInt(nextValue) || 1
                  : parseInt(c.attrs?.rows) || 1;
              const cols =
                key === "cols"
                  ? parseInt(nextValue) || 1
                  : parseInt(c.attrs?.cols) || 1;
              newW = Math.max(30, cols * 30);
              newH = Math.max(30, rows * 30);
            }
            return {
              ...c,
              w: newW,
              h: newH,
              attrs: { ...c.attrs, [key]: nextValue },
            };
          }
          return c;
        }),
      );
      },
      [saveHistory],
    );

    const onCompContextMenu = useCallback((e, compId) => {
      e.preventDefault();
      e.stopPropagation();
      setCompContextMenu({ x: e.clientX, y: e.clientY, compId });
      setRenameState({ id: null, x: 0, y: 0 }); // Close rename panel if open
      setValueState({ id: null, x: 0, y: 0, key: "value" }); // Close value panel if open
    }, []);

    const handleRenameComponentId = useCallback(
      (oldId, newId) => {
        if (!newId || oldId === newId) {
          setRenameState({ id: null, x: 0, y: 0 });
          return;
        }

        // Check for ID conflicts
        if (components.some((c) => c.id === newId)) {
          console.warn(`[Rename] ID conflict: ${newId} already exists.`);
          setRenameState({ id: null, x: 0, y: 0 });
          return;
        }

        saveHistory();

        // Update component ID
        setComponents((prev) =>
          prev.map((c) => (c.id === oldId ? { ...c, id: newId } : c)),
        );

        // Update all wires referencing this component
        setWires((prev) =>
          prev.map((w) => {
            let from = w.from;
            let to = w.to;
            const [fromComp, ...fromPin] = from.split(":");
            const [toComp, ...toPin] = to.split(":");

            if (fromComp === oldId) {
              from = `${newId}:${fromPin.join(":")}`;
            }
            if (toComp === oldId) {
              to = `${newId}:${toPin.join(":")}`;
            }

            return { ...w, from, to };
          }),
        );

        if (selected === oldId) setSelected(newId);
        setRenameState({ id: null, x: 0, y: 0 });
      },
      [components, saveHistory, selected],
    );


  return { updateComponentAttr, onCompContextMenu, handleRenameComponentId };
}

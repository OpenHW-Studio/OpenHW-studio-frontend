import { useCallback } from "react";
import { getRotatedPoint, calculateProjectPlanApplication, mergeCodeSnippet } from "../projectUtils";
import { snapToGrid } from "../utils/snappingUtils";
import { autoConnectPowerRails } from "../utils/powerRails";
import { getComponentWarning } from "../utils/componentVisibilityConfig";
import { allocateComponentId } from "../utils/simulatorUtils";
import {
  isProgrammableBoardType,
  isBreadboardType,
  isResistorType,
} from "../utils/hardwareUtils";
import { COMPONENT_REGISTRY, LOCAL_PIN_DEFS } from "../utils/componentRegistry";

/**
 * Component-placement domain, extracted verbatim from SimulatorPage.jsx.
 * (addComponentInternal + onPaletteItemClick/undo/redo/onCanvasDrop/
 *  addComponentAt/addComponentAtCenter.)
 *
 * Behavior contract: identical id allocation, anchor-snap, WASM autonomous
 * plan + JS fallback wiring, library.txt fallback, code-snippet merge,
 * center/overlap-nudge placement. addComponentInternal keeps the SAME
 * useCallback dep array so downstream memo identities don't churn.
 * Verify via palette-add + drag-drop + undo/redo Playwright checks.
 */
export function useComponentPlacement({
  liveEditingDisabled,
  saveHistory,
  components,
  wires,
  code,
  autoWiringEnabled,
  autoCodingEnabled,
  generateAutonomousSetup,
  PIN_DEFS,
  autoBreadboardEnabled,
  appendConsoleEntry,
  setIsConsoleOpen,
  libInstalled,
  handleInstallLibrary,
  setProjectFiles,
  currentCodeRef,
  activeCodeFileId,
  setCode,
  setCodeTab,
  setIsPanelOpen,
  canvasRef,
  canvasOffsetRef,
  canvasZoomRef,
  dragPayload,
  isRunningRef,
  componentsRef,
  wiresRef,
  setHistory,
  setComponents,
  setWires,
  setSelected,
}) {
  // ── Component addition with autonomous WASM setup ───────────────────────────
  const addComponentInternal = useCallback(
    async (item, x, y) => {
      if (liveEditingDisabled) return;
      saveHistory();

      const warningMsg = getComponentWarning(item.type);
      if (warningMsg) {
        console.warn(`[Component Warning] ${item.label || item.type}: ${warningMsg}`);
      }

      const usedIds = new Set(components.map((c) => String(c.id || "")));
      const id = allocateComponentId(item.type, usedIds);
      const pins = LOCAL_PIN_DEFS[item.type] || [];
      const anchorPin = pins[0];
      let initialX = Math.max(8, x);
      let initialY = Math.max(8, y);
      if (anchorPin) {
        const w = item.w || 60;
        const h = item.h || 60;
        const cx = initialX + w / 2;
        const cy = initialY + h / 2;
        const anchorWorld = getRotatedPoint(
          initialX + anchorPin.x,
          initialY + anchorPin.y,
          0,
          cx,
          cy,
        );
        const snappedAnchorX = snapToGrid(anchorWorld.x);
        const snappedAnchorY = snapToGrid(anchorWorld.y);
        initialX += snappedAnchorX - anchorWorld.x;
        initialY += snappedAnchorY - anchorWorld.y;
      } else {
        initialX = snapToGrid(initialX);
        initialY = snapToGrid(initialY);
      }

      const newCompBase = {
        id,
        type: item.type,
        label: item.label,
        x: initialX,
        y: initialY,
        w: item.w || 60,
        h: item.h || 60,
        attrs: item.attrs || {},
      };

      const catalogItem = COMPONENT_REGISTRY[item.type];
      const manifest = catalogItem?.manifest || catalogItem;

      if (
        catalogItem &&
        !isProgrammableBoardType(item.type) &&
        !isBreadboardType(item.type) &&
        !isResistorType(item.type)
      ) {
        if (autoWiringEnabled || autoCodingEnabled) {
          const plan = await generateAutonomousSetup(
            components,
            wires,
            newCompBase,
            manifest,
            null, // Let WASM select the nearest board
            PIN_DEFS,
            autoBreadboardEnabled,
          );

          if (plan) {
            // ── IMMEDIATE ERROR DETECTION ──
            if (plan.reasoning) {
              console.log("[Autowiring Debug] Reasoning:", plan.reasoning);
              const critical = plan.reasoning.find((r) =>
                r.toUpperCase().includes("CRITICAL"),
              );
              if (critical) {
                console.error("[Autowiring Critical]", critical);
                appendConsoleEntry(
                  "error",
                  `[Autowiring] ${critical}`,
                  "simulator",
                );
                setTimeout(() => {
                  setIsConsoleOpen(true);
                  alert(`Autowiring Critical Error:\n\n${critical}`);
                }, 100);
              }
            }

            const mainCompWithPos = {
              ...newCompBase,
              x: plan.main_component.x,
              y: plan.main_component.y,
            };
            const adjustedPlan = {
              ...plan,
              added_components: [
                mainCompWithPos,
                ...(plan.added_components || []),
              ],
            };

            const result = calculateProjectPlanApplication(
              adjustedPlan,
              components,
              wires,
              PIN_DEFS,
            );
            setComponents(result.components);
            setWires(result.wires);

            // ── JS Fallback: manually wire if WASM left component unwired ──
            const autowiringConns = manifest?.autowiring?.connections;
            if (autowiringConns && autowiringConns.length > 0) {
              const compId = mainCompWithPos.id;
              const hasAnyWire = result.wires.some(
                w => (w.from || '').startsWith(compId + ':') || (w.to || '').startsWith(compId + ':')
              );
              if (!hasAnyWire) {
                const boardComp = result.components.find(c => isProgrammableBoardType(c.type));
                if (boardComp) {
                  const newComponents = [...result.components];
                  const newWires = [...result.wires];
                  const bb = result.components.find(c => isBreadboardType(c.type));
                  const boardPins = LOCAL_PIN_DEFS[boardComp.type] || [];

                  for (let ci = 0; ci < autowiringConns.length; ci++) {
                    const conn = autowiringConns[ci];
                    let target = conn.to || '';
                    let fromPin = conn.from;

                    if (target.startsWith('arduino:')) {
                      const pinId = target.split(':')[1];
                      const match = boardPins.find(p => p.id.toLowerCase().startsWith(pinId.toLowerCase()));
                      if (match) target = `${boardComp.id}:${match.id}`;
                      else target = `${boardComp.id}:${pinId}`;
                    }

                    const fromEndpoint = `${compId}:${fromPin}`;

                    if (conn.via) {
                      const viaId = `${conn.via}_${Date.now()}_${ci}`;
                      const viaType = conn.via;
                      const viaComp = {
                        id: viaId,
                        type: viaType,
                        label: 'Resistor',
                        x: mainCompWithPos.x + 60 + ci * 30,
                        y: mainCompWithPos.y + 20 + ci * 20,
                        w: 60,
                        h: 12,
                        attrs: conn.attrs || {},
                      };

                      if (bb) {
                        const bbPins = LOCAL_PIN_DEFS[bb.type] || [];
                        const viaHole = bbPins.find(p => p.id.endsWith('f'));
                        if (viaHole) {
                          const vWorld = getRotatedPoint(
                            bb.x + viaHole.x, bb.y + viaHole.y,
                            bb.rotation || 0, bb.x + bb.w / 2, bb.y + bb.h / 2
                          );
                          viaComp.x = vWorld.x - 30;
                          viaComp.y = vWorld.y - 6;
                        }
                      }

                      newComponents.push(viaComp);

                      const needsResistorToGnd = target.toLowerCase().includes('gnd');
                      const midX = viaComp.x + viaComp.w / 2;
                      const midY = viaComp.y + viaComp.h / 2;

                      if (bb) {
                        const sourceHole = `${bb.id}:${ci === 0 ? 'top_f' : 'top_e'}`;
                        newWires.push({
                          id: `w_via_in_${Date.now()}_${ci}`,
                          from: sourceHole,
                          to: `${viaId}:p1`,
                          color: 'green',
                          isSocket: true,
                        });
                        newWires.push({
                          id: `w_via_out_${Date.now()}_${ci}`,
                          from: `${viaId}:p2`,
                          to: target,
                          color: needsResistorToGnd ? 'black' : 'blue',
                        });
                      } else {
                        newWires.push({
                          id: `w_manual_${Date.now()}_${ci}_a`,
                          from: fromEndpoint,
                          to: `${viaId}:p1`,
                          color: 'green',
                          waypoints: [{ x: midX, y: mainCompWithPos.y + 20 }],
                        });
                        newWires.push({
                          id: `w_manual_${Date.now()}_${ci}_b`,
                          from: `${viaId}:p2`,
                          to: target,
                          color: needsResistorToGnd ? 'black' : 'blue',
                        });
                      }
                    } else {
                      newWires.push({
                        id: `w_manual_${Date.now()}_${ci}`,
                        from: fromEndpoint,
                        to: target,
                        color: target.toLowerCase().includes('gnd') ? 'black' : 'green',
                      });
                    }
                  }

                  setComponents(newComponents);
                  setWires(newWires);
                }
              }
            }

            // ── Restore Library Installation ──
            if (plan.libraries && plan.libraries.length > 0) {
              for (const libName of plan.libraries) {
                const alreadyInstalled = libInstalled?.some(
                  (l) => (l?.library?.name || l?.name) === libName,
                );
                if (!alreadyInstalled) {
                  console.log(
                    `[Autonomous] Auto-installing library: ${libName}`,
                  );
                  try {
                    await handleInstallLibrary(libName);
                  } catch (err) {
                    console.warn(
                      `[Autonomous] API install failed for ${libName}, falling back to library.txt:`,
                      err,
                    );
                  }
                }
              }
              // Fallback: write libraries to library.txt for runtime resolution
              const boardComp = result.components.find((c) =>
                isProgrammableBoardType(c.type),
              );
              if (boardComp) {
                const libPath = `project/${boardComp.id}/library.txt`;
                setProjectFiles((prev) => {
                  const fileObj = prev.find((f) => f.id === libPath);
                  let currentContent = fileObj
                    ? fileObj.content || ''
                    : '# Add your libraries here (one per line, e.g. ArduinoJson@6.21.3)\n';
                  const lines = currentContent.split('\n').map((l) => l.trim());
                  const existingSet = new Set(
                    lines
                      .filter((l) => l && !l.startsWith('#'))
                      .map((l) => l.split('@')[0].trim().toLowerCase()),
                  );
                  const linesToAdd = [];
                  plan.libraries.forEach((lib) => {
                    const cleanLib = String(lib).trim();
                    const libNameOnly = cleanLib
                      .split('@')[0]
                      .trim()
                      .toLowerCase();
                    if (!existingSet.has(libNameOnly)) {
                      linesToAdd.push(cleanLib);
                    }
                  });
                  if (linesToAdd.length > 0) {
                    const newLines = [...currentContent.split('\n')];
                    linesToAdd.forEach((lib) => {
                      if (
                        newLines.length > 0 &&
                        newLines[newLines.length - 1].trim() !== ''
                      ) {
                        newLines.push(lib);
                      } else {
                        newLines.splice(newLines.length, 0, lib);
                      }
                    });
                    const nextContent = newLines.join('\n');
                    return prev.map((f) =>
                      f.id === libPath
                        ? { ...f, content: nextContent, dirty: true }
                        : f,
                    );
                  }
                  return prev;
                });
              }
            }

            // ── Restore Code Merging ──
            if (plan.code_snippet) {
              const snippetOwnerId = mainCompWithPos.id;
              const nextCode = mergeCodeSnippet(
                currentCodeRef.current || code,
                plan.code_snippet,
                snippetOwnerId,
                plan.reasoning || [],
              );
              setCode(nextCode);
              if (activeCodeFileId) {
                setProjectFiles((prev) =>
                  prev.map((f) =>
                    f.id === activeCodeFileId
                      ? { ...f, content: nextCode, dirty: true }
                      : f,
                  ),
                );
              }
              setCodeTab("code");
              setIsPanelOpen(true);
            }

            // ── Restore Reasoning Logs ──
            if (plan.reasoning) {
              console.log("[Autonomous] Reasoning:", plan.reasoning);
            }
          } else {
            // WASM returned no plan — fallback: place component and wire manually
            const boardComp = components.find(c => isProgrammableBoardType(c.type));
            let fallbackComps = [newCompBase];
            let fallbackWires = [...wires];

            const autowiringConns = manifest?.autowiring?.connections;
            if (autowiringConns && autowiringConns.length > 0 && boardComp) {
              const boardPins = LOCAL_PIN_DEFS[boardComp.type] || [];
              const bb = components.find(c => isBreadboardType(c.type));
              for (let ci = 0; ci < autowiringConns.length; ci++) {
                const conn = autowiringConns[ci];
                let target = conn.to || '';
                if (target.startsWith('arduino:')) {
                  const pinId = target.split(':')[1];
                  const match = boardPins.find(p => p.id.toLowerCase().startsWith(pinId.toLowerCase()));
                  target = match ? `${boardComp.id}:${match.id}` : `${boardComp.id}:${pinId}`;
                }
                if (conn.via) {
                  const viaId = `${conn.via}_${Date.now()}_${ci}`;
                  const viaComp = {
                    id: viaId, type: conn.via, label: 'Resistor',
                    x: newCompBase.x + 60 + ci * 30, y: newCompBase.y + 20 + ci * 20,
                    w: 60, h: 12, attrs: conn.attrs || {},
                  };
                  if (bb) {
                    const bbPins = LOCAL_PIN_DEFS[bb.type] || [];
                    const viaHole = bbPins.find(p => p.id.endsWith('f'));
                    if (viaHole) {
                      const vWorld = getRotatedPoint(bb.x + viaHole.x, bb.y + viaHole.y, bb.rotation || 0, bb.x + bb.w / 2, bb.y + bb.h / 2);
                      viaComp.x = vWorld.x - 30; viaComp.y = vWorld.y - 6;
                    }
                  }
                  fallbackComps.push(viaComp);
                  fallbackWires.push({ id: `w_via_in_${Date.now()}_${ci}`, from: `${newCompBase.id}:${conn.from}`, to: `${viaId}:p1`, color: 'green' });
                  fallbackWires.push({ id: `w_via_out_${Date.now()}_${ci}`, from: `${viaId}:p2`, to: target, color: target.toLowerCase().includes('gnd') ? 'black' : 'blue' });
                } else {
                  fallbackWires.push({ id: `w_manual_${Date.now()}_${ci}`, from: `${newCompBase.id}:${conn.from}`, to: target, color: target.toLowerCase().includes('gnd') ? 'black' : 'green' });
                }
              }
            } else {
              fallbackWires = autoConnectPowerRails(newCompBase, components, wires);
            }

            setComponents(prev => {
              const merged = [...prev];
              for (const fc of fallbackComps) {
                if (!merged.find(c => c.id === fc.id)) merged.push(fc);
              }
              return merged;
            });
            setWires(fallbackWires);
          }
        } else {
          setComponents((prev) => [...prev, newCompBase]);
          setWires((prev) => autoConnectPowerRails(newCompBase, components, prev));
        }
      } else {
        setComponents((prev) => [...prev, newCompBase]);
        setWires((prev) => autoConnectPowerRails(newCompBase, components, prev));
      }
    },
    [
      liveEditingDisabled,
      saveHistory,
      components,
      wires,
      code,
      autoWiringEnabled,
      autoCodingEnabled,
      generateAutonomousSetup,
    ],
  );

  const onPaletteItemClick = useCallback(
    async (item) => {
      if (liveEditingDisabled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x =
        (rect.width / 2 - canvasOffsetRef.current.x) / canvasZoomRef.current -
        (item.w || 60) / 2;
      const y =
        (rect.height / 2 - canvasOffsetRef.current.y) / canvasZoomRef.current -
        (item.h || 60) / 2;
      await addComponentInternal(item, x, y);
    },
    [liveEditingDisabled, addComponentInternal],
  );

  // Stable identities: history/running read via functional setState + refs,
  // so the memoized TopToolbox (which receives undo/redo as props) is not
  // invalidated on unrelated renders.
  const undo = useCallback(() => {
    if (isRunningRef.current) return;
    setHistory((h) => {
      if (h.past.length === 0) return h;
      const prev = h.past[h.past.length - 1];
      setComponents(prev.components);
      setWires(prev.wires);
      setSelected(null);
      return {
        past: h.past.slice(0, -1),
        future: [
          {
            components: structuredClone(componentsRef.current),
            wires: structuredClone(wiresRef.current),
          },
          ...h.future,
        ],
      };
    });
  }, []);

  const redo = useCallback(() => {
    if (isRunningRef.current) return;
    setHistory((h) => {
      if (h.future.length === 0) return h;
      const next = h.future[0];
      setComponents(next.components);
      setWires(next.wires);
      setSelected(null);
      return {
        past: [
          ...h.past,
          {
            components: structuredClone(componentsRef.current),
            wires: structuredClone(wiresRef.current),
          },
        ],
        future: h.future.slice(1),
      };
    });
  }, []);

  // ── Canvas drop ────────────────────────────────────────────────────────────
  const onCanvasDrop = useCallback(
    async (e) => {
      if (liveEditingDisabled) return;
      e.preventDefault();
      const item = dragPayload.current;
      if (!item) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x =
        (e.clientX - rect.left - canvasOffsetRef.current.x) /
        canvasZoomRef.current -
        (item.w || 60) / 2;
      const y =
        (e.clientY - rect.top - canvasOffsetRef.current.y) /
        canvasZoomRef.current -
        (item.h || 60) / 2;
      await addComponentInternal(item, x, y);
      dragPayload.current = null;
    },
    [liveEditingDisabled, addComponentInternal],
  );

  // ── Quick-add: place component at explicit canvas coordinates ──────────────
  const addComponentAt = useCallback(
    async (item, canvasX, canvasY) => {
      if (liveEditingDisabled) return;
      const x = canvasX - (item.w || 60) / 2;
      const y = canvasY - (item.h || 60) / 2;
      await addComponentInternal(item, x, y);
    },
    [liveEditingDisabled, addComponentInternal],
  );

  // ── Palette click to add (adds to canvas center, offset if overlapping) ──────
  const addComponentAtCenter = useCallback(
    async (item) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      let cx =
        (rect.width / 2 - canvasOffsetRef.current.x) / canvasZoomRef.current;
      let cy =
        (rect.height / 2 - canvasOffsetRef.current.y) / canvasZoomRef.current;

      // Nudge position so new components don't stack exactly on top of existing ones
      const OFFSET_STEP = 30; // px diagonal offset per overlap
      const OVERLAP_THRESHOLD = 20; // px — consider "same spot" if within this range
      const currentComps = componentsRef.current || [];
      let attempts = 0;
      while (attempts < 15) {
        const overlapping = currentComps.some(c => {
          const compCx = c.x + (c.w || 60) / 2;
          const compCy = c.y + (c.h || 60) / 2;
          return Math.abs(compCx - cx) < OVERLAP_THRESHOLD && Math.abs(compCy - cy) < OVERLAP_THRESHOLD;
        });
        if (!overlapping) break;
        cx += OFFSET_STEP;
        cy += OFFSET_STEP;
        attempts++;
      }

      await addComponentAt(item, cx, cy);
    },
    [addComponentAt],
  );


  return {
    addComponentInternal,
    onPaletteItemClick,
    undo,
    redo,
    onCanvasDrop,
    addComponentAt,
    addComponentAtCenter,
  };
}

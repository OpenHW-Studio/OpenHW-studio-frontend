import { useCallback, useEffect } from "react";
import { getRotatedPoint, findNearestBreadboardHole, robustSnapComponent } from "../projectUtils";
import { snapToGrid } from "../utils/snappingUtils";
import { simplifyOrthogonalPath } from "../utils/wireHitDetection";
import { isBreadboardType } from "../utils/hardwareUtils";
import { LOCAL_PIN_DEFS } from "../utils/componentRegistry";
import { distToSegment } from "../utils/wireHitDetection";

/**
 * Canvas drag-interaction domain, extracted verbatim from SimulatorPage.jsx.
 * (onCompClick pocket + RAF-throttled window mousemove/mouseup effect:
 *  component drag w/ breadboard propagation + hole snapping, wire
 *  segment/waypoint drag, zero-render canvas pan, wire-pull cursor,
 *  inspector hover, drop-commit w/ grid snap + socket rewire.)
 *
 * NOTE: intentionally [] deps — the loop reads wireStart/wires/components
 * via refs only, so drag/pan/hover never re-subscribes window listeners.
 * Keep it that way: pass values that change per render via refs.
 * Verify via component-drag + wire-drag + pan Playwright checks.
 */
export function useCanvasDragInteractions({
  setSelected,
  setWireClickPos,
  isDraggingRef,
  isExplorerDraggingRef,
  movingComp,
  canvasZoomRef,
  canvasOffsetRef,
  canvasRef,
  innerCanvasRef,
  segDragRef,
  isPanningRef,
  panStartRef,
  didPanRef,
  isCanvasLockedRef,
  wireStartRef,
  showInspector,
  liveOopStatesRef,
  getPinPosRef,
  wiresRef,
  componentsRef,
  mousePosRef,
  mousePosTickRef,
  mousePosListenersRef,
  rafMoveRef,
  pendingMoveRef,
  setHoveredElement,
  setCanvasOffset,
  setComponents,
  setWires,
  setHistory,
  setIsComponentDragging,
  setSnappingHoles,
  setSegDrag,
}) {
  const onCompClick = useCallback((e, id) => {
    e.stopPropagation();
    setSelected(id);
    setWireClickPos(null);
  }, []);

  useEffect(() => {
    // ───── RAF-throttled mousemove (Fixes #1 #2 #3 #4) ──────────────────────────
    // Instead of calling React state setters on every raw mousemove (which can
    // fire at 200Hz), we synchronously extract all needed data from the event,
    // store it in a ref, then schedule one rAF callback to do all state updates.
    // This caps React renders at 60fps regardless of mouse polling rate.
    const onMove = (e) => {
      // If we are resizing panels, BAIL OUT of all canvas mouse tracking to save CPU and prevent re-renders
      if (isDraggingRef.current || isExplorerDraggingRef.current) return;

      // ── Synchronously read event data ───
      let compUpdate = null;
      let wireUpdate = null;
      let panUpdate = null;
      let mousePosUpdate = null;
      const sd = segDragRef.current;

      if (movingComp.current) {
        movingComp.current.moved = true;
        const { id, type, sx, sy, cx, cy, w, h, rotation, breadboards } =
          movingComp.current;
        const zoom = canvasZoomRef.current;
        let nx = cx + (e.clientX - sx) / zoom;
        let ny = cy + (e.clientY - sy) / zoom;

        compUpdate = { id, newX: nx, newY: ny, snappingHoles: [] };

        if (type && isBreadboardType(type)) {
          // Breadboard movement propagation
          const dx = nx - cx;
          const dy = ny - cy;

          if (movingComp.current.childIds) {
            compUpdate.childUpdates = movingComp.current.childIds.map(
              (childId) => ({
                id: childId,
                newX:
                  (movingComp.current.childrenStart?.[childId]?.x ?? 0) + dx,
                newY:
                  (movingComp.current.childrenStart?.[childId]?.y ?? 0) + dy,
              }),
            );
          }
        } else if (type) {
          // Snapping Logic (Multi-pin)
          const pins = LOCAL_PIN_DEFS[type] || [];
          const anchorPinId = movingComp.current.anchorPinId || pins[0]?.id;
          const anchorPin = pins.find((p) => p.id === anchorPinId) || pins[0];

          if (anchorPin) {
            const finalCenterX = nx + (w || 0) / 2;
            const finalCenterY = ny + (h || 0) / 2;
            const anchorWorld = getRotatedPoint(
              nx + anchorPin.x,
              ny + anchorPin.y,
              rotation,
              finalCenterX,
              finalCenterY,
            );

            // Use cached breadboards list for speed
            const hole = findNearestBreadboardHole(
              anchorWorld.x,
              anchorWorld.y,
              breadboards || [],
              LOCAL_PIN_DEFS,
            );
            if (hole) {
              // Apply snapping offset
              nx += hole.x - anchorWorld.x;
              ny += hole.y - anchorWorld.y;
              compUpdate.newX = nx;
              compUpdate.newY = ny;

              // Identify all pins that align with holes
              const finalCenterX = nx + (w || 0) / 2;
              const finalCenterY = ny + (h || 0) / 2;
              const currentSnaps = [];
              pins.forEach((p) => {
                const pWorld = getRotatedPoint(
                  nx + p.x,
                  ny + p.y,
                  rotation,
                  finalCenterX,
                  finalCenterY,
                );
                const h = findNearestBreadboardHole(
                  pWorld.x,
                  pWorld.y,
                  breadboards || [],
                  LOCAL_PIN_DEFS,
                );
                if (h && Math.hypot(pWorld.x - h.x, pWorld.y - h.y) < 1) {
                  currentSnaps.push({ ...h, compPinId: p.id });
                }
              });
              compUpdate.snappingHoles = currentSnaps;
            }
          }
        }
      } else if (sd && canvasRef.current) {
        // Advanced Wire Interaction: Segment or Waypoint drag
        const rect = canvasRef.current.getBoundingClientRect();
        const mx =
          (e.clientX - rect.left - canvasOffsetRef.current.x) /
          canvasZoomRef.current;
        const my =
          (e.clientY - rect.top - canvasOffsetRef.current.y) /
          canvasZoomRef.current;
        const ddx = mx - sd.startMouseCanvas.x;
        const ddy = my - sd.startMouseCanvas.y;

        if (Math.abs(ddx) >= 1 || Math.abs(ddy) >= 1) {
          sd.hasMoved = true;
          const newPts = sd.startPts.map((pt) => ({ ...pt }));
          const { segIdx, isHoriz, mode } = sd;

          if (mode === "waypoint") {
            // Free move waypoint
            newPts[segIdx].x = sd.startPts[segIdx].x + ddx;
            newPts[segIdx].y = sd.startPts[segIdx].y + ddy;
          } else {
            // Orthogonal segment drag
            if (isHoriz) {
              const newY = sd.startPts[segIdx].y + ddy;
              newPts[segIdx] = { ...newPts[segIdx], y: newY };
              newPts[segIdx + 1] = { ...newPts[segIdx + 1], y: newY };
            } else {
              const newX = sd.startPts[segIdx].x + ddx;
              newPts[segIdx] = { ...newPts[segIdx], x: newX };
              newPts[segIdx + 1] = { ...newPts[segIdx + 1], x: newX };
            }
          }
          const finalWaypoints = [];
          if (newPts[0] && sd.startPts[0] && (newPts[0].x !== sd.startPts[0].x || newPts[0].y !== sd.startPts[0].y)) {
            finalWaypoints.push({ x: newPts[0].x, y: newPts[0].y, _corner: true });
          }
          for (let i = 1; i < newPts.length - 1; i++) {
            if (newPts[i]) finalWaypoints.push({ x: newPts[i].x, y: newPts[i].y, _corner: true });
          }
          const lastIdx = newPts.length - 1;
          if (lastIdx > 0 && newPts[lastIdx] && sd.startPts[lastIdx] && (newPts[lastIdx].x !== sd.startPts[lastIdx].x || newPts[lastIdx].y !== sd.startPts[lastIdx].y)) {
            finalWaypoints.push({ x: newPts[lastIdx].x, y: newPts[lastIdx].y, _corner: true });
          }

          wireUpdate = {
            wireId: sd.wireId,
            cornerWaypoints: finalWaypoints.filter(pt => pt && isFinite(pt.x) && isFinite(pt.y)),
          };
        }
      } else if (isPanningRef.current && !isCanvasLockedRef.current) {
        // Fix #4 ─ canvas panning via direct DOM transform (zero React renders mid-pan)
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        if (!didPanRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
          didPanRef.current = true;
        }
        if (didPanRef.current) {
          const newOffset = {
            x: panStartRef.current.ox + dx,
            y: panStartRef.current.oy + dy,
          };
          canvasOffsetRef.current = newOffset;
          // Apply transform directly to DOM — NO React state update mid-pan
          if (innerCanvasRef.current) {
            innerCanvasRef.current.style.transform = `translate(${newOffset.x}px, ${newOffset.y}px) scale(${canvasZoomRef.current})`;
          }
          panUpdate = newOffset; // stored so onUp can commit to React state
        }
      } else if (wireStartRef.current && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const rawX = snapToGrid(
          (e.clientX - rect.left - canvasOffsetRef.current.x) /
          canvasZoomRef.current,
        );
        const rawY = snapToGrid(
          (e.clientY - rect.top - canvasOffsetRef.current.y) /
          canvasZoomRef.current,
        );
        mousePosUpdate = { x: rawX, y: rawY };
      } else {
        // Fix #5 ─ mouse position and inspector hover tracking (throttled)
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const rawX =
            (e.clientX - rect.left - canvasOffsetRef.current.x) /
            canvasZoomRef.current;
          const rawY =
            (e.clientY - rect.top - canvasOffsetRef.current.y) /
            canvasZoomRef.current;
          mousePosUpdate = { x: rawX, y: rawY };

          if (showInspector) {
            // Inspector hover detection (throttled)
            // 1. Detect Pin Hover
            const pinMatch = Array.from(
              document.querySelectorAll('[id^="pin-dot-"]'),
            ).find((el) => {
              const b = el.getBoundingClientRect();
              return (
                e.clientX >= b.left &&
                e.clientX <= b.right &&
                e.clientY >= b.top &&
                e.clientY <= b.bottom
              );
            });

            if (pinMatch) {
              const parts = pinMatch.id.split("-");
              const compId = parts[2];
              const pinId = parts.slice(3).join("-");
              const instState = liveOopStatesRef.current[compId];
              const pinVoltage = instState?.pins?.[pinId]?.voltage ?? 0;
              // We'll use a direct state setter here, but since it's inside RAF it's fine
              setHoveredElement({
                type: "pin",
                id: pinMatch.id,
                label: `${compId}:${pinId}`,
                voltage: pinVoltage,
                history: instState?.vHistory || [],
              });
            } else {
              // 2. Detect Wire Hover
              let foundWire = false;
              for (const w of wiresRef.current) {
                const fromParts = w.from.split(":");
                const toParts = w.to.split(":");
                // Use getPinPosRef to avoid expensive re-renders
                const p1 = getPinPosRef.current?.(
                  fromParts[0],
                  fromParts.slice(1).join(":"),
                );
                const p2 = getPinPosRef.current?.(
                  toParts[0],
                  toParts.slice(1).join(":"),
                );
                if (!p1 || !p2) continue;

                const pts = [p1, ...(w.waypoints || []), p2];
                for (let i = 0; i < pts.length - 1; i++) {
                  const dist = distToSegment(rawX, rawY, pts[i], pts[i + 1]);
                  if (dist < 5) {
                    const inst1 = liveOopStatesRef.current[fromParts[0]];
                    const v1 =
                      inst1?.pins?.[fromParts.slice(1).join(":")]?.voltage ?? 0;
                    const v2 =
                      liveOopStatesRef.current[toParts[0]]?.pins?.[
                        toParts.slice(1).join(":")
                      ]?.voltage ?? 0;
                    setHoveredElement({
                      type: "wire",
                      id: w.id,
                      label: `Wire ${w.id}`,
                      voltage: Math.max(v1, v2),
                      current: Math.abs(v1 - v2) * 1000,
                      history: inst1?.vHistory || [],
                    });
                    foundWire = true;
                    break;
                  }
                }
                if (foundWire) break;
              }

              if (!foundWire) {
                // 3. Detect Component Body Hover
                const compMatch = componentsRef.current.find((c) => {
                  const dx = rawX - c.x - c.w / 2;
                  const dy = rawY - c.y - c.h / 2;
                  return Math.abs(dx) < c.w / 2 && Math.abs(dy) < c.h / 2;
                });

                if (compMatch) {
                  const instState = liveOopStatesRef.current[compMatch.id];
                  const vDrop = instState?.voltageDrop ?? 0;
                  const current = instState?.current ?? 0;
                  setHoveredElement({
                    type: "comp",
                    id: compMatch.id,
                    label: compMatch.label || compMatch.type,
                    voltageDrop: vDrop,
                    current,
                    power: instState?.power ?? vDrop * current,
                    history: instState?.vHistory || [],
                  });
                } else {
                  setHoveredElement(null);
                }
              }
            }
          }
        }
      }

      // ── Schedule a single rAF to flush state updates (cap at 60fps) ───────
      pendingMoveRef.current = { compUpdate, wireUpdate, mousePosUpdate };
      if (!rafMoveRef.current) {
        rafMoveRef.current = requestAnimationFrame(() => {
          rafMoveRef.current = null;
          const { compUpdate, wireUpdate, mousePosUpdate } =
            pendingMoveRef.current || {};

          if (compUpdate) {
            const {
              id,
              newX,
              newY,
              snappingHoles: holes,
              childUpdates,
            } = compUpdate;

            // 1. Direct DOM Update for Components (Master Wrapper)
            const updateMasterPos = (cid, x, y) => {
              const master = document.getElementById(`comp-master-${cid}`);
              if (master) {
                master.style.left = `${x}px`;
                master.style.top = `${y}px`;
              }
            };

            updateMasterPos(id, newX, newY);
            if (childUpdates) {
              childUpdates.forEach((u) =>
                updateMasterPos(u.id, u.newX, u.newY),
              );
            }

            // 2. Direct DOM Update for Wires (Lightweight Straight Lines)
            const affectedCompIds = new Set([
              id,
              ...(childUpdates?.map((u) => u.id) || []),
            ]);
            const affectedWires = wiresRef.current.filter((w) => {
              const fromId = w.from.split(":")[0];
              const toId = w.to.split(":")[0];
              return affectedCompIds.has(fromId) || affectedCompIds.has(toId);
            });

            // Create a quick lookup map for components for O(1) access
            const compMap = new Map();
            componentsRef.current.forEach((c) => compMap.set(c.id, c));

            affectedWires.forEach((w) => {
              const fromParts = w.from.split(":");
              const toParts = w.to.split(":");

              const getLivePos = (cid, pid) => {
                const c = compMap.get(cid);
                if (!c) return null;
                let curX = c.x,
                  curY = c.y;
                if (cid === id) {
                  curX = newX;
                  curY = newY;
                } else if (childUpdates) {
                  const u = childUpdates.find((cu) => cu.id === cid);
                  if (u) {
                    curX = u.newX;
                    curY = u.newY;
                  }
                }
                const pins = LOCAL_PIN_DEFS[c.type] || [];
                const searchId = String(pid).toLowerCase();

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

                let pDef = pins.find((p) => {
                  const pId = String(p.id).toLowerCase();
                  return pId === searchId || normalize(pId) === normSearch;
                });

                if (!pDef) {
                  pDef = pins.find((p) => {
                    const pId = String(p.id).toLowerCase();
                    const normPid = normalize(pId);
                    return (
                      pId === searchId ||
                      normPid.startsWith(normSearch + "_") ||
                      normPid.startsWith(normSearch + ".") ||
                      pId.startsWith(searchId + ".") ||
                      pId.startsWith(searchId + "_")
                    );
                  });
                }
                if (!pDef) return null;
                const rotation = c.rotation || 0;
                return getRotatedPoint(
                  curX + pDef.x,
                  curY + pDef.y,
                  rotation,
                  curX + c.w / 2,
                  curY + c.h / 2,
                );
              };

              const p1 = getLivePos(fromParts[0], fromParts.slice(1).join(":"));
              const p2 = getLivePos(toParts[0], toParts.slice(1).join(":"));
              if (p1 && p2) {
                // LIGHTWEIGHT: Use simple straight line during drag for maximum performance
                const pathStr = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
                const pathUi = document.getElementById(`wire-path-ui-${w.id}`);
                const pathHit = document.getElementById(
                  `wire-path-hit-${w.id}`,
                );
                const circFrom = document.getElementById(
                  `wire-circ-from-${w.id}`,
                );
                const circTo = document.getElementById(`wire-circ-to-${w.id}`);

                if (pathUi) pathUi.setAttribute("d", pathStr);
                if (pathHit) pathHit.setAttribute("d", pathStr);
                if (circFrom) {
                  circFrom.setAttribute("cx", p1.x);
                  circFrom.setAttribute("cy", p1.y);
                }
                if (circTo) {
                  circTo.setAttribute("cx", p2.x);
                  circTo.setAttribute("cy", p2.y);
                }
              }
            });

            // 3. Direct DOM Update for Snapping Feedback
            // First, clear previous snapping highlights (using a cached list or just clearing everything is too slow)
            // Better: only clear the holes that were previously snapped
            if (window._prevSnaps) {
              window._prevSnaps.forEach((h) => {
                const holeEl = document.getElementById(
                  `pin-dot-${h.bbId}-${h.holeId}`,
                );
                if (holeEl) {
                  holeEl.style.background = "rgba(255,255,255,0.2)";
                  holeEl.style.boxShadow = "none";
                  holeEl.style.borderColor = "rgba(255,255,255,0.8)";
                }
                const pinEl = document.getElementById(
                  `pin-dot-${movingComp.current.id}-${h.compPinId}`,
                );
                if (pinEl) {
                  pinEl.style.background = "rgba(255,255,255,0.2)";
                  pinEl.style.boxShadow = "none";
                  pinEl.style.borderColor = "rgba(255,255,255,0.8)";
                }
              });
            }
            if (holes) {
              holes.forEach((h) => {
                const holeEl = document.getElementById(
                  `pin-dot-${h.bbId}-${h.holeId}`,
                );
                if (holeEl) {
                  holeEl.style.background = "#2ecc71";
                  holeEl.style.boxShadow = "0 0 10px #2ecc71";
                  holeEl.style.borderColor = "#fff";
                }
                const pinEl = document.getElementById(
                  `pin-dot-${id}-${h.compPinId}`,
                );
                if (pinEl) {
                  pinEl.style.background = "#2ecc71";
                  pinEl.style.boxShadow = "0 0 10px #2ecc71";
                  pinEl.style.borderColor = "#fff";
                }
              });
            }
            window._prevSnaps = holes || [];

            // IMPORTANT: No setSnappingHoles or setComponents here!
            // This ensures ZERO React re-renders during the drag.
          }

          if (wireUpdate) {
            const { wireId, cornerWaypoints } = wireUpdate;
            setWires((prev) =>
              prev.map((w) =>
                w.id === wireId ? { ...w, waypoints: cornerWaypoints } : w,
              ),
            );
          }
          if (mousePosUpdate && !compUpdate && !isPanningRef.current) {
            // Wire-pulling cursor: ref mirror + listener notify. Re-renders
            // ONLY WirePreviewPath (subscribed via useSyncExternalStore) —
            // the page component itself never re-renders on mousemove.
            mousePosRef.current = mousePosUpdate;
            mousePosTickRef.current += 1;
            mousePosListenersRef.current.forEach((listener) => {
              try {
                listener();
              } catch {
                /* a dead preview listener must not break the drag loop */
              }
            });
          }
        });
      }
    };
    const onUp = () => {
      // Cancel any pending rAF on mouse up to avoid a ghost render
      if (rafMoveRef.current) {
        cancelAnimationFrame(rafMoveRef.current);
        rafMoveRef.current = null;
      }
      // Fix #4 ─ commit final pan offset to React state once (1 render total for entire pan)
      if (isPanningRef.current && canvasOffsetRef.current) {
        setCanvasOffset({ ...canvasOffsetRef.current });
      }
      if (movingComp.current?.moved) {
        const origComps = movingComp.current.originalComps;
        const movedId = movingComp.current.id;
        const childIds = movingComp.current.childIds;

        // 1. Sync final positions from DOM to React State with grid snapping on release
        const masterElem = document.getElementById(`comp-master-${movedId}`);
        const finalX = masterElem ? parseFloat(masterElem.style.left) : 0;
        const finalY = masterElem ? parseFloat(masterElem.style.top) : 0;

        let snappedX = finalX;
        let snappedY = finalY;
        if (!window._prevSnaps || window._prevSnaps.length === 0) {
          const comp = componentsRef.current.find((c) => c.id === movedId);
          const pins = (comp && LOCAL_PIN_DEFS[comp.type]) || [];
          const anchorPin = pins[0];
          if (comp && anchorPin) {
            const cx = finalX + (comp.w || 0) / 2;
            const cy = finalY + (comp.h || 0) / 2;
            const anchorWorld = getRotatedPoint(
              finalX + anchorPin.x,
              finalY + anchorPin.y,
              comp.rotation || 0,
              cx,
              cy,
            );
            const snappedAnchorX = snapToGrid(anchorWorld.x);
            const snappedAnchorY = snapToGrid(anchorWorld.y);
            snappedX = finalX + (snappedAnchorX - anchorWorld.x);
            snappedY = finalY + (snappedAnchorY - anchorWorld.y);
          } else {
            snappedX = snapToGrid(finalX);
            snappedY = snapToGrid(finalY);
          }
        }
        const snapDiffX = snappedX - finalX;
        const snapDiffY = snappedY - finalY;

        if (masterElem) {
          masterElem.style.left = `${snappedX}px`;
          masterElem.style.top = `${snappedY}px`;
        }
        if (childIds) {
          childIds.forEach((childId) => {
            const childMaster = document.getElementById(
              `comp-master-${childId}`,
            );
            if (childMaster) {
              const cx = parseFloat(childMaster.style.left) + snapDiffX;
              const cy = parseFloat(childMaster.style.top) + snapDiffY;
              childMaster.style.left = `${cx}px`;
              childMaster.style.top = `${cy}px`;
            }
          });
        }

        setComponents((prev) => {
          let next = prev.map((c) =>
            c.id === movedId ? { ...c, x: snappedX, y: snappedY } : c,
          );
          if (childIds) {
            next = next.map((c) => {
              if (childIds.includes(c.id)) {
                const childMaster = document.getElementById(
                  `comp-master-${c.id}`,
                );
                if (childMaster) {
                  return {
                    ...c,
                    x: parseFloat(childMaster.style.left) + snapDiffX,
                    y: parseFloat(childMaster.style.top) + snapDiffY,
                  };
                }
              }
              return c;
            });
          }
          return next;
        });

        setHistory((h) => ({
          past: [
            ...h.past.slice(-20),
            { components: origComps, wires: JSON.parse(JSON.stringify(wiresRef.current)) },
          ],
          future: [],
        }));

        // DETACHMENT: Remove old socket wires for this component (ONLY if moving a component, NOT a breadboard)
        const isBreadboard = isBreadboardType(
          componentsRef.current.find((c) => c.id === movedId)?.type,
        );
        if (!isBreadboard) {
          setWires((prev) =>
            prev.filter((w) => {
              const isFrom = w.from.startsWith(movedId + ":");
              const isTo = w.to.startsWith(movedId + ":");
              return !(w.isSocket && (isFrom || isTo));
            }),
          );
        }

        // ATTACHMENT: Auto-create socket wires if snapped
        const comp = componentsRef.current.find((c) => c.id === movedId);
        const finalComp = comp ? { ...comp, x: finalX, y: finalY } : null;
        if (finalComp && !isBreadboardType(finalComp.type)) {
          const { snappedWires } = robustSnapComponent(
            finalComp,
            componentsRef.current,
            LOCAL_PIN_DEFS,
          );
          if (snappedWires.length > 0) {
            setWires((prev) => [...prev, ...snappedWires]);
          }
        }

        // 2. Finalize snapping and cleanup
        if (window._prevSnaps) {
          window._prevSnaps.forEach((h) => {
            const holeEl = document.getElementById(
              `pin-dot-${h.bbId}-${h.holeId}`,
            );
            if (holeEl) {
              holeEl.style.background = "";
              holeEl.style.boxShadow = "";
              holeEl.style.borderColor = "";
            }
            const pinEl = document.getElementById(
              `pin-dot-${movedId}-${h.compPinId}`,
            );
            if (pinEl) {
              pinEl.style.background = "";
              pinEl.style.boxShadow = "";
              pinEl.style.borderColor = "";
            }
          });
          window._prevSnaps = null;
        }
        setSnappingHoles([]);

        // 3. Clear _corner waypoints
        setWires((prev) =>
          prev.map((w) => {
            if (
              w.from.startsWith(movedId + ":") ||
              w.to.startsWith(movedId + ":")
            ) {
              if (w.waypoints?.length && w.waypoints[0]._corner)
                return { ...w, waypoints: [] };
            }
            return w;
          }),
        );
      }
      movingComp.current = null;
      setIsComponentDragging(false);
      setSnappingHoles([]);
      isPanningRef.current = false;
      if (segDragRef.current) {
        if (segDragRef.current.hasMoved) {
          const wireId = segDragRef.current.wireId;
          // Apply simplification to clean up redundant segments/waypoints
          setWires((prev) =>
            prev.map((w) => {
              if (w.id === wireId) {
                let updatedWaypoints = w.waypoints;
                if (w.waypoints?.length) {
                  const snappedWaypoints = w.waypoints.map((pt) => ({
                    ...pt,
                    x: snapToGrid(pt.x),
                    y: snapToGrid(pt.y),
                  }));
                  const fromParts = w.from.split(":");
                  const toParts = w.to.split(":");
                  const p1 = getPinPosRef.current(
                    fromParts[0],
                    fromParts.slice(1).join(":"),
                  );
                  const p2 = getPinPosRef.current(
                    toParts[0],
                    toParts.slice(1).join(":"),
                  );
                  if (p1 && p2) {
                    const fullPath = [p1, ...snappedWaypoints, p2];
                    const simplified = simplifyOrthogonalPath(fullPath);
                    updatedWaypoints = simplified.slice(1, -1);
                  } else {
                    updatedWaypoints = snappedWaypoints;
                  }
                }
                return {
                  ...w,
                  waypoints: updatedWaypoints,
                  routingInstructions: undefined,
                };
              }
              return w;
            }),
          );

          // Save undo snapshot using pre-drag wires captured at drag start
          const pre = segDragRef.current.preWires;
          setHistory((h) => ({
            past: [
              ...h.past.slice(-20),
              {
                components: JSON.parse(JSON.stringify(componentsRef.current)),
                wires: JSON.parse(JSON.stringify(pre)),
              },
            ],
            future: [],
          }));
          // Prevent the subsequent click event from deselecting the wire
          didPanRef.current = true;
        }
        segDragRef.current = null;
        setSegDrag(null);
      }
      setIsComponentDragging(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // NOTE: intentionally [] — loop reads wireStart/wires/components via refs
    // (wireStartRef, wiresRef, componentsRef) so drag/pan/hover never
    // re-subscribes window listeners on unrelated renders.
  }, []);
  return { onCompClick };
}

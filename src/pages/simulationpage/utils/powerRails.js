import { LOCAL_PIN_DEFS } from "./componentRegistry";
import { isBreadboardType, getPinCategory } from "./hardwareUtils";

// Module-scoped wire id counter. Lives here (not in the component) so ids
// stay unique across re-renders; callers must call syncWireIds() after any
// bulk import that introduces w-prefixed ids.
let nextWireId = 1;

export function syncWireIds(components, wires) {
  let max = 0;
  (wires || []).forEach((w) => {
    const m = String(w.id || "").match(/^w(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  nextWireId = max + 1;
}

export function takeNextWireId() {
  return `w${nextWireId++}`;
}

const getPinX = (c, p) => {
  if (!p) return 0;
  if (p.x !== undefined) return p.x;
  if (c.type.includes("pico")) {
    const n = parseInt(p.id);
    if (!isNaN(n)) return n <= 20 ? 0 : c.w || 60;
  }
  return (c.w || 60) / 2;
};

const getPinY = (c, p) => {
  if (!p) return 0;
  if (p.y !== undefined) return p.y;
  return (c.h || 60) / 2;
};

/**
 * Auto-wire a newly added component's power pins to the nearest breadboard
 * rails. Pure function of (newComp, existingComponents, currentWires) —
 * returns a NEW wire array, never mutates inputs. Extracted verbatim from
 * SimulatorPage.jsx so canvas power-rail behavior stays identical.
 */
export const autoConnectPowerRails = (
  newComp,
  existingComponents,
  currentWires,
) => {
  let newWires = [...currentWires];

  const getBestPowerPins = (comp, bb) => {
    const pins = LOCAL_PIN_DEFS[comp.type] || [];
    const bbPins = LOCAL_PIN_DEFS[bb.type] || [];

    const bbVccPins = bbPins.filter(
      (p) =>
        p.id.startsWith("top_vcc") ||
        p.id.startsWith("bottom_vcc") ||
        p.id === "t+" ||
        p.id === "b+" ||
        p.id === "VCC" ||
        p.id === "5V",
    );
    const bbGndPins = bbPins.filter(
      (p) =>
        p.id.startsWith("top_gnd") ||
        p.id.startsWith("bottom_gnd") ||
        p.id === "t-" ||
        p.id === "b-" ||
        p.id === "GND",
    );

    const isOccupied = (pinId) =>
      newWires.some((w) => w.from === `${bb.id}:${pinId}` || w.to === `${bb.id}:${pinId}`);

    const availableBbVccPins = bbVccPins.filter((p) => !isOccupied(p.id));
    const availableBbGndPins = bbGndPins.filter((p) => !isOccupied(p.id));

    const finalBbVccPins =
      availableBbVccPins.length > 0
        ? availableBbVccPins
        : bbVccPins.length > 0
          ? [bbVccPins[0]]
          : [];
    const finalBbGndPins =
      availableBbGndPins.length > 0
        ? availableBbGndPins
        : bbGndPins.length > 0
          ? [bbGndPins[0]]
          : [];

    if (finalBbVccPins.length === 0 || finalBbGndPins.length === 0) return null;

    const vccPins = [];
    const gndPins = [];

    pins.forEach((pin) => {
      const cats = getPinCategory(pin.id, pin.description || "", comp.type) || [];
      if (cats.includes("POWER") || cats.includes("VIN")) vccPins.push(pin);
      if (cats.includes("GND")) gndPins.push(pin);
    });

    // Force all Arduino boards (Uno, Mega, Nano, etc.) to use 5V by eliminating the 3.3V pin from consideration
    if (comp.type.includes("arduino")) {
      for (let i = vccPins.length - 1; i >= 0; i--) {
        const idAndDesc = (
          (vccPins[i].id || "") +
          " " +
          (vccPins[i].description || "")
        ).toUpperCase();
        if (idAndDesc.includes("3.3") || idAndDesc.includes("3V3")) {
          vccPins.splice(i, 1);
        }
      }
    }

    if (vccPins.length === 0 && gndPins.length === 0) return null;

    let bestScore = Infinity;
    let bestPair = {
      vcc: vccPins[0] || null,
      gnd: gndPins[0] || null,
      bbVcc: finalBbVccPins[0].id,
      bbGnd: finalBbGndPins[0].id,
    };

    const vccList = vccPins.length > 0 ? vccPins : [null];
    const gndList = gndPins.length > 0 ? gndPins : [null];

    vccList.forEach((vcc) => {
      const vccX = vcc ? comp.x + getPinX(comp, vcc) : 0;
      const vccY = vcc ? comp.y + getPinY(comp, vcc) : 0;

      let voltageType = null;
      if (vcc) {
        const idAndDesc = (
          (vcc.id || "") +
          " " +
          (vcc.description || "")
        ).toUpperCase();
        if (idAndDesc.includes("3.3") || idAndDesc.includes("3V3"))
          voltageType = "3.3V";
        else if (idAndDesc.includes("5V")) voltageType = "5V";
      }

      gndList.forEach((gnd) => {
        const gndX = gnd ? comp.x + getPinX(comp, gnd) : 0;
        const gndY = gnd ? comp.y + getPinY(comp, gnd) : 0;

        finalBbVccPins.forEach((bbVcc) => {
          const bbVccX = bb.x + (bbVcc.x || 0);
          const bbVccY = bb.y + (bbVcc.y || 0);
          const distToBbVcc = vcc ? Math.hypot(vccX - bbVccX, vccY - bbVccY) : 0;

          finalBbGndPins.forEach((bbGnd) => {
            const bbGndX = bb.x + (bbGnd.x || 0);
            const bbGndY = bb.y + (bbGnd.y || 0);
            const distToBbGnd = gnd ? Math.hypot(gndX - bbGndX, gndY - bbGndY) : 0;

            const pinDist = vcc && gnd ? Math.hypot(vccX - gndX, vccY - gndY) : 0;

            let score = pinDist * 5 + distToBbVcc + distToBbGnd;

            // Offset the wires diagonally so they don't overlap. Always shift in the same direction so consecutive components don't interleave/criss-cross.
            if (vcc && gnd && bbVccX >= bbGndX) {
              score += 100;
            }

            if (
              voltageType === "3.3V" &&
              (bbVcc.id.startsWith("bottom_") || bbGnd.id.startsWith("bottom_"))
            ) {
              score += 5000;
            } else if (
              voltageType === "5V" &&
              (bbVcc.id.startsWith("top_") || bbGnd.id.startsWith("top_"))
            ) {
              score += 5000;
            }

            if (score < bestScore) {
              bestScore = score;
              bestPair = { vcc, gnd, bbVcc: bbVcc.id, bbGnd: bbGnd.id };
            }
          });
        });
      });
    });

    return bestPair;
  };

  const connectCompToBb = (comp, bb) => {
    const pair = getBestPowerPins(comp, bb);
    if (!pair) return;

    const bbPins = LOCAL_PIN_DEFS[bb.type] || [];

    const makeCleanWaypoints = (compPin, bbPinId) => {
      const cx = comp.x + getPinX(comp, compPin);
      const cy = comp.y + getPinY(comp, compPin);
      const bbPinDef = bbPins.find((p) => p.id === bbPinId);
      const bx = bb.x + (bbPinDef?.x || 0);
      const by = bb.y + (bbPinDef?.y || 0);
      // Clean L-shape: go vertically to the breadboard rail Y, then horizontally
      if (Math.abs(cy - by) > Math.abs(cx - bx)) {
        return [{ x: cx, y: by, _corner: true }];
      }
      // If mostly horizontal, go horizontally first then vertically
      return [{ x: bx, y: cy, _corner: true }];
    };

    if (pair.vcc) {
      const alreadyWired = newWires.some(
        (w) => w.from === `${comp.id}:${pair.vcc.id}` || w.to === `${comp.id}:${pair.vcc.id}`,
      );
      if (!alreadyWired) {
        // Detect voltage type for wire color: orange for 3.3V, red for 5V
        const vccIdDesc = (
          (pair.vcc.id || "") +
          " " +
          (pair.vcc.description || "")
        ).toUpperCase();
        const is3v3 = vccIdDesc.includes("3.3") || vccIdDesc.includes("3V3");
        newWires.push({
          id: takeNextWireId(),
          from: `${comp.id}:${pair.vcc.id}`,
          to: `${bb.id}:${pair.bbVcc}`,
          color: is3v3 ? "#f97316" : "red",
          isBelow: false,
          waypoints: makeCleanWaypoints(pair.vcc, pair.bbVcc),
        });
      }
    }
    if (pair.gnd) {
      const alreadyWired = newWires.some(
        (w) => w.from === `${comp.id}:${pair.gnd.id}` || w.to === `${comp.id}:${pair.gnd.id}`,
      );
      if (!alreadyWired) {
        newWires.push({
          id: takeNextWireId(),
          from: `${comp.id}:${pair.gnd.id}`,
          to: `${bb.id}:${pair.bbGnd}`,
          color: "black",
          isBelow: false,
          waypoints: makeCleanWaypoints(pair.gnd, pair.bbGnd),
        });
      }
    }
  };

  if (isBreadboardType(newComp.type)) {
    existingComponents.forEach((comp) => {
      if (!isBreadboardType(comp.type)) {
        connectCompToBb(comp, newComp);
      }
    });
  } else {
    // If a new component is added, find the first breadboard and wire to it
    const bb = existingComponents.find((c) => isBreadboardType(c.type));
    if (bb) {
      connectCompToBb(newComp, bb);
    }
  }

  return newWires;
};

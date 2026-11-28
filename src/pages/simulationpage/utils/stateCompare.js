/**
 * Deep-equality for live OOP component states. Extracted verbatim from
 * SimulatorPage.jsx. Used by updateLiveOopStates to skip notifying
 * subscribers when a worker state frame is identical to the last one —
 * the gate that prevents per-frame React churn during simulation.
 */
export const serializedStateEquals = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (e) {
    return false;
  }
};

import {
  calculateProjectPlanApplication,
  removeCodeSnippet,
} from "../projectUtils";
import { COMPONENT_REGISTRY } from "../utils/componentRegistry";

/**
 * Rewire-to-board domain, extracted verbatim from SimulatorPage.jsx.
 * (handleWireToBoard: WASM rewire plan w/ isRewire flag, targetBoard attr
 *  persist, autocode snippet strip across all project files.)
 *
 * Plain async function (not a hook — no hooks inside). Mutations flow via
 * args. Critical-alert path preserved verbatim (alert + early return).
 * Verify via rewire-to-board Playwright check.
 */
export async function handleWireToBoardAction(args) {
  const {
    compId,
    targetBoardId,
    components,
    wires,
    saveHistory,
    generateAutonomousSetup,
    PIN_DEFS,
    autoBreadboardEnabled,
    setComponents,
    setWires,
    setProjectFiles,
    activeCodeFileId,
    code,
    setCode,
  } = args;
        const comp = components.find((c) => c.id === compId);
        if (!comp) return;

        saveHistory();

        const manifest = COMPONENT_REGISTRY[comp.type]?.manifest || {};

        // Trigger WASM setup with isRewire flag
        // The worker will handle cleaning up old wires and helper components
        const plan = await generateAutonomousSetup(
          components,
          wires,
          comp,
          manifest,
          targetBoardId,
          PIN_DEFS,
          autoBreadboardEnabled,
          true, // isRewire
        );

        if (plan) {
          if (plan.reasoning) {
            const critical = plan.reasoning.find((r) =>
              r.toUpperCase().includes("CRITICAL"),
            );
            if (critical) {
              alert(`Autowiring Critical Error:\n\n${critical}`);
              return;
            }
          }

          // Re-map IDs for added components to ensure uniqueness during re-wiring
          const mainCompId = compId;
          const adjustedPlan = {
            ...plan,
            added_components: plan.added_components || [],
          };

          const result = calculateProjectPlanApplication(
            adjustedPlan,
            components,
            wires,
            PIN_DEFS,
          );

          // Persist the target board selection in attributes for UI selection state
          const finalComponents = result.components.map((c) =>
            c.id === compId
              ? { ...c, attrs: { ...c.attrs, targetBoard: targetBoardId } }
              : c,
          );

          setComponents(finalComponents);
          setWires(result.wires);

          // Remove any existing autocoded snippet for this component from all project files
          setProjectFiles((prev) =>
            prev.map((f) => {
              if (f.content) {
                const newContent = removeCodeSnippet(f.content, compId);
                if (activeCodeFileId === f.id && code !== newContent) {
                  setCode(newContent);
                }
                return { ...f, content: newContent };
              }
              return f;
            }),
          );
        }

}

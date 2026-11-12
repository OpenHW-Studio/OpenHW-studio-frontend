import { useCallback } from "react";
import {
  boardCompToDisplayName,
  normalizeBoardKind,
} from "../utils/hardwareUtils";
import {
  fnv1aHash,
  extractCompileSummaryLines,
} from "../utils/simulatorUtils";
import { calculateProjectPlanApplication } from "../projectUtils";
import { LOCAL_PIN_DEFS } from "../utils/componentRegistry";

/**
 * Validation/autofix core domain, extracted verbatim from SimulatorPage.jsx.
 * (compile-summary logging, GDB artifact store, validation signature,
 *  blocking circuit validation w/ bypass + cache, autofix apply +
 *  project-change-plan, apply-plan gate.)
 *
 * Behavior contract: identical cache short-circuit, identical bypass
 * windows, identical artifact eviction (last-write-wins per board),
 * identical history checkpoint before plan apply. Verify via
 * validation-block + autofix-apply Playwright checks.
 */
export function useValidationCore({
  appendConsoleEntry,
  validationErrors,
  setValidationErrors,
  setValidationToast,
  setAutofixPlan,
  components,
  wires,
  runUnifiedValidation,
  FullCircuitValidator,
  analyzeCodeHardwareSync,
  boardComponents,
  code,
  codeTab,
  useBlocklyCode,
  blocklyGeneratedCode,
  activeCodeFile,
  activeCodeFileId,
  projectFiles,
  saveHistory,
  setComponents,
  setWires,
  setProjectFiles,
  setSelected,
  setWireStart,
  wireStartRef,
  setSnappingHoles,
  movingComp,
  setIsComponentDragging,
  autofixPlan,
  sharedApplyCircuitFix,
  isRunning,
  setHealthScore,
  setShowValidation,
  setPendingVerificationRule,
  triggerAutofixAnalysis,
  validationRunCacheRef,
  EmulatorComponents,
  setIsPanelOpen,
}) {
    // ─── Simulator Run & Stop Logic ─────────────────────────────────────────────

    const logCompileSummary = useCallback(
      (compiledResult, boardComp, boardKind) => {
        const summaryLines = extractCompileSummaryLines(
          compiledResult?.stdout || "",
        );
        if (summaryLines.length === 0) return;

        const boardLabel = boardCompToDisplayName(boardComp, boardKind);
        summaryLines.forEach((line) => {
          appendConsoleEntry("info", `[${boardLabel}] ${line}`, "simulator");
        });
      },
      [appendConsoleEntry],
    );

    const registerGdbArtifact = useCallback(
      (boardId, boardKind, compiledResult) => {
        const compiled =
          compiledResult && typeof compiledResult === "object"
            ? compiledResult
            : null;
        if (!compiled || !boardId) return;

        // Prefer the artifacts map; fall back to legacy top-level fields.
        const mapElf = compiled.artifacts?.elf;
        const elfPayload =
          (typeof mapElf?.data === "string" && mapElf.data
            ? (mapElf.encoding === "base64" ? `ELFBASE64:${mapElf.data}` : mapElf.data)
            : typeof compiled.elf === "string"
              ? compiled.elf
              : "");
        const elfName = mapElf?.fileName || compiled.elfName || "";
        const gdbMeta =
          compiled.gdb && typeof compiled.gdb === "object" ? compiled.gdb : null;
        if (!elfPayload && !gdbMeta) return;

        const artifact = {
          boardId,
          boardKind,
          ts: Date.now(),
          elf: elfPayload,
          elfName,
          firmware: compiled.hex || "",
          artifactType: compiled.artifactType || "",
          gdb: gdbMeta,
        };

        try {
          localStorage.setItem(
            `openhw_gdb_artifact_${boardId}`,
            JSON.stringify(artifact),
          );
          localStorage.setItem(
            "openhw_gdb_last_artifact",
            JSON.stringify(artifact),
          );
        } catch (e) {
          // ignore storage failures
        }

        const gdbName = gdbMeta?.gdb || "gdb-multiarch";
        const remoteTarget = gdbMeta?.targetRemote || "localhost:3333";
        const elfLabel = artifact.elfName ? ` (${artifact.elfName})` : "";
        appendConsoleEntry(
          "info",
          `GDB artifact ready for ${boardId}: ${gdbName} -> target remote ${remoteTarget}${elfLabel}`,
          "debug",
        );
        appendConsoleEntry(
          "info",
          "Web GDB reference: https://wokwi.github.io/web-gdb/",
          "debug",
        );
      },
      [appendConsoleEntry],
    );

    const buildValidationSignature = useCallback(() => {
      const normalizedComponents = (components || [])
        .map((comp) => ({
          id: comp?.id || "",
          type: comp?.type || "",
          attrs: comp?.attrs || {},
        }))
        .sort((a, b) => `${a.id}|${a.type}`.localeCompare(`${b.id}|${b.type}`));

      const normalizedWires = (wires || [])
        .map((wire) => ({
          from: String(wire?.from || ""),
          to: String(wire?.to || ""),
        }))
        .sort((a, b) => `${a.from}|${a.to}`.localeCompare(`${b.from}|${b.to}`));

      return JSON.stringify({
        components: normalizedComponents,
        wires: normalizedWires,
        activeCodeFileId: activeCodeFileId || "",
        code: (useBlocklyCode || codeTab === 'block') ? blocklyGeneratedCode || code || "" : code || "",
      });
    }, [
      components,
      wires,
      activeCodeFileId,
      useBlocklyCode,
      codeTab,
      blocklyGeneratedCode,
      code,
    ]);

    const runCircuitValidation = useCallback(
      (overriddenComponents, overriddenWires) => {
        try {
          if (isRunning) return true;

          const targetComponents = overriddenComponents || components;
          const targetWires = overriddenWires || wires;

          // Skip signature check if we are forcing a validation with overridden state
          if (!overriddenComponents && !overriddenWires) {
            const validationSignature = buildValidationSignature();
            const cachedValidation = validationRunCacheRef.current;
            if (cachedValidation.signature === validationSignature) {
              setValidationErrors(cachedValidation.errors || []);
              setValidationToast(cachedValidation.toast || null);
              setHealthScore(
                Number.isFinite(cachedValidation.healthScore)
                  ? cachedValidation.healthScore
                  : 100,
              );
              if ((cachedValidation.errors || []).length > 0) {
                setShowValidation(true);
                setIsPanelOpen(true);
              }
              return cachedValidation.allowRun !== false;
            }
          }

          const projectData = {
            components: targetComponents,
            connections: targetWires,
            code: (useBlocklyCode || codeTab === 'block') ? blocklyGeneratedCode || code || "" : code || "",
            activeCodeFileId,
          };

          // USE UNIFIED ENGINE (Locally)
          const { safe, physicsSafe, errors, healthScore } = runUnifiedValidation(
            projectData,
            {
              profile: "balanced",
              incremental: true,
              incrementalScope: "webui",
              registry: EmulatorComponents, // Pass the full component library for rule discovery
            },
          );

          setHealthScore(healthScore);
          setValidationErrors(errors);

          const hasFatalPhysics = errors.some(
            (e) => e.severity === "error" || e.type === "error",
          );
          const allowRun = physicsSafe && !hasFatalPhysics; // Block if physics is unsafe (short circuit etc)

          let nextToast = null;
          if (!safe) {
            if (errors.length > 0 && showAutofix) {
              triggerAutofixAnalysis(errors, targetComponents, targetWires);
            }
            setShowValidation(true);
            setIsPanelOpen(true);

            nextToast = {
              title: hasFatalPhysics ? `🛑 Circuit Error` : `⚠️ Circuit Warning`,
              reasons: errors.slice(0, 3).map((e) => e.message),
            };
            setValidationToast(nextToast);
          } else {
            setValidationToast(null);
          }

          validationRunCacheRef.current = {
            signature: overriddenComponents
              ? "invalidated"
              : buildValidationSignature(),
            allowRun,
            errors,
            healthScore,
            toast: nextToast,
          };

          return allowRun;
        } catch (err) {
          console.warn("[Validation] Engine failed, continuing run:", err);
          return true;
        }
      },
      [
        components,
        wires,
        code,
        useBlocklyCode,
        blocklyGeneratedCode,
        activeCodeFileId,
        isRunning,
        buildValidationSignature,
      ],
    );

    const applyFix = useCallback(
      async (error) => {
        if (!error.remediation && !error.ruleId) {
          appendConsoleEntry(
            "warn",
            "⚠️ Cannot fix: No remediation found",
            "simulator",
          );
          return;
        }

        saveHistory();
        const projectData = { components, connections: wires };
        const circuitBefore = JSON.parse(JSON.stringify(projectData));

        // Apply the fix using enhanced fixer (host package export; was a
        // latent ReferenceError in the original page when absent)
        if (typeof sharedApplyCircuitFix !== "function") {
          appendConsoleEntry(
            "error",
            "Autofix engine unavailable in this build.",
            "simulator",
          );
          return;
        }
        const result = sharedApplyCircuitFix(projectData, error, {
          appliedBy: "webui",
        });

        if (!result.applied) {
          appendConsoleEntry(
            "warn",
            `⚠️ Fix not applied: ${result.reason || "Check circuit connectivity"}`,
            "simulator",
          );
          return;
        }

        // Update the circuit
        setComponents(result.components);
        setWires(result.connections);

        // Log applied fix
        const fixDesc =
          result.appliedFixes?.[0]?.description || error.remediation;
        appendConsoleEntry("info", `🔧 Applied: ${fixDesc}`, "simulator");

        // CRITICAL: Clear validation cache so next run re-validates from scratch
        validationRunCacheRef.current = {};

        // Re-run validation to verify the fix worked
        try {
          const validator = new FullCircuitValidator({
            components: result.components,
            connections: result.connections,
          });
          const verifyResult = await validator.runValidation({
            profile: "balanced",
            incrementalScope: "webui",
          });

          const errorStillExists = verifyResult.errors?.some(
            (e) => (e.id || e.ruleId) === (error.id || error.ruleId),
          );

          const newErrors =
            verifyResult.errors?.filter(
              (newErr) =>
                !validationErrors.some(
                  (oldErr) =>
                    (oldErr.id || oldErr.ruleId) === (newErr.id || newErr.ruleId),
                ),
            ) || [];

          if (!errorStillExists) {
            if (newErrors.length === 0) {
              appendConsoleEntry(
                "success",
                `✅ Fix successful! Error resolved.`,
                "simulator",
              );
            } else {
              const errorCount = newErrors.filter(
                (e) => e.severity === "error",
              ).length;
              const warnCount = newErrors.filter(
                (e) => e.severity === "warn",
              ).length;
              appendConsoleEntry(
                "warn",
                `✅ Original error fixed, but introduced ${errorCount} error(s) and ${warnCount} warning(s). Review changes.`,
                "simulator",
              );
            }
          } else {
            appendConsoleEntry(
              "error",
              `❌ Fix did not resolve the error. Try a different approach.`,
              "simulator",
            );
          }
        } catch (verifyErr) {
          console.warn(
            "[Verification] Revalidation failed after fix:",
            verifyErr,
          );
          appendConsoleEntry(
            "info",
            `✅ Applied: ${fixDesc} (verification skipped)`,
            "simulator",
          );
        }
      },
      [components, wires, saveHistory, validationErrors],
    );

    // Autofix preview/apply-all integration
    // Unified project change application (shared by Autofix and future Autowiring engines)
    const applyProjectChangePlan = useCallback(
      (plan) => {
        if (!plan) return;

        // Set for verification loop
        if (plan.targetRuleId) {
          setPendingVerificationRule(plan.targetRuleId);
        }

        // Calculate the new project state using the centralized utility
        const { components: nextComponents, wires: nextWires } =
          calculateProjectPlanApplication(
            plan,
            components,
            wires,
            LOCAL_PIN_DEFS,
          );

        setComponents(nextComponents);
        setWires(nextWires);
        saveHistory();

        appendConsoleEntry(
          "info",
          `🔧 Project Plan Applied: ${plan.addedComponents?.length || 0} components, ${plan.addedWires?.length || 0} wires.`,
          "simulator",
        );

        // Force re-validation after fix to continue "Speak & Hear" loop
        // We pass nextComponents/nextWires directly to bypass React's async state update
        setTimeout(async () => {
          validationRunCacheRef.current = {}; // Clear cache

          // 1) Trigger Local Simulator Validation check against new topology
          runCircuitValidation(nextComponents, nextWires);

          appendConsoleEntry(
            "info",
            "📡 Re-validating circuit after repair...",
            "simulator",
          );
        }, 150);
      },
      [components, wires, saveHistory, appendConsoleEntry, runCircuitValidation],
    );


  const handleApplyPlan = useCallback(() => {
    if (!autofixPlan) return;
    applyProjectChangePlan(autofixPlan);
    setAutofixPlan(null); // Clear preview
  }, [autofixPlan, applyProjectChangePlan]);

  return {
    logCompileSummary,
    registerGdbArtifact,
    buildValidationSignature,
    runCircuitValidation,
    applyFix,
    applyProjectChangePlan,
    handleApplyPlan,
  };
}

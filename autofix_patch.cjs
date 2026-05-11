const fs = require('fs');
const content = fs.readFileSync('c:/Users/Danish/Documents/simulator/OpenHW-studio-frontend/src/worker/autofix.worker.ts', 'utf8');

const targetMethod = `    case 'analyze':
      try {
        const { diagram, violations } = payload;
        
        let currentDiagram = { components: [...(diagram.components || [])], connections: [...(diagram.connections || [])] };
        let currentViolations = [...(violations || [])];
        let totalSuggestions = [];
        let limit = 0;
        const MACRO_LIMIT = 5; // Prevent infinite recursive autofixing

        // Dynamic Iterative Loop
        while (currentViolations.length > 0 && limit < MACRO_LIMIT) {
          self.postMessage({ type: 'status', payload: \`Analyzing iteration \${limit + 1} (Rust)...\` });
          engine.reset();

          // 1. Ingest current components
          currentDiagram.components.forEach((c) => {
            engine.ingestComponent(c.id, c.type, c.x || 0, c.y || 0, c.rotation || 0);
          });

          // 2. Ingest wires
          currentDiagram.connections.forEach((w) => {
            engine.ingestWire(w.from, w.to, w.color || 'green');
          });

          // 3. Ingest current violations
          currentViolations.forEach((v) => {
            const rawIds = v.componentIds || v.compIds || [];
            const compIdsStr = (Array.isArray(rawIds) ? rawIds : [rawIds]).join(',');
            const ruleId = v.ruleId || v.id || 'unknown-rule';
            engine.ingestViolation(ruleId, v.message || 'Unknown issue', compIdsStr, v.severity || 'error');
          });

          // 4. Generate partial plan
          self.postMessage({ type: 'status', payload: \`🧠 Calculating optimal repair strategy (\${limit + 1}/5)...\` });
          engine.analyze();
          const planCount = engine.getFixPlanCount();

          if (planCount === 0) break; // Engine gave up / ran out of patterns

          // Take the primary fix (most severe usually sorted first)
          const i = 0; 
          const description = engine.getFixDescription(i);
          
          const addedComponents = [];
          for (let j = 0; j <  engine.getFixAddedComponentCount(i); j++) {
            addedComponents.push({
              id: engine.getAddedComponentId(i, j),
              type: engine.getAddedComponentType(i, j),
              x: engine.getAddedComponentX(i, j),
              y: engine.getAddedComponentY(i, j),
              w: 0, h: 0, rotation: 0
            });
          }

          const addedWires = [];
          for (let j = 0; j < engine.getFixAddedWireCount(i); j++) {
            const path = [];
            for (let k = 0; k < engine.getAddedWirePathPointCount(i, j); k++) {
              path.push({ x: engine.getAddedWirePathPointX(i, j, k), y: engine.getAddedWirePathPointY(i, j, k) });
            }
            addedWires.push({
              from: engine.getAddedWireFrom(i, j).replace('.', ':'),
              to: engine.getAddedWireTo(i, j).replace('.', ':'),
              color: '#38bdf8', isNew: true,
              path: path.length > 0 ? path : null
            });
          }

          const removedWires = [];
          for (let j = 0; j < engine.getFixRemovedWireCount(i); j++) {
            removedWires.push({
              from: engine.getRemovedWireFrom(i, j).replace('.', ':'),
              to: engine.getRemovedWireTo(i, j).replace('.', ':')
            });
          }

          const transformations = [];
          for (let j = 0; j < engine.getFixTransformationCount(i); j++) {
            transformations.push({
              componentId: engine.getTransformationComponentId(i, j),
              rotation: engine.getTransformationRotation(i, j)
            });
          }

          const reasoning = [];
          for (let j = 0; j < engine.getFixReasoningCount(i); j++) {
            reasoning.push(engine.getFixReasoningStep(i, j));
          }

          const iterPlan = {
            description,
            targetRuleId: engine.getFixTargetRuleId(i),
            addedComponents, addedWires, removedWires, transformations, reasoning
          };

          totalSuggestions.push(iterPlan);

          // 5. Recursion Step - Simulate applying the patch
          const nextComponents = [];
          const nextWires = [];
          try {
            const result = calculateProjectPlanApplication(
              iterPlan, 
              currentDiagram.components, 
              currentDiagram.connections, 
              {} // PIN_DEFS
            );
            nextComponents.push(...result.components);
            nextWires.push(...result.wires);
          } catch(e) {
            console.error(e);
            break;
          }

          currentDiagram.components = nextComponents;
          currentDiagram.connections = nextWires;

          // 6. Re-validate
          const engineConnectionsFormat = nextWires.map(w => ({ from: w.from.replace(':', '.'), to: w.to.replace(':', '.') }));
          const validator = new FullCircuitValidator({ components: nextComponents, connections: engineConnectionsFormat });
          const isSafe = validator.runValidation({ profile: 'balanced' });

          if (isSafe || validator.errors.length === 0) {
            break;
          } else {
            // Re-assign for the next cycle
            currentViolations = validator.errors;
          }

          limit++;
        }
        
        self.postMessage({ 
          type: 'results', 
          payload: { planCount: totalSuggestions.length, suggestions: totalSuggestions, masterPlan: true } 
        });
      } catch (err) {
        console.error('[AutofixWorker] Rust execution error:', err);
        self.postMessage({ 
          type: 'status', 
          payload: 'ERROR: ' + (err instanceof Error ? err.message : String(err)) 
        });
        self.postMessage({ 
          type: 'results', 
          payload: { planCount: 0, suggestions: [] } 
        });
      }`;

const newContent = content.substring(0, content.indexOf("    case 'analyze':")) + targetMethod + content.substring(content.indexOf("break;", content.indexOf("case 'analyze':") + 50) + 6);
fs.writeFileSync('c:/Users/Danish/Documents/simulator/OpenHW-studio-frontend/src/worker/autofix.worker.ts', newContent);

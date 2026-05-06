import { robustSnapComponent } from './utils/autoSetup';

export function calculateProjectPlanApplication(plan, currentComponents, currentWires, pinDefs = {}) {
  if (!plan) return { components: currentComponents, wires: currentWires };
  
  // Use deep clone for safety to avoid accidental mutations of the current project state
  const nextComponents = JSON.parse(JSON.stringify(currentComponents));
  const nextWires = JSON.parse(JSON.stringify(currentWires));
  
  // 1. Add new components
  if (plan.addedComponents) {
    plan.addedComponents.forEach(ac => {
      if (!nextComponents.find(c => c.id === ac.id)) {
        // Determine default dimensions if not provided (Component Library fallbacks)
        const defW = ac.type === 'wokwi-resistor' ? 70 : (ac.type === 'wokwi-led' ? 72 : 40);
        const defH = ac.type === 'wokwi-resistor' ? 32 : (ac.type === 'wokwi-led' ? 44 : 20);
        
        const addedComp = {
          ...ac,
          isGhost: false,
          w: ac.w || defW,
          h: ac.h || defH,
          attrs: ac.attrs || {}
        };
        nextComponents.push(addedComp);

        // Apply robust snapping if pin definitions are available
        if (pinDefs && Object.keys(pinDefs).length > 0) {
          const { snappedWires } = robustSnapComponent(addedComp, nextComponents, pinDefs);
          if (snappedWires.length > 0) {
            nextWires.push(...snappedWires);
          }
        }
      }
    });
  }
  
  // 2. Add new wires (preserving pathing and custom routing)
  if (plan.addedWires) {
    plan.addedWires.forEach(aw => {
      nextWires.push({
        id: 'wire_' + Math.random().toString(36).substr(2, 9),
        // Standardize pin naming (ensure colons over dots for UI consistency)
        from: (aw.from || '').replace('.', ':'),
        to:   (aw.to   || '').replace('.', ':'),
        // Transition from "Ghost" colors to project colors if necessary
        color: (aw.color === '#38bdf8' || !aw.color) ? 'green' : aw.color,
        waypoints: [],
        path: null, // Disabling pre-calculated routing as requested to fix positioning errors
        isBelow: aw.isBelow || false
      });
    });
  }
  
  // 3. Remove wires (Logical removal by pin matching)
  let finalWires = nextWires;
  if (plan.removedWires && plan.removedWires.length > 0) {
    finalWires = nextWires.filter(w => {
      const isMatch = plan.removedWires.some(rw => {
         const f = (rw.from || '').replace('.', ':');
         const t = (rw.to || '').replace('.', ':');
         return (f === w.from && t === w.to) || (f === w.to && t === w.from);
      });
      return !isMatch;
    });
  }
  
  // 4. Apply transformations (Rotation, Flips, etc.)
  if (plan.transformations) {
    plan.transformations.forEach(trans => {
      const comp = nextComponents.find(c => c.id === trans.componentId);
      if (comp) {
        comp.rotation = trans.rotation; 
      }
    });
  }

  return { 
    components: nextComponents, 
    wires: finalWires 
  };
}

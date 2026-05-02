# Auto-Fix Engine Architecture

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER CLICKS "FIX" BUTTON                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                    ┌────────────────▼───────────────┐
                    │  SimulatorPage.applyFix()      │
                    │  (with verification loop)      │
                    └────────────────┬───────────────┘
                                     │
                    ┌────────────────▼───────────────────────────────────┐
                    │ 1. PATTERN MATCHING                                │
                    │    findApplicablePatterns(error)                   │
                    │    → Returns ranked patterns [0.92, 0.65, ...]     │
                    └────────────────┬───────────────────────────────────┘
                                     │
                    ┌────────────────▼───────────────────────────────────┐
                    │ 2. FIX APPLICATION                                 │
                    │    applyCircuitFix(projectData, error, pattern)    │
                    │    → Adds components & rewires connections         │
                    │    → Returns { components, connections, applied }  │
                    └────────────────┬───────────────────────────────────┘
                                     │
                    ┌────────────────▼───────────────────────────────────┐
                    │ 3. UPDATE UI                                       │
                    │    setComponents(result.components)                │
                    │    setWires(result.connections)                    │
                    │    validationRunCacheRef.current = {}              │
                    └────────────────┬───────────────────────────────────┘
                                     │
                    ┌────────────────▼───────────────────────────────────┐
                    │ 4. RECORD IN HISTORY                               │
                    │    fixHistory.recordFix({                          │
                    │      error, strategy, before, after                │
                    │    })                                              │
                    └────────────────┬───────────────────────────────────┘
                                     │
                    ┌────────────────▼───────────────────────────────────┐
                    │ 5. VERIFY FIX (NEW!)                               │
                    │    validator.runValidation(afterCircuit)           │
                    │    → Check if error is gone                        │
                    │    → Detect new errors introduced                  │
                    │    → Calculate confidence score                    │
                    └────────────────┬───────────────────────────────────┘
                                     │
                    ┌────────────────▼───────────────────────────────────┐
                    │ 6. SHOW FEEDBACK                                   │
                    │    ✅ "Fix successful! Error resolved."            │
                    │    ⚠️  "Original error fixed but added 2 warnings" │
                    │    ❌ "Fix did not resolve the error"              │
                    └────────────────┬───────────────────────────────────┘
                                     │
                    ┌────────────────▼───────────────────────────────────┐
                    │ 7. USER CAN UNDO/REDO                              │
                    │    undoLastFix() → Restores circuit to before fix  │
                    │    redoLastFix() → Reapplies fix                   │
                    │    jumpToFix(id) → Go to specific fix in timeline  │
                    └────────────────────────────────────────────────────┘
```

## Component Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    CIRCUIT FIX ENGINE                            │
└──────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    ┌─────────┐        ┌─────────────┐      ┌──────────┐
    │ PATTERN │        │ VALIDATOR   │      │ HISTORY  │
    │ CATALOG │        │ & VERIFIER  │      │ & UNDO   │
    └─────────┘        └─────────────┘      └──────────┘
         │                    │                    │
   20+ patterns          Verify fixes         Undo/Redo
   confidence           New errors           Snapshots
   prerequisites        Confidence score     Timeline
   complexity est.      Before/after         Rollback

┌──────────────────────────────────────────────────────────────────┐
│                  FIX PATTERNS (20+)                             │
├──────────────────────────────────────────────────────────────────┤
│ Power Management:                                                │
│ ├─ missing_ground_connection                                    │
│ ├─ missing_power_connection                                     │
│ ├─ power_supply_missing                                         │
│ ├─ decoupling_capacitor_missing                                 │
│ └─ bulk_capacitor_for_motor                                     │
│                                                                  │
│ Current Limiting:                                               │
│ ├─ led_series_resistor                                          │
│ ├─ voltage_divider_for_signal                                   │
│ └─ level_shifter_*                                              │
│                                                                  │
│ Motor Safety:                                                   │
│ ├─ motor_flywheel_diode                                         │
│ ├─ motor_gate_resistor                                          │
│ └─ motor_heatsink_suggestion                                    │
│                                                                  │
│ Communication:                                                  │
│ ├─ i2c_pull_up_resistors                                        │
│ ├─ i2c_address_conflict                                         │
│ ├─ spi_chip_select_resistor                                     │
│ └─ ds18b20_pull_up                                              │
│                                                                  │
│ Signal Conditioning:                                            │
│ ├─ button_debounce_capacitor                                    │
│ ├─ button_pull_down_resistor                                    │
│ └─ floating_input_pin                                           │
│                                                                  │
│ Component Orientation:                                          │
│ ├─ diode_polarity_flip                                          │
│ ├─ electrolytic_capacitor_polarity                              │
│ └─ led_polarity_flip                                            │
│                                                                  │
│ Connectivity:                                                   │
│ ├─ unconnected_component                                        │
│ └─ servo_power_capacitor                                        │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flow: Fix Verification Loop

```
┌─────────────────────────────────────────────────────────────────┐
│ BEFORE CIRCUIT                                                  │
│ ├─ components: [LED on GPIO, ...no resistor...]               │
│ ├─ connections: [GPIO4 → LED_anode, ...]                      │
│ └─ errors: [invalid_led_between_gpio_pins]                    │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼ (User clicks FIX)
┌─────────────────────────────────────────────────────────────────┐
│ FIX APPLIED                                                     │
│ ├─ Adds: resistor_220_1 (220Ω resistor)                       │
│ ├─ Rewires: GPIO4 → R1:1, R1:2 → LED_anode                   │
│ └─ New connections count: +2                                   │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼ (Clear cache)
┌─────────────────────────────────────────────────────────────────┐
│ VALIDATION CACHE CLEARED                                        │
│ ├─ validationRunCacheRef.current = {}                          │
│ └─ Forces full re-validation next run                          │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼ (Re-run validation)
┌─────────────────────────────────────────────────────────────────┐
│ AFTER CIRCUIT - RE-VALIDATED                                   │
│ ├─ components: [LED, Resistor_220, ...]                       │
│ ├─ connections: [GPIO4 → R1:1, R1:2 → LED_anode, ...]        │
│ └─ errors: [] (empty! fix successful!)                         │
└─────────────────────────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
    ┌─────────┐            ┌──────────┐
    │ SUCCESS │            │ NEW ISSUES?
    │ ✅ Fix  │            │ Confidence
    │ resolved│            │ score
    └─────────┘            └──────────┘
                               ▼
                    ┌──────────────────┐
                    │ Adjust message:  │
                    │ "Fixed but added │
                    │  2 warnings"     │
                    └──────────────────┘
```

## Confidence Scoring Formula

```
confidence = 1.0

IF error NOT fixed:
  confidence = 0.0
ELSE:
  // Deduct for new errors
  confidence -= (error_count × 0.25)    // Each error: -25%
  confidence -= (warn_count × 0.08)     // Each warning: -8%
  confidence -= (info_count × 0.02)     // Each info: -2%
  
  // Boost for reversible fixes
  IF remediation includes ["add", "wire", "connect"]:
    confidence += 0.05                  // Easy to undo: +5%
  
  // Clamp to [0.0, 1.0]
  confidence = Math.max(0, Math.min(1, confidence))

return confidence  // 0.0 = certain failure, 1.0 = perfect fix
```

## Undo/Redo Timeline Example

```
Original Circuit
    ↓
    +─── Fix 1: Added LED resistor (92% confidence)
    │    ✅ Verified: Error resolved, no new issues
    │
    +─── Fix 2: Added I2C pull-ups (96% confidence)
    │    ✅ Verified: Error resolved, no new issues
    │ 
    +─── Fix 3: Added motor flywheel diode (98% confidence)
    │    ⚠️  Verified: Error resolved, +1 warning
    │
    └─ (Current state)

User can:
  • Undo Fix 3     → Restores to after Fix 2
  • Undo Fixes 2,3 → Restores to after Fix 1
  • Redo Fix 3     → Re-applies flywheel diode
  • Jump to Fix 1  → Restores to after Fix 1
  • Revert All     → Back to Original Circuit
```

## Integration Points

```
┌──────────────────────────────────┐
│  WebUI (React)                   │
│  SimulatorPage.jsx               │
│  RightPanel.jsx                  │
└─────────────┬────────────────────┘
              │
              ├─ applyFix(error)           ← User clicks button
              ├─ undoFix()                 ← User clicks undo
              ├─ redoFix()                 ← User clicks redo
              └─ validation re-runs        ← Auto cache clear

┌──────────────────────────────────┐
│  CLI (circuit-validate.ts)       │
│  MCP (server.ts)                 │
└─────────────┬────────────────────┘
              │
              ├─ applyCircuitFix()         ← Programmatic
              ├─ getFixHistory()           ← Get history
              └─ verifyFix()               ← Verify changes

┌──────────────────────────────────────┐
│  Validation Engine (engine.js)       │
│  FullCircuitValidator                │
└─────────────┬──────────────────────┘
              │
              └─ runValidation()           ← Re-validate
                 (called after fix)
```


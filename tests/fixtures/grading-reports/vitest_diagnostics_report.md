# 🔬 OpenHW Autograding CI Diagnostic Report

*Generated: 7/8/2026, 11:48:36 AM*

---

## Summary

| Metric | Value |
|---|---|
| Total components tested | 2 |
| Components with issues | 2 |
| Failure ratio | 100% |
| Failure tier | **GLOBAL** |

> [!CAUTION]
> **GLOBAL ENGINE FAILURE** — Over 75% of components are failing. This is almost certainly a regression in the core simulation engine, not individual components. Suspect files: `grading-engine.worker.ts`, `simulation.worker.ts`, `execute.ts`.

## ⚠️ Component Failures

### ❌ uno_buzzer

| Score | Value |
|---|---|
| Overall | 95% |
| Spatial | 87% |
| Logic | 100% |
| Behavioral | 93% |
| Code | 100% |
| Verified Code | 97% |
| AI Semantic | 99% |

**Issues detected:**

- **[OVERALL_SCORE]** Score was 95% (expected 100%)
  - *Spatial: 87%, Logic: 100%, Behavioral: 93%, Code: 100%, Verified: 97%*
- **[TEMPORAL_PIN]** Mismatch on "pinstate:uno1:pintoggles" — 95.0% match
  - *Teacher: 342 events, Student: 335 events, Matched: 325*
- **[TEMPORAL_PIN]** Mismatch on "pinstate:buzzer_1:pintoggles" — 95.0% match
  - *Teacher: 342 events, Student: 335 events, Matched: 325*
- **[TEMPORAL_PIN]** Mismatch on "pinstate:buzzer_1:analogvoltages" — 89.7% match
  - *Teacher: 155 events, Student: 177 events, Matched: 139*
- **[TEMPORAL_PIN]** Mismatch on "pinstate:uno1:analogvoltages" — 89.7% match
  - *Teacher: 155 events, Student: 177 events, Matched: 139*
- **[TEMPORAL_COMPONENT]** Mismatch on "via_sig_buzzer_1_0" — 89.6% match
  - *Teacher: 853 events, Student: 907 events, Matched: 764*
- **[TEMPORAL_PIN]** Mismatch on "pinstate:via_sig_buzzer_1_0:pins" — 89.0% match
  - *Teacher: 155 events, Student: 177 events, Matched: 138*
- **[TEMPORAL_PIN]** Mismatch on "pinstate:via_sig_buzzer_1_0:analogvoltages" — 89.7% match
  - *Teacher: 155 events, Student: 177 events, Matched: 139*
- **[TEMPORAL_PIN]** Mismatch on "pinstate:buzzer_1:pins" — 89.0% match
  - *Teacher: 155 events, Student: 177 events, Matched: 138*
- **[TEMPORAL_PIN]** Mismatch on "pin:8" — 89.5% match
  - *Teacher: 153 events, Student: 175 events, Matched: 137*
- **[TEMPORAL_PIN]** Mismatch on "pinstate:via_sig_buzzer_1_0:pintoggles" — 95.0% match
  - *Teacher: 342 events, Student: 335 events, Matched: 325*
- **[TEMPORAL_PIN]** Mismatch on "pinstate:uno1:pins" — 89.7% match
  - *Teacher: 155 events, Student: 177 events, Matched: 139*
- **[TEMPORAL_COMPONENT]** Mismatch on "buzzer_1" — 91.9% match
  - *Teacher: 1462 events, Student: 1418 events, Matched: 1344*
- **[FEEDBACK_ERRORS]** 2 critical feedback items found
  - *Spatial Error: 1 overlapping component sets detected. | Spatial Error: via_SIG_buzzer_1_0 is floating! Pins must be snapped to breadboard holes.*

**📁 Source files to investigate:**

- Emulator component: `openhw-studio-emulator\src\components\openhw-buzzer/logic.ts`
- Emulator validation: `openhw-studio-emulator\src\components\openhw-buzzer/validation.ts`
- Board runner: `OpenHW-studio-frontend\src\worker\runners\avr-runner.ts`
- Core engine: `OpenHW-studio-frontend\src\worker\grading-engine.worker.ts`
- Core engine: `OpenHW-studio-frontend\src\worker\simulation.worker.ts`
- Core engine: `OpenHW-studio-frontend\src\worker\execute.ts`
- Core engine: `OpenHW-studio-frontend\src\worker\ai-audit-final.worker.ts`

**🔍 Probable culprit code lines:**

**`OpenHW-studio-frontend\src\worker\grading-engine.worker.ts` — Line 188**
> *Keyword match: "uno1"*

```typescript
 186:         const boardComp = (meta.components || []).find((c: any) => /(arduino|esp32|stm32|rp2040|pico)/i.test(String(c.type || '')));
 187:         
 188:         const boardCompId = boardComp?.id || 'uno1';
 189:         const boardType = boardComp?.type || meta.board || 'openhw-arduino-uno';
 190:         const isRp2040Board = /rp2040|pico/i.test(String(boardType));
```

**`OpenHW-studio-frontend\src\worker\grading-engine.worker.ts` — Line 188**
> *Keyword match: "uno1"*

```typescript
 186:         const boardComp = (meta.components || []).find((c: any) => /(arduino|esp32|stm32|rp2040|pico)/i.test(String(c.type || '')));
 187:         
 188:         const boardCompId = boardComp?.id || 'uno1';
 189:         const boardType = boardComp?.type || meta.board || 'openhw-arduino-uno';
 190:         const isRp2040Board = /rp2040|pico/i.test(String(boardType));
```

**`OpenHW-studio-frontend\src\worker\grading-engine.worker.ts` — Line 188**
> *Keyword match: "uno1"*

```typescript
 186:         const boardComp = (meta.components || []).find((c: any) => /(arduino|esp32|stm32|rp2040|pico)/i.test(String(c.type || '')));
 187:         
 188:         const boardCompId = boardComp?.id || 'uno1';
 189:         const boardType = boardComp?.type || meta.board || 'openhw-arduino-uno';
 190:         const isRp2040Board = /rp2040|pico/i.test(String(boardType));
```

---

### ❌ uno_led

| Score | Value |
|---|---|
| Overall | 94% |
| Spatial | 75% |
| Logic | 100% |
| Behavioral | 96% |
| Code | 100% |
| Verified Code | 100% |
| AI Semantic | 100% |

**Issues detected:**

- **[OVERALL_SCORE]** Score was 94% (expected 100%)
  - *Spatial: 75%, Logic: 100%, Behavioral: 96%, Code: 100%, Verified: 100%*
- **[TEMPORAL_COMPONENT]** Mismatch on "led_1" — 89.5% match
  - *Teacher: 95 events, Student: 95 events, Matched: 85*
- **[FEEDBACK_ERRORS]** 3 critical feedback items found
  - *Spatial Error: 2 overlapping component sets detected. | Spatial Error: led_1 is floating! Pins must be snapped to breadboard holes. | Spatial Error: via_A_led_1_0 is floating! Pins must be snapped to breadboard holes.*

**📁 Source files to investigate:**

- Emulator component: `openhw-studio-emulator\src\components\openhw-led/logic.ts`
- Emulator validation: `openhw-studio-emulator\src\components\openhw-led/validation.ts`
- Board runner: `OpenHW-studio-frontend\src\worker\runners\avr-runner.ts`
- Core engine: `OpenHW-studio-frontend\src\worker\grading-engine.worker.ts`
- Core engine: `OpenHW-studio-frontend\src\worker\simulation.worker.ts`
- Core engine: `OpenHW-studio-frontend\src\worker\execute.ts`
- Core engine: `OpenHW-studio-frontend\src\worker\ai-audit-final.worker.ts`

*No code suspects found via keyword scan.*

---


*Report generated by OpenHW CI Diagnostic Analyzer — Vitest*

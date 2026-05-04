# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: export-smoke.spec.ts >> PNG export smoke: measures export duration and caching effect
- Location: e2e\export-smoke.spec.ts:5:1

# Error details

```
TimeoutError: page.waitForSelector: Timeout 60000ms exceeded.
Call log:
  - waiting for locator('header') to be visible

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - navigation [ref=e4]:
    - img "OpenHW-Studio" [ref=e6] [cursor=pointer]
    - generic [ref=e7]:
      - button "☀️ Light" [ref=e8] [cursor=pointer]
      - button "Sign In" [ref=e9] [cursor=pointer]
      - button "Get Started" [ref=e10] [cursor=pointer]
  - generic [ref=e11]:
    - generic [ref=e12]: 🚀 Open Source Hardware Simulation Platform
    - heading "Build. Simulate. Learn Electronics." [level=1] [ref=e13]:
      - text: Build. Simulate.
      - text: Learn Electronics.
    - paragraph [ref=e14]: A browser-based embedded systems simulator with gamified learning, classroom tools, and real hardware emulation. No hardware needed.
    - generic [ref=e15]:
      - button "▶ Try Simulator" [ref=e16] [cursor=pointer]
      - button "Join as Student / Teacher" [ref=e17] [cursor=pointer]
    - paragraph [ref=e18]: "⚠️ Guest mode: No cloud save · No progress tracking · No assignments"
    - generic [ref=e19]:
      - generic [ref=e20]: Arduino Uno
      - generic [ref=e21]: Raspberry Pi Pico
      - generic [ref=e22]: ESP32
      - generic [ref=e23]: STM32 — Coming Soon
  - generic [ref=e24]:
    - heading "Everything you need to learn embedded systems" [level=2] [ref=e25]
    - generic [ref=e26]:
      - generic [ref=e27]:
        - generic [ref=e28]: 🖥️
        - heading "Real-Time Simulation" [level=3] [ref=e29]
        - paragraph [ref=e30]: Instruction-level Arduino & Pico emulation directly in your browser. No plugins.
      - generic [ref=e31]:
        - generic [ref=e32]: 🏫
        - heading "Classroom Mode" [level=3] [ref=e33]
        - paragraph [ref=e34]: Teachers create classes, push templates, lock screens, and grade submissions live.
      - generic [ref=e35]:
        - generic [ref=e36]: 🧩
        - heading "Block + Code Editor" [level=3] [ref=e37]
        - paragraph [ref=e38]: Start with visual blocks, graduate to full C++ code. Switch modes any time.
      - generic [ref=e39]:
        - generic [ref=e40]: ⚡
        - heading "Smart Auto-Assist" [level=3] [ref=e41]
        - paragraph [ref=e42]: Drop an LED and get a resistor added automatically. Context-aware circuit help.
      - generic [ref=e43]:
        - generic [ref=e44]: 📊
        - heading "Serial Tools" [level=3] [ref=e45]
        - paragraph [ref=e46]: Real-time serial monitor and plotter for debugging and sensor visualization.
  - generic [ref=e47]:
    - heading "Start with guided projects" [level=2] [ref=e48]
    - paragraph [ref=e49]: Explore pre-built circuits and code — no login required
    - generic [ref=e50]:
      - generic [ref=e51] [cursor=pointer]:
        - generic [ref=e52]: 💡
        - heading "LED Blink" [level=3] [ref=e53]
        - paragraph [ref=e54]: Arduino Uno
        - generic [ref=e55]:
          - generic [ref=e56]: Beginner
          - generic [ref=e57]: +100 XP
      - generic [ref=e58] [cursor=pointer]:
        - generic [ref=e59]: 🌈
        - heading "RGB LED" [level=3] [ref=e60]
        - paragraph [ref=e61]: Arduino Uno
        - generic [ref=e62]:
          - generic [ref=e63]: Beginner
          - generic [ref=e64]: +150 XP
      - generic [ref=e65] [cursor=pointer]:
        - generic [ref=e66]: 🔊
        - heading "Buzzer" [level=3] [ref=e67]
        - paragraph [ref=e68]: Arduino Uno
        - generic [ref=e69]:
          - generic [ref=e70]: Beginner
          - generic [ref=e71]: +150 XP
      - generic [ref=e72] [cursor=pointer]:
        - generic [ref=e73]: 🎛️
        - heading "Potentiometer" [level=3] [ref=e74]
        - paragraph [ref=e75]: Arduino Uno
        - generic [ref=e76]:
          - generic [ref=e77]: Beginner
          - generic [ref=e78]: +175 XP
      - generic [ref=e79] [cursor=pointer]:
        - generic [ref=e80]: 🔘
        - heading "Button & Debounce" [level=3] [ref=e81]
        - paragraph [ref=e82]: Arduino Uno
        - generic [ref=e83]:
          - generic [ref=e84]: Beginner
          - generic [ref=e85]: +200 XP
      - generic [ref=e86] [cursor=pointer]:
        - generic [ref=e87]: 🌡️
        - heading "Temperature Sensor" [level=3] [ref=e88]
        - paragraph [ref=e89]: Arduino Uno
        - generic [ref=e90]:
          - generic [ref=e91]: Intermediate
          - generic [ref=e92]: +250 XP
  - generic [ref=e93]:
    - heading "Ready to start building?" [level=2] [ref=e94]
    - paragraph [ref=e95]: Join as a student to track progress, or as a teacher to manage your class.
    - generic [ref=e96]:
      - generic [ref=e97] [cursor=pointer]:
        - generic [ref=e98]: 🎓
        - heading "I'm a Student" [level=3] [ref=e99]
        - paragraph [ref=e100]: Join classes, submit assignments, earn rewards
        - button "Join as Student →" [ref=e101]
      - generic [ref=e102] [cursor=pointer]:
        - generic [ref=e103]: 👨‍🏫
        - heading "I'm a Teacher" [level=3] [ref=e104]
        - paragraph [ref=e105]: Create classes, assign projects, monitor students
        - button "Join as Teacher →" [ref=e106]
  - contentinfo [ref=e107]:
    - img "OpenHW-Studio" [ref=e109]
    - paragraph [ref=e110]: Open Source Hardware Simulation & Learning Platform
    - generic [ref=e111]:
      - link "GitHub" [ref=e112] [cursor=pointer]:
        - /url: "#"
      - link "Documentation" [ref=e113] [cursor=pointer]:
        - /url: "#"
      - link "Examples" [ref=e114] [cursor=pointer]:
        - /url: "#"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.setTimeout(120000);
  4  | 
  5  | test('PNG export smoke: measures export duration and caching effect', async ({ page, context }) => {
  6  |   // Navigate to app root and wait for network idle
  7  |   await page.goto('/', { waitUntil: 'networkidle' });
  8  | 
  9  |   // Wait for the app header so we know the shell rendered
> 10 |   await page.waitForSelector('header', { timeout: 60000 });
     |              ^ TimeoutError: page.waitForSelector: Timeout 60000ms exceeded.
  11 | 
  12 |   // Use a header-scoped locator for menu interactions (more robust than global text())
  13 |   const header = page.locator('header');
  14 |   const toolBtn = header.locator('text=Tool');
  15 |   await toolBtn.waitFor({ state: 'visible', timeout: 60000 });
  16 |   await toolBtn.click();
  17 | 
  18 |   const exportBtn = header.locator('text=Export');
  19 |   await exportBtn.waitFor({ state: 'visible', timeout: 30000 });
  20 |   await exportBtn.click();
  21 | 
  22 |   // First export
  23 |   const t0 = Date.now();
  24 |   const [dl1] = await Promise.all([
  25 |     page.waitForEvent('download'),
  26 |     page.click('text=PNG'),
  27 |   ]);
  28 |   const firstDuration = Date.now() - t0;
  29 |   // Save to artifact for inspection (optional)
  30 |   const firstName = dl1.suggestedFilename();
  31 |   await dl1.saveAs(`./export-smoke-first-${firstName}`);
  32 | 
  33 |   // Wait a short moment for caches to settle
  34 |   await page.waitForTimeout(200);
  35 |   // Trigger second export (should be cached and faster) using same scoped locators
  36 |   await toolBtn.waitFor({ state: 'visible', timeout: 30000 });
  37 |   await toolBtn.click();
  38 |   await exportBtn.waitFor({ state: 'visible', timeout: 30000 });
  39 |   await exportBtn.click();
  40 |   const t1 = Date.now();
  41 |   const [dl2] = await Promise.all([
  42 |     page.waitForEvent('download'),
  43 |     page.click('text=PNG'),
  44 |   ]);
  45 |   const secondDuration = Date.now() - t1;
  46 |   const secondName = dl2.suggestedFilename();
  47 |   await dl2.saveAs(`./export-smoke-second-${secondName}`);
  48 | 
  49 |   // Log timings to test output
  50 |   console.log(`first export: ${firstDuration} ms`);
  51 |   console.log(`second export: ${secondDuration} ms`);
  52 | 
  53 |   // Basic expectation: second export should be faster than first (cache hit)
  54 |   try {
  55 |     expect(secondDuration).toBeLessThan(firstDuration);
  56 |   } catch (err) {
  57 |     console.warn('Export caching did not show speedup: ', { firstDuration, secondDuration });
  58 |     // Still allow test to pass but surface timings
  59 |   }
  60 | });
  61 | 
```
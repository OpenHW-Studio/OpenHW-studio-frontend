import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';
import { buildCompileRequestHash } from './utils/hash-utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.resolve(__dirname, '..', 'fixtures', 'binary-cache');
const REGISTRY_PATH = path.join(CACHE_DIR, 'hashes.json');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Ensure registry exists
if (!fs.existsSync(REGISTRY_PATH)) {
  fs.writeFileSync(REGISTRY_PATH, '{}', 'utf8');
}

const CASES_PATH = path.join(__dirname, '..', 'fixtures', 'matrix-cases.json');
let MATRIX = [];
if (fs.existsSync(CASES_PATH)) {
  MATRIX = JSON.parse(fs.readFileSync(CASES_PATH, 'utf8'));
} else {
  console.warn(`[Matrix Test] Warning: No matrix-cases.json found at ${CASES_PATH}`);
}

const COMPILER_OVERRIDE_URL = null; // e.g., 'https://api.openhw.org/compile'

test.describe.configure({ mode: 'serial' });

test.describe('Hardware Compatibility Matrix - Phase 1', () => {
  test.setTimeout(900000); // 15 minutes for the entire matrix batch

  test('Run all matrix cases in a single browser context', async ({ page }) => {
    let hashesRegistry: Record<string, string> = {};
    try {
      hashesRegistry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    } catch {
      hashesRegistry = {};
    }

    let activeKey = 'unknown';
    let isFirstMatrixRun = true;

    // 1. Intercept Compile requests to use local cache
    await page.route('**/compile', async (route) => {
      if (route.request().method() !== 'POST') {
        return route.continue();
      }

      const postData = route.request().postData();
      const payload = JSON.parse(postData || '{}');
      const requestHash = buildCompileRequestHash(payload);
      const binaryPath = path.join(CACHE_DIR, `${activeKey}.hex`);

      // Check if we have a valid cache hit
      if (hashesRegistry[activeKey] === requestHash && fs.existsSync(binaryPath)) {
        console.log(`[Matrix Cache] 🟢 Cache HIT for ${activeKey}. Returning mock compile response.`);
        const cachedBinary = fs.readFileSync(binaryPath, 'utf8');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            hex: cachedBinary,
            artifactType: 'hex',
            stdout: 'Mocked Compile Cache Hit',
          }),
        });
      } else {
        console.log(`[Matrix Cache] 🔴 Cache MISS for ${activeKey}. Routing compile request to server.`);
        
        const fetchOptions = COMPILER_OVERRIDE_URL ? { url: COMPILER_OVERRIDE_URL } : undefined;
        const response = await route.fetch(fetchOptions);
        const json = await response.json();

        if (json && json.hex) {
          console.log(`[Matrix Cache] 💾 Saving new compile artifact for ${activeKey}`);
          fs.writeFileSync(binaryPath, json.hex, 'utf8');
          hashesRegistry[activeKey] = requestHash;
          fs.writeFileSync(REGISTRY_PATH, JSON.stringify(hashesRegistry, null, 2), 'utf8');
        }

        await route.fulfill({
          response,
          json,
        });
      }
    });

    // 2. Initialize Simulator Page
    await test.step('Initialize page & Disable Tour', async () => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('main', { timeout: 60000 });
      
      // Auto-accept any confirm dialogues globally (for canvas clearing)
      page.on('dialog', async dialog => {
        await dialog.accept();
      });
    });

    // 3. Enable Auto-Wiring and Auto-Coding ONCE
    await test.step('Enable Auto-Wiring & Auto-Coding', async () => {
      await page.locator('text=Help').click();
      await page.locator('text=Assist').hover();
      const autoWireBtn = page.locator('text=/Auto-Wiring: (ON|OFF)/');
      if ((await autoWireBtn.innerText()).includes('OFF')) {
        await autoWireBtn.click();
      }

      await page.locator('text=Help').click();
      await page.locator('text=Assist').hover();
      const autoCodeBtn = page.locator('text=/Auto-Coding: (ON|OFF)/');
      if ((await autoCodeBtn.innerText()).includes('OFF')) {
        await autoCodeBtn.click();
      }
    });

    page.on('console', msg => {
      const text = msg.text();
      // Filter out noisy physics solver logs for cleaner output
      if (!text.includes('[PhysicsSolve]')) {
        console.log(`[Browser] ${text}`);
      }
    });

    // 4. Loop through every matrix case using the SAME page context
    for (const caseItem of MATRIX) {
      activeKey = caseItem.key;
      console.log(`\n===========================================`);
      console.log(`🚀 Starting Test: ${caseItem.board} + ${caseItem.component}`);
      console.log(`===========================================\n`);

      // Clear Canvas
      await test.step(`[${activeKey}] Clear Canvas`, async () => {
        await page.keyboard.press('Control+Shift+Delete');
        await page.waitForTimeout(1000); // Wait for canvas to clear
      });

      // Spawn Board
      await test.step(`[${activeKey}] Spawn Board: ${caseItem.board}`, async () => {
        await page.evaluate(() => {
          const ev = new CustomEvent('quick-add-open', {
            detail: { screenX: window.innerWidth / 2, screenY: window.innerHeight / 2, canvasX: 400, canvasY: 300 }
          });
          window.dispatchEvent(ev);
        });

        const quickAddInput = page.locator('input[data-quickadd="true"]');
        await quickAddInput.waitFor({ state: 'visible', timeout: 5000 });
        await quickAddInput.fill(caseItem.board);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000); // let board render
      });

      // Spawn Component and trigger Autowire
      await test.step(`[${activeKey}] Spawn Component: ${caseItem.component}`, async () => {
        await page.waitForTimeout(1000);
        await page.evaluate(() => {
          const ev = new CustomEvent('quick-add-open', {
            detail: { screenX: window.innerWidth / 3, screenY: window.innerHeight / 3, canvasX: 200, canvasY: 150 }
          });
          window.dispatchEvent(ev);
        });

        const quickAddInput = page.locator('input[data-quickadd="true"]');
        await quickAddInput.waitFor({ state: 'visible', timeout: 5000 });
        await quickAddInput.fill(caseItem.component);
        await page.keyboard.press('Enter');
        
        if (isFirstMatrixRun) {
          console.log('[Matrix Test] First run detected: waiting 6s for autowire worker to cold start...');
          await page.waitForTimeout(6000);
          isFirstMatrixRun = false;
        } else {
          await page.waitForTimeout(2000); // wait for autowiring and autocoding background tasks to complete
        }
      });

      // Compile and run Simulation
      await test.step(`[${activeKey}] Run Simulation`, async () => {
        const responsePromise = page.waitForResponse('**/compile', { timeout: 45000 });
        
        await page.keyboard.press('Control+Enter');
        
        console.log(`[Matrix Test] Awaiting compile completion for ${caseItem.key}...`);
        await responsePromise;
        
        console.log(`[Matrix Test] Running simulation for ${caseItem.key} (5s)...`);
        await page.waitForTimeout(5000);

        // Stop simulation
        await page.keyboard.press('Control+Enter');
        await page.waitForTimeout(500);
      });

      // Export PNG for visual verification
      await test.step(`[${activeKey}] Export PNG`, async () => {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 30000 }),
          page.keyboard.press('Alt+P') // Use the new shortcut instead of mouse hovers!
        ]);
        
        const pngPath = path.join(CACHE_DIR, `${caseItem.key}.png`);
        await download.saveAs(pngPath);
        console.log(`[Matrix Test] 📸 Exported PNG to ${pngPath}`);
      });
    }
  });
});

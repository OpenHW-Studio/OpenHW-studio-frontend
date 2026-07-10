import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Core Simulator Workflow', () => {
  test.setTimeout(120000);

  test('User journey: Import, Verify Pixels, Add Component, Export JSON, Verify JSON', async ({ page }) => {
    
    await test.step('1. Initialize Simulator', async () => {
      // Disable the welcome tour so it doesn't intercept pointer events
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('main', { timeout: 60000 });
    });

    const fixturePath = path.join(__dirname, 'fixtures', 'baseline-circuit.png');
    
    await test.step('2. Import a Baseline PNG', async () => {
      const fileBtn = page.getByRole('button', { name: 'File', exact: true });
      await fileBtn.waitFor({ state: 'visible', timeout: 30000 });
      await fileBtn.click();

      const fileChooserPromise = page.waitForEvent('filechooser');
      const importBtn = page.locator('text=Import').first();
      await importBtn.waitFor({ state: 'visible', timeout: 5000 });
      await importBtn.click();
      
      const fileChooser = await fileChooserPromise;
      if (fs.existsSync(fixturePath)) {
        await fileChooser.setFiles(fixturePath);
      } else {
        throw new Error(`Baseline PNG not found at ${fixturePath}. Cannot proceed.`);
      }
      
      await page.waitForTimeout(1000); // let canvas render
    });

    let firstPngPath = '';
    await test.step('3. Export PNG (Untouched)', async () => {
      const fileBtn = page.getByRole('button', { name: 'File', exact: true });
      await fileBtn.click();
      
      const exportBtn = page.locator('text=Export').first();
      await exportBtn.waitFor({ state: 'visible', timeout: 5000 });
      await exportBtn.hover();
      
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        page.locator('text=PNG').first().click(),
      ]);
      
      const fileName = download.suggestedFilename();
      firstPngPath = path.join(__dirname, `test-export-${fileName}`);
      await download.saveAs(firstPngPath);
    });

    await test.step('4. Visual Pixel-to-Pixel Verification', async () => {
      expect(fs.existsSync(firstPngPath)).toBeTruthy();
      const downloadedImage = fs.readFileSync(firstPngPath);
      
      // OpenHW Studio appends JSON steganography to the end of the PNG (after the IEND chunk).
      // Playwright's image parser crashes if it sees trailing data.
      // Solution: We find the 'IEND' chunk and slice the buffer to remove the JSON payload in-memory!
      const iendIdx = downloadedImage.indexOf(Buffer.from('IEND'));
      let standardPngBuffer = downloadedImage;
      if (iendIdx !== -1) {
        // IEND is 4 bytes, followed by a 4-byte CRC. Total = 8 bytes after the 'I' in 'IEND'.
        standardPngBuffer = downloadedImage.subarray(0, iendIdx + 8);
      }
      
      // Now Playwright can pixel-match it perfectly against your baseline!
      expect(standardPngBuffer).toMatchSnapshot('expected-circuit.png', { maxDiffPixels: 200 });
      
      fs.unlinkSync(firstPngPath);
    });

    await test.step('5. Add an LED via Quick Add', async () => {
      const mainArea = page.locator('main').first();
      // Click at an offset so we don't accidentally click on the imported board
      await mainArea.dblclick({ position: { x: 50, y: 50 } });
      
      const quickAddInput = page.locator('input[data-quickadd="true"]');
      await quickAddInput.waitFor({ state: 'visible', timeout: 5000 });
      await quickAddInput.fill('LED');
      await page.keyboard.press('Enter');
      
      await page.waitForTimeout(500); // let component spawn
    });

    let jsonExportPath = '';
    await test.step('6. Export as JSON', async () => {
      const fileBtn = page.getByRole('button', { name: 'File', exact: true });
      await fileBtn.click();
      
      const exportBtn = page.locator('text=Export').first();
      await exportBtn.waitFor({ state: 'visible', timeout: 5000 });
      await exportBtn.hover();
      
      // Click 'JSON'
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        page.locator('text=JSON').first().click(),
      ]);
      
      const fileName = download.suggestedFilename();
      jsonExportPath = path.join(__dirname, `test-export-${fileName}`);
      await download.saveAs(jsonExportPath);
    });

    await test.step('7. Verify JSON Metadata for new Component', async () => {
      expect(fs.existsSync(jsonExportPath)).toBeTruthy();
      
      const rawData = fs.readFileSync(jsonExportPath, 'utf-8');
      const circuitData = JSON.parse(rawData);
      
      // Verify that an LED exists in the components array
      const hasLED = circuitData.components.some((c: any) => c.type.toLowerCase().includes('led'));
      expect(hasLED).toBeTruthy();
      
      fs.unlinkSync(jsonExportPath);
    });
  });
});

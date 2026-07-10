import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { buildCompileRequestHash } from './utils/hash-utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.resolve(__dirname, '..', 'fixtures', 'binary-cache');
const REGISTRY_PATH = path.join(CACHE_DIR, 'hashes.json');
const REPORTS_DIR = path.resolve(__dirname, '..', 'fixtures', 'grading-reports');

// Ensure directories exist
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

// Ensure registry exists
if (!fs.existsSync(REGISTRY_PATH)) {
  fs.writeFileSync(REGISTRY_PATH, '{}', 'utf8');
}

const CASES_PATH = path.join(__dirname, '..', 'fixtures', 'matrix-cases.json');

let MATRIX = [];
if (fs.existsSync(CASES_PATH)) {
  MATRIX = JSON.parse(fs.readFileSync(CASES_PATH, 'utf8'));
  // Temporary filter for demo purposes
  MATRIX = MATRIX.filter(caseItem => caseItem.key === 'uno_led' || caseItem.key === 'uno_buzzer');
} else {
  console.warn(`[Grading Matrix Test] Warning: No matrix-cases.json found at ${CASES_PATH}`);
}

const COMPILER_OVERRIDE_URL = null; // e.g., 'https://api.openhw.org/compile'

test.describe.configure({ mode: 'serial' });

test.describe('Grading Matrix - Phase 2', () => {
  test.setTimeout(900000); // 15 minutes for the entire matrix batch

  test('Run all grading comparisons in a single browser context', async ({ page }) => {
    // Navigate to Grading Page
    await page.goto('/grade', { waitUntil: 'domcontentloaded' });
    
    // Auto-accept any confirm dialogues globally
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    page.on('console', msg => {
      const text = msg.text();
      if (!text.includes('[PhysicsSolve]')) {
        console.log(`[Browser] ${text}`);
      }
    });

    const isGenRef = process.env.GENREF === '1' || process.env.GENREF === 'true';
    if (isGenRef) {
      console.log(`[Grading Matrix Test] 🛠️ GENREF Mode: Generating reference binaries.`);
    } else {
      console.log(`[Grading Matrix Test] ⚖️ COMPARE Mode: Running simulation comparisons.`);
    }

    const resultsSummary: any[] = [];
    let hashesRegistry: Record<string, string> = {};
    try {
      hashesRegistry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    } catch {
      hashesRegistry = {};
    }

    let activeKey = 'unknown';

    // Intercept AI model requests and feed directly from disk to bypass network/cache overhead
    await page.route('**/models/Xenova/**', async (route) => {
      const requestUrl = new URL(route.request().url());
      // Reconstruct local path by removing the leading slash from pathname
      const modelDiskPath = path.resolve(__dirname, '..', '..', 'public', requestUrl.pathname.slice(1));
      if (fs.existsSync(modelDiskPath)) {
        await route.fulfill({ path: modelDiskPath });
      } else {
        await route.continue();
      }
    });

    // Intercept Compile requests to use local cache
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
        console.log(`[Grading Matrix Cache] 🟢 Cache HIT for ${activeKey}. Returning mock compile response.`);
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
        console.log(`[Grading Matrix Cache] 🔴 Cache MISS for ${activeKey}. Routing compile request to server.`);
        
        const fetchOptions = COMPILER_OVERRIDE_URL ? { url: COMPILER_OVERRIDE_URL } : undefined;
        const response = await route.fetch(fetchOptions);
        const json = await response.json();

        if (json && json.hex) {
          console.log(`[Grading Matrix Cache] 💾 Saving new compile artifact for ${activeKey}`);
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

    for (const caseItem of MATRIX) {
      activeKey = caseItem.key;
      console.log(`\n===========================================`);
      console.log(`${isGenRef ? '🛠️ Generating' : '⚖️ Grading'}: ${caseItem.board} + ${caseItem.component}`);
      console.log(`===========================================\n`);

      const pngPath = path.join(CACHE_DIR, `${activeKey}.png`);
      const binPath = path.join(CACHE_DIR, `${activeKey}.bin`);

      if (!fs.existsSync(pngPath)) {
        console.warn(`[Grading Matrix Test] ⚠️ Missing PNG for ${activeKey}. Skipping.`);
        continue;
      }

      if (isGenRef) {
        // Upload Teacher PNG for Generation
        await test.step(`[${activeKey}] Upload Teacher Reference PNG`, async () => {
          const teacherInput = page.locator('input[accept="image/png,.bin"]');
          await teacherInput.setInputFiles(pngPath);
          await page.waitForTimeout(500);
        });

        // Trigger Generation
        await test.step(`[${activeKey}] Generate Reference Key`, async () => {
          const genBtn = page.locator('button.key-action-btn:has-text("Generate Reference Key")');
          await genBtn.click();
        });

        // Wait for and Download BIN
        await test.step(`[${activeKey}] Download Reference BIN`, async () => {
          const downloadLink = page.locator('a.grade-btn:has-text("Download")');
          await downloadLink.waitFor({ state: 'visible', timeout: 90000 });
          
          const [ download ] = await Promise.all([
            page.waitForEvent('download', { timeout: 90000 }),
            downloadLink.click()
          ]);
          
          await download.saveAs(binPath);
          console.log(`[Grading Matrix Test] ✅ Generated ${activeKey}.bin`);
        });

      } else {
        if (!fs.existsSync(binPath)) {
          console.warn(`[Grading Matrix Test] ⚠️ Missing BIN for ${activeKey}. Skipping. Run with GENREF=1 first.`);
          continue;
        }

        // Upload Teacher BIN
        await test.step(`[${activeKey}] Upload Teacher Reference BIN`, async () => {
          const teacherInput = page.locator('input[accept="image/png,.bin"]');
          await teacherInput.setInputFiles(binPath);
          await page.waitForTimeout(500);
        });

        // Upload Student PNG
        await test.step(`[${activeKey}] Upload Student Work PNG`, async () => {
          const studentInput = page.locator('input[accept="image/png"]');
          await studentInput.setInputFiles(pngPath);
          await page.waitForTimeout(500);
        });

        // Trigger Comparison
        await test.step(`[${activeKey}] Compare Circuits`, async () => {
          const compareBtn = page.locator('button.grade-action-btn:has-text("Compare Circuits")');
          await compareBtn.click();
        });

        // Wait for Grading Report
        await test.step(`[${activeKey}] Wait for Grading Report`, async () => {
          const reportContainer = page.locator('.report-container');
          await reportContainer.waitFor({ state: 'visible', timeout: 90000 });

          // Extract and log the Total Score
          const totalScoreElement = page.locator('.stat-box:has-text("Total Score") .val');
          const scoreText = await totalScoreElement.innerText();
          console.log(`[Grading Matrix Test] ✅ Completed ${activeKey}. Total Score: ${scoreText}`);
          
          // Assert the score is >= 90% (due to minor timing drifts in wall-clock simulation)
          const numericScore = parseInt(scoreText.replace('%', '').trim(), 10);
          expect(numericScore).toBeGreaterThanOrEqual(90);
        });

        // Wait for AI Semantic Auditor to finish (first run may take minutes to download the ONNX model)
        await test.step(`[${activeKey}] Wait for AI Semantic Auditor`, async () => {
          const aiLog = page.locator('.log-entry.success:has-text("AI Semantic Score generated")');
          await aiLog.waitFor({ state: 'visible', timeout: 180000 }); // 3 minute timeout for model download
          console.log(`[Grading Matrix Test] 🤖 AI Semantic Auditor completed for ${activeKey}. Waiting 3s to ensure bundle is populated.`);
          
          // Wait 3 seconds as requested to ensure React state and UI are completely updated with AI results
          await page.waitForTimeout(3000);
        });

        // Export HTML Report Snippet
        await test.step(`[${activeKey}] Export HTML Report`, async () => {
          const reportHtml = await page.locator('.report-container').innerHTML();
          const wrappedHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Report ${activeKey}</title><style>body{background:#020617;color:white;font-family:sans-serif;} .stat-box{background:#1e293b;padding:10px;margin:5px;border-radius:5px;display:inline-block;} .val{font-size:24px;font-weight:bold;display:block;} .label{font-size:12px;color:#94a3b8;}</style></head><body><div class="report-container">${reportHtml}</div></body></html>`;
          fs.writeFileSync(path.join(REPORTS_DIR, `${activeKey}_report.html`), wrappedHtml, 'utf8');
        });

        // Download Diagnostic Bundle
        await test.step(`[${activeKey}] Download Diagnostic Bundle`, async () => {
          const downloadBtn = page.locator('button:has-text("Download Full Diagnostic Bundle")');
          const [ download ] = await Promise.all([
            page.waitForEvent('download', { timeout: 30000 }),
            downloadBtn.click()
          ]);
          
          const bundlePath = path.join(REPORTS_DIR, `${activeKey}_bundle.json`);
          await download.saveAs(bundlePath);
          
          // Parse bundle for stats
          const bundleData = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
          const r = bundleData.grading_report || {};
          resultsSummary.push({
            key: activeKey,
            board: caseItem.board,
            component: caseItem.component,
            score: r.score || 0,
            spatial_score: r.spatial_score || 0,
            code_score: r.code_score || 0,
            verified_code_score: r.verified_code_score || 0,
            behavioral_score: r.behavioral_score || 0,
            ai_score: r.ai_score || 0
          });
        });
      }

      // Small delay before next case
      await page.waitForTimeout(1000);
      
      // Reload page to reset grading state
      await page.goto('/grade', { waitUntil: 'domcontentloaded' });
    }

    if (!isGenRef && resultsSummary.length > 0) {
      // Generate Final Summary HTML
      const avgScore = Math.round(resultsSummary.reduce((sum, r) => sum + r.score, 0) / resultsSummary.length);
      
      const htmlRows = resultsSummary.map(r => `
        <tr>
          <td>${r.board} + ${r.component}</td>
          <td><strong>${r.score}%</strong></td>
          <td>${r.spatial_score}%</td>
          <td>${r.behavioral_score}%</td>
          <td>${r.ai_score}%</td>
          <td>${r.verified_code_score}%</td>
          <td>${r.code_score}%</td>
          <td>
            <a href="./${r.key}_report.html" target="_blank">View HTML</a> | 
            <a href="./${r.key}_bundle.json" target="_blank">JSON Bundle</a>
          </td>
        </tr>
      `).join('');

      const finalHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Final Grading Summary</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; }
          h1 { color: #38bdf8; text-align: center; margin-bottom: 30px; }
          .summary-card { background: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center; border: 1px solid #334155; }
          .avg-score { font-size: 56px; font-weight: bold; color: #10b981; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; background: #1e293b; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          th, td { padding: 15px 20px; text-align: left; border-bottom: 1px solid #334155; }
          th { background: #020617; color: #94a3b8; font-weight: 600; text-transform: uppercase; font-size: 13px; letter-spacing: 0.05em; }
          tr:hover { background: #334155; }
          a { color: #38bdf8; text-decoration: none; font-weight: 500; }
          a:hover { text-decoration: underline; color: #7dd3fc; }
        </style>
      </head>
      <body>
        <h1>OpenHW Grading Matrix Results</h1>
        <div class="summary-card">
          <h2 style="margin-top:0; color: #94a3b8;">Overall Average Score</h2>
          <div class="avg-score">${avgScore}%</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Component</th>
              <th>Total Score</th>
              <th>Spatial</th>
              <th>Behavioral (Time)</th>
              <th>AI Semantic</th>
              <th>Code Logic</th>
              <th>Code Behav</th>
              <th>Artifacts</th>
            </tr>
          </thead>
          <tbody>
            ${htmlRows}
          </tbody>
        </table>
      </body>
      </html>
      `;

      const summaryPath = path.join(REPORTS_DIR, 'final_summary.html');
      fs.writeFileSync(summaryPath, finalHtml, 'utf8');
      console.log(`[Grading Matrix Test] 📝 Wrote final summary to ${summaryPath}`);

      // Create ZIP archive
      const zipName = `grading_reports_archive_${Date.now()}.zip`;
      const zipPath = path.join(CACHE_DIR, '..', zipName);
      console.log(`[Grading Matrix Test] 📦 Zipping reports into ${zipPath}`);
      try {
        execSync(`tar -a -c -f "${zipPath}" *`, { cwd: REPORTS_DIR });
        console.log(`[Grading Matrix Test] ✅ Successfully created zip archive: ${zipPath}`);
      } catch (e) {
        console.error(`[Grading Matrix Test] ❌ Failed to create zip archive`, e);
      }

      // Open in browser to show the user
      await page.goto(`file://${summaryPath.replace(/\\\\/g, '/')}`);
      await page.waitForTimeout(5000); // Leave it open for a few seconds before closing
    }
  });
});

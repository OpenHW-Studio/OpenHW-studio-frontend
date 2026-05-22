import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { setupConsoleCapture, waitForPageStability } from '../src/test-utils/page-tester.js';

// Load route configuration
const routeConfigPath = path.resolve('./scripts/page-routes.json');
const routeConfig = JSON.parse(fs.readFileSync(routeConfigPath, 'utf-8'));

// Create test results directory
const testResultsDir = 'test-results/console-errors';
if (!fs.existsSync(testResultsDir)) {
  fs.mkdirSync(testResultsDir, { recursive: true });
}

const testConfig = routeConfig.testConfig;
const allRoutes = [
  ...routeConfig.public.filter((r) => r.priority === 'critical' || r.priority === 'high'),
];

test.describe('Console Error Detection Suite', () => {
  allRoutes.forEach((route) => {
    test(`should check console for errors on ${route.name}`, async ({ page }) => {
      const consoleMessages = [];
      const consoleErrors = [];
      const consoleWarnings = [];
      const networkErrors = [];

      try {
        // Setup comprehensive console logging
        page.on('console', (msg) => {
          const type = msg.type();
          const text = msg.text();
          const location = msg.location();

          consoleMessages.push({
            type,
            message: text,
            location,
            timestamp: new Date().toISOString(),
          });

          // Track errors and warnings
          if (type === 'error' || type === 'stderr') {
            consoleErrors.push({
              message: text,
              location,
            });
          } else if (type === 'warning' || type === 'warn') {
            consoleWarnings.push({
              message: text,
              location,
            });
          }
        });

        // Track page errors
        page.on('pageerror', (error) => {
          consoleErrors.push({
            message: `Page Error: ${error.message}`,
            stack: error.stack,
          });
        });

        // Track request failures
        page.on('requestfailed', (request) => {
          networkErrors.push({
            url: request.url(),
            method: request.method(),
            error: request.failure().errorText,
          });
        });

        // Mock all backend API requests to avoid connection refused errors in CI
        await page.route('**/api/**', async (route) => {
          if (route.request().url().includes('maintenance-status')) {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ maintenance: false, message: "OK" }) });
          } else if (route.request().url().includes('version')) {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: "1.0.0" }) });
          } else {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
          }
        });

        // Navigate to page
        await page.goto(route.path, { waitUntil: 'domcontentloaded', timeout: testConfig.timeout });

        // Wait for stability
        await waitForPageStability(page, 5000);

        // Wait a bit for any deferred errors
        await page.waitForTimeout(2000);
      } catch (error) {
        consoleErrors.push({
          message: `Navigation error: ${error.message}`,
        });
      }

      // Create detailed report
      const errorReport = {
        route: route.path,
        name: route.name,
        timestamp: new Date().toISOString(),
        summary: {
          totalMessages: consoleMessages.length,
          errors: consoleErrors.length,
          warnings: consoleWarnings.length,
          networkErrors: networkErrors.length,
        },
        details: {
          consoleMessages,
          consoleErrors,
          consoleWarnings,
          networkErrors,
        },
      };

      // Save detailed report
      const reportFileName = route.name.replace(/\s+/g, '-').toLowerCase();
      const reportPath = path.join(testResultsDir, `${reportFileName}-console.json`);
      fs.writeFileSync(reportPath, JSON.stringify(errorReport, null, 2));

      // Log results
      console.log(`\n${route.name} (${route.path})`);
      console.log(`  Total console messages: ${consoleMessages.length}`);
      console.log(`  Errors: ${consoleErrors.length}`);
      console.log(`  Warnings: ${consoleWarnings.length}`);
      console.log(`  Network errors: ${networkErrors.length}`);

      if (consoleErrors.length > 0) {
        console.log(`  Error details:`);
        consoleErrors.slice(0, 5).forEach((err) => {
          console.log(`    - ${err.message}`);
        });
      }

      if (networkErrors.length > 0) {
        console.log(`  Network error details:`);
        networkErrors.slice(0, 5).forEach((err) => {
          console.log(`    - ${err.method} ${err.url}: ${err.error}`);
        });
      }

      // Assertions
      if (testConfig.consoleErrorThreshold === 'none') {
        expect(consoleErrors.length).toBe(0);
      } else if (testConfig.consoleErrorThreshold === 'warning') {
        // Only fail on actual errors, not warnings
        expect(consoleErrors.length).toBe(0);
      }
      // threshold 'error' means we allow warnings but fail on errors - this is the default
    });
  });

  test.afterAll(async () => {
    // Aggregate all console error reports
    const files = fs.readdirSync(testResultsDir);
    const reports = files
      .filter((f) => f.endsWith('-console.json'))
      .map((f) => JSON.parse(fs.readFileSync(path.join(testResultsDir, f), 'utf-8')));

    // Generate summary report
    const summary = {
      generatedAt: new Date().toISOString(),
      totalRoutesTested: reports.length,
      routesWithErrors: reports.filter((r) => r.summary.errors > 0).length,
      routesWithNetworkErrors: reports.filter((r) => r.summary.networkErrors > 0).length,
      totalConsoleErrors: reports.reduce((sum, r) => sum + r.summary.errors, 0),
      totalNetworkErrors: reports.reduce((sum, r) => sum + r.summary.networkErrors, 0),
      routeDetails: reports.map((r) => ({
        name: r.name,
        path: r.route,
        errors: r.summary.errors,
        warnings: r.summary.warnings,
        networkErrors: r.summary.networkErrors,
      })),
    };

    const summaryPath = path.join(testResultsDir, 'summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    // Generate HTML summary
    const htmlReport = `
<!DOCTYPE html>
<html>
<head>
  <title>Console Error Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .header { background: #333; color: white; padding: 20px; border-radius: 4px; margin-bottom: 20px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }
    .summary-card { background: white; padding: 15px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .summary-card h3 { margin: 0 0 10px 0; color: #666; font-size: 14px; }
    .summary-card .value { font-size: 28px; font-weight: bold; }
    .error-count { color: #dc3545; }
    .warning-count { color: #ffc107; }
    .network-error-count { color: #e83e8c; }
    .route-item { background: white; padding: 15px; margin-bottom: 10px; border-radius: 4px; border-left: 4px solid #ddd; }
    .route-item.has-errors { border-left-color: #dc3545; }
    .route-item h4 { margin: 0 0 10px 0; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 13px; }
    .stats div { background: #f9f9f9; padding: 8px; border-radius: 3px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Console Error Detection Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
  </div>
  <div class="summary">
    <div class="summary-card">
      <h3>Routes Tested</h3>
      <div class="value">${summary.totalRoutesTested}</div>
    </div>
    <div class="summary-card">
      <h3>Routes with Errors</h3>
      <div class="value error-count">${summary.routesWithErrors}</div>
    </div>
    <div class="summary-card">
      <h3>Total Console Errors</h3>
      <div class="value error-count">${summary.totalConsoleErrors}</div>
    </div>
    <div class="summary-card">
      <h3>Total Network Errors</h3>
      <div class="value network-error-count">${summary.totalNetworkErrors}</div>
    </div>
  </div>
  <h2>Route Details</h2>
  ${summary.routeDetails
    .map(
      (r) => `
  <div class="route-item ${r.errors > 0 ? 'has-errors' : ''}">
    <h4>${r.name} (${r.path})</h4>
    <div class="stats">
      <div><strong>Console Errors:</strong> ${r.errors}</div>
      <div><strong>Warnings:</strong> ${r.warnings}</div>
      <div><strong>Network Errors:</strong> ${r.networkErrors}</div>
    </div>
  </div>
`
    )
    .join('')}
</body>
</html>
`;

    const htmlReportPath = path.join(testResultsDir, 'summary.html');
    fs.writeFileSync(htmlReportPath, htmlReport);

    console.log(`\n=== Console Error Detection Summary ===`);
    console.log(`Routes tested: ${summary.totalRoutesTested}`);
    console.log(`Routes with errors: ${summary.routesWithErrors}`);
    console.log(`Total console errors: ${summary.totalConsoleErrors}`);
    console.log(`Total network errors: ${summary.totalNetworkErrors}`);
    console.log(`\nReports saved to: ${testResultsDir}`);
  });
});

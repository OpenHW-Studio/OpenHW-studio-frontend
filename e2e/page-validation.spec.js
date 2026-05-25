import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import {
  setupConsoleCapture,
  validatePageContent,
  checkPagePerformance,
  takePageScreenshot,
  waitForPageStability,
  validatePageTitle,
  createPageTestReport,
  generateHTMLReport,
  parseRouteFromJson,
} from '../src/test-utils/page-tester.js';

// Load route configuration
const routeConfigPath = path.resolve('./scripts/page-routes.json');
const routeConfig = JSON.parse(fs.readFileSync(routeConfigPath, 'utf-8'));

// Create test results directory
const testResultsDir = 'test-results/page-validation';
if (!fs.existsSync(testResultsDir)) {
  fs.mkdirSync(testResultsDir, { recursive: true });
}

const allReports = [];

// Test configuration
const testConfig = routeConfig.testConfig;
const publicRoutes = routeConfig.public
  .filter((r) => r.priority === 'critical' || r.priority === 'high')
  .map(parseRouteFromJson);

test.describe('Page Validation Suite', () => {
  publicRoutes.forEach((route) => {
    test(`should validate ${route.name} at ${route.path}`, async ({ page }) => {
      const results = [];
      let logger;

      try {
        // Setup console capture
        logger = await setupConsoleCapture(page);

        // Navigate to page
        test.step(`Navigate to ${route.path}`, async () => {
          await page.goto(route.path, { waitUntil: 'domcontentloaded', timeout: testConfig.timeout });
        });

        // Wait for page stability
        test.step('Wait for page to stabilize', async () => {
          const stability = await waitForPageStability(page, 5000);
          results.push({
            test: 'Page Stability',
            passed: stability.stable,
            message: stability.stable ? 'Page loaded and stabilized' : `Page failed to stabilize: ${stability.error}`,
            details: stability,
          });
        });

        // Validate title
        test.step('Validate page title', async () => {
          const titleResult = await validatePageTitle(page);
          results.push({
            test: 'Page Title',
            passed: titleResult.valid,
            message: titleResult.valid ? `Title: "${titleResult.title}"` : 'No valid title found',
            details: titleResult,
          });
        });

        // Validate page content
        test.step('Validate page content', async () => {
          const contentResult = await validatePageContent(page, testConfig.minDomElements);
          results.push({
            test: 'Page Content',
            passed: contentResult.valid,
            message: contentResult.reason,
            details: contentResult,
          });
        });

        // Check console errors
        test.step('Check console for errors', async () => {
          const errorReport = logger.getErrorReport();
          const hasErrors = errorReport.hasErrors;

          results.push({
            test: 'Console Errors',
            passed: !hasErrors,
            message: !hasErrors ? 'No console errors detected' : `${errorReport.errorDetails.length} error(s) found`,
            details: errorReport.errorDetails.slice(0, 5), // Limit to first 5
          });
        });

        // Check network errors
        test.step('Check for network failures', async () => {
          const errorReport = logger.getErrorReport();
          const hasNetworkErrors = errorReport.hasNetworkErrors;

          results.push({
            test: 'Network Errors',
            passed: !hasNetworkErrors,
            message: !hasNetworkErrors ? 'No network errors detected' : `${errorReport.networkErrorDetails.length} network error(s) found`,
            details: errorReport.networkErrorDetails.slice(0, 5), // Limit to first 5
          });
        });

        // Check page performance
        test.step('Check page performance', async () => {
          const perfResult = await checkPagePerformance(page);
          results.push({
            test: 'Page Performance',
            passed: !perfResult.isSlowLoad,
            message: !perfResult.isSlowLoad
              ? `Page loaded in ${perfResult.metrics.totalDuration}ms`
              : `Slow load detected: ${perfResult.metrics.totalDuration}ms`,
            details: perfResult.metrics,
          });
        });

        // Take screenshot on success
        if (results.every((r) => r.passed)) {
          test.step('Take screenshot', async () => {
            const screenshotResult = await takePageScreenshot(
              page,
              `${route.name.replace(/\s+/g, '-').toLowerCase()}-success`
            );
            if (screenshotResult.success) {
              console.log(`Screenshot saved: ${screenshotResult.path}`);
            }
          });
        }
      } catch (error) {
        results.push({
          test: 'Page Navigation',
          passed: false,
          message: `Error navigating to ${route.path}: ${error.message}`,
          details: { error: error.message },
        });

        // Take screenshot on failure
        if (testConfig.screenshotOnFailure) {
          test.step('Take screenshot on failure', async () => {
            const screenshotResult = await takePageScreenshot(
              page,
              `${route.name.replace(/\s+/g, '-').toLowerCase()}-failure`
            );
            if (screenshotResult.success) {
              console.log(`Failure screenshot saved: ${screenshotResult.path}`);
            }
          });
        }
      }

      // Create report for this page
      const pageReport = createPageTestReport(route.name, results);
      allReports.push(pageReport);

      // Log results
      const passed = results.every((r) => r.passed);
      console.log(`\n${route.name} (${route.path}): ${passed ? '✓ PASSED' : '✗ FAILED'}`);
      results.forEach((r) => {
        console.log(`  ${r.passed ? '✓' : '✗'} ${r.test}: ${r.message}`);
      });

      // Assert
      expect(results.every((r) => r.passed)).toBe(true);
    });
  });

  test.afterAll(async () => {
    // Generate HTML report
    const htmlReport = generateHTMLReport(allReports);
    const reportPath = path.join(testResultsDir, 'report.html');
    fs.writeFileSync(reportPath, htmlReport);
    console.log(`\nPage validation report saved to: ${reportPath}`);

    // Generate JSON report
    const jsonReportPath = path.join(testResultsDir, 'report.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(allReports, null, 2));
    console.log(`JSON report saved to: ${jsonReportPath}`);

    // Summary
    const passedCount = allReports.filter((r) => r.passed).length;
    const failedCount = allReports.length - passedCount;
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total: ${allReports.length}`);
    console.log(`Passed: ${passedCount}`);
    console.log(`Failed: ${failedCount}`);
  });
});

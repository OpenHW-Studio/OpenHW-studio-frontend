/**
 * Page Tester Utilities
 * Helper functions for E2E testing page validation and error detection
 */

export class PageConsoleLogger {
  constructor() {
    this.logs = [];
    this.errors = [];
    this.warnings = [];
    this.networkErrors = [];
  }

  captureConsoleMessage(type, message) {
    this.logs.push({ type, message, timestamp: new Date().toISOString() });
    if (type === 'error') {
      this.errors.push(message);
    } else if (type === 'warning') {
      this.warnings.push(message);
    }
  }

  captureNetworkError(error) {
    this.networkErrors.push(error);
  }

  getSummary() {
    return {
      totalLogs: this.logs.length,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      networkErrorCount: this.networkErrors.length,
      errors: this.errors,
      warnings: this.warnings,
      networkErrors: this.networkErrors,
    };
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  hasNetworkErrors() {
    return this.networkErrors.length > 0;
  }

  getErrorReport() {
    return {
      hasErrors: this.hasErrors(),
      hasNetworkErrors: this.hasNetworkErrors(),
      errorDetails: this.errors,
      networkErrorDetails: this.networkErrors,
      allLogs: this.logs,
    };
  }
}

export async function setupConsoleCapture(page) {
  const logger = new PageConsoleLogger();

  // Capture console messages
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    
    // Filter out non-critical messages
    if (!shouldIgnoreConsoleMessage(text)) {
      logger.captureConsoleMessage(type, text);
    }
  });

  // Capture page errors
  page.on('pageerror', (error) => {
    logger.captureConsoleMessage('error', `Page Error: ${error.message}`);
  });

  // Capture request failures
  page.on('requestfailed', (request) => {
    logger.captureNetworkError({
      url: request.url(),
      method: request.method(),
      error: request.failure().errorText,
    });
  });

  return logger;
}

export function shouldIgnoreConsoleMessage(message) {
  const ignorePatterns = [
    'Failed to load resource',
    'Uncaught SyntaxError',
    'Google Analytics',
    'gtag',
    'webpackChunk',
    'NetworkError',
    'Non-Error promise rejection captured',
  ];

  return ignorePatterns.some((pattern) => message.includes(pattern));
}

export async function validatePageContent(page, minElements = 5) {
  // Check if page has rendered content
  const bodyContent = await page.locator('body').count();
  if (bodyContent === 0) {
    return { valid: false, reason: 'Body element not found' };
  }

  // Check for minimum DOM elements
  const elementCount = await page.locator('*').count();
  if (elementCount < minElements) {
    return {
      valid: false,
      reason: `Page has only ${elementCount} elements, expected at least ${minElements}`,
    };
  }

  // Check for common error indicators
  const errorIndicators = [
    'text=/Error loading|Failed to load|Something went wrong|Blank page|No content/',
    'text=/Cannot read|TypeError|ReferenceError/',
  ];

  for (const selector of errorIndicators) {
    const found = await page.locator(selector).count();
    if (found > 0) {
      return { valid: false, reason: 'Page shows error indicator' };
    }
  }

  return { valid: true, reason: 'Page rendered successfully' };
}

export async function checkPagePerformance(page) {
  const metrics = await page.evaluate(() => {
    const perf = performance.getEntriesByType('navigation')[0];
    return {
      domContentLoaded: perf?.domContentLoadedEventEnd - perf?.domContentLoadedEventStart,
      loadComplete: perf?.loadEventEnd - perf?.loadEventStart,
      navigationStart: perf?.fetchStart,
      navigationEnd: perf?.loadEventEnd,
      totalDuration: perf?.loadEventEnd - perf?.fetchStart,
    };
  });

  return {
    metrics,
    isSlowLoad: metrics.totalDuration > 10000, // 10 seconds
  };
}

export async function takePageScreenshot(page, filename) {
  try {
    await page.screenshot({ path: `test-results/${filename}.png`, fullPage: true });
    return { success: true, path: `test-results/${filename}.png` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function waitForPageStability(page, timeout = 5000) {
  try {
    // Wait for network to be idle
    await page.waitForLoadState('networkidle', { timeout });
    return { stable: true };
  } catch (error) {
    return { stable: false, error: error.message };
  }
}

export async function validatePageTitle(page) {
  try {
    const title = await page.title();
    return {
      valid: title && title.length > 0,
      title,
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

export function createPageTestReport(pageName, results) {
  return {
    pageName,
    timestamp: new Date().toISOString(),
    passed: results.every((r) => r.passed),
    results: results.map((r) => ({
      test: r.test,
      passed: r.passed,
      message: r.message,
      details: r.details,
    })),
  };
}

export function generateHTMLReport(reports) {
  const passedCount = reports.filter((r) => r.passed).length;
  const failedCount = reports.length - passedCount;

  let html = `
<!DOCTYPE html>
<html>
<head>
  <title>Page Validation Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .header { background: #333; color: white; padding: 20px; border-radius: 4px; margin-bottom: 20px; }
    .summary { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .summary-item { background: white; padding: 15px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .summary-item h3 { margin: 0 0 10px 0; color: #666; }
    .summary-item .value { font-size: 24px; font-weight: bold; }
    .passed { color: #28a745; }
    .failed { color: #dc3545; }
    .total { color: #007bff; }
    .report-item { background: white; padding: 15px; margin-bottom: 10px; border-radius: 4px; border-left: 4px solid #ddd; }
    .report-item.passed { border-left-color: #28a745; }
    .report-item.failed { border-left-color: #dc3545; }
    .report-item h4 { margin: 0 0 10px 0; }
    .report-item .status { font-weight: bold; margin-bottom: 5px; }
    .details { background: #f9f9f9; padding: 10px; border-radius: 3px; margin-top: 10px; font-family: monospace; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Page Validation Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
  </div>
  <div class="summary">
    <div class="summary-item">
      <h3>Total Pages</h3>
      <div class="value total">${reports.length}</div>
    </div>
    <div class="summary-item">
      <h3>Passed</h3>
      <div class="value passed">${passedCount}</div>
    </div>
    <div class="summary-item">
      <h3>Failed</h3>
      <div class="value failed">${failedCount}</div>
    </div>
  </div>
`;

  reports.forEach((report) => {
    const statusClass = report.passed ? 'passed' : 'failed';
    const statusText = report.passed ? '✓ PASSED' : '✗ FAILED';

    html += `
  <div class="report-item ${statusClass}">
    <h4>${report.pageName}</h4>
    <div class="status">${statusText}</div>
    ${
      report.results
        .map(
          (r) =>
            `<div>${r.passed ? '✓' : '✗'} ${r.test}: ${r.message}</div>`
        )
        .join('')
    }
    ${
      report.results.some((r) => r.details)
        ? `<div class="details">${report.results
            .filter((r) => r.details)
            .map(
              (r) =>
                `<strong>${r.test}:</strong><br/>${JSON.stringify(
                  r.details,
                  null,
                  2
                )}<br/><br/>`
            )
            .join('')}</div>`
        : ''
    }
  </div>
`;
  });

  html += `
</body>
</html>
`;

  return html;
}

export function parseRouteFromJson(routeConfig) {
  return {
    path: routeConfig.path,
    name: routeConfig.name,
    description: routeConfig.description,
    requiresAuth: routeConfig.requiresAuth || false,
    role: routeConfig.role || null,
    priority: routeConfig.priority || 'medium',
  };
}

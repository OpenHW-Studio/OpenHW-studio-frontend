# Frontend Page Runtime Validation Workflow

## Overview

This workflow automatically validates all frontend pages at runtime, catching issues that the build step might miss. It's designed to detect:

- **Blank pages** - Pages that render but have no content
- **Console errors** - JavaScript errors, warnings, and uncaught exceptions
- **Network failures** - Failed API calls and missing resources
- **Runtime issues** - Page crashes and unexpected errors
- **Performance problems** - Slow page loads

## Problem It Solves

**Before:** Build succeeds ✓ → Deploy → User opens page → Blank screen with console errors ✗

**After:** Build succeeds → Page validation tests run → Console errors detected → CI fails, preventing deployment ✓

## Files Created

### 1. **scripts/page-routes.json**
Configuration file containing:
- All public routes (no authentication required)
- All protected routes (requires authentication)
- Route metadata (name, description, priority, role)
- Test configuration (timeout, error thresholds)

**Usage:**
```json
{
  "public": [
    {
      "path": "/",
      "name": "Landing Page",
      "priority": "critical",
      "requiresAuth": false
    }
  ],
  "testConfig": {
    "timeout": 30000,
    "consoleErrorThreshold": "error",
    "minDomElements": 5
  }
}
```

### 2. **src/test-utils/page-tester.js**
Reusable testing utilities including:
- `setupConsoleCapture()` - Capture console messages and errors
- `validatePageContent()` - Check if page has rendered
- `checkPagePerformance()` - Measure load times
- `takePageScreenshot()` - Capture page state
- `generateHTMLReport()` - Create beautiful test reports

**Example Usage:**
```javascript
const logger = await setupConsoleCapture(page);
await page.goto('/simulator');
const errorReport = logger.getErrorReport();
```

### 3. **e2e/page-validation.spec.js**
Playwright test suite that:
- Navigates to each critical page
- Validates page loaded successfully
- Checks for console errors
- Verifies DOM content exists (not blank)
- Checks page performance
- Takes screenshots on success/failure
- Generates HTML and JSON reports

**Tests include:**
- Page Stability (network idle)
- Page Title (valid and present)
- Page Content (minimum DOM elements)
- Console Errors (none expected)
- Network Errors (none expected)
- Page Performance (load time < 10s)

### 4. **e2e/console-error-check.spec.js**
Comprehensive console error detection suite that:
- Logs every console message (info, warning, error)
- Tracks network request failures
- Captures page errors
- Generates detailed JSON reports per route
- Creates summary HTML report
- Shows error trends across all pages

**Reports generated:**
- Individual route console logs
- Network error details
- Summary statistics

### 5. **.github/workflows/page-validation.yml**
GitHub Actions workflow that:
- Runs on push to main/develop and on PRs
- Runs daily at 2 AM UTC (scheduled)
- Builds the application
- Runs page validation tests
- Runs console error detection
- Uploads test artifacts
- Comments on PRs with results
- Fails job if critical pages have errors

## How It Works

### Workflow Execution Flow

```
1. Code Push / PR / Scheduled Time
   ↓
2. Checkout Code & Dependencies
   ↓
3. Build Application (npm run build)
   ↓
4. Setup Playwright Browsers
   ↓
5. Run Page Validation Tests
   ├─ Navigate to each page
   ├─ Check if page renders
   ├─ Validate content exists
   ├─ Capture console errors
   ├─ Check network requests
   └─ Take screenshots
   ↓
6. Run Console Error Detection
   ├─ Log all console messages
   ├─ Track network failures
   ├─ Measure performance
   └─ Generate detailed reports
   ↓
7. Upload Artifacts
   ├─ Test results
   ├─ Screenshots
   ├─ HTML reports
   └─ JSON data
   ↓
8. Generate Summary
   ├─ Comment on PR
   ├─ Post to GitHub Actions Summary
   └─ Fail/Pass based on results
```

## Running Locally

### Run all page validation tests
```bash
npm run test:page-validation
```

### Run console error detection
```bash
npm run test:console-errors
```

### Run both together
```bash
npm run test:pages
```

### Run with specific configuration
```bash
# With UI
npm run test:page-validation -- --ui

# With headed browser (see what happens)
npm run test:page-validation -- --headed

# Single route test
npm run test:page-validation -- --grep "Landing Page"
```

## Test Reports

### Generated Files

After tests run, reports are available in:
- `test-results/page-validation/report.html` - Beautiful page validation report
- `test-results/page-validation/report.json` - Structured test data
- `test-results/console-errors/summary.html` - Console error summary
- `test-results/console-errors/summary.json` - Detailed error data
- `test-results/page-validation/*.png` - Page screenshots

### Report Contents

**Page Validation Report shows:**
- ✓ Pages that loaded successfully
- ✓ No console errors detected
- ✓ Page content rendered
- ✓ Network requests completed
- ✗ Pages with issues and why

**Console Error Report shows:**
- Console error count per page
- Network failure details
- Error locations and stack traces
- Performance metrics

## Adding More Pages to Test

### 1. Update page-routes.json
Add your route to the `public` or `protected` array:

```json
{
  "path": "/my-new-page",
  "name": "My New Page",
  "description": "Description of my page",
  "requiresAuth": false,
  "priority": "high"
}
```

### 2. Supported Priorities
- **critical** - Fails the entire workflow if it has errors
- **high** - Tests run but doesn't block deployment
- **medium** - Informational testing only

### 3. Re-run tests
```bash
npm run test:pages
```

## Customizing Test Behavior

### Timeout Configuration
Edit `scripts/page-routes.json`:
```json
"testConfig": {
  "timeout": 30000,  // Page navigation timeout (ms)
  "minDomElements": 5,  // Minimum elements to consider "rendered"
  "screenshotOnFailure": true,  // Capture failed pages
  "captureNetworkErrors": true  // Track API failures
}
```

### Error Threshold Levels
In `page-routes.json`:
```json
"testConfig": {
  "consoleErrorThreshold": "error"  // or "warning" or "none"
}
```

- `"none"` - Fail on any console messages
- `"warning"` - Fail on errors and warnings
- `"error"` - Only fail on actual errors (default)

## Troubleshooting

### Tests timing out
- Increase `timeout` in page-routes.json
- Check if your backend is running
- Look for infinite loading states

### Blank page errors
- Add specific selectors to check for
- Verify API endpoints are accessible
- Check for CSP (Content Security Policy) violations

### Network errors
- Verify API endpoints in test environment
- Check CORS configuration
- Look for failed asset loads

### False positives in console
- Add patterns to `shouldIgnoreConsoleMessage()` in page-tester.js
- Filter known third-party library messages
- Update error thresholds

## CI Integration

### GitHub Actions Status
- ✓ Page Validation - All pages load successfully
- ✗ Page Validation - Some pages have errors (check report)
- → Console Errors - Detailed log of all console messages

### PR Comments
Workflow automatically comments on PRs with:
- Summary statistics (total pages, passed, failed)
- List of failing pages
- Links to detailed reports
- Recommendations

### Artifacts
All test artifacts are uploaded and retained for 30 days:
- Accessible in "Actions" tab
- Useful for debugging failures
- Can be downloaded for offline analysis

## Advanced Usage

### Testing After Backend Deploy
You can trigger this workflow from another workflow:

```yaml
- name: Trigger page validation
  uses: actions/workflow_dispatch@v2
  with:
    ref: main
```

### Custom Backend Endpoint
Set environment variable in workflow or locally:

```bash
export VITE_API_URL=https://api.example.com
npm run test:pages
```

### Parallel Execution
The workflow runs tests in parallel:
- Multiple browsers
- Multiple routes
- Faster feedback

## Best Practices

1. **Test critical pages first** - Use "critical" priority for main routes
2. **Keep timeouts reasonable** - 30s is usually enough
3. **Monitor reports regularly** - Check for patterns in errors
4. **Update routes as app changes** - Keep page-routes.json in sync
5. **Use screenshots for debugging** - They're captured on failures
6. **Check network tab** - Failed APIs often indicate backend issues

## Future Enhancements

Possible additions:
- Visual regression testing (screenshot diffs)
- Accessibility validation (a11y checks)
- SEO validation (meta tags, structured data)
- Performance budgets (warn if load > 5s)
- Custom per-route test hooks
- API availability validation
- Database connectivity checks

## Support

### Debugging Failed Tests
1. Check the HTML report: `test-results/page-validation/report.html`
2. Look at screenshots: `test-results/page-validation/*.png`
3. Review console logs: `test-results/console-errors/*.json`
4. Run locally to reproduce: `npm run test:pages -- --headed`

### Common Issues

**Pages loading but showing blank:**
- Check browser console errors
- Verify CSS/JS bundle loaded
- Check for API errors

**Test timeout:**
- Extend timeout in config
- Check backend connectivity
- Look for infinite loops

**False error reports:**
- Update ignore patterns
- Filter third-party errors
- Adjust error threshold

## Example Workflow Integration

```yaml
# In your .github/workflows/deploy.yml
- name: Validate Pages Before Deployment
  uses: ./page-validation.yml

- name: Deploy to Production
  if: success()  # Only deploy if validation passes
  run: npm run deploy
```

## License & Attribution

Part of OpenHW Studio's quality assurance pipeline.

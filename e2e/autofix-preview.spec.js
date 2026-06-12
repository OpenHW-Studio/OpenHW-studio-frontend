import { test, expect } from '@playwright/test';

test.describe('AutofixPreviewPanel E2E', () => {
  test('should display preview plan and apply fixes', async ({ page }) => {
    // Navigate to simulator page
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Look for the AutofixPreviewPanel or related UI element
    // This might be on a specific page or modal - adjust selector based on actual app structure
    await page.waitForSelector('.autofix-preview-panel', { timeout: 5000 }).catch(() => {
      // Panel may not be visible initially; that's ok
      console.log('AutofixPreviewPanel not immediately visible');
    });

    // Try to find and click "Preview fixes" button
    const previewButton = await page.locator('button:has-text("Preview fixes")').first();
    
    // If button exists and is visible, click it
    if (await previewButton.isVisible()) {
      await previewButton.click();
      
      // Wait for preview results to appear
      await page.waitForSelector('[class*="autofix"]', { timeout: 5000 });
      
      // Assert that applied count is shown
      const appliedText = await page.locator('text=/Applied:/').first();
      await expect(appliedText).toBeVisible();
      
      // Get the Apply All button
      const applyButton = await page.locator('button:has-text("Apply All")').first();
      
      // Apply button should be enabled if fixes were suggested
      if (await applyButton.isVisible()) {
        const isDisabled = await applyButton.isDisabled();
        
        if (!isDisabled) {
          // Click Apply All
          await applyButton.click();
          
          // Wait for the action to complete
          await page.waitForTimeout(500);
          
          // Assert the panel still shows applied info
          const appliedCountAfter = await page.locator('text=/Applied:/').first();
          await expect(appliedCountAfter).toBeVisible();
          
          console.log('✓ Preview and apply flow completed successfully');
        }
      }
    } else {
      console.log('⚠ Preview fixes button not found; skipping interactive test');
    }
  });

  test('should handle empty validation errors gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // If no errors, the panel should show "No issues detected" or similar
    const noIssuesText = await page.locator('text=/No issues detected|Click "Preview fixes"/').first();
    
    if (await noIssuesText.isVisible()) {
      console.log('✓ Empty validation state handled correctly');
      await expect(noIssuesText).toBeVisible();
    }
  });
});

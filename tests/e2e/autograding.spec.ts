import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Phase 2: WASM Autograding Integration & Visual Key Verification', () => {

    test('Visual Simulator Key seamlessly passes Headless Autograder', async ({ page }) => {
        // Step 1: Open the Autograding Engine Page
        await page.goto('http://localhost:5173/grade');

        // Verify the Grading Engine UI loaded
        const heading = page.locator('h1', { hasText: 'OpenHW Autograding' });
        await expect(heading).toBeVisible();

        console.log('✅ Grading engine ready for Reference Key validation.');
        
        const fixturePath = path.join(__dirname, '..', 'fixtures', 'binary-cache');

        // 1. Upload uno_servo.png as Teacher Reference
        const teacherInput = page.locator('input[type="file"]').first();
        await teacherInput.setInputFiles(path.join(fixturePath, 'uno_servo.png'));

        // 2. Upload uno_servo.png as Student Submission (using the same perfect circuit)
        const studentInput = page.locator('input[type="file"]').nth(1);
        await studentInput.setInputFiles(path.join(fixturePath, 'uno_servo.png'));

        // 3. Click "Compare Circuits"
        const compareBtn = page.getByRole('button', { name: 'Compare Circuits' });
        await compareBtn.click();

        // 4. Wait for grading to complete (Analyze... -> Compare Circuits)
        await expect(compareBtn).toHaveText('Compare Circuits', { timeout: 60000 });

        // 5. Assert that the AI Audit match is successful
        const downloadAuditBtn = page.getByRole('button', { name: /Download AI Audit/i });
        await expect(downloadAuditBtn).toBeVisible();

        // Check if logs indicate success
        const logsContainer = page.locator('.logs-container');
        await expect(logsContainer).toContainText('Grading complete. Report generated.');
    });

});

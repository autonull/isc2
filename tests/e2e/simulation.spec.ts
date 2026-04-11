import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import { exec } from 'child_process';

test.describe('Simulation App E2E', () => {
  let simProcess: any;

  test.beforeAll(async () => {
    // Start vite for simulation
    simProcess = exec('cd apps/simulation && npx vite --port 5174');
    // Wait for it to spin up
    await new Promise(resolve => setTimeout(resolve, 3000));
  });

  test.afterAll(() => {
    if (simProcess) simProcess.kill();
  });

  test('should load simulation dashboard, display agents and canvas without errors', async ({ page }) => {
    // We cannot reliably use `file://` because ES modules fail via cross-origin policy when served from `file://` index.html
    // So we use the specific test dev server

    await page.goto('http://localhost:5174');

    // Wait for app to mount
    await page.waitForSelector('#app', { state: 'attached' });

    // Verify Title
    await expect(page).toHaveTitle(/ISC Simulation/);

    // Verify Controls Dashboard
    await expect(page.locator('h2', { hasText: 'ISC Simulation Dashboard' })).toBeVisible();
    await expect(page.locator('h3', { hasText: 'Simulation Controls' })).toBeVisible();

    // Verify Agents are listed
    await expect(page.locator('text=Alice')).toBeVisible();
    await expect(page.locator('text=Bob')).toBeVisible();

    // Verify Canvas exists
    const canvas = page.locator('#sim-canvas');
    await expect(canvas).toBeVisible();

    // Verify LLM initialization button
    const initBtn = page.locator('button', { hasText: 'Initialize WebLLM' });
    await expect(initBtn).toBeVisible();

    // Click Start/Pause
    const toggleBtn = page.locator('#btn-toggle-sim');
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toHaveText('Start');
    await toggleBtn.click();
    await expect(toggleBtn).toHaveText('Pause');

    // Wait a brief moment to ensure no rapid crashes on tick
    await page.waitForTimeout(1000);

    // Pause again
    await toggleBtn.click();
    await expect(toggleBtn).toHaveText('Start');
  });
});

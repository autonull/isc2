import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import { exec } from 'child_process';

test.describe('Simulation App E2E', () => {
  let simProcess: any;

  test.beforeAll(async () => {
    // Start vite for simulation
    simProcess = exec('cd apps/simulation && npx vite --port 3001');
    // Wait for it to spin up
    await new Promise(resolve => setTimeout(resolve, 5000));
  });

  test.afterAll(() => {
    if (simProcess) simProcess.kill();
  });

  test('should load simulation dashboard, display agents and canvas without errors', async ({ page }) => {
    // Retry goto to handle slightly slow startup
    await expect(async () => {
        const response = await page.goto('http://localhost:3001');
        expect(response?.ok()).toBeTruthy();
    }).toPass({ timeout: 10000 });

    // Wait for app to mount
    await page.waitForSelector('#app', { state: 'attached' });

    // Verify Title
    await expect(page).toHaveTitle(/ISC Simulation/);

    // Verify Controls Dashboard
    await expect(page.locator('h2', { hasText: 'ISC Simulation' })).toBeVisible();
    await expect(page.locator('h3', { hasText: 'Simulation Controls' })).toBeVisible();

    // Verify Agents are listed
    await expect(page.locator('text=Alice')).toBeVisible();
    await expect(page.locator('text=Bob')).toBeVisible();

    // Verify Canvas exists
    const canvas = page.locator('#sim-canvas');
    await expect(canvas).toBeVisible();

    // Verify LLM initialization button
    const initBtn = page.locator('button', { hasText: 'Re-Initialize Engine' });
    await expect(initBtn).toBeVisible();

    // Click Start/Pause
    const toggleBtn = page.locator('#btn-toggle-sim');
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toContainText('Start Simulation');
    await toggleBtn.click();
    await expect(toggleBtn).toContainText('Pause Simulation');

    // Wait a brief moment to ensure no rapid crashes on tick
    await page.waitForTimeout(1000);

    // Pause again
    await toggleBtn.click();
    await expect(toggleBtn).toContainText('Start Simulation');
  });
});

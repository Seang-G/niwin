import { test, expect } from '@playwright/test';

test('renders the clock shell and opens controls', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('niwin');
  await expect(page.locator('.app-root')).toBeVisible();
  await expect(page.locator('.clock-time-core')).toContainText(/\d{2}:\d{2}\d{2}/);

  await page.getByRole('button', { name: 'Toggle menu' }).click();

  await expect(page.locator('.top-panel')).toHaveAttribute('data-open', 'true');
  await expect(page.getByPlaceholder('Search...')).toBeVisible();
});

test('shows validation feedback for an invalid YouTube URL', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Toggle menu' }).click();
  await page.getByPlaceholder('Search...').fill('not a youtube url');
  await page.getByRole('button', { name: 'Start playback' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
});

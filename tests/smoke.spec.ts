import { test, expect } from './bs';
import type { Page } from '@playwright/test';

async function dismissKlaviyoPopup(page: Page) {
  // Klaviyo popup can intercept clicks on Safari/webkit. Remove any kl-private overlays.
  await page.evaluate(() => {
    document.querySelectorAll('[class*="kl-private"], [aria-label="POPUP Form"]').forEach(el => el.remove());
  });
}

test('Homepage loads with key elements', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/FuneralPrints/i);
  // toContainText retries; a one-shot textContent read failed on the real iPhone on 2 Oct while the page was still settling.
  await expect(page.locator('body')).toContainText('Prayer Cards', { timeout: 15000 });
});

test('Product page loads - Prayer Cards category', async ({ page }) => {
  await page.goto('/c/24/prayer-cards');
  await expect(page.locator('body')).toContainText('Prayer Cards');
  const products = page.locator('a[href*="/p/"]');
  await expect(products.first()).toBeVisible({ timeout: 10000 });
});

test('Designer button visible - Prayer Card', async ({ page }) => {
  await page.goto('/p/80/custom-memorial-card');
  await expect(page.locator('.dynamic_product_start')).toBeVisible({ timeout: 15000 });
});

test('Designer button visible - Memorial Poster', async ({ page }) => {
  await page.goto('/p/2965/custom-poster');
  await expect(page.locator('.dynamic_product_start')).toBeVisible({ timeout: 15000 });
});

test('Cart page loads', async ({ page }) => {
  await page.goto('/cart');
  const body = await page.textContent('body');
  expect(body).not.toContain('Server Error');
});

test('Login page loads', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('#LoginEmail')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('input[name="Password"]').first()).toBeVisible();
});

test('Password recovery page loads', async ({ page }) => {
  await page.goto('/passwordrecovery');
  await expect(page.locator('input[type="email"], input[name="Email"], #Email')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.message-error')).toBeHidden();
});

test('Registration page loads without bot detection error', async ({ page }) => {
  await page.goto('/register');
  const body = await page.textContent('body');
  expect(body).not.toContain('Search engine');
  expect(body).not.toContain('search engine');
  await expect(page.locator('input[name="FirstName"], #FirstName')).toBeVisible({ timeout: 10000 });
});

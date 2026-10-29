import { test, expect } from './bs';
import type { Page } from '@playwright/test';

// Designer journey baseline, agreed with JC and John on 29 Sep 2026:
// product page -> Click to Design -> MegaEdit loads -> pick a layout ->
// Preview & Add to Basket -> Add To Cart -> cart page. Timed at each step.
// The console.log lines are parsed by .github/scripts/update-history.mjs; keep their wording.
// "Step: <name>" is printed as each step completes, so a failed run shows the last step that worked.

async function dismissKlaviyoPopup(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll('[class*="kl-private"], [aria-label="POPUP Form"]').forEach(el => el.remove());
  });
}

test('Designer journey - Prayer Card (Click to Design to cart)', async ({ page }) => {
  test.setTimeout(240000);
  let t0 = Date.now();
  const secs = () => ((Date.now() - t0) / 1000).toFixed(1);
  const step = (name: string) => console.log(`  Step: ${name} ${secs()}s`);
  await page.goto('/p/80/custom-memorial-card');
  await expect(page.locator('.dynamic_product_start').first()).toBeVisible({ timeout: 15000 });
  await dismissKlaviyoPopup(page);
  step('Product page loaded');
  const start = page.locator('.dynamic_product_start').first();
  // 'commit' rather than 'load': the editor keeps loading assets for a long time on the real iPhone.
  // On the real iPhone the tap sometimes does not register, so tap again if nothing happens.
  // The real iPhone does not always report the new address after the tap (30 Sep: the designer was on
  // screen but page.url() still said the product page, so the test tapped a button that was gone and
  // timed out). So "opened" also counts the designer being visible, and we never tap a button that is gone.
  const editorUrl = /CF\/DynamicProduct\/Editor/i;
  const designerShown = page.locator('#previewCanvas, .LayoutSelectDialog').first();
  const opened = async () => editorUrl.test(page.url()) || (await designerShown.isVisible().catch(() => false));
  for (let attempt = 1; attempt <= 3 && !(await opened()); attempt++) {
    const timeout = attempt === 3 ? 90000 : 25000;
    if (await start.isVisible().catch(() => false)) {
      await dismissKlaviyoPopup(page);
      await start.scrollIntoViewIfNeeded();
      t0 = Date.now(); // time from the tap that worked, not from a tap the phone ignored
      await start.click();
    }
    await Promise.any([
      page.waitForURL(editorUrl, { timeout, waitUntil: 'commit' }),
      designerShown.waitFor({ state: 'visible', timeout }),
    ]).catch(() => {});
  }
  expect(await opened(), 'Click to Design did not open the editor').toBe(true);
  const navTime = secs();
  step('Designer opened');

  await expect(page.locator('#previewCanvas')).toBeVisible({ timeout: 90000 });
  const canvasTime = secs();
  step('Canvas visible');

  // Every visitor gets the "Select Design" dialog first; the card is not editable until a layout is chosen.
  const layoutDialog = page.locator('.LayoutSelectDialog');
  await expect(layoutDialog).toBeVisible({ timeout: 60000 });
  await layoutDialog.locator('img.layout-thumbnail').first().click();
  await expect(layoutDialog).toBeHidden({ timeout: 30000 });
  const layoutTime = secs();
  step('Layout chosen');

  // Phones get a guided flow: a "How it works" box with START (it can show a few seconds late), a Done
  // button on step 1, then either a preview button (iPhone) or a Next button per step (Android) before
  // "Preview & Add to Basket" shows. Desktop shows that button at once. Tap whatever is on screen.
  const previewAndAdd = page.locator('button.meuiButton', { hasText: /Preview & Add to Basket/i }).first();
  const taps = [
    // Plain button:visible, not button.meuiButton: on Android the START button lacks that class.
    page.locator('button:visible', { hasText: /^\s*START\s*$/i }).first(),
    page.locator('button:visible', { hasText: /^\s*Done\s*$/i }).first(),
    page.locator('.me-editor-simple-preview-button:visible').first(),
    page.locator('button:visible', { hasText: /^\s*Next\s*$/i }).first(),
  ];
  // Loop on a deadline: one isVisible() can read true while MegaEdit is still redrawing, so the button
  // has to stay visible across a second look before we move on.
  let guided = false;
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (await previewAndAdd.isVisible().catch(() => false)) {
      await page.waitForTimeout(1000);
      if (await previewAndAdd.isVisible().catch(() => false)) break;
    }
    for (const t of taps) if (await t.click({ timeout: 1500 }).then(() => true, () => false)) { guided = true; break; }
    await page.waitForTimeout(1000);
  }
  if (guided) step('Guided steps done (phone)');
  await expect(previewAndAdd).toBeVisible({ timeout: 60000 });
  const readyTime = secs();
  step('Preview & Add to Basket visible');
  await previewAndAdd.click();

  // The preview is a same-origin iframe (#previewWindow, src about:blank). The real iPhone does not expose
  // it through Playwright's frame list, so the Add To Cart button is found and clicked from page JavaScript.
  const addToCartReady = () => page.evaluate(() => {
    const f = document.querySelector<HTMLIFrameElement>('#previewWindow');
    const b = f?.contentDocument?.querySelector<HTMLElement>('#addToBasketButton');
    return !!(b && b.offsetWidth && b.offsetHeight);
  });
  await expect.poll(addToCartReady, { timeout: 60000, intervals: [500] }).toBe(true);
  step('Add To Cart visible');
  await page.evaluate(() => {
    (document.querySelector<HTMLIFrameElement>('#previewWindow')!.contentDocument!.querySelector('#addToBasketButton') as HTMLElement).click();
  });

  // The real iPhone does not always report the new address to Playwright (same as the login check), so read
  // it inside the page. The cart text checks below still fail if the card never reached the cart.
  await expect.poll(() => page.evaluate(() => location.pathname).catch(() => ''), { timeout: 60000, intervals: [500] }).toMatch(/\/cart/i);
  await expect(page.locator('body')).toContainText('Custom Memorial Card', { timeout: 30000 });
  await expect(page.locator('body')).toContainText('Sub-Total');
  const cartTime = secs();
  step('Cart shows the card');

  console.log(`[TIMING] Prayer Card Designer journey:`);
  console.log(`  Navigation: ${navTime}s`);
  console.log(`  Canvas visible: ${canvasTime}s`);
  console.log(`  Layout chosen: ${layoutTime}s`);
  console.log(`  Editor ready: ${readyTime}s`);
  console.log(`  Cart reached: ${cartTime}s`);
});

import { test, expect } from './bs';

// Customer login, asked for by JC on the 29 Sep call: customers (and the CSR team) have been sent back to the
// login page after logging in. The test logs in with a real customer account, then opens two account pages
// to check the login sticks. Account: GitHub secrets FP_LOGIN_EMAIL / FP_LOGIN_PASSWORD (Valentin's test
// customer, given 3 Oct 2026). "Step: <name> <n>s" lines are parsed by .github/scripts/update-history.mjs.

test('Customer login - stays logged in', async ({ page }) => {
  const email = process.env.FP_LOGIN_EMAIL || '';
  const password = process.env.FP_LOGIN_PASSWORD || '';
  expect(email && password, 'FP_LOGIN_EMAIL / FP_LOGIN_PASSWORD are not set').toBeTruthy();

  const t0 = Date.now();
  const secs = () => ((Date.now() - t0) / 1000).toFixed(1);
  const step = (name: string) => console.log(`  Step: ${name} ${secs()}s`);

  await page.goto('/login');
  await page.locator('#LoginEmail').fill(email);
  await page.locator('#LoginPassword').fill(password);
  step('Login form filled');
  // Click Login without a screen tap. On the Galaxy the on-screen keyboard stays open after typing and shifts
  // the form, so a tap lands on the password row. Enter fixed the Galaxy but does not submit on the real iPhone.
  // In-page click (as in designer.spec.ts): the Galaxy's driver rejects dispatchEvent without a timeout.
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('button.loginbutton')!.click());
  // The real iPhone does not always report the new address to Playwright (page.url() stays stale), so the
  // address is read inside the page and "logged in" means the Log out link is there.
  const where = () => page.evaluate(() => location.pathname).catch(() => '?');
  const logout = page.locator('a[href*="logout" i]').first();
  await expect.poll(where, { timeout: 30000, intervals: [500] }).not.toMatch(/\/login/i).catch(() => {});
  const after = await where();
  console.log(`  After login: ${after}`);
  if (!(await logout.count())) {
    const msg = await page.locator('.message-error, .validation-summary-errors, .field-validation-error').allInnerTexts().catch(() => []);
    console.log(`  Login error text: ${msg.join(' | ') || '(none)'}`);
  }
  await expect(logout, `no Log out link after logging in (page: ${after})`).toBeAttached({ timeout: 5000 });
  expect(after, 'still on the login page after logging in').not.toMatch(/\/login/i);
  const loginTime = secs();
  step('Logged in');

  // The reported loop: logged in, then the next page asks to log in again.
  for (const path of ['/customer/info', '/cart']) {
    await page.goto(path);
    expect(await where(), `sent back to login when opening ${path}`).not.toMatch(/\/login/i);
    await expect(page.locator('a[href*="logout" i]').first(), `logged out on ${path}`).toBeAttached({ timeout: 15000 });
    step(`Still logged in on ${path}`);
  }

  console.log(`[TIMING] Customer login:`);
  console.log(`  Login: ${loginTime}s`);
});

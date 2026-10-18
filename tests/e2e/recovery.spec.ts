import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

test('protected direct routes recover from network failure and session loss', async ({
  page,
  runtime,
}) => {
  await page.goto('/admin/events');
  await expect(page.getByLabel('Heslo', { exact: true })).toBeVisible();
  expect((await page.request.get('/api/events')).status()).toBe(401);
  expect(
    (
      await page.request.get('/api/absent', {
        headers: { accept: 'text/html' },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.get('/assets/absent.js', {
        headers: { accept: 'text/html' },
      })
    ).status(),
  ).toBe(404);
  await page.getByLabel('Heslo', { exact: true }).fill(runtime.password);
  await page.getByLabel('Heslo', { exact: true }).press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Vaše eventy' }),
  ).toBeVisible();
  expect(
    (
      await page.request.post('/api/events', {
        data: { name: 'Forbidden', description: '' },
        headers: { 'X-D21-Request': '1', Origin: 'https://foreign.example' },
      })
    ).status(),
  ).toBe(403);
  await page.route('**/api/events', (route) => route.abort('connectionfailed'));
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Zkusit znovu', exact: true }),
  ).toBeVisible();
  await page.unroute('**/api/events');
  await page
    .getByRole('button', { name: 'Zkusit znovu', exact: true })
    .press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Vaše eventy' }),
  ).toBeVisible();
  // Only the generated fixture database is touched; development credentials remain intact.
  await runtime.pool.query(
    'UPDATE sessions SET revoked_at=statement_timestamp() WHERE admin_user_id IS NOT NULL AND revoked_at IS NULL',
  );
  await page.reload();
  await expect(page.getByLabel('Heslo', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vaše eventy' })).toHaveCount(
    0,
  );
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
});

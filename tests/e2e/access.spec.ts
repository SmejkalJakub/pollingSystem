import AxeBuilder from '@axe-core/playwright';
import { newSecret, secretHash } from '../../apps/api/src/modules/auth/crypto';
import { test, expect } from './fixtures';

test('roster copies existing links in one click with keyboard, fallback and untimed restart recovery', async ({
  page,
  context,
  browser,
  runtime,
}, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/admin/login');
  await page.getByLabel('Heslo', { exact: true }).fill(runtime.password);
  await page.getByLabel('Heslo', { exact: true }).press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Vaše eventy' }),
  ).toBeVisible();
  async function post(path: string, data: object) {
    const response = await page.request.post(`/api${path}`, {
      data,
      headers: { 'X-D21-Request': '1' },
    });
    expect(response.ok()).toBe(true);
    return response.json();
  }
  const event = await post('/events', {
    name: 'Přístup Stage 1',
    description: '',
  });
  const group = await post(`/events/${event.id}/jury-groups`, {
    code: 'T',
    name: 'Technická',
  });
  const jurors = [];
  for (const name of ['Kopírování', 'Původní odkaz', 'Bez odkazu'])
    jurors.push(
      await post(`/events/${event.id}/jurors`, {
        displayName: name,
        juryGroupId: group.id,
      }),
    );
  const legacyToken = newSecret();
  await runtime.pool.query(
    'INSERT INTO juror_access(token_hash,event_id,juror_id) VALUES ($1,$2,$3)',
    [secretHash(legacyToken), event.id, jurors[1].id],
  );
  await page.goto(`/admin/events/${event.id}`);
  const row = page
    .getByRole('row')
    .filter({ has: page.getByText('Kopírování', { exact: true }) });
  const copy = row.getByRole('button', { name: /Kopírovat odkaz/ });
  await expect(copy).toBeDisabled();
  await expect(row.getByText('Bez aktivního odkazu.')).toBeVisible();
  const legacyRow = page
    .getByRole('row')
    .filter({ has: page.getByText('Původní odkaz', { exact: true }) });
  await expect(
    legacyRow.getByRole('button', { name: /Kopírovat odkaz/ }),
  ).toBeDisabled();
  await expect(legacyRow.getByText(/Původní odkaz funguje/)).toBeVisible();
  await row.getByRole('button', { name: /Osobní přístup/ }).press('Enter');
  await expect(
    row.getByRole('textbox', { name: 'Jméno porotce, řádek 1', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Vytvořit osobní odkaz', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Vytvořit odkaz', exact: true })
    .click();
  const link = await page
    .getByLabel('Nový osobní odkaz', { exact: true })
    .inputValue();
  await page
    .getByRole('button', { name: 'Zavřít osobní přístup', exact: true })
    .click();
  await expect(copy).toBeEnabled();
  await copy.focus();
  await copy.press('Enter');
  await expect(row.getByRole('status')).toContainText('byl zkopírován');
  expect(
    await page
      .evaluate(() => navigator.clipboard.readText())
      .then((value) => value === link),
  ).toBe(true);
  await expect(copy).toBeFocused();
  await expect(
    page.getByRole('heading', { name: /Osobní přístup:/ }),
  ).toHaveCount(0);
  const jurorContext = await browser.newContext({ baseURL: runtime.origin });
  try {
    const jurorPage = await jurorContext.newPage();
    await jurorPage.goto(link);
    await jurorPage
      .getByRole('button', { name: 'Pokračovat k přehledu', exact: true })
      .click();
    await expect(jurorPage).toHaveURL(/\/wizard$/);
    await expect(
      jurorPage.getByText('Kopírování', { exact: true }),
    ).toBeVisible();
    const cookie = (await jurorContext.cookies()).find(
      (value) => value.name === 'd21-session',
    )!;
    expect(cookie.expires).toBe(-1);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Strict');
    await runtime.pool.query(
      "UPDATE sessions SET created_at=now()-interval '30 days' WHERE token_hash=$1",
      [secretHash(cookie.value)],
    );
    const auditBefore = (
      await runtime.pool.query(
        'SELECT count(*) AS n FROM audit_logs WHERE event_id=$1',
        [event.id],
      )
    ).rows[0].n;
    for (let i = 0; i < 2; i++) {
      await copy.click();
      await expect(copy).toBeEnabled();
      expect(
        await page
          .evaluate(() => navigator.clipboard.readText())
          .then((value) => value === link),
      ).toBe(true);
    }
    expect(
      (
        await runtime.pool.query(
          'SELECT count(*) AS n FROM audit_logs WHERE event_id=$1',
          [event.id],
        )
      ).rows[0].n,
    ).toBe(auditBefore);
    await runtime.restart();
    await jurorPage.reload();
    await expect(
      jurorPage.getByText('Kopírování', { exact: true }),
    ).toBeVisible();
    const current = await jurorPage.request.get('/api/wizard/current');
    expect(current.status()).toBe(200);
    expect((await current.json()).expiresAt).toBeNull();
    await page.reload();
    await copy.click();
    await expect(row.getByRole('status')).toContainText('byl zkopírován');
    expect(
      await page
        .evaluate(() => navigator.clipboard.readText())
        .then((value) => value === link),
    ).toBe(true);
    // Denied clipboard permission must expose a selectable link, without another click.
    await page.evaluate(() =>
      Object.defineProperty(navigator.clipboard, 'writeText', {
        configurable: true,
        value: async () => {
          throw new DOMException('Denied', 'NotAllowedError');
        },
      }),
    );
    await copy.press('Enter');
    const fallback = row.getByRole('textbox', {
      name: 'Osobní odkaz pro Kopírování',
      exact: true,
    });
    await expect(fallback).toBeFocused();
    expect(await fallback.inputValue().then((value) => value === link)).toBe(
      true,
    );
    expect(
      await fallback.evaluate(
        (node: HTMLTextAreaElement) =>
          node.selectionStart === 0 && node.selectionEnd === node.value.length,
      ),
    ).toBe(true);
    await expect(row.getByRole('status')).toContainText('Ctrl+C');
    expect((await jurorPage.request.get('/api/wizard/current')).status()).toBe(
      200,
    );
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const box = await copy.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    // Hide secret content before saving the visual QA artifact.
    await row
      .getByRole('button', { name: 'Skrýt odkaz', exact: true })
      .press('Enter');
    await expect(copy).toBeFocused();
    await page.getByLabel('Hledat porotce', { exact: true }).fill('Kopírování');
    await page.screenshot({
      path: testInfo.outputPath(`stage1-roster-${testInfo.project.name}.png`),
      fullPage: true,
    });
    await row.getByRole('button', { name: /Osobní přístup/ }).click();
    await page
      .getByRole('button', { name: 'Vytvořit náhradní odkaz', exact: true })
      .click();
    await expect(
      page.getByRole('form', { name: 'Vytvořit nový osobní odkaz?' }),
    ).toBeVisible();
    // Opening/cancelling a consequential action must leave the current session intact.
    await page.getByRole('button', { name: 'Zrušit', exact: true }).click();
    expect((await jurorPage.request.get('/api/wizard/current')).status()).toBe(
      200,
    );
    await page
      .getByRole('button', { name: 'Zrušit přístup a přihlášení', exact: true })
      .click();
    await page
      .getByRole('form', { name: 'Zrušit osobní přístup?' })
      .getByRole('button', { name: 'Zrušit přístup', exact: true })
      .click();
    expect((await jurorPage.request.get('/api/wizard/current')).status()).toBe(
      401,
    );
    await page
      .getByRole('button', { name: 'Zavřít osobní přístup', exact: true })
      .click();
    await expect(copy).toBeDisabled();
    await expect(row.getByText('Bez aktivního odkazu.')).toBeVisible();
  } finally {
    await jurorContext.close();
  }
});

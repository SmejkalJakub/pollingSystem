import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

test('team table saves atomically with preview, retained errors, conflicts and response-loss retries', async ({
  page,
  runtime,
}, testInfo) => {
  await page.goto('/admin/login');
  await page.getByLabel('Heslo', { exact: true }).fill(runtime.password);
  await page.getByLabel('Heslo', { exact: true }).press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Vaše eventy' }),
  ).toBeVisible();
  const eventResponse = await page.request.post('/api/events', {
    data: { name: 'Týmy Stage 3', description: '' },
    headers: { 'X-D21-Request': '1' },
  });
  expect(eventResponse.ok()).toBe(true);
  const event = await eventResponse.json();
  const path = `/api/events/${event.id}/teams/table`;
  const field = (row: number, name = 'Název týmu') =>
    page.getByLabel(`${name}, řádek ${row}`, { exact: true });
  const save = page.getByRole('button', {
    name: 'Uložit tabulku',
    exact: true,
  });
  const add = page.getByRole('button', { name: 'Nový tým', exact: true });
  const values = async () =>
    (
      await runtime.pool.query(
        'SELECT id,name,description,created_at,updated_at FROM teams WHERE event_id=$1 ORDER BY id',
        [event.id],
      )
    ).rows;
  async function audit() {
    // Enabled controls can still be fading in after the save response.
    await page.evaluate(async () => {
      await Promise.all(
        document
          .getAnimations()
          .map((animation) => animation.finished.catch(() => {})),
      );
    });
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
    for (const control of [save, add, field(1)]) {
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.goto(`/admin/events/${event.id}?setup=teams`);
  await add.press('Enter');
  await expect(field(1)).toBeFocused();
  await save.click();
  await expect(page.getByRole('alert')).toBeFocused();
  await expect(field(1)).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('alert').getByRole('link').click();
  await expect(field(1)).toBeFocused();
  await field(1).fill('Opravený tým');
  // Field error stays available while correcting; a subsequent save validates again.
  await expect(field(1)).toHaveAttribute('aria-invalid', 'true');
  expect(await values()).toHaveLength(0);
  await save.press('Enter');
  await expect(
    page.getByText('Tabulka týmů byla uložena.', { exact: true }),
  ).toBeVisible();
  await page.getByText('Vložit ze spreadsheetu', { exact: true }).click();
  const paste = page.getByLabel('Řádky z tabulky', { exact: true });
  const preview = page.getByRole('button', {
    name: 'Zobrazit náhled',
    exact: true,
  });
  await paste.fill('A\tB\tC');
  await preview.click();
  await expect(page.getByRole('alert')).toContainText('nejvýše dva sloupce');
  await paste.fill('\tBez názvu');
  await preview.click();
  await expect(
    page.getByRole('button', { name: 'Přidat náhled do tabulky' }),
  ).toBeDisabled();
  await paste.fill(
    'Stejný tým\tPopis\r\nStejný tým\t"Více\nřádků a ""uvozovky"""',
  );
  await preview.click();
  await expect(
    page.getByRole('heading', { name: 'Náhled nových týmů (2)' }),
  ).toBeVisible();
  expect(await values()).toHaveLength(1);
  await page
    .getByRole('button', { name: 'Přidat náhled do tabulky', exact: true })
    .click();
  await expect(field(2)).toBeFocused();
  await expect(field(3, 'Popis týmu')).toHaveValue('Více\nřádků a "uvozovky"');
  await audit();
  await page.route(`**${path}`, (route) =>
    route.request().method() === 'PUT'
      ? route.abort('connectionfailed')
      : route.continue(),
  );
  await save.click();
  await expect(page.getByRole('alert')).toBeFocused();
  await expect(field(2)).toHaveValue('Stejný tým');
  expect(await values()).toHaveLength(1);
  await page.unroute(`**${path}`);
  // Real backend commits, then transport loses the response. Retry must not add duplicates.
  await page.route(`**${path}`, async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    await route.abort('connectionfailed');
  });
  await save.click();
  await expect(page.getByRole('alert')).toBeVisible();
  const committed = await values();
  expect(committed).toHaveLength(3);
  expect(committed.filter((row) => row.name === 'Stejný tým')).toHaveLength(2);
  await page.unroute(`**${path}`);
  await save.press('Enter');
  await expect(
    page.getByText('Tabulka týmů byla uložena.', { exact: true }),
  ).toBeVisible();
  expect(await values()).toEqual(committed);
  await expect(
    page.getByText('Tabulka týmů byla uložena.', { exact: true }),
  ).toBeFocused();
  await page.reload();
  const existing = await values();
  const firstName = await field(1).inputValue();
  const first = existing.find((row) => row.name === firstName)!;
  await field(1).fill('Moje změna');
  const remote = await page.request.patch(
    `/api/events/${event.id}/teams/${first.id}`,
    {
      data: { name: 'Změna v jiném okně', description: 'Aktuální popis' },
      headers: { 'X-D21-Request': '1' },
    },
  );
  expect(remote.ok()).toBe(true);
  // Add a remote team after this editor loaded; comparison must preserve it too.
  expect(
    (
      await page.request.post(`/api/events/${event.id}/teams`, {
        data: { name: 'Přidaný jinde', description: '' },
        headers: { 'X-D21-Request': '1' },
      })
    ).ok(),
  ).toBe(true);
  await save.click();
  await expect(page.getByRole('alert')).toContainText('Tabulka se změnila');
  await expect(field(1)).toHaveValue('Moje změna');
  await expect(save).toBeDisabled();
  await page
    .getByRole('button', { name: 'Načíst aktuální pro porovnání' })
    .click();
  await expect(
    page.getByText('Změna v jiném okně', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Porovnání s aktuální tabulkou' }),
  ).toBeFocused();
  await expect(page.getByText(`ID: ${first.id}`, { exact: true })).toHaveCount(
    2,
  );
  await page
    .getByRole('button', { name: 'Použít moje změny po kontrole' })
    .click();
  await expect(field(1)).toHaveValue('Moje změna');
  await save.click();
  await expect(
    page.getByText('Tabulka týmů byla uložena.', { exact: true }),
  ).toBeVisible();
  expect(await values()).toHaveLength(4);
  expect((await values()).find((row) => row.id === first.id).name).toBe(
    'Moje změna',
  );
  await field(1).fill('Neuložené hodnoty');
  await page.getByRole('button', { name: 'Obnovit týmy', exact: true }).click();
  await expect(field(1)).toHaveValue('Neuložené hodnoty');
  await page
    .getByRole('button', { name: 'Zahodit moje změny a načíst aktuální' })
    .click();
  await expect(field(1)).not.toHaveValue('Neuložené hodnoty');
  await add.click();
  await page.getByRole('button', { name: 'Odebrat nový řádek 5' }).click();
  expect(await values()).toHaveLength(4);
  await audit();
  await page.screenshot({
    path: testInfo.outputPath('stage3-teams.png'),
    fullPage: true,
  });
  // Expiry/revocation clears the protected draft, rather than displaying it on login.
  await field(1).fill('Citlivé místní úpravy');
  await runtime.pool.query(
    'UPDATE sessions SET revoked_at=statement_timestamp() WHERE admin_user_id IS NOT NULL AND revoked_at IS NULL',
  );
  await save.click();
  await expect(page.getByLabel('Heslo', { exact: true })).toBeVisible();
  await expect(page.getByRole('form', { name: 'Tabulka týmů' })).toHaveCount(0);
  expect(
    (await values()).some((row) => row.name === 'Citlivé místní úpravy'),
  ).toBe(false);
});

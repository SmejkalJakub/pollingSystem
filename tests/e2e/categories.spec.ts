import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

test('combined category setup preserves atomicity, exact retries, comparison and frozen configuration', async ({
  page,
  runtime,
}, testInfo) => {
  await page.goto('/admin/login');
  await page.getByLabel('Heslo', { exact: true }).fill(runtime.password);
  await page.getByLabel('Heslo', { exact: true }).press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Vaše eventy' }),
  ).toBeVisible();
  const headers = { 'X-D21-Request': '1' };
  const event = await (
    await page.request.post('/api/events', {
      headers,
      data: { name: 'Kategorie Stage 5', description: '' },
    })
  ).json();
  const groups = [];
  for (const code of ['T', 'V'])
    groups.push(
      await (
        await page.request.post(`/api/events/${event.id}/jury-groups`, {
          headers,
          data: { code, name: `Vlastní porota ${code}` },
        })
      ).json(),
    );
  const teams = [];
  for (let i = 0; i < 7; i++)
    teams.push(
      await (
        await page.request.post(`/api/events/${event.id}/teams`, {
          headers,
          data: {
            name: i < 2 ? 'Stejný tým' : `Tým ${i + 1}`,
            description: '',
          },
        })
      ).json(),
    );
  let failInitialRead = true;
  await page.route('**/api/events/*/votings/*/setup', async (route) => {
    if (route.request().method() === 'GET' && failInitialRead) {
      failInitialRead = false;
      await route.abort('connectionfailed');
    } else await route.continue();
  });
  await page.goto(`/admin/events/${event.id}?setup=categories`);
  await page
    .getByRole('button', { name: 'Nové hlasování', exact: true })
    .press('Enter');
  const form = page.getByRole('form', {
    name: 'Příprava kategorie',
    exact: true,
  });
  const save = form.getByRole('button', {
    name: 'Uložit kategorii',
    exact: true,
  });
  const name = form.getByLabel('Název hlasování', { exact: true });
  await expect(page.getByRole('alert')).toBeFocused();
  await page.getByRole('button', { name: 'Zkusit znovu', exact: true }).click();
  await page.unroute('**/api/events/*/votings/*/setup');
  await expect(name).toBeVisible();
  await save.click();
  await expect(form.getByRole('alert')).toBeFocused();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await form
    .getByRole('alert')
    .getByRole('link', { name: 'Název hlasování', exact: true })
    .click();
  await expect(name).toBeFocused();
  expect(
    (
      await runtime.pool.query('SELECT 1 FROM votings WHERE event_id=$1', [
        event.id,
      ])
    ).rowCount,
  ).toBe(0);
  await name.fill('Kombinovaná kategorie');
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await form.getByLabel('Typ hlasování', { exact: true }).selectOption('final');
  await form
    .getByLabel('Instrukce pro porotu', { exact: true })
    .fill('První instrukce');
  await form.getByLabel('Počet vítězů', { exact: true }).fill('1');
  await form.getByLabel('Maximum kladných hlasů', { exact: true }).fill('2');
  await form.getByLabel('Maximum záporných hlasů', { exact: true }).fill('1');
  await form.getByLabel('Záporné hlasy', { exact: true }).selectOption('yes');
  await form
    .getByLabel('Technická — Vlastní porota T', { exact: true })
    .check();
  await form.getByLabel('Veřejná — Vlastní porota V', { exact: true }).check();
  for (let i = 0; i < 5; i++) {
    await form
      .getByRole('button', { name: 'Přidat položku', exact: true })
      .click();
    await expect(
      form.getByLabel(`Tým, položka ${i + 1}`, { exact: true }),
    ).toBeFocused();
    await form
      .getByLabel(`Tým, položka ${i + 1}`, { exact: true })
      .selectOption(teams[i].id);
  }
  await form
    .getByRole('button', { name: 'Přidat položku', exact: true })
    .click();
  await form
    .getByRole('button', { name: 'Odebrat novou položku 6', exact: true })
    .click();
  await expect(
    form.getByLabel('Tým, položka 5', { exact: true }),
  ).toBeFocused();
  const firstOrder = form.getByLabel('Pořadí, položka 1', { exact: true });
  await firstOrder.fill('');
  await save.click();
  await expect(form.getByRole('alert')).toBeFocused();
  await expect(firstOrder).toHaveValue('');
  await expect(firstOrder).toHaveAttribute('aria-invalid', 'true');
  expect(
    (
      await runtime.pool.query('SELECT 1 FROM votings WHERE event_id=$1', [
        event.id,
      ])
    ).rowCount,
  ).toBe(0);
  await firstOrder.fill('0');
  const stored = async () =>
    Promise.all(
      ['votings', 'voting_items', 'voting_allowed_groups'].map(
        async (table) =>
          (
            await runtime.pool.query(
              `SELECT row_to_json(t)::text AS row FROM ${table} t WHERE event_id=$1 ORDER BY row_to_json(t)::text`,
              [event.id],
            )
          ).rows,
      ),
    );
  // A connection failure preserves all entered values and creates no partial category.
  await page.route('**/api/events/*/votings/*/setup', async (route) => {
    if (route.request().method() === 'PUT')
      await route.abort('connectionfailed');
    else await route.continue();
  });
  await save.click();
  await expect(form.getByRole('alert')).toBeFocused();
  await expect(name).toHaveValue('Kombinovaná kategorie');
  expect((await stored())[0]).toHaveLength(0);
  await page.unroute('**/api/events/*/votings/*/setup');
  let committed: Awaited<ReturnType<typeof stored>> | undefined;
  await page.route('**/api/events/*/votings/*/setup', async (route) => {
    if (route.request().method() === 'PUT') {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      committed = await stored();
      await route.abort('connectionfailed');
    } else await route.continue();
  });
  await save.click();
  await expect(form.getByRole('alert')).toBeFocused();
  expect(committed?.[0]).toHaveLength(1);
  await page.unroute('**/api/events/*/votings/*/setup');
  await save.click();
  await expect(page).toHaveURL(/\/admin\/votings\/[0-9a-f-]+$/);
  expect(await stored()).toEqual(committed);
  const votingId = page.url().split('/').at(-1)!;
  await expect(name).toHaveValue('Kombinovaná kategorie');
  await expect(
    form.getByRole('button', { name: 'Odebrat novou položku 1', exact: true }),
  ).toHaveCount(0);
  await name.fill('Moje změna');
  await expect(
    page.getByRole('button', { name: 'Aktivovat hlasování', exact: true }),
  ).toBeDisabled();
  expect(
    (
      await page.request.patch(`/api/votings/${votingId}`, {
        headers,
        data: { instructions: 'Vzdálené instrukce' },
      })
    ).ok(),
  ).toBe(true);
  const remoteItem = await (
    await page.request.post(`/api/votings/${votingId}/items`, {
      headers,
      data: { teamId: teams[5].id, displayOrder: 10 },
    })
  ).json();
  await save.click();
  await expect(form.getByRole('alert')).toContainText('Kategorie se změnila');
  await expect(name).toHaveValue('Moje změna');
  await expect(save).toBeDisabled();
  await form
    .getByRole('button', { name: 'Načíst aktuální přípravu', exact: true })
    .click();
  await expect(
    form.getByRole('region', { name: 'Porovnání přípravy', exact: true }),
  ).toContainText('Vzdálené instrukce');
  await expect(
    form.getByRole('region', { name: 'Porovnání přípravy', exact: true }),
  ).toContainText(remoteItem.id);
  await form
    .getByRole('button', { name: 'Použít moje změny po kontrole', exact: true })
    .click();
  await expect(name).toHaveValue('Moje změna');
  await expect(
    form.getByLabel('Instrukce pro porotu', { exact: true }),
  ).toHaveValue('Vzdálené instrukce');
  await save.click();
  await expect(
    form.getByText('Kategorie byla uložena.', { exact: true }),
  ).toBeVisible();
  expect(
    (
      await runtime.pool.query(
        'SELECT id FROM voting_items WHERE voting_id=$1',
        [votingId],
      )
    ).rows.map((row) => row.id),
  ).toContain(remoteItem.id);
  await page
    .getByRole('button', { name: 'Aktivovat hlasování', exact: true })
    .click();
  await expect(name).toBeDisabled();
  await page
    .getByRole('form', { name: 'Aktivovat hlasování', exact: true })
    .getByRole('button', { name: 'Zrušit', exact: true })
    .click();
  await expect(name).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Aktivovat hlasování', exact: true }),
  ).toBeFocused();
  // Dirty refresh retains input until the explicit comparison choice.
  await name.fill('Neuložené');
  await form
    .getByRole('button', { name: 'Načíst aktuální přípravu', exact: true })
    .click();
  await expect(name).toHaveValue('Neuložené');
  await form
    .getByRole('button', {
      name: 'Zahodit moje změny a načíst aktuální',
      exact: true,
    })
    .click();
  await expect(name).toHaveValue('Moje změna');
  // Audit the final editable state after control transitions settle.
  await page.waitForTimeout(200);
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
  for (const control of [
    save,
    name,
    form.getByRole('button', { name: 'Přidat položku', exact: true }),
  ])
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({
    path: testInfo.outputPath('stage5-categories.png'),
    fullPage: true,
  });
  for (const group of groups)
    await runtime.pool.query(
      "INSERT INTO event_jurors(event_id,jury_group_id,display_name) SELECT $1,$2,'Test juror' FROM generate_series(1,5)",
      [event.id, group.id],
    );
  await name.fill('Po aktivaci nelze uložit');
  expect(
    (
      await page.request.post(`/api/votings/${votingId}/activate`, {
        headers,
        data: {},
      })
    ).ok(),
  ).toBe(true);
  const frozen = await stored();
  await save.click();
  await expect(form.getByRole('alert')).toContainText('Kategorie se změnila');
  await form
    .getByRole('button', { name: 'Načíst aktuální přípravu', exact: true })
    .click();
  await expect(
    form.getByRole('button', {
      name: 'Použít moje změny po kontrole',
      exact: true,
    }),
  ).toBeDisabled();
  await form
    .getByRole('button', {
      name: 'Zahodit moje změny a načíst aktuální',
      exact: true,
    })
    .click();
  await expect(form).toHaveCount(0);
  expect(await stored()).toEqual(frozen);
  // Current auth loss on another draft clears protected content.
  const draft = await (
    await page.request.post(`/api/events/${event.id}/votings`, {
      headers,
      data: { name: 'Auth draft', instructions: '', kind: 'final' },
    })
  ).json();
  await page.goto(`/admin/votings/${draft.id}`);
  await expect(name).toHaveValue('Auth draft');
  await name.fill('Private edit');
  const cookie = (await page.context().cookies(runtime.origin)).find(
    (cookie) => cookie.name === 'd21-session',
  )!;
  await runtime.pool.query(
    "UPDATE sessions SET revoked_at=statement_timestamp() WHERE token_hash=encode(sha256($1::bytea),'hex')",
    [cookie.value],
  );
  await save.click();
  await expect(page.getByLabel('Heslo', { exact: true })).toBeVisible();
  await expect(name).toHaveCount(0);
});

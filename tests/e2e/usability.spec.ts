import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

test('organizer works directly with saved links, undo, imports and voting controls', async ({
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
  async function write(path: string, data: object, method = 'POST') {
    const response = await page.request.fetch(`/api${path}`, {
      method,
      data,
      headers,
    });
    expect(response.ok(), path).toBe(true);
    return response.json();
  }
  const event = await write('/events', {
    name: 'Organizátorský pracovní prostor',
    description: '',
  });
  const jurorPath = `/events/${event.id}/jurors/table`;
  const base = await (await page.request.get(`/api${jurorPath}`)).json();
  const jurorId = randomUUID();
  await write(
    jurorPath,
    {
      baseVersion: base.version,
      rows: [{ id: jurorId, displayName: 'Uložený porotce', groupCode: 'V' }],
    },
    'PUT',
  );
  const teamPath = `/events/${event.id}/teams/table`;
  const teamBase = await (await page.request.get(`/api${teamPath}`)).json();
  await write(
    teamPath,
    {
      baseVersion: teamBase.version,
      rows: Array.from({ length: 21 }, (_, index) => ({
        id: randomUUID(),
        name: `Tým ${index + 1}`,
        description: '',
      })),
    },
    'PUT',
  );
  await page.goto(`/admin/events/${event.id}`);
  const name = page.getByLabel('Jméno porotce, řádek 1', { exact: true });
  await name.fill('Neuložená oprava');
  await expect(
    page.getByRole('button', { name: /Kopírovat odkaz/ }),
  ).toBeEnabled();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', {
      name: 'Stáhnout odkazy (XLSX)',
      exact: true,
    })
    .click();
  await download;
  await expect(name).toHaveValue('Neuložená oprava');
  expect(
    (
      await runtime.pool.query(
        'SELECT display_name FROM event_jurors WHERE id=$1',
        [jurorId],
      )
    ).rows[0].display_name,
  ).toBe('Uložený porotce');
  await page.getByRole('button', { name: 'Zahodit', exact: true }).click();
  await expect(name).toHaveValue('Uložený porotce');
  await page.getByRole('button', { name: 'Vrátit změny', exact: true }).click();
  await expect(name).toHaveValue('Neuložená oprava');
  await page.getByRole('button', { name: 'Zahodit', exact: true }).click();
  const navigation = page.getByRole('navigation', {
    name: 'Event',
    exact: true,
  });
  await expect(navigation.getByRole('link')).toHaveCount(6);
  await navigation.getByRole('link', { name: /Týmy(?: |$)/u }).click();
  await page
    .getByLabel('Data z tabulky', { exact: true })
    .fill('Nový tým\tPřidán bez mezikroku');
  await page
    .getByRole('button', { name: 'Zobrazit náhled', exact: true })
    .click();
  await expect(
    page.getByLabel('Název týmu, řádek 22', { exact: true }),
  ).toHaveValue('Nový tým');
  expect(
    (
      await runtime.pool.query(
        'SELECT count(*)::int AS count FROM teams WHERE event_id=$1',
        [event.id],
      )
    ).rows[0].count,
  ).toBe(21);
  await page.getByRole('button', { name: 'Zahodit', exact: true }).click();
  await page.getByRole('button', { name: 'Vrátit změny', exact: true }).click();
  await expect(
    page.getByLabel('Název týmu, řádek 22', { exact: true }),
  ).toHaveValue('Nový tým');
  await page.getByRole('button', { name: 'Zahodit', exact: true }).click();
  await navigation.getByRole('link', { name: /\bKategorie(?: |$)/u }).click();
  await page
    .getByRole('button', { name: 'Nová kategorie', exact: true })
    .click();
  const form = page.getByRole('form', {
    name: 'Příprava kategorie',
    exact: true,
  });
  await form.getByLabel('Název', { exact: true }).fill('Finále');
  await form.getByRole('radio', { name: 'Finále', exact: true }).check();
  await form.getByLabel('Počet vítězů', { exact: true }).fill('1');
  await form.getByLabel('Kladných hlasů na porotce', { exact: true }).fill('2');
  await form.getByRole('radio', { name: 'Zakázat', exact: true }).check();
  await expect(
    form.getByLabel('Záporných hlasů', { exact: true }),
  ).toBeDisabled();
  await expect(form.getByLabel('Záporných hlasů', { exact: true })).toHaveValue(
    '0',
  );
  await form.getByRole('checkbox', { name: /^Veřejná porota/ }).check();
  const readiness = form.getByRole('region', { name: 'Před otevřením' });
  await expect(readiness).toContainText('Zařazené týmy 0 / 3 · Chybí 3');
  await form
    .getByText('Upravit přiřazení a přesné pořadí', { exact: true })
    .click();
  await form.getByRole('button', { name: 'Přidat tým', exact: true }).click();
  await expect(readiness).toContainText('Vybrat tým v prázdném řádku (1)');
  await readiness
    .getByRole('link', { name: 'Vybrat tým v prázdném řádku (1)' })
    .press('Enter');
  await expect(
    form.getByLabel('Tým, položka 1', { exact: true }),
  ).toBeFocused();
  await form
    .getByRole('button', { name: 'Přidat všechny týmy eventu', exact: true })
    .click();
  const plusLimit = form.getByLabel('Kladných hlasů na porotce', {
    exact: true,
  });
  await plusLimit.fill('21');
  await expect(readiness).toContainText('Zařazené týmy 21 / 22 · Chybí 1');
  await expect(readiness).toContainText('nejvýše na 20 hlasů celkem');
  await expect(
    readiness.getByRole('link', { name: 'Doplnit týmy v eventu' }),
  ).toHaveAttribute('href', `/admin/events/${event.id}?setup=teams`);
  await readiness.screenshot({
    path: testInfo.outputPath('activation-readiness.png'),
  });
  await readiness
    .getByRole('link', { name: 'Upravit limity hlasů' })
    .press('Enter');
  await expect(plusLimit).toBeFocused();
  await plusLimit.fill('2');
  await expect(form.getByText('Před aktivací uložte kategorii')).toBeVisible();
  await form.getByLabel('Pořadí, položka 21', { exact: true }).focus();
  const save = form.getByRole('button', {
    name: 'Uložit kategorii',
    exact: true,
  });
  const bounds = await save.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  await save.click();
  await expect(page).toHaveURL(/\/admin\/votings\/[0-9a-f-]+$/);
  await expect(
    form.getByText('Kategorie je připravená k aktivaci'),
  ).toBeVisible();
  const votingId = page.url().split('/').at(-1)!;
  const categoryName = form.getByLabel('Název', { exact: true });
  await categoryName.fill('Místní změna');
  await form.getByRole('button', { name: 'Zahodit', exact: true }).click();
  await expect(categoryName).toHaveValue('Finále');
  await form.getByRole('button', { name: 'Vrátit změny', exact: true }).click();
  await expect(categoryName).toHaveValue('Místní změna');
  await form.getByRole('button', { name: 'Zahodit', exact: true }).click();
  await page
    .getByRole('button', { name: 'Otevřít hlasování', exact: true })
    .click();
  await page
    .getByRole('form', { name: 'Aktivovat hlasování', exact: true })
    .getByRole('button', { name: 'Aktivovat', exact: true })
    .click();
  await expect(
    page.getByText('Hlasování bylo aktivováno.', { exact: true }),
  ).toBeVisible();
  await navigation
    .getByRole('link', { name: 'Průběh hlasování', exact: true })
    .click();
  const card = page.getByRole('article', { name: 'Finále', exact: true });
  await page.route(`**/api/votings/${votingId}/close`, (route) =>
    route.abort('connectionfailed'),
  );
  page.once('dialog', (dialog) => dialog.accept());
  await card.getByRole('button', { name: /^Uzavřít hlasování:/ }).click();
  await expect(card.getByRole('alert')).toContainText(
    'Uzavření hlasování se nepodařilo potvrdit. Prohlížeč se nedokázal spojit se serverem.',
  );
  expect(
    (
      await runtime.pool.query('SELECT status FROM votings WHERE id=$1', [
        votingId,
      ])
    ).rows[0].status,
  ).toBe('active');
  await page.unroute(`**/api/votings/${votingId}/close`);

  page.once('dialog', (dialog) => dialog.accept());
  await card.getByRole('button', { name: /^Uzavřít hlasování:/ }).click();
  // Progress lists open categories only; reopening lives on the Categories overview.
  await expect(card).toHaveCount(0);
  expect(
    (
      await runtime.pool.query('SELECT status FROM votings WHERE id=$1', [
        votingId,
      ])
    ).rows[0].status,
  ).toBe('closed');
  await navigation.getByRole('link', { name: /\bKategorie\b/u }).click();
  const overviewCard = page.getByRole('article', {
    name: 'Finále',
    exact: true,
  });
  await overviewCard
    .getByRole('button', { name: /^Znovu otevřít hlasování:/ })
    .click();
  await expect(
    overviewCard.getByRole('button', { name: /^Uzavřít hlasování:/ }),
  ).toBeEnabled();
  expect(
    (
      await runtime.pool.query('SELECT status FROM votings WHERE id=$1', [
        votingId,
      ])
    ).rows[0].status,
  ).toBe('active');
  await expect(
    page.getByRole('form', { name: 'Uzavřít hlasování', exact: true }),
  ).toHaveCount(0);
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
  await page.screenshot({
    path: testInfo.outputPath('organizer-workspace.png'),
    fullPage: true,
  });
});

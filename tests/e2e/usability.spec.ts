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
      name: 'Stáhnout odkazy porotců (XLSX)',
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
  await page
    .getByRole('button', { name: 'Zahodit změny', exact: true })
    .click();
  await expect(name).toHaveValue('Uložený porotce');
  await page.getByRole('button', { name: 'Vrátit změny', exact: true }).click();
  await expect(name).toHaveValue('Neuložená oprava');
  await page
    .getByRole('button', { name: 'Zahodit změny', exact: true })
    .click();
  const navigation = page.getByRole('navigation', {
    name: 'Event',
    exact: true,
  });
  await expect(navigation.getByRole('link')).toHaveCount(5);
  await navigation.getByRole('link', { name: 'Týmy', exact: true }).click();
  await page.getByText('Vložit ze spreadsheetu', { exact: true }).click();
  await page
    .getByLabel('Řádky z tabulky', { exact: true })
    .fill('Nový tým\tPřidán bez mezikroku');
  await page
    .getByRole('button', { name: 'Přidat řádky do tabulky', exact: true })
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
  await page
    .getByRole('button', { name: 'Zahodit změny', exact: true })
    .click();
  await page.getByRole('button', { name: 'Vrátit změny', exact: true }).click();
  await expect(
    page.getByLabel('Název týmu, řádek 22', { exact: true }),
  ).toHaveValue('Nový tým');
  await page
    .getByRole('button', { name: 'Zahodit změny', exact: true })
    .click();
  await navigation
    .getByRole('link', { name: 'Kategorie', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Nové hlasování', exact: true })
    .click();
  const form = page.getByRole('form', {
    name: 'Příprava kategorie',
    exact: true,
  });
  await form.getByLabel('Název hlasování', { exact: true }).fill('Finále');
  await form.getByLabel('Typ hlasování', { exact: true }).selectOption('final');
  await form.getByLabel('Počet vítězů', { exact: true }).fill('1');
  await form.getByLabel('Maximum kladných hlasů', { exact: true }).fill('2');
  await form.getByLabel('Maximum záporných hlasů', { exact: true }).fill('0');
  await form.getByLabel('Záporné hlasy', { exact: true }).selectOption('no');
  await form.getByLabel(/Veřejná —/).check();
  await form
    .getByRole('button', { name: 'Přidat všechny týmy eventu', exact: true })
    .click();
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
  const votingId = page.url().split('/').at(-1)!;
  const categoryName = form.getByLabel('Název hlasování', { exact: true });
  await categoryName.fill('Místní změna');
  await form
    .getByRole('button', { name: 'Zahodit místní změny', exact: true })
    .click();
  await expect(categoryName).toHaveValue('Finále');
  await form.getByRole('button', { name: 'Vrátit změny', exact: true }).click();
  await expect(categoryName).toHaveValue('Místní změna');
  await form
    .getByRole('button', { name: 'Zahodit místní změny', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Aktivovat hlasování', exact: true })
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
  await card.getByRole('button', { name: /^Uzavřít hlasování:/ }).click();
  await expect(card.getByRole('alert')).toContainText('Spojení se serverem');
  expect(
    (
      await runtime.pool.query('SELECT status FROM votings WHERE id=$1', [
        votingId,
      ])
    ).rows[0].status,
  ).toBe('active');
  await page.unroute(`**/api/votings/${votingId}/close`);

  await card.getByRole('button', { name: /^Uzavřít hlasování:/ }).click();
  await expect(
    card.getByRole('button', { name: /^Znovu otevřít hlasování:/ }),
  ).toBeEnabled();
  expect(
    (
      await runtime.pool.query('SELECT status FROM votings WHERE id=$1', [
        votingId,
      ])
    ).rows[0].status,
  ).toBe('closed');
  await card.getByRole('button', { name: /^Znovu otevřít hlasování:/ }).click();
  await expect(
    card.getByRole('button', { name: /^Uzavřít hlasování:/ }),
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

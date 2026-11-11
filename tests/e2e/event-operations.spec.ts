import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

test('public-only event supports all teams, arbitrary jury sizes and working Excel links', async ({
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
      data: { name: 'Veřejná porota – hromadná příprava', description: '' },
    })
  ).json();
  const jurorPath = `/api/events/${event.id}/jurors/table`;
  const jurorBase = await (await page.request.get(jurorPath)).json();
  const jurors = Array.from({ length: 14 }, (_, index) => ({
    id: randomUUID(),
    displayName: `Porotce ${index + 1}`,
    groupCode: 'V',
  }));
  expect(
    (
      await page.request.put(jurorPath, {
        headers,
        data: { baseVersion: jurorBase.version, rows: jurors },
      })
    ).ok(),
  ).toBe(true);
  const teamPath = `/api/events/${event.id}/teams/table`;
  const teamBase = await (await page.request.get(teamPath)).json();
  const teams = Array.from({ length: 21 }, (_, index) => ({
    id: randomUUID(),
    name: index < 2 ? 'Stejný název' : `Tým ${index + 1}`,
    description: '',
  }));
  expect(
    (
      await page.request.put(teamPath, {
        headers,
        data: { baseVersion: teamBase.version, rows: teams },
      })
    ).ok(),
  ).toBe(true);
  await page.goto(`/admin/events/${event.id}?setup=categories`);
  await page
    .getByRole('button', { name: 'Nová kategorie', exact: true })
    .click();
  const form = page.getByRole('form', {
    name: 'Příprava kategorie',
    exact: true,
  });
  await form.getByLabel('Název', { exact: true }).fill('Předvýběr');
  await form.getByRole('radio', { name: 'Výběrové kolo', exact: true }).check();
  await form.getByLabel('Počet postupujících týmů', { exact: true }).fill('6');
  await form
    .getByLabel('Kladných hlasů na porotce', { exact: true })
    .fill('10');
  await form.getByLabel('Záporných hlasů', { exact: true }).fill('3');
  await form.getByRole('radio', { name: 'Povolit', exact: true }).check();
  await form.getByRole('checkbox', { name: /^Veřejná porota/ }).check();
  await form
    .getByText('Upravit přiřazení a přesné pořadí', { exact: true })
    .click();
  await form.getByRole('button', { name: 'Přidat tým', exact: true }).click();
  const team = form.getByRole('checkbox', { name: 'Tým 3', exact: true });
  await team.check();
  await expect(team).toBeChecked();
  await team.uncheck();
  await expect(team).not.toBeChecked();
  await form.getByRole('button', { name: 'Přidat tým', exact: true }).click();
  const bulk = form.getByRole('button', {
    name: 'Přidat všechny týmy eventu',
    exact: true,
  });
  await bulk.press('Enter');
  await expect(
    form.getByRole('heading', {
      name: 'Týmy v kategorii · 21 z 21',
      exact: true,
    }),
  ).toBeFocused();
  await expect(
    form.getByRole('heading', {
      name: 'Týmy v kategorii · 21 z 21',
      exact: true,
    }),
  ).toBeVisible();
  await expect(bulk).toBeDisabled();
  await expect(
    form.getByLabel('Tým, položka 1', { exact: true }),
  ).not.toHaveValue('');
  expect(
    (
      await runtime.pool.query('SELECT 1 FROM voting_items WHERE event_id=$1', [
        event.id,
      ])
    ).rowCount,
  ).toBe(0);
  await form
    .getByRole('button', { name: 'Uložit kategorii', exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/votings\/[0-9a-f-]+$/);
  const votingId = page.url().split('/').at(-1)!;
  const stored = (
    await runtime.pool.query(
      'SELECT id,team_id FROM voting_items WHERE voting_id=$1 ORDER BY id',
      [votingId],
    )
  ).rows;
  expect(stored).toHaveLength(21);
  expect(new Set(stored.map((row) => row.team_id)).size).toBe(21);
  await page.reload();
  await expect(bulk).toBeDisabled();
  await expect(
    form.getByRole('heading', {
      name: 'Týmy v kategorii · 21 z 21',
      exact: true,
    }),
  ).toBeVisible();
  await expect(team).toBeChecked();
  await expect(team).toBeDisabled();
  const moved = await runtime.pool.query(
    'SELECT display_order FROM voting_items WHERE voting_id=$1 AND team_id=$2',
    [votingId, teams[2]!.id],
  );
  await form
    .getByRole('button', { name: 'Posunout Tým 3 výš', exact: true })
    .click();
  const save = form.getByRole('button', {
    name: 'Uložit kategorii',
    exact: true,
  });
  await save.click();
  await expect(
    form.getByText('Kategorie byla uložena.', { exact: true }),
  ).toBeVisible();
  expect(
    (
      await runtime.pool.query(
        'SELECT id,team_id FROM voting_items WHERE voting_id=$1 ORDER BY id',
        [votingId],
      )
    ).rows,
  ).toEqual(stored);
  expect(
    (
      await runtime.pool.query(
        'SELECT display_order FROM voting_items WHERE voting_id=$1 AND team_id=$2',
        [votingId, teams[2]!.id],
      )
    ).rows[0].display_order,
  ).toBeLessThan(moved.rows[0].display_order);
  const originalViewport = page.viewportSize()!;
  async function capture(surface: string) {
    for (const width of [390, 1440]) {
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme });
        await page.evaluate(() => window.scrollTo(0, 0));
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: testInfo.outputPath(
            `r6-${surface}-${width}-${colorScheme}.png`,
          ),
        });
      }
    }
    await page.setViewportSize(originalViewport);
    await page.emulateMedia({
      colorScheme: testInfo.project.use.colorScheme ?? 'light',
    });
  }
  if (testInfo.project.name === 'desktop') {
    await capture('editor');
  }
  await page.screenshot({
    path: testInfo.outputPath('all-event-teams.png'),
    fullPage: true,
  });
  await page.getByRole('link', { name: '← Kategorie', exact: true }).click();
  const readyCard = page.getByRole('article', {
    name: 'Předvýběr',
    exact: true,
  });
  await expect(readyCard).toContainText('Připraveno');
  const open = readyCard.getByRole('button', {
    name: 'Otevřít hlasování',
    exact: true,
  });
  await open.click();
  await readyCard
    .getByRole('form', { name: 'Aktivovat hlasování', exact: true })
    .getByRole('button', { name: 'Zrušit', exact: true })
    .click();
  await expect(open).toBeFocused();
  await readyCard.getByRole('link', { name: 'Upravit', exact: true }).click();
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
  expect(
    (
      await runtime.pool.query('SELECT status FROM votings WHERE id=$1', [
        votingId,
      ])
    ).rows[0].status,
  ).toBe('active');
  await page.goto(`/admin/events/${event.id}?setup=categories`);
  const category = page.getByRole('article', {
    name: 'Předvýběr',
    exact: true,
  });
  await expect(category).toContainText('Odevzdáno 0 / 14');
  await expect(
    category.getByRole('link', { name: 'Průběh', exact: true }),
  ).toHaveAttribute('href', `/admin/dashboard/votings/${votingId}`);
  await expect(
    page.getByText('Osobní odkazy vytvořeny pro všechny', { exact: true }),
  ).toBeVisible();
  const draft = await (
    await page.request.post(`/api/events/${event.id}/votings`, {
      headers,
      data: { name: 'Další koncept', kind: 'final', instructions: '' },
    })
  ).json();
  await page.reload();
  await expect(
    page.getByRole('article', { name: 'Další koncept' }),
  ).toContainText('Před otevřením chybí:');
  if (testInfo.project.name === 'desktop') {
    await capture('overview');
  }
  expect(
    (
      await runtime.pool.query('SELECT status FROM votings WHERE id=$1', [
        draft.id,
      ])
    ).rows[0].status,
  ).toBe('draft');
  const close = category.getByRole('button', { name: /^Uzavřít hlasování:/ });
  page.once('dialog', (dialog) => dialog.dismiss());
  await close.click();
  await expect(category).toContainText('Otevřeno');
  page.once('dialog', (dialog) => dialog.accept());
  await close.click();
  await expect(category).toContainText('Uzavřeno');
  await expect(
    category.getByRole('link', { name: 'Výsledky', exact: true }),
  ).toHaveAttribute('href', `/admin/results/votings/${votingId}`);
  await category
    .getByRole('button', { name: /^Znovu otevřít hlasování:/ })
    .click();
  await expect(category).toContainText('Otevřeno');
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.goto(`/admin/events/${event.id}`);
  const downloadButton = page.getByRole('button', {
    name: 'Stáhnout odkazy (XLSX)',
    exact: true,
  });
  await expect(downloadButton).toBeEnabled();
  await page.route('**/jurors/links.xlsx', (route) =>
    route.abort('connectionfailed'),
  );
  await downloadButton.click();
  await expect(page.getByRole('alert')).toBeFocused();
  await page.unroute('**/jurors/links.xlsx');
  const before = (
    await runtime.pool.query(
      'SELECT token_hash,encrypted_token,revoked_at FROM juror_access WHERE event_id=$1 ORDER BY token_hash',
      [event.id],
    )
  ).rows;
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Zkusit export znovu', exact: true })
    .press('Enter');
  const file = await download;
  expect(file.suggestedFilename()).toBe(`d21-jurors-${event.id}.xlsx`);
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile((await file.path())!);
  const sheet = book.worksheets[0]!;
  expect(sheet.rowCount).toBe(19);
  const link = sheet.getCell('D6').hyperlink;
  expect(typeof link).toBe('string');
  expect(sheet.getCell('B6').text).toBe('Veřejná');
  expect(
    (
      await runtime.pool.query(
        'SELECT token_hash,encrypted_token,revoked_at FROM juror_access WHERE event_id=$1 ORDER BY token_hash',
        [event.id],
      )
    ).rows,
  ).toEqual(before);
  await expect(downloadButton).toBeFocused();
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
  expect((await downloadButton.boundingBox())!.height).toBeGreaterThanOrEqual(
    44,
  );
  await downloadButton.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('juror-links-export.png'),
  });
  const context = await page
    .context()
    .browser()!
    .newContext({ baseURL: runtime.origin });
  try {
    const juror = await context.newPage();
    await juror.goto(link);
    await juror
      .getByRole('button', { name: 'Pokračovat k hlasování', exact: true })
      .click();
    await expect(
      juror.getByRole('heading', { name: 'Předvýběr', exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
  const adminCookie = (await page.context().cookies(runtime.origin)).find(
    (cookie) => cookie.name === 'd21-session',
  )!;
  await runtime.pool.query(
    "UPDATE sessions SET revoked_at=statement_timestamp() WHERE token_hash=encode(sha256($1::bytea),'hex')",
    [adminCookie.value],
  );
  await downloadButton.click();
  await expect(page.getByLabel('Heslo', { exact: true })).toBeVisible();
  await expect(downloadButton).toHaveCount(0);
});

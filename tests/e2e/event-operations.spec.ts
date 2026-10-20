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
    .getByRole('button', { name: 'Nové hlasování', exact: true })
    .click();
  const form = page.getByRole('form', {
    name: 'Příprava kategorie',
    exact: true,
  });
  await form.getByLabel('Název hlasování', { exact: true }).fill('Předvýběr');
  await form
    .getByLabel('Typ hlasování', { exact: true })
    .selectOption('selection');
  await form
    .getByLabel('Počet postupujících týmů (slotů)', { exact: true })
    .fill('6');
  await form.getByLabel('Maximum kladných hlasů', { exact: true }).fill('10');
  await form.getByLabel('Maximum záporných hlasů', { exact: true }).fill('3');
  await form.getByLabel('Záporné hlasy', { exact: true }).selectOption('yes');
  await form.getByLabel('Veřejná — Druhá část poroty', { exact: true }).check();
  await form
    .getByRole('button', { name: 'Přidat položku', exact: true })
    .click();
  const bulk = form.getByRole('button', {
    name: 'Přidat všechny týmy eventu',
    exact: true,
  });
  await bulk.press('Enter');
  await expect(
    form.getByLabel('Tým, položka 1', { exact: true }),
  ).toBeFocused();
  await expect(
    form.getByRole('heading', { name: 'Týmy v hlasování (21)', exact: true }),
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
    form.getByRole('heading', { name: 'Týmy v hlasování (21)', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('all-event-teams.png'),
    fullPage: true,
  });
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
  expect(
    (
      await runtime.pool.query('SELECT status FROM votings WHERE id=$1', [
        votingId,
      ])
    ).rows[0].status,
  ).toBe('active');
  await page.goto(`/admin/events/${event.id}`);
  const downloadButton = page.getByRole('button', {
    name: 'Stáhnout odkazy porotců (XLSX)',
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
      .getByRole('button', { name: 'Pokračovat k přehledu', exact: true })
      .click();
    await expect(juror.getByText('Předvýběr', { exact: true })).toBeVisible();
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

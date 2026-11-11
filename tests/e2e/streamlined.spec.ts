import { test, expect } from './fixtures';

test('organizer navigation preserves the document, protects drafts and opens saved categories', async ({
  page,
  runtime,
}, testInfo) => {
  await page.goto('/admin/login');
  await page.getByLabel('Heslo', { exact: true }).fill(runtime.password);
  await page.getByLabel('Heslo', { exact: true }).press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Vaše eventy' }),
  ).toBeVisible();
  const documentStart = await page.evaluate(() => performance.timeOrigin);
  const reads: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'GET') reads.push(new URL(request.url()).pathname);
  });
  await page.getByRole('button', { name: 'Nový event', exact: true }).click();
  await page
    .getByLabel('Název eventu', { exact: true })
    .fill('Plynulá příprava');
  await page
    .getByRole('form', { name: 'Nový event', exact: true })
    .getByRole('button', { name: 'Uložit', exact: true })
    .click();
  await expect(page).toHaveURL(/\?setup=teams$/);
  const eventId = new URL(page.url()).pathname.split('/').at(-1)!;
  const nav = page.getByRole('navigation', { name: 'Event', exact: true });
  await page.getByRole('button', { name: 'Nový tým', exact: true }).click();
  const team = page.getByLabel('Název týmu, řádek 1', { exact: true });
  await team.fill('Neuložený tým');
  page.once('dialog', (dialog) => dialog.dismiss());
  await nav.getByRole('link', { name: 'Porotci', exact: true }).click();
  await expect(team).toHaveValue('Neuložený tým');
  await expect(page).toHaveURL(/\?setup=teams$/);
  page.once('dialog', (dialog) => dialog.accept());
  await nav.getByRole('link', { name: 'Porotci', exact: true }).click();
  await page.getByRole('button', { name: 'Nový porotce', exact: true }).click();
  const juror = page.getByLabel('Jméno porotce, řádek 1', { exact: true });
  await juror.fill('Neuložený porotce');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.goBack();
  await expect(page).toHaveURL(/\?setup=jurors$/);
  await expect(juror).toHaveValue('Neuložený porotce');
  page.once('dialog', (dialog) => dialog.accept());
  await page.goBack();
  await expect(page).toHaveURL(/\?setup=teams$/);
  await expect(
    page.getByText('Zatím žádné týmy.', { exact: false }),
  ).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\?setup=jurors$/);
  await expect(page.getByLabel('Jméno porotce, řádek 1')).toHaveCount(0);
  await nav
    .getByRole('link', { name: 'Průběh hlasování', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Průběh hlasování', exact: true }),
  ).toBeVisible();
  await nav.getByRole('link', { name: 'Výsledky', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Výsledky hlasování' }),
  ).toBeVisible();
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStart);
  expect(reads.filter((path) => path === '/api/auth/session')).toHaveLength(0);
  expect(
    reads.filter((path) => path === `/api/events/${eventId}`),
  ).toHaveLength(1);
  await nav.getByRole('link', { name: 'Kategorie', exact: true }).click();
  await page
    .getByRole('button', { name: 'Nové hlasování', exact: true })
    .click();
  await page
    .getByLabel('Název hlasování', { exact: true })
    .fill('Nová finálová kategorie');
  await page.getByLabel('Typ hlasování', { exact: true }).selectOption('final');
  await page
    .getByRole('button', { name: 'Uložit kategorii', exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/votings\/[0-9a-f-]+$/);
  await expect(
    page.getByRole('heading', { name: 'Nová finálová kategorie', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Před aktivací zbývá', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: '← Všechny kategorie', exact: true })
    .click();
  await expect(
    page.getByRole('link', { name: /Nová finálová kategorie/ }),
  ).toBeVisible();
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStart);
  await page.screenshot({
    path: testInfo.outputPath('streamlined-categories.png'),
    fullPage: true,
  });
});

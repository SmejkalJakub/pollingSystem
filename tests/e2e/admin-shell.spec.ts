import AxeBuilder from '@axe-core/playwright';
import { eventSchema } from '@d21/contracts';
import { test, expect } from './fixtures';

test('admin login, event cards and guarded event switching share the R4 workspace', async ({
  page,
  runtime,
}, testInfo) => {
  async function inspect(state: string, covered?: string) {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const axe = new AxeBuilder({ page }).withTags([
      'wcag2a',
      'wcag2aa',
      'wcag21aa',
      'wcag22aa',
    ]);
    if (covered) {
      // An open popup legitimately covers this region; it is scanned in every other state.
      axe.exclude(covered);
    }
    const result = await axe.analyze();
    expect(result.violations).toEqual([]);

    if (testInfo.project.name === 'desktop') {
      const viewport = page.viewportSize()!;
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const colorScheme of ['light', 'dark'] as const) {
          await page.emulateMedia({ colorScheme });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await page.screenshot({
            path: testInfo.outputPath(
              `r4-${state}-${width}-${colorScheme}.png`,
            ),
          });
        }
      }
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: null });
    }
  }

  await page.goto(`${runtime.origin}/admin/login`);
  const password = page.getByLabel('Heslo', { exact: true });
  await expect(
    page.getByRole('heading', { name: 'Přihlášení', exact: true }),
  ).toBeVisible();
  await expect(password).toBeVisible();
  await inspect('login');
  await password.fill('disposable invalid password');
  await password.press('Enter');
  await expect(password).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('alert')).toBeFocused();
  await inspect('login-error');
  await password.fill(runtime.password);
  await password.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Vaše eventy' }),
  ).toBeVisible();

  async function addEvent(name: string) {
    const response = await page.request.post('/api/events', {
      headers: { origin: runtime.origin, 'x-d21-request': '1' },
      data: { name, description: '' },
    });
    expect(response.status()).toBe(201);
    return eventSchema.parse(await response.json());
  }

  const first = await addEvent('R4 Připravovaný event');
  const second = await addEvent('R4 Otevřený event');
  const third = await addEvent('R4 Uzavřený event');
  await runtime.pool.query(
    `INSERT INTO votings (event_id,name,kind,status)
     VALUES ($1,'Otevřená kategorie','final','active'),
            ($2,'Uzavřená kategorie','final','closed')`,
    [second.id, third.id],
  );
  await page.reload();
  const cards = page.getByRole('region', { name: 'Seznam eventů' });
  const firstCard = cards.getByRole('link', { name: first.name, exact: true });
  await expect(firstCard).toContainText('chybí kategorie');
  await expect(
    cards.getByRole('link', { name: second.name, exact: true }),
  ).toContainText('Odevzdané lístky 0 / 0');
  await expect(
    cards.getByRole('link', { name: third.name, exact: true }),
  ).toHaveAttribute('href', `/admin/events/${third.id}/results`);
  await inspect('event-list');

  const create = page.getByRole('button', {
    name: '+ Nový event',
    exact: true,
  });
  await create.click();
  const form = page.getByRole('form', { name: 'Nový event', exact: true });
  await expect(form).toBeVisible();
  await inspect('create-event');
  await form.getByRole('button', { name: 'Zrušit', exact: true }).click();
  await expect(create).toBeFocused();

  const documentStart = await page.evaluate(() => performance.timeOrigin);
  await firstCard.click();
  const nav = page.getByRole('navigation', { name: 'Event', exact: true });
  const settings = nav.getByRole('link', {
    name: 'Nastavení eventu',
    exact: true,
  });
  await settings.click();
  await expect(settings).toHaveAttribute('aria-current', 'page');
  await expect(page).toHaveURL(/\?setup=settings$/);
  const switcher = page.getByRole('button', { name: first.name, exact: true });
  await switcher.click();
  let next = page.getByRole('link', { name: second.name, exact: true });
  await expect(next).toHaveAttribute(
    'href',
    `/admin/events/${second.id}?setup=settings`,
  );
  await inspect('event-switcher', '.admin-event-nav');
  await next.press('Escape');
  await expect(switcher).toBeFocused();
  await expect(switcher).toHaveAttribute('aria-expanded', 'false');

  await page
    .getByRole('button', { name: 'Upravit event', exact: true })
    .click();
  await page
    .getByLabel('Název eventu', { exact: true })
    .fill('Neuložený název');
  await switcher.click();
  next = page.getByRole('link', { name: second.name, exact: true });
  page.once('dialog', (dialog) => dialog.dismiss());
  await next.click();
  await expect(page.getByLabel('Název eventu', { exact: true })).toHaveValue(
    'Neuložený název',
  );
  page.once('dialog', (dialog) => dialog.accept());
  await next.click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/events/${second.id}\\?setup=settings$`),
  );
  await expect(settings).toHaveAttribute('aria-current', 'page');
  // Settings is titled by the section; the event name sits under the heading.
  await expect(
    page.getByRole('main').getByText(second.name, { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStart);
  await inspect('settings');
});

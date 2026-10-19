import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

test('compact event workspace keeps context, deep links, preparation and recovery', async ({
  page,
  runtime,
}, testInfo) => {
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
    name: 'Pracovní prostor Stage 2',
    description: 'Příprava místního testu',
  });
  const other = await post('/events', { name: 'Druhý event', description: '' });
  const category = await post(`/events/${event.id}/votings`, {
    name: 'Připravovaná kategorie',
    instructions: '',
    kind: 'final',
  });
  const base = `/admin/events/${event.id}`;
  const eventNav = page.getByRole('navigation', { name: 'Event', exact: true });
  const preparation = page.getByRole('navigation', {
    name: 'Příprava',
    exact: true,
  });
  async function section(name: string) {
    await expect(
      eventNav.getByRole('link', { name, exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(eventNav.getByRole('link')).toHaveCount(3);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      event.name,
    );
    // Category collections load independently of the event heading. Audit settled
    // controls, not their transition from disabled loading state to enabled.
    await expect(page.getByText('Načítání…', { exact: true })).toHaveCount(0);
    await page.evaluate(async () => {
      await Promise.all(
        document
          .getAnimations()
          .map((animation) => animation.finished.catch(() => {})),
      );
    });
    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(violations.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const link of await eventNav.getByRole('link').all()) {
      const box = await link.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.goto(base);
  await expect(
    page.getByRole('button', { name: 'Nový porotce', exact: true }),
  ).toBeVisible();
  await expect(
    preparation.getByRole('link', { name: 'Porotci', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(
    page.getByRole('button', { name: 'Nový tým', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Nové hlasování', exact: true }),
  ).toHaveCount(0);
  await section('Příprava');
  await page.screenshot({
    path: testInfo.outputPath('workspace-jurors.png'),
    fullPage: true,
  });
  await page
    .getByRole('link', { name: 'Přeskočit na obsah', exact: true })
    .focus();
  await page
    .getByRole('link', { name: 'Přeskočit na obsah', exact: true })
    .press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.getByText('Nastavení eventu', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Upravit event', exact: true })
    .press('Enter');
  await page
    .getByRole('form', { name: 'Upravit event', exact: true })
    .getByRole('button', { name: 'Zrušit', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Upravit event', exact: true }),
  ).toBeFocused();
  await page
    .getByRole('button', { name: 'Upravit event', exact: true })
    .click();
  await page
    .getByLabel('Popis (nepovinný)', { exact: true })
    .fill('Upravený popis');
  await page
    .getByRole('form', { name: 'Upravit event', exact: true })
    .getByRole('button', { name: 'Uložit', exact: true })
    .click();
  await expect(
    page.getByText('Event byl uložen.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Upravený popis', { exact: true })).toBeVisible();
  await preparation
    .getByRole('link', { name: 'Týmy', exact: true })
    .press('Enter');
  await expect(page).toHaveURL(`${runtime.origin}${base}?setup=teams`);
  await expect(
    page.getByRole('button', { name: 'Nový tým', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Nový porotce', exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    preparation.getByRole('link', { name: 'Týmy', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Nový tým', exact: true }).click();
  await page
    .getByLabel('Název týmu, řádek 1', { exact: true })
    .fill('Tým s uchovaným názvem');
  await page.route(`**/api/events/${event.id}/teams/table`, (route) =>
    route.request().method() === 'PUT'
      ? route.abort('connectionfailed')
      : route.continue(),
  );
  await page
    .getByRole('form', { name: 'Tabulka týmů', exact: true })
    .getByRole('button', { name: 'Uložit tabulku', exact: true })
    .click();
  await expect(page.getByRole('alert')).toBeFocused();
  await expect(
    page.getByLabel('Název týmu, řádek 1', { exact: true }),
  ).toHaveValue('Tým s uchovaným názvem');
  await page.unroute(`**/api/events/${event.id}/teams/table`);
  await page
    .getByRole('form', { name: 'Tabulka týmů', exact: true })
    .getByRole('button', { name: 'Uložit tabulku', exact: true })
    .press('Enter');
  await expect(
    page.getByText('Tabulka týmů byla uložena.', { exact: true }),
  ).toBeVisible();
  await section('Příprava');
  await page.screenshot({
    path: testInfo.outputPath('workspace-teams.png'),
    fullPage: true,
  });
  await preparation
    .getByRole('link', { name: 'Kategorie', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Kategorie hlasování', exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    preparation.getByRole('link', { name: 'Týmy', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page.goForward();
  await expect(
    preparation.getByRole('link', { name: 'Kategorie', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await section('Příprava');
  await page.screenshot({
    path: testInfo.outputPath('workspace-categories.png'),
    fullPage: true,
  });
  await page.getByRole('link', { name: /Připravovaná kategorie/ }).click();
  await expect(page).toHaveURL(
    `${runtime.origin}/admin/votings/${category.id}`,
  );
  await section('Příprava');
  await page
    .getByRole('link', { name: '← Všechny kategorie', exact: true })
    .click();
  await expect(
    preparation.getByRole('link', { name: 'Kategorie', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await eventNav
    .getByRole('link', { name: 'Průběh hlasování', exact: true })
    .press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Průběh hlasování', exact: true }),
  ).toBeVisible();
  await section('Průběh hlasování');
  await page.screenshot({
    path: testInfo.outputPath('workspace-progress.png'),
    fullPage: true,
  });
  await page.goto(`/admin/dashboard/votings/${category.id}`);
  await expect(
    page.getByRole('heading', { name: category.name, exact: true }),
  ).toBeVisible();
  await section('Průběh hlasování');
  await eventNav.getByRole('link', { name: 'Výsledky', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Výsledky hlasování', exact: true }),
  ).toBeVisible();
  await section('Výsledky');
  await page.screenshot({
    path: testInfo.outputPath('workspace-results.png'),
    fullPage: true,
  });
  await page.goto(`/admin/results/votings/${category.id}`);
  await expect(
    page.getByRole('heading', { name: category.name, exact: true }),
  ).toBeVisible();
  await section('Výsledky');
  await eventNav.getByRole('link', { name: 'Příprava', exact: true }).click();
  await expect(
    preparation.getByRole('link', { name: 'Porotci', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  // Unknown view names safely fall back to jurors, with no domain action.
  await page.goto(`${base}?setup=unknown`);
  await expect(
    preparation.getByRole('link', { name: 'Porotci', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page.goto(`/admin/events/${other.id}?setup=teams`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(other.name);
  await expect(
    page.getByText('Tým s uchovaným názvem', { exact: true }),
  ).toHaveCount(0);
  await expect(
    eventNav.getByRole('link', { name: 'Výsledky', exact: true }),
  ).toHaveAttribute('href', `/admin/events/${other.id}/results`);
  await eventNav.getByRole('link', { name: 'Výsledky', exact: true }).click();
  await expect(
    page.getByText('Event zatím nemá žádné hlasovací kategorie.'),
  ).toBeVisible();
  // Read-only navigation does not activate drafts, create ballots or append audit history.
  expect(
    (
      await runtime.pool.query('SELECT status FROM votings WHERE id=$1', [
        category.id,
      ])
    ).rows[0].status,
  ).toBe('draft');
  expect(
    (
      await runtime.pool.query(
        'SELECT count(*)::int AS n FROM ballots WHERE event_id=$1',
        [event.id],
      )
    ).rows[0].n,
  ).toBe(0);
  expect(
    (
      await runtime.pool.query(
        'SELECT count(*)::int AS n FROM audit_logs WHERE event_id=$1',
        [event.id],
      )
    ).rows[0].n,
  ).toBe(0);
  await page.goto(`${base}?setup=teams`);
  // Finish the initial collection read before simulating a later refresh outage.
  await expect(
    page.getByLabel('Název týmu, řádek 1', { exact: true }),
  ).toHaveValue('Tým s uchovaným názvem');
  await page.route(`**/api/events/${event.id}/teams/table`, (route) =>
    route.abort('connectionfailed'),
  );
  await page.getByRole('button', { name: 'Obnovit týmy', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(
    page.getByLabel('Název týmu, řádek 1', { exact: true }),
  ).toHaveValue('Tým s uchovaným názvem');
  await page.unroute(`**/api/events/${event.id}/teams/table`);
  await page
    .getByRole('button', { name: 'Obnovit týmy', exact: true })
    .press('Enter');
  await expect(
    page.getByLabel('Název týmu, řádek 1', { exact: true }),
  ).toHaveValue('Tým s uchovaným názvem');
  await runtime.pool.query(
    'UPDATE sessions SET revoked_at=statement_timestamp() WHERE admin_user_id IS NOT NULL AND revoked_at IS NULL',
  );
  await page.reload();
  await expect(page.getByLabel('Heslo', { exact: true })).toBeVisible();
  await expect(eventNav).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: event.name, exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('Heslo', { exact: true }).fill(runtime.password);
  await page.getByLabel('Heslo', { exact: true }).press('Enter');
  await expect(
    preparation.getByRole('link', { name: 'Týmy', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});

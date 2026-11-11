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
  for (const name of ['Kopírování', 'Původní odkaz', 'Bez odkazu']) {
    jurors.push(
      await post(`/events/${event.id}/jurors`, {
        displayName: name,
        juryGroupId: group.id,
      }),
    );
  }
  const legacyToken = newSecret();
  await runtime.pool.query(
    'UPDATE juror_access SET token_hash=$1,encrypted_token=NULL WHERE event_id=$2 AND juror_id=$3',
    [secretHash(legacyToken), event.id, jurors[1].id],
  );
  await runtime.pool.query(
    'UPDATE juror_access SET revoked_at=now() WHERE event_id=$1 AND juror_id=$2',
    [event.id, jurors[2].id],
  );
  await runtime.pool.query(
    "INSERT INTO event_jurors(event_id,jury_group_id,display_name) VALUES ($1,$2,'Nikdy nevydaný')",
    [event.id, group.id],
  );
  await page.goto(`/admin/events/${event.id}`);
  const row = page
    .getByRole('row')
    .filter({ has: page.getByText('Kopírování', { exact: true }) });
  const copy = row.getByRole('button', { name: /Kopírovat odkaz/ });
  await expect(copy).toBeEnabled();
  await expect(
    page.getByRole('button', { name: /Osobní přístup/ }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/Odkaz vznikne při uložení tabulky/),
  ).toBeVisible();
  const legacyRow = page
    .getByRole('row')
    .filter({ has: page.getByText('Původní odkaz', { exact: true }) });
  const revokedRow = page
    .getByRole('row')
    .filter({ has: page.getByText('Bez odkazu', { exact: true }) });
  await expect(
    legacyRow.getByRole('button', { name: /Kopírovat odkaz/ }),
  ).toBeDisabled();
  await expect(legacyRow.getByText(/Původní odkaz funguje/)).toBeVisible();
  await expect(revokedRow.getByText(/Přístup zrušen/)).toBeVisible();
  await page
    .getByRole('button', { name: 'Uložit tabulku', exact: true })
    .click();
  await expect(
    page.getByText('Tabulka porotců byla uložena.', { exact: true }),
  ).toBeVisible();
  const historicalRow = page
    .getByRole('row')
    .filter({ has: page.getByText('Nikdy nevydaný', { exact: true }) });
  await expect(
    historicalRow.getByRole('button', { name: /Kopírovat odkaz/ }),
  ).toBeEnabled();
  await expect(
    legacyRow.getByRole('button', { name: /Kopírovat odkaz/ }),
  ).toBeDisabled();
  await expect(
    revokedRow.getByRole('button', { name: /Kopírovat odkaz/ }),
  ).toBeDisabled();
  await copy.focus();
  await copy.press('Enter');
  await expect(row.getByRole('status').first()).toContainText('byl zkopírován');
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(new URL(link).hash.includes('key=')).toBe(true);
  await expect(copy).toBeFocused();
  const jurorContext = await browser.newContext({ baseURL: runtime.origin });
  try {
    const jurorPage = await jurorContext.newPage();
    await jurorPage.goto('/#event=incomplete');
    await expect(jurorPage.getByRole('alert')).toContainText(
      'Odkaz není úplný',
    );
    await expect(jurorPage.getByRole('button')).toHaveCount(0);
    let redemptions = 0;
    jurorPage.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/auth/juror/start') {
        redemptions++;
      }
    });
    await jurorPage.goto(link);
    const entryDocument = await jurorPage.evaluate(
      () => performance.timeOrigin,
    );
    const entryReads: string[] = [];
    jurorPage.on('request', (request) => {
      if (request.method() === 'GET') {
        entryReads.push(new URL(request.url()).pathname);
      }
    });
    await expect(
      jurorPage.getByRole('heading', { name: 'Vítejte v porotě' }),
    ).toBeFocused();
    expect(redemptions).toBe(0);
    expect(new URL(jurorPage.url()).hash).toBe('');
    await jurorPage
      .getByRole('button', { name: 'Pokračovat k hlasování', exact: true })
      .click();
    await expect(jurorPage).toHaveURL(/\/wizard$/);
    await expect(
      jurorPage.getByText(/^Kopírování · (Technická|Veřejná) porota$/),
    ).toBeVisible();
    expect(await jurorPage.evaluate(() => performance.timeOrigin)).toBe(
      entryDocument,
    );
    expect(entryReads).not.toContain('/api/wizard/current');
    expect(redemptions).toBe(1);
    const emptyHeading = jurorPage.getByRole('heading', {
      name: 'Zatím žádné dostupné kategorie',
    });
    await expect(emptyHeading).toBeFocused();
    const refreshed = jurorPage.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/wizard/current',
    );
    await jurorPage.getByRole('button', { name: 'Zkontrolovat znovu' }).click();
    expect((await refreshed).ok()).toBe(true);
    await expect(emptyHeading).toBeVisible();
    const emptyScan = await new AxeBuilder({ page: jurorPage })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(emptyScan.violations.map(({ id }) => id)).toEqual([]);
    if (testInfo.project.name === 'desktop') {
      const viewport = jurorPage.viewportSize()!;
      for (const width of [390, 1280, 1440]) {
        for (const scheme of ['light', 'dark'] as const) {
          await jurorPage.setViewportSize({ width, height: 900 });
          await jurorPage.emulateMedia({ colorScheme: scheme });
          await jurorPage.screenshot({
            path: testInfo.outputPath(`r3-empty-${width}-${scheme}.png`),
          });
        }
      }
      await jurorPage.setViewportSize(viewport);
      await jurorPage.emulateMedia({ colorScheme: null });
    }

    // Legacy replacement stays explicit; cancellation preserves the working session.
    const menu = legacyRow.getByLabel(/^Další možnosti:/);
    await menu.press('Enter');
    await expect(legacyRow.locator('details')).toHaveAttribute('open', '');
    await menu.press('Escape');
    await expect(legacyRow.locator('details')).not.toHaveAttribute('open', '');
    await expect(menu).toBeFocused();
    await menu.press('Enter');
    const legacyContext = await browser.newContext({ baseURL: runtime.origin });
    try {
      const entered = await legacyContext.request.post(
        '/api/auth/juror/start',
        {
          headers: { 'X-D21-Request': '1' },
          data: { eventId: event.id, token: legacyToken },
        },
      );
      expect(entered.ok()).toBe(true);
      await legacyRow
        .getByRole('button', { name: 'Nahradit odkaz…', exact: true })
        .press('Enter');
      await expect(
        page.getByRole('heading', {
          name: 'Nahradit osobní odkaz?',
          exact: true,
        }),
      ).toBeFocused();
      await expect(
        page.getByRole('form', { name: 'Nahradit osobní odkaz?', exact: true }),
      ).toContainText(jurors[1].id);
      await expect(
        page.getByRole('form', { name: 'Nahradit osobní odkaz?', exact: true }),
      ).toContainText('Původní odkaz');
      await expect(
        row.getByRole('textbox', { name: /^Jméno porotce,/ }),
      ).toBeDisabled();
      await page
        .getByRole('button', { name: 'Zrušit', exact: true })
        .press('Enter');
      // The row menu closes on selection, so focus returns to its trigger.
      await expect(legacyRow.getByLabel(/^Další možnosti:/)).toBeFocused();
      expect(
        (await legacyContext.request.get('/api/wizard/current')).status(),
      ).toBe(200);
      await legacyRow.getByLabel(/^Další možnosti:/).click();
      await legacyRow
        .getByRole('button', { name: 'Nahradit odkaz…', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Potvrdit náhradu', exact: true })
        .click();
      await expect(
        legacyRow.getByRole('button', { name: /Kopírovat odkaz/ }),
      ).toBeEnabled();
      expect(
        (await legacyContext.request.get('/api/wizard/current')).status(),
      ).toBe(401);
      expect(
        (await jurorPage.request.get('/api/wizard/current')).status(),
      ).toBe(200);
    } finally {
      await legacyContext.close();
    }
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
      jurorPage.getByText(/^Kopírování · (Technická|Veřejná) porota$/),
    ).toBeVisible();
    const current = await jurorPage.request.get('/api/wizard/current');
    expect(current.status()).toBe(200);
    expect((await current.json()).expiresAt).toBeNull();
    await page.reload();
    await copy.click();
    await expect(row.getByRole('status').first()).toContainText(
      'byl zkopírován',
    );
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
    await expect(row.getByRole('status').first()).toContainText('Ctrl+C');
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
    await row.getByLabel(/^Další možnosti:/).click();
    await page
      .getByRole('button', { name: 'Nahradit odkaz…', exact: true })
      .click();
    await expect(
      page.getByRole('form', { name: 'Nahradit osobní odkaz?' }),
    ).toBeVisible();
    // Opening/cancelling a consequential action must leave the current session intact.
    await page.getByRole('button', { name: 'Zrušit', exact: true }).click();
    expect((await jurorPage.request.get('/api/wizard/current')).status()).toBe(
      200,
    );
    await row.getByLabel(/^Další možnosti:/).click();
    await page
      .getByRole('button', { name: 'Zrušit přístup…', exact: true })
      .click();
    await page
      .getByRole('form', { name: 'Zrušit odkazy a přihlášení?' })
      .getByRole('button', { name: 'Zrušit přístup', exact: true })
      .click();
    await expect(row.getByText(/Přístup zrušen/)).toBeVisible();
    expect((await jurorPage.request.get('/api/wizard/current')).status()).toBe(
      401,
    );
    await expect(copy).toBeDisabled();
    await expect(
      row.getByRole('button', { name: 'Obnovit odkaz…', exact: true }),
    ).toBeFocused();
    // Saving again must never revive intentionally revoked access.
    const snapshot = await (
      await page.request.get(`/api/events/${event.id}/jurors/table`)
    ).json();
    const result = await page.request.put(
      `/api/events/${event.id}/jurors/table`,
      {
        headers: { 'X-D21-Request': '1' },
        data: {
          baseVersion: snapshot.version,
          rows: snapshot.jurors.map(
            (j: { id: string; displayName: string; juryGroupId: string }) => ({
              id: j.id,
              displayName: j.displayName,
              groupCode: snapshot.groups.find(
                (g: { id: string }) => g.id === j.juryGroupId,
              ).code,
            }),
          ),
        },
      },
    );
    expect(result.ok()).toBe(true);
    expect((await jurorPage.request.get('/api/wizard/current')).status()).toBe(
      401,
    );
    await page.reload();
    await expect(copy).toBeDisabled();
    await row
      .getByRole('button', { name: 'Obnovit odkaz…', exact: true })
      .click();
    await expect(
      row.getByRole('textbox', { name: /^Jméno porotce,/ }),
    ).toBeDisabled();
    await page
      .getByRole('button', { name: 'Potvrdit náhradu', exact: true })
      .click();
    await expect(copy).toBeEnabled();
    await expect(copy).toBeFocused();
    await copy.click();
    await expect(row.getByRole('status').first()).toContainText(
      'byl zkopírován',
    );
    expect(
      await page
        .evaluate(() => navigator.clipboard.readText())
        .then((value) => value !== link),
    ).toBe(true);
    expect((await jurorPage.request.get('/api/wizard/current')).status()).toBe(
      401,
    );
    // Capture after interactions: full-page screenshots can change Chromium's
    // focus-scroll position on narrow viewports between pointer down/up.
    await row.getByLabel(/^Další možnosti:/).click();
    await page.screenshot({
      path: testInfo.outputPath(`stage1-roster-${testInfo.project.name}.png`),
      fullPage: true,
    });
  } finally {
    await jurorContext.close();
  }
});

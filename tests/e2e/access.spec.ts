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
  for (const name of ['Kopírování', 'Původní odkaz', 'Bez odkazu'])
    jurors.push(
      await post(`/events/${event.id}/jurors`, {
        displayName: name,
        juryGroupId: group.id,
      }),
    );
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
  await expect(revokedRow.getByText(/Přístup byl zrušen/)).toBeVisible();
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
    await jurorPage.goto(link);
    await jurorPage
      .getByRole('button', { name: 'Pokračovat k přehledu', exact: true })
      .click();
    await expect(jurorPage).toHaveURL(/\/wizard$/);
    await expect(
      jurorPage.getByText('Kopírování', { exact: true }),
    ).toBeVisible();
    // Legacy replacement stays explicit; cancellation preserves the working session.
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
        .getByRole('button', { name: 'Nahradit odkaz', exact: true })
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
        row.getByRole('textbox', {
          name: 'Jméno porotce, řádek 1',
          exact: true,
        }),
      ).toBeDisabled();
      await page
        .getByRole('button', { name: 'Zrušit', exact: true })
        .press('Enter');
      await expect(
        legacyRow.getByRole('button', { name: 'Nahradit odkaz', exact: true }),
      ).toBeFocused();
      expect(
        (await legacyContext.request.get('/api/wizard/current')).status(),
      ).toBe(200);
      await legacyRow
        .getByRole('button', { name: 'Nahradit odkaz', exact: true })
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
      jurorPage.getByText('Kopírování', { exact: true }),
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
    await page.getByLabel('Hledat porotce', { exact: true }).fill('Kopírování');
    await page
      .getByRole('button', { name: 'Nahradit odkaz', exact: true })
      .click();
    await expect(
      page.getByRole('form', { name: 'Nahradit osobní odkaz?' }),
    ).toBeVisible();
    // Opening/cancelling a consequential action must leave the current session intact.
    await page.getByRole('button', { name: 'Zrušit', exact: true }).click();
    expect((await jurorPage.request.get('/api/wizard/current')).status()).toBe(
      200,
    );
    await page
      .getByRole('button', { name: 'Zrušit odkazy a přihlášení', exact: true })
      .click();
    await page
      .getByRole('form', { name: 'Zrušit odkazy a přihlášení?' })
      .getByRole('button', { name: 'Zrušit přístup', exact: true })
      .click();
    expect((await jurorPage.request.get('/api/wizard/current')).status()).toBe(
      401,
    );
    await expect(copy).toBeDisabled();
    await expect(row.getByText(/Přístup byl zrušen/)).toBeVisible();
    await expect(
      row.getByRole('button', { name: 'Obnovit odkaz', exact: true }),
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
      .getByRole('button', { name: 'Obnovit odkaz', exact: true })
      .click();
    await expect(
      page.getByRole('textbox', {
        name: 'Jméno porotce, řádek 1',
        exact: true,
      }),
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
    await page.getByLabel('Hledat porotce', { exact: true }).fill('Kopírování');
    await page.screenshot({
      path: testInfo.outputPath(`stage1-roster-${testInfo.project.name}.png`),
      fullPage: true,
    });
  } finally {
    await jurorContext.close();
  }
});

import {
  type APIRequestContext,
  type Page,
  type TestInfo,
} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import {
  ballotDraftSchema,
  eventSchema,
  juryGroupListSchema,
  jurorListSchema,
  teamListSchema,
  votingRecordSchema,
  votingItemListSchema,
  wizardCurrentSchema,
  wizardStepDetailSchema,
  dashboardOverviewSchema,
  resultsOverviewSchema,
  wizardFinalSubmitSchema,
} from '@d21/contracts';
import { test, expect } from './fixtures';

async function api(
  request: APIRequestContext,
  method: string,
  path: string,
  data?: object,
) {
  const response = await request.fetch(`/api${path}`, {
    method,
    data,
    headers: { 'X-D21-Request': '1' },
  });
  expect(response.ok(), `${method} ${path}: ${response.status()}`).toBe(true);
  return response.status() === 204 ? null : response.json();
}

async function accessible(page: Page) {
  // Audit settled colours, not a colour-scheme or hover transition in progress.
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        // Infinite indicators never finish; transitions do.
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    result.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  // Empty when the page does not scroll sideways; otherwise names the culprits.
  expect(
    await page.evaluate(() => {
      const width = document.documentElement.scrollWidth;
      if (width <= innerWidth) {
        return [];
      }
      const wide = Array.from(document.querySelectorAll('body *'))
        .filter((element) => element.getBoundingClientRect().right > innerWidth)
        .slice(0, 6)
        .map((element) => `${element.tagName}.${element.className}`);
      return [`scrollWidth ${width} > ${innerWidth}`, ...wide];
    }),
  ).toEqual([]);
}

async function captureR3(page: Page, testInfo: TestInfo, state: string) {
  if (testInfo.project.name !== 'desktop') {
    return;
  }
  const viewport = page.viewportSize()!;
  for (const width of [390, 1280, 1440]) {
    for (const scheme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.screenshot({
        path: testInfo.outputPath(`r3-${state}-${width}-${scheme}.png`),
      });
    }
  }
  await page.setViewportSize(viewport);
  await page.emulateMedia({ colorScheme: null });
}

async function captureR7(page: Page, testInfo: TestInfo, screen: string) {
  if (testInfo.project.name !== 'desktop') {
    return;
  }
  const viewport = page.viewportSize()!;
  for (const width of [390, 1440]) {
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await accessible(page);
      await page.screenshot({
        path: testInfo.outputPath(`r7-${screen}-${width}-${colorScheme}.png`),
        fullPage: true,
      });
    }
  }
  await page.setViewportSize(viewport);
  await page.emulateMedia({ colorScheme: null });
}

test('admin prepares an event; T/V jurors vote; dashboard, ranking, unlock and XLSX agree', async ({
  page,
  browser,
  runtime,
  colorScheme,
  reducedMotion,
}, testInfo) => {
  await page.goto('/admin/login');
  await page.getByLabel('Heslo', { exact: true }).fill(runtime.password);
  await page.getByLabel('Heslo', { exact: true }).press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Vaše eventy' }),
  ).toBeVisible();
  await accessible(page);
  await page.getByRole('button', { name: '+ Nový event', exact: true }).click();
  await page
    .getByLabel('Název eventu', { exact: true })
    .fill('Integrovaný test');
  await page
    .getByRole('form', { name: 'Nový event', exact: true })
    .getByRole('button', { name: 'Vytvořit a přidat týmy →', exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/events\/[0-9a-f-]+\?setup=teams$/);
  const eventId = new URL(page.url()).pathname.split('/').at(-1)!;
  eventSchema.parse(await api(page.request, 'GET', `/events/${eventId}`));
  await page.getByRole('link', { name: /\bPorotci(?: |$)/u }).click();
  await page
    .getByRole('textbox', { name: 'Přidat porotce', exact: true })
    .fill('Nový porotce');
  await page
    .getByRole('textbox', { name: 'Přidat porotce', exact: true })
    .press('Enter');
  await page
    .getByLabel('Jméno porotce, řádek 1', { exact: true })
    .fill('Porotce T1');
  await page
    .getByLabel('Část poroty, řádek 1', { exact: true })
    .selectOption('T');
  await page
    .getByRole('button', { name: 'Uložit tabulku', exact: true })
    .click();
  await expect(
    page.getByText('Tabulka porotců byla uložena.', { exact: true }),
  ).toBeVisible();
  const groups = juryGroupListSchema.parse(
    await api(page.request, 'GET', `/events/${eventId}/jury-groups`),
  );
  expect(groups.map((group) => group.code)).toEqual(['T', 'V']);
  // Repetitive roster entries use the real guarded HTTP API; no SQL setup bypasses activation.
  for (const group of groups) {
    for (let i = group.code === 'T' ? 2 : 1; i <= 5; i++) {
      await api(page.request, 'POST', `/events/${eventId}/jurors`, {
        displayName: `Porotce ${group.code}${i}`,
        juryGroupId: group.id,
      });
    }
  }
  const jurors = jurorListSchema.parse(
    await api(page.request, 'GET', `/events/${eventId}/jurors`),
  );
  await page
    .getByRole('group', { name: 'Příprava', exact: true })
    .getByRole('link', { name: /Týmy(?: |$)/u })
    .click();
  await page
    .getByRole('textbox', { name: 'Přidat tým', exact: true })
    .fill('Nový tým');
  await page
    .getByRole('textbox', { name: 'Přidat tým', exact: true })
    .press('Enter');
  await page.getByLabel('Název týmu, řádek 1', { exact: true }).fill('Tým 1');
  await page
    .getByLabel('Popis týmu, řádek 1', { exact: true })
    .fill('Popis týmu 1');
  await page
    .getByRole('button', { name: 'Uložit tabulku', exact: true })
    .click();
  await expect(
    page.getByText('Tabulka týmů byla uložena.', { exact: true }),
  ).toBeVisible();
  for (let i = 2; i <= 8; i++) {
    await api(page.request, 'POST', `/events/${eventId}/teams`, {
      name: `Tým ${i}`,
      description: `Popis týmu ${i}`,
    });
  }
  const teams = teamListSchema.parse(
    await api(page.request, 'GET', `/events/${eventId}/teams`),
  );
  await page
    .getByRole('group', { name: 'Příprava', exact: true })
    .getByRole('link', { name: /\bKategorie(?: |$)/u })
    .click();
  await page
    .getByRole('button', { name: 'Nová kategorie', exact: true })
    .click();
  await page.getByLabel('Název', { exact: true }).fill('Výběr');
  await page.getByRole('radio', { name: 'Výběrové kolo', exact: true }).check();
  await page
    .getByRole('button', { name: 'Uložit kategorii', exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/votings\/[0-9a-f-]+$/);
  const selection = page.url().split('/').at(-1)!;
  await page.getByLabel('Počet postupujících týmů', { exact: true }).fill('1');
  await page.getByLabel('Kladných hlasů na porotce', { exact: true }).fill('2');
  await page.getByLabel('Záporných hlasů', { exact: true }).fill('1');
  await page.getByRole('radio', { name: 'Povolit', exact: true }).check();
  await page
    .getByRole('button', { name: 'Uložit kategorii', exact: true })
    .click();
  await expect(
    page.getByText('Kategorie byla uložena.', { exact: true }),
  ).toBeVisible();
  const candidates = new Map<string, string[]>();
  async function entries(id: string, allowed: string[]) {
    await api(page.request, 'PUT', `/votings/${id}/allowed-groups`, {
      juryGroupIds: allowed,
    });
    for (const [i, team] of teams.entries()) {
      await api(page.request, 'POST', `/votings/${id}/items`, {
        teamId: team.id,
        displayOrder: i,
      });
    }
    candidates.set(
      id,
      votingItemListSchema
        .parse(await api(page.request, 'GET', `/votings/${id}/items`))
        .map((i) => i.id),
    );
  }
  await entries(
    selection,
    groups.map((g) => g.id),
  );
  await page.reload();
  await page
    .getByRole('button', { name: 'Otevřít hlasování', exact: true })
    .click();
  await page.getByRole('button', { name: 'Aktivovat', exact: true }).click();
  await expect(
    page.getByText('Hlasování bylo aktivováno.', { exact: true }),
  ).toBeVisible();
  const categories = [{ id: selection, name: 'Výběr', group: 'both' }];
  for (const [name, group, places, plus, minus] of [
    ['Celkový vítěz', 'both', 3, 4, 2],
    ['Technické řešení', 'T', 1, 2, 1],
    ['Prezentace', 'V', 1, 2, 0],
  ] as const) {
    const voting = votingRecordSchema.parse(
      await api(page.request, 'POST', `/events/${eventId}/votings`, {
        name,
        instructions: '',
        kind: 'final',
      }),
    );
    await api(page.request, 'PUT', `/votings/${voting.id}/configuration`, {
      selectedPlaces: places,
      maxPlusVotes: plus,
      maxMinusVotes: minus,
      allowNegativeVotes: minus > 0,
    });
    await entries(
      voting.id,
      groups
        .filter((g) => group === 'both' || g.code === group)
        .map((g) => g.id),
    );
    await api(page.request, 'POST', `/votings/${voting.id}/activate`, {});
    categories.push({ id: voting.id, name, group });
  }
  await accessible(page);
  const contexts = [];
  const savedRequests = new Map<string, object>();
  try {
    for (const code of ['T', 'V']) {
      const context = await browser.newContext({
        baseURL: runtime.origin,
        viewport: page.viewportSize()!,
        colorScheme,
        reducedMotion,
      });
      contexts.push(context);
      const jurorPage = await context.newPage();
      const juror = jurors.find((j) => j.displayName === `Porotce ${code}1`)!;
      const link = z
        .object({ url: z.url() })
        .parse(
          await api(
            page.request,
            'POST',
            `/events/${eventId}/jurors/${juror.id}/access/copy`,
            {},
          ),
        ).url;
      await jurorPage.goto(link);
      if (code === 'T') {
        await expect(
          jurorPage.getByRole('heading', { name: 'Vítejte v porotě' }),
        ).toBeVisible();
        await accessible(jurorPage);
        await captureR3(jurorPage, testInfo, 'entry');
      }
      await jurorPage
        .getByRole('button', { name: 'Pokračovat k hlasování', exact: true })
        .click();
      expect(new URL(jurorPage.url()).hash).toBe('');
      // Wait for redemption to finish before reusing the session cookie.
      await expect(jurorPage).toHaveURL(/\/wizard\/steps\/[0-9a-f-]{36}$/);
      const current = wizardCurrentSchema.parse(
        await api(jurorPage.request, 'GET', '/wizard/current'),
      );
      const [first, second] = current.steps;
      await expect(jurorPage).toHaveURL(`/wizard/steps/${first!.id}`);
      const jurorDocument = await jurorPage.evaluate(
        () => performance.timeOrigin,
      );
      const jurorNav = jurorPage.getByRole('navigation', {
        name: 'Kategorie',
        exact: true,
      });
      const firstTab = jurorNav.locator(`[href="/wizard/steps/${first!.id}"]`);
      const secondTab = jurorNav.locator(
        `[href="/wizard/steps/${second!.id}"]`,
      );
      const firstVote = jurorPage
        .getByRole('button', { name: /^Kladný hlas:/ })
        .first();
      const leavePrompt = jurorPage.getByRole('region', {
        name: 'Neuložené změny',
      });
      await expect(firstTab).toHaveAttribute('aria-current', 'page');
      await firstVote.click();
      await secondTab.click();
      await expect(leavePrompt).toHaveText(
        /Máte neuložené změny v této kategorii/,
      );
      await expect(jurorPage).toHaveURL(`/wizard/steps/${first!.id}`);
      await expect(firstVote).toHaveAttribute('aria-pressed', 'true');
      const unsaved = wizardStepDetailSchema.parse(
        await api(jurorPage.request, 'GET', `/wizard/steps/${first!.id}`),
      );
      expect(unsaved.ballot).toBeNull();
      await leavePrompt
        .getByRole('button', { name: 'Zahodit', exact: true })
        .click();
      await expect(secondTab).toHaveAttribute('aria-current', 'page');
      await firstVote.click();
      await jurorPage.goBack();
      await expect(leavePrompt).toBeVisible();
      await expect(jurorPage).toHaveURL(`/wizard/steps/${second!.id}`);
      await expect(firstVote).toHaveAttribute('aria-pressed', 'true');
      await leavePrompt
        .getByRole('button', { name: 'Zahodit', exact: true })
        .click();
      await expect(firstVote).toHaveAttribute('aria-pressed', 'false');
      await jurorPage.goForward();
      await expect(
        jurorPage.getByRole('heading', { name: second!.name, exact: true }),
      ).toBeFocused();
      await firstTab.click();
      await expect(
        jurorPage.getByRole('heading', { name: first!.name, exact: true }),
      ).toBeFocused();
      expect(await jurorPage.evaluate(() => performance.timeOrigin)).toBe(
        jurorDocument,
      );
      if (testInfo.project.name === 'desktop') {
        const secondVote = jurorPage
          .getByRole('button', { name: /^Kladný hlas:/ })
          .nth(1);
        await firstVote.focus();
        await firstVote.press('ArrowDown');
        await expect(secondVote).toBeFocused();
        await secondVote.press('+');
        await expect(secondVote).toHaveAttribute('aria-pressed', 'true');
        await secondVote.press('+');
        await expect(secondVote).toHaveAttribute('aria-pressed', 'false');
        await secondVote.press('ArrowUp');
        await expect(firstVote).toBeFocused();
      }
      const allowed = categories.filter(
        (c) => c.group === 'both' || c.group === code,
      );
      expect(current.steps.map((s) => s.id).sort()).toEqual(
        allowed.map((c) => c.id).sort(),
      );
      const denied = categories.find(
        (c) => c.group !== 'both' && c.group !== code,
      )!;
      expect(
        (
          await jurorPage.request.get(`/api/wizard/steps/${denied.id}`)
        ).status(),
      ).toBe(404);
      expect(
        (
          await jurorPage.request.post(
            `/api/wizard/steps/${denied.id}/submit`,
            {
              data: { expectedRevision: null, entries: [] },
              headers: { 'X-D21-Request': '1' },
            },
          )
        ).status(),
      ).toBe(404);
      for (const category of allowed) {
        await jurorPage.goto(`/wizard/steps/${category.id}`);
        await expect(
          jurorPage.getByRole('heading', { name: category.name, exact: true }),
        ).toBeVisible();
        const positive = jurorPage.getByRole('button', {
          name: /^Kladný hlas:/,
        });
        const negative = jurorPage.getByRole('button', {
          name: /^Záporný hlas:/,
        });
        const target = await positive.first().boundingBox();
        expect(target!.width).toBeGreaterThanOrEqual(44);
        expect(target!.height).toBeGreaterThanOrEqual(44);
        if (category.name === 'Prezentace') {
          await expect(negative).toHaveCount(0);
          expect(
            (
              await jurorPage.request.post(
                `/api/wizard/steps/${category.id}/submit`,
                {
                  data: {
                    expectedRevision: null,
                    entries: [
                      {
                        votingItemId: candidates.get(category.id)![0],
                        voteValue: -1,
                      },
                    ],
                  },
                  headers: { 'X-D21-Request': '1' },
                },
              )
            ).status(),
          ).toBe(409);
        } else {
          await negative.nth(2).click();
          await expect(negative.nth(2)).toHaveAttribute(
            'aria-pressed',
            'false',
          );
          await expect(
            jurorPage.getByText(/Každý záporný hlas potřebuje dva/),
          ).toBeVisible();
          const invalid = await jurorPage.request.post(
            `/api/wizard/steps/${category.id}/submit`,
            {
              data: {
                expectedRevision: null,
                entries: [
                  {
                    votingItemId: candidates.get(category.id)![2],
                    voteValue: -1,
                  },
                ],
              },
              headers: { 'X-D21-Request': '1' },
            },
          );
          expect(invalid.status()).toBe(409);
        }
        await positive.nth(0).click();
        await expect(positive.nth(0)).toHaveAttribute('aria-pressed', 'true');
        await positive.nth(0).click();
        await expect(positive.nth(0)).toHaveAttribute('aria-pressed', 'false');
        await positive.nth(0).focus();
        await positive.nth(0).press('Space');
        if (category.name !== 'Prezentace') {
          await positive.nth(1).click();
          await negative.nth(0).click();
          await expect(positive.nth(0)).toHaveAttribute('aria-pressed', 'true');
          await negative.nth(2).click();
        }
        if (category.id === current.steps[0]!.id) {
          const advance = jurorPage.getByRole('button', {
            name: /Uložit a další/,
          });
          const draftPath = `**/api/wizard/steps/${category.id}/ballot-draft`;
          await jurorPage.route(draftPath, async (route) => {
            if (route.request().method() === 'PUT') {
              await route.abort('connectionfailed');
            } else {
              await route.continue();
            }
          });
          await advance.click();
          await expect(
            jurorPage.getByText(
              /Změnu hlasovacího lístku se nepodařilo potvrdit/,
            ),
          ).toBeVisible();
          await expect(positive.nth(0)).toHaveAttribute('aria-pressed', 'true');
          await jurorPage.unroute(draftPath);
          await secondTab.click();
          await leavePrompt
            .getByRole('button', { name: 'Uložit a přejít', exact: true })
            .click();
          await expect(jurorPage).toHaveURL(`/wizard/steps/${second!.id}`);
          await jurorPage.goto(`/wizard/steps/${category.id}`);
        } else {
          await jurorPage
            .getByRole('button', { name: 'Uložit návrh', exact: true })
            .click();
          await expect(
            jurorPage.getByText(
              'Návrh je uložený. Hlasy zatím nejsou odevzdané.',
              { exact: true },
            ),
          ).toBeVisible();
          await jurorPage.reload();
        }
        await expect(positive.nth(0)).toHaveAttribute('aria-pressed', 'true');
        const detail = wizardStepDetailSchema.parse(
          await api(jurorPage.request, 'GET', `/wizard/steps/${category.id}`),
        );
        if (code === 'T' && category.id === first!.id) {
          const detailUrl = `/wizard/steps/${category.id}`;
          const elsewhere = ballotDraftSchema.parse(
            await api(jurorPage.request, 'PUT', `${detailUrl}/ballot-draft`, {
              expectedRevision: detail.ballot!.revision,
              entries: [],
            }),
          );
          await jurorPage.evaluate(() =>
            document.dispatchEvent(new Event('visibilitychange')),
          );
          const comparison = jurorPage.getByRole('dialog', {
            name: 'Hlasy se mezitím změnily',
          });
          await expect(comparison.getByRole('heading')).toBeFocused();
          await expect(
            comparison.locator('tr[data-different="true"]').first(),
          ).toBeVisible();
          await accessible(jurorPage);
          await captureR3(jurorPage, testInfo, 'conflict');
          await comparison
            .getByRole('button', { name: 'Ponechat můj výběr' })
            .click();
          await expect(comparison).toHaveCount(0);
          await expect(positive.first()).toHaveAttribute(
            'aria-pressed',
            'true',
          );
          expect(
            wizardStepDetailSchema.parse(
              await api(jurorPage.request, 'GET', detailUrl),
            ).ballot,
          ).toMatchObject({
            revision: elsewhere.revision,
            entries: [],
          });

          await api(page.request, 'POST', `/votings/${category.id}/close`, {});
          await jurorPage.evaluate(() =>
            document.dispatchEvent(new Event('visibilitychange')),
          );
          const closed = jurorPage.getByRole('region', {
            name: 'Hlasování v této kategorii je uzavřené',
          });
          await expect(
            closed.getByText(/Uložený návrh:.*Prázdný lístek/),
          ).toBeVisible();
          await expect(
            closed.getByText('Neuložené změny zůstávají na této stránce.'),
          ).toBeVisible();
          await expect(
            jurorPage.getByRole('link', { name: /Můžete pokračovat/ }),
          ).toBeVisible();
          await expect(positive).toHaveCount(0);
          await accessible(jurorPage);
          await captureR3(jurorPage, testInfo, 'closed');
          await api(page.request, 'POST', `/votings/${category.id}/reopen`, {});
          await closed
            .getByRole('button', { name: 'Zkontrolovat znovu' })
            .click();
          await expect(positive.first()).toHaveAttribute(
            'aria-pressed',
            'true',
          );
          await jurorPage
            .getByRole('button', { name: 'Uložit návrh', exact: true })
            .click();
          await expect(
            jurorPage.getByText(
              'Návrh je uložený. Hlasy zatím nejsou odevzdané.',
              { exact: true },
            ),
          ).toBeVisible();
        }
        if (category.id === selection) {
          const saved = wizardStepDetailSchema.parse(
            await api(jurorPage.request, 'GET', `/wizard/steps/${category.id}`),
          ).ballot!;
          savedRequests.set(code, {
            expectedRevision: saved.revision,
            entries: saved.entries,
          });
        }
        await accessible(jurorPage);
        if (code === 'T' && category.name === 'Celkový vítěz') {
          await positive.last().scrollIntoViewIfNeeded();
          await expect(
            jurorPage.getByRole('button', {
              name: 'Odevzdat kategorii',
              exact: true,
            }),
          ).toBeInViewport();
          await jurorPage.screenshot({
            path: testInfo.outputPath('ballot-actions.png'),
          });
        }
      }
      const beforeSummary = await jurorPage.evaluate(
        () => performance.timeOrigin,
      );
      const summaryTab = jurorNav.locator('[href="/wizard/review"]');
      await summaryTab.click();
      const summaryHeading = jurorPage.getByRole('heading', {
        name: 'Souhrn hlasování',
        exact: true,
      });
      await expect(summaryHeading).toBeFocused();
      await expect(summaryTab).toHaveAttribute('aria-current', 'page');
      expect(await jurorPage.evaluate(() => performance.timeOrigin)).toBe(
        beforeSummary,
      );
      const cards = jurorPage.getByRole('list', {
        name: 'Uložené hlasy podle kategorií',
      });
      await expect(cards.getByRole('listitem')).toHaveCount(3);
      const boxes = cards.getByRole('checkbox');
      await expect(boxes).toHaveCount(3);
      await expect(
        jurorPage.getByRole('button', {
          name: 'Vyberte kategorie k odevzdání',
        }),
      ).toBeDisabled();
      if (code === 'T') {
        const detailUrl = `/wizard/steps/${second!.id}`;
        const original = wizardStepDetailSchema.parse(
          await api(jurorPage.request, 'GET', detailUrl),
        ).ballot!;
        const savedElsewhere = ballotDraftSchema.parse(
          await api(jurorPage.request, 'PUT', `${detailUrl}/ballot-draft`, {
            expectedRevision: original.revision,
            entries: [],
          }),
        );
        const refreshSummary = jurorPage.getByRole('button', {
          name: 'Ověřit aktuální stav',
          exact: true,
        });
        const loadSummary = jurorPage.getByRole('button', {
          name: 'Načíst aktuální přehled',
          exact: true,
        });
        await boxes.first().check();
        await refreshSummary.click();
        await expect(loadSummary).toBeVisible();
        await expect(boxes.first()).toBeDisabled();
        await loadSummary.click();
        await expect(boxes.first()).not.toBeChecked();
        await expect(
          cards.getByText('Prázdný lístek', { exact: true }),
        ).toBeVisible();
        await api(jurorPage.request, 'PUT', `${detailUrl}/ballot-draft`, {
          expectedRevision: savedElsewhere.revision,
          entries: original.entries,
        });
        await refreshSummary.click();
        await loadSummary.click();
      }
      for (const box of await boxes.all()) {
        await expect(box).not.toBeChecked();
        await box.check();
      }
      await accessible(jurorPage);
      if (code === 'T' && testInfo.project.name === 'desktop') {
        for (const width of [390, 1280, 1440]) {
          for (const scheme of ['light', 'dark'] as const) {
            await jurorPage.setViewportSize({ width, height: 900 });
            await jurorPage.emulateMedia({ colorScheme: scheme });
            await jurorPage.screenshot({
              path: testInfo.outputPath(`r2-summary-${width}-${scheme}.png`),
            });
            await jurorPage
              .getByRole('button', {
                name: 'Odevzdat vybrané (3)',
                exact: true,
              })
              .click();
            await jurorPage.screenshot({
              path: testInfo.outputPath(`r2-sheet-${width}-${scheme}.png`),
            });
            await jurorPage.keyboard.press('Escape');
          }
        }
        await jurorPage.setViewportSize(page.viewportSize()!);
        await jurorPage.emulateMedia({ colorScheme });
      }
      const openSummarySheet = jurorPage.getByRole('button', {
        name: 'Odevzdat vybrané (3)',
        exact: true,
      });
      const summarySheet = jurorPage.getByRole('dialog', {
        name: 'Odevzdat 3 kategorie?',
        exact: true,
      });
      const confirmSummary = summarySheet.getByRole('button', {
        name: 'Potvrdit odevzdání',
        exact: true,
      });
      await openSummarySheet.click();
      await expect(summarySheet.getByRole('heading')).toBeFocused();
      await expect(summarySheet.getByRole('listitem')).toHaveCount(3);
      await summarySheet
        .getByRole('button', { name: 'Zpět k úpravám', exact: true })
        .click();
      await expect(openSummarySheet).toBeFocused();
      await openSummarySheet.press('Enter');
      await accessible(jurorPage);
      let firstRequest: string | null = null;
      if (code === 'T') {
        await jurorPage.route('**/api/wizard/final-submit', async (route) => {
          if (!firstRequest) {
            firstRequest = route.request().postData();
            await route.abort('connectionfailed');
          } else {
            expect(route.request().postData()).toBe(firstRequest);
            await route.continue();
          }
        });
        await confirmSummary.click();
        await expect(summarySheet.getByRole('alert')).toBeFocused();
      }
      const submissionResponse = jurorPage.waitForResponse(
        (response) =>
          response.url().endsWith('/api/wizard/final-submit') &&
          response.request().method() === 'POST',
      );
      if (code === 'T') {
        await summarySheet
          .getByRole('button', {
            name: 'Zopakovat stejné odevzdání',
            exact: true,
          })
          .click();
      } else {
        await confirmSummary.click();
      }
      const response = await submissionResponse;
      expect(response.status(), await response.text()).toBe(200);
      const submitted = wizardFinalSubmitSchema.parse(await response.json());
      expect(
        submitted.results.every((result) => result.outcome === 'submitted'),
      ).toBe(true);
      if (code === 'T') {
        await jurorPage.unroute('**/api/wizard/final-submit');
      }
      await expect(summarySheet).toHaveCount(0);
      await expect(summaryHeading).toBeVisible();
      await expect(
        jurorPage.getByText('Potvrzeno: 3 z 3 vybraných kategorií.', {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        jurorPage.getByText('Všechny kategorie jsou odevzdané.', {
          exact: true,
        }),
      ).toBeVisible();
      await expect(boxes).toHaveCount(0);
      await expect(jurorPage).toHaveURL('/wizard/confirmation');
      expect(await jurorPage.evaluate(() => performance.timeOrigin)).toBe(
        beforeSummary,
      );
      // Exact HTTP replay does not create an extra current ballot or audit snapshot.
      await api(
        jurorPage.request,
        'POST',
        `/wizard/steps/${selection}/submit`,
        savedRequests.get(code),
      );
      expect(
        (
          await jurorPage.request.put(
            `/api/wizard/steps/${selection}/ballot-draft`,
            {
              data: { expectedRevision: 2, entries: [] },
              headers: { 'X-D21-Request': '1' },
            },
          )
        ).status(),
      ).toBe(409);
      await jurorPage.reload();
      await expect(summaryHeading).toBeVisible();
      await expect(
        jurorPage.getByText('Všechny kategorie jsou odevzdané.', {
          exact: true,
        }),
      ).toBeVisible();
      await accessible(jurorPage);
    }
    await page.goto(`/admin/events/${eventId}/dashboard`);
    await expect(
      page.getByRole('button', { name: 'Integrovaný test', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Průběh hlasování', exact: true }),
    ).toBeVisible();
    const dashboard = dashboardOverviewSchema.parse(
      await api(page.request, 'GET', `/dashboard/overview?eventId=${eventId}`),
    );
    expect(dashboard.totals.submitted).toBe(6);
    expect(dashboard.totals.expected).toBe(30);
    const progress = page
      .getByRole('region', { name: 'Matice průběhu', exact: true })
      .getByRole('table');
    const pendingFilter = page.getByRole('button', { name: /^Čekající \(/ });
    await expect(pendingFilter).toHaveAttribute('aria-pressed', 'true');
    await expect(
      progress.getByRole('rowheader', { name: /^Porotce T1\b/ }),
    ).toHaveCount(0);
    await expect(
      progress.getByText('Bez návrhu', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      progress.getByText('— nehlasuje', { exact: true }).first(),
    ).toBeVisible();
    await captureR7(page, testInfo, 'progress');
    const technicalCategory = categories.find(
      (category) => category.group === 'T',
    )!;
    await page.getByRole('button', { name: 'Technická', exact: true }).click();
    await expect(
      progress.getByRole('rowheader', { name: /^Porotce V/ }),
    ).toHaveCount(0);
    const jurorRow = progress.getByRole('row', { name: /^Porotce T1\b/ });
    await jurorRow
      .getByLabel('Další možnosti: Porotce T1', { exact: true })
      .click();
    await jurorRow
      .getByRole('link', {
        name: `Odemknout odevzdaný lístek… · ${technicalCategory.name}`,
      })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/dashboard/votings/${technicalCategory.id}\\?unlock=`),
    );
    const unlock = page.getByRole('form', {
      name: 'Odemknout lístek: Porotce T1',
      exact: true,
    });
    await expect(unlock).toBeVisible();
    await unlock.getByRole('button', { name: 'Zrušit', exact: true }).click();
    await expect(unlock).toHaveCount(0);
    await page.goBack();
    await expect(pendingFilter).toHaveAttribute('aria-pressed', 'true');
    const refresh = page.getByRole('button', { name: 'Obnovit', exact: true });
    await expect(refresh).toBeEnabled();
    const read = page.waitForResponse((response) =>
      response.url().includes('/api/dashboard/overview?'),
    );
    await refresh.click();
    expect((await read).ok()).toBe(true);
    await expect(refresh).toBeFocused();
    await accessible(page);
    await page.goto(`/admin/events/${eventId}/results`);
    await expect(
      page.getByRole('button', { name: 'Stáhnout XLSX', exact: true }),
    ).toBeVisible();
    const results = resultsOverviewSchema.parse(
      await api(page.request, 'GET', `/results/overview?eventId=${eventId}`),
    );
    const selected = results.categories.find((c) => c.id === selection)!;
    expect(
      selected.rows.slice(0, 2).map((r) => [r.plus, r.minus, r.score, r.rank]),
    ).toEqual([
      [2, 0, 2, 1],
      [2, 0, 2, 1],
    ]);
    expect(selected.boundaryTie).toBe(true);
    expect(
      selected.rows.filter((r) => r.selection === 'selected'),
    ).toHaveLength(0);
    await accessible(page);
    const downloadPromise = page.waitForEvent('download');
    await page
      .getByRole('button', { name: 'Stáhnout XLSX', exact: true })
      .press('Enter');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain(eventId);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile((await download.path())!);
    expect(workbook.worksheets.map((s) => s.name)).toEqual([
      'Kategorie',
      'Výsledky',
      'Účast',
      'Hlasy porotců',
    ]);
    expect(workbook.getWorksheet('Účast')!.rowCount).toBeGreaterThan(30);
    expect(workbook.getWorksheet('Hlasy porotců')!.rowCount).toBeGreaterThan(
      30,
    );
    await download.delete();
    await expect(
      page.getByRole('heading', { name: /^Hlasy porotců/ }),
    ).toHaveCount(0);
    await expect(page.getByText('Porotce T1', { exact: true })).toHaveCount(0);
    await page
      .getByRole('navigation', { name: 'Výsledky podle kategorií' })
      .getByRole('link', { name: 'Výběr · průběžný', exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/results/votings/${selection}$`),
    );
    await expect(
      page.getByRole('heading', { name: 'Hlasy porotců · Výběr', exact: true }),
    ).toBeVisible();
    const voteMatrix = page
      .getByRole('region', { name: 'Matice hlasů porotců', exact: true })
      .getByRole('table');
    await expect(
      voteMatrix.getByText(/^v \d{1,2}:\d{2} · započteno$/).first(),
    ).toBeVisible();
    const expectedScores = selected.rows.map((row) => String(row.score));
    const scores = voteMatrix
      .getByRole('row', { name: /^Skóre\b/ })
      .getByRole('cell');
    expect((await scores.allTextContents()).slice(0, -1)).toEqual(
      expectedScores,
    );
    await page.getByRole('button', { name: 'Technická', exact: true }).click();
    await expect(
      voteMatrix.getByRole('rowheader', { name: /^Porotce V/ }),
    ).toHaveCount(0);
    expect((await scores.allTextContents()).slice(0, -1)).toEqual(
      expectedScores,
    );
    await page.getByRole('button', { name: /^Jen započtení/ }).click();
    await expect(
      voteMatrix.getByRole('rowheader', { name: /^Porotce / }),
    ).toHaveCount(selected.counts.submitted);
    await page.getByRole('button', { name: /^Všichni \(/ }).click();
    await expect(
      voteMatrix.getByRole('rowheader', { name: /^Porotce / }),
    ).toHaveCount(selected.counts.expected);
    await captureR7(page, testInfo, 'results');
    await accessible(page);
    await api(page.request, 'POST', `/votings/${selection}/close`, {});
    const jurorPage = contexts[0]!.pages()[0]!;
    expect(
      (
        await jurorPage.request.post(`/api/wizard/steps/${selection}/submit`, {
          data: { expectedRevision: 2, entries: [] },
          headers: { 'X-D21-Request': '1' },
        })
      ).status(),
    ).toBe(409);
    await api(
      jurorPage.request,
      'POST',
      `/wizard/steps/${selection}/submit`,
      savedRequests.get('T'),
    );
    await page.goto(`/admin/votings/${selection}`);
    await expect(
      page.getByRole('button', {
        name: /^Znovu otevřít hlasování:/,
      }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: /^Znovu otevřít hlasování:/ })
      .click();
    await expect(
      page.getByText('Hlasování bylo znovu otevřeno.', { exact: true }),
    ).toBeVisible();
    const history = await runtime.pool.query(
      "SELECT count(*)::int AS count FROM audit_logs WHERE action='ballot.submitted' AND event_id=$1",
      [eventId],
    );
    expect(history.rows[0].count).toBe(6);
    // Complete the remaining real jurors through the same public HTTP workflow.
    for (const juror of jurors.filter((j) => !j.displayName.endsWith('1'))) {
      const context = await browser.newContext({ baseURL: runtime.origin });
      try {
        const issued = z
          .object({ url: z.url() })
          .parse(
            await api(
              page.request,
              'POST',
              `/events/${eventId}/jurors/${juror.id}/access/copy`,
              {},
            ),
          );
        const link = new URLSearchParams(new URL(issued.url).hash.slice(1));
        await api(context.request, 'POST', '/auth/juror/start', {
          eventId,
          token: link.get('key')!,
        });
        const current = wizardCurrentSchema.parse(
          await api(context.request, 'GET', '/wizard/current'),
        );
        for (const step of current.steps) {
          const ids = candidates.get(step.id)!;
          const choices =
            step.name === 'Celkový vítěz'
              ? [
                  { votingItemId: ids[0], voteValue: 1 },
                  { votingItemId: ids[1], voteValue: 1 },
                  { votingItemId: ids[2], voteValue: 1 },
                  { votingItemId: ids[7], voteValue: -1 },
                ]
              : [{ votingItemId: ids[0], voteValue: 1 }];
          const saved = await api(
            context.request,
            'PUT',
            `/wizard/steps/${step.id}/ballot-draft`,
            { expectedRevision: null, entries: choices },
          );
          await api(context.request, 'POST', '/wizard/final-submit', {
            categories: [
              {
                stepId: step.id,
                expectedRevision: saved.revision,
                entries: choices,
              },
            ],
          });
        }
      } finally {
        await context.close();
      }
    }
    for (const category of categories) {
      await api(page.request, 'POST', `/votings/${category.id}/close`, {});
    }
    const final = resultsOverviewSchema.parse(
      await api(page.request, 'GET', `/results/overview?eventId=${eventId}`),
    );
    expect(final.categories.every((c) => c.stage === 'final')).toBe(true);
    expect(
      final.categories
        .find((c) => c.name === 'Celkový vítěz')!
        .rows.filter((r) => r.selection === 'selected'),
    ).toHaveLength(3);
    expect(
      final.categories.find((c) => c.id === selection)!.rows[0]!.score,
    ).toBe(10);
    await page.goto(`/admin/events/${eventId}/results`);
    await expect(
      page.getByRole('heading', { name: 'Výsledky', exact: true }),
    ).toBeVisible();
    await accessible(page);
    await page.screenshot({
      path: testInfo.outputPath('results.png'),
      fullPage: true,
    });
    // Real administrator UI unlock removes the current contribution; replacement restores it.
    const technical = categories.find((c) => c.group === 'T')!;
    await page.goto(`/admin/dashboard/votings/${technical.id}`);
    await page
      .getByRole('button', { name: /^Odemknout lístek: Porotce T1,/ })
      .click();
    await page
      .getByRole('button', { name: 'Potvrdit odemčení', exact: true })
      .click();
    await expect(
      page.getByText(
        'Lístek byl odemčen porotci. Historie odevzdání je zachovaná.',
        { exact: true },
      ),
    ).toBeVisible();
    const unlocked = resultsOverviewSchema
      .parse(
        await api(page.request, 'GET', `/results/overview?eventId=${eventId}`),
      )
      .categories.find((c) => c.id === technical.id)!;
    expect(unlocked.counts.submitted).toBe(4);
    expect(unlocked.stage).toBe('provisional');
    await api(page.request, 'POST', `/votings/${technical.id}/reopen`, {});
    await jurorPage.goto(`/wizard/steps/${technical.id}`);
    await expect(
      jurorPage.getByRole('button', { name: /^Kladný hlas:/ }).nth(0),
    ).toHaveAttribute('aria-pressed', 'true');
    await jurorPage
      .getByRole('button', { name: /^Záporný hlas:/ })
      .nth(2)
      .click();
    await jurorPage
      .getByRole('button', { name: /^Kladný hlas:/ })
      .nth(1)
      .click();
    const submit = jurorPage.getByRole('button', {
      name: 'Odevzdat kategorii',
      exact: true,
    });
    const sheet = jurorPage.getByRole('dialog', {
      name: `Odevzdat „${technical.name}“?`,
    });
    const confirm = sheet.getByRole('button', {
      name: 'Potvrdit odevzdání',
      exact: true,
    });
    const cancel = sheet.getByRole('button', {
      name: 'Zpět k úpravám',
      exact: true,
    });
    const beforeSubmitDocument = await jurorPage.evaluate(
      () => performance.timeOrigin,
    );
    await submit.click();
    await expect(sheet.getByRole('heading')).toBeFocused();
    await jurorPage.keyboard.press('Shift+Tab');
    await expect(confirm).toBeFocused();
    await jurorPage.keyboard.press('Tab');
    await expect(cancel).toBeFocused();
    await jurorPage.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(submit).toBeFocused();
    await submit.click();
    await accessible(jurorPage);
    if (testInfo.project.name === 'desktop') {
      for (const width of [390, 1280, 1440]) {
        for (const scheme of ['light', 'dark'] as const) {
          await jurorPage.setViewportSize({ width, height: 900 });
          await jurorPage.emulateMedia({ colorScheme: scheme });
          await jurorPage.screenshot({
            path: testInfo.outputPath(`r1-submit-${width}-${scheme}.png`),
          });
          await jurorPage.keyboard.press('Escape');
          await expect(submit).toBeFocused();
          await jurorPage.screenshot({
            path: testInfo.outputPath(`r1-category-${width}-${scheme}.png`),
          });
          await submit.click();
        }
      }
      await jurorPage.setViewportSize(page.viewportSize()!);
      await jurorPage.emulateMedia({ colorScheme });
    }
    await confirm.click();
    await expect(jurorPage).toHaveURL('/wizard/review');
    await expect(
      jurorPage.getByText(`Kategorie ${technical.name} byla odevzdána.`, {
        exact: true,
      }),
    ).toBeAttached();
    expect(await jurorPage.evaluate(() => performance.timeOrigin)).toBe(
      beforeSubmitDocument,
    );
    await jurorPage
      .getByRole('navigation', { name: /\bKategorie(?: |$)/u })
      .locator(`[href="/wizard/steps/${technical.id}"]`)
      .click();
    await expect(
      jurorPage.getByText(
        'Odevzdáno a uzamčeno. Úpravy může povolit jen organizátor.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      jurorPage.getByRole('button', { name: /^Kladný hlas:/ }).first(),
    ).toBeDisabled();
    await expect(submit).toHaveCount(0);
    await api(page.request, 'POST', `/votings/${technical.id}/close`, {});
    const replaced = resultsOverviewSchema
      .parse(
        await api(page.request, 'GET', `/results/overview?eventId=${eventId}`),
      )
      .categories.find((c) => c.id === technical.id)!;
    expect(replaced.stage).toBe('final');
    expect(replaced.rows[0]!.score).toBe(5);
    expect(replaced.rows.reduce((sum, row) => sum + row.minus, 0)).toBe(0);
    expect(
      (
        await runtime.pool.query(
          "SELECT count(*)::int AS count FROM audit_logs WHERE action='ballot.submitted' AND event_id=$1",
          [eventId],
        )
      ).rows[0].count,
    ).toBe(31);
  } finally {
    for (const context of contexts) {
      await context.close();
    }
  }
});

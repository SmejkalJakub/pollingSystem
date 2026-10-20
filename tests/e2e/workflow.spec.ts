import { type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import {
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
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    result.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

async function saveForm(page: Page, name: string) {
  await page
    .getByRole('form', { name, exact: true })
    .getByRole('button', { name: 'Uložit', exact: true })
    .click();
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
  await page.getByRole('button', { name: 'Nový event', exact: true }).click();
  await page
    .getByLabel('Název eventu', { exact: true })
    .fill('Integrovaný test');
  await saveForm(page, 'Nový event');
  await expect(page).toHaveURL(/\/admin\/events\/[0-9a-f-]+$/);
  const eventId = page.url().split('/').at(-1)!;
  eventSchema.parse(await api(page.request, 'GET', `/events/${eventId}`));
  await page.getByRole('button', { name: 'Nový porotce', exact: true }).click();
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
  for (const group of groups)
    for (let i = group.code === 'T' ? 2 : 1; i <= 5; i++) {
      await api(page.request, 'POST', `/events/${eventId}/jurors`, {
        displayName: `Porotce ${group.code}${i}`,
        juryGroupId: group.id,
      });
    }
  const jurors = jurorListSchema.parse(
    await api(page.request, 'GET', `/events/${eventId}/jurors`),
  );
  await page
    .getByRole('navigation', { name: 'Příprava', exact: true })
    .getByRole('link', { name: 'Týmy', exact: true })
    .click();
  await page.getByRole('button', { name: 'Nový tým', exact: true }).click();
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
  for (let i = 2; i <= 8; i++)
    await api(page.request, 'POST', `/events/${eventId}/teams`, {
      name: `Tým ${i}`,
      description: `Popis týmu ${i}`,
    });
  const teams = teamListSchema.parse(
    await api(page.request, 'GET', `/events/${eventId}/teams`),
  );
  await page
    .getByRole('navigation', { name: 'Příprava', exact: true })
    .getByRole('link', { name: 'Kategorie', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Nové hlasování', exact: true })
    .click();
  await page.getByLabel('Název hlasování', { exact: true }).fill('Výběr');
  await page
    .getByLabel('Typ hlasování', { exact: true })
    .selectOption('selection');
  await page
    .getByRole('button', { name: 'Uložit kategorii', exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/votings\/[0-9a-f-]+$/);
  const selection = page.url().split('/').at(-1)!;
  await page
    .getByLabel('Počet postupujících týmů (slotů)', { exact: true })
    .fill('1');
  await page.getByLabel('Maximum kladných hlasů', { exact: true }).fill('2');
  await page.getByLabel('Maximum záporných hlasů', { exact: true }).fill('1');
  await page.getByLabel('Záporné hlasy', { exact: true }).selectOption('yes');
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
    for (const [i, team] of teams.entries())
      await api(page.request, 'POST', `/votings/${id}/items`, {
        teamId: team.id,
        displayOrder: i,
      });
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
    .getByRole('button', { name: 'Aktivovat hlasování', exact: true })
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
      await jurorPage
        .getByRole('button', { name: 'Pokračovat k přehledu', exact: true })
        .click();
      await expect(jurorPage).toHaveURL(/\/wizard$/);
      expect(new URL(jurorPage.url()).hash).toBe('');
      const current = wizardCurrentSchema.parse(
        await api(jurorPage.request, 'GET', '/wizard/current'),
      );
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
          for (const button of await negative.all())
            await expect(button).toBeDisabled();
        } else {
          await negative.nth(2).click();
          await expect(
            jurorPage.getByRole('button', {
              name: 'Odevzdat kategorii',
              exact: true,
            }),
          ).toBeDisabled();
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
          await negative.nth(2).click();
        }
        await positive.nth(0).click();
        await expect(positive.nth(0)).toHaveAttribute('aria-pressed', 'true');
        await positive.nth(0).click();
        await expect(positive.nth(0)).toHaveAttribute('aria-pressed', 'false');
        await positive.nth(0).focus();
        await positive.nth(0).press('Space');
        if (category.name !== 'Prezentace') {
          await positive.nth(1).click();
          // Opposite-sign replacement is retained even when it reduces negative entitlement.
          await negative.nth(0).click();
          await expect(positive.nth(0)).toHaveAttribute(
            'aria-pressed',
            'false',
          );
          await positive.nth(0).click();
          await negative.nth(2).click();
        }
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
        await expect(positive.nth(0)).toHaveAttribute('aria-pressed', 'true');
        const detail = wizardStepDetailSchema.parse(
          await api(jurorPage.request, 'GET', `/wizard/steps/${category.id}`),
        );
        if (category.id === selection)
          savedRequests.set(code, {
            expectedRevision: detail.ballot!.revision,
            entries: detail.ballot!.entries,
          });
        await accessible(jurorPage);
      }
      await jurorPage.goto('/wizard/review');
      await expect(
        jurorPage.getByRole('heading', { name: 'Rekapitulace a odevzdání' }),
      ).toBeVisible();
      const boxes = jurorPage.getByRole('checkbox');
      await expect(boxes).toHaveCount(3);
      for (const box of await boxes.all()) {
        await expect(box).not.toBeChecked();
        await box.check();
      }
      await accessible(jurorPage);
      await jurorPage
        .getByRole('button', {
          name: 'Odevzdat vybrané kategorie',
          exact: true,
        })
        .click();
      await expect(
        jurorPage.getByRole('heading', { name: 'Potvrdit vybrané kategorie?' }),
      ).toBeFocused();
      await jurorPage
        .getByRole('button', { name: 'Zpět k výběru', exact: true })
        .click();
      await expect(
        jurorPage.getByRole('button', {
          name: 'Odevzdat vybrané kategorie',
          exact: true,
        }),
      ).toBeFocused();
      await jurorPage
        .getByRole('button', {
          name: 'Odevzdat vybrané kategorie',
          exact: true,
        })
        .press('Enter');
      const submissionResponse = jurorPage.waitForResponse(
        (response) =>
          response.url().endsWith('/api/wizard/final-submit') &&
          response.request().method() === 'POST',
      );
      await jurorPage
        .getByRole('button', {
          name: 'Potvrdit a odevzdat vybrané',
          exact: true,
        })
        .click();
      const response = await submissionResponse;
      expect(response.status(), await response.text()).toBe(200);
      const submitted = wizardFinalSubmitSchema.parse(await response.json());
      expect(
        submitted.results.every((result) => result.outcome === 'submitted'),
      ).toBe(true);
      await expect(
        jurorPage.getByRole('heading', {
          name: 'Potvrzení hlasování',
          exact: true,
        }),
      ).toBeVisible();
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
      await expect(
        jurorPage.getByRole('heading', {
          name: 'Potvrzení hlasování',
          exact: true,
        }),
      ).toBeVisible();
      await accessible(jurorPage);
    }
    await page.goto(`/admin/events/${eventId}/dashboard`);
    await expect(
      page.getByRole('heading', { name: 'Integrovaný test', exact: true }),
    ).toBeVisible();
    const dashboard = dashboardOverviewSchema.parse(
      await api(page.request, 'GET', `/dashboard/overview?eventId=${eventId}`),
    );
    expect(dashboard.totals.submitted).toBe(6);
    expect(dashboard.totals.expected).toBe(30);
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
    ]);
    expect(workbook.getWorksheet('Účast')!.rowCount).toBeGreaterThan(30);
    await download.delete();
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
        name: 'Znovu otevřít hlasování',
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Znovu otevřít hlasování', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Znovu otevřít', exact: true })
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
    for (const category of categories)
      await api(page.request, 'POST', `/votings/${category.id}/close`, {});
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
      page.getByRole('heading', { name: 'Výsledky hlasování', exact: true }),
    ).toBeVisible();
    await accessible(page);
    await page.screenshot({
      path: testInfo.outputPath('results.png'),
      fullPage: true,
    });
    // Real administrator UI unlock removes the current contribution; replacement restores it.
    const technical = categories.find((c) => c.group === 'T')!;
    await page.goto(`/admin/votings/${technical.id}`);
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
    await jurorPage
      .getByRole('button', { name: 'Odevzdat kategorii', exact: true })
      .click();
    await jurorPage
      .getByRole('button', { name: 'Potvrdit odevzdání', exact: true })
      .click();
    await expect(
      jurorPage.getByRole('heading', {
        name: 'Odevzdané hlasování',
        exact: true,
      }),
    ).toBeVisible();
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
    for (const context of contexts) await context.close();
  }
});

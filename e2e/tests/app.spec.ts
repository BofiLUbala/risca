import { test, expect } from '@playwright/test';
import { APP_PAGES, ROLES, accessible, assertHealthy, authFile, firstId, settle, shoot, tokenFromState, watch } from './support';

/**
 * Pour chaque rôle : chaque page de l'espace connecté qui lui est ouverte (même règle que
 * la navigation, frontend/src/lib/nav.ts), avec capture pleine page, puis une page interdite
 * pour vérifier la garde de route.
 */
for (const r of ROLES) {
  test.describe(`${r.role}`, () => {
    test.use({ storageState: authFile(r.role) });

    const ids = new Map<string, string | null>();

    for (const p of APP_PAGES.filter((x) => accessible(r.role, x.route))) {
      test(`${r.role} ${p.route}`, async ({ page }, info) => {
        let target = p.route;
        if (p.source) {
          if (!ids.has(p.source)) ids.set(p.source, await firstId(tokenFromState(r.role) ?? '', p.source));
          const id = ids.get(p.source);
          test.skip(!id, `aucun élément « ${p.source} » dans le périmètre de ${r.role}`);
          target = p.route.replace(':id', id!);
        }
        const f = watch(page);
        await page.goto(target);
        await settle(page);
        await shoot(page, info, r.role, p.route);
        await assertHealthy(page, info, f, target);
      });
    }

    const forbidden = APP_PAGES.find((x) => !x.source && !accessible(r.role, x.route));
    if (forbidden) {
      test(`${r.role} garde de route ${forbidden.route}`, async ({ page }) => {
        await page.goto(forbidden.route);
        await page.waitForURL('**/tableau-de-bord', { timeout: 60_000 });
        expect(new URL(page.url()).pathname).toBe('/tableau-de-bord');
      });
    }
  });
}

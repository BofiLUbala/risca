import { test, expect } from '@playwright/test';
import { API, APP_PAGES, PASSWORD, ROLES, accessible, assertHealthy, authFile, firstId, settle, shoot, watch } from './support';

/**
 * Pour chaque rôle : chaque page de l'espace connecté qui lui est ouverte (même règle que
 * la navigation, frontend/src/lib/nav.ts), avec capture pleine page, puis une page interdite
 * pour vérifier la garde de route.
 */
/**
 * Session fraîche par test. Le jeton d'accès vit 30 min et le jeton de rafraîchissement
 * est à usage unique : des tests parallèles qui partagent une session sauvegardée finissent
 * par se déconnecter mutuellement. Chaque test ouvre donc sa propre session par l'API
 * (la connexion par le formulaire est vérifiée, elle, dans auth.setup.ts).
 */
async function freshSession(email: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`connexion API impossible pour ${email} : ${res.status}`);
  return res.json() as Promise<{ accessToken: string; refreshToken: string }>;
}

for (const r of ROLES) {
  test.describe(`${r.role}`, () => {
    test.use({ storageState: authFile(r.role) });

    test.beforeEach(async ({ context }) => {
      const s = await freshSession(r.email);
      await context.addInitScript(([a, rf]) => {
        localStorage.setItem('risac_access', a);
        localStorage.setItem('risac_refresh', rf);
      }, [s.accessToken, s.refreshToken]);
    });

    const ids = new Map<string, string | null>();

    for (const p of APP_PAGES.filter((x) => accessible(r.role, x.route))) {
      test(`${r.role} ${p.route}`, async ({ page }, info) => {
        let target = p.route;
        if (p.source) {
          if (!ids.has(p.source)) {
            let id = await firstId((await freshSession(r.email)).accessToken, p.source);
            // File personnelle vide (rôle sans étape attribuée) : on ouvre une validation réelle
            // du réseau, prise dans la file de l'ambassadrice, pour tester quand même l'écran.
            if (!id && p.source === 'validation') {
              id = await firstId((await freshSession('ambassadeur1@risac.org')).accessToken, 'validation');
            }
            ids.set(p.source, id);
          }
          const id = ids.get(p.source);
          test.skip(!id, `aucun élément « ${p.source} » dans le périmètre de ${r.role}`);
          target = p.route.replace(':id', id!);
        }
        const f = watch(page);
        await page.goto(target, { waitUntil: 'domcontentloaded' });
        await settle(page);
        await shoot(page, info, r.role, p.route);
        await assertHealthy(page, info, f, target);
      });
    }

    const forbidden = APP_PAGES.find((x) => !x.source && !accessible(r.role, x.route));
    if (forbidden) {
      test(`${r.role} garde de route ${forbidden.route}`, async ({ page }) => {
        await page.goto(forbidden.route, { waitUntil: 'domcontentloaded' });
        await page.waitForURL('**/tableau-de-bord', { timeout: 60_000 });
        expect(new URL(page.url()).pathname).toBe('/tableau-de-bord');
      });
    }
  });
}

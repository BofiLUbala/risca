import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { API, PASSWORD, ROLES, watch, settle } from './support';

/**
 * Application mobile (Expo) servie en version web sur le port 8081, viewport 390.
 * Pour chaque rôle : connexion par le formulaire mobile, puis chaque onglet et les écrans
 * de détail d'un enfant, avec capture. Limite : ce n'est pas le rendu natif Android.
 */
const EXPO = process.env.E2E_EXPO_URL ?? 'http://localhost:8081';
const FIELD_ROLES = ['AMBASSADOR', 'ORPHANAGE_DIRECTOR', 'ORPHANAGE_STAFF', 'FIELD_AGENT', 'REGIONAL_MANAGER', 'NATIONAL_MANAGER', 'SUPER_ADMIN'];

async function token(email: string) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  }).then((x) => x.json());
  return r.accessToken as string;
}

async function childId(role: string, email: string): Promise<string | null> {
  const t = await token(email);
  const isDonor = role === 'DONOR' || role === 'PARTNER';
  const res = await fetch(`${API}${isDonor ? '/children/public/feed' : '/children?take=5'}`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (!res.ok) return null;
  const d: any = await res.json();
  const list: any[] = Array.isArray(d) ? d : d?.items ?? d?.data ?? [];
  return list[0]?.id ?? null;
}

async function shot(page: Page, role: string, name: string) {
  const dir = path.join(__dirname, '..', 'screenshots', 'expo-web-390', role);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

for (const r of ROLES) {
  test(`EXPO ${r.role} : connexion et onglets`, async ({ page }, info) => {
    const f = watch(page);
    await page.goto(`${EXPO}/connexion`, { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('vous@exemple.org').fill(r.email);
    await page.getByPlaceholder('........').fill(PASSWORD);
    await shot(page, r.role, '00-connexion');
    await page.getByText('Se connecter', { exact: true }).last().click();
    await page.waitForURL((u) => !u.pathname.startsWith('/connexion'), { timeout: 60_000 });

    const screens: Array<[string, string]> = [
      ['01-accueil', '/'],
      ['02-fil', '/fil'],
      ['03-enfants', '/enfants'],
      ...(FIELD_ROLES.includes(r.role) ? ([['04-validations', '/validations']] as Array<[string, string]>) : []),
      ['05-messages', '/messages'],
      ['06-profil', '/profil'],
    ];
    const id = await childId(r.role, r.email);
    // Même parcours que l'onglet Enfants : profil public pour les bailleurs, dossier pour le personnel.
    if (id) {
      if (r.role === 'DONOR' || r.role === 'PARTNER') screens.push(['07-enfant', `/enfant/${id}`]);
      else screens.push(['08-enfant-dossier', `/enfant-dossier/${id}`]);
    }

    for (const [name, route] of screens) {
      const before = f.pageErrors.length + f.serverErrors.length;
      await page.goto(`${EXPO}${route}`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      await shot(page, r.role, name);
      info.annotations.push({
        type: 'screen',
        description: `${route} → ${new URL(page.url()).pathname}${f.pageErrors.length + f.serverErrors.length > before ? ' (erreur)' : ''}`,
      });
      expect.soft(new URL(page.url()).pathname, `${route} redirigé`).not.toBe('/connexion');
    }
    for (const [type, list] of Object.entries(f)) for (const d of list as string[]) info.annotations.push({ type, description: d });
    expect.soft(f.pageErrors, 'exceptions JavaScript').toEqual([]);
    expect.soft(f.serverErrors, 'réponses HTTP 5xx').toEqual([]);
    expect.soft(f.consoleErrors, 'erreurs console').toEqual([]);
  });
}

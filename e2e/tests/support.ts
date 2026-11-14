import { Page, TestInfo, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { canAccessPath } from '../../frontend/src/lib/nav';
import type { Role } from '../../frontend/src/lib/roles';

export const API = process.env.E2E_API_URL ?? 'http://localhost:4000/api';
export const PASSWORD = 'Risac2026!';

/** Un compte par rôle, tous issus du seed puis enrichis par la simulation (backend/prisma/simulate.ts). */
export const ROLES: Array<{ role: Role; email: string; label: string }> = [
  { role: 'SUPER_ADMIN', email: 'admin@risac.org', label: 'Super Admin' },
  { role: 'ADMIN_FINANCE', email: 'finance@risac.org', label: 'Admin Finance' },
  { role: 'MODERATOR', email: 'moderation@risac.org', label: 'Modérateur' },
  { role: 'ETHICS_AUDITOR', email: 'hcetde@risac.org', label: 'Auditrice éthique' },
  { role: 'NATIONAL_MANAGER', email: 'national.cd@risac.org', label: 'Responsable national' },
  { role: 'REGIONAL_MANAGER', email: 'regional.nordkivu@risac.org', label: 'Chef régional' },
  { role: 'AMBASSADOR', email: 'ambassadeur1@risac.org', label: 'Ambassadrice' },
  { role: 'FIELD_AGENT', email: 'agent.terrain@risac.org', label: 'Agent de terrain' },
  { role: 'ORPHANAGE_DIRECTOR', email: 'chef.espoir@risac.org', label: 'Directrice d’orphelinat' },
  { role: 'ORPHANAGE_STAFF', email: 'psychologue.espoir@risac.org', label: 'Personnel (psychologue)' },
  { role: 'DONOR', email: 'bailleur1@example.org', label: 'Bailleuse' },
  { role: 'PARTNER', email: 'partenaire@example.org', label: 'Partenaire' },
];

export const authFile = (role: Role) => path.join(__dirname, '..', '.auth', `${role}.json`);

/** Où trouver, avec le jeton du rôle, un identifiant réel de son périmètre. */
export const SOURCES = {
  child: '/children?take=5',
  orphanage: '/orphanages',
  project: '/projects',
  validation: '/approvals/queue',
  post: '/posts/feed',
  disbursement: '/disbursements',
  report: '/moderation/reports',
} as const;

/** Pages de l'espace connecté (frontend/src/app/(app)/**\/page.tsx). `:id` est résolu par rôle. */
export const APP_PAGES: Array<{ route: string; source?: keyof typeof SOURCES }> = [
  { route: '/tableau-de-bord' },
  { route: '/enfants' },
  { route: '/enfants/nouveau' },
  { route: '/enfants/:id', source: 'child' },
  { route: '/enfants/:id/mise-a-jour', source: 'child' },
  { route: '/orphelinats' },
  { route: '/orphelinats/nouveau' },
  { route: '/orphelinats/:id', source: 'orphanage' },
  { route: '/projets' },
  { route: '/projets/nouveau' },
  { route: '/projets/:id', source: 'project' },
  { route: '/validations' },
  { route: '/validations/:id', source: 'validation' },
  { route: '/communication' },
  { route: '/communication/:id', source: 'post' },
  { route: '/messages' },
  { route: '/finance' },
  { route: '/decaissements' },
  { route: '/decaissements/:id', source: 'disbursement' },
  { route: '/mes-dons' },
  { route: '/mes-parrainages' },
  { route: '/moderation' },
  { route: '/moderation/:id', source: 'report' },
  { route: '/support' },
  { route: '/journal-audit' },
  { route: '/utilisateurs' },
  { route: '/modeles-dossier' },
  { route: '/parametres' },
  { route: '/notifications' },
  { route: '/profil' },
];

export function accessible(role: Role, route: string) {
  return canAccessPath(role, route.replace(':id', 'x'));
}

export function slug(route: string) {
  return route === '/' ? 'accueil' : route.replace(/^\//, '').replace(/[/:]/g, '_') || 'accueil';
}

export function tokenFromState(role: Role): string | null {
  const state = JSON.parse(fs.readFileSync(authFile(role), 'utf8'));
  for (const o of state.origins ?? []) {
    const t = (o.localStorage ?? []).find((x: any) => x.name === 'risac_access');
    if (t) return t.value;
  }
  return null;
}

export async function firstId(token: string, source: keyof typeof SOURCES): Promise<string | null> {
  const res = await fetch(`${API}${SOURCES[source]}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data: any = await res.json();
  const list: any[] = Array.isArray(data) ? data : data?.items ?? data?.data ?? data?.posts ?? [];
  return list[0]?.id ?? null;
}

export interface PageFindings {
  consoleErrors: string[];
  pageErrors: string[];
  serverErrors: string[];
  apiClientErrors: string[];
  /** Ressources tierces (Google Fonts, flagcdn) injoignables : avertissement, pas un défaut de la page. */
  externalFailures: string[];
}

const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

/** Branche les écouteurs avant la navigation : console, exceptions, réponses HTTP. */
export function watch(page: Page): PageFindings {
  const f: PageFindings = { consoleErrors: [], pageErrors: [], serverErrors: [], apiClientErrors: [], externalFailures: [] };
  page.on('console', (m) => {
    if (m.type() === 'error') f.consoleErrors.push(m.text().slice(0, 400));
  });
  page.on('pageerror', (e) => f.pageErrors.push(String(e?.message ?? e).slice(0, 400)));
  // La console ne donne pas l'URL d'une requête échouée : on la note pour le rapport.
  page.on('requestfailed', (r) => {
    const err = r.failure()?.errorText ?? '';
    if (/ERR_ABORTED/.test(err)) return; // navigation ou socket fermé volontairement
    const host = new URL(r.url()).hostname;
    const line = `${err} ${r.url().slice(0, 160)}`;
    if (LOCAL_HOSTS.includes(host)) f.apiClientErrors.push(`échec réseau ${line}`);
    else f.externalFailures.push(line);
  });
  page.on('response', (r) => {
    const s = r.status();
    const u = r.url();
    if (s >= 500) f.serverErrors.push(`${s} ${r.request().method()} ${u}`);
    else if (s >= 400 && u.startsWith(API)) f.apiClientErrors.push(`${s} ${r.request().method()} ${u.replace(API, '')}`);
  });
  return f;
}

/** Laisse la page se stabiliser : réseau calme, puis plus d'indicateur de chargement. */
export async function settle(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  await page
    .waitForFunction(() => !document.querySelector('[data-loading], .animate-spin'), null, { timeout: 15_000 })
    .catch(() => undefined);
  await page.waitForTimeout(600);
}

export async function shoot(page: Page, info: TestInfo, role: string, route: string) {
  const dir = path.join(__dirname, '..', 'screenshots', info.project.name, role);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${slug(route)}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await info.attach('capture', { path: file, contentType: 'image/png' });
  info.annotations.push({ type: 'screenshot', description: path.relative(path.join(__dirname, '..', '..'), file).replace(/\\/g, '/') });
}

const BROKEN_TEXT = /Unhandled Runtime Error|Application error|Internal Server Error|This page could not be found/i;

/** Vérifications communes à toutes les pages, consignées dans le rapport. */
export async function assertHealthy(page: Page, info: TestInfo, f: PageFindings, expectedPath: string) {
  const body = (await page.locator('body').innerText().catch(() => '')) ?? '';
  const url = new URL(page.url());
  info.annotations.push({ type: 'url', description: url.pathname });
  for (const [type, list] of Object.entries(f)) {
    for (const d of list as string[]) info.annotations.push({ type, description: d });
  }
  // Une page de création refusée à ce rôle renvoie vers sa liste : c'est la garde voulue.
  const creationGuard = expectedPath.endsWith('/nouveau') && url.pathname === expectedPath.replace(/\/nouveau$/, '');
  if (creationGuard) info.annotations.push({ type: 'guard', description: `création non autorisée : renvoyé vers ${url.pathname}` });
  else expect.soft(url.pathname, 'redirigé hors de la page (connexion ou tableau de bord)').toBe(expectedPath);
  expect.soft(body, 'page d’erreur affichée').not.toMatch(BROKEN_TEXT);
  expect.soft(f.serverErrors, 'réponses HTTP 5xx').toEqual([]);
  expect.soft(f.pageErrors, 'exceptions JavaScript').toEqual([]);
  // Chaque requête tierce échouée produit une ligne « Failed to load resource: net::… » en console :
  // on retire autant de ces lignes qu'il y a d'échecs tiers, le reste compte comme erreur réelle.
  let external = f.externalFailures.length;
  const realConsole = f.consoleErrors.filter((c) => {
    if (external > 0 && /^Failed to load resource: net::ERR_/.test(c)) {
      external--;
      return false;
    }
    return true;
  });
  expect.soft(realConsole, 'erreurs console').toEqual([]);
}

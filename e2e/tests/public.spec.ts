import { test } from '@playwright/test';
import { API, PASSWORD, assertHealthy, settle, shoot, watch } from './support';

/** Pages publiques et pages d'authentification, visiteur non connecté. */
const PUBLIC: Array<{ route: string; source?: string }> = [
  { route: '/' },
  { route: '/confidentialite' },
  { route: '/don-fonds-general' },
  { route: '/enfants-a-soutenir' },
  { route: '/enfants-a-soutenir/:id', source: '/children/public/feed' },
  { route: '/partenaires' },
  { route: '/projets-ouverts' },
  { route: '/projets-ouverts/:id', source: '/projects/public' },
  { route: '/structures' },
  { route: '/transparence' },
  { route: '/don/paiement/:id', source: 'pending-donation' },
  { route: '/connexion' },
  { route: '/inscription' },
  { route: '/admin' },
  { route: '/activate' },
];

async function publicId(source: string): Promise<string | null> {
  if (source === 'pending-donation') {
    // Don laissé « en attente » par la simulation (Partenaire Grands Lacs) : la page bac à sable l'affiche.
    const login = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'partenaire2@risac.test', password: PASSWORD }),
    }).then((r) => r.json());
    const mine: any[] = await fetch(`${API}/payments/donations/mine`, {
      headers: { Authorization: `Bearer ${login.accessToken}` },
    }).then((r) => r.json());
    const pending = (Array.isArray(mine) ? mine : []).find((d) => d.status === 'PENDING');
    return pending ? `${pending.reference}?provider=${pending.provider}&amount=${pending.amount}&currency=${pending.currency}` : null;
  }
  const res = await fetch(`${API}${source}`);
  if (!res.ok) return null;
  const data: any = await res.json();
  const list: any[] = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
  return list[0]?.id ?? null;
}

for (const p of PUBLIC) {
  test(`VISITEUR ${p.route}`, async ({ page }, info) => {
    let target = p.route;
    if (p.source) {
      const id = await publicId(p.source);
      test.skip(!id, `aucune donnée publique pour ${p.route}`);
      target = p.route.replace(':id', id!);
    }
    const f = watch(page);
    await page.goto(target, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await shoot(page, info, 'VISITEUR', p.route);
    await assertHealthy(page, info, f, target.split('?')[0]);
  });
}

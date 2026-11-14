/**
 * RISAC — simulation métier complète, jouée VIA L'API, rôle par rôle.
 *
 * À lancer sur une base fraîche, juste après `npm run seed`, avec une API locale démarrée
 * en mode test (MAIL_ECHO_OTP=true : les codes d'activation sont renvoyés au lieu d'être
 * envoyés par e-mail) :
 *
 *   npm run simulate                      # API par défaut : http://localhost:4000/api
 *   SIM_API_URL=http://localhost:4000/api npm run simulate
 *
 * Garde-fous :
 *  - refuse toute API qui n'est pas locale (jamais d'identifiants de test contre la production) ;
 *  - les comptes invités utilisent le domaine réservé « .test » (aucun e-mail réel ne peut partir) ;
 *  - s'arrête si la base a déjà été simulée (relancer sur une base fraîche).
 *
 * Le scénario suit l'ordre réel du métier et laisse volontairement des tâches EN COURS,
 * pour que chaque tableau de bord des 12 rôles montre du travail à faire.
 */

export {};

const API = (process.env.SIM_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');
const PWD = 'Risac2026!';

// ─────────────────────────── garde-fou production ───────────────────────────
{
  const host = new URL(API).hostname;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host) && !host.endsWith('.localhost')) {
    console.error(`Refus : ${API} n'est pas une API locale. La simulation ne tourne que contre localhost.`);
    process.exit(1);
  }
}

// ─────────────────────────── petits utilitaires ───────────────────────────
type Session = { token: string; user: any; label: string };

let stepNo = 0;
function step(actor: string, what: string) {
  stepNo++;
  console.log(`\n[${String(stepNo).padStart(2, '0')}] ${actor} — ${what}`);
}
function ok(msg: string) {
  console.log(`     ✓ ${msg}`);
}

class ApiFailure extends Error {}

async function call<T = any>(s: Session | null, method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (s) headers.Authorization = `Bearer ${s.token}`;
  let payload: any;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let data: any = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* texte brut */
  }
  if (!res.ok) {
    const msg = typeof data === 'object' && data ? JSON.stringify(data.message ?? data) : text;
    throw new ApiFailure(`${method} ${path} (${s?.label ?? 'anonyme'}) → ${res.status} ${msg}`);
  }
  return data as T;
}

/** Les listes de l'API sont renvoyées soit en tableau, soit paginées ({ items } / { data }). */
function rows(v: any): any[] {
  if (Array.isArray(v)) return v;
  return v?.items ?? v?.data ?? v?.results ?? [];
}

async function login(email: string, label: string): Promise<Session> {
  const r = await call(null, 'POST', '/auth/login', { email, password: PWD });
  if (r.adminKeyRequired) {
    throw new ApiFailure(`${email} exige une clé admin : la base n'est pas une base fraîche issue du seed`);
  }
  if (r.twoFactorRequired) throw new ApiFailure(`${email} exige la double authentification`);
  return { token: r.accessToken, user: r.user, label };
}

/** Un vrai PDF minimal (en-tête %PDF), accepté par le contrôle de type de l'API. */
function pdfBlob(title: string): Blob {
  const body = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >> endobj
4 0 obj << /Length 60 >> stream
BT /F1 18 Tf 72 760 Td (${title.replace(/[()\\]/g, '')}) Tj ET
endstream endobj
trailer << /Root 1 0 R >>
%%EOF
`;
  return new Blob([body], { type: 'application/pdf' });
}

async function upload(s: Session, filename: string, title: string): Promise<string> {
  const fd = new FormData();
  fd.append('file', pdfBlob(title), filename);
  const r = await call(s, 'POST', '/uploads', fd);
  return r.url as string;
}

/** Invitation par le Super Admin puis activation avec le code renvoyé en mode test. */
async function inviteAndMaybeActivate(admin: Session, dto: Record<string, unknown>, activate: boolean) {
  const inv = await call(admin, 'POST', '/auth/invite', dto);
  ok(`invitation de ${dto.email} (${dto.role})`);
  if (!activate) return inv;
  if (!inv.devOtp) {
    throw new ApiFailure(
      "L'API n'a pas renvoyé le code d'activation : démarrez-la avec MAIL_ECHO_OTP=true (configuration « risac-api-e2e »)",
    );
  }
  const token = new URL(inv.activationUrl).searchParams.get('token');
  await call(null, 'POST', '/auth/activate', { token, otp: inv.devOtp, password: PWD });
  ok(`${dto.email} a activé son compte avec le code reçu`);
  return inv;
}

/** Le paiement bac à sable : le fournisseur confirme le don par webhook, comme la page /don/paiement. */
async function pay(reference: string) {
  await call(null, 'POST', '/payments/webhook', { reference, status: 'SUCCEEDED', providerRef: `SIM-${reference}` });
}

async function pendingFor(s: Session, entityId: string) {
  const queue: any[] = await call(s, 'GET', '/approvals/queue');
  const r = queue.find((q) => q.entityId === entityId);
  if (!r) throw new ApiFailure(`${s.label} : aucune validation en attente pour ${entityId}`);
  return r;
}

/** Données de dossier complètes au regard du modèle RDC (champs obligatoires et justificatifs). */
async function dossierFor(s: Session, firstName: string, opts: { motif: string; categorie: string; admission: string }) {
  const [acte, certif, juge] = await Promise.all([
    upload(s, `acte-naissance-${firstName}.pdf`, `Acte de naissance ${firstName}`),
    upload(s, `certificat-vulnerabilite-${firstName}.pdf`, `Certificat de vulnerabilite ${firstName}`),
    upload(s, `decision-divas-${firstName}.pdf`, `Decision DIVAS ${firstName}`),
  ]);
  return {
    lieu_naissance: 'Goma',
    nationalite: 'Congolaise',
    langues_parlees: ['Francais', 'Swahili'],
    acte_naissance: acte,
    statut_pere: 'Decede',
    statut_mere: 'Inconnue',
    categorie: opts.categorie,
    certificat_vulnerabilite: certif,
    zone_conflit: 'Nord-Kivu',
    date_admission: opts.admission,
    motif: opts.motif,
    refere_par: 'DIVAS Nord-Kivu',
    decision_juge: juge,
  };
}

// ─────────────────────────── scénario ───────────────────────────
async function main() {
  console.log(`Simulation RISAC contre ${API}`);
  await call(null, 'GET', '/health').catch(() => {
    throw new ApiFailure(`API injoignable sur ${API} : démarrez-la (configuration « risac-api-e2e »)`);
  });

  // ── 1. Super Admin : préparation et invitations ──
  step('Super Admin', 'connexion');
  const admin = await login('admin@risac.org', 'Super Admin');
  ok(`connecté : ${admin.user.firstName} ${admin.user.lastName}`);

  const before = rows(await call(admin, 'GET', '/users?take=200'));
  if (before.some((u: any) => String(u.email).endsWith('@risac.test'))) {
    throw new ApiFailure('Cette base a déjà été simulée : recréez une base fraîche puis relancez `npm run seed`.');
  }

  const countries: any[] = await call(admin, 'GET', '/geo/countries');
  const cd = countries.find((c) => c.iso2 === 'CD');
  const provinces: any[] = await call(admin, 'GET', `/geo/countries/${cd.id}/provinces`);
  const nk = provinces.find((p) => p.code === 'CD-NK');
  const sk = provinces.find((p) => p.code === 'CD-SK');
  const orphanages = rows(await call(admin, 'GET', '/orphanages'));
  const espoir = orphanages.find((o) => o.slug === 'orphelinat-espoir-goma');
  const tumaini = orphanages.find((o) => o.slug === 'centre-tumaini-beni');

  step('Super Admin', 'invite les nouveaux comptes du réseau');
  const amb3 = await inviteAndMaybeActivate(
    admin,
    { email: 'ambassadeur3@risac.test', firstName: 'Grace', lastName: 'Mapendo', role: 'AMBASSADOR', countryId: cd.id, provinceId: nk.id },
    true,
  );
  await inviteAndMaybeActivate(
    admin,
    { email: 'agent.sudkivu@risac.test', firstName: 'Eric', lastName: 'Paluku', role: 'FIELD_AGENT', countryId: cd.id, provinceId: sk.id },
    true,
  );
  await inviteAndMaybeActivate(
    admin,
    { email: 'partenaire2@risac.test', firstName: 'Claire', lastName: 'Vandamme', role: 'PARTNER', countryId: cd.id, organizationName: 'Fondation Grands Lacs' },
    true,
  );
  // Laissée en attente d'activation : visible dans « comptes invités » du Super Admin.
  await inviteAndMaybeActivate(
    admin,
    {
      email: 'assistante.sociale@risac.test',
      firstName: 'Ruth',
      lastName: 'Kahambu',
      role: 'ORPHANAGE_STAFF',
      countryId: cd.id,
      provinceId: nk.id,
      orphanageId: espoir.id,
      staffFunction: 'SOCIAL_WORKER',
    },
    false,
  );

  step('Super Admin', 'valide la structure proposée « Centre Tumaini » et lui rattache l’ambassadrice Grace');
  await call(admin, 'POST', `/orphanages/${tumaini.id}/approve`);
  ok('Centre Tumaini validé');
  await call(admin, 'POST', `/orphanages/${tumaini.id}/ambassadors`, { ambassadorId: amb3.id, isPrimary: true });
  ok('Grace Mapendo ambassadrice principale du Centre Tumaini');

  // Sessions des acteurs (comptes du seed + comptes activés)
  const director = await login('chef.espoir@risac.org', 'Directrice Espoir');
  const ambassador = await login('ambassadeur1@risac.org', 'Ambassadrice Sarah');
  const regional = await login('regional.nordkivu@risac.org', 'Chef régional Nord-Kivu');
  const national = await login('national.cd@risac.org', 'Responsable national');
  const finance = await login('finance@risac.org', 'Admin Finance');
  const moderator = await login('moderation@risac.org', 'Modérateur');
  const auditor = await login('hcetde@risac.org', 'Auditrice éthique');
  const agent = await login('agent.terrain@risac.org', 'Agent de terrain');
  const psy = await login('psychologue.espoir@risac.org', 'Psychologue');
  const educator = await login('educateur.espoir@risac.org', 'Éducateur');
  const nurse = await login('infirmier.espoir@risac.org', 'Infirmière');
  const donor1 = await login('bailleur1@example.org', 'Bailleuse Sophie');
  const donor2 = await login('bailleur2@example.org', 'Bailleur Marc');
  const partner = await login('partenaire@example.org', 'Partenaire');
  const partner2 = await login('partenaire2@risac.test', 'Partenaire Grands Lacs');

  // ── 2. Dossiers enfants : création, soumission, double validation ──
  step('Directrice Espoir', 'crée le dossier de Furaha et joint les justificatifs');
  const furahaData = await dossierFor(director, 'Furaha', {
    motif: 'Orpheline après les affrontements de Rutshuru, confiée par la DIVAS.',
    categorie: 'Orphelin de guerre',
    admission: '2026-10-02',
  });
  const { child: furaha } = await call(director, 'POST', '/children', {
    firstName: 'Furaha',
    lastName: 'Kavugho',
    sex: 'F',
    birthDate: '2014-06-21',
    warOrphan: true,
    displaced: true,
    languages: ['Francais', 'Swahili'],
    publicStory: 'Furaha aime dessiner et rêve de devenir infirmière.',
    publicNeeds: 'Uniforme, fournitures et frais scolaires.',
    lifeProject: 'Devenir infirmière à Goma.',
    desiredJob: 'Infirmière',
    dossierData: furahaData,
  });
  ok(`dossier ${furaha.publicId} créé (brouillon)`);
  await call(director, 'POST', `/children/${furaha.id}/submit`);
  ok('dossier soumis au circuit de validation');

  step('Ambassadrice Sarah', 'vérifie et valide le dossier de Furaha (étape 1)');
  let req = await pendingFor(ambassador, furaha.id);
  await call(ambassador, 'POST', `/approvals/${req.id}/approve`, { comment: 'Visite faite, pièces conformes.' });
  ok('étape ambassadeur approuvée');

  step('Chef régional Nord-Kivu', 'contrôle les doublons et valide définitivement (étape 2)');
  req = await pendingFor(regional, furaha.id);
  await call(regional, 'POST', `/approvals/${req.id}/approve`, { comment: 'Aucun doublon, dossier validé.' });
  const furahaNow = await call(director, 'GET', `/children/${furaha.id}`);
  if (furahaNow.status !== 'ACTIVE') throw new ApiFailure(`Furaha devrait être ACTIVE, statut : ${furahaNow.status}`);
  ok('dossier de Furaha ACTIF, ambassadrice assignée');

  step('Directrice Espoir', 'crée deux autres dossiers : l’un attend l’ambassadrice, l’autre le chef régional');
  const { child: baraka } = await call(director, 'POST', '/children', {
    firstName: 'Baraka',
    lastName: 'Musubao',
    sex: 'M',
    birthDate: '2017-01-09',
    abandoned: true,
    dossierData: await dossierFor(director, 'Baraka', {
      motif: 'Trouvé seul au marché de Virunga, aucune famille identifiée.',
      categorie: 'Abandonne',
      admission: '2026-10-28',
    }),
  });
  await call(director, 'POST', `/children/${baraka.id}/submit`);
  ok(`${baraka.publicId} soumis → en attente de l’ambassadrice`);

  const { child: neema } = await call(director, 'POST', '/children', {
    firstName: 'Neema',
    lastName: 'Kasoki',
    sex: 'F',
    birthDate: '2011-03-30',
    displaced: true,
    dossierData: await dossierFor(director, 'Neema', {
      motif: 'Déplacée du camp de Kanyaruchinya, mère disparue.',
      categorie: 'Deplace',
      admission: '2026-09-18',
    }),
  });
  await call(director, 'POST', `/children/${neema.id}/submit`);
  req = await pendingFor(ambassador, neema.id);
  await call(ambassador, 'POST', `/approvals/${req.id}/approve`, { comment: 'Conforme.' });
  ok(`${neema.publicId} validé par l’ambassadrice → en attente du chef régional`);

  step('Directrice Espoir', 'commence un dossier sans le soumettre (brouillon)');
  const { child: draft } = await call(director, 'POST', '/children', {
    firstName: 'Kambale',
    lastName: 'Sivyavugha',
    sex: 'M',
    estimatedAge: 8,
  });
  ok(`${draft.publicId} en brouillon`);

  step('Agent de terrain', 'enregistre un enfant repéré lors d’une mission et le soumet');
  const { child: agentChild } = await call(agent, 'POST', '/children', {
    firstName: 'Zawadi',
    lastName: 'Mumbere',
    sex: 'F',
    birthDate: '2015-12-02',
    orphanageId: espoir.id,
    streetChild: true,
    dossierData: await dossierFor(agent, 'Zawadi', {
      motif: 'Enfant des rues repérée à Birere, orientée vers Espoir.',
      categorie: 'Enfant des rues',
      admission: '2026-11-04',
    }),
  });
  await call(agent, 'POST', `/children/${agentChild.id}/submit`);
  ok(`${agentChild.publicId} soumis par l’agent`);

  // ── 3. Projets : création, double validation, publication ──
  step('Directrice Espoir', 'crée et soumet le projet « Réhabilitation du dortoir des filles » (2 500 USD)');
  const dorm = await call(director, 'POST', '/projects', {
    title: 'Réhabilitation du dortoir des filles',
    description: 'Toiture, moustiquaires et 20 lits superposés pour le dortoir des filles de l’Orphelinat Espoir.',
    kind: 'ORPHANAGE_PROJECT',
    targetAmount: 2500,
    currency: 'USD',
    category: 'Infrastructure',
    startDate: '2026-11-20',
    endDate: '2027-02-28',
  });
  await call(director, 'POST', `/projects/${dorm.id}/submit`);
  ok('projet soumis (au-dessus du seuil : ambassadrice puis chef régional)');

  step('Ambassadrice Sarah', 'valide le projet (étape 1)');
  req = await pendingFor(ambassador, dorm.id);
  await call(ambassador, 'POST', `/approvals/${req.id}/approve`, { comment: 'Devis vérifiés sur place.' });
  ok('étape ambassadeur approuvée');

  step('Chef régional Nord-Kivu', 'valide le projet (étape finale)');
  req = await pendingFor(regional, dorm.id);
  await call(regional, 'POST', `/approvals/${req.id}/approve`, { comment: 'Budget cohérent.' });
  ok('circuit approuvé');

  step('Directrice Espoir', 'publie le projet validé');
  await call(director, 'POST', `/projects/${dorm.id}/publish`);
  ok('projet publié, ouvert aux dons');

  step('Directrice Espoir', 'soumet un projet pour Furaha (600 USD) — en attente de l’ambassadrice');
  const kit = await call(director, 'POST', '/projects', {
    title: 'Kit scolaire et uniforme de Furaha',
    description: 'Uniforme, cartable, manuels et frais de l’année scolaire 2026-2027.',
    childId: furaha.id,
    targetAmount: 600,
    currency: 'USD',
    category: 'Éducation',
  });
  await call(director, 'POST', `/projects/${kit.id}/submit`);
  ok('projet enfant en attente de validation');

  // ── 4. Bailleurs : dons, parrainage, abonnement ──
  const kidList = rows(await call(admin, 'GET', '/children?take=50'));
  const amani = kidList.find((c) => c.publicId === 'RISAC-CD-0001');
  const esperance = kidList.find((c) => c.publicId === 'RISAC-CD-0002');

  step('Bailleuse Sophie', 'contribue 1 500 USD au projet du dortoir (paiement bac à sable)');
  let d = await call(donor1, 'POST', '/payments/donations', {
    kind: 'PROJECT_CONTRIBUTION',
    projectId: dorm.id,
    amount: 1500,
    currency: 'USD',
    provider: 'STRIPE',
    message: 'Pour que les filles dorment au sec.',
    anonymous: false,
  });
  await pay(d.donation.reference);
  ok(`don ${d.donation.reference} confirmé par le fournisseur`);

  step('Bailleuse Sophie', 'parraine Amani (50 USD par mois) et paie la première échéance');
  const sp = await call(donor1, 'POST', '/payments/sponsorships', {
    childId: amani.id,
    monthlyAmount: 50,
    currency: 'USD',
    scope: 'EDUCATION',
    endRule: 'FIXED_MONTHS',
    months: 12,
    provider: 'STRIPE',
  });
  await pay(sp.firstPayment.donation.reference);
  ok('parrainage actif, première échéance payée');

  step('Bailleur Marc', 'fait un don de 120 EUR pour Espérance et un don au fonds général');
  d = await call(donor2, 'POST', '/payments/donations', {
    kind: 'ONE_OFF',
    childId: esperance.id,
    amount: 120,
    currency: 'EUR',
    provider: 'PAYPAL',
    message: 'Pour la machine à coudre.',
  });
  await pay(d.donation.reference);
  d = await call(donor2, 'POST', '/payments/donations', {
    kind: 'GENERAL_FUND',
    amount: 75,
    currency: 'EUR',
    provider: 'STRIPE',
  });
  await pay(d.donation.reference);
  ok('deux dons confirmés');
  await call(donor2, 'POST', `/posts/subscribe/${esperance.id}`);
  await call(donor2, 'POST', '/posts/favorite', { projectId: dorm.id });
  ok('abonné au fil d’Espérance, projet du dortoir en favori');

  step('Partenaire (Fondation Enfance Solidaire)', 'cofinance le dortoir à hauteur de 500 USD');
  d = await call(partner, 'POST', '/payments/donations', {
    kind: 'PROJECT_CONTRIBUTION',
    projectId: dorm.id,
    amount: 500,
    currency: 'USD',
    provider: 'BANK_TRANSFER',
  });
  await pay(d.donation.reference);
  ok('virement reçu et affecté au projet');

  step('Partenaire Grands Lacs', 'promet un don au fonds général (paiement encore en attente)');
  await call(partner2, 'POST', '/payments/donations', { kind: 'GENERAL_FUND', amount: 300, currency: 'USD', provider: 'FLUTTERWAVE' });
  ok('don créé, en attente de confirmation du fournisseur');

  // ── 5. Décaissements : demande → confirmation ambassadeur → paiement finance → justificatifs ──
  step('Directrice Espoir', 'demande 800 USD sur le projet du dortoir (achat des tôles)');
  const disb1 = await call(director, 'POST', '/disbursements', {
    amount: 800,
    reason: 'Achat de 60 tôles et charpente pour la toiture du dortoir',
    projectId: dorm.id,
  });
  ok(`demande ${disb1.reference} créée`);

  step('Ambassadrice Sarah', 'confirme le besoin sur place');
  await call(ambassador, 'POST', `/disbursements/${disb1.id}/confirm`);
  ok('besoin confirmé');

  step('Admin Finance', 'approuve et verse les fonds sur le compte vérifié');
  await call(finance, 'POST', `/disbursements/${disb1.id}/pay`, { method: 'M-Pesa', ref: 'MPESA-SIM-0001' });
  ok('800 USD versés, justificatifs attendus');

  step('Directrice Espoir', 'justifie la dépense (facture du chantier)');
  const invoice = await upload(director, 'facture-toles.pdf', 'Facture quincaillerie Goma 800 USD');
  await call(director, 'POST', `/disbursements/${disb1.id}/receipts`, { name: 'Facture quincaillerie', url: invoice, amount: 800, kind: 'INVOICE' });
  ok('dépense entièrement justifiée → soldée');

  step('Décaissements en cours', 'trois demandes laissées à différentes étapes du circuit');
  const disb2 = await call(director, 'POST', '/disbursements', {
    amount: 400,
    reason: 'Main-d’œuvre des menuisiers (première tranche)',
    projectId: dorm.id,
  });
  await call(ambassador, 'POST', `/disbursements/${disb2.id}/confirm`);
  await call(finance, 'POST', `/disbursements/${disb2.id}/pay`, { method: 'M-Pesa', ref: 'MPESA-SIM-0002' });
  const halfInvoice = await upload(director, 'recu-menuisiers.pdf', 'Recu menuisiers 250 USD');
  await call(director, 'POST', `/disbursements/${disb2.id}/receipts`, { name: 'Reçu menuisiers', url: halfInvoice, amount: 250, kind: 'INVOICE' });
  ok(`${disb2.reference} payé, partiellement justifié (250/400) → la directrice doit compléter`);

  const disb3 = await call(director, 'POST', '/disbursements', {
    amount: 300,
    reason: 'Achat de 20 matelas',
    projectId: dorm.id,
  });
  await call(ambassador, 'POST', `/disbursements/${disb3.id}/confirm`);
  ok(`${disb3.reference} confirmé par l’ambassadrice → à approuver par l’Admin Finance`);

  const disb4 = await call(director, 'POST', '/disbursements', {
    amount: 40,
    reason: 'Frais d’inscription scolaire d’Amani',
    childId: amani.id,
  });
  ok(`${disb4.reference} demandé sur le solde d’Amani → à confirmer par l’ambassadrice`);

  const disb5 = await call(director, 'POST', '/disbursements', {
    amount: 150,
    reason: 'Achat de 20 moustiquaires imprégnées',
    projectId: dorm.id,
  });
  ok(`${disb5.reference} demandé sur le projet du dortoir → à confirmer par l’ambassadrice`);

  // ── 6. Suivi de l'enfant par l'équipe ──
  step('Psychologue', 'réalise l’évaluation initiale de Furaha');
  await call(psy, 'POST', `/children/${furaha.id}/psycho`, {
    isInitialAssessment: true,
    evaluation: 'Anxiété modérée liée au déplacement, bon lien avec les éducateurs.',
    notes: 'Séances hebdomadaires de dessin thérapeutique.',
    sessionAt: '2026-11-06T10:00:00.000Z',
  });
  ok('séance enregistrée (accès journalisé)');

  step('Éducateur', 'enregistre le bulletin du premier trimestre de Furaha');
  await call(educator, 'POST', `/children/${furaha.id}/school`, {
    school: 'EP Mapendo Goma',
    grade: '6e primaire',
    term: 'T1',
    year: '2026-2027',
    average: 71.5,
    fees: 45,
    publicSummary: 'Bon trimestre, progrès en lecture.',
  });
  ok('bulletin enregistré');

  step('Infirmière', 'enregistre la visite médicale de Furaha');
  await call(nurse, 'POST', `/children/${furaha.id}/health`, {
    bloodType: 'O+',
    vaccines: 'Calendrier PEV à jour, rappel tétanos fait',
    consultation: 'Bilan d’entrée : bon état général, déparasitage.',
  });
  ok('fiche santé enregistrée');

  step('Ambassadrice Sarah', 'dépose un rapport de visite et publie une actualité');
  await call(ambassador, 'POST', `/children/${furaha.id}/visit`, {
    note: 'Visite du 8 novembre : Furaha est bien intégrée, chambre propre, suivi scolaire régulier.',
    rating: 4,
  });
  const post = await call(ambassador, 'POST', '/posts', {
    type: 'NEWS',
    content: 'Les travaux du dortoir des filles ont commencé à l’Orphelinat Espoir grâce à vos dons. Merci !',
    orphanageId: espoir.id,
    projectId: dorm.id,
  });
  ok('rapport de visite et publication en ligne');

  step('Bailleurs', 'réagissent, commentent, puis Sophie signale un commentaire déplacé');
  await call(donor1, 'POST', `/posts/${post.id}/react`, { kind: 'HEART' });
  await call(donor2, 'POST', `/posts/${post.id}/react`, { kind: 'HEART' });
  const comment = await call(donor2, 'POST', `/posts/${post.id}/comment`, { content: 'Bravo ! Envoyez-moi votre numéro WhatsApp en privé.' });
  await call(donor1, 'POST', `/posts/${post.id}/comment`, { content: 'Magnifique travail, merci à toute l’équipe.' });
  const commentId = comment?.id ?? comment?.comment?.id;
  const report1 = await call(donor1, 'POST', '/moderation/reports', {
    targetType: commentId ? 'COMMENT' : 'POST',
    targetId: commentId ?? post.id,
    reason: 'Demande de contact privé hors plateforme',
    details: 'Le commentaire invite à sortir de la plateforme.',
  });
  ok('signalement déposé');

  step('Modérateur', 'traite le signalement et masque le commentaire');
  if (commentId) {
    await call(moderator, 'POST', `/posts/comments/${commentId}/hide`, { reason: 'Contact privé interdit' });
    ok('commentaire masqué');
  }
  await call(moderator, 'POST', `/moderation/reports/${report1.id}/resolve`, {
    status: 'ACTIONED',
    resolution: 'Commentaire masqué, rappel des règles envoyé à l’auteur.',
  });
  ok('signalement traité');

  step('Signalements et tickets ouverts', 'restent à traiter par la modération et la gouvernance');
  await call(partner, 'POST', '/moderation/reports', {
    targetType: 'ORPHANAGE',
    targetId: tumaini.id,
    reason: 'Suspicion de collecte de fonds hors plateforme',
    details: 'Un appel aux dons circule avec un numéro mobile money qui n’est pas celui de RISAC.',
    severity: 'SERIOUS',
  });
  await call(donor2, 'POST', '/moderation/reports', {
    targetType: 'POST',
    targetId: post.id,
    reason: 'Photo où un enfant est reconnaissable',
  });
  await call(donor2, 'POST', '/moderation/tickets', {
    category: 'PAYMENT',
    subject: 'Reçu fiscal introuvable',
    body: 'Je ne trouve pas le reçu de mon don de 120 EUR pour Espérance.',
  });
  const ticket = await call(director, 'POST', '/moderation/tickets', {
    category: 'BUG',
    subject: 'Téléversement lent depuis Goma',
    body: 'Les photos du chantier mettent plusieurs minutes à se téléverser.',
  });
  await call(moderator, 'POST', `/moderation/tickets/${ticket.id}/respond`, { message: 'Merci, nous analysons. Essayez en Wi-Fi en attendant.' });
  ok('1 signalement grave, 1 signalement normal, 2 tickets (dont 1 en cours)');

  // ── 7. Pilotage régional et national ──
  step('Chef régional Nord-Kivu', 'planifie l’audit de label du Centre Tumaini');
  await call(regional, 'POST', `/orphanages/${tumaini.id}/label/schedule`, { scheduledAt: '2026-12-03T09:00:00.000Z' });
  ok('audit planifié le 3 décembre');

  step('Directrice Espoir', 'demande le transfert de Josué vers le Centre Tumaini');
  const josue = kidList.find((c) => c.publicId === 'RISAC-CD-0003');
  const esperanceTransferTarget = josue ?? esperance;
  await call(director, 'POST', `/children/${esperanceTransferTarget.id}/transfer`, {
    toOrphanageId: tumaini.id,
    reason: 'Rapprochement avec sa tante, qui vit à Beni.',
  });
  ok('transfert en attente du chef régional');

  step('Responsable national', 'diffuse une annonce à tout le réseau RDC');
  await call(national, 'POST', '/notifications/broadcast', {
    countryId: cd.id,
    title: 'Campagne de rentrée 2026',
    body: 'Merci de compléter les bulletins du premier trimestre avant le 30 novembre.',
  });
  ok('annonce envoyée');

  // ── 8. Gouvernance : l'auditrice consulte le journal et les flux ──
  step('Auditrice éthique', 'consulte le journal d’audit et le rapprochement des comptes');
  const audit: any = await call(auditor, 'GET', '/dashboard/audit-log?take=100');
  const reconcile: any = await call(auditor, 'GET', '/ledger/reconcile');
  ok(`${audit?.total ?? rows(audit).length} entrées au journal ; rapprochement : ${JSON.stringify(reconcile).slice(0, 140)}`);

  // ── 9. Accès web local : dispense de notifications pour les comptes de test ──
  step('Super Admin', 'dispense les comptes de test de l’obligation de notifications push (local)');
  let exempted = 0;
  for (const u of rows(await call(admin, 'GET', '/users?take=200'))) {
    if (u.pushExempt || u.status !== 'ACTIVE') continue;
    await call(admin, 'PATCH', `/users/${u.id}/push-exempt`, { exempt: true });
    exempted++;
  }
  ok(`${exempted} comptes dispensés`);

  // ── Bilan : ce que chaque tableau de bord doit montrer ──
  console.log('\n──────── Bilan par tableau de bord ────────');
  const boards: Array<[string, Session, (db: any) => unknown]> = [
    ['SUPER_ADMIN', admin, (db) => ({ validations: db.queues?.pendingApprovals, signalements: db.queues?.openReports, tickets: db.queues?.openTickets, invités: db.users?.invited })],
    ['ADMIN_FINANCE', finance, (db) => db.disbursements],
    ['MODERATOR', moderator, (db) => db.queues],
    ['ETHICS_AUDITOR', auditor, (db) => ({ ...db.governance, journal: db.auditTrail?.total })],
    ['NATIONAL_MANAGER', national, (db) => db.funds],
    ['REGIONAL_MANAGER', regional, (db) => ({ validations: db.validationQueue, audits: db.scheduledAudits?.length, transferts: db.pendingTransfers?.length })],
    ['AMBASSADOR', ambassador, (db) => ({ validations: db.validationQueue, décaissementsÀConfirmer: db.disbursementsToConfirm, enfants: db.myChildren })],
    ['FIELD_AGENT', agent, (db) => ({ enregistrés: db.childrenRecorded, enValidation: db.pendingValidation })],
    ['ORPHANAGE_DIRECTOR', director, (db) => ({ ...db.children, justificatifsAttendus: db.disbursements?.awaitingReceipts })],
    ['ORPHANAGE_STAFF', psy, (db) => ({ séances: db.sessions, sansÉvaluation: db.childrenWithoutInitialAssessment })],
    ['DONOR', donor1, (db) => db.impact],
    ['PARTNER', partner, (db) => db.contribution],
  ];
  for (const [role, s, pick] of boards) {
    const db: any = await call(s, 'GET', '/dashboard');
    console.log(`  ${role.padEnd(18)} ${JSON.stringify(pick(db))}`);
  }
  console.log('\nSimulation terminée sans erreur.');
}

main().catch((e) => {
  console.error(`\n✗ Simulation interrompue : ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});

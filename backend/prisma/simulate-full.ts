/**
 * RISAC — simulation « de zéro », jouée VIA L'API : le Super Admin crée son compte, invite le premier
 * niveau, puis chaque niveau invite le suivant et accomplit ses tâches. Les orphelinats publient projets
 * et actualités, tout le réseau échange dans la communication et la messagerie.
 *
 * Base requise : VIDE de comptes, avec seulement la géographie et les modèles de dossier :
 *
 *   SEED_MINIMAL=true npm run seed          # DATABASE_URL pointant sur la base de simulation
 *   npm run simulate:full                   # API locale démarrée avec MAIL_ECHO_OTP=true
 *
 * Garde-fous : API locale uniquement, e-mails en « .test » (rien ne part), arrêt si un Super Admin existe.
 */

export {};

const API = (process.env.SIM_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');
const PWD = 'Risac2026!';
const ADMIN_PWD = 'AdminRisac2026!#';
const ADMIN_KEY = 'cle-admin-risac-2026-secrete';
const DOMAIN = 'risac.test';

{
  const host = new URL(API).hostname;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host) && !host.endsWith('.localhost')) {
    console.error(`Refus : ${API} n'est pas une API locale.`);
    process.exit(1);
  }
}

type Session = { token: string; user: any; label: string };
class ApiFailure extends Error {}

let stepNo = 0;
const step = (actor: string, what: string) => console.log(`\n[${String(++stepNo).padStart(2, '0')}] ${actor} — ${what}`);
const ok = (msg: string) => console.log(`     ✓ ${msg}`);

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

const rows = (v: any): any[] => (Array.isArray(v) ? v : v?.items ?? v?.data ?? v?.results ?? []);

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
  return (await call(s, 'POST', '/uploads', fd)).url as string;
}

const pay = (reference: string) =>
  call(null, 'POST', '/payments/webhook', { reference, status: 'SUCCEEDED', providerRef: `SIM-${reference}` });

async function pendingFor(s: Session, entityId: string) {
  const queue: any[] = await call(s, 'GET', '/approvals/queue');
  const r = queue.find((q) => q.entityId === entityId);
  if (!r) throw new ApiFailure(`${s.label} : aucune validation en attente pour ${entityId}`);
  return r;
}
const approve = async (s: Session, entityId: string, comment: string) => {
  const r = await pendingFor(s, entityId);
  await call(s, 'POST', `/approvals/${r.id}/approve`, { comment });
};

async function dossierFor(s: Session, firstName: string, motif: string, categorie: string, admission: string) {
  const [acte, certif, juge] = await Promise.all([
    upload(s, `acte-${firstName}.pdf`, `Acte de naissance ${firstName}`),
    upload(s, `certificat-${firstName}.pdf`, `Certificat de vulnerabilite ${firstName}`),
    upload(s, `decision-${firstName}.pdf`, `Decision DIVAS ${firstName}`),
  ]);
  return {
    lieu_naissance: 'Goma', nationalite: 'Congolaise', langues_parlees: ['Francais', 'Swahili'],
    acte_naissance: acte, statut_pere: 'Decede', statut_mere: 'Inconnue', categorie,
    certificat_vulnerabilite: certif, zone_conflit: 'Nord-Kivu', date_admission: admission,
    motif, refere_par: 'DIVAS Nord-Kivu', decision_juge: juge,
  };
}

// Annuaire des comptes créés : identifiants et sessions, par clé courte.
const U: Record<string, string> = {};
const S: Record<string, Session> = {};
const EMAILS: Record<string, { email: string; role: string }> = {};

async function login(email: string, label: string): Promise<Session> {
  const r = await call(null, 'POST', '/auth/login', { email, password: PWD });
  if (r.adminKeyRequired || r.twoFactorRequired) throw new ApiFailure(`${email} exige une étape supplémentaire`);
  return { token: r.accessToken, user: r.user, label };
}

/** Invite un compte (par `inviter`), l'active avec le code reçu, puis le connecte. */
async function join(inviter: Session, key: string, label: string, dto: Record<string, unknown>) {
  const email = `${key}@${DOMAIN}`;
  const inv = await call(inviter, 'POST', '/auth/invite', { email, ...dto });
  if (!inv.devOtp) throw new ApiFailure("Pas de code d'activation : démarrez l'API avec MAIL_ECHO_OTP=true");
  const token = new URL(inv.activationUrl).searchParams.get('token');
  await call(null, 'POST', '/auth/activate', { token, otp: inv.devOtp, password: PWD });
  U[key] = inv.id;
  S[key] = await login(email, label);
  EMAILS[key] = { email, role: String(dto.role) };
  ok(`${label} invité par ${inviter.label} et activé (${dto.role})`);
}

/** Invitation laissée sans activation (compte « invité » visible dans le tableau de bord). */
async function inviteOnly(inviter: Session, key: string, label: string, dto: Record<string, unknown>) {
  const email = `${key}@${DOMAIN}`;
  const inv = await call(inviter, 'POST', '/auth/invite', { email, ...dto });
  U[key] = inv.id;
  EMAILS[key] = { email, role: String(dto.role) + ' (invité, non activé)' };
  ok(`${label} invité par ${inviter.label}, activation en attente`);
}

async function main() {
  console.log(`Simulation complète RISAC contre ${API}`);
  await call(null, 'GET', '/health').catch(() => {
    throw new ApiFailure(`API injoignable sur ${API}`);
  });
  const setup: any = await call(null, 'GET', '/auth/admin/setup-status');
  if (setup.adminExists) throw new ApiFailure('Un Super Admin existe déjà : relancez sur une base neuve (SEED_MINIMAL=true npm run seed).');

  // ───────────────────────── 1. Le Super Admin crée son compte ─────────────────────────
  step('Super Admin', 'crée son compte (page /admin) avec sa clé administrateur, puis confirme son e-mail');
  const reg = await call(null, 'POST', '/auth/admin/register', {
    email: `admin@${DOMAIN}`, firstName: 'Albert', lastName: 'Ndondo',
    password: ADMIN_PWD, adminKey: ADMIN_KEY, ...(process.env.SIM_SETUP_KEY ? { setupKey: process.env.SIM_SETUP_KEY } : {}),
  });
  if (!reg.devOtp) throw new ApiFailure('Pas de code de confirmation : API sans MAIL_ECHO_OTP=true');
  await call(null, 'POST', '/auth/verify-email', { email: `admin@${DOMAIN}`, otp: reg.devOtp });
  const lg = await call(null, 'POST', '/auth/login', { email: `admin@${DOMAIN}`, password: ADMIN_PWD, adminKey: ADMIN_KEY });
  if (!lg.accessToken) throw new ApiFailure('Connexion du Super Admin impossible');
  const admin: Session = { token: lg.accessToken, user: lg.user, label: 'Super Admin' };
  S.admin = admin;
  U.admin = lg.user.id;
  EMAILS.admin = { email: `admin@${DOMAIN}`, role: 'SUPER_ADMIN (mot de passe et clé propres)' };
  ok('compte créé, connexion avec la clé administrateur réussie');
  const after: any = await call(null, 'GET', '/auth/admin/setup-status');
  if (after.creationOpen) throw new ApiFailure('La création du Super Admin devrait être fermée');
  ok('la création d’un second Super Admin est fermée');

  const countries: any[] = await call(admin, 'GET', '/geo/countries');
  const cd = countries.find((c) => c.iso2 === 'CD');
  const provinces: any[] = await call(admin, 'GET', `/geo/countries/${cd.id}/provinces`);
  const nk = provinces.find((p) => p.code === 'CD-NK');
  const sk = provinces.find((p) => p.code === 'CD-SK');

  // ───────────────────────── 2. Premier niveau : invité par le Super Admin ─────────────────────────
  step('Super Admin', 'invite le premier niveau : finance, modération, éthique, responsable national, partenaire');
  await join(admin, 'finance', 'Admin Finance', { firstName: 'Clarisse', lastName: 'Mbala', role: 'ADMIN_FINANCE', countryId: cd.id });
  await join(admin, 'moderation', 'Modérateur', { firstName: 'Patrick', lastName: 'Lumbu', role: 'MODERATOR', countryId: cd.id });
  await join(admin, 'hcetde', 'Auditrice éthique', { firstName: 'Esther', lastName: 'Kabange', role: 'ETHICS_AUDITOR', countryId: cd.id });
  await join(admin, 'national', 'Responsable national', { firstName: 'Joseph', lastName: 'Mukendi', role: 'NATIONAL_MANAGER', countryId: cd.id });
  await join(admin, 'partenaire', 'Partenaire', { firstName: 'Helene', lastName: 'Martin', role: 'PARTNER', countryId: cd.id, organizationName: 'Fondation Enfance Solidaire' });

  // ───────────────────────── 3. Le national invite les chefs régionaux ─────────────────────────
  step('Responsable national', 'invite les chefs régionaux du Nord-Kivu et du Sud-Kivu');
  await join(S.national, 'regional.nordkivu', 'Chef régional Nord-Kivu', { firstName: 'Marie', lastName: 'Furaha', role: 'REGIONAL_MANAGER', countryId: cd.id, provinceId: nk.id });
  await join(S.national, 'regional.sudkivu', 'Chef régional Sud-Kivu', { firstName: 'Didier', lastName: 'Byamungu', role: 'REGIONAL_MANAGER', countryId: cd.id, provinceId: sk.id });

  // ───────────────────────── 4. Les chefs régionaux invitent ambassadeurs et agents ─────────────────────────
  step('Chefs régionaux', 'invitent leurs ambassadeurs et leur agent de terrain');
  await join(S['regional.nordkivu'], 'ambassadeur1', 'Ambassadrice Sarah', { firstName: 'Sarah', lastName: 'Kavira', role: 'AMBASSADOR', countryId: cd.id, provinceId: nk.id });
  await join(S['regional.nordkivu'], 'ambassadeur3', 'Ambassadrice Grace', { firstName: 'Grace', lastName: 'Mapendo', role: 'AMBASSADOR', countryId: cd.id, provinceId: nk.id });
  await join(S['regional.nordkivu'], 'agent.terrain', 'Agent de terrain', { firstName: 'Jean', lastName: 'Kambale', role: 'FIELD_AGENT', countryId: cd.id, provinceId: nk.id });
  await join(S['regional.sudkivu'], 'ambassadeur2', 'Ambassadeur Olivier', { firstName: 'Olivier', lastName: 'Mugisho', role: 'AMBASSADOR', countryId: cd.id, provinceId: sk.id });

  // ───────────────────────── 5. Orphelinats proposés puis validés ─────────────────────────
  step('Chefs régionaux et agent', 'proposent les orphelinats ; le Super Admin les valide');
  const mk = (s: Session, name: string, city: string, prov: any, places: [number, number], description: string) =>
    call(s, 'POST', '/orphanages', { name, countryId: cd.id, provinceId: prov.id, city, totalPlaces: places[0], occupiedPlaces: places[1], description });
  const espoir = await mk(S['regional.nordkivu'], 'Orphelinat Espoir', 'Goma', nk, [60, 42], 'Accueil des enfants orphelins de guerre et déplacés du Nord-Kivu.');
  const tumaini = await mk(S['regional.nordkivu'], 'Centre Tumaini', 'Beni', nk, [30, 18], 'Structure d’accueil de Beni, en cours de labellisation.');
  const lumiere = await mk(S['regional.sudkivu'], 'Orphelinat Lumière', 'Bukavu', sk, [45, 31], 'Accueil et réinsertion scolaire au Sud-Kivu.');
  ok('trois structures proposées par les chefs régionaux');
  const mapendo = await mk(S['agent.terrain'], 'Centre Mapendo', 'Butembo', nk, [25, 12], 'Structure repérée par l’agent de terrain lors d’une mission.');
  await approve(S['regional.nordkivu'], mapendo.id, 'Visite faite : structure conforme.');
  ok('Centre Mapendo proposé par l’agent, validé par le chef régional (étape 1)');
  for (const o of [espoir, tumaini, lumiere, mapendo]) await call(admin, 'POST', `/orphanages/${o.id}/approve`);
  ok('le Super Admin valide les quatre structures');

  step('Chefs régionaux', 'rattachent les ambassadeurs à leurs structures');
  await call(S['regional.nordkivu'], 'POST', `/orphanages/${espoir.id}/ambassadors`, { ambassadorId: U.ambassadeur1, isPrimary: true });
  await call(S['regional.nordkivu'], 'POST', `/orphanages/${tumaini.id}/ambassadors`, { ambassadorId: U.ambassadeur3, isPrimary: true });
  await call(S['regional.nordkivu'], 'POST', `/orphanages/${mapendo.id}/ambassadors`, { ambassadorId: U.ambassadeur3, isPrimary: true });
  await call(S['regional.sudkivu'], 'POST', `/orphanages/${lumiere.id}/ambassadors`, { ambassadorId: U.ambassadeur2, isPrimary: true });
  ok('Sarah → Espoir, Grace → Tumaini et Mapendo, Olivier → Lumière');

  // ───────────────────────── 6. Directeurs, puis leur personnel ─────────────────────────
  step('Super Admin', 'invite les directeurs d’orphelinat');
  await join(admin, 'chef.espoir', 'Directrice Espoir', { firstName: 'Beatrice', lastName: 'Masika', role: 'ORPHANAGE_DIRECTOR', countryId: cd.id, provinceId: nk.id, orphanageId: espoir.id });
  await join(admin, 'chef.lumiere', 'Directeur Lumière', { firstName: 'Pascal', lastName: 'Bahati', role: 'ORPHANAGE_DIRECTOR', countryId: cd.id, provinceId: sk.id, orphanageId: lumiere.id });

  step('Directrice Espoir', 'invite son personnel : psychologue, éducateur, infirmière (assistante sociale en attente)');
  const staff = (fn: string) => ({ role: 'ORPHANAGE_STAFF', countryId: cd.id, provinceId: nk.id, orphanageId: espoir.id, staffFunction: fn });
  await join(S['chef.espoir'], 'psychologue.espoir', 'Psychologue', { firstName: 'Nadine', lastName: 'Mwamini', ...staff('PSYCHOLOGIST') });
  await join(S['chef.espoir'], 'educateur.espoir', 'Éducateur', { firstName: 'Serge', lastName: 'Kasereka', ...staff('EDUCATOR') });
  await join(S['chef.espoir'], 'infirmier.espoir', 'Infirmière', { firstName: 'Alice', lastName: 'Nsimire', ...staff('NURSE') });
  await inviteOnly(S['chef.espoir'], 'assistante.sociale', 'Assistante sociale', { firstName: 'Ruth', lastName: 'Kahambu', ...staff('SOCIAL_WORKER') });

  step('Bailleurs', 's’inscrivent eux-mêmes et confirment leur e-mail (seul rôle sans invitation)');
  for (const [key, first, last] of [['bailleur1', 'Sophie', 'Dubois'], ['bailleur2', 'Marc', 'Lefevre']] as const) {
    const r = await call(null, 'POST', '/auth/register-donor', { email: `${key}@${DOMAIN}`, password: PWD, firstName: first, lastName: last });
    await call(null, 'POST', '/auth/verify-email', { email: `${key}@${DOMAIN}`, otp: r.devOtp });
    S[key] = await login(`${key}@${DOMAIN}`, `Bailleur ${first}`);
    U[key] = S[key].user.id;
    EMAILS[key] = { email: `${key}@${DOMAIN}`, role: 'DONOR (inscription libre)' };
    ok(`${first} ${last} inscrit(e)`);
  }

  // ───────────────────────── 7. Labellisation et compte vérifié ─────────────────────────
  step('Directeurs, chefs régionaux, Super Admin, Finance', 'labellisation des structures et vérification du compte de paiement');
  for (const [dirKey, regKey, o, result] of [
    ['chef.espoir', 'regional.nordkivu', espoir, 'COMPLIANT'],
    ['chef.lumiere', 'regional.sudkivu', lumiere, 'COMPLIANT_WITH_CONDITIONS'],
  ] as const) {
    await call(S[dirKey], 'POST', `/orphanages/${o.id}/label/apply`);
    await approve(S[regKey], o.id, 'Dossier de candidature complet.');
    await approve(admin, o.id, 'Candidature acceptée.');
    await call(S[regKey], 'POST', `/orphanages/${o.id}/label/schedule`, { scheduledAt: '2026-11-20T09:00:00.000Z' });
    await call(S[regKey], 'POST', `/orphanages/${o.id}/label/decide`, { result, score: result === 'COMPLIANT' ? 92 : 78, notes: 'Audit sur place réalisé.', ...(result !== 'COMPLIANT' ? { conditions: 'Réparer la toiture avant juin.' } : {}) });
    await call(S.finance, 'POST', `/orphanages/${o.id}/verify-account`, { verified: true });
    ok(`${o.name} : ${result}, compte vérifié`);
  }
  await call(S['regional.nordkivu'], 'POST', `/orphanages/${tumaini.id}/label/schedule`, { scheduledAt: '2026-12-03T09:00:00.000Z' });
  ok('Centre Tumaini : audit de label planifié le 3 décembre');

  // ───────────────────────── 8. Dossiers enfants ─────────────────────────
  step('Directeurs', 'créent et soumettent les dossiers enfants ; ambassadeur puis chef régional valident');
  async function child(dirKey: string, first: string, last: string, sex: string, birth: string, extra: Record<string, unknown>, motif: string, cat: string, adm: string) {
    const { child: c } = await call(S[dirKey], 'POST', '/children', {
      firstName: first, lastName: last, sex, birthDate: birth, languages: ['Francais', 'Swahili'], ...extra,
      dossierData: await dossierFor(S[dirKey], first, motif, cat, adm),
    });
    await call(S[dirKey], 'POST', `/children/${c.id}/submit`);
    return c;
  }
  const furaha = await child('chef.espoir', 'Furaha', 'Kavugho', 'F', '2014-06-21', { warOrphan: true, displaced: true, publicStory: 'Furaha aime dessiner et rêve de devenir infirmière.', publicNeeds: 'Uniforme, fournitures et frais scolaires.', desiredJob: 'Infirmière' }, 'Orpheline après les affrontements de Rutshuru.', 'Orphelin de guerre', '2026-10-02');
  const neema = await child('chef.espoir', 'Neema', 'Kasoki', 'F', '2011-03-30', { displaced: true, publicStory: 'Neema prépare son examen d’État et veut devenir médecin.', publicNeeds: 'Livres et frais d’examen.', desiredJob: 'Médecin' }, 'Déplacée du camp de Kanyaruchinya.', 'Deplace', '2026-09-18');
  const bahati = await child('chef.lumiere', 'Bahati', 'Ngoy', 'M', '2009-07-09', { formerArmedGroup: true, publicStory: 'Bahati suit une formation en mécanique.', publicNeeds: 'Outils pour son apprentissage.', desiredJob: 'Mécanicien' }, 'Réinsertion après un groupe armé.', 'Ancien enfant associe aux groupes armes', '2026-08-11');
  for (const [c, amb, reg] of [[furaha, 'ambassadeur1', 'regional.nordkivu'], [neema, 'ambassadeur1', 'regional.nordkivu'], [bahati, 'ambassadeur2', 'regional.sudkivu']] as const) {
    await approve(S[amb], c.id, 'Visite faite, pièces conformes.');
    await approve(S[reg], c.id, 'Aucun doublon, dossier validé.');
  }
  ok('Furaha, Neema et Bahati : dossiers ACTIFS');
  await child('chef.espoir', 'Baraka', 'Musubao', 'M', '2017-01-09', { abandoned: true }, 'Trouvé seul au marché, aucune famille identifiée.', 'Abandonne', '2026-10-28');
  const zawadi = await child('chef.espoir', 'Zawadi', 'Mumbere', 'F', '2015-12-02', { streetChild: true }, 'Enfant des rues orientée vers Espoir.', 'Enfant des rues', '2026-11-04');
  await approve(S.ambassadeur1, zawadi.id, 'Conforme.');
  await call(S['chef.espoir'], 'POST', '/children', { firstName: 'Kambale', lastName: 'Sivyavugha', sex: 'M', estimatedAge: 8 });
  ok('Baraka attend l’ambassadrice, Zawadi attend le chef régional, un brouillon reste ouvert');

  step('Personnel et ambassadrice', 'psychologue, éducateur, infirmière et ambassadrice renseignent le suivi de Furaha');
  await call(S['psychologue.espoir'], 'POST', `/children/${furaha.id}/psycho`, { isInitialAssessment: true, evaluation: 'Anxiété modérée liée au déplacement.', notes: 'Séances hebdomadaires de dessin.', sessionAt: '2026-11-06T10:00:00.000Z' });
  await call(S['educateur.espoir'], 'POST', `/children/${furaha.id}/school`, { school: 'EP Mapendo Goma', grade: '6e primaire', term: 'T1', year: '2026-2027', average: 71.5, fees: 45, publicSummary: 'Bon trimestre, progrès en lecture.' });
  await call(S['infirmier.espoir'], 'POST', `/children/${furaha.id}/health`, { bloodType: 'O+', vaccines: 'Calendrier à jour', consultation: 'Bilan d’entrée : bon état général.' });
  await call(S.ambassadeur1, 'POST', `/children/${furaha.id}/visit`, { note: 'Visite du 8 novembre : bien intégrée, suivi scolaire régulier.', rating: 4 });
  ok('psychologue, école, santé et rapport de visite enregistrés');

  // ───────────────────────── 9. Projets : l'orphelinat les crée, le réseau les valide, l'orphelinat les publie ─────────────────────────
  step('Orphelinats', 'créent leurs projets ; ambassadeur et chef régional valident ; l’orphelinat publie');
  async function project(dirKey: string, ambKey: string, regKey: string | null, dto: Record<string, unknown>) {
    const p = await call(S[dirKey], 'POST', '/projects', dto);
    await call(S[dirKey], 'POST', `/projects/${p.id}/submit`);
    await approve(S[ambKey], p.id, 'Devis vérifiés sur place.');
    if (regKey) await approve(S[regKey], p.id, 'Budget cohérent.');
    await call(S[dirKey], 'POST', `/projects/${p.id}/publish`);
    return p;
  }
  const dorm = await project('chef.espoir', 'ambassadeur1', 'regional.nordkivu', { title: 'Réhabilitation du dortoir des filles', description: 'Toiture, moustiquaires et 20 lits superposés pour le dortoir des filles.', kind: 'ORPHANAGE_PROJECT', targetAmount: 2500, category: 'Infrastructure' });
  const puits = await project('chef.espoir', 'ambassadeur1', null, { title: 'Puits d’eau potable', description: 'Forage et pompe manuelle pour l’orphelinat et le quartier voisin.', kind: 'ORPHANAGE_PROJECT', targetAmount: 900, category: 'Eau et hygiène' });
  const urgent = await project('chef.espoir', 'ambassadeur1', null, { title: 'Urgence : médicaments contre le paludisme', description: 'Traitement de quinze enfants touchés cette semaine.', kind: 'URGENT_NEED', targetAmount: 400, category: 'Santé' });
  await project('chef.espoir', 'ambassadeur1', null, { title: 'Kit scolaire et uniforme de Furaha', description: 'Uniforme, cartable, manuels et frais de l’année 2026-2027.', childId: furaha.id, targetAmount: 600, category: 'Éducation' });
  const biblio = await project('chef.lumiere', 'ambassadeur2', null, { title: 'Bibliothèque de l’orphelinat', description: 'Cinq cents livres scolaires et une salle de lecture.', kind: 'ORPHANAGE_PROJECT', targetAmount: 900, category: 'Éducation' });
  ok('5 projets publiés par les orphelinats (dortoir, puits, urgence, kit scolaire, bibliothèque)');
  const pending = await call(S['chef.lumiere'], 'POST', '/projects', { title: 'Atelier de menuiserie', description: 'Formation professionnelle pour les adolescents.', kind: 'ORPHANAGE_PROJECT', targetAmount: 1800, category: 'Formation' });
  await call(S['chef.lumiere'], 'POST', `/projects/${pending.id}/submit`);
  await approve(S.ambassadeur2, pending.id, 'Projet pertinent.');
  ok('« Atelier de menuiserie » (1 800 USD) attend le chef régional du Sud-Kivu');

  // ───────────────────────── 10. Dons, parrainage, cofinancement ─────────────────────────
  step('Bailleurs et partenaire', 'financent projets et enfants, parrainent');
  const don = async (s: Session, dto: Record<string, unknown>) => pay((await call(s, 'POST', '/payments/donations', dto)).donation.reference);
  await don(S.bailleur1, { kind: 'PROJECT_CONTRIBUTION', projectId: dorm.id, amount: 1500, provider: 'STRIPE', message: 'Pour que les filles dorment au sec.', anonymous: false });
  await don(S.bailleur2, { kind: 'PROJECT_CONTRIBUTION', projectId: puits.id, amount: 600, currency: 'EUR', provider: 'PAYPAL' });
  await don(S.bailleur1, { kind: 'PROJECT_CONTRIBUTION', projectId: urgent.id, amount: 400, provider: 'STRIPE' });
  await don(S.bailleur2, { kind: 'PROJECT_CONTRIBUTION', projectId: biblio.id, amount: 500, provider: 'STRIPE' });
  await don(S.partenaire, { kind: 'PROJECT_CONTRIBUTION', projectId: dorm.id, amount: 500, provider: 'BANK_TRANSFER' });
  await don(S.bailleur2, { kind: 'GENERAL_FUND', amount: 75, currency: 'EUR', provider: 'STRIPE' });
  const sp = await call(S.bailleur1, 'POST', '/payments/sponsorships', { childId: furaha.id, monthlyAmount: 50, scope: 'EDUCATION', endRule: 'FIXED_MONTHS', months: 12, provider: 'STRIPE' });
  await pay(sp.firstPayment.donation.reference);
  const sp2 = await call(S.bailleur2, 'POST', '/payments/sponsorships', { childId: neema.id, monthlyAmount: 30, scope: 'EDUCATION', endRule: 'FIXED_MONTHS', months: 12, provider: 'PAYPAL' });
  await pay(sp2.firstPayment.donation.reference);
  await call(S.bailleur2, 'POST', `/posts/subscribe/${neema.id}`);
  await call(S.bailleur2, 'POST', '/posts/favorite', { projectId: dorm.id });
  ok('6 dons confirmés, 2 parrainages actifs, abonnement et favori');

  // ───────────────────────── 11. Décaissements ─────────────────────────
  step('Directrice, ambassadrice, Finance', 'décaissements : demande → confirmation → paiement → justificatifs');
  const d1 = await call(S['chef.espoir'], 'POST', '/disbursements', { amount: 800, reason: 'Achat de 60 tôles et charpente pour le dortoir', projectId: dorm.id });
  await call(S.ambassadeur1, 'POST', `/disbursements/${d1.id}/confirm`);
  await call(S.finance, 'POST', `/disbursements/${d1.id}/pay`, { method: 'M-Pesa', ref: 'MPESA-FULL-0001' });
  await call(S['chef.espoir'], 'POST', `/disbursements/${d1.id}/receipts`, { name: 'Facture quincaillerie', url: await upload(S['chef.espoir'], 'facture-toles.pdf', 'Facture 800 USD'), amount: 800, kind: 'INVOICE' });
  ok(`${d1.reference} : payé et soldé`);
  const d2 = await call(S['chef.espoir'], 'POST', '/disbursements', { amount: 400, reason: 'Main-d’œuvre des menuisiers (première tranche)', projectId: dorm.id });
  await call(S.ambassadeur1, 'POST', `/disbursements/${d2.id}/confirm`);
  await call(S.finance, 'POST', `/disbursements/${d2.id}/pay`, { method: 'M-Pesa', ref: 'MPESA-FULL-0002' });
  await call(S['chef.espoir'], 'POST', `/disbursements/${d2.id}/receipts`, { name: 'Reçu menuisiers', url: await upload(S['chef.espoir'], 'recu-menuisiers.pdf', 'Recu 250 USD'), amount: 250, kind: 'INVOICE' });
  ok(`${d2.reference} : payé, justifié à 250/400`);
  const d3 = await call(S['chef.espoir'], 'POST', '/disbursements', { amount: 300, reason: 'Achat de 20 matelas', projectId: dorm.id });
  await call(S.ambassadeur1, 'POST', `/disbursements/${d3.id}/confirm`);
  ok(`${d3.reference} : confirmé, à payer par l’Admin Finance`);
  await call(S['chef.espoir'], 'POST', '/disbursements', { amount: 150, reason: 'Achat de 20 moustiquaires', projectId: dorm.id });
  const d5 = await call(S['chef.lumiere'], 'POST', '/disbursements', { amount: 250, reason: 'Achat des premiers manuels', projectId: biblio.id });
  await call(S.ambassadeur2, 'POST', `/disbursements/${d5.id}/confirm`);
  await call(S.finance, 'POST', `/disbursements/${d5.id}/pay`, { method: 'Airtel Money', ref: 'AIRTEL-FULL-0001' });
  ok('une demande attend l’ambassadrice, une autre vient d’être payée à Lumière');

  // ───────────────────────── 12. Communication : publications du réseau ─────────────────────────
  step('Tout le réseau', 'publie dans l’espace de communication');
  const post = (s: Session, dto: Record<string, unknown>) => call(s, 'POST', '/posts', dto);
  const welcome = await post(admin, { type: 'NEWS', content: 'Bienvenue sur la plateforme RISAC : chaque enfant suivi, chaque franc tracé jusqu’à sa preuve de dépense.' });
  await post(S.national, { type: 'NEWS', content: 'Campagne de rentrée 2026 : merci aux structures de compléter les bulletins du premier trimestre avant le 30 novembre.' });
  await post(S['regional.nordkivu'], { type: 'NEWS', content: 'Nord-Kivu : deux nouvelles structures validées ce mois-ci et trois dossiers d’enfants en cours de validation.' });
  await post(S['regional.sudkivu'], { type: 'NEWS', content: 'Sud-Kivu : l’audit de label de l’Orphelinat Lumière est terminé, avec conditions à lever avant juin.' });
  const amb1 = await post(S.ambassadeur1, { type: 'NEWS', childId: furaha.id, content: 'Furaha a repris l’école avec joie : uniforme, cahiers et un sourire qui fait plaisir à voir.' });
  await post(S.ambassadeur1, { type: 'THANKS', projectId: dorm.id, orphanageId: espoir.id, content: 'Merci à tous les donateurs du dortoir : la toiture est posée et les filles dorment au sec depuis lundi.' });
  await post(S.ambassadeur2, { type: 'NEWS', content: 'Visite à l’Orphelinat Lumière : la rentrée s’est bien passée, tous les enfants ont repris les cours.' });
  const org1 = await post(S['chef.espoir'], { type: 'ORPHANAGE_NEWS', orphanageId: espoir.id, content: 'Espoir : les travaux du dortoir avancent, la charpente est terminée et la couverture commence cette semaine.' });
  await post(S['chef.espoir'], { type: 'URGENT_NEED', orphanageId: espoir.id, projectId: urgent.id, content: 'Besoin urgent : quinze enfants ont le paludisme, il manque des médicaments cette semaine.' });
  await post(S['chef.espoir'], { type: 'SPONSORSHIP_CALL', orphanageId: espoir.id, content: 'Espoir cherche des parrains pour les enfants de la nouvelle rentrée : quelques dollars par mois changent une vie.' });
  await post(S['chef.lumiere'], { type: 'ORPHANAGE_NEWS', orphanageId: lumiere.id, content: 'Lumière : la bibliothèque de l’orphelinat va voir le jour grâce à vos dons, déjà plus de la moitié collectée.' });
  await post(S['chef.lumiere'], { type: 'THANKS', orphanageId: lumiere.id, projectId: biblio.id, content: 'Merci aux bailleurs : les premiers manuels sont arrivés et les enfants les ont accueillis avec enthousiasme.' });
  await post(S.moderation, { type: 'NEWS', content: 'Rappel de la communauté : respectons la vie privée des enfants, aucune photo ni information personnelle hors du cadre prévu.' });
  ok('13 publications : Super Admin, national, régionaux, ambassadeurs, directeurs, modérateur');
  for (const k of ['bailleur1', 'bailleur2', 'partenaire', 'ambassadeur1', 'national']) await call(S[k], 'POST', `/posts/${org1.id}/react`, { kind: 'HEART' }).catch(() => undefined);
  await call(S.bailleur1, 'POST', `/posts/${amb1.id}/comment`, { content: 'Quelle belle nouvelle, merci pour ce suivi attentionné.' });
  await call(S.partenaire, 'POST', `/posts/${welcome.id}/comment`, { content: 'Heureux de rejoindre le réseau, bonne continuation à toute l’équipe.' });
  await call(S['psychologue.espoir'], 'POST', `/posts/${org1.id}/comment`, { content: 'Les enfants attendent ce dortoir avec impatience.' });
  ok('réactions et commentaires des bailleurs, du partenaire et du personnel');

  step('Messagerie', 'le Super Admin, la modération et les régionaux ouvrent des canaux ; chacun écrit');
  const everyone = Object.values(U).filter((id) => id !== U.admin);
  const general = await call(admin, 'POST', '/channels', { type: 'GENERAL', name: 'Canal général RISAC', description: 'Annonces et échanges de tout le réseau.', memberIds: everyone });
  await call(admin, 'POST', `/channels/${general.id}/messages`, { content: 'Bienvenue à tous dans le canal général. Présentez-vous en quelques mots.' });
  await call(S.national, 'POST', `/channels/${general.id}/messages`, { content: 'Responsable national : bienvenue, nous démarrons la campagne de rentrée.' });
  await call(S.ambassadeur1, 'POST', `/channels/${general.id}/messages`, { content: 'Ambassadrice du Nord-Kivu : ravie de vous retrouver ici.' });
  await call(S.bailleur1, 'POST', `/channels/${general.id}/messages`, { content: 'Merci pour cet espace, hâte de suivre les projets.' });
  const regCh = await call(S['regional.nordkivu'], 'POST', '/channels', { type: 'REGIONAL', name: 'Région Nord-Kivu', provinceId: nk.id, memberIds: [U.ambassadeur1, U.ambassadeur3, U['agent.terrain'], U['chef.espoir']] });
  await call(S['regional.nordkivu'], 'POST', `/channels/${regCh.id}/messages`, { content: 'Point de la semaine : trois dossiers à valider et un audit à préparer à Beni.' });
  await call(S.ambassadeur3, 'POST', `/channels/${regCh.id}/messages`, { content: 'Je prépare la visite de Beni pour le 3 décembre.' });
  const orgCh = await call(admin, 'POST', '/channels', { type: 'AMBASSADOR_ORPHANAGE', name: 'Canal Orphelinat Espoir', orphanageId: espoir.id, memberIds: [U.ambassadeur1, U['chef.espoir']] });
  await call(S['chef.espoir'], 'POST', `/channels/${orgCh.id}/messages`, { content: 'Bonjour Sarah, les matelas sont commandés, la confirmation arrive.' });
  await call(S.ambassadeur1, 'POST', `/channels/${orgCh.id}/messages`, { content: 'Bien reçu, je confirme la demande dès aujourd’hui.' });
  ok('canal général, canal régional et canal d’orphelinat animés');

  // ───────────────────────── 13. Modération, support, gouvernance ─────────────────────────
  step('Modération, support, gouvernance', 'signalements, tickets, annonce nationale, consultation du journal');
  const cm = await call(S.bailleur2, 'POST', `/posts/${welcome.id}/comment`, { content: 'Bravo ! Écrivez-moi en privé pour une aide directe.' });
  const cmId = cm.id ?? cm.comment?.id;
  const rep = await call(S.bailleur1, 'POST', '/moderation/reports', { targetType: cmId ? 'COMMENT' : 'POST', targetId: cmId ?? welcome.id, reason: 'Demande de contact privé hors plateforme' });
  if (cmId) await call(S.moderation, 'POST', `/posts/comments/${cmId}/hide`, { reason: 'Contact privé interdit' });
  await call(S.moderation, 'POST', `/moderation/reports/${rep.id}/resolve`, { status: 'ACTIONED', resolution: 'Commentaire masqué, rappel envoyé.' });
  await call(S.partenaire, 'POST', '/moderation/reports', { targetType: 'ORPHANAGE', targetId: tumaini.id, reason: 'Suspicion de collecte hors plateforme', details: 'Un appel aux dons circule avec un numéro qui n’est pas celui de RISAC.', severity: 'SERIOUS' });
  await call(S.bailleur2, 'POST', '/moderation/tickets', { category: 'PAYMENT', subject: 'Reçu fiscal introuvable', body: 'Je ne trouve pas le reçu de mon don de 600 EUR.' });
  const tk = await call(S['chef.espoir'], 'POST', '/moderation/tickets', { category: 'BUG', subject: 'Téléversement lent depuis Goma', body: 'Les photos du chantier mettent longtemps à partir.' });
  await call(S.moderation, 'POST', `/moderation/tickets/${tk.id}/respond`, { message: 'Merci, nous analysons. Essayez en Wi-Fi en attendant.' });
  await call(S.national, 'POST', '/notifications/broadcast', { countryId: cd.id, title: 'Campagne de rentrée 2026', body: 'Merci de compléter les bulletins avant le 30 novembre.' });
  await call(S['chef.espoir'], 'POST', `/children/${neema.id}/transfer`, { toOrphanageId: tumaini.id, reason: 'Rapprochement avec sa tante, à Beni.' });
  const audit: any = await call(S.hcetde, 'GET', '/dashboard/audit-log?take=100');
  const recon: any = await call(S.hcetde, 'GET', '/ledger/reconcile');
  ok(`journal d’audit : ${audit?.total ?? rows(audit).length} entrées ; comptes équilibrés : ${recon.balanced}`);

  step('Super Admin', 'dispense les comptes de test de l’obligation de notifications push (local)');
  let exempted = 0;
  for (const u of rows(await call(admin, 'GET', '/users?take=200'))) {
    if (u.pushExempt || u.status !== 'ACTIVE') continue;
    await call(admin, 'PATCH', `/users/${u.id}/push-exempt`, { exempt: true });
    exempted++;
  }
  ok(`${exempted} comptes dispensés`);

  // ───────────────────────── Bilan ─────────────────────────
  console.log('\n──────── Bilan par tableau de bord ────────');
  const show: Array<[string, string, (d: any) => unknown]> = [
    ['SUPER_ADMIN', 'admin', (d) => ({ validations: d.queues?.pendingApprovals, signalements: d.queues?.openReports, tickets: d.queues?.openTickets, invités: d.users?.invited, utilisateurs: d.users?.total, publications: d.posts })],
    ['ADMIN_FINANCE', 'finance', (d) => d.disbursements],
    ['MODERATOR', 'moderation', (d) => d.queues],
    ['ETHICS_AUDITOR', 'hcetde', (d) => ({ ...d.governance, journal: d.auditTrail?.total })],
    ['NATIONAL_MANAGER', 'national', (d) => d.funds],
    ['REGIONAL_MANAGER', 'regional.nordkivu', (d) => ({ validations: d.validationQueue, audits: d.scheduledAudits?.length, transferts: d.pendingTransfers?.length })],
    ['AMBASSADOR', 'ambassadeur1', (d) => ({ validations: d.validationQueue, décaissementsÀConfirmer: d.disbursementsToConfirm, enfants: d.myChildren, publications: d.publications?.count })],
    ['FIELD_AGENT', 'agent.terrain', (d) => ({ enregistrés: d.childrenRecorded })],
    ['ORPHANAGE_DIRECTOR', 'chef.espoir', (d) => ({ ...d.children, projets: d.projects, justificatifsAttendus: d.disbursements?.awaitingReceipts })],
    ['ORPHANAGE_STAFF', 'psychologue.espoir', (d) => ({ séances: d.sessions, sansÉvaluation: d.childrenWithoutInitialAssessment })],
    ['DONOR', 'bailleur1', (d) => d.impact],
    ['PARTNER', 'partenaire', (d) => d.contribution],
  ];
  for (const [role, key, pick] of show) console.log(`  ${role.padEnd(18)} ${JSON.stringify(pick(await call(S[key], 'GET', '/dashboard')))}`);
  const feed = rows(await call(admin, 'GET', '/posts/feed'));
  const projs = rows(await call(admin, 'GET', '/projects/public'));
  console.log(`\n  Communication : ${feed.length} publications visibles · Projets publiés : ${projs.length}`);

  console.log('\n──────── Comptes créés (mot de passe commun : ' + PWD + ') ────────');
  for (const v of Object.values(EMAILS)) console.log(`  ${v.email.padEnd(40)} ${v.role}`);
  console.log(`\n  Super Admin : mot de passe « ${ADMIN_PWD} » + clé administrateur « ${ADMIN_KEY} »`);
  console.log('\nSimulation complète terminée sans erreur.');
}

main().catch((e) => {
  console.error(`\n✗ Simulation interrompue : ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});

const { api, login, check, section, results } = require('./e2e-flows');

async function main() {
  const T = {};

  section('Authentification et roles');
  const accounts = {
    admin: 'admin@risac.org',
    finance: 'finance@risac.org',
    moderator: 'moderation@risac.org',
    auditor: 'hcetde@risac.org',
    national: 'national.cd@risac.org',
    regional: 'regional.nordkivu@risac.org',
    ambassador: 'ambassadeur1@risac.org',
    ambassador2: 'ambassadeur2@risac.org',
    agent: 'agent.terrain@risac.org',
    director: 'chef.espoir@risac.org',
    psy: 'psychologue.espoir@risac.org',
    educator: 'educateur.espoir@risac.org',
    donor: 'bailleur1@example.org',
    partner: 'partenaire@example.org',
  };
  for (const [key, email] of Object.entries(accounts)) {
    try {
      T[key] = await login(email);
      check(`Connexion ${key}`, true);
    } catch (e) {
      check(`Connexion ${key}`, false, e.message);
    }
  }

  const bad = await api('/auth/login', {
    method: 'POST',
    body: { email: 'admin@risac.org', password: 'mauvais-mot-de-passe' },
  });
  check('Mot de passe invalide rejete', bad.status === 401, `status ${bad.status}`);

  const noToken = await api('/children');
  check('Acces sans jeton refuse', noToken.status === 401, `status ${noToken.status}`);

  section('Perimetres de visibilite');
  const adminChildren = await api('/children', { token: T.admin });
  check('Super Admin voit tous les enfants', adminChildren.data.total >= 5, `total ${adminChildren.data.total}`);

  const ambChildren = await api('/children', { token: T.ambassador });
  check('Ambassadeur ne voit que ses enfants assignes', ambChildren.data.total >= 3, `total ${ambChildren.data.total}`);

  const amb2Children = await api('/children', { token: T.ambassador2 });
  check('Second ambassadeur voit ses propres enfants', amb2Children.data.total === 2, `total ${amb2Children.data.total}`);

  const dirChildren = await api('/children', { token: T.director });
  check(
    'Chef d orphelinat limite a sa structure',
    dirChildren.data.items.every((c) => c.orphanage.slug === 'orphelinat-espoir-goma'),
    `${dirChildren.data.total} enfants`,
  );

  const regChildren = await api('/children', { token: T.regional });
  check(
    'Chef regional limite a sa province',
    regChildren.data.items.every((c) => c.orphanage.province.nameFr === 'Nord-Kivu'),
    `${regChildren.data.total} enfants`,
  );

  section('Profil public et confidentialite');
  const feed = await api('/children/public/feed');
  check('Fil public accessible sans compte', Array.isArray(feed.data), `${feed.data.length} profils`);
  check(
    'Le nom de famille n apparait jamais en public',
    feed.data.every((c) => !('lastName' in c)),
  );
  check(
    'Seuls les dossiers actifs sont publics',
    feed.data.length < adminChildren.data.total,
    `${feed.data.length} publics sur ${adminChildren.data.total}`,
  );

  const child = adminChildren.data.items.find((c) => c.firstName === 'Amani');
  const donorView = await api(`/children/${child.id}`, { token: T.donor });
  check(
    'Le bailleur ne voit pas le volet sante',
    donorView.status === 200 && !donorView.data.healthRecords,
    `status ${donorView.status}`,
  );
  check('Le bailleur ne voit pas le nom de famille', !donorView.data.lastName);

  section('Psychotrauma (tres confidentiel)');
  const psySess = await api(`/children/${child.id}/psycho`, { token: T.psy });
  check('Le psychologue accede au volet psychotrauma', psySess.status === 200, `status ${psySess.status}`);

  const eduSess = await api(`/children/${child.id}/psycho`, { token: T.educator });
  check('L educateur est refuse sur le psychotrauma', eduSess.status === 403, `status ${eduSess.status}`);

  const auditorSess = await api(`/children/${child.id}/psycho`, { token: T.auditor });
  check('L Auditeur Ethique accede au psychotrauma', auditorSess.status === 200, `status ${auditorSess.status}`);

  const addPsy = await api(`/children/${child.id}/psycho`, {
    method: 'POST',
    token: T.psy,
    body: { isInitialAssessment: true, evaluation: 'Evaluation initiale', notes: 'Notes confidentielles' },
  });
  check('Le psychologue saisit une seance', addPsy.status === 201, `status ${addPsy.status}`);

  const eduAddPsy = await api(`/children/${child.id}/psycho`, {
    method: 'POST',
    token: T.educator,
    body: { evaluation: 'tentative' },
  });
  check('L educateur ne peut pas saisir une seance', eduAddPsy.status === 403, `status ${eduAddPsy.status}`);

  section('Auditeur Ethique en lecture seule');
  const auditorWrite = await api(`/children/${child.id}`, {
    method: 'PATCH',
    token: T.auditor,
    body: { publicNeeds: 'tentative de modification' },
  });
  check('Ecriture refusee a l Auditeur Ethique', auditorWrite.status === 403, `status ${auditorWrite.status}`);

  return { T, child };
}

async function run() {
  const { T, child } = await main();
  const { newChild, espoir } = await require('./run-e2e-2')(T, child);
  await require('./run-e2e-3')(T, child, newChild, espoir);
  await require('./run-e2e-4')(T, child, newChild, espoir);
  await require('./run-e2e-5')(T, child, newChild, espoir);
  await require('./run-e2e-6')(T, child, newChild);
  await require('./run-e2e-7')(T);
  await require('./run-e2e-8')(T);
  await require('./run-e2e-9')(T);
}

run()
  .then(() => {
    const fails = results.filter((r) => !r.ok);
    console.log('\n================ RESULTAT ================');
    console.log(`${results.length - fails.length}/${results.length} verifications reussies`);
    if (fails.length) {
      console.log('\nEchecs :');
      for (const f of fails) console.log(`  [${f.section}] ${f.name} ${f.detail ?? ''}`);
    }
    process.exit(fails.length ? 1 : 0);
  })
  .catch((e) => {
    console.error('ERREUR FATALE', e);
    const fails = results.filter((r) => !r.ok);
    console.log(`\n${results.length - fails.length}/${results.length} verifications reussies avant l erreur`);
    process.exit(1);
  });

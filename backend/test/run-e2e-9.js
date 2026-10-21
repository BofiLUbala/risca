const { api, check, section } = require('./e2e-flows');

module.exports = async function phase9(T) {
  section('Modele de dossier par pays');

  const countries = (await api('/geo/countries')).data;
  const cd = countries.find((c) => c.iso2 === 'CD');
  const be = countries.find((c) => c.iso2 === 'BE');
  const cdTemplate = await api(`/templates/country/${cd.id}`, { token: T.director });
  const beTemplate = await api(`/templates/country/${be.id}`, { token: T.director });

  const cdKeys = cdTemplate.data.sections.flatMap((s) => s.fields.map((f) => f.key));
  const beKeys = beTemplate.data.sections.flatMap((s) => s.fields.map((f) => f.key));

  check(
    'Le modele RDC contient les documents specifiques',
    cdKeys.includes('acte_naissance') && cdKeys.includes('certificat_vulnerabilite'),
    `${cdKeys.length} champs`,
  );
  check('Le modele Belgique differe du modele RDC', !beKeys.includes('certificat_vulnerabilite'), `${beKeys.length} champs`);
  check('Les deux pays partagent le tronc commun', cdKeys.includes('statut_pere') && beKeys.includes('statut_pere'));

  const addField = await api(`/templates/sections/${cdTemplate.data.sections[0].id}/fields`, {
    method: 'POST',
    token: T.admin,
    body: { key: `test_champ_${Date.now()}`, labelFr: 'Champ de test', labelEn: 'Test field', type: 'TEXT' },
  });
  check('Un champ peut etre ajoute sans changement de code', addField.status === 201, `status ${addField.status}`);
  await api(`/templates/fields/${addField.data.id}`, { method: 'DELETE', token: T.admin });

  const ambAddField = await api(`/templates/sections/${cdTemplate.data.sections[0].id}/fields`, {
    method: 'POST',
    token: T.ambassador,
    body: { key: 'x', labelFr: 'x', labelEn: 'x' },
  });
  check('Un ambassadeur ne modifie pas le modele', ambAddField.status === 403, `status ${ambAddField.status}`);

  section('Geographie ISO 3166');
  check('Les pays sont charges', countries.length >= 12, `${countries.length} pays`);
  const provinces = (await api(`/geo/countries/${cd.id}/provinces`)).data;
  check('Les 26 provinces de la RDC sont chargees', provinces.length === 26, `${provinces.length} provinces`);
  check(
    'Les zones a risque sont marquees',
    provinces.filter((p) => p.riskZone).length === 4,
    provinces.filter((p) => p.riskZone).map((p) => p.nameFr).join(', '),
  );

  section('Notifications');
  const notifs = await api('/notifications', { token: T.ambassador });
  check('L ambassadeur a recu des notifications', notifs.data.length > 0, `${notifs.data.length} notifications`);

  const broadcast = await api('/notifications/broadcast', {
    method: 'POST',
    token: T.admin,
    body: { role: 'AMBASSADOR', title: 'Message du reseau', body: 'Rappel trimestriel.' },
  });
  check('Diffusion ciblee par role', broadcast.data?.count > 0, `${broadcast.data?.count} destinataires`);

  const count = await api('/notifications/count', { token: T.ambassador });
  check('Compteur de non-lus disponible', typeof count.data.unread === 'number', `${count.data.unread} non-lus`);
};

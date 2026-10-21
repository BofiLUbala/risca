const { api, check, section } = require('./e2e-flows');

module.exports = async function phase2(T, child) {
  section('Circuit de validation du dossier enfant');

  const orphanages = await api('/orphanages', { token: T.director });
  const espoir = orphanages.data.find((o) => o.slug === 'orphelinat-espoir-goma');

  const created = await api('/children', {
    method: 'POST',
    token: T.director,
    body: {
      firstName: 'Testimoni',
      lastName: 'Kabila',
      sex: 'M',
      birthDate: '2016-05-10',
      admissionReason: 'Orphelin de guerre recueilli',
      publicStory: 'Nouvel enfant pour le test de bout en bout.',
      dossierData: {
        statut_pere: 'Decede',
        statut_mere: 'Inconnue',
        categorie: 'Orphelin de guerre',
        date_admission: '2026-10-01',
        motif: 'Recueilli apres deplacement',
        acte_naissance: 'uploads/acte.pdf',
        certificat_vulnerabilite: 'uploads/certificat.pdf',
        decision_juge: 'uploads/jugement.pdf',
      },
    },
  });
  check('Chef d orphelinat cree un dossier', created.status === 201, `status ${created.status}`);
  const newChild = created.data.child;

  const dupCheck = await api('/children/check-duplicates', {
    method: 'POST',
    token: T.director,
    body: { firstName: 'Amani', lastName: 'Bashige', orphanageId: espoir.id },
  });
  check(
    'Detection des doublons fonctionne',
    Array.isArray(dupCheck.data) && dupCheck.data.length > 0 && dupCheck.data[0].matchScore >= 80,
    `${dupCheck.data?.length} candidat(s), score ${dupCheck.data?.[0]?.matchScore}`,
  );

  const submitted = await api(`/children/${newChild.id}/submit`, { method: 'POST', token: T.director });
  check('Soumission au circuit de validation', submitted.status === 201, `status ${submitted.status}`);
  check(
    'Dossier passe en validation',
    submitted.data.child?.status === 'IN_VALIDATION',
    submitted.data.child?.status,
  );

  const ambQueue = await api('/approvals/queue', { token: T.ambassador });
  const dossierReq = ambQueue.data.find((r) => r.entityId === newChild.id);
  check('Le dossier apparait dans la file de l ambassadeur', !!dossierReq, `${ambQueue.data.length} en attente`);

  const wrongApprove = await api(`/approvals/${dossierReq.id}/approve`, {
    method: 'POST',
    token: T.ambassador2,
    body: {},
  });
  check(
    'Un autre ambassadeur ne peut pas valider',
    wrongApprove.status === 403,
    `status ${wrongApprove.status}`,
  );

  const ambApprove = await api(`/approvals/${dossierReq.id}/approve`, {
    method: 'POST',
    token: T.ambassador,
    body: { comment: 'Dossier verifie et complet' },
  });
  check('Ambassadeur valide son etape', ambApprove.status === 201, `status ${ambApprove.status}`);
  check(
    'Le circuit passe au chef regional',
    ambApprove.data.status === 'PENDING' && ambApprove.data.currentStepOrder === 2,
    `etape ${ambApprove.data.currentStepOrder}`,
  );

  const regApprove = await api(`/approvals/${dossierReq.id}/approve`, {
    method: 'POST',
    token: T.regional,
    body: { comment: 'Aucun doublon detecte' },
  });
  check(
    'Chef regional valide definitivement',
    regApprove.data.status === 'APPROVED',
    regApprove.data.status,
  );

  const autoActivated = await api(`/children/${newChild.id}`, { token: T.regional });
  check(
    'Le dossier est active des la derniere validation, sans geste supplementaire',
    autoActivated.data?.status === 'ACTIVE',
    autoActivated.data?.status,
  );

  // La route manuelle reste un repli : elle doit etre sans effet si le dossier est deja actif.
  const finalize = await api(`/children/${newChild.id}/finalize`, { method: 'POST', token: T.regional });
  check('Dossier active apres validation', finalize.data?.status === 'ACTIVE', finalize.data?.status);

  section('Mise a jour du dossier et historique non effacable');
  const dirUpdate = await api(`/children/${newChild.id}`, {
    method: 'PATCH',
    token: T.director,
    body: { publicNeeds: 'Frais scolaires pour le trimestre' },
  });
  check(
    'Le chef d orphelinat propose, sans appliquer',
    dirUpdate.data.applied === false && !!dirUpdate.data.pendingApproval,
    `applied=${dirUpdate.data.applied}`,
  );

  const updReq = dirUpdate.data.pendingApproval;
  await api(`/approvals/${updReq.id}/approve`, { method: 'POST', token: T.ambassador, body: {} });
  const applied = await api(`/children/updates/${updReq.id}/apply`, { method: 'POST', token: T.ambassador });
  check(
    'La proposition validee est appliquee',
    applied.data?.publicNeeds === 'Frais scolaires pour le trimestre',
    applied.data?.publicNeeds,
  );

  const ambUpdate = await api(`/children/${newChild.id}`, {
    method: 'PATCH',
    token: T.ambassador,
    body: { talents: 'Dessin et football' },
  });
  check(
    'L ambassadeur assigne modifie directement',
    ambUpdate.data.applied === true,
    `applied=${ambUpdate.data.applied}`,
  );

  const versions = await api(`/children/${newChild.id}/versions`, { token: T.ambassador });
  check('Les versions du dossier sont conservees', versions.data.length >= 3, `${versions.data.length} versions`);

  const diff = await api(`/children/${newChild.id}/diff?from=1&to=${versions.data[0].version}`, {
    token: T.ambassador,
  });
  check('La comparaison de versions fonctionne', Array.isArray(diff.data.changes), `${diff.data.changes?.length} changements`);

  const timeline = await api(`/children/${newChild.id}/timeline`, { token: T.ambassador });
  check('L historique retrace les evenements', timeline.data.length >= 3, `${timeline.data.length} evenements`);

  const admission = timeline.data.find((e) => e.type === 'ADMISSION');
  check('L admission est enregistree dans l historique', !!admission);

  return { newChild, espoir };
};

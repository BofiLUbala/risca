const { api, check, section } = require('./e2e-flows');

module.exports = async function phase5(T, child, newChild, espoir) {
  section('Separation des pouvoirs sur l argent');

  const ambRequest = await api('/disbursements', {
    method: 'POST',
    token: T.ambassador,
    body: { amount: 50, reason: 'tentative ambassadeur' },
  });
  check(
    'L ambassadeur ne peut pas demander de decaissement',
    ambRequest.status === 403,
    `status ${ambRequest.status}`,
  );

  const request = await api('/disbursements', {
    method: 'POST',
    token: T.director,
    body: { amount: 120, reason: 'Frais scolaires du trimestre', childId: newChild.id },
  });
  check('Le chef d orphelinat demande un decaissement', request.status === 201, `status ${request.status}`);
  const disbId = request.data.id;

  const payTooEarly = await api(`/disbursements/${disbId}/pay`, {
    method: 'POST',
    token: T.finance,
    body: {},
  });
  check(
    'Paiement bloque avant confirmation de l ambassadeur',
    payTooEarly.status === 400,
    `status ${payTooEarly.status}`,
  );

  const confirm = await api(`/disbursements/${disbId}/confirm`, { method: 'POST', token: T.ambassador });
  check(
    'L ambassadeur confirme le besoin',
    confirm.data?.status === 'AMBASSADOR_CONFIRMED',
    confirm.data?.status,
  );

  const dirPay = await api(`/disbursements/${disbId}/pay`, { method: 'POST', token: T.director, body: {} });
  check(
    'Le chef d orphelinat ne peut pas se payer lui-meme',
    dirPay.status === 403,
    `status ${dirPay.status}`,
  );

  const pay = await api(`/disbursements/${disbId}/pay`, {
    method: 'POST',
    token: T.finance,
    body: { method: 'M-Pesa', ref: 'MP-TEST-1' },
  });
  check('L Admin Finance decaisse', pay.data?.status === 'AWAITING_RECEIPTS', pay.data?.status);

  const afterPay = await api('/ledger/accounts', { token: T.finance });
  const childAfter = afterPay.data.find((a) => a.childId === newChild.id);
  check(
    'Le solde de l enfant est debite',
    childAfter?.balance === 70,
    `solde ${childAfter?.balance} USD`,
  );

  const tooMuch = await api('/disbursements', {
    method: 'POST',
    token: T.director,
    body: { amount: 5000, reason: 'Montant superieur au solde', childId: newChild.id },
  });
  check('Demande superieure au solde refusee', tooMuch.status === 400, `status ${tooMuch.status}`);

  const receipt = await api(`/disbursements/${disbId}/receipts`, {
    method: 'POST',
    token: T.director,
    body: { name: 'Facture ecole', url: '/uploads/facture.pdf', amount: 120, kind: 'INVOICE' },
  });
  check('Justificatif televerse', receipt.status === 201, `status ${receipt.status}`);
  check('Depense soldee une fois justifiee', receipt.data?.settled === true, `justifie ${receipt.data?.justifiedTotal}`);

  const proofs = await api('/disbursements/proofs', { token: T.donor });
  check(
    'Le bailleur voit la preuve de la depense',
    proofs.data.length > 0 && proofs.data[0].receipts.length > 0,
    proofs.data[0]?.summary,
  );

  const reconcile2 = await api('/ledger/reconcile', { token: T.finance });
  check(
    'Comptes equilibres apres decaissement',
    reconcile2.data.balanced === true,
    `${reconcile2.data.discrepancies.length} ecart(s)`,
  );

  section('Regle de confiance : labellisation');
  const tumaini = (await api('/orphanages', { token: T.admin })).data.find(
    (o) => o.slug === 'centre-tumaini-beni',
  );
  const unlabelled = await api(`/orphanages/${tumaini.id}/verify-account`, {
    method: 'POST',
    token: T.finance,
    body: { verified: true },
  });
  check('Compte de la structure non labellisee verifiable', unlabelled.status === 201 || unlabelled.status === 200);

  section('Projets et circuits');
  const project = await api('/projects', {
    method: 'POST',
    token: T.director,
    body: {
      title: 'Operation chirurgicale urgente',
      description: 'Intervention necessaire pour un enfant de la structure.',
      childId: newChild.id,
      targetAmount: 400,
      currency: 'USD',
      category: 'SANTE',
    },
  });
  check('Projet cree par le chef d orphelinat', project.status === 201, `status ${project.status}`);
  const projId = project.data.id;

  const projSubmit = await api(`/projects/${projId}/submit`, { method: 'POST', token: T.director });
  check('Projet soumis au circuit', projSubmit.data?.project?.status === 'IN_VALIDATION', projSubmit.data?.project?.status);
  check(
    'Montant sous le seuil : une seule etape (ambassadeur)',
    projSubmit.data?.approval?.steps?.length === 1,
    `${projSubmit.data?.approval?.steps?.length} etape(s)`,
  );

  const projApprove = await api(`/approvals/${projSubmit.data.approval.id}/approve`, {
    method: 'POST',
    token: T.ambassador,
    body: { comment: 'Besoin confirme' },
  });
  check('Ambassadeur de l enfant valide le projet', projApprove.data?.status === 'APPROVED', projApprove.data?.status);

  const published = await api(`/projects/${projId}/publish`, { method: 'POST', token: T.ambassador });
  check('Projet publie', published.data?.status === 'PUBLISHED', published.data?.status);

  const bigProject = await api('/projects', {
    method: 'POST',
    token: T.director,
    body: {
      title: 'Renovation du dortoir',
      description: 'Travaux importants sur le batiment principal.',
      targetAmount: 5000,
      currency: 'USD',
      category: 'INFRASTRUCTURE',
    },
  });
  const bigSubmit = await api(`/projects/${bigProject.data.id}/submit`, { method: 'POST', token: T.director });
  check(
    'Montant au-dessus du seuil : validation du chef regional ajoutee',
    bigSubmit.data?.approval?.steps?.length === 2,
    `${bigSubmit.data?.approval?.steps?.length} etapes`,
  );

  section('Contribution a un projet et plafond');
  const contrib = await api('/payments/donations', {
    method: 'POST',
    token: T.donor,
    body: { kind: 'PROJECT_CONTRIBUTION', amount: 400, projectId: projId, provider: 'STRIPE' },
  });
  await api('/payments/webhook', {
    method: 'POST',
    body: { reference: contrib.data.donation.reference, status: 'SUCCESS' },
  });

  const projAfter = await api(`/projects/public/${projId}`);
  check(
    'La jauge de progression est mise a jour',
    projAfter.data.collectedAmount === 380,
    `collecte ${projAfter.data.collectedAmount} / ${projAfter.data.targetAmount}`,
  );

  const refused = await api('/projects', { token: T.donor });
  check('Le bailleur ne voit que les projets publies', Array.isArray(refused.data));

  return { projId };
};

const { api, check, section } = require('./e2e-flows');

module.exports = async function phase3(T, child, newChild, espoir) {
  section('Publications et protection de l enfant');

  const noConsent = await api('/posts', {
    method: 'POST',
    token: T.ambassador,
    body: { type: 'NEWS', content: 'Belle journee', childId: newChild.id, photos: ['/uploads/x.jpg'] },
  });
  check(
    'Publication avec photo bloquee sans consentement',
    noConsent.status === 400,
    JSON.stringify(noConsent.data?.message).slice(0, 70),
  );

  const consent = await api(`/children/${newChild.id}/consent`, {
    method: 'POST',
    token: T.ambassador,
    body: { guardianName: 'Tuteur legal', childSigned: true },
  });
  check('Consentement photo enregistre', consent.status === 201, `status ${consent.status}`);

  const withConsent = await api('/posts', {
    method: 'POST',
    token: T.ambassador,
    body: {
      type: 'NEWS',
      content: 'Il a termine premier de sa classe !',
      childId: newChild.id,
      photos: ['/uploads/x.jpg'],
    },
  });
  check('Publication autorisee apres consentement', withConsent.status === 201, `status ${withConsent.status}`);
  const post = withConsent.data;

  const lastNamePost = await api('/posts', {
    method: 'POST',
    token: T.ambassador,
    body: { type: 'NEWS', content: 'Nouvelle sur Testimoni Kabila cette semaine', childId: newChild.id },
  });
  check(
    'Nom de famille bloque automatiquement',
    lastNamePost.status === 400 &&
      JSON.stringify(lastNamePost.data).includes('LAST_NAME'),
    `status ${lastNamePost.status}`,
  );

  const medicalPost = await api('/posts', {
    method: 'POST',
    token: T.ambassador,
    body: { type: 'NEWS', content: 'Son traitement antiretroviral se passe bien', childId: newChild.id },
  });
  check(
    'Donnees medicales bloquees automatiquement',
    medicalPost.status === 400 && JSON.stringify(medicalPost.data).includes('MEDICAL_DATA'),
    `status ${medicalPost.status}`,
  );

  const addressPost = await api('/posts', {
    method: 'POST',
    token: T.ambassador,
    body: { type: 'NEWS', content: 'Venez le voir avenue Lumumba numero 42', childId: newChild.id },
  });
  check(
    'Adresse exacte bloquee automatiquement',
    addressPost.status === 400 && JSON.stringify(addressPost.data).includes('EXACT_ADDRESS'),
    `status ${addressPost.status}`,
  );

  const dirPost = await api('/posts', {
    method: 'POST',
    token: T.director,
    body: { type: 'NEWS', content: 'Nouvelle concernant un enfant', childId: newChild.id },
  });
  check(
    'Le chef d orphelinat ne publie pas pour un enfant',
    dirPost.status === 403,
    `status ${dirPost.status}`,
  );

  const otherAmbPost = await api('/posts', {
    method: 'POST',
    token: T.ambassador2,
    body: { type: 'NEWS', content: 'Publication non autorisee', childId: newChild.id },
  });
  check(
    'Un ambassadeur ne publie pas pour un enfant qui ne lui est pas assigne',
    otherAmbPost.status === 403,
    `status ${otherAmbPost.status}`,
  );

  section('Interactions du fil');
  const react = await api(`/posts/${post.id}/react`, { method: 'POST', token: T.donor, body: {} });
  check('Reaction ajoutee', react.data?.reacted === true);

  const comment = await api(`/posts/${post.id}/comment`, {
    method: 'POST',
    token: T.donor,
    body: { content: 'Bravo a lui, quelle belle nouvelle !' },
  });
  check('Commentaire publie', comment.status === 201, `status ${comment.status}`);

  const badComment = await api(`/posts/${post.id}/comment`, {
    method: 'POST',
    token: T.donor,
    body: { content: 'Ecrivez-moi a moncontact@example.com' },
  });
  check('Commentaire avec e-mail bloque', badComment.status === 400, `status ${badComment.status}`);

  const sub = await api(`/posts/subscribe/${newChild.id}`, { method: 'POST', token: T.donor });
  check('Abonnement au fil de l enfant', sub.data?.subscribed === true);

  const publicFeed = await api('/posts/feed');
  check('Fil public lisible sans compte', publicFeed.data?.items?.length > 0, `${publicFeed.data?.total} publications`);

  section('Moderation des publications');
  const hidden = await api(`/posts/${post.id}/hide`, {
    method: 'POST',
    token: T.moderator,
    body: { reason: 'Verification en cours' },
  });
  check('Le moderateur masque une publication', hidden.data?.status === 'HIDDEN', hidden.data?.status);

  const ambHide = await api(`/posts/${post.id}/hide`, {
    method: 'POST',
    token: T.ambassador,
    body: { reason: 'tentative' },
  });
  check('Un ambassadeur ne peut pas masquer', ambHide.status === 403, `status ${ambHide.status}`);

  await api(`/posts/${post.id}/restore`, { method: 'POST', token: T.moderator });

  const report = await api('/moderation/reports', {
    method: 'POST',
    token: T.donor,
    body: { targetType: 'POST', targetId: post.id, reason: 'Contenu inapproprie', severity: 'NORMAL' },
  });
  check('Signalement enregistre', report.status === 201, `status ${report.status}`);

  const reports = await api('/moderation/reports', { token: T.moderator });
  check('Le moderateur voit la file des signalements', reports.data.length > 0, `${reports.data.length} signalements`);

  const serious = await api('/moderation/reports', {
    method: 'POST',
    token: T.director,
    body: { targetType: 'USER', targetId: T.donorId ?? post.authorId, reason: 'Suspicion de fraude', severity: 'SERIOUS' },
  });
  check('Signalement grave enregistre', serious.status === 201, `status ${serious.status}`);

  const auditorReports = await api('/moderation/reports', { token: T.auditor });
  check(
    'L Auditeur Ethique recoit les signalements graves',
    auditorReports.data.every((r) => r.severity === 'SERIOUS'),
    `${auditorReports.data.length} signalements graves`,
  );

  return { post };
};

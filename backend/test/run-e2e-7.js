const { api, check, section } = require('./e2e-flows');

module.exports = async function phase7(T) {
  section('Invitations et gestion des comptes');

  const countries = (await api('/geo/countries')).data;
  const cd = countries.find((c) => c.iso2 === 'CD');

  const invite = await api('/auth/invite', {
    method: 'POST',
    token: T.admin,
    body: {
      email: `nouvel.ambassadeur.${Date.now()}@risac.org`,
      firstName: 'Nouveau',
      lastName: 'Ambassadeur',
      role: 'AMBASSADOR',
      countryId: cd.id,
    },
  });
  check('Invitation envoyee avec lien d activation', invite.status === 201 && !!invite.data.activationUrl);
  // Ces vérifications exigent MAIL_ECHO_OTP=true : le code est alors renvoyé au lieu d'être envoyé par e-mail.
  const otp = invite.data.devOtp;
  check('Le code OTP est remis (mode test)', /^\d{6}$/.test(otp ?? ''), 'lancer l API avec MAIL_ECHO_OTP=true');

  const token = invite.data.activationUrl?.split('token=')[1];

  const noOtp = await api('/auth/activate', {
    method: 'POST',
    body: { token, password: 'NouveauMotDePasse1!' },
  });
  check('Activation refusee sans code', noOtp.status === 400, `status ${noOtp.status}`);

  const wrongOtp = await api('/auth/activate', {
    method: 'POST',
    body: { token, otp: otp === '000000' ? '111111' : '000000', password: 'NouveauMotDePasse1!' },
  });
  check('Activation refusee avec un mauvais code', wrongOtp.status === 400, `status ${wrongOtp.status}`);

  const activate = await api('/auth/activate', {
    method: 'POST',
    body: { token, otp, password: 'NouveauMotDePasse1!' },
  });
  check('Compte active avec le lien et le code', activate.status === 201 && !!activate.data.accessToken);

  const reuse = await api('/auth/activate', {
    method: 'POST',
    body: { token, otp, password: 'AutreMotDePasse1!' },
  });
  check('Lien d activation non reutilisable', reuse.status === 400, `status ${reuse.status}`);

  const newUserId = activate.data.user.id;
  const email = activate.data.user.email;

  const blocked = await api(`/users/${newUserId}/status`, {
    method: 'PATCH',
    token: T.admin,
    body: { status: 'BLOCKED', reason: 'Test de blocage' },
  });
  check('Super Admin bloque un compte', blocked.data?.status === 'BLOCKED', blocked.data?.status);

  const blockedLogin = await api('/auth/login', {
    method: 'POST',
    body: { email, password: 'NouveauMotDePasse1!' },
  });
  check('Un compte bloque ne peut plus se connecter', blockedLogin.status === 403, `status ${blockedLogin.status}`);

  const frozen = await api(`/users/${newUserId}/freeze`, {
    method: 'POST',
    token: T.auditor,
    body: { reason: 'Suspicion signalee a la gouvernance' },
  });
  check('L Auditeur Ethique gele un compte', frozen.data?.status === 'FROZEN', frozen.data?.status);

  const ambFreeze = await api(`/users/${newUserId}/freeze`, {
    method: 'POST',
    token: T.ambassador,
    body: { reason: 'tentative' },
  });
  check('Un ambassadeur ne peut pas geler un compte', ambFreeze.status === 403, `status ${ambFreeze.status}`);
};

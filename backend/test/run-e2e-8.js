const { api, check, section } = require('./e2e-flows');

module.exports = async function phase8(T) {
  section('Tableaux de bord par acteur');

  const dashboards = {
    admin: 'SUPER_ADMIN',
    finance: 'ADMIN_FINANCE',
    moderator: 'MODERATOR',
    auditor: 'ETHICS_AUDITOR',
    national: 'NATIONAL_MANAGER',
    regional: 'REGIONAL_MANAGER',
    ambassador: 'AMBASSADOR',
    director: 'ORPHANAGE_DIRECTOR',
    psy: 'ORPHANAGE_STAFF',
    agent: 'FIELD_AGENT',
    donor: 'DONOR',
    partner: 'PARTNER',
  };
  for (const [key, role] of Object.entries(dashboards)) {
    const d = await api('/dashboard', { token: T[key] });
    check(`Tableau de bord ${role}`, d.status === 200 && d.data.role === role, d.data?.role ?? `status ${d.status}`);
  }

  const adminDash = await api('/dashboard', { token: T.admin });
  check(
    'Le tableau de bord Super Admin agrege les chiffres cles',
    adminDash.data.realtime !== undefined && adminDash.data.money !== undefined,
    `${adminDash.data.children?.total} enfants, ${adminDash.data.orphanages?.labelled} labellises`,
  );

  const donorDash = await api('/dashboard', { token: T.donor });
  check(
    'Mon impact affiche les totaux du bailleur',
    donorDash.data.impact?.totalDonatedUsd > 0,
    `${donorDash.data.impact?.totalDonatedUsd} USD`,
  );

  const financeDash = await api('/dashboard', { token: T.finance });
  check(
    'Le tableau de bord Finance expose le rapprochement',
    financeDash.data.reconciliation?.balanced === true,
    `equilibre: ${financeDash.data.reconciliation?.balanced}`,
  );

  section('Journal d audit et parametres');
  const auditLog = await api('/dashboard/audit-log?take=5', { token: T.auditor });
  check('Journal d audit consultable', auditLog.data.total > 0, `${auditLog.data.total} entrees`);

  const auditDenied = await api('/dashboard/audit-log', { token: T.ambassador });
  check('Journal d audit refuse aux autres roles', auditDenied.status === 403, `status ${auditDenied.status}`);

  const settings = await api('/dashboard/settings', { token: T.admin });
  check('Parametres lisibles par le Super Admin', settings.data.platform_fee_percent === 5);

  const updated = await api('/dashboard/settings', {
    method: 'PATCH',
    token: T.admin,
    body: { project_approval_threshold_usd: 2000 },
  });
  check(
    'Seuil de validation modifiable',
    updated.data.project_approval_threshold_usd === 2000,
    `${updated.data.project_approval_threshold_usd}`,
  );
  await api('/dashboard/settings', {
    method: 'PATCH',
    token: T.admin,
    body: { project_approval_threshold_usd: 1000 },
  });

  // Le formulaire de creation de projet est utilise par des roles sans acces aux parametres complets.
  const publicSettings = await api('/dashboard/settings/public', { token: T.director });
  check(
    'Les createurs de projet lisent categories et seuil',
    publicSettings.status === 200 &&
      publicSettings.data.project_categories?.length > 0 &&
      publicSettings.data.project_approval_threshold_usd === 1000,
    `status ${publicSettings.status}`,
  );
  const publicSettingsDonor = await api('/dashboard/settings/public', { token: T.donor });
  check('Parametres publics ouverts a tout compte connecte', publicSettingsDonor.status === 200, `status ${publicSettingsDonor.status}`);
  const fullSettingsDenied = await api('/dashboard/settings', { token: T.director });
  check('Parametres complets toujours reserves au Super Admin', fullSettingsDenied.status === 403, `status ${fullSettingsDenied.status}`);
};

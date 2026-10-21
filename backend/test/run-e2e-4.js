const { api, check, section } = require('./e2e-flows');

module.exports = async function phase4(T, child, newChild, espoir) {
  section('Circuit de l argent : don et affectation');

  const quote = await api('/payments/quote?amount=100&currency=USD');
  check(
    'Les frais sont annonces avant le paiement',
    quote.data.feePercent === 5 && quote.data.feeAmount === 5 && quote.data.netAmount === 95,
    `frais ${quote.data.feeAmount}, net ${quote.data.netAmount}`,
  );

  const eurQuote = await api('/payments/quote?amount=100&currency=EUR');
  check(
    'Conversion multi-devises appliquee',
    eurQuote.data.amountUsd === 108,
    `100 EUR = ${eurQuote.data.amountUsd} USD`,
  );

  const before = await api('/ledger/accounts', { token: T.finance });
  const feesBefore = before.data.find((a) => a.kind === 'FEES')?.balance ?? 0;

  const donation = await api('/payments/donations', {
    method: 'POST',
    token: T.donor,
    body: { kind: 'ONE_OFF', amount: 200, currency: 'USD', childId: newChild.id, provider: 'FLUTTERWAVE' },
  });
  check('Don cree avec page de paiement web', donation.status === 201, `status ${donation.status}`);
  check(
    'URL de paiement web renvoyee (pas d achat integre)',
    typeof donation.data.checkout?.checkoutUrl === 'string' &&
      donation.data.checkout.checkoutUrl.startsWith('http'),
    donation.data.checkout?.checkoutUrl,
  );
  const ref = donation.data.donation.reference;

  const settle = await api('/payments/webhook', {
    method: 'POST',
    body: { reference: ref, status: 'SUCCESS', providerRef: 'FLW-TEST-1' },
  });
  check('Webhook regle le don', settle.data.donation?.status === 'SUCCEEDED', settle.data.donation?.status);

  const replay = await api('/payments/webhook', {
    method: 'POST',
    body: { reference: ref, status: 'SUCCESS', providerRef: 'FLW-TEST-1' },
  });
  check('Rejeu du webhook sans double ecriture', replay.data.alreadySettled === true);

  const accounts = await api('/ledger/accounts', { token: T.finance });
  const childAccount = accounts.data.find((a) => a.childId === newChild.id);
  check(
    'Le solde de l enfant est credite du montant net',
    childAccount?.balance === 190,
    `solde ${childAccount?.balance} USD`,
  );

  const feesAccount = accounts.data.find((a) => a.kind === 'FEES');
  const feesDelta = Number(((feesAccount?.balance ?? 0) - feesBefore).toFixed(2));
  check(
    'Les frais sont isoles sur leur compte',
    feesDelta === 10,
    `+${feesDelta} sur le compte de frais (5 % de 200)`,
  );

  const reconcile = await api('/ledger/reconcile', { token: T.finance });
  check(
    'Le rapprochement des comptes est equilibre',
    reconcile.data.balanced === true,
    `${reconcile.data.accountsChecked} comptes, ${reconcile.data.discrepancies.length} ecart(s)`,
  );

  section('Parrainage recurrent');
  const sponsorship = await api('/payments/sponsorships', {
    method: 'POST',
    token: T.donor,
    body: { childId: newChild.id, monthlyAmount: 50, endRule: 'FIXED_MONTHS', months: 12, provider: 'STRIPE' },
  });
  check('Parrainage mensuel cree', sponsorship.status === 201, `status ${sponsorship.status}`);
  check(
    'Une date de fin est fixee (pas de parrainage perpetuel)',
    !!sponsorship.data.sponsorship?.endDate,
    sponsorship.data.sponsorship?.endDate,
  );
  const spId = sponsorship.data.sponsorship.id;

  const dup = await api('/payments/sponsorships', {
    method: 'POST',
    token: T.donor,
    body: { childId: newChild.id, monthlyAmount: 30 },
  });
  check('Double parrainage du meme bailleur refuse', dup.status === 400, `status ${dup.status}`);

  const paused = await api(`/payments/sponsorships/${spId}/pause`, { method: 'POST', token: T.donor });
  check('Parrainage mis en pause', paused.data?.status === 'PAUSED', paused.data?.status);

  const resumed = await api(`/payments/sponsorships/${spId}/resume`, { method: 'POST', token: T.donor });
  check('Parrainage repris', resumed.data?.status === 'ACTIVE', resumed.data?.status);

  const modified = await api(`/payments/sponsorships/${spId}`, {
    method: 'PATCH',
    token: T.donor,
    body: { monthlyAmount: 75 },
  });
  check('Montant du parrainage modifiable', modified.data?.monthlyAmount === 75, `${modified.data?.monthlyAmount}`);

  const otherDonor = await api(`/payments/sponsorships/${spId}/cancel`, { method: 'POST', token: T.partner });
  check('Un tiers ne peut pas annuler ce parrainage', otherDonor.status === 403, `status ${otherDonor.status}`);

  return { spId };
};

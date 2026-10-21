const { api, check, section } = require('./e2e-flows');

module.exports = async function phase6(T, child, newChild) {
  section('Messagerie et canaux');

  const channels = await api('/channels', { token: T.ambassador });
  check('L ambassadeur voit ses canaux', channels.data.length > 0, `${channels.data.length} canaux`);

  const orphChannel = channels.data.find((c) => c.type === 'AMBASSADOR_ORPHANAGE');
  const msg = await api(`/channels/${orphChannel.id}/messages`, {
    method: 'POST',
    token: T.ambassador,
    body: { content: 'Bonjour, pouvez-vous transmettre le bulletin du trimestre ?' },
  });
  check('Message envoye dans le canal orphelinat', msg.status === 201, `status ${msg.status}`);

  const read = await api(`/channels/${orphChannel.id}/messages`, { token: T.director });
  check('Le chef d orphelinat lit le message', read.data.length > 0, `${read.data.length} messages`);

  const outsider = await api(`/channels/${orphChannel.id}/messages`, { token: T.ambassador2 });
  check('Un non-membre est refuse', outsider.status === 403, `status ${outsider.status}`);

  const general = channels.data.find((c) => c.type === 'GENERAL');
  const writeGeneral = await api(`/channels/${general.id}/messages`, {
    method: 'POST',
    token: T.ambassador,
    body: { content: 'Tentative d ecriture sur le canal general' },
  });
  check(
    'Canal general en lecture seule pour les non-admins',
    writeGeneral.status === 403,
    `status ${writeGeneral.status}`,
  );

  const adminChannels = await api('/channels', { token: T.admin });
  const adminGeneral = adminChannels.data.find((c) => c.type === 'GENERAL');
  const adminWrite = await api(`/channels/${adminGeneral.id}/messages`, {
    method: 'POST',
    token: T.admin,
    body: { content: 'Annonce officielle du reseau RISAC.' },
  });
  check('Un administrateur ecrit sur le canal general', adminWrite.status === 201, `status ${adminWrite.status}`);

  section('Canal bailleur - ambassadeur');
  const donorChannel = await api(`/channels/donor/${newChild.id}`, { method: 'POST', token: T.donor });
  check('Canal ouvert car le bailleur parraine l enfant', donorChannel.status === 201, `status ${donorChannel.status}`);
  const dcId = donorChannel.data.id;

  const donorMsg = await api(`/channels/${dcId}/messages`, {
    method: 'POST',
    token: T.donor,
    body: { content: 'Bonjour, comment se passe la rentree scolaire ?' },
  });
  check('Le bailleur ecrit a l ambassadeur', donorMsg.status === 201, `status ${donorMsg.status}`);

  const leak = await api(`/channels/${dcId}/messages`, {
    method: 'POST',
    token: T.donor,
    body: { content: 'Appelez-moi au +32 475 123 456 pour en parler' },
  });
  check('Coordonnees personnelles bloquees dans le canal modere', leak.status === 400, `status ${leak.status}`);

  const unauthorized = await api(`/channels/donor/${child.id}`, { method: 'POST', token: T.partner });
  check(
    'Canal refuse si le bailleur ne parraine pas l enfant',
    unauthorized.status === 403,
    `status ${unauthorized.status}`,
  );

  const hidden = await api(`/channels/messages/${donorMsg.data.id}/hide`, {
    method: 'POST',
    token: T.moderator,
    body: { reason: 'Verification' },
  });
  check('Le moderateur masque un message', hidden.data?.hidden === true);

  section('Support et tickets');
  const ticket = await api('/moderation/tickets', {
    method: 'POST',
    token: T.director,
    body: { category: 'ACTIVATION', subject: 'Probleme d activation', body: 'Le lien a expire.' },
  });
  check('Ticket ouvert', ticket.status === 201, ticket.data?.reference);

  const respond = await api(`/moderation/tickets/${ticket.data.id}/respond`, {
    method: 'POST',
    token: T.moderator,
    body: { message: 'Un nouveau lien vient de vous etre envoye.' },
  });
  check('Le support repond au ticket', respond.data?.status === 'IN_PROGRESS', respond.data?.status);

  const closed = await api(`/moderation/tickets/${ticket.data.id}/close`, {
    method: 'POST',
    token: T.moderator,
  });
  check('Ticket resolu', closed.data?.status === 'RESOLVED', closed.data?.status);
};

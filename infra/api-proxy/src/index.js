/**
 * Adresse fixe de l'API RISAC : https://risac-api.<compte>.workers.dev
 *
 * L'API tourne derrière un tunnel Cloudflare « rapide » dont l'adresse (xxx.trycloudflare.com) change à chaque
 * redémarrage. L'application mobile et le site appellent ce Worker, qui relaie tout (HTTP, fichiers, WebSocket
 * du temps réel) vers l'adresse du moment, réglée par la variable UPSTREAM. Quand le tunnel change, on met à
 * jour UPSTREAM et on redéploie ce Worker : rien à republier côté application.
 *
 * Le Worker transmet l'adresse IP du client dans X-Risac-Client-Ip (Cloudflare remplace CF-Connecting-IP par
 * celle du Worker sur la requête relayée). L'API ne s'y fie que si la requête vient bien d'un Worker de ce compte
 * (en-tête CF-Worker posé par Cloudflare).
 */

const STRIP = ['x-risac-client-ip', 'x-forwarded-host', 'cf-connecting-ip', 'x-real-ip'];

export default {
  async fetch(request, env) {
    const upstream = (env.UPSTREAM || '').replace(/\/+$/, '');
    const url = new URL(request.url);

    if (url.pathname === '/__proxy/health') {
      return Response.json({ ok: !!upstream, upstream: upstream ? new URL(upstream).host : null });
    }
    if (!upstream) {
      return Response.json({ statusCode: 503, message: 'API indisponible : adresse du serveur non configurée' }, { status: 503 });
    }

    const target = new URL(url.pathname + url.search, upstream);
    const headers = new Headers(request.headers);
    for (const h of STRIP) headers.delete(h);
    const clientIp = request.headers.get('cf-connecting-ip');
    if (clientIp) headers.set('x-risac-client-ip', clientIp);
    headers.set('x-forwarded-host', url.host);

    const init = {
      method: request.method,
      headers,
      redirect: 'manual',
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    };

    try {
      // Une demande de WebSocket (Upgrade) est relayée telle quelle : Cloudflare branche les deux côtés.
      return await fetch(target.toString(), init);
    } catch {
      return Response.json(
        { statusCode: 502, message: 'Le serveur RISAC ne répond pas pour le moment, réessayez dans un instant' },
        { status: 502 },
      );
    }
  },
};

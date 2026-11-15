import { clientIp, describeDevice, deviceLabel, deviceNameFromHeaders } from './device';

describe('deviceNameFromHeaders', () => {
  it("nomme le téléphone de l'application mobile (marque, modèle, Android)", () => {
    expect(
      deviceNameFromHeaders({
        'x-client-app': 'mobile',
        'x-device-brand': 'samsung',
        'x-device-model': 'SM-S911B',
        'x-device-os': 'Android',
        'x-device-os-version': '14',
      }),
    ).toBe('Samsung SM-S911B · Android 14 · Application RISAC');
  });

  it('ne répète pas la marque déjà contenue dans le modèle', () => {
    expect(
      deviceNameFromHeaders({ 'x-client-app': 'mobile', 'x-device-brand': 'google', 'x-device-model': 'Google Pixel 8', 'x-device-os': 'Android', 'x-device-os-version': '15' }),
    ).toBe('Google Pixel 8 · Android 15 · Application RISAC');
  });

  it('nomme le navigateur et le système du site web', () => {
    expect(deviceNameFromHeaders({ 'x-client-app': 'web', 'x-client-browser': 'Edge 131', 'x-device-os': 'Windows', 'x-device-os-version': '11' })).toBe(
      'Edge 131 · Windows 11',
    );
  });

  it('décode les valeurs encodées et retire les caractères dangereux', () => {
    expect(deviceNameFromHeaders({ 'x-client-app': 'mobile', 'x-device-model': encodeURIComponent('Téléphone <b>X</b>'), 'x-device-os': 'Android' })).toBe(
      'Téléphone bX/b · Android · Application RISAC',
    );
  });

  it('borne la longueur de chaque valeur', () => {
    const name = deviceNameFromHeaders({ 'x-client-app': 'web', 'x-client-browser': 'A'.repeat(500) });
    expect(name!.length).toBeLessThanOrEqual(48);
  });

  it('se rabat sur les Client Hints du navigateur', () => {
    expect(
      deviceNameFromHeaders({ 'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"', 'sec-ch-ua-platform': '"Windows"' }),
    ).toBe('Chrome 131 · Windows');
  });

  it("renvoie null quand le client n'envoie rien d'exploitable", () => {
    expect(deviceNameFromHeaders({ 'user-agent': 'okhttp/4.12.0' })).toBeNull();
  });
});

describe('describeDevice (User-Agent seul)', () => {
  it('lit navigateur, version et système', () => {
    expect(
      describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'),
    ).toBe('Edge 131 · Windows 10/11');
  });

  it("garde le modèle Android quand le navigateur l'indique", () => {
    expect(describeDevice('Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36')).toBe(
      'Chrome 120 · SM-A536B · Android 13',
    );
  });

  it("reconnaît l'application mobile", () => {
    expect(describeDevice('okhttp/4.12.0')).toBe('Application RISAC · Téléphone Android');
  });

  it('préfère le nom enregistré à la connexion', () => {
    expect(deviceLabel('Chrome 131 · Windows 11', 'okhttp/4.12.0')).toBe('Chrome 131 · Windows 11');
    expect(deviceLabel(null, null)).toBe('Appareil inconnu');
  });
});

describe('clientIp', () => {
  const privateRelay = (addr: string) => /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(addr);
  const req = (remoteAddress: string, headers: Record<string, string>, ip?: string) => ({
    ip: ip ?? remoteAddress,
    headers,
    socket: { remoteAddress },
    app: { get: (k: string) => (k === 'trust proxy fn' ? privateRelay : undefined) },
  });

  it('lit CF-Connecting-IP derrière le tunnel (pont Docker)', () => {
    expect(clientIp(req('::ffff:172.18.0.1', { 'cf-connecting-ip': '41.243.12.7' }))).toBe('41.243.12.7');
  });

  it('accepte une adresse IPv6 réelle', () => {
    expect(clientIp(req('172.18.0.1', { 'cf-connecting-ip': '2c0f:f5c0:1::7' }))).toBe('2c0f:f5c0:1::7');
  });

  it('ignore CF-Connecting-IP envoyé par un client qui joint l’API en direct', () => {
    expect(clientIp(req('203.0.113.9', { 'cf-connecting-ip': '1.2.3.4' }))).toBe('203.0.113.9');
  });

  it('se rabat sur X-Forwarded-For (req.ip calculé par trust proxy)', () => {
    expect(clientIp(req('172.18.0.1', {}, '41.243.12.7'))).toBe('41.243.12.7');
  });

  it('lit l’IP transmise par le Worker « adresse fixe » du compte', () => {
    expect(
      clientIp(req('172.18.0.1', { 'cf-worker': 'bofigauthier3.workers.dev', 'cf-connecting-ip': '2a06:98c0:3600::103', 'x-risac-client-ip': '41.243.12.7' })),
    ).toBe('41.243.12.7');
  });

  it('ignore X-Risac-Client-Ip venant d’un autre Worker ou d’un client', () => {
    expect(clientIp(req('172.18.0.1', { 'cf-worker': 'autre.workers.dev', 'cf-connecting-ip': '1.1.1.1', 'x-risac-client-ip': '6.6.6.6' }))).toBe('1.1.1.1');
    expect(clientIp(req('172.18.0.1', { 'cf-connecting-ip': '1.1.1.1', 'x-risac-client-ip': '6.6.6.6' }))).toBe('1.1.1.1');
  });

  it('refuse une valeur qui n’est pas une adresse IP', () => {
    expect(clientIp(req('172.18.0.1', { 'cf-connecting-ip': '<script>' }, '172.18.0.1'))).toBe('172.18.0.1');
  });
});

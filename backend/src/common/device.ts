/**
 * Appareils et adresses IP des connexions (page « Sécurité des accès »).
 *
 * L'application mobile et le site envoient, à la connexion, l'appareil réel dans des en-têtes
 * `X-Device-*` / `X-Client-*` (valeurs encodées avec encodeURIComponent). À défaut, on se rabat sur les
 * Client Hints du navigateur (`Sec-CH-UA*`), puis sur le User-Agent.
 */

type Headers = Record<string, string | string[] | undefined>;

const MAX_PART = 48;

function header(headers: Headers, name: string, max = MAX_PART): string | undefined {
  const raw = headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    /* valeur non encodée : on la garde telle quelle */
  }
  // La valeur vient du client : ni caractères de contrôle ni chevrons, et une longueur bornée.
  const clean = decoded
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  return clean || undefined;
}

/** « "Chromium";v="131", "Google Chrome";v="131" » → « Chrome 131 ». */
function browserFromClientHints(secChUa?: string): string | undefined {
  if (!secChUa) return undefined;
  const brands = [...secChUa.matchAll(/"([^"]+)";v="(\d+)/g)].map((m) => ({ name: m[1], version: m[2] }));
  const real = brands.find((b) => !/Not.?A.?Brand|Chromium/i.test(b.name)) ?? brands.find((b) => /Chromium/i.test(b.name));
  if (!real) return undefined;
  return `${real.name.replace(/^(Google|Microsoft) /, '')} ${real.version}`;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const BROWSERS: [RegExp, string][] = [
  [/Edg(?:A|iOS)?\/(\d+)/, 'Edge'],
  [/OPR\/(\d+)/, 'Opera'],
  [/SamsungBrowser\/(\d+)/, 'Samsung Internet'],
  [/(?:Firefox|FxiOS)\/(\d+)/, 'Firefox'],
  [/(?:Chrome|CriOS)\/(\d+)/, 'Chrome'],
  [/Version\/(\d+)[^ ]* (?:Mobile\/\S+ )?Safari\//, 'Safari'],
];

/** Description lisible à partir du seul User-Agent (anciennes connexions, clients qui n'envoient pas d'en-têtes). */
export function describeDevice(ua?: string | null): string {
  if (!ua) return 'Appareil inconnu';
  const mobileApp = /okhttp|Dalvik|Expo|CFNetwork|ReactNative/i.test(ua);
  const android = ua.match(/Android (\d+(?:\.\d+)?)(?:; ([^;)]+))?/i);
  const ios = ua.match(/(?:iPhone|CPU) OS (\d+)[_.](\d+)/i);
  let os = 'Appareil inconnu';
  if (/iPhone|iPad|iPod/i.test(ua)) os = `${/iPad/i.test(ua) ? 'iPad' : 'iPhone'}${ios ? ` · iOS ${ios[1]}.${ios[2]}` : ''}`;
  else if (android) {
    const model = android[2]?.trim();
    // Les navigateurs récents masquent le modèle (« K ») : on ne l'affiche que s'il dit quelque chose.
    const showModel = !!model && model.length > 2 && !/^(Linux|wv)$/i.test(model) && !/Build\//.test(model);
    os = `${showModel ? `${model} · ` : 'Téléphone '}Android ${android[1]}`;
  } else if (/Android/i.test(ua)) os = 'Téléphone Android';
  else if (/Windows NT 10/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows/i.test(ua)) os = 'Ordinateur Windows';
  else if (/Macintosh|Mac OS/i.test(ua)) os = 'Mac';
  else if (/CrOS/i.test(ua)) os = 'Chromebook';
  else if (/Linux/i.test(ua)) os = 'Ordinateur Linux';
  else if (/okhttp|Dalvik/i.test(ua)) os = 'Téléphone Android';
  else if (/CFNetwork/i.test(ua)) os = 'iPhone';
  if (mobileApp && !/Mozilla/i.test(ua)) return `Application RISAC · ${os}`;
  for (const [re, name] of BROWSERS) {
    const m = ua.match(re);
    if (m) return `${name} ${m[1]} · ${os}`;
  }
  return os;
}

/**
 * Nom de l'appareil d'une requête de connexion, par exemple « Samsung SM-S911B · Android 14 · Application RISAC »
 * ou « Chrome 131 · Windows 11 ». `null` si le client n'a rien envoyé d'exploitable : l'affichage décrit alors
 * le User-Agent enregistré.
 */
export function deviceNameFromHeaders(headers: Headers): string | null {
  const app = header(headers, 'x-client-app');
  const brand = header(headers, 'x-device-brand');
  const model = header(headers, 'x-device-model');
  const os = header(headers, 'x-device-os');
  const osVersion = header(headers, 'x-device-os-version');
  const browser = header(headers, 'x-client-browser');

  const osLabel = os ? `${os}${osVersion && !os.includes(osVersion) ? ` ${osVersion}` : ''}` : undefined;
  let device: string | undefined;
  if (model) {
    const b = brand ? capitalize(brand) : '';
    device = b && !model.toLowerCase().startsWith(b.toLowerCase()) ? `${b} ${model}` : model;
  } else if (brand) device = capitalize(brand);

  if (app === 'mobile' && (device || osLabel)) return [device, osLabel, 'Application RISAC'].filter(Boolean).join(' · ');
  if (browser || device || osLabel) return [browser, device, osLabel].filter(Boolean).join(' · ');

  // Client Hints basse entropie, envoyés d'office par Chrome et Edge.
  const hintBrowser = browserFromClientHints(header(headers, 'sec-ch-ua', 300))?.slice(0, MAX_PART);
  const hintPlatform = header(headers, 'sec-ch-ua-platform')?.replace(/"/g, '');
  if (hintBrowser && hintPlatform) return `${hintBrowser} · ${hintPlatform}`;
  return null;
}

/** Libellé affiché : le nom enregistré à la connexion, sinon une description tirée du User-Agent. */
export function deviceLabel(deviceName: string | null | undefined, userAgent: string | null | undefined): string {
  return deviceName || describeDevice(userAgent);
}

type IpRequest = {
  ip?: string;
  headers: Headers;
  socket?: { remoteAddress?: string };
  app?: { get?: (key: string) => unknown };
};

function isIp(v: string): boolean {
  const m = v.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) return m.slice(1).every((p) => Number(p) <= 255);
  return v.includes(':') && v.length <= 45 && /^[0-9a-f:.]+$/i.test(v);
}

function normalizeIp(v?: string | null): string | undefined {
  if (!v) return undefined;
  const ip = v.trim().replace(/^::ffff:(?=\d+\.)/i, '');
  return ip && isIp(ip) ? ip : undefined;
}

/**
 * Adresse IP réelle du client.
 *
 * En production l'API est derrière Cloudflare (tunnel cloudflared sur l'hôte → conteneur) : la connexion TCP
 * arrive du pont Docker (172.18.0.1). On lit `CF-Connecting-IP`, sinon `X-Forwarded-For` (par req.ip, grâce
 * à `trust proxy`), et seulement quand la requête arrive d'un relais de confiance (adresse locale ou privée) :
 * un client qui joindrait l'API en direct ne peut pas se faire passer pour une autre adresse.
 */
export function clientIp(req: IpRequest): string | null {
  const peer = normalizeIp(req.socket?.remoteAddress);
  const trusted = req.app?.get?.('trust proxy fn') as ((addr: string, i: number) => boolean) | undefined;
  if (peer && trusted?.(peer, 0)) {
    // Requête relayée par notre Worker « adresse fixe » (infra/api-proxy) : Cloudflare y met l'IP du Worker dans
    // CF-Connecting-IP et l'en-tête CF-Worker (nom du compte) ; l'IP du client est dans X-Risac-Client-Ip.
    const worker = header(req.headers, 'cf-worker', 120)?.toLowerCase();
    if (worker && proxyWorkerZones().includes(worker)) {
      const relayed = normalizeIp(header(req.headers, 'x-risac-client-ip'));
      if (relayed) return relayed;
    }
    const cf = normalizeIp(header(req.headers, 'cf-connecting-ip'));
    if (cf) return cf;
  }
  return normalizeIp(req.ip) ?? peer ?? null;
}

/** Comptes Cloudflare dont les Workers relaient l'API (PROXY_WORKER_ZONES, séparés par des virgules). */
function proxyWorkerZones(): string[] {
  return (process.env.PROXY_WORKER_ZONES || 'bofigauthier3.workers.dev')
    .split(',')
    .map((z) => z.trim().toLowerCase())
    .filter(Boolean);
}

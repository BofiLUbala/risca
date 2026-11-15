'use client';

/**
 * Navigateur et système réels, envoyés à la connexion pour la page « Sécurité des accès »
 * (par exemple « Edge 131 · Windows 11 » ou « Chrome 131 · SM-S911B · Android 14 »).
 *
 * Les Client Hints (navigator.userAgentData) distinguent Windows 11 de Windows 10 et donnent le modèle
 * des téléphones Android ; Firefox et Safari ne les ont pas : on lit alors le User-Agent.
 */

type Brand = { brand: string; version: string };
type UAData = {
  brands?: Brand[];
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<{ platformVersion?: string; model?: string; fullVersionList?: Brand[] }>;
};

const BROWSERS: [RegExp, string][] = [
  [/Edg(?:A|iOS)?\/(\d+)/, 'Edge'],
  [/OPR\/(\d+)/, 'Opera'],
  [/SamsungBrowser\/(\d+)/, 'Samsung Internet'],
  [/(?:Firefox|FxiOS)\/(\d+)/, 'Firefox'],
  [/(?:Chrome|CriOS)\/(\d+)/, 'Chrome'],
  [/Version\/(\d+).*Safari\//, 'Safari'],
];

function fromUserAgent(ua: string) {
  let browser: string | undefined;
  for (const [re, name] of BROWSERS) {
    const m = ua.match(re);
    if (m) {
      browser = `${name} ${m[1]}`;
      break;
    }
  }
  let os: string | undefined;
  let osVersion: string | undefined;
  if (/iPhone|iPad|iPod/.test(ua)) {
    os = /iPad/.test(ua) ? 'iPadOS' : 'iOS';
    osVersion = ua.match(/OS (\d+)[_.](\d+)/)?.slice(1, 3).join('.');
  } else if (/Android/.test(ua)) {
    os = 'Android';
    osVersion = ua.match(/Android (\d+(?:\.\d+)?)/)?.[1];
  } else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return { browser, os, osVersion };
}

export async function deviceHeaders(): Promise<Record<string, string>> {
  if (typeof navigator === 'undefined') return {};
  let { browser, os, osVersion } = fromUserAgent(navigator.userAgent);
  let model: string | undefined;

  const uaData = (navigator as Navigator & { userAgentData?: UAData }).userAgentData;
  if (uaData?.getHighEntropyValues) {
    try {
      const hi = await Promise.race([
        uaData.getHighEntropyValues(['platformVersion', 'model', 'fullVersionList']),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 500)),
      ]);
      const list = hi.fullVersionList ?? uaData.brands ?? [];
      const real = list.find((b) => !/Not.?A.?Brand|Chromium/i.test(b.brand)) ?? list.find((b) => /Chromium/i.test(b.brand));
      if (real) browser = `${real.brand.replace(/^(Google|Microsoft) /, '')} ${real.version.split('.')[0]}`;
      if (uaData.platform) os = uaData.platform;
      if (hi.platformVersion) {
        const major = parseInt(hi.platformVersion, 10);
        // Sur Windows, platformVersion ≥ 13 correspond à Windows 11.
        if (os === 'Windows') osVersion = major >= 13 ? '11' : major > 0 ? '10' : undefined;
        else if (os === 'Android') osVersion = String(major);
        else if (os === 'macOS') osVersion = hi.platformVersion.split('.').slice(0, 2).join('.');
      }
      if (hi.model) model = hi.model;
    } catch {
      /* Client Hints indisponibles : on garde la lecture du User-Agent */
    }
  }

  const values: Record<string, string | undefined> = {
    'X-Client-App': 'web',
    'X-Client-Browser': browser,
    'X-Device-Model': model,
    'X-Device-Os': os,
    'X-Device-Os-Version': osVersion,
  };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) if (v) out[k] = encodeURIComponent(v.slice(0, 48));
  return out;
}

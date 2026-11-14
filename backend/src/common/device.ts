/** Description lisible de l'appareil à partir de l'en-tête User-Agent (téléphone, ordinateur, navigateur). */
export function describeDevice(ua?: string | null): string {
  if (!ua) return 'Appareil inconnu';
  const mobileApp = /okhttp|Dalvik|Expo|CFNetwork|ReactNative/i.test(ua);
  let os = 'Appareil inconnu';
  if (/iPhone|iPad|iPod/i.test(ua)) os = /iPad/i.test(ua) ? 'iPad' : 'iPhone';
  else if (/Android/i.test(ua)) os = 'Téléphone Android';
  else if (/Windows/i.test(ua)) os = 'Ordinateur Windows';
  else if (/Macintosh|Mac OS/i.test(ua)) os = 'Mac';
  else if (/Linux/i.test(ua)) os = 'Ordinateur Linux';
  else if (/okhttp|Dalvik/i.test(ua)) os = 'Téléphone Android';
  else if (/CFNetwork/i.test(ua)) os = 'iPhone';
  if (mobileApp && !/Mozilla/i.test(ua)) return `Application RISAC · ${os}`;
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return browser ? `${os} · ${browser}` : os;
}

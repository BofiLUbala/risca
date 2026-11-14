// Transforme results/results.json (+ results/expo.json) en tableaux markdown par rôle.
// Usage : node build-report.mjs > results/tables.md
import fs from 'fs';

// Ordre = priorité croissante : une relance (results.json) remplace la passe 1 pour le même test.
const files = ['results/results-pass1.json', 'results/results.json', 'results/expo.json'].filter((f) => fs.existsSync(f));
const byKey = new Map();
const rows = {
  push: (x) => byKey.set(`${x.project}|${x.title}`, x),
};
for (const f of files) {
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  const walk = (s) => {
    for (const x of s.suites ?? []) walk(x);
    for (const sp of s.specs ?? []) {
      for (const t of sp.tests) {
        const res = t.results.at(-1) ?? {};
        const ann = [...(t.annotations ?? []), ...(res.annotations ?? [])];
        const get = (type) => ann.filter((a) => a.type === type).map((a) => a.description);
        rows.push({
          project: t.projectName,
          title: sp.title,
          status: res.status ?? t.status,
          skip: get('skip')[0],
          shot: get('screenshot')[0],
          console: [...new Set(get('consoleErrors'))],
          api4xx: [...new Set(get('apiClientErrors'))],
          s5xx: [...new Set(get('serverErrors'))],
          pageErr: [...new Set(get('pageErrors'))],
          ext: [...new Set(get('externalFailures'))],
          guard: get('guard')[0],
          error: (res.errors ?? []).map((e) => (e.message ?? '').replace(/\u001b\[[0-9;]*m/g, '').split('\n')[0]).join(' | '),
        });
      }
    }
  };
  r.suites.forEach(walk);
}
const all = [...byKey.values()].filter((x) => x.project !== 'setup' || true);

const icon = { passed: '✅', failed: '❌', skipped: '⏭️', timedOut: '⏱️', interrupted: '⛔' };
const roleOf = (t) => {
  const w = t.split(' ');
  if (w[0] === 'connexion') return w[1];
  if (w[0] === 'EXPO') return w[1];
  return w[0];
};
const byRole = {};
for (const x of all) (byRole[roleOf(x.title)] ??= []).push(x);

const out = [];
const total = all.reduce((a, x) => ((a[x.status] = (a[x.status] ?? 0) + 1), a), {});
out.push(`Total : ${all.length} tests — ${Object.entries(total).map(([k, v]) => `${icon[k] ?? k} ${v} ${k}`).join(', ')}\n`);
for (const [role, list] of Object.entries(byRole)) {
  out.push(`\n#### ${role}\n`);
  out.push('| Projet | Page / écran | Résultat | Capture | Remarques |');
  out.push('|---|---|---|---|---|');
  for (const x of list) {
    const notes = [
      x.skip && `ignoré : ${x.skip}`,
      x.guard && x.guard,
      x.ext?.length && `ressource externe indisponible : ${x.ext.join(' ; ')}`,
      x.s5xx.length && `5xx : ${x.s5xx.join(' ; ')}`,
      x.pageErr.length && `exception : ${x.pageErr.join(' ; ')}`,
      x.api4xx.length && `API 4xx : ${x.api4xx.join(' ; ')}`,
      x.console.length && `console : ${x.console.length} erreur(s)`,
      x.status !== 'passed' && x.status !== 'skipped' && x.error,
    ]
      .filter(Boolean)
      .join('<br>')
      .replace(/\|/g, '/');
    const shot = x.shot ? `[png](${x.shot})` : '';
    out.push(`| ${x.project} | ${x.title.replace(role, '').trim() || x.title} | ${icon[x.status] ?? x.status} | ${shot} | ${notes} |`);
  }
}
console.log(out.join('\n'));

/**
 * Test fonctionnel de bout en bout du backend RISAC.
 * Parcourt les circuits reels : dossier enfant, projet, publication,
 * paiement, decaissement, messagerie, moderation, tableaux de bord.
 */
const BASE = process.env.API || 'http://localhost:4000/api';
const PWD = 'Risac2026!';

const results = [];
let currentSection = '';

function section(name) {
  currentSection = name;
  console.log(`\n=== ${name} ===`);
}

function check(name, ok, detail) {
  results.push({ section: currentSection, name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function login(email) {
  const r = await api('/auth/login', { method: 'POST', body: { email, password: PWD } });
  if (!r.data?.accessToken) throw new Error(`login failed for ${email}: ${JSON.stringify(r.data)}`);
  return r.data.accessToken;
}

module.exports = { api, login, check, section, results, BASE, PWD };

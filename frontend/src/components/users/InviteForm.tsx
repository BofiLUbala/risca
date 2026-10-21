'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { ROLE_LABEL } from '@/lib/roles';

/** Invitation : role, pays et province choisis dans des listes liees (section 3). */
export function InviteForm({ onInvited }: { onInvited: () => void }) {
  const { data: countries } = useSWR<any[]>('/geo/countries', fetcher);
  const { data: orphanages } = useSWR<any[]>('/orphanages', fetcher);

  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'AMBASSADOR',
    countryId: '',
    provinceId: '',
    orphanageId: '',
    staffFunction: '',
  });
  const [link, setLink] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<boolean>(true);
  const [invitedEmail, setInvitedEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: provinces } = useSWR<any[]>(
    form.countryId ? `/geo/countries/${form.countryId}/provinces` : null,
    fetcher,
  );

  const needsOrphanage = form.role === 'ORPHANAGE_DIRECTOR' || form.role === 'ORPHANAGE_STAFF';
  const needsFunction = form.role === 'ORPHANAGE_STAFF';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLink(null);
    try {
      const r = await api.post<any>('/auth/invite', {
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        role: form.role,
        countryId: form.countryId || undefined,
        provinceId: form.provinceId || undefined,
        orphanageId: form.orphanageId || undefined,
        staffFunction: form.staffFunction || undefined,
      });
      setLink(r.activationUrl);
      setEmailSent(r.emailSent !== false);
      setInvitedEmail(form.email);
      onInvited();
    } catch (err: any) {
      setError(err?.message ?? 'Invitation impossible');
    }
  }

  return (
    <form onSubmit={submit} className="card card-pad space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="iemail" className="label">
            E-mail
          </label>
          <input
            id="iemail"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="ifn" className="label">
            Prénom
          </label>
          <input
            id="ifn"
            required
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="iln" className="label">
            Nom
          </label>
          <input
            id="iln"
            required
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="irole" className="label">
            Rôle
          </label>
          <select
            id="irole"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="input"
          >
            {Object.entries(ROLE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ictry" className="label">
            Pays
          </label>
          <select
            id="ictry"
            value={form.countryId}
            onChange={(e) => setForm({ ...form, countryId: e.target.value, provinceId: '' })}
            className="input"
          >
            <option value="">Choisir</option>
            {countries?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameFr}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="iprov" className="label">
            Province
          </label>
          <select
            id="iprov"
            value={form.provinceId}
            onChange={(e) => setForm({ ...form, provinceId: e.target.value })}
            className="input"
            disabled={!form.countryId}
          >
            <option value="">Choisir</option>
            {provinces?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameFr}
              </option>
            ))}
          </select>
        </div>

        {needsOrphanage && (
          <div>
            <label htmlFor="iorph" className="label">
              Orphelinat
            </label>
            <select
              id="iorph"
              value={form.orphanageId}
              onChange={(e) => setForm({ ...form, orphanageId: e.target.value })}
              className="input"
              required
            >
              <option value="">Choisir</option>
              {orphanages?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {needsFunction && (
          <div>
            <label htmlFor="ifunc" className="label">
              Fonction
            </label>
            <select
              id="ifunc"
              value={form.staffFunction}
              onChange={(e) => setForm({ ...form, staffFunction: e.target.value })}
              className="input"
              required
            >
              <option value="">Choisir</option>
              <option value="PSYCHOLOGIST">Psychologue</option>
              <option value="EDUCATOR">Educateur</option>
              <option value="NURSE">Infirmier</option>
              <option value="SOCIAL_WORKER">Assistant social</option>
            </select>
          </div>
        )}
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</p>}
      {link && emailSent && (
        <div role="status" className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
          <p className="font-medium">Invitation envoyée à {invitedEmail}.</p>
          <p className="mt-1 text-xs">
            Elle reçoit un code à 6 chiffres (valable 15 minutes) et un lien d’activation (valable 72 h). Pour
            activer son compte, elle doit saisir le code sur la page d’activation.
          </p>
        </div>
      )}
      {link && !emailSent && (
        <div role="alert" className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          <p className="font-medium">Le compte est créé, mais l’e-mail n’a pas pu être envoyé à {invitedEmail}.</p>
          <p className="mt-1 text-xs">
            Vérifiez l’adresse puis utilisez « Renvoyer le code » dans la liste des utilisateurs.
          </p>
        </div>
      )}

      <button type="submit" className="btn-primary">
        Envoyer l’invitation
      </button>
    </form>
  );
}

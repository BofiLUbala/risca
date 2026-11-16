'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { INVITABLE, ROLE_LABEL, type Role } from '@/lib/roles';
import { CountrySelect, ProvinceSelect } from '@/components/geo/GeoSelects';
import { t } from '@/lib/i18n';

/** Valeur spéciale de la liste des orphelinats : « créer un nouvel orphelinat ». */
const NEW_ORPHANAGE = '__new__';
/** Rôles autorisés à créer un orphelinat (POST /orphanages côté API). */
const ORPHANAGE_CREATORS: Role[] = ['SUPER_ADMIN', 'NATIONAL_MANAGER', 'REGIONAL_MANAGER', 'FIELD_AGENT'];

/** Invitation : role, pays et province choisis dans des listes liees (section 3). */
export function InviteForm({ onInvited }: { onInvited: () => void }) {
  const { user } = useAuth();
  // Seul le Super Admin n°1 peut inviter un autre Super Admin (il y en a trois au plus).
  const canInviteAdmin = user?.role === 'SUPER_ADMIN' && user?.adminRank === 1;
  const { data: countries } = useSWR<any[]>('/geo/countries', fetcher);
  const { data: orphanages, mutate: mutateOrphanages } = useSWR<any[]>('/orphanages', fetcher);

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
  // Le rôle proposé par défaut doit être invitable ; un responsable territorial reste dans son périmètre.
  useEffect(() => {
    if (!user) return;
    const allowed = (INVITABLE[user.role as Role] ?? []).filter((r) => r !== 'SUPER_ADMIN' || canInviteAdmin);
    setForm((f) => ({
      ...f,
      role: allowed.includes(f.role as Role) ? f.role : (allowed[0] ?? f.role),
      ...(user.role !== 'SUPER_ADMIN'
        ? {
            countryId: (user as any).country?.id ?? f.countryId,
            provinceId: (user as any).province?.id ?? f.provinceId,
            orphanageId: (user as any).orphanage?.id ?? f.orphanageId,
          }
        : {}),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
  // Un orphelinat qui n'existe pas encore peut être créé ici, par les rôles que
  // l'API autorise à le faire (mêmes rôles que POST /orphanages).
  const canCreateOrphanage = !!user && ORPHANAGE_CREATORS.includes(user.role as Role);
  const creatingOrphanage = needsOrphanage && form.orphanageId === NEW_ORPHANAGE;
  const [newOrphanage, setNewOrphanage] = useState({ name: '', city: '' });
  const [orphanageNote, setOrphanageNote] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLink(null);
    setOrphanageNote(null);
    let orphanageId = form.orphanageId;
    if (creatingOrphanage) {
      if (!form.countryId || !form.provinceId) {
        setError(t("Choisissez le pays et la province : le nouvel orphelinat y sera créé."));
        return;
      }
      try {
        const created = await api.post<any>('/orphanages', {
          name: newOrphanage.name.trim(),
          countryId: form.countryId,
          provinceId: form.provinceId,
          city: newOrphanage.city.trim() || undefined,
        });
        orphanageId = created.id;
        // L'orphelinat existe désormais : on le sélectionne, pour ne pas le recréer
        // si l'invitation échoue et que l'on renvoie le formulaire.
        setForm((f) => ({ ...f, orphanageId: created.id }));
        await mutateOrphanages();
        setOrphanageNote(
          user?.role === 'SUPER_ADMIN'
            ? t("Orphelinat « {name} » créé.", { name: created.name })
            : t("Orphelinat « {name} » créé. Il doit encore être validé par un chef régional ou le Super Admin.", { name: created.name }),
        );
      } catch (err: any) {
        setError(err?.message ?? t("Création de l’orphelinat impossible"));
        return;
      }
    }
    try {
      const r = await api.post<any>('/auth/invite', {
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        role: form.role,
        countryId: form.countryId || undefined,
        provinceId: form.provinceId || undefined,
        orphanageId: (needsOrphanage && orphanageId) || undefined,
        staffFunction: form.staffFunction || undefined,
      });
      setLink(r.activationUrl);
      setEmailSent(r.emailSent !== false);
      setInvitedEmail(form.email);
      onInvited();
    } catch (err: any) {
      setError(err?.message ?? t("Invitation impossible"));
    }
  }

  return (
    <form onSubmit={submit} className="card card-pad space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="iemail" className="label">
            {t("E-mail")}
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
            {t("Prénom")}
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
            {t("Nom")}
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
            {t("Rôle")}
          </label>
          <select
            id="irole"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="input"
          >
            {Object.entries(ROLE_LABEL)
              .filter(([k]) => (INVITABLE[user?.role as Role] ?? []).includes(k as Role))
              .filter(([k]) => k !== 'SUPER_ADMIN' || canInviteAdmin)
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label htmlFor="ictry" className="label">
            {t("Pays")}
          </label>
          <CountrySelect
            id="ictry"
            value={form.countryId}
            onChange={(id) => setForm({ ...form, countryId: id, provinceId: '' })}
          />
        </div>
        <div>
          <label htmlFor="iprov" className="label">
            {t("Province")}
          </label>
          <ProvinceSelect
            id="iprov"
            countryId={form.countryId}
            value={form.provinceId}
            onChange={(id) => setForm({ ...form, provinceId: id })}
          />
        </div>

        {needsOrphanage && (
          <div>
            <label htmlFor="iorph" className="label">
              {t("Orphelinat")}
            </label>
            <select
              id="iorph"
              value={form.orphanageId}
              onChange={(e) => setForm({ ...form, orphanageId: e.target.value })}
              className="input"
              required
            >
              <option value="">{t("Choisir")}</option>
              {orphanages?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
              {canCreateOrphanage && <option value={NEW_ORPHANAGE}>{t("+ Nouvel orphelinat (pas encore dans la liste)")}</option>}
            </select>
          </div>
        )}

        {creatingOrphanage && (
          <>
            <div>
              <label htmlFor="iorphname" className="label">
                {t("Nom du nouvel orphelinat")}
              </label>
              <input
                id="iorphname"
                value={newOrphanage.name}
                onChange={(e) => setNewOrphanage({ ...newOrphanage, name: e.target.value })}
                className="input"
                required
                minLength={3}
                placeholder={t("Ex. Orphelinat Espoir")}
                aria-describedby="iorphname-aide"
              />
              <p id="iorphname-aide" className="meta mt-1.5">
                {t("Il sera créé dans le pays et la province choisis ci-dessus.")}
              </p>
            </div>
            <div>
              <label htmlFor="iorphcity" className="label">
                {t("Ville")}{' '}<span className="font-normal text-ink-500">{t("(facultatif)")}</span>
              </label>
              <input
                id="iorphcity"
                value={newOrphanage.city}
                onChange={(e) => setNewOrphanage({ ...newOrphanage, city: e.target.value })}
                className="input"
              />
            </div>
          </>
        )}

        {needsFunction && (
          <div>
            <label htmlFor="ifunc" className="label">
              {t("Fonction")}
            </label>
            <select
              id="ifunc"
              value={form.staffFunction}
              onChange={(e) => setForm({ ...form, staffFunction: e.target.value })}
              className="input"
              required
            >
              <option value="">{t("Choisir")}</option>
              <option value="PSYCHOLOGIST">{t("Psychologue")}</option>
              <option value="EDUCATOR">{t("Educateur")}</option>
              <option value="NURSE">{t("Infirmier")}</option>
              <option value="SOCIAL_WORKER">{t("Assistant social")}</option>
            </select>
          </div>
        )}
      </div>

      {orphanageNote && (
        <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
          {orphanageNote}
        </p>
      )}
      {error && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</p>}
      {link && emailSent && (
        <div role="status" className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
          <p className="font-medium">{t("Invitation envoyée à")}{' '}{invitedEmail}.</p>
          <p className="mt-1 text-xs">
            {t("Elle reçoit un code à 6 chiffres (valable 15 minutes) et un lien d’activation (valable 72 h). Pour activer son compte, elle doit saisir le code sur la page d’activation.")}
          </p>
        </div>
      )}
      {link && !emailSent && (
        <div role="alert" className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          <p className="font-medium">{t("Le compte est créé, mais l’e-mail n’a pas pu être envoyé à")}{' '}{invitedEmail}.</p>
          <p className="mt-1 text-xs">
            {t("Vérifiez l’adresse puis utilisez « Renvoyer le code » dans la liste des utilisateurs.")}
          </p>
        </div>
      )}

      <button type="submit" className="btn-primary">
        {t("Envoyer l’invitation")}
      </button>
    </form>
  );
}

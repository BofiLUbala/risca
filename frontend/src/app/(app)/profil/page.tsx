'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from '@/components/ui/Avatar';
import { PageLoading, Spinner } from '@/components/ui/Loading';
import { ROLE_LABEL } from '@/lib/roles';
import { SecuritySection } from '@/components/users/SecuritySection';
import { PushSection } from '@/components/users/PushSection';

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', locale: 'fr' });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: (user as any).phone ?? '',
        locale: user.locale ?? 'fr',
      });
    }
  }, [user]);

  if (!user) return <PageLoading />;

  async function save() {
    setBusy(true);
    setSaved(false);
    await api.patch('/users/profile', form);
    await refresh();
    setBusy(false);
    setSaved(true);
  }

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="page-title">Mon profil</h1>

      <section className="card card-pad">
        <div className="flex items-center gap-4">
          <Avatar src={user.avatarUrl} firstName={user.firstName} lastName={user.lastName} size="lg" />
          <div>
            <p className="text-base font-semibold text-ink-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-sm text-ink-500">
              {user.email} &middot; {ROLE_LABEL[user.role]}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="fn" className="label">
              Prénom
            </label>
            <input
              id="fn"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="ln" className="label">
              Nom
            </label>
            <input
              id="ln"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="ph" className="label">
              Téléphone
            </label>
            <input
              id="ph"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="loc" className="label">
              Langue
            </label>
            <select
              id="loc"
              value={form.locale}
              onChange={(e) => setForm({ ...form, locale: e.target.value })}
              className="input"
              aria-describedby="loc-aide"
            >
              <option value="fr">Français</option>
              {/* Les trois autres langues du plan restent annoncées, mais désactivées
                  tant que leurs traductions n'existent pas : un choix qui ne change
                  rien à l'écran tromperait la personne. */}
              <option value="en" disabled>
                Anglais — bientôt disponible
              </option>
              <option value="sw" disabled>
                Swahili — bientôt disponible
              </option>
              <option value="ln" disabled>
                Lingala — bientôt disponible
              </option>
            </select>
            <p id="loc-aide" className="meta mt-1.5">
              L&apos;interface est disponible en français. Les autres langues prévues au plan
              arrivent dans une prochaine version.
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button onClick={save} disabled={busy} className="btn-primary">
            {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
          {saved && <span className="text-sm text-emerald-600">Profil enregistré.</span>}
        </div>
      </section>

      <PushSection />

      <SecuritySection twoFactorEnabled={user.twoFactorEnabled} role={user.role} onChanged={refresh} />
    </div>
  );
}

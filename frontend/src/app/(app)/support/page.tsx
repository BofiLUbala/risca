'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { LifeBuoy, Plus, Send } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Badge } from '@/components/ui/Badge';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList } from '@/components/ui/Loading';
import { dateTime } from '@/lib/format';

const CATEGORIES = [
  { value: 'ACTIVATION', label: 'Activation du compte' },
  { value: 'PASSWORD', label: 'Mot de passe' },
  { value: 'PAYMENT', label: 'Paiement' },
  { value: 'BUG', label: 'Problème technique' },
  { value: 'OTHER', label: 'Autre' },
];

export default function SupportPage() {
  const { user } = useAuth();
  const { data, isLoading, mutate } = useSWR<any[]>('/moderation/tickets', fetcher);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: 'OTHER', subject: '', body: '' });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reply, setReply] = useState('');

  const isSupport = user?.role === 'MODERATOR' || user?.role === 'SUPER_ADMIN';
  const active = data?.find((t) => t.id === activeId);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api.post('/moderation/tickets', form);
    setForm({ category: 'OTHER', subject: '', body: '' });
    setOpen(false);
    mutate();
  }

  async function respond(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId || !reply.trim()) return;
    await api.post(`/moderation/tickets/${activeId}/respond`, { message: reply });
    setReply('');
    mutate();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Support</h1>
          <p className="mt-1 text-sm text-ink-500">
            {isSupport ? 'File des tickets du réseau' : 'Vos demandes d’assistance'}
          </p>
        </div>
        <button onClick={() => setOpen((s) => !s)} className="btn-primary">
          <Plus className="h-4 w-4" />
          Nouveau ticket
        </button>
      </div>

      {open && (
        <form onSubmit={create} className="card card-pad space-y-4">
          <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
            <div>
              <label htmlFor="cat" className="label">
                Catégorie
              </label>
              <select
                id="cat"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="subject" className="label">
                Sujet
              </label>
              <input
                id="subject"
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div>
            <label htmlFor="body" className="label">
              Description
            </label>
            <textarea
              id="body"
              rows={3}
              required
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className="input resize-y"
            />
          </div>
          <button type="submit" className="btn-primary">
            Envoyer
          </button>
        </form>
      )}

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : !data?.length ? (
        <Empty icon={<LifeBuoy className="h-6 w-6" />} title="Aucun ticket" />
      ) : (
        <div className="space-y-3">
          {data.map((t) => (
            <article key={t.id} className="card card-pad">
              <button
                onClick={() => setActiveId(activeId === t.id ? null : t.id)}
                className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink-900">{t.subject}</p>
                    <Badge status={t.status} />
                    <span className="chip bg-ink-100 text-ink-600">{t.category}</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-400">
                    {t.reference} &middot; {t.opener.firstName} {t.opener.lastName} &middot;{' '}
                    {dateTime(t.createdAt)}
                  </p>
                </div>
              </button>

              {activeId === t.id && (
                <div className="mt-4 space-y-3 border-t border-ink-100 pt-4">
                  <p className="rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-700">{t.body}</p>

                  {(t.responses ?? []).map((r: any, i: number) => (
                    <p key={i} className="rounded-xl bg-risac-50 px-4 py-3 text-sm text-risac-800">
                      {r.message}
                      <span className="mt-1 block text-xs text-risac-600">{dateTime(r.at)}</span>
                    </p>
                  ))}

                  {t.status !== 'RESOLVED' && (
                    <form onSubmit={respond} className="flex gap-2">
                      <input
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Votre réponse..."
                        className="input flex-1"
                        aria-label="Réponse"
                      />
                      <button type="submit" className="btn-primary px-4">
                        <Send className="h-4 w-4" />
                      </button>
                    </form>
                  )}

                  {isSupport && t.status !== 'RESOLVED' && (
                    <button
                      onClick={async () => {
                        await api.post(`/moderation/tickets/${t.id}/close`, {});
                        mutate();
                      }}
                      className="btn-outline"
                    >
                      Marquer comme resolu
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

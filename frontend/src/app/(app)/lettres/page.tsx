'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import { CheckCircle2, FileText, Send, UserCheck } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList } from '@/components/ui/Loading';
import { dateTime } from '@/lib/format';
import { ROLE_LABEL, type Role } from '@/lib/roles';

type Person = { id: string; firstName: string; lastName: string; email: string; role: Role; adminRank: number | null };
type Letter = {
  id: string;
  subject: string;
  body: string;
  status: 'SUBMITTED' | 'FORWARDED' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
  requestedRole: Role;
  author: Person;
  candidate: Person;
  assignee: Person | null;
  decidedBy: Person | null;
  decisionNote: string | null;
  createdAt: string;
  forwardedAt: string | null;
  decidedAt: string | null;
  executedAt: string | null;
};

/** Promotions possibles (miroir de backend/src/common/promotion-paths.ts). */
const PATHS: Partial<Record<Role, Role[]>> = {
  FIELD_AGENT: ['AMBASSADOR', 'REGIONAL_MANAGER'],
  AMBASSADOR: ['REGIONAL_MANAGER'],
};

const STATUS: Record<Letter['status'], { label: string; tone: string }> = {
  SUBMITTED: { label: 'Chez le Super Admin n°1', tone: 'bg-amber-50 text-amber-800' },
  FORWARDED: { label: 'Transmise, en lecture', tone: 'bg-sky-50 text-sky-800' },
  APPROVED: { label: 'Validée : promotion ouverte', tone: 'bg-emerald-50 text-emerald-800' },
  REJECTED: { label: 'Refusée', tone: 'bg-rose-50 text-rose-700' },
  EXECUTED: { label: 'Promotion faite', tone: 'bg-ink-100 text-ink-700' },
};

const name = (p?: Person | null) => (p ? `${p.firstName} ${p.lastName}` : '—');
const rank = (p?: Person | null) => (p?.role === 'SUPER_ADMIN' && p.adminRank ? ` n°${p.adminRank}` : '');

export default function LettresPage() {
  const { user } = useAuth();
  const isRegional = user?.role === 'REGIONAL_MANAGER';
  const isAdmin = user?.role === 'SUPER_ADMIN';
  const isPrimary = isAdmin && user?.adminRank === 1;

  const { data: letters, isLoading, mutate } = useSWR<Letter[]>('/promotions/letters', fetcher, { refreshInterval: 20000 });
  const [openId, setOpenId] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const open = letters?.find((l) => l.id === openId) ?? null;

  async function act(path: string, body: unknown, success: string) {
    setBusy(true);
    setNotice(null);
    try {
      await api.post(path, body);
      setNotice({ ok: true, text: success });
      await mutate();
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message ?? 'Action impossible' });
    }
    setBusy(false);
  }

  const approved = (letters ?? []).filter((l) => l.status === 'APPROVED');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Lettres de promotion</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            {isRegional
              ? 'Pour promouvoir un agent, écrivez d’abord une lettre : elle part chez le Super Admin n°1, qui la tranche ou la transmet au n°2 ou au n°3. Une fois validée, l’espace de promotion s’ouvre.'
              : 'Lettres reçues des chefs régionaux. Après lecture, validez ou refusez. Le Super Admin n°1 peut aussi transmettre une lettre au n°2 ou au n°3.'}
          </p>
        </div>
        {isRegional && (
          <button type="button" onClick={() => setWriting(true)} className="btn-primary">
            <FileText className="h-4 w-4" aria-hidden="true" />
            Écrire une lettre
          </button>
        )}
      </div>

      {notice && (
        <p role="status" className={clsx('rounded-xl px-4 py-3 text-sm', notice.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700')}>
          {notice.text}
        </p>
      )}

      {isRegional && approved.length > 0 && (
        <section aria-labelledby="h-promo" className="card card-pad border-emerald-200 bg-emerald-50/40">
          <h2 id="h-promo" className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
            <UserCheck className="h-4 w-4" aria-hidden="true" />
            Espace de promotion
          </h2>
          <p className="mt-1 text-xs text-emerald-900/80">Ces lettres sont validées : vous pouvez promouvoir.</p>
          <ul className="mt-3 divide-y divide-emerald-100">
            {approved.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900">{name(l.candidate)}</p>
                  <p className="text-xs text-ink-600">
                    {ROLE_LABEL[l.candidate.role]} → <strong>{ROLE_LABEL[l.requestedRole]}</strong> · validée par {name(l.decidedBy)}
                    {rank(l.decidedBy)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(`/promotions/letters/${l.id}/execute`, {}, `${name(l.candidate)} est promu : ${ROLE_LABEL[l.requestedRole]}.`)}
                  className="btn-primary px-3 text-xs"
                >
                  Promouvoir
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-4">
              <SkeletonList rows={4} />
            </div>
          ) : !letters?.length ? (
            <div className="p-6">
              <Empty icon={<FileText className="h-6 w-6" />} title="Aucune lettre" description={isRegional ? 'Écrivez votre première lettre de promotion.' : 'Aucune lettre à lire pour le moment.'} />
            </div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {letters.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(l.id)}
                    className={clsx('w-full px-4 py-3.5 text-left transition-colors hover:bg-risac-50/50', openId === l.id && 'bg-risac-50')}
                  >
                    <p className="truncate text-sm font-medium text-ink-900">{l.subject}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-500">
                      {isRegional ? name(l.candidate) : `${name(l.author)} → ${name(l.candidate)}`} · {dateTime(l.createdAt)}
                    </p>
                    <span className={clsx('mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS[l.status].tone)}>
                      {STATUS[l.status].label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <section className="card card-pad min-h-[280px]" aria-live="polite">
          {!open ? (
            <Empty icon={<FileText className="h-6 w-6" />} title="Choisissez une lettre" description="Sélectionnez une lettre pour la lire." />
          ) : (
            <LetterView
              letter={open}
              isPrimary={isPrimary}
              isAdmin={isAdmin}
              busy={busy}
              onForward={(toUserId) => act(`/promotions/letters/${open.id}/forward`, { toUserId }, 'Lettre transmise.')}
              onDecide={(approve, note) =>
                act(`/promotions/letters/${open.id}/decide`, { approve, note }, approve ? 'Lettre validée : le chef régional peut promouvoir.' : 'Lettre refusée.')
              }
            />
          )}
        </section>
      </div>

      {writing && (
        <WriteLetter
          onClose={() => setWriting(false)}
          onSent={async (id) => {
            setWriting(false);
            setNotice({ ok: true, text: 'Lettre envoyée au Super Admin n°1.' });
            await mutate();
            setOpenId(id);
          }}
        />
      )}
    </div>
  );
}

function LetterView({
  letter,
  isPrimary,
  isAdmin,
  busy,
  onForward,
  onDecide,
}: {
  letter: Letter;
  isPrimary: boolean;
  isAdmin: boolean;
  busy: boolean;
  onForward: (toUserId: string) => void;
  onDecide: (approve: boolean, note?: string) => void;
}) {
  const { data: admins } = useSWR<any[]>(isPrimary ? '/users?role=SUPER_ADMIN' : null, fetcher);
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const pending = letter.status === 'SUBMITTED' || letter.status === 'FORWARDED';
  const targets = (admins ?? []).filter((a) => a.adminRank && a.adminRank !== 1 && a.status === 'ACTIVE');

  return (
    <article className="space-y-4">
      <header>
        <span className={clsx('inline-block rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS[letter.status].tone)}>{STATUS[letter.status].label}</span>
        <h2 className="mt-2 text-base font-semibold text-ink-900">{letter.subject}</h2>
        <p className="mt-1 text-xs text-ink-500">
          De {name(letter.author)} · {dateTime(letter.createdAt)}
          {letter.assignee ? ` · lecture : ${name(letter.assignee)}${rank(letter.assignee)}` : ''}
        </p>
      </header>

      <dl className="grid gap-3 rounded-xl bg-ink-50 p-3.5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-ink-500">Candidat</dt>
          <dd className="font-medium text-ink-900">{name(letter.candidate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-500">Promotion demandée</dt>
          <dd className="font-medium text-ink-900">
            {letter.status === 'EXECUTED'
              ? `Promu : ${ROLE_LABEL[letter.requestedRole]}`
              : `${ROLE_LABEL[letter.candidate.role]} → ${ROLE_LABEL[letter.requestedRole]}`}
          </dd>
        </div>
      </dl>

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-800">{letter.body}</p>

      {letter.decidedAt && (
        <p className="rounded-xl border border-ink-100 p-3.5 text-sm text-ink-700">
          <strong>{letter.status === 'REJECTED' ? 'Refusée' : 'Validée'}</strong> par {name(letter.decidedBy)}
          {rank(letter.decidedBy)} le {dateTime(letter.decidedAt)}.{letter.decisionNote ? ` « ${letter.decisionNote} »` : ''}
        </p>
      )}

      {isAdmin && pending && (
        <div className="space-y-3 border-t border-ink-100 pt-4">
          {isPrimary && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1">
                <label htmlFor="fw" className="label">
                  Transmettre à
                </label>
                <select id="fw" className="input" value={to} onChange={(e) => setTo(e.target.value)}>
                  <option value="">Choisir un Super Admin</option>
                  {targets.map((a) => (
                    <option key={a.id} value={a.id}>
                      Super Admin n°{a.adminRank} · {a.firstName} {a.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" disabled={!to || busy} onClick={() => onForward(to)} className="btn-outline">
                <Send className="h-4 w-4" aria-hidden="true" />
                Transmettre
              </button>
            </div>
          )}
          <div>
            <label htmlFor="dn" className="label">
              Note (obligatoire pour un refus)
            </label>
            <textarea id="dn" rows={2} className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => onDecide(true, note)} className="btn-primary">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Valider
            </button>
            <button type="button" disabled={busy || !note.trim()} onClick={() => onDecide(false, note)} className="btn-outline text-rose-700">
              Refuser
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function WriteLetter({ onClose, onSent }: { onClose: () => void; onSent: (id: string) => void }) {
  const { data: people } = useSWR<any[]>('/users', fetcher);
  const candidates = useMemo(() => (people ?? []).filter((p) => p.status === 'ACTIVE' && PATHS[p.role as Role]), [people]);
  const [candidateId, setCandidateId] = useState('');
  const [requestedRole, setRequestedRole] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const candidate = candidates.find((c) => c.id === candidateId);
  const roles = candidate ? (PATHS[candidate.role as Role] ?? []) : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!candidateId || !requestedRole) return setError('Choisissez le candidat et le rôle demandé.');
    if (!subject.trim()) return setError('Donnez un objet à la lettre.');
    if (body.trim().length < 30) return setError('Expliquez le motif dans la lettre (30 caractères au moins).');
    setBusy(true);
    try {
      const l = await api.post<{ id: string }>('/promotions/letters', { candidateId, requestedRole, subject: subject.trim(), body: body.trim() });
      onSent(l.id);
    } catch (err: any) {
      setError(err?.message ?? 'Envoi impossible');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="wl-title">
      <form onSubmit={submit} className="card flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden" noValidate>
        <header className="border-b border-ink-100 px-5 py-3.5">
          <h2 id="wl-title" className="text-sm font-semibold text-ink-900">
            Lettre au Super Admin
          </h2>
        </header>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              {error}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="wl-cand" className="label">
                Agent à promouvoir
              </label>
              <select
                id="wl-cand"
                className="input"
                value={candidateId}
                onChange={(e) => {
                  setCandidateId(e.target.value);
                  setRequestedRole('');
                }}
              >
                <option value="">Choisir</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} · {ROLE_LABEL[c.role as Role]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="wl-role" className="label">
                Rôle demandé
              </label>
              <select id="wl-role" className="input" value={requestedRole} onChange={(e) => setRequestedRole(e.target.value)} disabled={!candidate}>
                <option value="">Choisir</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="wl-subject" className="label">
              Objet
            </label>
            <input id="wl-subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
          </div>
          <div>
            <label htmlFor="wl-body" className="label">
              Votre lettre
            </label>
            <textarea id="wl-body" rows={8} className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Présentez le parcours de l’agent et expliquez pourquoi il mérite cette promotion." />
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3.5">
          <button type="button" onClick={onClose} className="btn-ghost">
            Annuler
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Envoi…' : 'Envoyer la lettre'}
          </button>
        </footer>
      </form>
    </div>
  );
}

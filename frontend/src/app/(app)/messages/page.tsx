'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import { ArrowLeft, EyeOff, Lock, MessageCircle, Pin, PinOff, Search, Send, ShieldAlert, Users, X } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from '@/components/ui/Avatar';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList } from '@/components/ui/Loading';
import { relative } from '@/lib/format';
import { ChannelMembers } from '@/components/messages/ChannelMembers';

const CHANNEL_LABEL: Record<string, string> = {
  GENERAL: 'Général',
  AMBASSADOR_REGIONAL: 'Ambassadeurs de la région',
  AMBASSADOR_NATIONAL: 'Ambassadeurs du pays',
  AMBASSADOR_ORPHANAGE: 'Orphelinat',
  DONOR_AMBASSADOR: 'Parrainage',
  REGIONAL: 'Région',
  PARTNERS: 'Partenaires',
};

export default function MessagesPage() {
  const { user } = useAuth();
  const isModerator = ['SUPER_ADMIN', 'MODERATOR'].includes(user?.role ?? '');
  const canManageMembers = ['SUPER_ADMIN', 'MODERATOR', 'NATIONAL_MANAGER', 'REGIONAL_MANAGER'].includes(
    user?.role ?? '',
  );

  // Le Super Admin et le Modérateur peuvent basculer sur tous les canaux du reseau.
  const [allChannels, setAllChannels] = useState(false);
  const listKey = allChannels && isModerator ? '/channels/all' : '/channels';
  const { data: channels, isLoading, mutate } = useSWR<any[]>(listKey, fetcher);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = channels?.find((c) => c.id === activeId) ?? null;
  const pinned = messages.filter((m) => m.pinned && !m.hidden);

  useEffect(() => {
    if (!activeId) return;
    setError(null);
    api
      .get<any[]>(`/channels/${activeId}/messages?take=60`)
      .then(setMessages)
      .catch(() => setMessages([]));
    // Un modérateur peut ouvrir un canal dont il n’est pas membre : l’accusé de
    // lecture n’existe alors pas, l’échec est sans conséquence.
    api
      .post(`/channels/${activeId}/read`, {})
      .then(() => mutate())
      .catch(() => {});
    setResults(null);
    setQuery('');
    setShowMembers(false);
  }, [activeId]);

  useEffect(() => {
    const socket = getSocket();
    const onNew = (m: any) => {
      if (m.channelId === activeId) {
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      }
      mutate();
    };
    socket.on('message:new', onNew);
    return () => {
      socket.off('message:new', onNew);
    };
  }, [activeId, mutate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !activeId) return;
    setError(null);
    try {
      await api.post(`/channels/${activeId}/messages`, { content: draft });
      setDraft('');
    } catch (err: any) {
      const v = err?.payload?.violations?.[0];
      setError(v ? v.message : (err?.payload?.message ?? err?.message ?? 'Envoi impossible'));
    }
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId || !query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const r = await api.get<any[]>(`/channels/${activeId}/search?q=${encodeURIComponent(query.trim())}`);
      setResults(r);
    } catch (err: any) {
      setError(err?.message ?? 'La recherche a échoué.');
    }
    setSearching(false);
  }

  /** Épinglage d’un message : visible en haut du canal pour tous les membres. */
  async function togglePin(m: any) {
    try {
      await api.post(`/channels/messages/${m.id}/pin`, { pinned: !m.pinned });
      setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, pinned: !m.pinned } : x)));
    } catch (err: any) {
      setError(err?.message ?? 'L’épinglage a échoué.');
    }
  }

  /** Masquage d un message par le modérateur. */
  async function hideMessage(m: any) {
    const reason = window.prompt('Motif du masquage ?');
    if (!reason) return;
    try {
      await api.post(`/channels/messages/${m.id}/hide`, { reason });
      setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, hidden: true, hiddenReason: reason } : x)));
    } catch (err: any) {
      setError(err?.message ?? 'Le masquage a échoué.');
    }
  }

  return (
    <div className="grid h-[calc(100vh-10rem)] gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside aria-label="Canaux de discussion" className={clsx('card flex flex-col overflow-hidden', activeId && 'hidden lg:flex')}>
        <div className="space-y-2.5 border-b border-ink-100 px-4 py-3">
          <h1 className="text-sm font-semibold text-ink-900">
            {allChannels && isModerator ? 'Tous les canaux' : 'Mes canaux'}
          </h1>
          {isModerator && (
            <div className="flex rounded-xl bg-ink-100 p-1" role="tablist" aria-label="Périmètre des canaux">
              {[
                { value: false, label: 'Mes canaux' },
                { value: true, label: 'Tout le réseau' },
              ].map((o) => (
                <button
                  key={String(o.value)}
                  role="tab"
                  aria-selected={allChannels === o.value}
                  onClick={() => {
                    setAllChannels(o.value);
                    setActiveId(null);
                  }}
                  className={clsx(
                    'min-h-[36px] flex-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors duration-fast',
                    allChannels === o.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4">
              <SkeletonList rows={4} />
            </div>
          ) : (
            channels?.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={clsx(
                  'flex w-full items-start gap-3 border-b border-ink-50 px-4 py-3 text-left transition-colors hover:bg-risac-50/50',
                  activeId === c.id && 'bg-risac-50',
                )}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-risac-100 text-risac-700">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink-900">{c.name}</span>
                    {c.unread > 0 && (
                      <span className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent-coral px-1.5 text-[10px] font-semibold text-white">
                        {c.unread}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-400">
                    {c.lastMessage
                      ? `${c.lastMessage.author.firstName}: ${c.lastMessage.content}`
                      : CHANNEL_LABEL[c.type]}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className={clsx('grid min-h-0 gap-5', showMembers && activeId ? 'lg:grid-cols-[minmax(0,1fr)_280px]' : '')}>
      <section className={clsx('card flex min-h-0 flex-col overflow-hidden', !activeId && 'hidden lg:flex')}>
        {!active ? (
          <div className="grid flex-1 place-items-center p-6">
            <Empty
              icon={<MessageCircle className="h-6 w-6" />}
              title="Choisissez un canal"
              description="Selectionnez une conversation pour afficher les messages."
            />
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-ink-100 px-4 py-3">
              <button
                onClick={() => setActiveId(null)}
                className="btn-ghost h-8 w-8 p-0 lg:hidden"
                aria-label="Retour"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">{active.name}</p>
                <p className="truncate text-xs text-ink-400">
                  {CHANNEL_LABEL[active.type]} &middot; {active._count?.members ?? 0} membres
                  {active.moderated ? ' - modere' : ''}
                </p>
              </div>
              {active.type === 'DONOR_AMBASSADOR' && (
                <span className="chip bg-amber-50 text-amber-700">
                  <Lock className="h-3 w-3" />
                  Sans coordonnees
                </span>
              )}
              {canManageMembers && (
                <button
                  onClick={() => setShowMembers((v) => !v)}
                  className="btn-ghost h-8 w-8 shrink-0 p-0"
                  aria-expanded={showMembers}
                  aria-label="Membres du canal"
                >
                  <Users className="h-4 w-4" />
                </button>
              )}
            </header>

            <form onSubmit={runSearch} className="flex gap-2 border-b border-ink-100 px-4 py-2.5">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
                  aria-hidden
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher dans ce canal"
                  className="input h-9 pl-9 text-sm"
                  aria-label="Rechercher dans ce canal"
                />
              </div>
              <button
                type="submit"
                disabled={!query.trim() || searching}
                aria-busy={searching}
                className="btn-outline h-9 px-3 text-xs"
              >
                {searching ? 'Recherche…' : 'Chercher'}
              </button>
              {results && (
                <button
                  type="button"
                  onClick={() => {
                    setResults(null);
                    setQuery('');
                  }}
                  className="btn-ghost h-9 w-9 shrink-0 p-0"
                  aria-label="Fermer la recherche"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </form>

            {pinned.length > 0 && !results && (
              <div className="border-b border-ink-100 bg-risac-50/60 px-4 py-2">
                <p className="meta flex items-center gap-1.5">
                  <Pin className="h-3 w-3" aria-hidden />
                  {pinned.length} message(s) épinglé(s)
                </p>
                <ul className="mt-1 space-y-1">
                  {pinned.map((m) => (
                    <li key={m.id} className="truncate text-xs text-risac-800">
                      {m.author?.firstName} : {m.content}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {results ? (
              <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
                <p className="meta">
                  {results.length === 0
                    ? 'Aucun message ne correspond.'
                    : `${results.length} message(s) trouvé(s), du plus récent au plus ancien`}
                </p>
                {results.map((m) => (
                  <div key={m.id} className="rounded-xl border border-ink-100 px-3 py-2">
                    <p className="meta">
                      {m.author?.firstName} {m.author?.lastName} &middot; {relative(m.createdAt)}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-800">{m.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messages.map((m) => {
                  const mine = m.authorId === user?.id;
                  return (
                    <div key={m.id} className={clsx('group flex gap-2.5', mine && 'flex-row-reverse')}>
                      <Avatar
                        src={m.author?.avatarUrl}
                        firstName={m.author?.firstName}
                        lastName={m.author?.lastName}
                        size="xs"
                      />
                      <div className={clsx('max-w-[75%]', mine && 'text-right')}>
                        <p className="text-xs text-ink-500">
                          {m.author?.firstName} {m.author?.lastName} &middot; {relative(m.createdAt)}
                          {m.pinned && (
                            <span className="ml-1.5 inline-flex items-center gap-1 text-risac-700">
                              <Pin className="h-3 w-3" aria-hidden />
                              épinglé
                            </span>
                          )}
                        </p>
                        <div
                          className={clsx(
                            'mt-1 inline-block rounded-2xl px-3.5 py-2 text-sm',
                            mine ? 'bg-risac-600 text-white' : 'bg-ink-100 text-ink-800',
                            m.hidden && 'line-through opacity-50',
                          )}
                        >
                          {m.content}
                        </div>
                        {m.hidden && m.hiddenReason && (
                          <p className="mt-0.5 text-xs text-rose-700">Masqué : {m.hiddenReason}</p>
                        )}
                      </div>

                      {/* Actions discrètes : visibles au survol, au focus clavier et sur écran tactile. */}
                      <div className="flex shrink-0 items-start gap-0.5 opacity-100 transition-opacity duration-fast sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        <button
                          onClick={() => togglePin(m)}
                          className="btn-ghost h-7 w-7 p-0"
                          aria-pressed={!!m.pinned}
                          aria-label={m.pinned ? 'Retirer l’épingle' : 'Épingler ce message'}
                        >
                          {m.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                        </button>
                        {isModerator && !m.hidden && (
                          <button
                            onClick={() => hideMessage(m)}
                            className="btn-ghost h-7 w-7 p-0"
                            aria-label="Masquer ce message"
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="mx-4 mb-2 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700"
              >
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}

            <form onSubmit={send} className="flex gap-2 border-t border-ink-100 p-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={active.canWrite === false ? 'Canal en lecture seule' : 'Votre message...'}
                disabled={active.canWrite === false}
                className="input flex-1"
                aria-label="Message"
              />
              <button type="submit" disabled={!draft.trim()} className="btn-primary px-4">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </>
        )}
      </section>

      {showMembers && activeId && (
        <aside className="card animate-fade-up overflow-hidden" aria-label="Membres du canal">
          <ChannelMembers channelId={activeId} onClose={() => setShowMembers(false)} />
        </aside>
      )}
      </div>
    </div>
  );
}

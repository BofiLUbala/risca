'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowLeft, BadgeCheck, Check, MapPin } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Badge } from '@/components/ui/Badge';
import { PageLoading } from '@/components/ui/Loading';
import { Tabs } from '@/components/child/Tabs';
import { OrphanageTabs } from '@/components/orphanage/OrphanageTabs';

export default function OrphanageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data: o, isLoading, mutate } = useSWR<any>(`/orphanages/${id}`, fetcher);
  const [tab, setTab] = useState('identite');
  const [msg, setMsg] = useState<string | null>(null);

  if (isLoading || !o) return <PageLoading />;

  const isAdmin = user?.role === 'SUPER_ADMIN';
  const isRegional = user?.role === 'REGIONAL_MANAGER' || user?.role === 'NATIONAL_MANAGER';
  const isFinance = user?.role === 'ADMIN_FINANCE' || isAdmin;

  async function act(path: string, body?: any) {
    setMsg(null);
    try {
      await api.post(`/orphanages/${id}/${path}`, body ?? {});
      mutate();
      setMsg('Action enregistrée.');
    } catch (e: any) {
      setMsg(e?.message ?? 'Action impossible');
    }
  }

  const tabs = [
    { key: 'identite', label: 'Identité' },
    { key: 'capacite', label: 'Capacité' },
    { key: 'label', label: 'Labellisation', count: o.labelAudits?.length },
    { key: 'finances', label: 'Finances' },
    { key: 'equipe', label: 'Équipe', count: o.members?.length },
    { key: 'historique', label: 'Historique', count: o.historyEntries?.length },
  ];

  return (
    <div className="space-y-5">
      <Link
        href="/orphelinats"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 sm:min-h-0"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux orphelinats
      </Link>

      <header className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="page-title">{o.name}</h1>
              <Badge status={o.status} />
              <Badge status={o.labelStatus} />
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-ink-500">
              <MapPin className="h-4 w-4" />
              {o.city ? `${o.city}, ` : ''}
              {o.province.nameFr} - {o.country.nameFr}
              {o.hideExactLocation ? (
                <span className="chip bg-amber-50 text-amber-700">localisation masquée</span>
              ) : null}
            </p>
            {o.description ? (
              <p className="mt-3 max-w-2xl text-sm text-ink-600">{o.description}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {isAdmin && o.status !== 'APPROVED' ? (
              <button onClick={() => act('approve')} className="btn-primary">
                <Check className="h-4 w-4" />
                Valider la structure
              </button>
            ) : null}
            {(isAdmin || user?.role === 'ORPHANAGE_DIRECTOR') && o.labelStatus === 'NONE' ? (
              <button onClick={() => act('label/apply')} className="btn-outline">
                <BadgeCheck className="h-4 w-4" />
                Demander la labellisation
              </button>
            ) : null}
            {isFinance ? (
              <button
                onClick={() => act('verify-account', { verified: !o.accountVerified })}
                className="btn-outline"
              >
                {o.accountVerified ? 'Annuler la vérification' : 'Vérifier le compte'}
              </button>
            ) : null}
          </div>
        </div>

        {msg ? (
          <p role="status" className="mt-4 rounded-xl bg-risac-50 px-4 py-2.5 text-sm text-risac-800">
            {msg}
          </p>
        ) : null}
      </header>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <div className="animate-fade-up">
        <OrphanageTabs
          tab={tab}
          orphanage={o}
          canDecide={isAdmin || isRegional}
          onAct={act}
          onRefresh={() => mutate()}
        />
      </div>
    </div>
  );
}

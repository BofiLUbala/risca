'use client';

import useSWR from 'swr';
import { SafeImage } from '@/components/ui/SafeImage';
import {
  Baby, Banknote, Brain, FileText, GraduationCap, HeartPulse, Home, Landmark,
  MapPin, RefreshCw, Scale, ShieldAlert, Target, UserCheck,
} from 'lucide-react';
import { fetcher, mediaUrl } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { SkeletonList } from '@/components/ui/Loading';
import { Empty } from '@/components/ui/Empty';

const TYPE_META: Record<string, { label: string; icon: any; tone: string }> = {
  ADMISSION: { label: 'Admission', icon: Home, tone: 'bg-risac-100 text-risac-700' },
  HEALTH: { label: 'Santé', icon: HeartPulse, tone: 'bg-rose-100 text-rose-700' },
  PSYCHOTRAUMA: { label: 'Psychotrauma', icon: Brain, tone: 'bg-violet-100 text-violet-700' },
  SCHOOLING: { label: 'Scolarité', icon: GraduationCap, tone: 'bg-amber-100 text-amber-700' },
  FONAREV: { label: 'FONAREV', icon: Scale, tone: 'bg-emerald-100 text-emerald-700' },
  FUNDING: { label: 'Financement', icon: Banknote, tone: 'bg-emerald-100 text-emerald-700' },
  PROJECT: { label: 'Projet', icon: Target, tone: 'bg-risac-100 text-risac-700' },
  VISIT: { label: 'Visite', icon: MapPin, tone: 'bg-risac-100 text-risac-700' },
  TRANSFER: { label: 'Transfert', icon: RefreshCw, tone: 'bg-amber-100 text-amber-700' },
  REUNIFICATION: { label: 'Réunification', icon: UserCheck, tone: 'bg-emerald-100 text-emerald-700' },
  ADULTHOOD: { label: 'Majorite', icon: Baby, tone: 'bg-ink-100 text-ink-700' },
  EXIT: { label: 'Sortie', icon: Landmark, tone: 'bg-ink-100 text-ink-700' },
  INCIDENT: { label: 'Incident', icon: ShieldAlert, tone: 'bg-rose-100 text-rose-700' },
  DOSSIER_UPDATE: { label: 'Mise à jour', icon: FileText, tone: 'bg-ink-100 text-ink-700' },
  STATUS_CHANGE: { label: 'Statut', icon: RefreshCw, tone: 'bg-ink-100 text-ink-700' },
};

export function Timeline({ childId }: { childId: string }) {
  const { data, isLoading } = useSWR<any[]>(`/children/${childId}/timeline`, fetcher);

  if (isLoading) return <SkeletonList rows={4} />;
  if (!data?.length) {
    return <Empty title="Historique vide" description="Aucun événement enregistré pour le moment." />;
  }

  return (
    <ol className="relative space-y-4 pl-8">
      <span aria-hidden="true" className="absolute left-[15px] top-2 h-[calc(100%-1rem)] w-px bg-ink-200" />
      {data.map((e) => {
        const meta = TYPE_META[e.type] ?? TYPE_META.DOSSIER_UPDATE;
        const Icon = meta.icon;
        return (
          <li key={e.id} className="relative">
            <span
              className={`absolute -left-8 grid h-8 w-8 place-items-center rounded-full ring-4 ring-ink-50 ${meta.tone}`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="card card-pad">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-ink-900">{e.title}</p>
                <span className="text-xs text-ink-400">{dateTime(e.occurredAt)}</span>
              </div>
              {e.description && (
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{e.description}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-400">
                <span className="chip bg-ink-100 text-ink-600">{meta.label}</span>
                {e.isPublic && <span className="chip bg-emerald-50 text-emerald-700">public</span>}
                {e.correctsId && <span className="chip bg-amber-50 text-amber-700">correction</span>}
                {e.author && (
                  <span>
                    {e.author.firstName} {e.author.lastName}
                  </span>
                )}
              </div>
              {e.attachments?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {e.attachments.map((a: string) => (
                    <SafeImage key={a} src={mediaUrl(a)} className="h-16 w-16 rounded-lg object-cover" />
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

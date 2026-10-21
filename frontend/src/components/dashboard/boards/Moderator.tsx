'use client';

import Link from 'next/link';
import { EyeOff, LifeBuoy, MessageSquareOff, ShieldAlert } from 'lucide-react';
import { Stat } from '@/components/ui/Stat';
import { Badge } from '@/components/ui/Badge';
import { CountRow, SectionTitle } from '../widgets';
import { num, relative } from '@/lib/format';

export function ModeratorBoard({ data }: { data: any }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Signalements ouverts" value={num(data.queues.openReports)} tone="amber" icon={<ShieldAlert className="h-5 w-5" />} />
        <Stat label="Signalements graves" value={num(data.queues.seriousReports)} tone="coral" icon={<ShieldAlert className="h-5 w-5" />} />
        <Stat label="Tickets ouverts" value={num(data.queues.openTickets)} tone="primary" icon={<LifeBuoy className="h-5 w-5" />} />
        <Stat label="Contenus masques" value={num(data.moderated.hiddenPosts + data.moderated.hiddenMessages)} icon={<EyeOff className="h-5 w-5" />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card card-pad lg:col-span-2">
          <SectionTitle
            action={
              <Link href="/moderation" className="text-sm font-medium text-risac-600 hover:text-risac-700">
                File complete
              </Link>
            }
          >
            Signalements récents
          </SectionTitle>
          <div className="space-y-2">
            {data.recentReports.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-400">Aucun signalement en attente.</p>
            )}
            {data.recentReports.map((r: any) => (
              <Link
                key={r.id}
                href={`/moderation/${r.id}`}
                className="flex items-start gap-3 rounded-xl border border-ink-100 px-4 py-3 transition-colors hover:border-risac-200 hover:bg-risac-50/40"
              >
                <Badge tone={r.severity === 'SERIOUS' ? 'bg-rose-50 text-rose-700' : undefined} status={r.status}>
                  {r.severity === 'SERIOUS' ? 'Grave' : 'Normal'}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-800">{r.reason}</p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {r.targetType} &middot; {r.reporter.firstName} {r.reporter.lastName} &middot;{' '}
                    {relative(r.createdAt)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="card card-pad">
          <SectionTitle>Tickets par catégorie</SectionTitle>
          {data.ticketsByCategory.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-400">Aucun ticket ouvert.</p>
          )}
          {data.ticketsByCategory.map((t: any) => (
            <CountRow key={t.category} label={t.category} value={t.count} href="/support" />
          ))}

          <div className="mt-5 space-y-0 border-t border-ink-100 pt-4">
            <CountRow label="Publications masquées" value={data.moderated.hiddenPosts} />
            <CountRow label="Messages masques" value={data.moderated.hiddenMessages} />
          </div>
        </section>
      </div>
    </>
  );
}

'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { Empty } from '@/components/ui/Empty';
import { BroadcastForm } from '@/components/notifications/BroadcastForm';
import { SkeletonList } from '@/components/ui/Loading';
import { relative } from '@/lib/format';

export default function NotificationsPage() {
  const { data, isLoading, mutate } = useSWR<any[]>('/notifications', fetcher);

  async function readAll() {
    await api.post('/notifications/read-all', {});
    mutate();
  }

  async function read(id: string) {
    await api.post(`/notifications/${id}/read`, {});
    mutate();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Notifications</h1>
        <button onClick={readAll} className="btn-outline">
          <CheckCheck className="h-4 w-4" />
          Tout marquer comme lu
        </button>
      </div>

      <BroadcastForm />

      {isLoading ? (
        <SkeletonList rows={5} />
      ) : !data?.length ? (
        <Empty icon={<Bell className="h-6 w-6" />} title="Aucune notification" />
      ) : (
        <div className="card divide-y divide-ink-100 overflow-hidden">
          {data.map((n) => {
            const inner = (
              <>
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-ink-200' : 'bg-risac-500'}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink-900">{n.title}</span>
                  {n.body && <span className="mt-0.5 block text-sm text-ink-600">{n.body}</span>}
                  <span className="mt-1 block text-xs text-ink-400">
                    {relative(n.createdAt)} &middot; {n.kind}
                  </span>
                </span>
              </>
            );

            return n.link ? (
              <Link
                key={n.id}
                href={n.link}
                onClick={() => read(n.id)}
                className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-risac-50/50 sm:px-5"
              >
                {inner}
              </Link>
            ) : (
              <button
                key={n.id}
                onClick={() => read(n.id)}
                className="flex w-full gap-3 px-4 py-3.5 text-left transition-colors hover:bg-ink-50 sm:px-5"
              >
                {inner}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

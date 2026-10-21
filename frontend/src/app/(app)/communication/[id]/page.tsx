'use client';

import { use } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowLeft } from 'lucide-react';
import { fetcher } from '@/lib/api';
import { PostCard } from '@/components/feed/PostCard';
import { PageLoading } from '@/components/ui/Loading';

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: post, isLoading, mutate } = useSWR<any>(`/posts/${id}`, fetcher);

  if (isLoading || !post) return <PageLoading />;

  return (
    <div className="mx-auto w-full max-w-[620px] space-y-5">
      <Link
        href="/communication"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 sm:min-h-0"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au fil
      </Link>
      <PostCard post={post} onChange={() => mutate()} />
    </div>
  );
}

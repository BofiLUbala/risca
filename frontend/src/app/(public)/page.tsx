'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { ArrowRight, Eye } from 'lucide-react';
import { fetcher } from '@/lib/api';
import { ChildCard, type PublicChild } from '@/components/ChildCard';
import { ProjectCard, type PublicProject } from '@/components/ProjectCard';
import { SkeletonList } from '@/components/ui/Loading';
import { AXES, CIRCUIT } from './home-data';

export default function HomePage() {
  const { data: children, isLoading: loadingChildren } = useSWR<PublicChild[]>(
    '/children/public/feed?take=8&needsSponsor=true',
    fetcher,
  );
  const { data: projects, isLoading: loadingProjects } = useSWR<PublicProject[]>(
    '/projects/public?take=6',
    fetcher,
  );

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-b from-risac-50 via-white to-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-risac-200/40 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-risac-100/60 blur-3xl"
        />

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="max-w-3xl">
            <span className="chip bg-risac-100 text-risac-700">ONG Congo Meilleur ASBL &middot; RISAC</span>
            <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-ink-950 sm:text-4xl lg:text-5xl">
              B&acirc;tir un &eacute;cosyst&egrave;me d&apos;excellence, de r&eacute;silience, de
              r&eacute;paration et d&apos;inclusion pour l&apos;enfance vuln&eacute;rable
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-600 sm:text-lg">
              RISAC relie les orphelinats, les ambassadeurs, les responsables r&eacute;gionaux et
              nationaux, les bailleurs et les partenaires. Chaque enfant est suivi individuellement,
              chaque franc est trac&eacute; jusqu&apos;&agrave; sa preuve de d&eacute;pense.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/enfants-a-soutenir" className="btn-primary px-6 py-3">
                Soutenir un enfant
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/projets-ouverts" className="btn-outline px-6 py-3">
                Voir les projets en cours
              </Link>
            </div>

            <dl className="mt-12 grid max-w-xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium text-ink-500">Objectif</dt>
                <dd className="mt-1 text-2xl font-semibold text-ink-900">150</dd>
                <dd className="text-xs text-ink-500">structures audit&eacute;es</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-ink-500">Couverture</dt>
                <dd className="mt-1 text-2xl font-semibold text-ink-900">26</dd>
                <dd className="text-xs text-ink-500">provinces de la RDC</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-ink-500">
                  Tra&ccedil;abilit&eacute;
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-ink-900">100 %</dd>
                <dd className="text-xs text-ink-500">des d&eacute;penses justifi&eacute;es</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink-950">
              Ces enfants attendent un parrain
            </h2>
            <p className="mt-2 text-sm text-ink-500">
              Pr&eacute;nom, &acirc;ge et r&eacute;gion g&eacute;n&eacute;rale uniquement. Le nom de
              famille et la localisation pr&eacute;cise ne sont jamais publics.
            </p>
          </div>
          <Link href="/enfants-a-soutenir" className="btn-soft">
            Tous les enfants
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8">
          {loadingChildren ? (
            <SkeletonList rows={2} />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {children?.slice(0, 8).map((c) => (
                <ChildCard key={c.id} child={c} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="bg-ink-50/70 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-ink-950">
                Projets ouverts au financement
              </h2>
              <p className="mt-2 text-sm text-ink-500">
                Chaque projet est valid&eacute; par l&apos;ambassadeur de l&apos;enfant avant
                publication.
              </p>
            </div>
            <Link href="/projets-ouverts" className="btn-soft">
              Tous les projets
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8">
            {loadingProjects ? (
              <SkeletonList rows={2} />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {projects?.slice(0, 6).map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight text-ink-950">
          Quatre axes, une seule plateforme
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {AXES.map((axe) => (
            <div key={axe.title} className="card card-pad flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-risac-50 text-risac-600">
                <axe.icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div>
                <h3 className="text-base font-semibold text-ink-900">{axe.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{axe.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-br from-risac-600 to-risac-800 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Le circuit de votre don</h2>
          <p className="mt-2 max-w-2xl text-risac-100">
            Aucune personne ne saisit, ne re&ccedil;oit et ne d&eacute;pense seule.
            L&apos;ambassadeur ne touche jamais l&apos;argent.
          </p>

          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CIRCUIT.map((s) => (
              <li key={s.n} className="rounded-2xl bg-white/10 p-5 backdrop-blur-sm">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 text-sm font-semibold">
                  {s.n}
                </span>
                <p className="mt-4 font-semibold">{s.t}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-risac-100">{s.d}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/inscription" className="btn bg-white px-6 py-3 text-risac-700 hover:bg-risac-50">
              Devenir bailleur
            </Link>
            <Link
              href="/don-fonds-general"
              className="btn border border-white/40 px-6 py-3 text-white hover:bg-white/10"
            >
              <Eye className="h-4 w-4" />
              Soutenir le fonds g&eacute;n&eacute;ral
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

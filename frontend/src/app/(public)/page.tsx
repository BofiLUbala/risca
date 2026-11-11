'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { ArrowRight, Eye, HeartHandshake, ShieldCheck, Target } from 'lucide-react';
import { Empty } from '@/components/ui/Empty';
import { fetcher } from '@/lib/api';
import { ChildCard, type PublicChild } from '@/components/ChildCard';
import { ProjectCard, type PublicProject } from '@/components/ProjectCard';
import { SkeletonList } from '@/components/ui/Loading';
import { AXES, CIRCUIT } from './home-data';

const PROMISES = [
  { value: '150', label: 'structures auditées', hint: 'Objectif du réseau' },
  { value: '26', label: 'provinces de la RDC', hint: 'Couverture' },
  { value: '100 %', label: 'des dépenses justifiées', hint: 'Traçabilité' },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="brand-tick text-sm font-semibold text-ink-700">{children}</p>;
}

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
      {/* Accueil : bande bleu marine du logo, accent jaune */}
      <section className="brand-band relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-sun-400"
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.15fr_1fr] lg:px-8 lg:py-24">
          <div>
            <span className="chip bg-sun-400 text-navy">ONG Congo Meilleur ASBL &middot; RISAC</span>
            <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
              B&acirc;tir un &eacute;cosyst&egrave;me d&apos;excellence, de r&eacute;silience, de
              r&eacute;paration et d&apos;inclusion pour{' '}
              <span className="text-sun-400">l&apos;enfance vuln&eacute;rable</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-onband sm:text-lg">
              RISAC relie les orphelinats, les ambassadeurs, les responsables r&eacute;gionaux et
              nationaux, les bailleurs et les partenaires. Chaque enfant est suivi individuellement,
              chaque franc est trac&eacute; jusqu&apos;&agrave; sa preuve de d&eacute;pense.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/enfants-a-soutenir" className="btn-primary px-6 py-3">
                Soutenir un enfant
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/projets-ouverts" className="btn-on-dark px-6 py-3">
                Voir les projets en cours
              </Link>
            </div>
          </div>

          <div className="rounded-3xl bg-surface p-6 shadow-lift sm:p-8">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <ShieldCheck className="h-5 w-5 text-risac-700" strokeWidth={1.75} />
              Nos engagements
            </p>
            <dl className="mt-6 space-y-5">
              {PROMISES.map((p) => (
                <div key={p.label} className="border-l-4 border-sun-400 pl-4">
                  <dt className="text-xs font-medium text-ink-500">{p.hint}</dt>
                  <dd className="mt-0.5 flex items-baseline gap-2">
                    <span className="text-3xl font-semibold tracking-tight text-ink-950">{p.value}</span>
                    <span className="text-sm text-ink-600">{p.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <Link href="/transparence" className="link-action mt-7">
              Voir le rapport de transparence
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Parrainage</Eyebrow>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink-950">
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
          ) : !children?.length ? (
            <Empty
              icon={<HeartHandshake className="h-6 w-6" />}
              title="Tous les enfants présentés ont trouvé un parrain"
              description="De nouveaux dossiers sont publiés après validation par leur ambassadeur. Le fonds général soutient les enfants en attente."
              action={
                <Link href="/don-fonds-general" className="btn-primary">
                  Soutenir le fonds général
                </Link>
              }
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {children?.slice(0, 8).map((c) => (
                <ChildCard key={c.id} child={c} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="border-y border-sun-200 bg-sun-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>Collectes</Eyebrow>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink-950">
                Projets ouverts au financement
              </h2>
              <p className="mt-2 text-sm text-ink-600">
                Chaque projet est valid&eacute; par l&apos;ambassadeur de l&apos;enfant avant
                publication.
              </p>
            </div>
            <Link href="/projets-ouverts" className="btn-primary">
              Tous les projets
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8">
            {loadingProjects ? (
              <SkeletonList rows={2} />
            ) : !projects?.length ? (
              <Empty
                icon={<Target className="h-6 w-6" />}
                title="Aucune collecte ouverte en ce moment"
                description="Les prochains projets apparaîtront ici dès leur validation."
              />
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
        <Eyebrow>Notre action</Eyebrow>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink-950">
          Quatre axes, une seule plateforme
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {AXES.map((axe) => (
            <div key={axe.title} className="card card-pad flex gap-4 border-t-4 border-t-sun-400">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sun-400 text-navy">
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

      <section className="brand-band py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="brand-tick text-sm font-semibold text-sun-300">Transparence</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Le circuit de votre don</h2>
          <p className="mt-2 max-w-2xl text-onband">
            Aucune personne ne saisit, ne re&ccedil;oit et ne d&eacute;pense seule.
            L&apos;ambassadeur ne touche jamais l&apos;argent.
          </p>

          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CIRCUIT.map((s) => (
              <li key={s.n} className="rounded-2xl border border-white/10 bg-white/[0.07] p-5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-sun-400 text-sm font-semibold text-navy">
                  {s.n}
                </span>
                <p className="mt-4 font-semibold">{s.t}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-onband">{s.d}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/inscription" className="btn-primary px-6 py-3">
              Devenir bailleur
            </Link>
            <Link href="/don-fonds-general" className="btn-on-dark px-6 py-3">
              <Eye className="h-4 w-4" />
              Soutenir le fonds g&eacute;n&eacute;ral
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

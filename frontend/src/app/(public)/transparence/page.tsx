'use client';

import Link from 'next/link';
import { BadgeCheck, FileCheck, Lock, Scale } from 'lucide-react';

const GARANTIES = [
  {
    icon: Scale,
    title: 'Separation des pouvoirs sur l’argent',
    text: "L'ambassadeur ne touche jamais les fonds. La structure demande le décaissement, l'ambassadeur confirme le besoin, l'Admin Finance approuve et paie, la structure justifie la dépense.",
  },
  {
    icon: BadgeCheck,
    title: 'Seules les structures labellisées recoivent des fonds',
    text: "Candidature, audit sur place, puis décision : conforme, conforme sous conditions ou non conforme. Le label expire et l'audit doit etre renouvele. Le compte bancaire ou mobile money doit etre vérifié.",
  },
  {
    icon: FileCheck,
    title: 'Justificatifs obligatoires',
    text: "Factures, photos ou videos remontent jusqu'a l'espace du bailleur. Tant que la dépense n'est pas justifiée, elle reste ouverte.",
  },
  {
    icon: Lock,
    title: 'Protection de l’enfant',
    text: "Consentement photo obligatoire, aucun contact direct entre un bailleur et un enfant, localisation précise masquée en zone à risque, nom de famille jamais public, filtrage automatique des publications.",
  },
];

const CIRCUIT = [
  'Vous payez sur une page web sécurisée (mobile money, carte, PayPal ou virement).',
  'Le montant arrive sur le compte central RISAC et entre au registre interne.',
  'Il est affecté a un enfant, a un projet ou au fonds général.',
  'La structure demande un décaissement en precisant le montant et le motif.',
  "L'ambassadeur de l'enfant confirme que le besoin est réel.",
  "L'Admin Finance approuve et paie sur le compte vérifié de la structure.",
  'La structure téléversé les justificatifs.',
  'Vous voyez la preuve de la dépense dans votre espace.',
];

export default function TransparencyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950 sm:text-3xl">
        Transparence des fonds
      </h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-ink-600">
        Chaque franc verse est trace jusqu&apos;a sa preuve de depense. Aucune personne ne saisit, ne
        recoit et ne dépense seule.
      </p>

      <section className="mt-10 grid gap-5 sm:grid-cols-2">
        {GARANTIES.map((g) => (
          <div key={g.title} className="card card-pad">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-risac-50 text-risac-600">
              <g.icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <h2 className="mt-4 text-base font-semibold text-ink-900">{g.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{g.text}</p>
          </div>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight text-ink-950">Le circuit, étape par étape</h2>
        <ol className="mt-6 space-y-3">
          {CIRCUIT.map((step, i) => (
            <li key={i} className="flex gap-4 rounded-xl bg-ink-50 px-4 py-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-risac-600 text-xs font-semibold text-white">
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed text-ink-700">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 card card-pad">
        <h2 className="section-title">Frais de fonctionnement</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Les frais prélevés sur chaque don sont affiches avant le paiement, dans le detail du
          montant. Vous voyez votre versement, les frais et le montant reellement affecte.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          Si un projet est annule, vous choisissez entre le remboursement et la reaffectation au
          fonds général. Vous pouvez retirer votre contribution tant que la collecte est ouverte.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/projets-ouverts" className="btn-primary">
            Voir les projets
          </Link>
          <Link href="/don-fonds-general" className="btn-outline">
            Soutenir le fonds général
          </Link>
        </div>
      </section>
    </div>
  );
}

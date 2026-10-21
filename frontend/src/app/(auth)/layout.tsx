import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <main className="flex w-full flex-col justify-center px-4 py-10 sm:px-8 lg:w-[46%] lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="inline-block" aria-label="RISAC, retour à l’accueil">
            <Logo className="h-24 sm:h-28" />
          </Link>
          <div className="mt-10">{children}</div>
        </div>
      </main>

      <aside aria-label="Mission de RISAC" className="brand-band relative hidden flex-1 overflow-hidden lg:block">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-risac-300/20 blur-3xl"
        />

        <div className="relative flex h-full flex-col justify-end p-14 text-white">
          <blockquote className="max-w-lg">
            <p className="text-2xl font-semibold leading-snug">
              B&acirc;tir un &eacute;cosyst&egrave;me d&apos;excellence, de r&eacute;silience, de
              r&eacute;paration et d&apos;inclusion pour l&apos;enfance vuln&eacute;rable en
              R&eacute;publique D&eacute;mocratique du Congo.
            </p>
            <footer className="mt-5 text-sm text-risac-100">
              Ma&icirc;tre Ndondo Bonkendju Albert, Coordonnateur du RISAC
            </footer>
          </blockquote>

          <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-white/20 pt-8">
            <div>
              <dt className="text-xs font-medium text-risac-200">Structures visées</dt>
              <dd className="mt-1 text-xl font-semibold">150</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-risac-200">Provinces</dt>
              <dd className="mt-1 text-xl font-semibold">26</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-risac-200">R&ocirc;les</dt>
              <dd className="mt-1 text-xl font-semibold">12</dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}

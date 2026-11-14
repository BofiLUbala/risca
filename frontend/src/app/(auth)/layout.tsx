import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

/**
 * Pages d'accès (connexion, administrateur, inscription, activation).
 * Une seule carte, centrée à l'écran, le logo centré en tête de carte : pas de panneau latéral,
 * pour aller droit au formulaire, sur grand écran comme sur téléphone.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-ground relative flex min-h-dvh flex-col px-4 py-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <Link href="/" className="link-action -ml-1 px-1">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour à l&apos;accueil
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex flex-1 items-center justify-center py-4 sm:py-6">
        <div className="w-full max-w-[420px] animate-fade-up">
          <div className="card border-t-4 border-t-sun-400 p-6 shadow-lift sm:p-7">
            <Link
              href="/"
              aria-label="RISAC, retour à l’accueil"
              className="mx-auto mb-5 block w-fit rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun-200"
            >
              <Logo className="h-14" />
            </Link>
            {children}
          </div>
          <p className="mt-4 text-balance text-center text-xs text-ink-500">
            Réseau International des Structures d&apos;Accueil du Congo
          </p>
        </div>
      </div>
    </main>
  );
}

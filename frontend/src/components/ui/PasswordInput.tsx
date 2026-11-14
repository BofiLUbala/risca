'use client';

import { forwardRef, InputHTMLAttributes, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';

/**
 * Champ de mot de passe avec un œil pour afficher ou masquer ce qui est tapé.
 * Il se comporte comme un <input> ordinaire (mêmes propriétés), sauf `type`, géré ici.
 */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  function PasswordInput({ className, ...props }, ref) {
    const [shown, setShown] = useState(false);
    return (
      <div className="relative">
        <input
          ref={ref}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          {...props}
          type={shown ? 'text' : 'password'}
          className={clsx(className, 'pr-12')}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={shown}
          className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-xl text-ink-500 transition-colors duration-base hover:text-ink-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun-200 motion-reduce:transition-none"
        >
          {shown ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    );
  },
);

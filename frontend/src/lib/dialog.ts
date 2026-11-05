'use client';

/**
 * Boîtes de dialogue à la place de window.prompt / window.confirm.
 * Les boîtes natives sont bloquées ou absentes dans les navigateurs intégrés,
 * les applications web installées et plusieurs navigateurs mobiles : une action
 * critique (refus de décaissement, gel de compte, modération) devenait impossible.
 */

interface Options {
  /** Texte saisi au départ (prompt uniquement). */
  defaultValue?: string;
  confirmLabel?: string;
}

function open(message: string, kind: 'prompt' | 'confirm', opts: Options): Promise<string | boolean | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(kind === 'prompt' ? null : false);

    const previous = document.activeElement as HTMLElement | null;
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/40 p-4';

    const box = document.createElement('div');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', message);
    box.className = 'w-full max-w-md rounded-2xl bg-white p-5 shadow-lift';

    const text = document.createElement('p');
    text.className = 'text-sm font-medium text-ink-900 whitespace-pre-line';
    text.textContent = message;
    box.appendChild(text);

    let input: HTMLInputElement | null = null;
    if (kind === 'prompt') {
      input = document.createElement('input');
      input.type = 'text';
      input.value = opts.defaultValue ?? '';
      input.className = 'input mt-3 w-full';
      box.appendChild(input);
    }

    const actions = document.createElement('div');
    actions.className = 'mt-4 flex justify-end gap-2';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn-outline';
    cancel.textContent = 'Annuler';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'btn-primary';
    ok.textContent = opts.confirmLabel ?? 'Valider';
    actions.append(cancel, ok);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const finish = (value: string | boolean | null) => {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      previous?.focus?.();
      resolve(value);
    };
    const accept = () => finish(kind === 'prompt' ? (input?.value ?? '') : true);
    const reject = () => finish(kind === 'prompt' ? null : false);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        reject();
      } else if (e.key === 'Enter' && (kind === 'prompt' || document.activeElement === ok)) {
        e.preventDefault();
        accept();
      }
    }

    ok.addEventListener('click', accept);
    cancel.addEventListener('click', reject);
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) reject();
    });
    document.addEventListener('keydown', onKey, true);
    (input ?? ok).focus();
    input?.select();
  });
}

/** Équivalent de window.prompt : renvoie le texte saisi, ou null si l'utilisateur annule. */
export async function promptDialog(message: string, defaultValue?: string): Promise<string | null> {
  return (await open(message, 'prompt', { defaultValue })) as string | null;
}

/** Équivalent de window.confirm : renvoie true si l'utilisateur confirme. */
export async function confirmDialog(message: string): Promise<boolean> {
  return (await open(message, 'confirm', {})) === true;
}

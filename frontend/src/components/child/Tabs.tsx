'use client';

import clsx from 'clsx';

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-1 border-b border-ink-200" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            onClick={() => onChange(t.key)}
            className={clsx(
              'relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors',
              active === t.key
                ? 'text-risac-700'
                : 'text-ink-500 hover:text-ink-800',
            )}
          >
            {t.label}
            {t.count != null && (
              <span className="ml-1.5 rounded-full bg-ink-100 px-1.5 py-0.5 text-xs text-ink-600">
                {t.count}
              </span>
            )}
            {active === t.key && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-risac-600" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="border-b border-ink-100 py-2.5 last:border-0">
      <dt className="text-xs font-medium text-ink-500">{label}</dt>
      <dd className="mt-1 text-sm text-ink-800">{value ?? <span className="text-ink-300">—</span>}</dd>
    </div>
  );
}

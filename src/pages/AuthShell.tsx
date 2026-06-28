import type { ReactNode } from 'react';

/** Centered card layout shared by the login + sign-up pages. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <a href="/" className="mb-6 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-extrabold text-white">
          C
        </span>
        <span className="text-xl font-extrabold tracking-tight text-slate-900">
          COAT<span className="text-brand-600">PRO</span>
        </span>
      </a>

      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

/** Shown on auth pages when Supabase env vars are missing. */
export function AuthSetupNotice() {
  return (
    <AuthShell title="Finish your setup" subtitle="Supabase isn't configured">
      <p className="text-sm text-slate-700">
        Set <code className="rounded bg-slate-100 px-1.5 py-0.5">VITE_SUPABASE_URL</code> and{' '}
        <code className="rounded bg-slate-100 px-1.5 py-0.5">VITE_SUPABASE_ANON_KEY</code> in your{' '}
        <code className="rounded bg-slate-100 px-1.5 py-0.5">.env</code>, run{' '}
        <code className="rounded bg-slate-100 px-1.5 py-0.5">supabase/full_schema.sql</code>, then
        restart the dev server.
      </p>
    </AuthShell>
  );
}

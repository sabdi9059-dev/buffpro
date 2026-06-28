import { useEffect, type ReactNode } from 'react';
import { useAuth, type UserRole } from './AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  /** If set, the user's role must be included or they see an access-denied screen. */
  roles?: UserRole[];
  /** Where to send unauthenticated users (default: /login). */
  redirectTo?: string;
}

/**
 * Gate a route behind authentication (and optionally a role).
 *  - While the session is being checked → full-page spinner.
 *  - Not signed in → redirect to /login.
 *  - Signed in but wrong role → access-denied message.
 */
export function ProtectedRoute({
  children,
  roles,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const { user, role, isLoading } = useAuth();

  // Redirect once we know there's no user. Full reload is fine for this
  // lightweight router; swap for your router's navigate() if you add one.
  useEffect(() => {
    if (!isLoading && !user) {
      const next = encodeURIComponent(window.location.pathname);
      window.location.assign(`${redirectTo}?next=${next}`);
    }
  }, [isLoading, user, redirectTo]);

  if (isLoading || !user) {
    return <FullPageSpinner label={isLoading ? 'Checking your session…' : 'Redirecting…'} />;
  }

  if (roles && role && !roles.includes(role)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Access denied</h2>
          <p className="mt-1 text-sm text-slate-600">
            Your role ({role}) doesn&apos;t have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-slate-500">
      <svg className="h-8 w-8 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      <p>{label}</p>
    </div>
  );
}

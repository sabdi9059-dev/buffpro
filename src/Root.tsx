import App from './App';
import { AdminApp } from './components/admin/AdminApp';

/**
 * Tiny top-level router.
 *
 * The app intentionally avoids a routing library for now (the booking page
 * already derives its business from the URL path). We only need to split two
 * surfaces:
 *   - `/admin` (or `/dashboard`) → the owner dashboard
 *   - anything else            → the public customer booking page
 *
 * Swapping this for React Router later is a drop-in change.
 */
function isAdminPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '').toLowerCase();
  return (
    path === '/admin' ||
    path === '/dashboard' ||
    path.startsWith('/admin/') ||
    path.startsWith('/dashboard/')
  );
}

export default function Root() {
  return isAdminPath(window.location.pathname) ? <AdminApp /> : <App />;
}

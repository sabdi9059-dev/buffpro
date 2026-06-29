import App from './App';
import { AdminApp } from './components/admin/AdminApp';
import { TechApp } from './components/tech/TechApp';

/**
 * Tiny top-level router.
 *
 * The app intentionally avoids a routing library for now (the booking page
 * already derives its business from the URL path). We split three surfaces:
 *   - `/admin` (or `/dashboard`)    → the owner dashboard
 *   - `/tech` (or `/technician`)    → the technician dashboard
 *   - anything else                 → the public customer booking page
 *
 * Swapping this for React Router later is a drop-in change.
 */
function matchesPath(pathname: string, roots: string[]): boolean {
  const path = pathname.replace(/\/+$/, '').toLowerCase();
  return roots.some((r) => path === r || path.startsWith(`${r}/`));
}

export default function Root() {
  const { pathname } = window.location;
  if (matchesPath(pathname, ['/admin', '/dashboard'])) return <AdminApp />;
  if (matchesPath(pathname, ['/tech', '/technician'])) return <TechApp />;
  return <App />;
}

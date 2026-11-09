import { lazy, Suspense, useEffect } from 'react';
import { AboutDialog } from './components/dialogs/AboutDialog.tsx';
import { SettingsDialog } from './components/dialogs/SettingsDialog.tsx';
import { MobileNav, TopBar } from './components/navigation/TopBar.tsx';
import { Spinner } from './components/ui/index.tsx';
import { DataProvider, useData } from './hooks/useData.tsx';
import { ArcPage } from './pages/ArcPage.tsx';
import { actions, appStore, useApp } from './state/appState.ts';
import { buildHash, parseHash, resolveReference } from './state/url.ts';

const ExplorePage = lazy(() => import('./pages/ExplorePage.tsx'));
const NetworkPage = lazy(() => import('./pages/NetworkPage.tsx'));
const InsightsPage = lazy(() => import('./pages/InsightsPage.tsx'));
const ExportDialog = lazy(() => import('./components/dialogs/ExportDialog.tsx'));

let pendingReference: string | null = null;

/** Applies the URL hash to the store (initial load and back/forward). */
function applyHash() {
  const u = parseHash(window.location.hash);
  pendingReference = u.pendingReference ?? null;
  appStore.set({
    route: u.route,
    filters: u.filters,
    ...(u.selection !== undefined ? { selection: u.selection } : {}),
    ...(u.selection || u.pendingReference ? { panelOpen: true } : {}),
  });
}

function UrlSync() {
  const { cols } = useData();
  const route = useApp((s) => s.route);
  const selection = useApp((s) => s.selection);
  const filters = useApp((s) => s.filters);

  useEffect(() => {
    const onHash = () => applyHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Resolve a reference selection from the URL once data is loaded.
  useEffect(() => {
    if (cols && pendingReference) {
      const i = resolveReference(pendingReference, cols);
      pendingReference = null;
      if (i >= 0) actions.selectReference(i);
    }
  }, [cols]);

  useEffect(() => {
    if (pendingReference) return;
    const next = buildHash(route, selection, filters, cols);
    if (next !== window.location.hash && !(next === '#/arc' && window.location.hash === '')) {
      const cur = parseHash(window.location.hash);
      // New history entries for navigation (route / selection); replace for filter tweaks.
      const sameNav = cur.route === route && buildHash(route, selection, cur.filters, cols) === buildHash(cur.route, cur.selection ?? null, cur.filters, cols);
      if (sameNav) history.replaceState(null, '', next);
      else history.pushState(null, '', next);
    }
  }, [route, selection, filters, cols]);
  return null;
}

function Page() {
  const route = useApp((s) => s.route);
  const fallback = (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  );
  return (
    <Suspense fallback={fallback}>
      {route === 'arc' && <ArcPage />}
      {route === 'explore' && <ExplorePage />}
      {route === 'network' && <NetworkPage />}
      {route === 'insights' && <InsightsPage />}
    </Suspense>
  );
}

export function App() {
  const lang = useApp((s) => s.lang);
  const dialog = useApp((s) => s.dialog);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return (
    <DataProvider>
      <UrlSync />
      <div className="flex h-[100dvh] flex-col overflow-hidden">
        <TopBar />
        <main className="relative min-h-0 flex-1">
          <Page />
        </main>
        <MobileNav />
      </div>
      <SettingsDialog />
      <AboutDialog />
      {dialog === 'export' && (
        <Suspense fallback={null}>
          <ExportDialog />
        </Suspense>
      )}
    </DataProvider>
  );
}

export { applyHash };

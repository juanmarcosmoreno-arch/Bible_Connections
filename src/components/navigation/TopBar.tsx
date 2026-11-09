import { useState } from 'react';
import { useT, type StringKey } from '../../i18n/index.ts';
import { actions, useApp, type Route } from '../../state/appState.ts';
import { SearchBox } from '../search/SearchBox.tsx';
import { Icon, IconButton } from '../ui/index.tsx';
import { Logo } from './Logo.tsx';

export const NAV: { route: Route; key: StringKey; icon: string }[] = [
  { route: 'arc', key: 'nav.arc', icon: 'arc' },
  { route: 'explore', key: 'nav.explore', icon: 'book' },
  { route: 'network', key: 'nav.network', icon: 'network' },
  { route: 'insights', key: 'nav.insights', icon: 'chart' },
];

export function TopBar() {
  const t = useT();
  const route = useApp((s) => s.route);
  const theme = useApp((s) => s.theme);
  const lang = useApp((s) => s.lang);
  const [mobileSearch, setMobileSearch] = useState(false);

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-bg/80 px-3 backdrop-blur sm:px-4">
      <a href="#/arc" className="flex shrink-0 items-center gap-2 text-fg" onClick={() => actions.setRoute('arc')} aria-label={t('appName')}>
        <Logo size={30} />
        <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">{t('appName')}</span>
      </a>

      <nav className="mx-auto hidden items-center gap-1 rounded-xl border border-line bg-panel/60 p-1 md:flex" aria-label="Main">
        {NAV.map((n) => (
          <a
            key={n.route}
            href={`#/${n.route}`}
            aria-current={route === n.route ? 'page' : undefined}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium tracking-wide transition ${route === n.route ? 'bg-panel-2 text-fg' : 'text-muted hover:text-fg'}`}
            data-testid={`nav-${n.route}`}
          >
            {t(n.key).toUpperCase()}
          </a>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <SearchBox className="hidden w-64 lg:block xl:w-72" />
        <IconButton label={t('action.search')} className="lg:hidden" onClick={() => setMobileSearch((v) => !v)} data-testid="search-toggle">
          <Icon name="search" />
        </IconButton>
        <button
          type="button"
          onClick={() => actions.setLang(lang === 'en' ? 'es' : 'en')}
          className="h-9 rounded-lg px-2 text-xs font-semibold tracking-wider text-muted hover:bg-panel-2 hover:text-fg"
          aria-label={lang === 'en' ? 'Cambiar a español' : 'Switch to English'}
          title={lang === 'en' ? 'Español' : 'English'}
          data-testid="lang-toggle"
        >
          {lang === 'en' ? 'ES' : 'EN'}
        </button>
        <IconButton label={t('action.settings')} onClick={() => actions.openDialog('settings')} data-testid="open-settings">
          <Icon name="settings" />
        </IconButton>
        <IconButton label={t('action.theme')} onClick={actions.toggleTheme} data-testid="theme-toggle">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </IconButton>
        <IconButton label={t('action.about')} onClick={() => actions.openDialog('about')} data-testid="open-about">
          <Icon name="info" />
        </IconButton>
      </div>

      {mobileSearch && (
        <div className="absolute left-0 right-0 top-14 border-b border-line bg-panel p-3 lg:hidden">
          <SearchBox autoFocus onDone={() => setMobileSearch(false)} />
        </div>
      )}
    </header>
  );
}

/** Bottom tab bar for small screens. */
export function MobileNav() {
  const t = useT();
  const route = useApp((s) => s.route);
  return (
    <nav className="z-30 grid shrink-0 grid-cols-4 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Main">
      {NAV.map((n) => (
        <a
          key={n.route}
          href={`#/${n.route}`}
          aria-current={route === n.route ? 'page' : undefined}
          className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${route === n.route ? 'text-fg' : 'text-muted'}`}
        >
          <Icon name={n.icon} size={20} />
          {t(n.key)}
        </a>
      ))}
    </nav>
  );
}

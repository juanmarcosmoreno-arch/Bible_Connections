import { useEffect, useState } from 'react';
import { loadManifest, type Manifest } from '../../data/loader.ts';
import { useTranslations } from '../../hooks/useText.ts';
import { formatNumber, useT } from '../../i18n/index.ts';
import { actions, useApp } from '../../state/appState.ts';
import { Logo } from '../navigation/Logo.tsx';
import { Icon, Modal } from '../ui/index.tsx';
import { OFFLINE } from '../../data/offline.ts';

export function AboutDialog() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const open = useApp((s) => s.dialog === 'about');
  const translations = useTranslations();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  useEffect(() => {
    if (open) loadManifest().then(setManifest).catch(() => {});
  }, [open]);
  const H = ({ children }: { children: string }) => <h3 className="mb-1 mt-5 text-[11px] font-semibold uppercase tracking-wider text-muted">{children}</h3>;
  return (
    <Modal open={open} onClose={actions.closeDialog} title={t('about.title')} wide>
      <div className="text-sm leading-relaxed text-fg/90" data-testid="about-dialog">
        <div className="mb-3 flex items-center gap-3">
          <Logo size={44} />
          <div>
            <div className="text-lg font-semibold tracking-tight">{t('appName')}</div>
            <div className="text-xs text-muted">{t('subtitle')}</div>
          </div>
        </div>
        <p>{t('about.body')}</p>
        {!OFFLINE && (
          <a
            href={`${import.meta.env.BASE_URL}bible-connections.html`}
            download="bible-connections.html"
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:bg-panel-2"
            data-testid="offline-download"
          >
            <Icon name="download" size={16} /> {t('about.offline')}
          </a>
        )}
        {!OFFLINE && <p className="mt-1 text-xs text-muted">{t('about.offlineHelp')}</p>}
        <H>{t('about.data')}</H>
        <p>
          {t('about.dataBody')}{' '}
          <a className="text-accent hover:underline" href="https://www.openbible.info/labs/cross-references/" target="_blank" rel="noreferrer">
            openbible.info/labs/cross-references
          </a>{' '}
          ·{' '}
          <a className="text-accent hover:underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
        </p>
        {manifest && (
          <p className="mt-1 text-xs text-muted">
            {formatNumber(manifest.references.count, lang)} {t('unit.references')} · {manifest.source.header.split('#')[1] ?? ''} · SHA-256 {manifest.source.sha256.slice(0, 12)}…
          </p>
        )}
        <H>{t('about.sources')}</H>
        <p>
          {t('about.sourcesBody')}{' '}
          <a className="text-accent hover:underline" href="https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=TSK" target="_blank" rel="noreferrer">
            CrossWire TSK
          </a>
        </p>
        <H>{t('network.mode.names')}</H>
        <p>
          {t('names.source')}{' '}
          <a className="text-accent hover:underline" href="https://github.com/STEPBible/STEPBible-Data" target="_blank" rel="noreferrer">
            STEPBible-Data
          </a>
        </p>
        <H>{t('about.texts')}</H>
        <ul className="space-y-2">
          {translations.map((tr) => (
            <li key={tr.code}>
              <span className="font-medium">{tr.name}</span> ({tr.code}) — {tr.license}.{' '}
              <span className="text-muted">{tr.licenseNote}</span>{' '}
              <a className="text-accent hover:underline" href={tr.sourceUrl} target="_blank" rel="noreferrer">
                {tr.source}
              </a>
            </li>
          ))}
        </ul>
        <H>{t('about.versification')}</H>
        <p>{t('about.versificationBody')}</p>
        <H>{t('about.inspiration')}</H>
        <p>
          {t('about.inspirationBody')}{' '}
          <a className="text-accent hover:underline" href="https://www.chrisharrison.net/index.php/Visualizations/BibleViz" target="_blank" rel="noreferrer">
            chrisharrison.net
          </a>
        </p>
        <H>{t('about.limitations')}</H>
        <p>{t('about.limitationsBody')}</p>
        <H>{t('about.code')}</H>
        <p>
          {t('about.codeBody')}{' '}
          <a className="text-accent hover:underline" href="https://github.com/juanmarcosmoreno-arch/Bible_Connections" target="_blank" rel="noreferrer">
            github.com/juanmarcosmoreno-arch/Bible_Connections
          </a>
        </p>
      </div>
    </Modal>
  );
}

import { useTranslations } from '../../hooks/useText.ts';
import { useT } from '../../i18n/index.ts';
import { actions, useApp } from '../../state/appState.ts';
import { Field, Modal, Segmented, Toggle } from '../ui/index.tsx';

export function SettingsDialog() {
  const t = useT();
  const open = useApp((s) => s.dialog === 'settings');
  const lang = useApp((s) => s.lang);
  const theme = useApp((s) => s.theme);
  const translation = useApp((s) => s.translation);
  const settings = useApp((s) => s.settings);
  const translations = useTranslations();
  return (
    <Modal open={open} onClose={actions.closeDialog} title={t('settings.title')}>
      <div className="space-y-5" data-testid="settings-dialog">
        <Field label={t('settings.language')}>
          <Segmented value={lang} onChange={actions.setLang} label={t('settings.language')} options={[{ value: 'en', label: t('misc.language.en') }, { value: 'es', label: t('misc.language.es') }]} />
        </Field>
        <Field label={t('settings.translation')}>
          <select
            value={translation}
            onChange={(e) => actions.setTranslation(e.target.value)}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
            data-testid="translation-select"
          >
            <option value="auto">{t('settings.translation.auto')}</option>
            {translations.map((tr) => (
              <option key={tr.code} value={tr.code}>
                {tr.name} ({tr.language.toUpperCase()}) — {tr.license}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('settings.theme')}>
          <Segmented value={theme} onChange={(v) => v !== theme && actions.toggleTheme()} label={t('settings.theme')} options={[{ value: 'dark', label: t('settings.theme.dark') }, { value: 'light', label: t('settings.theme.light') }]} />
        </Field>
        <Field label={t('settings.anchor')} hint={t('settings.anchorHelp')}>
          <Segmented
            value={settings.anchor}
            onChange={(anchor) => actions.setSettings({ anchor })}
            label={t('settings.anchor')}
            options={(['start', 'center', 'end'] as const).map((v) => ({ value: v, label: t(`settings.anchor.${v}`) }))}
          />
        </Field>
        <Field label={`${t('settings.opacity')} · ${settings.arcOpacity.toFixed(2)}×`}>
          <input type="range" min={0.25} max={3} step={0.05} value={settings.arcOpacity} onChange={(e) => actions.setSettings({ arcOpacity: Number(e.target.value) })} className="w-full" aria-label={t('settings.opacity')} />
        </Field>
        <Field label={`${t('settings.width')} · ${settings.arcWidth.toFixed(1)} px`}>
          <input type="range" min={0.5} max={2.5} step={0.1} value={settings.arcWidth} onChange={(e) => actions.setSettings({ arcWidth: Number(e.target.value) })} className="w-full" aria-label={t('settings.width')} />
        </Field>
        <Field label={t('settings.bars')}>
          <Segmented value={settings.bars} onChange={(bars) => actions.setSettings({ bars })} label={t('settings.bars')} options={[{ value: 'verses', label: t('settings.bars.verses') }, { value: 'refs', label: t('settings.bars.refs') }]} />
        </Field>
        <Toggle checked={settings.lod} onChange={(lod) => actions.setSettings({ lod })} label={t('settings.lod')} />
      </div>
    </Modal>
  );
}

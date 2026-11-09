import { Fragment } from 'react';
import { VERSE_NUMBER, formatRange } from '../../data/bibleStructure.ts';
import type { VerseText } from '../../data/textProvider.ts';
import { useVerseTexts } from '../../hooks/useText.ts';
import { useT } from '../../i18n/index.ts';
import { useApp } from '../../state/appState.ts';
import { Spinner } from '../ui/index.tsx';

/** Renders "[supplied]" words in italics, as printed in the source editions. */
export function VerseString({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]*\])/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('[') && p.endsWith(']') ? (
          <span key={i} className="supplied">
            {p.slice(1, -1)}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export function VerseNoteLine({ v }: { v: VerseText }) {
  const t = useT();
  if (!v.note) return null;
  const n = v.note;
  const msg =
    n.kind === 'empty'
      ? t('panel.noTextHere')
      : n.kind === 'remapped'
        ? t('panel.remapped', { from: n.from })
        : n.kind === 'shared'
          ? t('panel.shared', { from: n.from, a: n.covers[0], b: n.covers[1] })
          : t('panel.versification', { from: n.from });
  return <span className="mt-0.5 block text-[11px] leading-snug text-muted">{msg}</span>;
}

/** Text of a passage in the active translation (with verse numbers when it spans several verses). */
export function PassageText({ start, end, compact = false, maxVerses }: { start: number; end: number; compact?: boolean; maxVerses?: number }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const shownEnd = maxVerses ? Math.min(end, start + maxVerses - 1) : end;
  const { status, verses, code } = useVerseTexts(start, shownEnd);
  if (status === 'loading' || status === 'idle')
    return (
      <div className="flex items-center gap-2 py-1 text-xs text-muted">
        <Spinner /> {t('loading.text')}
      </div>
    );
  if (status === 'error') return <p className="text-xs text-muted">{t('panel.textUnavailable')}</p>;
  const multi = verses.length > 1;
  return (
    <div className={compact ? 'text-[13px] leading-relaxed text-fg/85' : 'font-serif text-[15px] leading-relaxed text-fg/90'} lang={code === 'RV1909' ? 'es' : 'en'}>
      {verses.map((v) => (
        <p key={v.verse} className={multi ? 'mb-1' : ''}>
          {multi && <sup className="mr-1 font-sans text-[10px] font-semibold text-muted">{VERSE_NUMBER[v.verse]}</sup>}
          {v.text ? <VerseString text={v.text} /> : <span className="italic text-muted">—</span>}
          <VerseNoteLine v={v} />
        </p>
      ))}
      {shownEnd < end && (
        <p className="mt-1 text-xs text-muted">
          … {formatRange(shownEnd + 1, end, lang)}
        </p>
      )}
      <p className="mt-1.5 font-sans text-[10px] uppercase tracking-wider text-muted/70">{code}</p>
    </div>
  );
}

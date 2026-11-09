import { ORIGIN } from '../data/sources.ts';
import { useT } from '../i18n/index.ts';

/** Full provenance label for a reference. */
export function useSourceLabel() {
  const t = useT();
  return (origin: number) => t(origin === ORIGIN.TSK ? 'source.tsk' : origin === ORIGIN.TSK_REVERSE ? 'source.tsk-reverse' : 'source.openbible');
}

/** Compact provenance tag ("TSK" / "OB") with the full label as tooltip. */
export function SourceTag({ origin }: { origin: number }) {
  const t = useT();
  const label = useSourceLabel()(origin);
  const tsk = origin !== ORIGIN.OPENBIBLE;
  return (
    <span
      className={`shrink-0 rounded px-1 text-[9px] font-semibold tracking-wider ${tsk ? 'text-muted ring-1 ring-line' : 'bg-accent/15 text-accent'}`}
      title={label}
      aria-label={label}
    >
      {t(tsk ? 'source.short.tsk' : 'source.short.openbible')}
    </span>
  );
}

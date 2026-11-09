/** Small, dependency-free UI primitives. */
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export function IconButton({ label, children, active, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-fg disabled:opacity-40 ${active ? 'bg-panel-2 text-fg' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Button({ children, variant = 'ghost', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'ghost' | 'solid' | 'outline' }) {
  const styles = {
    ghost: 'text-muted hover:text-fg hover:bg-panel-2',
    solid: 'bg-accent text-accent-fg hover:brightness-110',
    outline: 'border border-line text-fg hover:bg-panel-2',
  }[variant];
  return (
    <button type="button" className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-40 ${styles} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label, size = 'sm' }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string; size?: 'sm' | 'xs' }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-full rounded-lg border border-line bg-bg/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 whitespace-nowrap rounded-md px-2 ${size === 'xs' ? 'py-0.5 text-[11px]' : 'py-1 text-xs'} font-medium transition ${value === o.value ? 'bg-panel-2 text-fg shadow-sm' : 'text-muted hover:text-fg'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-sm">
      <span className="text-fg/90">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-line'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent ${className}`} aria-hidden />;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`scroll-thin max-h-[88vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-panel shadow-[var(--shadow)] outline-none sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel/95 px-5 py-3 backdrop-blur">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <Icon name="close" />
          </IconButton>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

const PATHS: Record<string, string> = {
  search: 'M11 4a7 7 0 1 0 4.9 12l4.6 4.6 1.4-1.4-4.6-4.6A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z',
  settings: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.4 4.6.1-1.1-.1-1.1 2-1.6-2-3.4-2.4 1a8 8 0 0 0-1.9-1.1L15.7 3h-4l-.4 2.8c-.7.3-1.3.6-1.9 1.1l-2.4-1-2 3.4 2 1.6-.1 1.1.1 1.1-2 1.6 2 3.4 2.4-1c.6.5 1.2.8 1.9 1.1l.4 2.8h4l.4-2.8c.7-.3 1.3-.6 1.9-1.1l2.4 1 2-3.4-2-1.6Z',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0-5 1 3h-2l1-3Zm0 20-1-3h2l-1 3ZM2 12l3-1v2l-3-1Zm20 0-3 1v-2l3 1ZM4.9 4.9l2.8 1.4-1.4 1.4-1.4-2.8Zm14.2 14.2-2.8-1.4 1.4-1.4 1.4 2.8ZM4.9 19.1l1.4-2.8 1.4 1.4-2.8 1.4ZM19.1 4.9l-1.4 2.8-1.4-1.4 2.8-1.4Z',
  moon: 'M20 15.3A8.5 8.5 0 0 1 8.7 4 8.5 8.5 0 1 0 20 15.3Z',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z',
  close: 'M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6 6.4 5Z',
  filter: 'M3 5h18v2l-7 7v5l-4 2v-7L3 7V5Z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z',
  minus: 'M5 11h14v2H5z',
  expand: 'M4 4h6v2H6v4H4V4Zm10 0h6v6h-2V6h-4V4ZM4 14h2v4h4v2H4v-6Zm14 0h2v6h-6v-2h4v-4Z',
  download: 'M11 4h2v8.2l3.3-3.3 1.4 1.4L12 16 6.3 10.3l1.4-1.4 3.3 3.3V4ZM5 18h14v2H5v-2Z',
  panel: 'M3 4h18v16H3V4Zm2 2v12h9V6H5Zm11 0v12h3V6h-3Z',
  left: 'M15.4 6.4 14 5l-7 7 7 7 1.4-1.4L9.8 12l5.6-5.6Z',
  right: 'M8.6 6.4 10 5l7 7-7 7-1.4-1.4 5.6-5.6-5.6-5.6Z',
  up: 'M6.4 15.4 5 14l7-7 7 7-1.4 1.4L12 9.8l-5.6 5.6Z',
  down: 'M6.4 8.6 5 10l7 7 7-7-1.4-1.4L12 14.2 6.4 8.6Z',
  arrow: 'M4 11h12.2l-5.6-5.6L12 4l8 8-8 8-1.4-1.4 5.6-5.6H4v-2Z',
  menu: 'M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z',
  book: 'M5 4h9a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H5V4Zm2 2v9h8a5 5 0 0 1 1 .1V8a2 2 0 0 0-2-2H7Z',
  network: 'M6 4a3 3 0 1 1-1 5.8V14a3 3 0 1 1-2 0V9.8A3 3 0 0 1 6 4Zm12 6a3 3 0 1 1-2.8 4H9v-2h6.2A3 3 0 0 1 18 10Z',
  arc: 'M2 18h20v2H2v-2Zm2-1a8 8 0 0 1 16 0h-2a6 6 0 0 0-12 0H4Zm4 0a4 4 0 0 1 8 0h-2a2 2 0 0 0-4 0H8Z',
  chart: 'M4 20V10h3v10H4Zm6.5 0V4h3v16h-3ZM17 20v-7h3v7h-3Z',
};

export function Icon({ name, size = 18, className = '' }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}

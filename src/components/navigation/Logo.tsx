/** Bible Connections logo: thin arcs linking points on a horizontal line (same as icons/logo.svg). */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <defs>
        <linearGradient id="bc-logo-g" x1="6" y1="0" x2="58" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="0.35" stopColor="#22b8cf" />
          <stop offset="0.65" stopColor="#f5d547" />
          <stop offset="1" stopColor="#ef4444" />
        </linearGradient>
      </defs>
      <g stroke="url(#bc-logo-g)" strokeLinecap="round" strokeWidth="2.6">
        <path d="M8 46 A24 24 0 0 1 56 46" />
        <path d="M8 46 A13 13 0 0 1 34 46" />
        <path d="M24 46 A10 10 0 0 1 44 46" />
        <path d="M34 46 A11 11 0 0 1 56 46" />
        <path d="M16 46 A4 4 0 0 1 24 46" />
      </g>
      <path d="M5 46 H59" stroke="currentColor" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
      <g fill="currentColor">
        <circle cx="8" cy="46" r="2.4" />
        <circle cx="16" cy="46" r="1.7" />
        <circle cx="24" cy="46" r="2.1" />
        <circle cx="34" cy="46" r="2.4" />
        <circle cx="44" cy="46" r="1.7" />
        <circle cx="56" cy="46" r="2.4" />
      </g>
    </svg>
  );
}

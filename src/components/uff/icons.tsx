// UFF icon set used by the onboarding flow and dashboards.
// Single source of truth — every screen imports from here so SVG paths
// stay in lock-step with the design canvas.

type IconProps = { size?: number };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

// Generic / utility icons (Icon.* in the prototype)
export const Icon = {
  bolt: ({ size = 12 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z" />
    </svg>
  ),
  pin: ({ size = 12 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}>
      <path d="M12 21s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  check: ({ size = 16 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={3.4}>
      <path d="M4 12l5 5L20 6" />
    </svg>
  ),
  arrowRight: ({ size = 14 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={2.4}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  arrowLeft: ({ size = 14 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={2.4}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  ),
  plus: ({ size = 14 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={2.4}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  chevR: ({ size = 13 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={2.2}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  bell: ({ size = 18 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  ),
  search: ({ size = 14 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={2}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  ),
  more: ({ size = 14 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  ),
  panelLeft: ({ size = 16 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9 4v16" />
    </svg>
  ),
};

// Onboarding-specific icons (OnbIcon.* in the prototype)
export const OnbIcon = {
  team: ({ size = 22 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={2}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 14.5c2.6.4 4.5 2.5 4.5 5" />
    </svg>
  ),
  league: ({ size = 22 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={2}>
      <rect x="3" y="11" width="5" height="9" rx="1" />
      <rect x="9.5" y="6" width="5" height="14" rx="1" />
      <rect x="16" y="13" width="5" height="7" rx="1" />
      <path d="M2 20h20" />
    </svg>
  ),
  coach: ({ size = 22 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.9}>
      <circle cx="9" cy="13" r="6" />
      <path d="M14 11l8-3-1 3-7 2M9 7V4M11 4h-4" />
    </svg>
  ),
  captain: ({ size = 22 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.9}>
      <path d="M12 2l2.4 6.2L21 9l-5 4.3 1.5 6.7L12 16.7 6.5 20 8 13.3 3 9l6.6-.8L12 2z" />
    </svg>
  ),
};

// Dashboard icons (DashIcon.* + WIcon.* unified)
export const DashIcon = {
  home: ({ size = 18 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}>
      <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2v-9z" />
    </svg>
  ),
  gear: ({ size = 18 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.9a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2l-2.4-.9-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-.9a7 7 0 0 0 2 1.2L10 21h4l.5-2.5a7 7 0 0 0 2-1.2l2.4.9 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" />
    </svg>
  ),
  bell: ({ size = 18 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  ),
  team: ({ size = 18 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  ),
  users: ({ size = 18 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 14.5c2.6.4 4.5 2.5 4.5 5" />
    </svg>
  ),
  cal: ({ size = 18 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  ),
  rules: ({ size = 18 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </svg>
  ),
  drills: ({ size = 18 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}>
      <ellipse cx="12" cy="12" rx="9" ry="6" />
      <path d="M9 10l6 4M15 10l-6 4" />
    </svg>
  ),
  practice: ({ size = 18 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
      <path d="M8 13h3M8 17h7" />
    </svg>
  ),
  grid: ({ size = 18 }: IconProps = {}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
};

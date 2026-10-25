type P = { size?: number };
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const CalendarIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

export const PeopleIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M18 14.5c2.5.3 4 1.8 4 4.5" />
  </svg>
);

export const ChatIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
  </svg>
);

export const HomeIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
  </svg>
);

export const UserIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" />
  </svg>
);

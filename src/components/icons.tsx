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

export const InboxIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M3 13l2.5-7.5A2 2 0 0 1 7.4 4h9.2a2 2 0 0 1 1.9 1.5L21 13" />
    <path d="M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5h-5l-1.5 2.5h-5L8 13H3z" />
  </svg>
);

export const FileIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </svg>
);

export const AudioIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M9 18V6l10-2v12" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="16" r="2.5" />
  </svg>
);

export const LinkIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
    <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
  </svg>
);

export const ImageIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="M21 16l-5-5-8 8" />
  </svg>
);

export const VideoIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M10.5 9.5v5l4-2.5z" />
  </svg>
);

export const LockIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <rect x="5" y="11" width="14" height="9" rx="2.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const UnlockIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <rect x="5" y="11" width="14" height="9" rx="2.5" />
    <path d="M8 11V8a4 4 0 0 1 7.5-1.9" />
  </svg>
);

export const SearchIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const PhoneIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </svg>
);

export const MailIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="m4 7.5 8 6 8-6" />
  </svg>
);

export const ClockIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const CheckCircleIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.5 2.8 2.8L16.5 9.5" />
  </svg>
);

export const FlagIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M5 21V4" />
    <path d="M5 4.5c3-1.5 5 1.5 8 0s4-.5 6 .5v8c-2-1-3-2-6-.5s-5-1.5-8 0" />
  </svg>
);

export const BlockIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="m6 6 12 12" />
  </svg>
);

export const PinIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </svg>
);

export const PencilIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
);

export const CoinIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.4 0-2.4.7-2.4 1.8 0 2.5 5 1.2 5 3.8 0 1.1-1 1.9-2.6 1.9-1.1 0-2.1-.5-2.6-1.3M12 6.5V8m0 8v1.5" />
  </svg>
);

export const BookIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
    <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" />
    <path d="M9 7h6" />
  </svg>
);

export const CheckIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth={3}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

// Prestado: el libro «sale» hacia otra persona.
export const LentIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth={2.6}>
    <path d="M7 17 17 7" />
    <path d="M8.5 7H17v8.5" />
  </svg>
);

export const CommunityIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <circle cx="12" cy="8" r="3" />
    <circle cx="5.5" cy="10" r="2.2" />
    <circle cx="18.5" cy="10" r="2.2" />
    <path d="M6.5 20v-1.5A3.5 3.5 0 0 1 10 15h4a3.5 3.5 0 0 1 3.5 3.5V20" />
    <path d="M2.5 18.5V18a2.8 2.8 0 0 1 2.8-2.8M21.5 18.5V18a2.8 2.8 0 0 0-2.8-2.8" />
  </svg>
);

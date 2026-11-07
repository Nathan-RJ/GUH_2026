// Small inline icons (no icon library needed).
const common = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const MicIcon = () => (
  <svg {...common}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" />
  </svg>
);

export const StopIcon = () => (
  <svg {...common}>
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
  </svg>
);

export const SpeakerIcon = () => (
  <svg {...common}>
    <path d="M11 5 6 9H3v6h3l5 4V5z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);

export const SpeakerOffIcon = () => (
  <svg {...common}>
    <path d="M11 5 6 9H3v6h3l5 4V5z" />
    <path d="m16 9 5 6M21 9l-5 6" />
  </svg>
);

import type { ReactNode } from "react";

/**
 * The site's line icons: one 24px grid, one 1.6 stroke, round ends, drawn in
 * currentColor so they take the colour of whatever they sit in.
 *
 * Decorative by default (aria-hidden). Tailwind's preflight makes every svg a
 * block, so the display is set back to inline-block and they sit in a line of
 * text like a glyph; `flex: none` keeps them unsquashed in flex rows.
 */
function Svg({ children, size = 20, className = "" }: { children: ReactNode; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={className}
      style={{ display: "inline-block", flex: "none" }}
    >
      {children}
    </svg>
  );
}

type P = { size?: number; className?: string };

export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </Svg>
);

export const IconArrowUpRight = (p: P) => (
  <Svg {...p}>
    <path d="M7 17L17 7M9 7h8v8" />
  </Svg>
);

export const IconArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M4 12h15M13.5 6.5L19 12l-5.5 5.5" />
  </Svg>
);

export const IconStethoscope = (p: P) => (
  <Svg {...p}>
    <path d="M5 3v5a5 5 0 0010 0V3" />
    <path d="M10 13v2.5a4.5 4.5 0 009 0V13" />
    <circle cx="19" cy="11" r="2" />
  </Svg>
);

export const IconHome = (p: P) => (
  <Svg {...p}>
    <path d="M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1h-4.5v-5.5h-5V20H5a1 1 0 01-1-1z" />
  </Svg>
);

export const IconVial = (p: P) => (
  <Svg {...p}>
    <path d="M9 3h6M10 3v4.2L6.4 17.4A2.6 2.6 0 008.8 21h6.4a2.6 2.6 0 002.4-3.6L14 7.2V3" />
    <path d="M7.6 14h8.8" />
  </Svg>
);

export const IconShield = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l7.5 3v5.6c0 4.4-3.1 8.1-7.5 9.4-4.4-1.3-7.5-5-7.5-9.4V6z" />
    <path d="M8.8 12.2l2.2 2.2 4.4-4.6" />
  </Svg>
);

export const IconClipboard = (p: P) => (
  <Svg {...p}>
    <path d="M9 4h6v2.5H9z" />
    <path d="M15 5h2.5A1.5 1.5 0 0119 6.5v13a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 19.5v-13A1.5 1.5 0 016.5 5H9" />
    <path d="M8.5 11.5l1.5 1.5 2.5-2.5M8.5 16.5h7M14.5 11.5h1" />
  </Svg>
);

export const IconPulse = (p: P) => (
  <Svg {...p}>
    <path d="M3 12.5h4l2-5 4 10 2-5h6" />
  </Svg>
);

export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const IconMapPin = (p: P) => (
  <Svg {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </Svg>
);

export const IconPhone = (p: P) => (
  <Svg {...p}>
    <rect x="7" y="2.8" width="10" height="18.4" rx="2.4" />
    <path d="M11 17.8h2" />
  </Svg>
);

export const IconDrop = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5s6 6.6 6 11a6 6 0 01-12 0c0-4.4 6-11 6-11z" />
  </Svg>
);

export const IconReport = (p: P) => (
  <Svg {...p}>
    <path d="M7 3h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
    <path d="M14 3v4h4M9 12h6M9 15.5h6M9 8.5h2" />
  </Svg>
);

export const IconLock = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V8a4 4 0 018 0v2.5" />
  </Svg>
);

export const IconBox = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 7.5L12 3.5l8.5 4v9L12 20.5l-8.5-4z" />
    <path d="M3.5 7.5L12 11.5l8.5-4M12 11.5v9" />
  </Svg>
);

export const IconAlert = (p: P) => (
  <Svg {...p}>
    <path d="M12 4l9 16H3z" />
    <path d="M12 10v4.2M12 17.2v.1" />
  </Svg>
);

export const IconQuote = (p: P) => (
  <Svg {...p}>
    <path d="M9.5 7C6.8 8 5 10.2 5 13.2V17h4.5v-4.5H7.2c0-1.8 1-3.2 2.8-4zM18.5 7c-2.7 1-4.5 3.2-4.5 6.2V17h4.5v-4.5h-2.3c0-1.8 1-3.2 2.8-4z" />
  </Svg>
);

export const IconUsers = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19.5c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8" />
    <path d="M15.5 5.6a3.2 3.2 0 010 5.8M17.4 14.9c1.6.6 2.7 2.2 3.1 4.6" />
  </Svg>
);

export const IconMessage = (p: P) => (
  <Svg {...p}>
    <path d="M4 5.5A1.5 1.5 0 015.5 4h13A1.5 1.5 0 0120 5.5v9a1.5 1.5 0 01-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 014 14.5z" />
  </Svg>
);

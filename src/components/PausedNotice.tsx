import { Mountains_of_Christmas } from "next/font/google";

import { PAUSED_MESSAGE } from "@/lib/paused";
import { activeTheme } from "@/lib/theme";

// Holiday script for the Christmas GritCheck greeting only (§4.1 fonts are
// untouched elsewhere). next/font self-hosts it, so CSP font-src 'self' holds.
const christmasFont = Mountains_of_Christmas({
  subsets: ["latin"],
  weight: "700",
  display: "swap",
});

// Little tree, drawn rather than an emoji so it matches across devices.
// Decorative: the greeting text carries the meaning.
function ChristmasTree({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 28" className={className} aria-hidden="true">
      <path fill="#ffc20e" d="M12 0.6l1.2 2.5 2.7.4-2 1.9.5 2.7L12 6.8 9.6 8.1l.5-2.7-2-1.9 2.7-.4z" />
      <path fill="#2f9e5a" d="M12 6.5L5.5 14h3L4 20h4.5L3 25.5h18L15.5 20H20l-4.5-6h3z" />
      <path fill="#7a4a2a" d="M10.4 25.5h3.2V28h-3.2z" />
      <circle cx="10" cy="12.6" r="1.1" fill="#ff5a5f" />
      <circle cx="14.2" cy="17.3" r="1.1" fill="#8fd3f4" />
      <circle cx="9.1" cy="19.4" r="1.1" fill="#f5f2ea" />
      <circle cx="15.6" cy="23" r="1.1" fill="#ff5a5f" />
      <circle cx="8" cy="23.6" r="1.1" fill="#ffc20e" />
    </svg>
  );
}

// In-flow notice (not a fixed overlay) so it never fights the map's top bar
// or the offline pill for the same pixels. --muted on --soft is 6.07:1.
// In the Christmas theme it opens with a greeting: #ff5a5f on --soft is
// 4.67:1, so the red clears 4.5:1 even before the large-text allowance.
export function PausedNotice({ className = "" }: { className?: string }) {
  const christmas = activeTheme() === "christmas";
  return (
    <div
      role="status"
      className={`rounded-md border border-line bg-soft px-3.5 py-3 ${className}`}
    >
      {christmas && (
        <p className="mb-1.5 flex items-center gap-2">
          <ChristmasTree className="h-7 w-6 shrink-0" />
          <span
            className={`${christmasFont.className} text-[24px] leading-none text-[#ff5a5f]`}
          >
            Merry Christmas
          </span>
        </p>
      )}
      <p className="text-[13px] leading-snug text-muted">{PAUSED_MESSAGE}</p>
    </div>
  );
}

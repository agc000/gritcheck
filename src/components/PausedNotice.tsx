import { PAUSED_MESSAGE } from "@/lib/paused";

// In-flow notice (not a fixed overlay) so it never fights the map's top bar
// or the offline pill for the same pixels. --muted on --soft is 6.07:1.
export function PausedNotice({ className = "" }: { className?: string }) {
  return (
    <p
      role="status"
      className={`rounded-md border border-line bg-soft px-3.5 py-3 text-[13px] leading-snug text-muted ${className}`}
    >
      {PAUSED_MESSAGE}
    </p>
  );
}

import type { Tone } from "@/lib/status";

// Status word + 7px dot (§4.3, mockup `.status`). Green/amber/red/gray are
// status colors only — this component is the sole place they touch text.
const TONE_TEXT: Record<Tone, string> = {
  go: "text-go",
  hold: "text-hold",
  skip: "text-skip",
  closed: "text-closed",
};

export function StatusBadge({ word, tone }: { word: string; tone: Tone }) {
  return (
    <div
      className={`inline-flex items-center gap-[5.5px] text-[13px] font-bold ${TONE_TEXT[tone]}`}
    >
      <span aria-hidden className="size-[7px] rounded-full bg-current" />
      {word}
    </div>
  );
}

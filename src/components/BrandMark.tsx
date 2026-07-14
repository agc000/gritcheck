// GritCheck brand system (docs/GritCheck Logo System-print.pdf, Alan
// 2026-07-14): "The Check-Pin" — one solid pin, the checkmark cut through as
// negative space (fill-rule evenodd). Gold does one decisive thing. Lockup:
// "Grit" 700 / "Check" 400 in Space Grotesk (logo-only font, §4.1 amendment)
// with a gold dot as the full stop. Grits the retriever remains the mascot
// for empty states / 404 (§4.7) — this is the mark, not the mascot.

export function CheckPin({
  className,
  color = "#FFC20E",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className}>
      <path
        fill={color}
        fillRule="evenodd"
        d="M32 3C18.7 3 8 13.6 8 26.7 8 39.8 20.4 50.6 32 62 43.6 50.6 56 39.8 56 26.7 56 13.6 45.3 3 32 3Zm-4.6 39.4-10.2-10.2 5.4-5.4 4.8 4.8L41 18l5.4 5.4-19 19Z"
      />
    </svg>
  );
}

export function BrandLockup({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <CheckPin className="h-5.5 w-5.5" />
      <span className="font-grotesk text-[17px] tracking-[-0.01em] text-ink">
        <span className="font-bold">Grit</span>
        <span className="font-normal">Check</span>
        <span className="ml-0.5 align-middle text-gold" aria-hidden>
          •
        </span>
      </span>
    </div>
  );
}

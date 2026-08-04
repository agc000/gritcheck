import Link from "next/link";

// Legal footer (§Phase 6). Two jobs, both from the risk register (§9):
// the "unofficial" disclaimer is the trademark posture — it ships on the SSR
// pages search engines index, so the disclaimer is in the crawled HTML, not
// behind a tap — and the privacy link is the standing answer to "what does
// this app know about me", which a no-accounts app should be able to answer
// in one screen.
//
// Server-rendered static markup: no client JS, nothing on the critical path.
// --faint clears 4.5:1 on --sheet (token audit 2026-07-11) but NOT on --soft,
// so this belongs only on sheet-coloured surfaces.
export function LegalFooter() {
  return (
    // No horizontal padding: callers sit on different gutters (the sheet uses
    // px-5, the detail page px-4.5), so the parent owns it.
    <footer className="border-t border-line py-4">
      <p className="text-[11px] leading-relaxed text-faint">
        GritCheck is an unofficial student project and is not affiliated with,
        endorsed by, or sponsored by UMBC. Hours and conditions are
        community-reported and may be wrong.
      </p>
      {/* inline-flex + min-h-11: a standalone navigation link is a tap target
          and owes §4.8 its 44px, which 11px text does not give on its own.
          Caught by the Phase 6 quality gate at 390×844, where it measured 15px. */}
      <Link
        href="/privacy"
        className="mt-1 inline-flex min-h-11 items-center text-[11px] text-muted underline underline-offset-2"
      >
        What this app knows about you
      </Link>
    </footer>
  );
}

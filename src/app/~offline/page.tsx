import type { Metadata } from "next";
import { BrandLockup } from "@/components/BrandMark";

// Offline fallback (§Phase 5): precached at install, served by the service
// worker only when a navigation misses both network and page cache. Static by
// design — no data reads. Grits-ified empty states are Phase 7 polish.
export const metadata: Metadata = {
  title: "Offline — GritCheck",
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-4 bg-sheet px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-ink">
      <BrandLockup />
      <h1 className="text-lg font-extrabold">You&rsquo;re offline.</h1>
      {/* Was: "available from your browser's back button" — untrue for the
          audience most likely to see this page. Installed from the home screen
          there is no browser chrome and no visible back button, so the old copy
          pointed at a control that is not on screen (Phase 7 copy pass). */}
      <p className="max-w-xs text-sm leading-relaxed text-muted">
        GritCheck needs a connection to show live updates. Spots you already
        opened still work.
      </p>
    </main>
  );
}

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
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-4 bg-sheet px-6 text-center text-ink">
      <BrandLockup />
      <h1 className="text-lg font-extrabold">You&rsquo;re offline.</h1>
      <p className="text-sm text-muted">
        Live statuses need a connection. Anything you opened recently is still
        available from your browser&rsquo;s back button.
      </p>
    </main>
  );
}

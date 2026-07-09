import { supabase } from "@/lib/supabase";

// Phase 1 exit page: prove the DB round-trips. Deliberately plain — the real
// map + sheet UI is Phase 2/3. Rendered per-request so it always shows live rows.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ data: spots, error }, { data: status }] = await Promise.all([
    supabase
      .from("spots")
      .select("slug,name,category,building,consensus")
      .order("category")
      .order("name"),
    supabase.from("spot_current_status").select("slug,is_open,confidence"),
  ]);

  if (error) {
    return (
      <main className="p-6 font-sans">
        <p className="text-skip">Failed to load spots: {error.message}</p>
      </main>
    );
  }

  const statusBySlug = new Map((status ?? []).map((s) => [s.slug, s]));

  return (
    <main className="mx-auto max-w-2xl p-6 font-sans">
      <h1 className="text-2xl font-bold text-gold">GritCheck</h1>
      <p className="mt-1 text-sm text-faint">
        {spots?.length ?? 0} spots seeded · Phase 1 smoke test
      </p>

      <ul className="mt-6 divide-y divide-ink">
        {spots?.map((spot) => {
          const live = statusBySlug.get(spot.slug);
          return (
            <li key={spot.slug} className="flex items-baseline justify-between gap-4 py-3">
              <div>
                <div className="font-medium">
                  {spot.name}
                  <span className="ml-2 text-xs uppercase text-faint">{spot.category}</span>
                </div>
                <div className="text-sm text-muted">{spot.building}</div>
                {spot.consensus && (
                  <div className="mt-0.5 text-sm italic text-faint">“{spot.consensus}”</div>
                )}
              </div>
              <div className="shrink-0 text-right font-mono text-xs">
                <div className={live?.is_open ? "text-go" : "text-closed"}>
                  {live?.is_open ? "open" : "closed"}
                </div>
                <div className="text-faint">{live?.confidence ?? "—"}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

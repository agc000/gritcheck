import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlagButton } from "@/components/FlagButton";
import { FollowUpPrompt } from "@/components/FollowUpPrompt";
import { SpotViewTracker } from "@/components/SpotViewTracker";
import { InlineUpdatePrompt } from "@/components/InlineUpdatePrompt";
import { LiveRefresh } from "@/components/LiveRefresh";
import { StatusBadge } from "@/components/StatusBadge";
import { UpdateSheet } from "@/components/UpdateSheet";
import { CHIPS_BY_CATEGORY } from "@/lib/filters";
import { baselineWord, getVerdict } from "@/lib/status";
import { getSpotDetail } from "@/lib/spots";
import { formatMinutes } from "@/lib/time";
import type { SpotListItem } from "@/lib/types";

// SSR spot detail (§4.2): status + confidence, hours today, attribute chips,
// consensus, worth-it %, recent comments with flag affordance, and the
// inline "How's it right now?" update prompt.
export const dynamic = "force-dynamic";

// Comment freshness in the dry §4.4 voice; comments live for 7 days so days
// are the coarsest unit needed.
function commentAge(createdAt: string, now: Date): string {
  const minutes = Math.round(
    (now.getTime() - new Date(createdAt).getTime()) / 60_000,
  );
  if (minutes < 60) return `${Math.max(minutes, 0)} min ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / (24 * 60))} d ago`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getSpotDetail(slug);
  if (!detail) return { title: "Not found — GritCheck" };
  return {
    title: `${detail.item.name} — GritCheck`,
    description: `${detail.item.name} at UMBC: live status, hours, and whether it's worth the walk.`,
  };
}

// §4.5: three bars driven by the aggregation weight, always with the reason.
function ConfidenceBars({ item, now }: { item: SpotListItem; now: Date }) {
  const level =
    item.confidence === "high" ? 3 : item.confidence === "medium" ? 2 : 1;
  const typical = baselineWord(item.baseline, now);
  const reason =
    level === 3
      ? "several reports this hour"
      : level === 2
        ? "a recent report or two"
        : typical
          ? "no recent reports — based on typical pattern"
          : "no recent reports";

  return (
    <div>
      <div className="flex items-center gap-1">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={`h-1 w-6 rounded-full ${bar <= level ? "bg-ink" : "bg-line"}`}
          />
        ))}
        <span className="ml-2 text-xs font-semibold capitalize">
          {item.confidence ?? "low"} confidence
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">{reason}</p>
    </div>
  );
}

export default async function SpotPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const detail = await getSpotDetail(slug);
  if (!detail) notFound();

  const { item, comments, nowMs } = detail;
  const now = new Date(nowMs);
  const verdict = getVerdict(item, now);
  const typical = baselineWord(item.baseline, now);

  const hoursToday = item.hours
    .filter((h) => h.dayOffset === 0)
    .sort((a, b) => a.opens - b.opens)
    .map((h) => `${formatMinutes(h.opens)} – ${formatMinutes(h.closes)}`)
    .join(" · ");

  const attributeLabels = CHIPS_BY_CATEGORY[item.category]
    .filter((chip) => {
      const a = item.attributes;
      return (
        typeof a === "object" && a !== null && !Array.isArray(a) &&
        chip.match(a as Parameters<typeof chip.match>[0])
      );
    })
    .map((chip) => chip.label);

  return (
    // w-full matters: body is a flex column, and mx-auto on a flex item
    // otherwise collapses the page to fit-content width.
    <main className="animate-page-enter mx-auto min-h-dvh w-full max-w-lg bg-sheet px-4.5 pb-10 text-ink">
      <nav className="pt-4">
        {/* Padded to a ≥44px tap target (§4.8); negative margin keeps layout. */}
        <Link
          href="/"
          className="-my-3 -ml-2 inline-block px-2 py-3 text-sm font-semibold text-muted"
        >
          ← Map
        </Link>
      </nav>

      <header className="mt-4">
        <h1 className="text-2xl font-extrabold tracking-[-0.015em]">
          {item.name}
        </h1>
        <p className="mt-1 text-sm text-muted">{item.building}</p>
      </header>

      <section className="mt-5 rounded-card bg-soft p-4">
        <div className="flex items-baseline justify-between">
          <StatusBadge word={verdict.word} tone={verdict.tone} />
          {verdict.fresh && (
            <span
              className={`font-mono text-xs ${
                verdict.freshTone === "hold" ? "text-hold" : "text-muted"
              }`}
            >
              {verdict.fresh.startsWith("opens") || verdict.fresh.startsWith("typical")
                ? verdict.fresh
                : `as of ${verdict.fresh}`}
            </span>
          )}
        </div>
        <div className="mt-3">
          <ConfidenceBars item={item} now={now} />
        </div>
        {typical && (
          <p className="mt-2 text-xs text-muted">
            Typical right now: <span className="font-semibold">{typical}</span>
          </p>
        )}
      </section>

      <section className="mt-5 border-t border-line pt-4">
        <h2 className="text-xs font-extrabold uppercase tracking-[0.09em] text-muted">
          Hours today
        </h2>
        <p className="mt-1.5 text-sm font-semibold">
          {hoursToday || "No hours listed"}
        </p>
      </section>

      {attributeLabels.length > 0 && (
        <section className="mt-5 border-t border-line pt-4">
          <h2 className="text-xs font-extrabold uppercase tracking-[0.09em] text-muted">
            Good to know
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {attributeLabels.map((label) => (
              <span
                key={label}
                className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted"
              >
                {label}
              </span>
            ))}
          </div>
        </section>
      )}

      {item.consensus && (
        <section className="mt-5 border-t border-line pt-4">
          <h2 className="text-xs font-extrabold uppercase tracking-[0.09em] text-muted">
            The consensus
          </h2>
          <p className="mt-1.5 text-sm italic text-muted">
            &ldquo;{item.consensus}&rdquo;
          </p>
        </section>
      )}

      {item.worthItPct !== null && (
        <section className="mt-5 border-t border-line pt-4">
          <h2 className="text-xs font-extrabold uppercase tracking-[0.09em] text-muted">
            Worth it
          </h2>
          <p className="mt-1.5 text-sm font-semibold">
            {/* The view reports a 0–1 weighted share (§5.2). */}
            {Math.round(item.worthItPct * 100)}% said yes
            <span className="ml-1 font-normal text-muted">(last 7 days)</span>
          </p>
        </section>
      )}

      {comments.length > 0 && (
        <section className="mt-5 border-t border-line pt-4">
          <h2 className="text-xs font-extrabold uppercase tracking-[0.09em] text-muted">
            Recent comments
          </h2>
          <ul className="mt-1 divide-y divide-line">
            {comments.map((c) => (
              <li key={c.id} className="flex items-baseline gap-3 py-2.5">
                {/* Escaped React text only — §5.5 bans any HTML rendering. */}
                <p className="min-w-0 flex-1 text-sm">{c.comment}</p>
                <span className="shrink-0 font-mono text-[11px] text-faint">
                  {commentAge(c.created_at, now)}
                </span>
                <FlagButton updateId={c.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <InlineUpdatePrompt slug={item.slug} />
      </section>

      {/* §9 trademark posture: the unofficial disclaimer ships on the SSR
          pages search engines index. Full legal footer + privacy note is
          Phase 6. */}
      <footer className="mt-8 border-t border-line pt-4">
        <p className="text-[11px] leading-relaxed text-faint">
          GritCheck is an unofficial student project and is not affiliated
          with, endorsed by, or sponsored by UMBC. Hours and conditions are
          community-reported and may be inaccurate.
        </p>
      </footer>

      {/* Viewing a detail makes this spot the session's follow-up candidate;
          the prompt itself can fire here or on the map page. */}
      <SpotViewTracker id={item.id} slug={item.slug} name={item.name} />
      <FollowUpPrompt />
      {/* Update flow preset to this spot (single-item mount: no picker). */}
      <UpdateSheet items={[item]} />
      <LiveRefresh />
    </main>
  );
}

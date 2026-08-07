"use client";

import { useEffect, useState } from "react";
import { Drawer } from "vaul";

import { CheckPin } from "@/components/BrandMark";
import { getDeviceId } from "@/lib/device";
import { logEvent } from "@/lib/events";
import { takeFollowUpPrompt, type FollowUpCandidate } from "@/lib/followup";
import { supabase } from "@/lib/supabase";

// §4.2 follow-up: one-tap bar, max once per session, answers insert as
// kind='followup' updates — the corrective-data half of the §5.5 poisoning
// defense. Uses a vaul drawer (non-modal, dismissible) so the bar rides the
// bottom edge with the same physics language as everything else, without
// blocking the app underneath.
//
// Answer mapping (reworded 2026-07-24, Alan: no slangy "Meh" — §4.7 dry):
// "Worth it" / "Not worth it" feed worth-it (the 7-day quality signal);
// "Full" feeds crowd — 9 on the 1–10 scale (§3.1 amendment), which both
// categories' verdict paths read as the packed band. Labelled "Full" rather
// than "Packed" since the §4.3 amendment (2026-08-07): the button offers the
// student the same word the row would have shown them.
const ANSWERS = [
  { label: "Worth it", body: { worth_it: true } },
  { label: "Not worth it", body: { worth_it: false } },
  { label: "Full", body: { crowd: 9 } },
] as const;

export function FollowUpPrompt() {
  const [candidate, setCandidate] = useState<FollowUpCandidate | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== "visible") return;
      const c = takeFollowUpPrompt();
      if (c) {
        setCandidate(c);
        logEvent("followup_shown", { slug: c.slug });
      }
    };
    check(); // covers full re-opens (fresh mount after ≥10 min)
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);

  const answer = (body: Record<string, unknown>, label: string) => {
    if (!candidate || done) return;
    setDone(true);
    logEvent("followup_answered", { slug: candidate.slug, answer: label });
    // Fire-and-forget like the §1.2 loop demands — a follow-up answer must
    // never make the user wait. Rate-limit rejections are fine to drop: the
    // device just reported this spot, and a silent no-op beats a nag.
    void supabase.functions.invoke("submit-update", {
      body: {
        spot_id: candidate.id,
        device_id: getDeviceId(),
        kind: "followup",
        ...body,
      },
    });
    setTimeout(() => setCandidate(null), 900);
  };

  return (
    <Drawer.Root
      open={candidate !== null}
      onOpenChange={(open) => {
        if (!open) setCandidate(null); // swipe-away = dismissed, never re-asked
      }}
      modal={false}
    >
      <Drawer.Portal>
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 rounded-md border border-line bg-black p-3 shadow-[0_8px_24px_rgba(0,0,0,0.45)] outline-none"
        >
          {done ? (
            <p className="py-2 text-center text-[13px] font-semibold text-ink">
              Noted.
            </p>
          ) : (
            <>
              <Drawer.Title className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
                {/* The mark = "report what you see" (Alan, 2026-07-17). */}
                <CheckPin className="h-4 w-4 shrink-0" />
                Did {candidate?.name} pan out?
              </Drawer.Title>
              <div className="mt-2 flex gap-2">
                {ANSWERS.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => answer(a.body, a.label)}
                    className="h-11 flex-1 rounded-md border border-line bg-soft text-[13px] font-semibold text-ink"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

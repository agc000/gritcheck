"use client";

import { useEffect, useState } from "react";
import { Drawer } from "vaul";

import { logEvent } from "@/lib/events";
import { wasFollowUpShownThisSession } from "@/lib/followup";
import {
  countVisit,
  markInstalled,
  shouldOfferInstall,
  snoozeInstall,
} from "@/lib/install";

// §Phase 5 install UX, same bottom-bar physics as FollowUpPrompt. Two paths:
// Chrome/Android hands us a deferred beforeinstallprompt to re-fire from our
// own button (the Next PWA guide discourages custom buttons because iOS lacks
// the event — hence the second path); iOS gets the share-sheet instructions,
// which is all Apple allows. Desktop browsers without either see nothing.
//
// The prompt waits out an idle delay so it never contends with hydration and
// never lands on top of the follow-up bar — if that showed, we skip the whole
// session (corrective data outranks a nudge).
const DECIDE_AFTER_MS = 6_000;

// Minimal slice of the non-standard BeforeInstallPromptEvent.
type BipEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

export function InstallPrompt() {
  const [bip, setBip] = useState<BipEvent | null>(null);
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    countVisit();

    // Capture immediately — Chrome fires this once, early; a listener
    // attached only when we're ready to show would usually miss it.
    const onBip = (e: Event) => {
      e.preventDefault();
      setBip(e as BipEvent);
    };
    const onInstalled = () => {
      markInstalled();
      setDismissed(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);

    const t = setTimeout(() => {
      if (shouldOfferInstall() && !wasFollowUpShownThisSession()) {
        setReady(true);
      }
    }, DECIDE_AFTER_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(t);
    };
  }, []);

  const platform = bip ? "android" : isIOS() ? "ios" : null;
  const open = ready && !dismissed && platform !== null;

  useEffect(() => {
    if (open && platform) logEvent("install_shown", { platform });
  }, [open, platform]);

  const close = (answer: string) => {
    if (platform) logEvent("install_answered", { platform, answer });
    snoozeInstall();
    setDismissed(true);
  };

  const add = async () => {
    if (!bip) return;
    await bip.prompt();
    const { outcome } = await bip.userChoice;
    if (outcome === "accepted") {
      markInstalled();
      if (platform) logEvent("install_answered", { platform, answer: "accepted" });
      setDismissed(true);
    } else {
      close("declined");
    }
  };

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) close("swiped"); // swipe-away = a dismissal, snooze it
      }}
      modal={false}
    >
      <Drawer.Portal>
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 rounded-md border border-line bg-black p-3 shadow-[0_8px_24px_rgba(0,0,0,0.45)] outline-none"
        >
          <Drawer.Title className="text-[13px] font-bold text-ink">
            Put GritCheck on your Home Screen.
          </Drawer.Title>
          {platform === "ios" ? (
            <>
              <p className="mt-1 flex items-center gap-1 text-[12.5px] text-muted">
                Tap
                {/* iOS share glyph: square with up arrow. */}
                <svg
                  aria-label="Share"
                  className="inline h-4 w-4"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 6H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1" />
                  <path d="M8 10V2m0 0L5.5 4.5M8 2l2.5 2.5" />
                </svg>
                then &ldquo;Add to Home Screen.&rdquo;
              </p>
              <button
                type="button"
                onClick={() => close("got-it")}
                className="mt-2 h-11 w-full rounded-md border border-line bg-soft text-[13px] font-semibold text-ink"
              >
                Got it
              </button>
            </>
          ) : (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={add}
                className="h-11 flex-1 rounded-md border border-line bg-soft text-[13px] font-semibold text-ink"
              >
                Add it
              </button>
              <button
                type="button"
                onClick={() => close("not-now")}
                className="h-11 flex-1 rounded-md text-[13px] font-semibold text-muted"
              >
                Not now
              </button>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

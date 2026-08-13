"use client";

import { useState } from "react";

import { getDeviceId } from "@/lib/device";
import { supabase } from "@/lib/supabase";

// Comment flag affordance (§4.2 detail view). One tap, no confirmation
// dialog — the server side is idempotent per device (§5.5 flag function),
// so a mistap costs nothing and re-tapping does nothing.
export function FlagButton({ updateId }: { updateId: number }) {
  const [flagged, setFlagged] = useState(false);

  return (
    <button
      type="button"
      disabled={flagged}
      onClick={() => {
        setFlagged(true);
        // supabase-js builders are lazy thenables — without .then() the
        // request never fires. (Bug found by the Phase 4 verification drive.)
        void supabase
          .rpc("flag_update", {
            p_update_id: updateId,
            p_device_id: getDeviceId(),
          })
          .then(({ error }) => {
            if (error && process.env.NODE_ENV !== "production") {
              console.warn("flag_update failed:", error.message);
            }
          });
      }}
      // Padded to a ≥44px tap target (§4.8): py-4 (32px) + ~13px of 11px text
      // ≈ 45px; the matching negative margin cancels the padding so the
      // comment row's height is unaffected. Visual stays an 11px whisper —
      // flagging is a rare corrective action, not a call to action.
      className="-my-4 px-2 py-4 text-[11px] font-semibold text-faint transition-transform duration-150 ease-out active:scale-97 disabled:text-muted motion-reduce:transition-none"
    >
      {flagged ? "Flagged" : "Flag"}
    </button>
  );
}

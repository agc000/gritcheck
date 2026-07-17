// submit-update — the ONLY write path into `updates` (BUILD_PLAN §5.5).
// RLS gives anon no insert policy on `updates`; this function runs with the
// service role and is therefore where every §5.5 control lives:
//   - zod validation of shape, enums, and the 80-char comment cap
//   - two independent rate-limit keys (device UUID and salted-hashed IP)
//   - no PII: the raw IP is hashed with IP_HASH_SALT and discarded
//
// Deno runtime (Supabase Edge). Not part of the Next.js tsc/eslint surface —
// see tsconfig.json "exclude". Deploy: supabase functions deploy submit-update

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

// §5.5 rate limits. Two keys because clearing localStorage mints a new device
// ID (cheap), while rotating IPs on a phone is costly.
const DEVICE_PER_SPOT_10MIN = 1;
const DEVICE_PER_DAY = 12;
const IP_PER_SPOT_10MIN = 3;
const IP_PER_DAY = 30;

// Browser callers only; supabase-js functions.invoke sends the anon JWT.
const ALLOWED_ORIGINS = new Set([
  "https://gritcheck.live",
  "http://localhost:3000",
]);

function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":
      origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://gritcheck.live",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

const Payload = z
  .object({
    spot_id: z.string().uuid(),
    device_id: z.string().uuid(),
    kind: z.enum(["food", "study", "followup"]),
    // 1–10 scales (§3.1 amendments 2026-07-17); the view bands them to the
    // §4.3 words for display. line: 1 walk right up → 10 out the door.
    // crowd: 1 empty → 10 packed. noise: 1 silent → 10 loud.
    line: z.number().int().min(1).max(10).optional(),
    crowd: z.number().int().min(1).max(10).optional(),
    noise: z.number().int().min(1).max(10).optional(),
    worth_it: z.boolean().optional(),
    comment: z.string().trim().min(1).max(80).optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    // A report must say something; a bare comment is not a status signal.
    if (
      p.line === undefined &&
      p.crowd === undefined &&
      p.noise === undefined &&
      p.worth_it === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "at least one of line, crowd, noise, worth_it is required",
      });
    }
    // Field/kind coherence mirrors §3.1 semantics: food reports lines, study
    // reports crowd/noise. followup (§4.2 one-tap bar) may carry either.
    if (p.kind === "food" && (p.crowd !== undefined || p.noise !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "food updates take line/worth_it, not crowd/noise",
      });
    }
    if (p.kind === "study" && p.line !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "study updates take crowd/noise, not line",
      });
    }
  });

async function hashIp(ip: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${ip}`),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

function json(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json(405, { error: "POST only" }, origin);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(400, { error: "Body must be JSON" }, origin);
  }
  const parsed = Payload.safeParse(raw);
  if (!parsed.success) {
    return json(
      400,
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      origin,
    );
  }
  const p = parsed.data;

  const salt = Deno.env.get("IP_HASH_SALT");
  if (!salt) {
    // Refuse rather than degrade: without the salt the IP limit key is gone.
    console.error("IP_HASH_SALT is not set");
    return json(500, { error: "Server misconfigured" }, origin);
  }
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const ipHash = await hashIp(ip, salt);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: spot, error: spotError } = await supabase
    .from("spots")
    .select("id, category, active")
    .eq("id", p.spot_id)
    .maybeSingle();
  if (spotError) {
    console.error("spot lookup failed", spotError);
    return json(500, { error: "Try again" }, origin);
  }
  if (!spot || !spot.active) {
    return json(404, { error: "Unknown spot" }, origin);
  }
  if (p.kind !== "followup" && p.kind !== spot.category) {
    return json(400, { error: "Update kind does not match spot" }, origin);
  }
  // Note: frozen spots still ACCEPT updates. §5.5's freeze makes the view
  // ignore live data; rejecting writes would advertise the freeze to the
  // brigade and drop honest post-incident reports.

  const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const countRows = (
    key: "device_id" | "ip_hash",
    value: string,
    since: string,
    spotId?: string,
  ) => {
    let q = supabase
      .from("update_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq(key, value)
      .gte("created_at", since);
    if (spotId) q = q.eq("spot_id", spotId);
    return q;
  };

  const [deviceSpot, deviceDay, ipSpot, ipDay] = await Promise.all([
    countRows("device_id", p.device_id, tenMinAgo, p.spot_id),
    countRows("device_id", p.device_id, dayAgo),
    countRows("ip_hash", ipHash, tenMinAgo, p.spot_id),
    countRows("ip_hash", ipHash, dayAgo),
  ]);
  const countError =
    deviceSpot.error ?? deviceDay.error ?? ipSpot.error ?? ipDay.error;
  if (countError) {
    console.error("rate-limit count failed", countError);
    return json(500, { error: "Try again" }, origin);
  }
  if (
    (deviceSpot.count ?? 0) >= DEVICE_PER_SPOT_10MIN ||
    (ipSpot.count ?? 0) >= IP_PER_SPOT_10MIN
  ) {
    return json(
      429,
      { error: "Already reported. This spot can take another update in a few minutes." },
      origin,
    );
  }
  if ((deviceDay.count ?? 0) >= DEVICE_PER_DAY || (ipDay.count ?? 0) >= IP_PER_DAY) {
    return json(429, { error: "Daily update limit reached." }, origin);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("updates")
    .insert({
      spot_id: p.spot_id,
      device_id: p.device_id,
      kind: p.kind,
      line: p.line ?? null,
      crowd: p.crowd ?? null,
      noise: p.noise ?? null,
      worth_it: p.worth_it ?? null,
      comment: p.comment ?? null,
    })
    .select("id, created_at")
    .single();
  if (insertError) {
    console.error("insert failed", insertError);
    return json(500, { error: "Try again" }, origin);
  }

  // Quota is charged only for ACCEPTED updates, after the insert succeeds.
  const { error: rlError } = await supabase.from("update_rate_limits").insert({
    device_id: p.device_id,
    ip_hash: ipHash,
    spot_id: p.spot_id,
  });
  if (rlError) {
    // The update row exists; losing one quota row is the lesser failure.
    console.error("rate-limit write failed", rlError);
  }

  // Opportunistic cleanup: quota rows matter for 24 h; sweep old ones on ~5%
  // of requests instead of running a scheduled job for a table this small.
  if (Math.random() < 0.05) {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60_000).toISOString();
    await supabase.from("update_rate_limits").delete().lt("created_at", twoDaysAgo);
  }

  return json(201, { ok: true, id: inserted.id, created_at: inserted.created_at }, origin);
});

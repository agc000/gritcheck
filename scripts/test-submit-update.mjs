// Rate-limit + validation tests for the submit-update Edge Function (§5.5).
// Drives the REAL function over HTTP against the local stack, so the zod
// schema, the rate-limit SQL, and the response codes are all exercised as one.
//
// Prereqs (two terminals):
//   npx supabase start
//   npx supabase functions serve submit-update --env-file supabase/functions/.env
// Then:
//   npm run test:limits
//
// The script creates three throwaway spots, runs the sequence, and deletes
// them (cascade removes its updates and rate rows). Local database only.

import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const status = JSON.parse(
  execSync("npx supabase status --output json", { encoding: "utf8" }),
);
const API_URL = status.API_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = status.ANON_KEY;
const SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
if (!ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error("Could not read local keys — is `npx supabase start` running?");
  process.exit(1);
}

const FN_URL = `${API_URL}/functions/v1/submit-update`;
const db = createClient(API_URL, SERVICE_ROLE_KEY);

const SPOT_A = "00000000-0000-4000-9000-00000000000a"; // food
const SPOT_B = "00000000-0000-4000-9000-00000000000b"; // food
const SPOT_C = "00000000-0000-4000-9000-00000000000c"; // study
const uuid = () => crypto.randomUUID();
const d1 = uuid(), d2 = uuid(), d3 = uuid(), d4 = uuid(), d5 = uuid(), d6 = uuid();

let passed = 0, failed = 0;
function check(name, ok, detail = "") {
  if (ok) { passed++; console.log(`  ok - ${name}`); }
  else { failed++; console.error(`  FAIL - ${name} ${detail}`); }
}

async function post(body) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
      Origin: "http://localhost:3000",
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function cleanup() {
  await db.from("spots").delete().in("id", [SPOT_A, SPOT_B, SPOT_C]);
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
await cleanup(); // in case a previous run died mid-way
{
  const { error } = await db.from("spots").insert([
    { id: SPOT_A, slug: "rltest-a", name: "RL A", category: "food",  building: "T", lat: 39.25, lng: -76.71 },
    { id: SPOT_B, slug: "rltest-b", name: "RL B", category: "food",  building: "T", lat: 39.25, lng: -76.71 },
    { id: SPOT_C, slug: "rltest-c", name: "RL C", category: "study", building: "T", lat: 39.25, lng: -76.71 },
  ]);
  if (error) { console.error("fixture insert failed:", error.message); process.exit(1); }
}

try {
  console.log("# accept + per-spot limits (10-minute window)");
  let r = await post({ spot_id: SPOT_A, device_id: d1, kind: "food", line: "short", comment: "  test comment  " });
  check("first valid update → 201", r.status === 201, JSON.stringify(r.body));

  r = await post({ spot_id: SPOT_A, device_id: d1, kind: "food", line: "short" });
  check("same device, same spot, immediately → 429 (device 1/spot/10min)", r.status === 429);

  r = await post({ spot_id: SPOT_A, device_id: d2, kind: "food", line: "normal" });
  check("2nd device on spot → 201", r.status === 201);
  r = await post({ spot_id: SPOT_A, device_id: d3, kind: "food", line: "long" });
  check("3rd device on spot → 201 (IP at 3/spot/10min cap)", r.status === 201);
  r = await post({ spot_id: SPOT_A, device_id: d4, kind: "food", line: "long" });
  check("4th device, same IP, same spot → 429 (IP 3/spot/10min)", r.status === 429);

  r = await post({ spot_id: SPOT_B, device_id: d1, kind: "food", line: "short" });
  check("device blocked on A is fine on B → 201", r.status === 201);

  console.log("# validation (zod, §5.5)");
  r = await post({ spot_id: SPOT_A, device_id: uuid(), kind: "food", line: "huge" });
  check("bad enum → 400", r.status === 400);
  r = await post({ spot_id: SPOT_A, device_id: uuid(), kind: "food", line: "short", comment: "x".repeat(81) });
  check("81-char comment → 400", r.status === 400);
  r = await post({ spot_id: SPOT_A, device_id: uuid(), kind: "food", crowd: "packed" });
  check("crowd on a food update → 400", r.status === 400);
  r = await post({ spot_id: SPOT_A, device_id: uuid(), kind: "food" });
  check("no signal fields at all → 400", r.status === 400);
  r = await post({ spot_id: SPOT_A, device_id: uuid(), kind: "study", noise: "quiet" });
  check("study update on a food spot → 400", r.status === 400);
  r = await post({ spot_id: uuid(), device_id: uuid(), kind: "food", line: "short" });
  check("unknown spot → 404", r.status === 404);

  console.log("# daily caps (synthetic 30-min-old quota rows)");
  // Device cap: 12 rows today for d5 (fake IP hashes so only the device key trips).
  {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      device_id: d5,
      ip_hash: `fake-${i}`,
      spot_id: SPOT_C,
      created_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    }));
    const { error } = await db.from("update_rate_limits").insert(rows);
    if (error) throw new Error(`synthetic device rows: ${error.message}`);
  }
  r = await post({ spot_id: SPOT_C, device_id: d5, kind: "study", crowd: "normal" });
  check("13th update in a day for a device → 429 (12/day)", r.status === 429);

  // IP cap: learn the real hash from an accepted row, top it up to 30.
  {
    const { data } = await db
      .from("update_rate_limits").select("ip_hash").eq("device_id", d1).limit(1);
    const realHash = data?.[0]?.ip_hash;
    check("real ip_hash recorded (and not the raw IP)", !!realHash && !/^\d+\.\d+/.test(realHash));
    const { count } = await db
      .from("update_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", realHash);
    const rows = Array.from({ length: 30 - count }, () => ({
      device_id: uuid(),
      ip_hash: realHash,
      spot_id: SPOT_C,
      created_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    }));
    const { error } = await db.from("update_rate_limits").insert(rows);
    if (error) throw new Error(`synthetic ip rows: ${error.message}`);
  }
  r = await post({ spot_id: SPOT_C, device_id: d6, kind: "study", crowd: "normal" });
  check("31st update in a day from an IP → 429 (30/day)", r.status === 429);

  console.log("# persisted rows");
  const { data: ups } = await db
    .from("updates").select("comment").in("spot_id", [SPOT_A, SPOT_B, SPOT_C]);
  check("exactly the 4 accepted updates landed", ups?.length === 4, `got ${ups?.length}`);
  check("comment stored trimmed", ups?.some((u) => u.comment === "test comment"));
} finally {
  await cleanup();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

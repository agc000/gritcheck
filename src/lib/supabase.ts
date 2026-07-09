import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Public, RLS-scoped client. The anon key is safe in the browser bundle: RLS
// (§3.5) is what actually guards the data — anon can SELECT public rows and
// nothing else. Writes to `updates` go through the Edge Function (Phase 4), and
// the service_role key never appears here or anywhere client-reachable.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — set them in .env.local",
  );
}

export const supabase = createClient<Database>(url, anonKey);

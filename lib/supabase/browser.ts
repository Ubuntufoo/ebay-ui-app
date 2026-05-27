"use client";

import {createClient, type SupabaseClient} from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;
let cachedClientKey: string | null = null;

export function getSupabaseBrowserClient(url: string, anonKey: string) {
  const clientKey = `${url}::${anonKey}`;

  if (!cachedClient || cachedClientKey !== clientKey) {
    cachedClient = createClient(url, anonKey);
    cachedClientKey = clientKey;
  }

  return cachedClient;
}

export function getListingsRealtimePublicKey(env: NodeJS.ProcessEnv = process.env) {
  return env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY ?? null;
}

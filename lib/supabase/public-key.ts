function decodeJwtPayload(token: string) {
  const segments = token.split(".");

  if (segments.length < 2) {
    return null;
  }

  try {
    const payload = segments[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(segments[1].length / 4) * 4, "=");

    return JSON.parse(Buffer.from(payload, "base64").toString("utf8")) as {
      role?: unknown;
    };
  } catch {
    return null;
  }
}

export function getListingsRealtimePublicKey(env: NodeJS.ProcessEnv = process.env) {
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (publishableKey) {
    return publishableKey;
  }

  const nextPublicAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (nextPublicAnonKey) {
    return nextPublicAnonKey;
  }

  const legacyAnonKey = env.SUPABASE_ANON_KEY?.trim();

  if (!legacyAnonKey) {
    return null;
  }

  return decodeJwtPayload(legacyAnonKey)?.role === "anon" ? legacyAnonKey : null;
}

export function getListingsRealtimePublicUrl(env: NodeJS.ProcessEnv = process.env) {
  return env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? env.SUPABASE_URL?.trim() ?? null;
}

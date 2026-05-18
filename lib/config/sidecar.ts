export interface SidecarConfig {
  apiUrl: string;
  bearerToken?: string;
}

export function getSidecarConfig(env: NodeJS.ProcessEnv = process.env): SidecarConfig {
  const apiUrl = env.SIDECAR_API_URL?.replace(/\/+$/, "");

  if (!apiUrl) {
    throw new Error(
      "Missing SIDECAR_API_URL. Set it explicitly for the sidecar, for example http://localhost:3001 when the UI runs on port 3000."
    );
  }

  return {
    apiUrl,
    bearerToken: env.SIDECAR_API_BEARER_TOKEN,
  };
}

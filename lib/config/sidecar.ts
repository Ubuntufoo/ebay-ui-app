const DEFAULT_SIDECAR_API_URL = "http://localhost:3000";

export interface SidecarConfig {
  apiUrl: string;
  bearerToken?: string;
}

export function getSidecarConfig(env: NodeJS.ProcessEnv = process.env): SidecarConfig {
  return {
    apiUrl: (env.SIDECAR_API_URL || DEFAULT_SIDECAR_API_URL).replace(/\/+$/, ""),
    bearerToken: env.SIDECAR_API_BEARER_TOKEN,
  };
}

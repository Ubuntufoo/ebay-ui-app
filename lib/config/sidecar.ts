export interface SidecarConfig {
  apiUrl: string;
  bearerToken?: string;
}

function assertSidecarUrl(apiUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(apiUrl);
  } catch {
    throw new Error("SIDECAR_API_URL must be a valid http(s) URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("SIDECAR_API_URL must use http or https.");
  }
}

export function getSidecarConfig(env: NodeJS.ProcessEnv = process.env): SidecarConfig {
  const apiUrl = env.SIDECAR_API_URL?.replace(/\/+$/, "");

  if (!apiUrl) {
    throw new Error(
      "Missing SIDECAR_API_URL. Set it explicitly to http://localhost:3002 for the feature-branch Sidecar; the UI listens on port 3000."
    );
  }

  assertSidecarUrl(apiUrl);

  return {
    apiUrl,
    bearerToken: env.SIDECAR_API_BEARER_TOKEN,
  };
}

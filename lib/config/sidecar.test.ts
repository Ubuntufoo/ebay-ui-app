import {describe, expect, it} from "vitest";

import {getSidecarConfig} from "@/lib/config/sidecar";

describe("getSidecarConfig", () => {
  it("requires the feature-branch Sidecar endpoint explicitly", () => {
    expect(getSidecarConfig({NODE_ENV: "test", SIDECAR_API_URL: "http://localhost:3002/"})).toEqual({
      apiUrl: "http://localhost:3002",
      bearerToken: undefined,
    });
  });

  it("allows a valid explicitly configured Sidecar endpoint on another port", () => {
    expect(getSidecarConfig({NODE_ENV: "test", SIDECAR_API_URL: "http://localhost:3001"}).apiUrl).toBe(
      "http://localhost:3001",
    );
    expect(getSidecarConfig({NODE_ENV: "test", SIDECAR_API_URL: "http://[::1]:3001"}).apiUrl).toBe(
      "http://[::1]:3001",
    );
  });

  it("rejects non-HTTP Sidecar URLs", () => {
    expect(() => getSidecarConfig({NODE_ENV: "test", SIDECAR_API_URL: "ftp://localhost:3002"})).toThrow(
      "SIDECAR_API_URL must use http or https",
    );
  });

  it("fails closed when the endpoint is missing", () => {
    expect(() => getSidecarConfig({NODE_ENV: "test"})).toThrow("Missing SIDECAR_API_URL");
  });
});

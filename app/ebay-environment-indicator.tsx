"use client";

import {useEffect, useState} from "react";

import type {EbayEnvironment} from "@/lib/sidecar-api";

type LoadState = {
  environment: EbayEnvironment["environment"];
} | null;

export function EbayEnvironmentIndicator() {
  const [state, setState] = useState<LoadState>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadEnvironment() {
      try {
        const response = await fetch("/api/ebay-environment", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as Partial<EbayEnvironment>;

        if (payload.environment === "sandbox" || payload.environment === "production") {
          setState({environment: payload.environment});
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    void loadEnvironment();

    return () => {
      controller.abort();
    };
  }, []);

  if (state?.environment !== "sandbox") {
    return null;
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-50 border-2 border-red-600"
      />
      <div className="pointer-events-none fixed right-3 top-3 z-50 rounded-full border border-red-700 bg-red-600 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-white shadow-[0_8px_24px_rgba(185,28,28,0.32)]">
        SANDBOX
      </div>
    </>
  );
}

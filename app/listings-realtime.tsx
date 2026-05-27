"use client";

import {useEffect, useState} from "react";

import {ListingsTableEditable} from "@/app/listings-table-editable";
import type {Listing} from "@/lib/sidecar-api";

type ListingsRealtimeProps = {
  initialListings: Listing[];
  refreshIntervalMs?: number;
  refreshPath?: string;
};

export function ListingsRealtime({
  initialListings,
  refreshIntervalMs = 3000,
  refreshPath = "/api/listings",
}: ListingsRealtimeProps) {
  const [listings, setListings] = useState(() => initialListings);

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();
    let inFlight = false;

    async function refreshListings() {
      if (inFlight) {
        return;
      }

      inFlight = true;

      try {
        const response = await fetch(refreshPath, {
          cache: "no-store",
          signal: abortController.signal,
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {listings?: Listing[]};

        if (!cancelled && Array.isArray(payload.listings)) {
          setListings(payload.listings);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      } finally {
        inFlight = false;
      }
    }

    void refreshListings();
    const intervalId = window.setInterval(() => {
      void refreshListings();
    }, refreshIntervalMs);

    return () => {
      cancelled = true;
      abortController.abort();
      window.clearInterval(intervalId);
    };
  }, [refreshIntervalMs, refreshPath]);

  return <ListingsTableEditable listings={listings} />;
}

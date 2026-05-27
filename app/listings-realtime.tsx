"use client";

import {useEffect, useState} from "react";

import {ListingsTableEditable} from "@/app/listings-table-editable";
import type {Listing} from "@/lib/sidecar-api";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

type ListingsRealtimeProps = {
  initialListings: Listing[];
  realtimeAnonKey?: string | null;
  realtimeDebounceMs?: number;
  refreshPath?: string;
  realtimeSchema?: string;
  realtimeTable?: string;
  realtimeUrl?: string | null;
};

export function ListingsRealtime({
  initialListings,
  realtimeAnonKey = null,
  realtimeDebounceMs = 200,
  refreshPath = "/api/listings",
  realtimeSchema = "public",
  realtimeTable = "listings",
  realtimeUrl = null,
}: ListingsRealtimeProps) {
  const [listings, setListings] = useState(() => initialListings);

  useEffect(() => {
    if (!realtimeUrl || !realtimeAnonKey) {
      return;
    }

    const supabase = getSupabaseBrowserClient(realtimeUrl, realtimeAnonKey);
    let cancelled = false;
    let inFlight = false;
    let queuedRefresh = false;
    let timeoutId: number | null = null;
    let abortController: AbortController | null = null;

    async function refreshListings() {
      if (cancelled) {
        return;
      }

      if (inFlight) {
        queuedRefresh = true;
        return;
      }

      inFlight = true;
      abortController = new AbortController();

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
        abortController = null;

        if (queuedRefresh) {
          queuedRefresh = false;
          scheduleRefresh();
        }
      }
    }

    function scheduleRefresh() {
      if (cancelled) {
        return;
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        void refreshListings();
      }, realtimeDebounceMs);
    }

    const channel = supabase
      .channel(`listings-realtime:${realtimeSchema}:${realtimeTable}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: realtimeSchema,
          table: realtimeTable,
        },
        () => {
          scheduleRefresh();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      abortController?.abort();

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      void supabase.removeChannel(channel);
    };
  }, [
    realtimeAnonKey,
    realtimeDebounceMs,
    realtimeSchema,
    realtimeTable,
    realtimeUrl,
    refreshPath,
  ]);

  return <ListingsTableEditable listings={listings} />;
}

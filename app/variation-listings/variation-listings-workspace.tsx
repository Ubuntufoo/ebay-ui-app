"use client";

import {useCallback, useEffect, useMemo, useState} from "react";

import type {
  VariationListingGroup,
  VariationListingGroupsResponse,
} from "@/lib/sidecar-api";

type VariationListingsWorkspaceProps = {
  initialGroups: VariationListingGroup[];
  refreshIntervalMs?: number;
  refreshPath?: string;
};

function formatLifecycle(value: string): string {
  return value.replaceAll("-", " ");
}

function GroupCard({group}: {group: VariationListingGroup}) {
  const blockerCount = group.validation.blockers.length;
  const latestRevision = group.journal.latestRevision;

  return (
    <article className="rounded-[1.5rem] border border-stone-950/10 bg-white p-5 shadow-[0_12px_32px_rgba(28,25,23,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
            {group.skuNamespace.categoryCode} · {group.skuNamespace.bucketToken}
          </p>
          <h2 className="mt-1 truncate text-xl font-semibold tracking-[-0.02em] text-stone-950">
            {group.title || group.skuNamespace.bucketToken}
          </h2>
        </div>
        <span className="rounded-full border border-stone-950/10 bg-stone-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-stone-700">
          {formatLifecycle(group.lifecycleState)}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-stone-50 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">
            Variations
          </p>
          <p className="mt-1 text-lg font-semibold">{group.variationCount}</p>
        </div>
        <div className="rounded-xl bg-stone-50 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">
            Available
          </p>
          <p className="mt-1 text-lg font-semibold">
            {group.totalAvailableQuantity}
          </p>
        </div>
        <div className="rounded-xl bg-stone-50 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">
            Desired rev
          </p>
          <p className="mt-1 text-lg font-semibold">{group.desiredRevision}</p>
        </div>
        <div className="rounded-xl bg-stone-50 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">
            Confirmed rev
          </p>
          <p className="mt-1 text-lg font-semibold">
            {group.lastConfirmedRevision ?? "—"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        {group.validation.hasPendingChanges ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">
            Pending changes
          </span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900">
            No pending changes
          </span>
        )}
        {group.validation.initialPublicationReady ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900">
            Initial publish ready
          </span>
        ) : null}
        {blockerCount > 0 ? (
          <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-900">
            {blockerCount} blocker{blockerCount === 1 ? "" : "s"}
          </span>
        ) : null}
        {latestRevision?.hasUnknownOutcome ? (
          <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-900">
            Reconciliation required
          </span>
        ) : null}
      </div>
    </article>
  );
}

export function VariationListingsWorkspace({
  initialGroups,
  refreshIntervalMs = 3_000,
  refreshPath = "/api/variation-listings",
}: VariationListingsWorkspaceProps) {
  const [groups, setGroups] = useState(() => initialGroups);
  const [refreshFailed, setRefreshFailed] = useState(false);

  const refreshGroups = useCallback(async (signal: AbortSignal) => {
    try {
      const response = await fetch(refreshPath, {cache: "no-store", signal});
      if (!response.ok) {
        if (!signal.aborted) {
          setRefreshFailed(true);
        }
        return;
      }

      const payload = (await response.json()) as VariationListingGroupsResponse;
      if (!signal.aborted && Array.isArray(payload.groups)) {
        setGroups(payload.groups);
        setRefreshFailed(false);
      } else if (!signal.aborted) {
        setRefreshFailed(true);
      }
    } catch (error) {
      if (signal.aborted) {
        return;
      }
      setRefreshFailed(true);
    }
  }, [refreshPath]);

  useEffect(() => {
    if (refreshIntervalMs <= 0) {
      return;
    }

    let cancelled = false;
    let controller: AbortController | null = null;
    let timeoutId: number | null = null;

    const scheduleRefresh = () => {
      timeoutId = window.setTimeout(async () => {
        controller = new AbortController();
        await refreshGroups(controller.signal);
        controller = null;

        if (!cancelled) {
          scheduleRefresh();
        }
      }, refreshIntervalMs);
    };

    scheduleRefresh();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      controller?.abort();
    };
  }, [refreshGroups, refreshIntervalMs]);

  const totals = useMemo(
    () => ({
      variations: groups.reduce((sum, group) => sum + group.variationCount, 0),
      available: groups.reduce(
        (sum, group) => sum + group.totalAvailableQuantity,
        0,
      ),
    }),
    [groups],
  );

  return (
    <div className="space-y-5">
      <header className="rounded-[1.75rem] border border-stone-950/10 bg-stone-950 px-5 py-5 text-stone-50 shadow-[0_16px_42px_rgba(28,25,23,0.16)] sm:px-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-300 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-stone-950">
              Separate mode
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-300">
              Variation listings
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            Variation listing workspace
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-300 sm:text-base">
            Group-based card inventory is isolated from the standard Single/Lot
            listing workflow. Prices remain manual and changes are staged per
            variation listing group.
          </p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-stone-950/10 bg-white/85 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">
            Groups
          </p>
          <p className="mt-1 text-2xl font-semibold">{groups.length}</p>
        </div>
        <div className="rounded-2xl border border-stone-950/10 bg-white/85 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">
            Variations
          </p>
          <p className="mt-1 text-2xl font-semibold">{totals.variations}</p>
        </div>
        <div className="rounded-2xl border border-stone-950/10 bg-white/85 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">
                Available copies
              </p>
              <p className="mt-1 text-2xl font-semibold">{totals.available}</p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                refreshFailed
                  ? "bg-rose-100 text-rose-800"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {refreshFailed ? "Refresh issue" : "Live refresh"}
            </span>
          </div>
        </div>
      </section>

      {groups.length === 0 ? (
        <section className="flex min-h-[20rem] items-center justify-center rounded-[1.75rem] border border-dashed border-stone-950/15 bg-white/65 px-6 text-center">
          <div className="max-w-lg">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-stone-500">
              No variation listing groups
            </p>
            <p className="mt-3 text-lg leading-8 text-stone-700">
              This workspace is ready for group inventory. Bucket creation and
              sticky capture targeting are added in the next workflow slice.
            </p>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {groups.map((group) => (
            <GroupCard key={group.groupId} group={group} />
          ))}
        </section>
      )}
    </div>
  );
}

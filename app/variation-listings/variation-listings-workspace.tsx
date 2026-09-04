"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";

import {VariationInventoryPanel} from "@/app/variation-listings/variation-inventory-panel";
import {VariationGroupReviewPanel} from "@/app/variation-listings/variation-group-review-panel";
import {VariationPublicationPanel} from "@/app/variation-listings/variation-publication-panel";

import type {
  CreateVariationListingGroupInput,
  VariationListingConditionToken,
  VariationListingGroup,
  VariationListingGroupsResponse,
  VariationListingIntakeSession,
  VariationListingManualPriceAmount,
  VariationListingSkuCategoryCode,
  VariationListingVariation,
} from "@/lib/sidecar-api";

export type VariationListingCreationDefaults = {
  merchantLocationKey: string | null;
  fulfillmentPolicyId: string | null;
  paymentPolicyId: string | null;
  returnPolicyId: string | null;
};

type VariationListingsWorkspaceProps = {
  creationDefaults?: VariationListingCreationDefaults;
  initialGroups: VariationListingGroup[];
  initialIntakeError?: string | null;
  initialIntakeSession?: VariationListingIntakeSession | null;
  refreshIntervalMs?: number;
  refreshPath?: string;
};

const MANUAL_PRICE_TIERS: readonly VariationListingManualPriceAmount[] = [
  0.99,
  1.49,
  1.99,
  2.49,
];

const CONDITION_OPTIONS: ReadonlyArray<{
  label: string;
  value: VariationListingConditionToken;
}> = [
  {label: "Near mint or better", value: "NEAR_MINT_OR_BETTER"},
  {label: "Excellent", value: "EXCELLENT"},
  {label: "Very good", value: "VERY_GOOD"},
  {label: "Poor", value: "POOR"},
];

const CONDITION_RANK = new Map(
  CONDITION_OPTIONS.map((option, index) => [option.value, index]),
);

function compatibleCopyConditionOptions(
  groupCondition: string | null | undefined,
): ReadonlyArray<{label: string; value: VariationListingConditionToken}> {
  const groupRank = CONDITION_RANK.get(groupCondition as VariationListingConditionToken);
  if (groupRank === undefined) return [];
  return CONDITION_OPTIONS.filter((option) => CONDITION_RANK.get(option.value)! <= groupRank);
}

function isConditionToken(value: string | null | undefined): value is VariationListingConditionToken {
  return value !== null && value !== undefined && CONDITION_RANK.has(value as VariationListingConditionToken);
}

const EMPTY_CREATION_DEFAULTS: VariationListingCreationDefaults = {
  merchantLocationKey: null,
  fulfillmentPolicyId: null,
  paymentPolicyId: null,
  returnPolicyId: null,
};

function formatLifecycle(value: string): string {
  return value.replaceAll("-", " ");
}

function formatCondition(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPrice(value: VariationListingManualPriceAmount): string {
  return `$${value.toFixed(2)}`;
}

function creationDefaultsReady(
  defaults: VariationListingCreationDefaults,
): defaults is Record<keyof VariationListingCreationDefaults, string> {
  return Object.values(defaults).every(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
}

function preferCurrentGroup(
  current: VariationListingGroup,
  incoming: VariationListingGroup,
): boolean {
  if (current.desiredRevision !== incoming.desiredRevision) {
    return current.desiredRevision > incoming.desiredRevision;
  }
  const currentConfirmed = current.lastConfirmedRevision ?? -1;
  const incomingConfirmed = incoming.lastConfirmedRevision ?? -1;
  if (currentConfirmed !== incomingConfirmed) return currentConfirmed > incomingConfirmed;
  const currentUpdated = Date.parse(current.updatedAt);
  const incomingUpdated = Date.parse(incoming.updatedAt);
  return Number.isFinite(currentUpdated) && Number.isFinite(incomingUpdated) && currentUpdated > incomingUpdated;
}

function isVariationListingGroup(value: unknown): value is VariationListingGroup {
  if (!value || typeof value !== "object") return false;
  const group = value as Partial<VariationListingGroup>;
  const latest = group.journal && typeof group.journal === "object" ? group.journal.latestRevision : null;
  const confirmed = group.lastConfirmedRevision;
  return typeof group.groupId === "string" && group.groupId.length > 0 &&
    Number.isInteger(group.desiredRevision) && (group.desiredRevision ?? -1) >= 0 &&
    (confirmed === null || (typeof confirmed === "number" && Number.isInteger(confirmed) && confirmed >= 0)) &&
    typeof group.lifecycleState === "string" && typeof group.updatedAt === "string" && Number.isFinite(Date.parse(group.updatedAt)) &&
    !!group.validation && Array.isArray(group.validation.blockers) && typeof group.validation.initialPublicationReady === "boolean" && typeof group.validation.hasPendingChanges === "boolean" &&
    !!group.journal && (latest === null || (typeof latest === "object" && typeof latest.revisionId === "string" && Number.isInteger(latest.capturedDesiredRevision) && Array.isArray(latest.operations)));
}

function mergeGroupsByDesiredRevision(
  currentGroups: VariationListingGroup[],
  incomingGroups: VariationListingGroup[],
): VariationListingGroup[] {
  const currentById = new Map(currentGroups.map((group) => [group.groupId, group]));
  return incomingGroups.map((incoming) => {
    const current = currentById.get(incoming.groupId);
    return current && preferCurrentGroup(current, incoming) ? current : incoming;
  });
}

function GroupCard({
  group,
  isSelected,
  onSelect,
  selectionLocked,
}: {
  group: VariationListingGroup;
  isSelected: boolean;
  onSelect: () => void;
  selectionLocked: boolean;
}) {
  const blockerCount = group.validation.blockers.length;
  const latestRevision = group.journal.latestRevision;

  return (
    <article
      className={`rounded-[1.5rem] border bg-white p-5 shadow-[0_12px_32px_rgba(28,25,23,0.08)] transition ${
        isSelected
          ? "border-amber-400 ring-2 ring-amber-300/60"
          : "border-stone-950/10"
      }`}
    >
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
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Variations</p>
          <p className="mt-1 text-lg font-semibold">{group.variationCount}</p>
        </div>
        <div className="rounded-xl bg-stone-50 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Available</p>
          <p className="mt-1 text-lg font-semibold">{group.totalAvailableQuantity}</p>
        </div>
        <div className="rounded-xl bg-stone-50 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Desired rev</p>
          <p className="mt-1 text-lg font-semibold">{group.desiredRevision}</p>
        </div>
        <div className="rounded-xl bg-stone-50 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Confirmed rev</p>
          <p className="mt-1 text-lg font-semibold">{group.lastConfirmedRevision ?? "—"}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        {group.validation.hasPendingChanges ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">Pending changes</span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900">No pending changes</span>
        )}
        {group.validation.initialPublicationReady ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900">Initial publish ready</span>
        ) : null}
        {blockerCount > 0 ? (
          <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-900">
            {blockerCount} blocker{blockerCount === 1 ? "" : "s"}
          </span>
        ) : null}
        {latestRevision?.recovery?.requiresReconciliation ? (
          <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-900">Reconciliation required</span>
        ) : null}
      </div>

      <button
        type="button"
        aria-pressed={isSelected}
        onClick={onSelect}
        disabled={selectionLocked}
        className={`mt-5 rounded-full px-4 py-2 text-sm font-bold transition ${
          isSelected
            ? "bg-amber-300 text-stone-950"
            : "bg-stone-950 text-stone-50 hover:bg-stone-800"
        }`}
      >
        {isSelected ? "Selected bucket" : "Select bucket"}
      </button>
    </article>
  );
}

export function VariationListingsWorkspace({
  creationDefaults = EMPTY_CREATION_DEFAULTS,
  initialGroups,
  initialIntakeError = null,
  initialIntakeSession = null,
  refreshIntervalMs = 3_000,
  refreshPath = "/api/variation-listings",
}: VariationListingsWorkspaceProps) {
  const initialTargetGroupId = initialIntakeSession?.targetGroupId ?? initialGroups[0]?.groupId;
  const initialGroupCondition = initialGroups.find((group) => group.groupId === initialTargetGroupId)?.conditionToken;
  const initialCopyConditionToken = isConditionToken(initialIntakeSession?.copyConditionToken)
    ? initialIntakeSession.copyConditionToken
    : isConditionToken(initialGroupCondition)
      ? initialGroupCondition
      : null;
  const [groups, setGroups] = useState(() => initialGroups);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    () => initialIntakeSession?.targetGroupId ?? initialGroups[0]?.groupId ?? null,
  );
  const [stickyPriceAmount, setStickyPriceAmount] =
    useState<VariationListingManualPriceAmount>(
      () => initialIntakeSession?.stickyPriceAmount ?? 0.99,
    );
  const [intakeSession, setIntakeSession] = useState<VariationListingIntakeSession | null>(
    initialIntakeSession,
  );
  const [intakeError, setIntakeError] = useState<string | null>(initialIntakeError);
  const [intakeStatus, setIntakeStatus] = useState<"idle" | "loading" | "configuring">(
    "idle",
  );
  const intakeWriteInFlightRef = useRef(false);
  const intakeGenerationRef = useRef(0);
  const [skuBucketToken, setSkuBucketToken] = useState("");
  const [skuCategoryCode, setSkuCategoryCode] =
    useState<VariationListingSkuCategoryCode>("BSKBL");
  const [conditionToken, setConditionToken] =
    useState<VariationListingConditionToken>("VERY_GOOD");
  const [copyConditionToken, setCopyConditionToken] =
    useState<VariationListingConditionToken | null>(() => initialCopyConditionToken);
  const [createStatus, setCreateStatus] = useState<"idle" | "creating" | "error">("idle");
  const [createError, setCreateError] = useState<string | null>(null);

  const refreshIntakeSession = useCallback(async (signal?: AbortSignal) => {
    if (intakeWriteInFlightRef.current) return;
    const generation = ++intakeGenerationRef.current;
    setIntakeStatus("loading");
    try {
      const response = await fetch("/api/variation-listings/intake-session", {
        cache: "no-store",
        signal,
      });
      if (!response.ok) {
        throw new Error(`Intake session refresh failed (${response.status}).`);
      }
      const payload = (await response.json().catch(() => null)) as {session?: VariationListingIntakeSession | null} | null;
      if (!payload || typeof payload !== "object" || !("session" in payload)) {
        throw new Error("Intake session response was malformed.");
      }
      if (
        !signal?.aborted &&
        !intakeWriteInFlightRef.current &&
        generation === intakeGenerationRef.current
      ) {
        setIntakeSession(payload.session ?? null);
        setStickyPriceAmount(payload.session?.stickyPriceAmount ?? 0.99);
        if (payload.session?.mode === "duplicate_copy" && payload.session.targetGroupId) {
          setSelectedGroupId(payload.session.targetGroupId);
        }
        setIntakeError(null);
      }
    } catch (error) {
      if (!signal?.aborted && generation === intakeGenerationRef.current) {
        setIntakeError(error instanceof Error ? error.message : "Unable to load intake session.");
      }
    } finally {
      if (
        !signal?.aborted &&
        !intakeWriteInFlightRef.current &&
        generation === intakeGenerationRef.current
      ) {
        setIntakeStatus("idle");
      }
    }
  }, []);

  const refreshGroups = useCallback(async (signal: AbortSignal) => {
    try {
      const response = await fetch(refreshPath, {cache: "no-store", signal});
      if (!response.ok) {
        if (!signal.aborted) setRefreshFailed(true);
        return;
      }

      const payload = (await response.json()) as VariationListingGroupsResponse;
      const incomingGroups = payload && Array.isArray(payload.groups) && payload.groups.every(isVariationListingGroup)
        ? payload.groups
        : null;
      if (!signal.aborted && incomingGroups) {
        setGroups((current) => mergeGroupsByDesiredRevision(current, incomingGroups));
        setRefreshFailed(false);
      } else if (!signal.aborted) {
        setRefreshFailed(true);
      }
    } catch {
      if (!signal.aborted) setRefreshFailed(true);
    }
  }, [refreshPath]);

  useEffect(() => {
    if (refreshIntervalMs <= 0) return;

    let cancelled = false;
    let controller: AbortController | null = null;
    let timeoutId: number | null = null;

    const scheduleRefresh = () => {
      timeoutId = window.setTimeout(async () => {
        controller = new AbortController();
        await refreshGroups(controller.signal);
        await refreshIntakeSession(controller.signal);
        controller = null;
        if (!cancelled) scheduleRefresh();
      }, refreshIntervalMs);
    };

    scheduleRefresh();
    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      controller?.abort();
    };
  }, [refreshGroups, refreshIntakeSession, refreshIntervalMs]);

  const totals = useMemo(
    () => ({
      variations: groups.reduce((sum, group) => sum + group.variationCount, 0),
      available: groups.reduce((sum, group) => sum + group.totalAvailableQuantity, 0),
      pending: groups.filter((group) => group.validation.hasPendingChanges).length,
      confirmed: groups.filter((group) => group.lastConfirmedRevision !== null).length,
    }),
    [groups],
  );
  const selectedGroup = useMemo(
    () => groups.find((group) => group.groupId === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );
  const armedGroup = useMemo(
    () =>
      intakeSession?.targetGroupId
        ? groups.find((group) => group.groupId === intakeSession.targetGroupId) ?? null
        : null,
    [groups, intakeSession],
  );
  const isArmed = intakeSession?.mode === "new_variation" && intakeSession.targetGroupId !== null;
  const duplicateMode = intakeSession?.mode === "duplicate_copy";
  const pendingPair = intakeSession?.pendingPair ?? null;
  const writesBlocked = pendingPair !== null || intakeStatus === "configuring" || intakeError !== null;
  const copyConditionOptions = useMemo(
    () => compatibleCopyConditionOptions(selectedGroup?.conditionToken),
    [selectedGroup?.conditionToken],
  );
  const copyConditionValid = copyConditionToken !== null && copyConditionOptions.some((option) => option.value === copyConditionToken);
  const conditionChangesLocked = duplicateMode || writesBlocked;
  const selectionLocked = duplicateMode || writesBlocked;

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (duplicateMode) {
      setCopyConditionToken(intakeSession?.copyConditionToken ?? pendingPair?.conditionToken ?? null);
      return;
    }
    const groupToken = selectedGroup?.conditionToken;
    setCopyConditionToken(
      compatibleCopyConditionOptions(groupToken).some((option) => option.value === groupToken)
        ? (groupToken as VariationListingConditionToken)
        : null,
    );
  }, [duplicateMode, intakeSession?.copyConditionToken, pendingPair?.conditionToken, selectedGroup?.conditionToken]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const defaultsReady = creationDefaultsReady(creationDefaults);
  const normalizedBucketToken = skuBucketToken.trim();
  const bucketTokenValid = /^[A-Za-z0-9]+([._-][A-Za-z0-9]+)*$/.test(normalizedBucketToken);
  const canCreate =
    defaultsReady &&
    normalizedBucketToken.length > 0 &&
    normalizedBucketToken.length <= 32 &&
    normalizedBucketToken !== "Single" &&
    normalizedBucketToken !== "Lot" &&
    bucketTokenValid &&
    createStatus !== "creating";

  const persistIntake = useCallback(
    async (input: {
      mode: "idle" | "new_variation" | "duplicate_copy";
      targetGroupId: string | null;
      targetVariationId: string | null;
      copyConditionToken: VariationListingConditionToken | null;
      stickyPriceAmount: VariationListingManualPriceAmount;
    }) => {
      if (writesBlocked || intakeWriteInFlightRef.current) return;
      const generation = ++intakeGenerationRef.current;
      intakeWriteInFlightRef.current = true;
      setIntakeStatus("configuring");
      try {
        const response = await fetch("/api/variation-listings/intake-session", {
          method: "PATCH",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(input),
        });
        const payload = (await response.json().catch(() => null)) as {
          session?: VariationListingIntakeSession | null;
          error?: string;
        } | null;
        if (!response.ok) {
          throw new Error(payload?.error || `Intake configuration failed (${response.status}).`);
        }
        const session = payload?.session;
        if (!session) throw new Error("Intake configuration returned no session.");
        if (generation === intakeGenerationRef.current) {
          setIntakeSession(session);
          setStickyPriceAmount(session.stickyPriceAmount);
          setIntakeError(null);
        }
      } catch (error) {
        if (generation === intakeGenerationRef.current) {
          setIntakeError(error instanceof Error ? error.message : "Unable to configure intake session.");
        }
      } finally {
        intakeWriteInFlightRef.current = false;
        setIntakeStatus("idle");
      }
    },
    [writesBlocked],
  );

  const retryIntakeSession = useCallback(() => {
    void refreshIntakeSession();
  }, [refreshIntakeSession]);

  const armCapture = useCallback(() => {
    if (!selectedGroupId || duplicateMode) return;
    void persistIntake({
      mode: "new_variation",
      targetGroupId: selectedGroupId,
      targetVariationId: null,
      copyConditionToken: null,
      stickyPriceAmount,
    });
  }, [duplicateMode, persistIntake, selectedGroupId, stickyPriceAmount]);

  const disarmCapture = useCallback(() => {
    void persistIntake({
      mode: "idle",
      targetGroupId: null,
      targetVariationId: null,
      copyConditionToken: null,
      stickyPriceAmount,
    });
  }, [persistIntake, stickyPriceAmount]);

  const armDuplicateCapture = useCallback(
    (variation: VariationListingVariation) => {
      if (!selectedGroup || duplicateMode || writesBlocked || intakeWriteInFlightRef.current || !copyConditionValid) return;
      void persistIntake({
        mode: "duplicate_copy",
        targetGroupId: selectedGroup.groupId,
        targetVariationId: variation.variationId,
        copyConditionToken,
        stickyPriceAmount: variation.priceAmount,
      });
    },
    [copyConditionToken, copyConditionValid, duplicateMode, persistIntake, selectedGroup, writesBlocked],
  );

  const replaceGroup = useCallback((updatedGroup: VariationListingGroup) => {
    setGroups((current) =>
      current.map((group) =>
        group.groupId === updatedGroup.groupId && !preferCurrentGroup(group, updatedGroup)
          ? updatedGroup
          : group,
      ),
    );
  }, []);

  const selectPrice = useCallback(
    (price: VariationListingManualPriceAmount) => {
      const mode = intakeSession?.mode === "new_variation" ? "new_variation" : "idle";
      const targetGroupId = mode === "new_variation" ? intakeSession?.targetGroupId ?? null : null;
      if (intakeSession?.mode === "duplicate_copy") return;
      void persistIntake({
        mode,
        targetGroupId,
        targetVariationId: null,
        copyConditionToken: null,
        stickyPriceAmount: price,
      });
    },
    [intakeSession, persistIntake],
  );

  const createGroup = useCallback(async () => {
    if (!canCreate || !creationDefaultsReady(creationDefaults)) return;

    setCreateStatus("creating");
    setCreateError(null);
    const input: CreateVariationListingGroupInput = {
      skuCategoryCode,
      skuBucketToken: normalizedBucketToken,
      merchantLocationKey: creationDefaults.merchantLocationKey.trim(),
      fulfillmentPolicyId: creationDefaults.fulfillmentPolicyId.trim(),
      paymentPolicyId: creationDefaults.paymentPolicyId.trim(),
      returnPolicyId: creationDefaults.returnPolicyId.trim(),
      conditionId: "4000",
      conditionToken,
    };

    try {
      const response = await fetch("/api/variation-listings", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {error?: string} | null;
        throw new Error(payload?.error || `Bucket creation failed (${response.status}).`);
      }

      const created = (await response.json()) as VariationListingGroup;
      setGroups((current) => [created, ...current.filter((group) => group.groupId !== created.groupId)]);
      setSelectedGroupId(created.groupId);
      setSkuBucketToken("");
      setCreateStatus("idle");
    } catch (error) {
      setCreateStatus("error");
      setCreateError(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while creating the bucket.",
      );
    }
  }, [canCreate, conditionToken, creationDefaults, normalizedBucketToken, skuCategoryCode]);

  return (
    <div className="space-y-5">
      <header className="rounded-[1.75rem] border border-stone-950/10 bg-stone-950 px-5 py-5 text-stone-50 shadow-[0_16px_42px_rgba(28,25,23,0.16)] sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-amber-300 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-stone-950">Separate mode</span>
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-300">Variation listings</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Variation listing workspace</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-300 sm:text-base">
              Select a long-lived inventory bucket and manual intake price before capturing cards. Variation intake stays isolated from Single/Lot.
            </p>
          </div>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-stone-200">Manual pricing only</span>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-[1.5rem] border border-stone-950/10 bg-white/90 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">Capture setup</p>
              <h2 className="mt-1 text-xl font-semibold">Sticky target and price</h2>
            </div>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">
              {pendingPair ? "Pair pending" : isArmed ? "Capture armed" : duplicateMode ? "Duplicate mode" : selectedGroup ? "Bucket selected" : "No bucket selected"}
            </span>
          </div>

          <div className="mt-4 rounded-2xl bg-stone-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Selected bucket</p>
            <p className="mt-1 text-lg font-semibold text-stone-950">
              {selectedGroup ? selectedGroup.title || selectedGroup.skuNamespace.bucketToken : "Select a bucket below"}
            </p>
            {selectedGroup ? (
              <p className="mt-1 text-sm text-stone-600">
                {selectedGroup.variationCount} variation{selectedGroup.variationCount === 1 ? "" : "s"} · {selectedGroup.totalAvailableQuantity} available · {selectedGroup.validation.hasPendingChanges ? "pending changes" : "synced"}
              </p>
            ) : null}
          </div>

          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">Armed target</p>
            <p className="mt-1 text-lg font-semibold text-amber-950">
              {isArmed ? armedGroup?.title || armedGroup?.skuNamespace.bucketToken || intakeSession?.targetGroupId : "Idle"}
            </p>
            {isArmed ? <p className="mt-1 text-sm text-amber-900">{formatPrice(intakeSession?.stickyPriceAmount ?? stickyPriceAmount)} · new variation</p> : null}
            {duplicateMode ? (
              <p className="mt-1 text-sm text-amber-900">
                Existing duplicate-copy mode is active; this workspace can only disarm it.
                {copyConditionToken ? ` Condition: ${formatCondition(copyConditionToken)}.` : ""}
              </p>
            ) : null}
          </div>

          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">New-card price tier</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {MANUAL_PRICE_TIERS.map((price) => (
                <button
                  key={price}
                  type="button"
                  aria-pressed={stickyPriceAmount === price}
                  onClick={() => selectPrice(price)}
                  disabled={writesBlocked || duplicateMode}
                  className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                    stickyPriceAmount === price
                      ? "border-stone-950 bg-stone-950 text-stone-50"
                      : "border-stone-300 bg-white text-stone-700 hover:border-stone-500"
                  }`}
                >
                  {formatPrice(price)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={armCapture}
              disabled={!selectedGroupId || isArmed && selectedGroupId === intakeSession?.targetGroupId || duplicateMode || writesBlocked}
              className="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-bold text-stone-50 transition enabled:hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600"
            >
              Arm capture
            </button>
            <button
              type="button"
              onClick={disarmCapture}
              disabled={!isArmed && !duplicateMode || writesBlocked}
              className="rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-bold text-stone-700 transition enabled:hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Disarm
            </button>
            <p className="max-w-xl text-xs leading-5 text-stone-500">
              {pendingPair
                ? `Pair ${pendingPair.pairId} is pending from ${pendingPair.frontSourceRef}. Target, mode, and price are locked until the pair completes or is discarded.`
                : intakeError
                  ? "Intake session unavailable. Retry the durable session read before changing capture settings."
                  : isArmed
                    ? `Cards will target ${armedGroup?.title || intakeSession?.targetGroupId} at ${formatPrice(intakeSession?.stickyPriceAmount ?? stickyPriceAmount)}.`
                    : "Capture is idle. Arm the selected bucket to persist a durable target."}
            </p>
            {pendingPair?.mode === "duplicate_copy" && !selectedGroup ? (
              <p className="mt-2 text-xs font-semibold text-amber-900">
                Frozen pending condition: {formatCondition(pendingPair.conditionToken)}
              </p>
            ) : null}
          </div>
          {intakeError ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800">
              <span>{intakeError}</span>
              <button type="button" onClick={retryIntakeSession} className="font-bold underline">Retry intake read</button>
            </div>
          ) : null}
        </div>

        <form
          className="rounded-[1.5rem] border border-stone-950/10 bg-white/90 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void createGroup();
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">New bucket</p>
          <h2 className="mt-1 text-xl font-semibold">Create variation listing</h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            Uses the configured eBay location and policy defaults. The bucket token becomes the stable middle segment of its inventory SKUs.
          </p>

          <label className="mt-4 block text-xs font-bold uppercase tracking-[0.12em] text-stone-600">
            Bucket / SKU token
            <input
              value={skuBucketToken}
              onChange={(event) => setSkuBucketToken(event.target.value)}
              placeholder="McGrady or 2003Topps"
              maxLength={32}
              className="mt-2 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-stone-950 outline-none focus:border-stone-950"
            />
          </label>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-stone-600">
              Category prefix
              <select
                value={skuCategoryCode}
                onChange={(event) => setSkuCategoryCode(event.target.value as VariationListingSkuCategoryCode)}
                className="mt-2 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-stone-950"
              >
                <option value="BSKBL">Basketball</option>
                <option value="BSBL">Baseball</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-stone-600">
              Shared condition
              <select
                value={conditionToken}
                onChange={(event) => setConditionToken(event.target.value as VariationListingConditionToken)}
                className="mt-2 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-stone-950"
              >
                {CONDITION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          {!defaultsReady ? (
            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              Bucket creation is blocked until merchant location plus fulfillment, payment, and return policy defaults are available in App Settings.
            </p>
          ) : null}
          {normalizedBucketToken.length > 0 && !canCreate && defaultsReady && createStatus !== "creating" ? (
            <p className="mt-3 text-xs text-rose-700">
              Use 1–32 letters/numbers with optional `.`, `_`, or `-` separators; `Single` and `Lot` are reserved.
            </p>
          ) : null}
          {createError ? (
            <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800">{createError}</p>
          ) : null}

          <button
            type="submit"
            disabled={!canCreate}
            className="mt-4 rounded-full bg-stone-950 px-5 py-2.5 text-sm font-bold text-stone-50 transition enabled:hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600"
          >
            {createStatus === "creating" ? "Creating…" : "Create bucket"}
          </button>
        </form>
      </section>

      <VariationInventoryPanel
        group={selectedGroup}
        intakeSession={intakeSession}
        writesBlocked={writesBlocked}
        onArmDuplicate={armDuplicateCapture}
        onGroupUpdated={replaceGroup}
        duplicateCaptureAvailable={copyConditionValid}
        copyConditionToken={copyConditionToken}
        copyConditionOptions={copyConditionOptions}
        conditionChangesLocked={conditionChangesLocked}
        onCopyConditionChange={setCopyConditionToken}
        pendingConditionToken={pendingPair?.mode === "duplicate_copy" ? pendingPair.conditionToken : null}
      />

      <VariationGroupReviewPanel
        key={selectedGroup ? `${selectedGroup.groupId}:${selectedGroup.desiredRevision}` : "empty-review"}
        group={selectedGroup}
        writesBlocked={writesBlocked}
        onGroupUpdated={replaceGroup}
      />

      <VariationPublicationPanel
        key={selectedGroup?.groupId ?? "empty"}
        group={selectedGroup}
        capturePending={pendingPair !== null}
        onGroupUpdated={replaceGroup}
      />

      <section className="grid gap-3 sm:grid-cols-5">
        <div className="rounded-2xl border border-stone-950/10 bg-white/85 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Groups</p>
          <p className="mt-1 text-2xl font-semibold">{groups.length}</p>
        </div>
        <div className="rounded-2xl border border-stone-950/10 bg-white/85 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Live groups</p>
          <p className="mt-1 text-2xl font-semibold">{totals.confirmed}</p>
        </div>
        <div className="rounded-2xl border border-stone-950/10 bg-white/85 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Pending groups</p>
          <p className="mt-1 text-2xl font-semibold">{totals.pending}</p>
        </div>
        <div className="rounded-2xl border border-stone-950/10 bg-white/85 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Variations</p>
          <p className="mt-1 text-2xl font-semibold">{totals.variations}</p>
        </div>
        <div className="rounded-2xl border border-stone-950/10 bg-white/85 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Available copies</p>
              <p className="mt-1 text-2xl font-semibold">{totals.available}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${refreshFailed ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
              {refreshFailed ? "Refresh issue" : "Live refresh"}
            </span>
          </div>
        </div>
      </section>

      {groups.length === 0 ? (
        <section className="flex min-h-[15rem] items-center justify-center rounded-[1.75rem] border border-dashed border-stone-950/15 bg-white/65 px-6 text-center">
          <div className="max-w-lg">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-stone-500">No variation listing groups</p>
            <p className="mt-3 text-lg leading-8 text-stone-700">
              Create the first bucket above, then select and arm it as the durable capture target.
            </p>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {groups.map((group) => (
            <GroupCard
              key={group.groupId}
              group={group}
              isSelected={group.groupId === selectedGroupId}
              onSelect={() => {
                if (!selectionLocked) setSelectedGroupId(group.groupId);
              }}
              selectionLocked={selectionLocked}
            />
          ))}
        </section>
      )}
    </div>
  );
}

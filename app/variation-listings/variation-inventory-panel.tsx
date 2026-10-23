"use client";

import {useCallback, useEffect, useRef, useState} from "react";

import type {
  VariationListingConditionToken,
  VariationListingCopy,
  VariationListingGroup,
  VariationListingIntakeSession,
  VariationListingManualPriceAmount,
  VariationListingQuantityStatus,
  VariationListingVariation,
} from "@/lib/sidecar-api";

const MANUAL_PRICE_TIERS: readonly VariationListingManualPriceAmount[] = [
  0.99, 1.49, 1.99, 2.49, 2.99, 3.49, 3.99, 4.49, 4.99,
];

type PriceDraft = {
  amount: VariationListingManualPriceAmount;
  baseRevision: number;
  groupId: string;
};

function isSignedInt32(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
}

function isQuantityAdjustment(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= -4294967295 && value <= 4294967295;
}

function isProjectedQuantity(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value <= 2147483647;
}

function isQuantityStatus(
  value: unknown,
  expectedGroupId: string,
  expectedDesiredRevision: number,
  expectedConfirmedRevision: number,
  expectedVariations: ReadonlyArray<Pick<VariationListingVariation, "variationId" | "sku">>,
): value is VariationListingQuantityStatus {
  if (!value || typeof value !== "object") return false;
  const status = value as Partial<VariationListingQuantityStatus>;
  if (
    status.groupId !== expectedGroupId ||
    status.desiredRevision !== expectedDesiredRevision ||
    status.lastConfirmedRevision !== expectedConfirmedRevision ||
    !Array.isArray(status.variations)
  ) return false;
  const expectedSkus = new Map(expectedVariations.map((variation) => [variation.variationId, variation.sku]));
  const ids = new Set<string>();
  for (const entry of status.variations) {
    if (
      !entry || typeof entry !== "object" ||
      typeof entry.variationId !== "string" || entry.variationId.length === 0 || ids.has(entry.variationId) ||
      typeof entry.sku !== "string" || entry.sku.length === 0 ||
      expectedSkus.get(entry.variationId) !== entry.sku ||
      !isSignedInt32(entry.ebayQuantity) || entry.ebayQuantity < 0 ||
      (entry.soldOutRemovalEligible !== undefined && typeof entry.soldOutRemovalEligible !== "boolean") ||
      !isQuantityAdjustment(entry.pendingAdjustment) ||
      !isProjectedQuantity(entry.afterPublish) ||
      entry.afterPublish !== entry.ebayQuantity + entry.pendingAdjustment
    ) return false;
    ids.add(entry.variationId);
  }
  return true;
}

function isUpdatedRemovalGroup(
  value: unknown,
  group: VariationListingGroup,
  variation: VariationListingVariation,
  remove: boolean,
): value is VariationListingGroup {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<VariationListingGroup>;
  if (
    candidate.groupId !== group.groupId ||
    candidate.desiredRevision !== group.desiredRevision + 1 ||
    typeof candidate.lifecycleState !== "string" ||
    typeof candidate.updatedAt !== "string" ||
    !candidate.validation || typeof candidate.validation !== "object" ||
    !candidate.journal || typeof candidate.journal !== "object" ||
    !Array.isArray(candidate.variations)
  ) return false;
  if (candidate.variations.length !== group.variations.length) return false;
  const expectedSkus = new Map(group.variations.map((row) => [row.variationId, row.sku]));
  const returnedIds = new Set(candidate.variations.map((row) => row?.variationId));
  if (returnedIds.size !== expectedSkus.size || candidate.variations.some((row) => !row || typeof row !== "object" || expectedSkus.get(row.variationId) !== row.sku)) return false;
  const target = candidate.variations.find((row) =>
    row && typeof row === "object" && row.variationId === variation.variationId && row.sku === variation.sku,
  );
  return Boolean(target && (target.pendingRemovalAt != null) === remove);
}

function rebaseQuantityStatus(
  status: VariationListingQuantityStatus | null,
  before: VariationListingGroup,
  after: VariationListingGroup,
): VariationListingQuantityStatus | null {
  if (!status) return null;
  if (
    status.groupId !== before.groupId ||
    after.groupId !== before.groupId ||
    status.desiredRevision !== before.desiredRevision ||
    status.lastConfirmedRevision !== before.lastConfirmedRevision ||
    after.lastConfirmedRevision !== before.lastConfirmedRevision ||
    after.desiredRevision !== before.desiredRevision + 1
  ) return null;
  const beforeById = new Map(before.variations.map((variation) => [variation.variationId, variation]));
  const afterById = new Map(after.variations.map((variation) => [variation.variationId, variation]));
  if (beforeById.size !== afterById.size) return null;
  for (const [variationId, previous] of beforeById) {
    const next = afterById.get(variationId);
    if (!next || next.sku !== previous.sku || next.quantityAdjustmentCounter !== previous.quantityAdjustmentCounter) return null;
  }
  return {...status, desiredRevision: after.desiredRevision};
}

export type RemovalRefreshExpectation = {
  groupId: string;
  variationId: string;
  sku: string;
  originalRevision: number;
  originalConfirmedRevision: number;
  originalPending: boolean;
  requestedPending: boolean;
  variationIdentities: ReadonlyArray<{variationId: string; sku: string}>;
};

type VariationInventoryPanelProps = {
  group: VariationListingGroup | null;
  intakeSession: VariationListingIntakeSession | null;
  writesBlocked: boolean;
  onMutationStateChange: (inFlight: boolean) => void;
  onRefreshGroup: (expected: RemovalRefreshExpectation) => Promise<boolean>;
  onArmDuplicate: (variation: VariationListingVariation) => void;
  onGroupUpdated: (group: VariationListingGroup) => void;
  duplicateCaptureAvailable: boolean;
  copyConditionToken: VariationListingConditionToken | null;
  copyConditionOptions: ReadonlyArray<{label: string; value: VariationListingConditionToken}>;
  conditionChangesLocked: boolean;
  onCopyConditionChange: (value: VariationListingConditionToken) => void;
  pendingConditionToken: VariationListingConditionToken | null;
};

function formatCondition(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function CopyImage({copyId, label, url}: {copyId: string; label: string; url: string | null}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">{label}</p>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer noopener" className="block overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`${label} image for copy ${copyId}`} className="aspect-[3/4] w-full object-contain" />
        </a>
      ) : (
        <div className="flex aspect-[3/4] items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 px-3 text-center text-xs text-stone-500">
          Public image URL unavailable
        </div>
      )}

    </div>
  );
}

function CopyCard({
  copy,
  updating,
  writesBlocked,
  onSetRepresentative,
}: {
  copy: VariationListingCopy;
  updating: boolean;
  writesBlocked: boolean;
  onSetRepresentative: (copyId: string) => void;
}) {
  return (
    <article className={`rounded-2xl border p-3 ${copy.isRepresentative ? "border-amber-400 bg-amber-50/50" : "border-stone-200 bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-stone-900">Copy {copy.copyId.slice(0, 8)}</p>
          <p className="mt-0.5 text-xs text-stone-500">{formatCondition(copy.conditionToken)}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-stone-600">
            Captured copy
          </span>
          {copy.isRepresentative ? (
            <span className="rounded-full bg-amber-200 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-900">Representative</span>
          ) : null}
        </div>
      </div>

      {copy.conditionNotes ? <p className="mt-2 text-xs leading-5 text-stone-600">{copy.conditionNotes}</p> : null}

      <div className="mt-3 grid w-1/2 grid-cols-2 gap-2">
        <CopyImage copyId={copy.copyId} label="Front" url={copy.frontImageUrl} />
        <CopyImage copyId={copy.copyId} label="Back" url={copy.backImageUrl} />
      </div>

      {!copy.isRepresentative ? (
        <button
          type="button"
          onClick={() => onSetRepresentative(copy.copyId)}
          disabled={updating || writesBlocked}
          className="mt-3 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-stone-700 transition enabled:hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {updating ? "Updating…" : "Use as representative"}
        </button>
      ) : null}
    </article>
  );
}

export function VariationInventoryPanel({
  group,
  intakeSession,
  writesBlocked,
  onMutationStateChange,
  onRefreshGroup,
  onArmDuplicate,
  onGroupUpdated,
  duplicateCaptureAvailable,
  copyConditionToken,
  copyConditionOptions,
  conditionChangesLocked,
  onCopyConditionChange,
  pendingConditionToken,
}: VariationInventoryPanelProps) {
  const [representativeWrite, setRepresentativeWrite] = useState<string | null>(null);
  const [selectorDrafts, setSelectorDrafts] = useState<Record<string, string>>({});
  const [selectorWrite, setSelectorWrite] = useState<string | null>(null);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, PriceDraft>>({});
  const [priceWrite, setPriceWrite] = useState<string | null>(null);
  const [quantityWrite, setQuantityWrite] = useState<string | null>(null);
  const [removalWrite, setRemovalWrite] = useState<string | null>(null);
  const [removalConfirm, setRemovalConfirm] = useState<{groupId: string; variationId: string; sku: string; revision: number; stock: boolean; noRestock: boolean} | null>(null);
  const [quantityStatus, setQuantityStatus] = useState<VariationListingQuantityStatus | null>(null);
  const [quantityStatusLoading, setQuantityStatusLoading] = useState(false);
  const [quantityStatusError, setQuantityStatusError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const quantityAutoRefreshKeyRef = useRef<string | null>(null);
  const quantityContextKeyRef = useRef<string | null>(null);
  const quantityRequestIdRef = useRef(0);

  // Preserve edits across same-revision polling, but never carry a draft over
  // to a different group or server revision.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSelectorDrafts({});
    setRemovalConfirm(null);
  }, [group?.groupId, group?.desiredRevision]);

  // Preserve unsaved price choices across polling; clear them on bucket switches.
  useEffect(() => {
    setPriceDrafts({});
  }, [group?.groupId]);

  const quantityVariationIdentityKey = group?.variations
    .map((variation) => `${variation.variationId}:${variation.sku}`)
    .join("|") ?? "null";

  useEffect(() => {
    const contextKey = `${group?.groupId ?? "null"}:${group?.lifecycleState ?? "null"}:${group?.lastConfirmedRevision ?? "null"}:${quantityVariationIdentityKey}`;
    if (quantityContextKeyRef.current === contextKey) return;
    quantityContextKeyRef.current = contextKey;
    quantityRequestIdRef.current += 1;
    setQuantityStatus(null);
    setQuantityStatusError(null);
  }, [group?.groupId, group?.lastConfirmedRevision, group?.lifecycleState, quantityVariationIdentityKey]);

  useEffect(() => {
    if (!writesBlocked || quantityWrite !== null) return;
    quantityRequestIdRef.current += 1;
    setQuantityStatusError(null);
    setQuantityStatusLoading(false);
  }, [quantityWrite, writesBlocked]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const quantityGroupId = group?.groupId ?? null;
  const quantityLifecycleState = group?.lifecycleState ?? null;
  const quantityDesiredRevision = group?.desiredRevision ?? null;
  const quantityConfirmedRevision = group?.lastConfirmedRevision ?? null;

  const loadQuantityStatus = useCallback(async () => {
    if (writesBlocked || !quantityGroupId || quantityLifecycleState !== "active" || quantityConfirmedRevision === null || quantityDesiredRevision === null) {
      setQuantityStatus(null);
      setQuantityStatusError(null);
      return;
    }
    const expectedGroupId = quantityGroupId;
    const expectedDesiredRevision = quantityDesiredRevision;
    const expectedConfirmedRevision = quantityConfirmedRevision;
    const requestId = ++quantityRequestIdRef.current;
    const isCurrentRequest = () => quantityRequestIdRef.current === requestId;
    setQuantityStatusLoading(true);
    setQuantityStatusError(null);
    try {
      const response = await fetch(`/api/variation-listings/${encodeURIComponent(expectedGroupId)}/quantity-status`, {cache: "no-store"});
      const payload = (await response.json().catch(() => null)) as VariationListingQuantityStatus | {error?: string} | null;
      if (!response.ok || !isQuantityStatus(payload, expectedGroupId, expectedDesiredRevision, expectedConfirmedRevision, group?.variations ?? [])) {
        throw new Error(
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" && payload.error
            ? payload.error
            : `Unable to read current eBay quantities (${response.status}).`,
        );
      }
      if (isCurrentRequest()) setQuantityStatus(payload);
    } catch (error) {
      if (isCurrentRequest()) {
        setQuantityStatus(null);
        setQuantityStatusError(error instanceof Error ? error.message : "Unable to read current eBay quantities.");
      }
    } finally {
      if (isCurrentRequest()) setQuantityStatusLoading(false);
    }
  }, [group, quantityConfirmedRevision, quantityDesiredRevision, quantityGroupId, quantityLifecycleState, writesBlocked]);

  useEffect(() => {
    const autoRefreshKey = quantityGroupId && quantityLifecycleState === "active" && quantityConfirmedRevision !== null
      ? `${quantityGroupId}:${quantityConfirmedRevision}`
      : null;
    if (autoRefreshKey === null) {
      quantityAutoRefreshKeyRef.current = null;
      return;
    }
    if (writesBlocked) return;
    if (quantityAutoRefreshKeyRef.current === autoRefreshKey) return;
    quantityAutoRefreshKeyRef.current = autoRefreshKey;
    void loadQuantityStatus();
  }, [loadQuantityStatus, quantityConfirmedRevision, quantityGroupId, quantityLifecycleState, writesBlocked]);

  const setRepresentative = useCallback(
    async (variation: VariationListingVariation, copyId: string) => {
      if (!group || writesBlocked || group.variations.some((item) => item.pendingRemovalAt != null) || representativeWrite || selectorWrite || priceWrite || quantityWrite || removalWrite) return;
      const writeKey = `${variation.variationId}:${copyId}`;
      setRepresentativeWrite(writeKey);
      onMutationStateChange(true);
      setActionError(null);
      try {
        const response = await fetch(
          `/api/variation-listings/${encodeURIComponent(group.groupId)}/variations/${encodeURIComponent(variation.variationId)}/representative-copy`,
          {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
              expectedDesiredRevision: group.desiredRevision,
              copyId,
            }),
          },
        );
        const payload = (await response.json().catch(() => null)) as VariationListingGroup | {error?: string} | null;
        if (!response.ok) {
          throw new Error(
            payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" && payload.error
              ? payload.error
              : `Representative copy update failed (${response.status}).`,
          );
        }
        if (
          !payload ||
          typeof payload !== "object" ||
          !("groupId" in payload) ||
          payload.groupId !== group.groupId ||
          !("desiredRevision" in payload) ||
          !Number.isInteger(payload.desiredRevision) ||
          payload.desiredRevision < 0 ||
          !("variations" in payload) ||
          !Array.isArray(payload.variations)
        ) {
          throw new Error("Representative copy update returned a malformed or mismatched group.");
        }
        setQuantityStatus((current) => {
          const rebased = rebaseQuantityStatus(current, group, payload);
          return rebased ?? current;
        });
        onGroupUpdated(payload);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Unable to update representative copy.");
      } finally {
        setRepresentativeWrite(null);
        onMutationStateChange(false);
      }
    },
    [group, onGroupUpdated, onMutationStateChange, priceWrite, quantityWrite, removalWrite, representativeWrite, selectorWrite, writesBlocked],
  );

  const saveSelectorValue = useCallback(
    async (variation: VariationListingVariation) => {
      if (!group || writesBlocked || group.variations.some((item) => item.pendingRemovalAt != null) || selectorWrite || quantityWrite || priceWrite || representativeWrite || removalWrite) return;
      const selectorValue = (selectorDrafts[variation.variationId] ?? variation.selectorValue).trim();
      if (selectorValue.length > 65) {
        setActionError("Card selector must be 65 characters or fewer for eBay.");
        return;
      }
      if (!selectorValue || selectorValue === variation.selectorValue) return;
      setSelectorWrite(variation.variationId);
      onMutationStateChange(true);
      setActionError(null);
      try {
        const response = await fetch(
          `/api/variation-listings/${encodeURIComponent(group.groupId)}/variations/${encodeURIComponent(variation.variationId)}/selector-value`,
          {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({expectedDesiredRevision: group.desiredRevision, selectorValue}),
          },
        );
        const payload = (await response.json().catch(() => null)) as VariationListingGroup | {error?: string} | null;
        const updatedVariation = payload && typeof payload === "object" && "variations" in payload && Array.isArray(payload.variations)
          ? payload.variations.find((candidate) => candidate && typeof candidate === "object" && "variationId" in candidate && candidate.variationId === variation.variationId)
          : null;
        if (
          !response.ok ||
          !payload ||
          typeof payload !== "object" ||
          !("groupId" in payload) ||
          payload.groupId !== group.groupId ||
          !("desiredRevision" in payload) ||
          !Number.isInteger(payload.desiredRevision) ||
          payload.desiredRevision < group.desiredRevision + 1 ||
          !updatedVariation ||
          !("selectorValue" in updatedVariation) ||
          typeof updatedVariation.selectorValue !== "string"
        ) {
          throw new Error(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" && payload.error
            ? payload.error
            : `Card selector update returned a malformed or stale group (${response.status}).`);
        }
        setQuantityStatus((current) => {
          const rebased = rebaseQuantityStatus(current, group, payload);
          return rebased ?? current;
        });
        setSelectorDrafts((current) => {
          const next = {...current};
          delete next[variation.variationId];
          return next;
        });
        onGroupUpdated(payload);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Unable to update Card selector.");
      } finally {
        setSelectorWrite(null);
        onMutationStateChange(false);
      }
    },
    [group, onGroupUpdated, onMutationStateChange, priceWrite, quantityWrite, removalWrite, representativeWrite, selectorDrafts, selectorWrite, writesBlocked],
  );

  const savePrice = useCallback(
    async (variation: VariationListingVariation) => {
      if (!group || writesBlocked || group.variations.some((item) => item.pendingRemovalAt != null) || removalWrite !== null || priceWrite !== null || quantityWrite !== null || selectorWrite !== null || representativeWrite !== null) return;
      const draft = priceDrafts[variation.variationId]?.groupId === group.groupId
        ? priceDrafts[variation.variationId]
        : undefined;
      if (!draft || draft.amount === variation.priceAmount) return;
      if (!["intake", "draft", "review", "active"].includes(group.lifecycleState)) return;
      const recovery = group.journal.latestRevision?.recovery;
      if (
        (recovery && (recovery.requiresReconciliation || recovery.remoteState === "unknown" || recovery.retryStatus !== "not_applicable")) ||
        group.journal.latestRevision?.operations.some((operation) => ["started", "unknown", "retry_authorized"].includes(operation.state))
      ) return;
      if (draft.baseRevision !== group.desiredRevision) {
        setActionError("This bucket changed since you selected the price. Select the price again against the latest revision.");
        return;
      }
      setPriceWrite(variation.variationId);
      onMutationStateChange(true);
      setActionError(null);
      try {
        const response = await fetch(
          `/api/variation-listings/${encodeURIComponent(group.groupId)}/variations/${encodeURIComponent(variation.variationId)}/price`,
          {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
              expectedDesiredRevision: draft.baseRevision,
              priceAmount: draft.amount,
            }),
          },
        );
        const payload = (await response.json().catch(() => null)) as VariationListingGroup | {error?: string} | null;
        const updatedVariation = payload && typeof payload === "object" && "variations" in payload && Array.isArray(payload.variations)
          ? payload.variations.find((candidate) => candidate && typeof candidate === "object" && "variationId" in candidate && candidate.variationId === variation.variationId)
          : null;
        if (
          !response.ok ||
          !payload || typeof payload !== "object" || !("groupId" in payload) || payload.groupId !== group.groupId ||
          !("desiredRevision" in payload) || payload.desiredRevision !== draft.baseRevision + 1 ||
          !updatedVariation || !("priceAmount" in updatedVariation) || updatedVariation.priceAmount !== draft.amount ||
          !("priceCurrency" in updatedVariation) || updatedVariation.priceCurrency !== "USD"
        ) {
          throw new Error(
            payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" && payload.error
              ? payload.error
              : `Variation price update returned a malformed or stale group (${response.status}).`,
          );
        }
        setQuantityStatus((current) => {
          const rebased = rebaseQuantityStatus(current, group, payload);
          return rebased ?? current;
        });
        setPriceDrafts((current) => {
          const next = {...current};
          delete next[variation.variationId];
          return next;
        });
        onGroupUpdated(payload);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Unable to update variation price.");
      } finally {
        setPriceWrite(null);
        onMutationStateChange(false);
      }
    },
    [group, onGroupUpdated, onMutationStateChange, priceDrafts, priceWrite, quantityWrite, removalWrite, representativeWrite, selectorWrite, writesBlocked],
  );

  const stageQuantityAdjustment = useCallback(
    async (variation: VariationListingVariation, delta: -1 | 1) => {
      if (!group || group.lifecycleState !== "active" || quantityWrite !== null) return;
      if (writesBlocked || group.variations.some((item) => item.pendingRemovalAt != null) || removalWrite !== null || priceWrite !== null || selectorWrite !== null || representativeWrite !== null) return;
      if (!isSignedInt32(variation.quantityAdjustmentCounter) || !isSignedInt32(variation.quantityAdjustmentCounter + delta)) return;
      const recovery = group.journal.latestRevision?.recovery;
      if (
        (recovery && (recovery.requiresReconciliation || recovery.remoteState === "unknown" || recovery.retryStatus !== "not_applicable")) ||
        group.journal.latestRevision?.operations.some((operation) => ["started", "unknown", "retry_authorized"].includes(operation.state))
      ) return;

      setQuantityWrite(variation.variationId);
      onMutationStateChange(true);
      setActionError(null);
      try {
        const response = await fetch(
          `/api/variation-listings/${encodeURIComponent(group.groupId)}/variations/${encodeURIComponent(variation.variationId)}/quantity-adjustment`,
          {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({expectedDesiredRevision: group.desiredRevision, delta}),
          },
        );
        const payload = (await response.json().catch(() => null)) as VariationListingGroup | {error?: string} | null;
        const updatedVariation = payload && typeof payload === "object" && "variations" in payload && Array.isArray(payload.variations)
          ? payload.variations.find((candidate) => candidate && typeof candidate === "object" && "variationId" in candidate && candidate.variationId === variation.variationId)
          : null;
        if (
          !response.ok ||
          !payload || typeof payload !== "object" || !("groupId" in payload) || payload.groupId !== group.groupId ||
          !("desiredRevision" in payload) || payload.desiredRevision !== group.desiredRevision + 1 ||
          !updatedVariation || !("quantityAdjustmentCounter" in updatedVariation) ||
          !isSignedInt32(updatedVariation.quantityAdjustmentCounter) ||
          updatedVariation.quantityAdjustmentCounter !== variation.quantityAdjustmentCounter + delta
        ) {
          throw new Error(
            payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" && payload.error
              ? payload.error
              : `Quantity adjustment returned a malformed or stale group (${response.status}).`,
          );
        }
        onGroupUpdated(payload);
        setQuantityStatus((current) => {
          if (!current || current.groupId !== group.groupId) return current;
          return {
            ...current,
            desiredRevision: payload.desiredRevision,
            variations: current.variations.map((entry) => entry.variationId === variation.variationId
              ? {...entry, pendingAdjustment: entry.pendingAdjustment + delta, afterPublish: entry.afterPublish + delta}
              : entry),
          };
        });
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Unable to stage quantity adjustment.");
      } finally {
        setQuantityWrite(null);
        onMutationStateChange(false);
      }
    },
    [group, onGroupUpdated, onMutationStateChange, priceWrite, quantityWrite, removalWrite, representativeWrite, selectorWrite, writesBlocked],
  );

  const stageRemoval = useCallback(async (variation: VariationListingVariation, remove: boolean) => {
    if (!group || writesBlocked || removalWrite !== null || quantityWrite !== null || priceWrite !== null || selectorWrite !== null || representativeWrite !== null) return;
    if (group.lifecycleState !== "active" || group.lastConfirmedRevision === null) return;
    const pending = variation.pendingRemovalAt != null;
    const status = quantityStatus?.groupId === group.groupId && quantityStatus.desiredRevision === group.desiredRevision && quantityStatus.lastConfirmedRevision === group.lastConfirmedRevision
      ? quantityStatus.variations.find((v) => v.variationId === variation.variationId && v.sku === variation.sku)
      : null;
    if (remove ? pending || status?.soldOutRemovalEligible !== true || group.variations.length < 3 || group.desiredRevision !== group.lastConfirmedRevision : !pending) return;
    const current = removalConfirm;
    if (remove && (!current || current.groupId !== group.groupId || current.variationId !== variation.variationId || current.sku !== variation.sku || current.revision !== group.desiredRevision || !current.stock || !current.noRestock)) return;
    setRemovalWrite(variation.variationId);
    onMutationStateChange(true);
    setActionError(null);
    setRemovalConfirm(null);
    let response: Response | null = null;
    let releaseWriteLock = false;
    try {
      response = await fetch(`/api/variation-listings/${encodeURIComponent(group.groupId)}/variations/${encodeURIComponent(variation.variationId)}/permanent-removal`, {
        method: "PATCH", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({expectedDesiredRevision: group.desiredRevision, remove}),
      });
      const payload = (await response.json().catch(() => null)) as VariationListingGroup | {error?: string} | null;
      if (!response.ok || !isUpdatedRemovalGroup(payload, group, variation, remove)) {
        throw new Error(payload && "error" in payload && typeof payload.error === "string" ? payload.error : "Removal staging returned an invalid or stale response.");
      }
      releaseWriteLock = true;
      quantityRequestIdRef.current += 1;
      setQuantityStatus(null);
      quantityAutoRefreshKeyRef.current = null;
      onGroupUpdated(payload);
    } catch (error) {
      quantityRequestIdRef.current += 1;
      setQuantityStatus(null);
      quantityAutoRefreshKeyRef.current = null;
      const rejected = response !== null && response.status >= 400 && response.status < 500;
      if (rejected) {
        setActionError(error instanceof Error ? error.message : "Unable to update removal intent. Refresh the bucket before retrying.");
        quantityAutoRefreshKeyRef.current = `${group.groupId}:${group.lastConfirmedRevision}`;
        void loadQuantityStatus();
      } else {
        const refreshed = await onRefreshGroup({
          groupId: group.groupId,
          variationId: variation.variationId,
          sku: variation.sku,
          originalRevision: group.desiredRevision,
          originalConfirmedRevision: group.lastConfirmedRevision,
          originalPending: pending,
          requestedPending: remove,
          variationIdentities: group.variations.map((row) => ({variationId: row.variationId, sku: row.sku})),
        });
        if (refreshed) {
          releaseWriteLock = true;
          setActionError("Removal staging outcome was unknown; current bucket state was reloaded. Review it before retrying.");
        } else {
          setActionError("Removal staging outcome is unknown or its authoritative group revision/removal state could not be verified. Controls remain locked; reload the page and inspect the SKU before any further action.");
        }
      }
    } finally {
      setRemovalWrite(null);
      if (releaseWriteLock || (response !== null && response.status >= 400 && response.status < 500)) onMutationStateChange(false);
    }
  }, [group, writesBlocked, removalWrite, quantityWrite, priceWrite, selectorWrite, representativeWrite, quantityStatus, removalConfirm, loadQuantityStatus, onMutationStateChange, onGroupUpdated, onRefreshGroup]);

  const rebasePriceDraft = useCallback(
    (variation: VariationListingVariation) => {
      if (!group) return;
      setPriceDrafts((current) => {
        const draft = current[variation.variationId];
        if (!draft || draft.groupId !== group.groupId) return current;
        if (draft.amount === variation.priceAmount) {
          const next = {...current};
          delete next[variation.variationId];
          return next;
        }
        return {
          ...current,
          [variation.variationId]: {...draft, baseRevision: group.desiredRevision},
        };
      });
      setActionError(null);
    },
    [group],
  );

  if (!group) {
    return (
      <section className="rounded-[1.5rem] border border-dashed border-stone-300 bg-white/65 p-6 text-center text-sm text-stone-500">
        Select a bucket to inspect its variations and physical copies.
      </section>
    );
  }

  return (
    <section className="rounded-[1.5rem] border border-stone-950/10 bg-white/90 p-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">Variation inventory</p>
          <h2 className="mt-1 text-xl font-semibold">{group.title || group.skuNamespace.bucketToken}</h2>
        </div>
        <label className="min-w-52 text-[10px] font-bold uppercase tracking-[0.1em] text-stone-600">
          Duplicate-copy condition
          <select
            aria-label="Duplicate-copy condition"
            value={pendingConditionToken ?? copyConditionToken ?? ""}
            onChange={(event) => onCopyConditionChange(event.target.value as VariationListingConditionToken)}
            disabled={conditionChangesLocked || copyConditionOptions.length === 0}
            className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium normal-case tracking-normal text-stone-950 disabled:cursor-not-allowed disabled:bg-stone-100"
          >
            {copyConditionOptions.length === 0 ? <option value="">No compatible condition</option> : null}
            {copyConditionOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">
          Shared eBay condition: {formatCondition(group.conditionToken)}
        </span>
        {group.lifecycleState === "active" && group.lastConfirmedRevision !== null ? (
          <button
            type="button"
            onClick={() => void loadQuantityStatus()}
            disabled={writesBlocked || quantityStatusLoading}
            className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {quantityStatusLoading ? "Refreshing eBay qty…" : "Refresh eBay qty"}
          </button>
        ) : null}
      </div>

      {pendingConditionToken ? (
        <p className="mt-2 text-xs font-semibold text-amber-900">Frozen pending condition: {formatCondition(pendingConditionToken)}</p>
      ) : copyConditionOptions.length === 0 ? (
        <p className="mt-2 text-xs font-semibold text-rose-800">Duplicate capture unavailable: bucket condition is unrecognized.</p>
      ) : null}

      {actionError ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800">{actionError}</p>
      ) : null}
      {quantityStatusError ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800">eBay quantity unavailable: {quantityStatusError}</p>
      ) : null}

      {group.variations.length === 0 ? (
        <p className="mt-5 rounded-xl bg-stone-50 px-4 py-6 text-center text-sm text-stone-500">
          This bucket has no variations yet. Use new-card capture first.
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          {group.variations.map((variation) => {
            const duplicateMode = intakeSession?.mode === "duplicate_copy";
            const duplicateArmed =
              duplicateMode &&
              intakeSession.targetGroupId === group.groupId &&
              intakeSession.targetVariationId === variation.variationId;
            const selectorValue = selectorDrafts[variation.variationId] ?? variation.selectorValue;
            const selectorOverLimit = selectorValue.length > 65;
            const priceDraft = priceDrafts[variation.variationId]?.groupId === group.groupId
              ? priceDrafts[variation.variationId]
              : undefined;
            const selectedPrice = priceDraft?.amount ?? variation.priceAmount;
            const priceChanged = selectedPrice !== variation.priceAmount;
            const recovery = group.journal.latestRevision?.recovery;
            const priceLocked = group.variations.some((item) => item.pendingRemovalAt != null) || removalWrite !== null || writesBlocked || priceWrite !== null || quantityWrite !== null || selectorWrite !== null || representativeWrite !== null ||
              !["intake", "draft", "review", "active"].includes(group.lifecycleState) ||
              Boolean(recovery && (recovery.requiresReconciliation || recovery.remoteState === "unknown" || recovery.retryStatus !== "not_applicable")) ||
              Boolean(group.journal.latestRevision?.operations.some((operation) => ["started", "unknown", "retry_authorized"].includes(operation.state)));
            const priceRevisionStale = priceDraft !== undefined && priceDraft.baseRevision !== group.desiredRevision;
            const quantityLocked = group.variations.some((item) => item.pendingRemovalAt != null) || removalWrite !== null || writesBlocked || quantityWrite !== null || priceWrite !== null || selectorWrite !== null || representativeWrite !== null ||
              group.lifecycleState !== "active" ||
              Boolean(recovery && (recovery.requiresReconciliation || recovery.remoteState === "unknown" || recovery.retryStatus !== "not_applicable")) ||
              Boolean(group.journal.latestRevision?.operations.some((operation) => ["started", "unknown", "retry_authorized"].includes(operation.state)));
            const quantityCounterValid = isSignedInt32(variation.quantityAdjustmentCounter);
            const quantityStatusCurrent = quantityStatus !== null &&
              quantityStatus.groupId === group.groupId &&
              quantityStatus.desiredRevision === group.desiredRevision &&
              quantityStatus.lastConfirmedRevision === group.lastConfirmedRevision;
            const remoteQuantity = quantityStatusCurrent
              ? quantityStatus.variations.find((entry) => entry.variationId === variation.variationId && entry.sku === variation.sku) ?? null
              : null;
            const anyRemovalPending = group.variations.some((item) => item.pendingRemovalAt != null);
            const pendingRemoval = variation.pendingRemovalAt != null;
            const completeQuantityStatus = quantityStatusCurrent && quantityStatus.variations.length === group.variations.length;
            const removalLocked = writesBlocked || removalWrite !== null || quantityWrite !== null || priceWrite !== null || selectorWrite !== null || representativeWrite !== null ||
              Boolean(recovery && (recovery.requiresReconciliation || recovery.remoteState === "unknown" || recovery.retryStatus !== "not_applicable")) ||
              Boolean(group.journal.latestRevision?.operations.some((operation) => ["started", "unknown", "retry_authorized"].includes(operation.state)));
            const removalEligible = !removalLocked && !quantityStatusLoading && completeQuantityStatus && !anyRemovalPending && group.desiredRevision === group.lastConfirmedRevision && group.variations.length >= 3 && remoteQuantity?.soldOutRemovalEligible === true;
            const confirmation = removalConfirm?.groupId === group.groupId && removalConfirm.variationId === variation.variationId && removalConfirm.sku === variation.sku && removalConfirm.revision === group.desiredRevision ? removalConfirm : null;
            const quantityAdjustmentLocked = quantityLocked || anyRemovalPending || removalWrite !== null || quantityStatusLoading || remoteQuantity === null || !quantityCounterValid;
            return (
              <article key={variation.variationId} className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500">
                      <span className="flex flex-wrap items-baseline gap-3">
                        <span>Card selector</span>
                        <span
                          className={`font-mono text-xs font-semibold normal-case tracking-normal ${selectorOverLimit ? "text-rose-700" : "text-stone-400"}`}
                          aria-live="polite"
                        >
                          {selectorValue.length}/65
                        </span>
                      </span>
                      <div className="mt-1 flex gap-2">
                        <input
                          value={selectorValue}
                          onChange={(event) => setSelectorDrafts((current) => ({...current, [variation.variationId]: event.target.value}))}
                          maxLength={65}
                          aria-invalid={selectorOverLimit}
                          disabled={writesBlocked || removalWrite !== null || group.variations.some((item) => item.pendingRemovalAt != null) || quantityWrite !== null || !["intake", "draft", "review"].includes(group.lifecycleState) || selectorWrite !== null}
                          className={`min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm font-semibold normal-case tracking-normal text-stone-950 disabled:bg-stone-100 ${selectorOverLimit ? "border-rose-500 bg-rose-50" : "border-stone-300 bg-white"}`}
                        />
                        <button
                          type="button"
                          onClick={() => void saveSelectorValue(variation)}
                          disabled={writesBlocked || removalWrite !== null || group.variations.some((item) => item.pendingRemovalAt != null) || quantityWrite !== null || !["intake", "draft", "review"].includes(group.lifecycleState) || selectorWrite !== null || selectorOverLimit || !(selectorDrafts[variation.variationId] ?? "").trim() || selectorValue.trim() === variation.selectorValue}
                          className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {selectorWrite === variation.variationId ? "Saving…" : "Save selector"}
                        </button>
                      </div>
                    </label>
                    <p className="mt-1 text-sm font-bold text-stone-700">{variation.sku}</p>

                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-stone-600">
                        Price
                        <select
                          aria-label={`Price for ${variation.sku}`}
                          value={selectedPrice}
                          disabled={priceLocked}
                          onChange={(event) => {
                            const amount = Number(event.target.value) as VariationListingManualPriceAmount;
                            setPriceDrafts((current) => ({
                              ...current,
                              [variation.variationId]: {amount, baseRevision: group.desiredRevision, groupId: group.groupId},
                            }));
                            setActionError(null);
                          }}
                          className="ml-2 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-bold normal-case tracking-normal text-stone-900 disabled:cursor-not-allowed disabled:bg-stone-100"
                        >
                          {MANUAL_PRICE_TIERS.map((amount) => (
                            <option key={amount} value={amount}>${amount.toFixed(2)}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => void savePrice(variation)}
                        disabled={priceLocked || !priceChanged || priceRevisionStale}
                        className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {priceWrite === variation.variationId ? "Saving…" : "Save price"}
                      </button>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-700">{variation.copyCount} captured</span>
                    {group.lifecycleState === "active" && group.lastConfirmedRevision !== null ? (
                      remoteQuantity ? (
                        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-2 py-1.5">
                          <span aria-label={`eBay quantity for ${variation.sku}`} className="text-[10px] font-semibold text-stone-600">eBay qty <strong className="text-stone-900">{remoteQuantity.ebayQuantity}</strong></span>
                          <span aria-label={`Pending quantity adjustment for ${variation.sku}`} className="text-[10px] font-semibold text-stone-600">Pending <strong className="text-stone-900">{remoteQuantity.pendingAdjustment >= 0 ? `+${remoteQuantity.pendingAdjustment}` : remoteQuantity.pendingAdjustment}</strong></span>
                          <span aria-label={`Projected quantity after publish for ${variation.sku}`} className={`text-[10px] font-semibold ${remoteQuantity.afterPublish < 0 ? "text-rose-700" : "text-stone-600"}`}>After publish <strong className={remoteQuantity.afterPublish < 0 ? "text-rose-800" : "text-stone-900"}>{remoteQuantity.afterPublish}</strong></span>
                          <button
                            type="button"
                            aria-label={`Decrease sellable quantity for ${variation.sku}`}
                            onClick={() => void stageQuantityAdjustment(variation, -1)}
                            disabled={quantityAdjustmentLocked || remoteQuantity.afterPublish <= 0}
                            className="rounded-full border border-stone-300 px-2 py-0.5 text-xs font-bold text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            −1
                          </button>
                          <button
                            type="button"
                            aria-label={`Increase sellable quantity for ${variation.sku}`}
                            onClick={() => void stageQuantityAdjustment(variation, 1)}
                            disabled={quantityAdjustmentLocked}
                            className="rounded-full border border-stone-300 px-2 py-0.5 text-xs font-bold text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            +1
                          </button>
                        </div>
                      ) : (
                        <span className="rounded-full bg-stone-100 px-3 py-1 text-[10px] font-semibold text-stone-500">
                          {quantityStatusLoading
                            ? "Loading eBay quantity…"
                            : quantityStatusCurrent
                              ? "Quantity controls available after first remote confirmation"
                              : "Refresh eBay qty to enable quantity controls"}
                        </span>
                      )
                    ) : null}
                    {group.lifecycleState === "active" && group.lastConfirmedRevision !== null ? (
                      pendingRemoval ? (
                        <button type="button" onClick={() => void stageRemoval(variation, false)} disabled={removalLocked}
                          className="rounded-full border border-amber-600 px-3 py-1.5 text-xs font-bold text-amber-900 disabled:opacity-40">
                          {removalWrite === variation.variationId ? "Cancelling…" : "Cancel removal"}
                        </button>
                      ) : (
                        <button type="button" disabled={!removalEligible} onClick={() => setRemovalConfirm({groupId: group.groupId, variationId: variation.variationId, sku: variation.sku, revision: group.desiredRevision, stock: false, noRestock: false})}
                          className="rounded-full border border-rose-400 px-3 py-1.5 text-xs font-bold text-rose-800 disabled:opacity-40">Remove sold-out SKU</button>
                      )
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onArmDuplicate(variation)}
                      disabled={writesBlocked || anyRemovalPending || removalWrite !== null || quantityWrite !== null || duplicateArmed || !duplicateCaptureAvailable}
                      className="rounded-full bg-stone-950 px-3 py-1.5 text-xs font-bold text-white transition enabled:hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600"
                    >
                      {duplicateArmed ? "Duplicate armed" : "Capture duplicate"}
                    </button>
                  </div>
                </div>

                {pendingRemoval ? <p className="mt-2 text-xs font-bold text-amber-900">Removal staged locally for {variation.sku}. No eBay change yet. Use Publish Changes to remove the zero-stock SKU, or Cancel removal.</p> : null}
                {confirmation ? (
                  <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-950">
                    <p className="font-bold">Stage removal for exact SKU: {variation.sku}</p>
                    <p className="mt-1">This stages removal only. Publish Changes will later remove this SKU from the eBay variation listing and hard-delete its local Variation/copy rows. Image files are not purged.</p>
                    <label className="mt-2 flex gap-2"><input type="checkbox" checked={confirmation.stock} onChange={(e) => setRemovalConfirm({...confirmation, stock: e.target.checked})}/>I confirm no physical copies of {variation.sku} remain.</label>
                    <label className="mt-2 flex gap-2"><input type="checkbox" checked={confirmation.noRestock} onChange={(e) => setRemovalConfirm({...confirmation, noRestock: e.target.checked})}/>I do not intend to restock this SKU.</label>
                    <div className="mt-2 flex gap-2"><button type="button" disabled={!removalEligible || !confirmation.stock || !confirmation.noRestock} onClick={() => void stageRemoval(variation, true)} className="rounded-full bg-rose-700 px-3 py-1.5 font-bold text-white disabled:opacity-40">Confirm stage removal</button><button type="button" onClick={() => setRemovalConfirm(null)} className="rounded-full border px-3 py-1.5">Keep SKU</button></div>
                  </div>
                ) : null}
                {priceRevisionStale ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-amber-900">
                    <p>Bucket revision changed. Reconfirm this price against the latest revision before saving.</p>
                    <button
                      type="button"
                      onClick={() => rebasePriceDraft(variation)}
                      disabled={priceLocked}
                      className="rounded-full border border-amber-400 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Keep ${priceDraft?.amount.toFixed(2)} and use latest revision
                    </button>
                  </div>
                ) : null}
                {group.lifecycleState === "active" ? (
                  <p className="mt-2 text-xs font-semibold text-amber-900">
                    Price and quantity edits are staged locally. Use Publish Changes to update eBay.
                  </p>
                ) : null}

                {variation.copies.length === 0 ? (
                  <p className="mt-3 text-xs text-stone-500">No physical copies are attached to this variation.</p>
                ) : (
                  <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                    {variation.copies.map((copy) => (
                      <div key={copy.copyId} className="w-72 shrink-0">
                        <CopyCard
                          copy={copy}
                          updating={representativeWrite === `${variation.variationId}:${copy.copyId}`}
                          writesBlocked={writesBlocked || removalWrite !== null || group.variations.some((item) => item.pendingRemovalAt != null) || quantityWrite !== null}
                          onSetRepresentative={(copyId) => void setRepresentative(variation, copyId)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

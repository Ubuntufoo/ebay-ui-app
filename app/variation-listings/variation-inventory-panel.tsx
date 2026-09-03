"use client";

import {useCallback, useState} from "react";

import type {
  VariationListingConditionToken,
  VariationListingCopy,
  VariationListingGroup,
  VariationListingIntakeSession,
  VariationListingVariation,
} from "@/lib/sidecar-api";

type VariationInventoryPanelProps = {
  group: VariationListingGroup | null;
  intakeSession: VariationListingIntakeSession | null;
  writesBlocked: boolean;
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

function CopyImage({copyId, label, url, r2Key}: {copyId: string; label: string; url: string | null; r2Key: string}) {
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
      <p className="mt-1 truncate text-[10px] text-stone-400" title={r2Key}>{r2Key}</p>
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
          <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${copy.availabilityState === "available" ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-600"}`}>
            {copy.availabilityState}
          </span>
          {copy.isRepresentative ? (
            <span className="rounded-full bg-amber-200 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-900">Representative</span>
          ) : null}
        </div>
      </div>

      {copy.conditionNotes ? <p className="mt-2 text-xs leading-5 text-stone-600">{copy.conditionNotes}</p> : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <CopyImage copyId={copy.copyId} label="Front" url={copy.frontImageUrl} r2Key={copy.frontR2Key} />
        <CopyImage copyId={copy.copyId} label="Back" url={copy.backImageUrl} r2Key={copy.backR2Key} />
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
  const [actionError, setActionError] = useState<string | null>(null);

  const setRepresentative = useCallback(
    async (variation: VariationListingVariation, copyId: string) => {
      if (!group || representativeWrite) return;
      const writeKey = `${variation.variationId}:${copyId}`;
      setRepresentativeWrite(writeKey);
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
            payload && "error" in payload && payload.error
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
        onGroupUpdated(payload);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Unable to update representative copy.");
      } finally {
        setRepresentativeWrite(null);
      }
    },
    [group, onGroupUpdated, representativeWrite],
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">Variation inventory</p>
          <h2 className="mt-1 text-xl font-semibold">{group.title || group.skuNamespace.bucketToken}</h2>
          <p className="mt-1 text-sm text-stone-600">
            Inspect each physical copy, its coarse condition and front/back image pair, or arm duplicate capture for an existing variation.
          </p>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">
          Shared eBay condition: {formatCondition(group.conditionToken)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
        <label className="min-w-60 text-xs font-bold uppercase tracking-[0.12em] text-stone-600">
          Duplicate-copy condition
          <select
            aria-label="Duplicate-copy condition"
            value={pendingConditionToken ?? copyConditionToken ?? ""}
            onChange={(event) => onCopyConditionChange(event.target.value as VariationListingConditionToken)}
            disabled={conditionChangesLocked || copyConditionOptions.length === 0}
            className="mt-2 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-stone-950 disabled:cursor-not-allowed disabled:bg-stone-100"
          >
            {copyConditionOptions.length === 0 ? <option value="">No compatible condition</option> : null}
            {copyConditionOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        {pendingConditionToken ? (
          <p className="text-xs font-semibold text-amber-900">Frozen pending condition: {formatCondition(pendingConditionToken)}</p>
        ) : copyConditionOptions.length === 0 ? (
          <p className="text-xs font-semibold text-rose-800">Duplicate capture unavailable: bucket condition is unrecognized.</p>
        ) : null}
      </div>

      {actionError ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800">{actionError}</p>
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
            return (
              <article key={variation.variationId} className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-stone-950">{variation.selectorValue}</h3>
                    <p className="mt-1 text-xs text-stone-500">{variation.sku}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-700">${variation.priceAmount.toFixed(2)}</span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-700">{variation.availableQuantity}/{variation.copyCount} available</span>
                    <button
                      type="button"
                      onClick={() => onArmDuplicate(variation)}
                      disabled={writesBlocked || duplicateMode || duplicateArmed || !duplicateCaptureAvailable}
                      className="rounded-full bg-stone-950 px-3 py-1.5 text-xs font-bold text-white transition enabled:hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600"
                    >
                      {duplicateArmed ? "Duplicate armed" : "Capture duplicate"}
                    </button>
                  </div>
                </div>

                {variation.copies.length === 0 ? (
                  <p className="mt-3 text-xs text-stone-500">No physical copies are attached to this variation.</p>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {variation.copies.map((copy) => (
                      <CopyCard
                        key={copy.copyId}
                        copy={copy}
                        updating={representativeWrite === `${variation.variationId}:${copy.copyId}`}
                        writesBlocked={writesBlocked}
                        onSetRepresentative={(copyId) => void setRepresentative(variation, copyId)}
                      />
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

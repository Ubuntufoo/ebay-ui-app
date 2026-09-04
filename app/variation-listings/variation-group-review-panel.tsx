"use client";

import {useState} from "react";

import type {JsonObject, VariationListingGeneratedReviewDraft, VariationListingGroup} from "@/lib/sidecar-api";

type Props = {
  group: VariationListingGroup | null;
  writesBlocked: boolean;
  onGroupUpdated: (group: VariationListingGroup) => void;
};

function isGeneratedDraft(
  value: unknown,
  groupId: string,
  desiredRevision: number,
): value is VariationListingGeneratedReviewDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<VariationListingGeneratedReviewDraft>;
  const expectedRevision = draft.expectedDesiredRevision;
  return draft.groupId === groupId &&
    typeof expectedRevision === "number" &&
    Number.isInteger(expectedRevision) &&
    expectedRevision >= desiredRevision &&
    typeof draft.title === "string" &&
    typeof draft.description === "string" &&
    !!draft.derivedCommonEbayAspects &&
    typeof draft.derivedCommonEbayAspects === "object" &&
    !Array.isArray(draft.derivedCommonEbayAspects) &&
    !!draft.readiness &&
    typeof draft.readiness === "object" &&
    typeof draft.readiness.ready === "boolean" &&
    Array.isArray(draft.readiness.blockers) &&
    draft.readiness.blockers.every((blocker) => typeof blocker === "string") &&
    Array.isArray(draft.warnings) &&
    draft.warnings.every((warning) => typeof warning === "string");
}

function isUpdatedGroup(value: unknown, groupId: string, expectedRevision: number): value is VariationListingGroup {
  if (!value || typeof value !== "object") return false;
  const updated = value as Partial<VariationListingGroup>;
  const nextRevision = updated.desiredRevision;
  return updated.groupId === groupId &&
    typeof nextRevision === "number" &&
    Number.isInteger(nextRevision) &&
    nextRevision >= expectedRevision + 1 &&
    typeof updated.lifecycleState === "string" &&
    !!updated.validation &&
    Array.isArray(updated.validation.blockers) &&
    Array.isArray(updated.variations) &&
    !!updated.journal;
}

export function VariationGroupReviewPanel({group, writesBlocked, onGroupUpdated}: Props) {
  const [title, setTitle] = useState(group?.title ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [commonAspects, setCommonAspects] = useState<JsonObject>(group?.derivedCommonEbayAspects ?? {});
  const [draftRevision, setDraftRevision] = useState(group?.desiredRevision ?? 0);
  const [status, setStatus] = useState<"idle" | "generating" | "saving">("idle");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!group) return null;

  const editable = ["intake", "draft", "review"].includes(group.lifecycleState);
  const generate = async () => {
    setStatus("generating");
    setError(null);
    try {
      const response = await fetch(`/api/variation-listings/${encodeURIComponent(group.groupId)}/review-draft/generate`, {method: "POST"});
      const payload = (await response.json().catch(() => null)) as VariationListingGeneratedReviewDraft | {error?: string} | null;
      if (!response.ok || !isGeneratedDraft(payload, group.groupId, group.desiredRevision)) {
        throw new Error(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" && payload.error
          ? payload.error
          : `Group review generation returned a malformed or stale draft (${response.status}).`);
      }
      setTitle(payload.title);
      setDescription(payload.description);
      setCommonAspects(payload.derivedCommonEbayAspects);
      setDraftRevision(payload.expectedDesiredRevision);
      setWarnings(payload.warnings);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to generate group review draft.");
    } finally {
      setStatus("idle");
    }
  };

  const save = async () => {
    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();
    if (!normalizedTitle || !normalizedDescription) {
      setError("Group title and description are required.");
      return;
    }
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch(`/api/variation-listings/${encodeURIComponent(group.groupId)}/review-draft`, {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({expectedDesiredRevision: draftRevision, title: normalizedTitle, description: normalizedDescription, derivedCommonEbayAspects: commonAspects}),
      });
      const payload = (await response.json().catch(() => null)) as VariationListingGroup | {error?: string} | null;
      if (!response.ok || !isUpdatedGroup(payload, group.groupId, draftRevision)) {
        throw new Error(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" && payload.error
          ? payload.error
          : `Group review save returned a malformed or stale group (${response.status}).`);
      }
      onGroupUpdated(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save group review draft.");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <section className="rounded-[1.5rem] border border-stone-950/10 bg-white/90 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">Group review</p>
          <h2 className="mt-1 text-xl font-semibold">Listing title and description</h2>
          <p className="mt-1 text-sm text-stone-600">Generate the shared listing draft from the current variations, then review or edit it before publication.</p>
        </div>
        <button type="button" onClick={() => void generate()} disabled={!editable || writesBlocked || status !== "idle" || group.variations.length < 2} className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-700 disabled:cursor-not-allowed disabled:opacity-50">
          {status === "generating" ? "Generating…" : "Generate group draft"}
        </button>
      </div>

      <label className="mt-4 block text-xs font-bold uppercase tracking-[0.12em] text-stone-600">
        Group title
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} disabled={!editable || writesBlocked || status !== "idle"} className="mt-2 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-stone-950 disabled:bg-stone-100" />
      </label>
      <label className="mt-3 block text-xs font-bold uppercase tracking-[0.12em] text-stone-600">
        Group description
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={4000} rows={4} disabled={!editable || writesBlocked || status !== "idle"} className="mt-2 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-stone-950 disabled:bg-stone-100" />
      </label>

      {warnings.length > 0 ? <p className="mt-3 text-xs text-amber-800">{warnings.join(" · ")}</p> : null}
      {error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p> : null}

      <button type="button" onClick={() => void save()} disabled={!editable || writesBlocked || status !== "idle" || !title.trim() || !description.trim()} className="mt-4 rounded-full bg-stone-950 px-5 py-2.5 text-sm font-bold text-stone-50 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600">
        {status === "saving" ? "Saving…" : "Save review draft"}
      </button>
    </section>
  );
}

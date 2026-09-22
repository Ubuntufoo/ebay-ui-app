"use client";

import {useState} from "react";

import type {JsonObject, VariationListingGeneratedReviewDraft, VariationListingGroup} from "@/lib/sidecar-api";

const MAX_GROUP_TITLE_LENGTH = 80;

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
    if (normalizedTitle.length > MAX_GROUP_TITLE_LENGTH) {
      setError(`Group title must be at most ${MAX_GROUP_TITLE_LENGTH} characters.`);
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
    <section className="rounded-[1.5rem] border border-stone-950/10 bg-white/90 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">Group review</p>
          <h2 className="mt-1 text-xl font-semibold">Listing details</h2>
        </div>
        <button type="button" onClick={() => void generate()} disabled={!editable || writesBlocked || status !== "idle" || group.variations.length < 2} className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-700 disabled:cursor-not-allowed disabled:opacity-50">
          {status === "generating" ? "Generating…" : "Generate group draft"}
        </button>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <label className="block text-xs font-bold uppercase tracking-[0.12em] text-stone-600">
          <span className="flex flex-wrap items-baseline gap-3">
            <span>Title</span>
            <span className={`font-mono text-xs font-semibold normal-case tracking-normal ${title.length > MAX_GROUP_TITLE_LENGTH ? "text-rose-700" : "text-stone-400"}`} aria-live="polite">
              {title.length}/{MAX_GROUP_TITLE_LENGTH}
            </span>
          </span>
          <input aria-label="Group title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={MAX_GROUP_TITLE_LENGTH} disabled={!editable || writesBlocked || status !== "idle"} className="mt-1.5 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-stone-950 disabled:bg-stone-100" />
        </label>
        <label className="block text-xs font-bold uppercase tracking-[0.12em] text-stone-600">
          Description
          <textarea aria-label="Group description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={4000} rows={2} disabled={!editable || writesBlocked || status !== "idle"} className="mt-1.5 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-stone-950 disabled:bg-stone-100" />
        </label>
      </div>

      <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">Group eBay aspects</p>
        {Object.keys(commonAspects).length > 0 ? (
          <dl className="mt-2 grid gap-2 md:grid-cols-3">
            {Object.entries(commonAspects).map(([key, value]) => (
              <div key={key} className="rounded-lg bg-white px-2.5 py-2">
                <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-stone-500">{key}</dt>
                <dd className="mt-0.5 text-xs text-stone-900">
                  {Array.isArray(value) ? value.join(", ") : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-xs text-stone-500">No common eBay aspects are currently available.</p>
        )}
      </div>

      {warnings.length > 0 ? <p className="mt-3 text-xs text-amber-800">{warnings.join(" · ")}</p> : null}
      {error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p> : null}

      <button type="button" onClick={() => void save()} disabled={!editable || writesBlocked || status !== "idle" || !title.trim() || title.trim().length > MAX_GROUP_TITLE_LENGTH || !description.trim()} className="mt-3 rounded-full bg-stone-950 px-4 py-2 text-sm font-bold text-stone-50 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600">
        {status === "saving" ? "Saving…" : "Save review draft"}
      </button>
    </section>
  );
}

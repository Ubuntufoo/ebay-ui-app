"use client";

import {useActionState, useMemo, useState} from "react";
import {useFormStatus} from "react-dom";

import {saveListingEdits} from "@/app/listing-actions";
import {initialSaveListingEditsActionState} from "@/app/listing-edit-state";
import {saveListingImageUrls} from "@/app/listing-image-url-actions";
import {initialSaveListingImageUrlsActionState} from "@/app/listing-image-url-state";
import {
  formatListingImageUrls,
  parseListingImageUrlsInput,
} from "@/app/listing-image-url-utils";
import {ListingStatusControls} from "@/app/listing-status-controls";
import type {Listing} from "@/lib/sidecar-api";

function formatItemSpecifics(value: Listing["item_specifics"]): string {
  if (value === null) {
    return "";
  }

  return JSON.stringify(value, null, 2);
}

function SaveButton({
  disabled,
  pendingLabel,
  label,
}: {
  disabled: boolean;
  label: string;
  pendingLabel: string;
}) {
  const {pending} = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex min-w-36 items-center justify-center rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function PreviewImage({url}: {url: string}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-100 px-3 text-center text-xs font-medium text-stone-500">
        Preview unavailable
      </div>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Listing preview"
        onError={() => setFailed(true)}
        className="aspect-square w-full rounded-2xl border border-stone-950/10 bg-stone-100 object-cover"
      />
    </>
  );
}

function ImagePreviewGrid({urls}: {urls: string[]}) {
  if (urls.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-950/15 bg-stone-50 px-4 py-6 text-sm text-stone-500">
        Add one or more valid public image URLs to preview them here.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {urls.map((url, index) => (
        <div
          key={`${url}:${index}`}
          className="overflow-hidden rounded-[1.25rem] border border-stone-950/10 bg-white p-2 shadow-[0_8px_22px_rgba(68,64,60,0.08)]"
        >
          <PreviewImage url={url} />
          <p className="mt-2 truncate text-xs text-stone-500" title={url}>
            {url}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ListingEditForm({listing}: {listing: Listing}) {
  const [state, formAction] = useActionState(
    saveListingEdits,
    initialSaveListingEditsActionState,
  );
  const [imageUrlState, imageUrlFormAction] = useActionState(
    saveListingImageUrls,
    initialSaveListingImageUrlsActionState,
  );

  const [itemSpecificsText, setItemSpecificsText] = useState(() =>
    formatItemSpecifics(listing.item_specifics),
  );
  const [imageUrlsText, setImageUrlsText] = useState(() =>
    formatListingImageUrls(listing.image_urls),
  );

  const itemSpecificsError = useMemo(() => {
    const trimmed = itemSpecificsText.trim();
    if (trimmed === "") {
      return null;
    }

    try {
      JSON.parse(trimmed);
      return null;
    } catch {
      return "Item specifics must be valid JSON.";
    }
  }, [itemSpecificsText]);

  const imageUrlValidation = useMemo(
    () => parseListingImageUrlsInput(imageUrlsText),
    [imageUrlsText],
  );

  const imageUrlsError =
    imageUrlValidation.invalidUrls.length > 0
      ? `Each image URL must be a valid http or https URL. Invalid entries: ${imageUrlValidation.invalidUrls.join(", ")}`
      : null;

  return (
    <div className="rounded-2xl border border-stone-950/10 bg-white/75 p-5 shadow-[0_10px_28px_rgba(68,64,60,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
          Edit listing
          </p>
        <span className="rounded-full border border-stone-950/10 bg-stone-100 px-3 py-1 text-xs font-mono text-stone-600">
          {listing.listing_id}
        </span>
      </div>

      <div className="mt-4">
        <ListingStatusControls listing={listing} />
      </div>

      <div className="mt-4 grid gap-5 border-t border-stone-950/10 pt-4">
        <form
          action={formAction}
          onSubmit={(event) => {
            if (itemSpecificsError) {
              event.preventDefault();
            }
          }}
          className="grid gap-4 rounded-[1.5rem] border border-stone-950/10 bg-stone-50/60 p-4"
        >
          <input type="hidden" name="listing_id" value={listing.listing_id} />

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                Listing details
              </p>
              <p className="mt-1 text-sm text-stone-500">
                Seller-editable fields only.
              </p>
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
              Title
            </span>
            <input
              type="text"
              name="title"
              defaultValue={listing.title ?? ""}
              className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
              Seller hints
            </span>
            <textarea
              name="seller_hints"
              defaultValue={listing.seller_hints ?? ""}
              rows={3}
              className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
              Description
            </span>
            <textarea
              name="description"
              defaultValue={listing.description ?? ""}
              rows={5}
              className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                Price
              </span>
              <input
                type="text"
                inputMode="decimal"
                name="price"
                defaultValue={
                  listing.price === null ? "" : String(listing.price)
                }
                className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                Category ID
              </span>
              <input
                type="text"
                name="category_id"
                defaultValue={listing.category_id ?? ""}
                className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                Condition ID
              </span>
              <input
                type="text"
                name="condition_id"
                defaultValue={listing.condition_id ?? ""}
                className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
              Condition notes
            </span>
            <textarea
              name="condition_notes"
              defaultValue={listing.condition_notes ?? ""}
              rows={3}
              className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
              Item specifics (JSON)
            </span>
            <textarea
              name="item_specifics"
              value={itemSpecificsText}
              onChange={(event) => setItemSpecificsText(event.target.value)}
              rows={8}
              className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 font-mono text-sm text-stone-900 outline-none transition focus:border-stone-950"
            />
          </label>

          {itemSpecificsError ? (
            <p className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {itemSpecificsError}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <SaveButton
              disabled={itemSpecificsError !== null}
              label="Save edits"
              pendingLabel="Saving..."
            />
            {itemSpecificsError ? (
              <span className="text-sm text-rose-700">Fix JSON to save.</span>
            ) : null}
          </div>

          {state.success ? (
            <p className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Listing edits saved.
            </p>
          ) : null}

          {state.error ? (
            <p className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {state.error}
            </p>
          ) : null}
        </form>

        <form
          action={imageUrlFormAction}
          onSubmit={(event) => {
            if (imageUrlsError) {
              event.preventDefault();
            }
          }}
          className="grid gap-4 rounded-[1.5rem] border border-stone-950/10 bg-stone-50/60 p-4"
        >
          <input type="hidden" name="listing_id" value={listing.listing_id} />

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                Image URLs
              </p>
              <p className="mt-1 text-sm text-stone-500">
                Paste one public image URL per line. `r2_object_keys` stay
                server-owned and hidden here.
              </p>
            </div>
            <span className="rounded-full border border-stone-950/10 bg-white px-3 py-1 text-xs font-medium text-stone-600">
              {imageUrlValidation.urls.length} valid URL
              {imageUrlValidation.urls.length === 1 ? "" : "s"}
            </span>
          </div>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
              Manual image URLs
            </span>
            <textarea
              name="image_urls"
              value={imageUrlsText}
              onChange={(event) => setImageUrlsText(event.target.value)}
              rows={6}
              spellCheck={false}
              className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 font-mono text-sm text-stone-900 outline-none transition focus:border-stone-950"
            />
          </label>

          {imageUrlsError ? (
            <p className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {imageUrlsError}
            </p>
          ) : null}

          <div className="grid gap-3">
            <div className="flex items-center gap-3">
              <SaveButton
                disabled={imageUrlsError !== null}
                label="Save image URLs"
                pendingLabel="Saving URLs..."
              />
              {imageUrlsError ? (
                <span className="text-sm text-rose-700">
                  Fix invalid URLs to save.
                </span>
              ) : null}
            </div>

            {imageUrlState.success ? (
              <p className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Image URLs saved.
              </p>
            ) : null}

            {imageUrlState.error ? (
              <p className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                {imageUrlState.error}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                Preview
              </p>
              <p className="text-xs text-stone-500">
                Invalid or unreachable images fall back gracefully.
              </p>
            </div>
            <ImagePreviewGrid urls={imageUrlValidation.urls} />
          </div>
        </form>
      </div>
    </div>
  );
}

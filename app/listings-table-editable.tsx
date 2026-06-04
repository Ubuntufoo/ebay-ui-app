"use client";

import {Fragment, startTransition, useEffect, useMemo, useState} from "react";

import {ListingEditForm} from "@/app/listing-edit-form";
import {ListingImageGallery} from "@/app/listing-image-gallery";
import {hasPersistedListingError} from "@/app/listing-error-utils";
import {
  getListingStatusBadgeClassName,
  getListingStatusLabel,
  getListingSubStatusLabel,
} from "@/app/listing-status-flow";
import type {Listing} from "@/lib/sidecar-api";

function formatPrice(price: number | null): string {
  if (price === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(price);
}

function formatUpdatedAt(updatedAt: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(updatedAt));
}

function formatExportedAt(exportedAt: string | null): string {
  if (exportedAt === null) {
    return "—";
  }

  return formatUpdatedAt(exportedAt);
}

function sortNewestFirst(listings: Listing[]): Listing[] {
  return [...listings].sort((left, right) => {
    const updatedDelta =
      new Date(right.updated_at).getTime() -
      new Date(left.updated_at).getTime();

    if (updatedDelta !== 0) {
      return updatedDelta;
    }

    return (
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    );
  });
}

function isIntakeListing(status: Listing["status"]): boolean {
  return status === "record_created";
}

// Treat `exported` as the canonical published/completed status. `listed`
// remains supported for backward compatibility and will also render in this
// read-only published panel if present.
function isPublishedListing(status: Listing["status"] | string): boolean {
  const normalizedStatus = String(status);

  return normalizedStatus === "exported" || normalizedStatus === "listed";
}

function getPublishedStatusLabel(status: Listing["status"] | string): string {
  return String(status) === "exported"
    ? "Exported"
    : getListingStatusLabel(status as Listing["status"]);
}

function PublishedListingsPanel({listings}: {listings: Listing[]}) {
  if (listings.length === 0) {
    return null;
  }

  return (
    <section className="mt-6 overflow-hidden rounded-[1.5rem] border border-stone-950/10 bg-white/80 shadow-[0_10px_28px_rgba(68,64,60,0.08)]">
      <div className="border-b border-stone-950/10 bg-stone-100/80 px-5 py-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
          Published Listings
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-stone-950/10 bg-stone-50/90 text-left">
              {[
                "Listing ID / SKU",
                "Title",
                "Status",
                "Price",
                "eBay URL",
                "Exported At",
              ].map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-stone-500"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listings.map((listing) => (
              <tr
                key={listing.id}
                className="border-b border-stone-950/10 last:border-b-0"
              >
                <td className="px-4 py-3 text-sm text-stone-700">
                  <div className="font-mono text-xs uppercase tracking-[0.14em] text-stone-600">
                    {listing.listing_id}
                    {listing.sku ? (
                      <span className="text-stone-400"> / {listing.sku}</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-stone-900">
                  {listing.title ?? "Untitled listing"}
                </td>
                <td className="px-4 py-3 text-sm text-stone-600">
                  <span className="inline-flex rounded-full border border-stone-300 bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-stone-700">
                    {getPublishedStatusLabel(listing.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-stone-600">
                  {listing.price === null
                    ? "—"
                    : new Intl.NumberFormat("en-US", {
                        currency: "USD",
                        style: "currency",
                      }).format(listing.price)}
                </td>
                <td className="px-4 py-3 text-sm text-stone-600">
                  {listing.ebay_listing_url ? (
                    <a
                      href={listing.ebay_listing_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-stone-900 underline decoration-stone-300 underline-offset-4 transition hover:decoration-stone-900"
                    >
                      Open
                    </a>
                  ) : (
                    <span className="text-stone-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-stone-600">
                  {formatExportedAt(listing.exported_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ListingsTableEditable({listings}: {listings: Listing[]}) {
  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    null,
  );
  const sortedListings = useMemo(() => sortNewestFirst(listings), [listings]);
  const activeListings = useMemo(
    () =>
      sortedListings.filter((listing) => !isPublishedListing(listing.status)),
    [sortedListings],
  );
  const publishedListings = useMemo(
    () =>
      sortedListings.filter((listing) => isPublishedListing(listing.status)),
    [sortedListings],
  );
  const selectedListing = useMemo(
    () =>
      selectedListingId === null
        ? null
        : (activeListings.find(
            (listing) => listing.listing_id === selectedListingId,
          ) ?? null),
    [activeListings, selectedListingId],
  );
  const activeSelectedListingId = selectedListing?.listing_id ?? null;

  useEffect(() => {
    if (selectedListingId !== null && selectedListing === null) {
      startTransition(() => {
        setSelectedListingId(null);
      });
    }
  }, [selectedListing, selectedListingId]);

  return (
    <div>
      {activeListings.length > 0 ? (
        <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-stone-950/10 bg-stone-50/80 shadow-[0_14px_40px_rgba(68,64,60,0.08)]">
          <div className="max-h-[calc(100vh-14rem)] overflow-auto xl:max-h-[calc(100vh-12rem)]">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-stone-950/10 bg-stone-100/95 text-left backdrop-blur">
                    {[
                      "listing_id",
                      "status",
                      "sub_status",
                      "title",
                      "images",
                      "price",
                      "updated_at",
                      "actions",
                    ].map((column) => (
                      <th
                        key={column}
                        className="px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-stone-500"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeListings.map((listing) => {
                    const isSelected =
                      activeSelectedListingId === listing.listing_id;
                    const isGenerating = listing.status === "generating";
                    const intakeOnly = isIntakeListing(listing.status);
                    const actionLabel = isGenerating
                      ? "View"
                      : listing.status === "needs_review"
                        ? "Review"
                        : "Open/Edit";
                    const actionTitle = isGenerating
                      ? "View locked listing"
                      : listing.status === "needs_review"
                        ? "Review generated draft"
                        : "Open listing editor";

                    return (
                      <Fragment key={listing.id}>
                        <tr
                          className={`border-b border-stone-950/10 ${
                            intakeOnly ? "bg-stone-100/50" : ""
                          }`}
                        >
                          <td className="px-4 py-3 font-mono text-sm text-stone-600">
                            {listing.listing_id}
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-2">
                              <span
                                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${getListingStatusBadgeClassName(listing.status)}`}
                              >
                                {getListingStatusLabel(listing.status)}
                              </span>
                              {intakeOnly ? (
                                <div className="inline-flex rounded-full border border-stone-300 bg-stone-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-stone-500">
                                  Intake only
                                </div>
                              ) : null}
                              {hasPersistedListingError(listing) ? (
                                <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                                  <p className="font-bold uppercase tracking-[0.16em] text-rose-700">
                                    Needs attention
                                  </p>
                                  {listing.last_error_code ? (
                                    <p className="mt-1 font-mono">
                                      {listing.last_error_code}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-stone-600">
                            {getListingSubStatusLabel(listing.sub_status)}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-stone-900">
                            {listing.title ?? "Untitled listing"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="min-w-40">
                              <ListingImageGallery
                                listingId={listing.listing_id}
                                imageUrls={listing.image_urls}
                                compact
                                showAllImages
                                showCaptions={false}
                                showUrls={false}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-stone-600">
                            {formatPrice(listing.price)}
                          </td>
                          <td className="px-4 py-3 text-[11px] text-stone-600">
                            <div className="space-y-2">
                              <div>
                                <p className="font-bold uppercase tracking-[0.16em] text-stone-400">
                                  Created
                                </p>
                                <p>{formatUpdatedAt(listing.created_at)}</p>
                              </div>
                              <div>
                                <p className="font-bold uppercase tracking-[0.16em] text-stone-400">
                                  Updated
                                </p>
                                <p>{formatUpdatedAt(listing.updated_at)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-stone-600">
                            {intakeOnly ? (
                              <span className="inline-flex rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-stone-500">
                                Read only
                              </span>
                            ) : (
                              <button
                                type="button"
                                title={actionTitle}
                                onClick={() =>
                                  setSelectedListingId((currentId) =>
                                    currentId === listing.listing_id
                                      ? null
                                      : listing.listing_id,
                                  )
                                }
                                className="inline-flex rounded-full border border-stone-950/15 bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                              >
                                {actionLabel}
                              </button>
                            )}
                          </td>
                        </tr>

                        {!intakeOnly && isSelected ? (
                          <tr className="border-b border-stone-950/10 last:border-b-0">
                            <td colSpan={8} className="px-4 py-4">
                              <ListingEditForm
                                key={`${listing.listing_id}:${listing.status}:${listing.sub_status}:${listing.updated_at}`}
                                listing={listing}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-12 border-t-2 border-stone-300 pt-8">
        <PublishedListingsPanel listings={publishedListings} />
      </div>
    </div>
  );
}

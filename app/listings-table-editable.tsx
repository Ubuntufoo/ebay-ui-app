"use client";

import {
  Fragment,
  startTransition,
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import {ListingAbandonControls} from "@/app/listing-abandon-controls";
import {ListingApproveForExportQuickAction} from "@/app/listing-approve-export-quick-action";
import {ListingEditForm} from "@/app/listing-edit-form";
import {ListingGenerateQuickAction} from "@/app/listing-generate-controls";
import {ListingImageGallery} from "@/app/listing-image-gallery";
import {ListingSandboxDeleteControls} from "@/app/listing-sandbox-delete-controls";
import {hasPersistedListingError} from "@/app/listing-error-utils";
import {
  getListingStatusBadgeClassName,
  getListingStatusLabel,
  getListingSubStatusLabel,
} from "@/app/listing-status-flow";
import {isStructuredSku} from "@/app/structured-sku-utils";
import type {EbayEnvironment, Listing} from "@/lib/sidecar-api";

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

function sortOldestCreatedFirst(listings: Listing[]): Listing[] {
  return [...listings].sort(
    (left, right) =>
      new Date(left.created_at).getTime() -
      new Date(right.created_at).getTime(),
  );
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

const INTERACTIVE_ROW_DESCENDANT_SELECTOR = [
  "a",
  "button",
  "dialog",
  "form",
  "input",
  "label",
  "select",
  "summary",
  "textarea",
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="dialog"]',
  '[role="link"]',
].join(",");

function isPublishedListing(status: Listing["status"]): boolean {
  return status === "exported" || status === "listed";
}

function getPublishedStatusLabel(status: Listing["status"]): string {
  return status === "exported" ? "Exported" : getListingStatusLabel(status);
}

function PublishedListingsPanel({
  ebayEnvironment,
  listings,
  onDeleteRequested,
}: {
  ebayEnvironment: EbayEnvironment["environment"] | null;
  listings: Listing[];
  onDeleteRequested: (listing: Listing) => void;
}) {
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
      <div className="max-h-[22rem] overflow-y-auto overflow-x-auto">
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
                ...(ebayEnvironment === "sandbox" ? ["Actions"] : []),
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
                {ebayEnvironment === "sandbox" ? (
                  <td className="px-4 py-3 text-sm text-stone-600">
                    <button
                      type="button"
                      disabled={
                        !isStructuredSku(listing.sku) ||
                        listing.sold_at !== null
                      }
                      title={
                        !isStructuredSku(listing.sku)
                          ? "A valid structured SKU is required for sandbox deletion."
                          : listing.sold_at !== null
                            ? "Sold listings cannot be deleted."
                            : "Permanently delete this sandbox listing"
                      }
                      onClick={() => onDeleteRequested(listing)}
                      className="inline-flex justify-center whitespace-nowrap rounded-full border border-rose-900 bg-rose-700 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:border-rose-300 disabled:bg-rose-100 disabled:text-rose-500 disabled:opacity-60"
                    >
                      Delete Sandbox Listing
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ListingsTableEditable({
  ebayEnvironment = null,
  listings,
  onListingAbandoned,
  onSandboxListingDeleted,
}: {
  ebayEnvironment?: EbayEnvironment["environment"] | null;
  listings: Listing[];
  onListingAbandoned?: (listingId: string) => void;
  onSandboxListingDeleted?: (listingId: string) => void;
}) {
  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    null,
  );
  const [abandonListingId, setAbandonListingId] = useState<string | null>(null);
  const [sandboxDeleteListing, setSandboxDeleteListing] =
    useState<Listing | null>(null);
  const activeListings = useMemo(
    () =>
      sortOldestCreatedFirst(
        listings.filter((listing) => !isPublishedListing(listing.status)),
      ),
    [listings],
  );
  const publishedListings = useMemo(
    () =>
      sortNewestFirst(
        listings.filter((listing) => isPublishedListing(listing.status)),
      ),
    [listings],
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

  function handleListingAbandoned(listingId: string) {
    setSelectedListingId((currentId) =>
      currentId === listingId ? null : currentId,
    );
    setAbandonListingId(null);
    onListingAbandoned?.(listingId);
  }

  function handleSandboxListingDeleted(listingId: string) {
    setSandboxDeleteListing(null);
    onSandboxListingDeleted?.(listingId);
  }

  function toggleSelectedListing(listingId: string) {
    setSelectedListingId((currentId) =>
      currentId === listingId ? null : listingId,
    );
  }

  function handleSummaryRowClick(
    event: ReactMouseEvent<HTMLTableRowElement>,
    listingId: string,
  ) {
    if (
      event.target instanceof Element &&
      event.target.closest(INTERACTIVE_ROW_DESCENDANT_SELECTOR)
    ) {
      return;
    }

    toggleSelectedListing(listingId);
  }

  return (
    <div>
      {activeListings.length > 0 ? (
        <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-stone-950/10 bg-stone-50/80 shadow-[0_14px_40px_rgba(68,64,60,0.08)]">
          <div
            className="max-h-[calc(100vh-14rem)] overflow-auto xl:max-h-[calc(100vh-12rem)]"
            style={{scrollbarGutter: "stable"}}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[68rem] table-fixed border-collapse">
                <colgroup>
                  <col className="w-[12%]" />
                  <col className="w-[11%]" />
                  <col className="w-[11%]" />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                  <col className="w-[7%]" />
                  <col className="w-[11%]" />
                  <col className="w-[16%]" />
                </colgroup>
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
                          onClick={
                            intakeOnly
                              ? undefined
                              : (event) =>
                                  handleSummaryRowClick(
                                    event,
                                    listing.listing_id,
                                  )
                          }
                          className={`border-b border-stone-950/10 ${
                            intakeOnly
                              ? "bg-stone-100/50"
                              : `cursor-pointer transition-colors hover:bg-stone-100/80 ${
                                  isSelected ? "bg-stone-100/80" : ""
                                }`
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
                          <td className="break-words px-4 py-3 text-sm font-semibold text-stone-900">
                            {listing.title ?? "Untitled listing"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="min-w-0 overflow-hidden">
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
                            <div className="inline-flex flex-col items-stretch gap-1.5">
                              <ListingGenerateQuickAction listing={listing} />
                              <ListingApproveForExportQuickAction
                                listing={listing}
                                onApproveForExport={() =>
                                  setSelectedListingId(null)
                                }
                              />
                              {intakeOnly ? (
                                <span className="inline-flex justify-center whitespace-nowrap rounded-full border border-stone-300 bg-white px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-stone-500">
                                  Read only
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  title={actionTitle}
                                  onClick={() =>
                                    toggleSelectedListing(listing.listing_id)
                                  }
                                  className="inline-flex justify-center whitespace-nowrap rounded-full border border-stone-950/15 bg-white px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                                >
                                  {actionLabel}
                                </button>
                              )}
                              <button
                                type="button"
                                title={
                                  listing.status === "assets_ready" ||
                                  listing.status === "needs_review"
                                    ? "Abandon this listing"
                                    : "Only Assets ready or Needs review listings can be abandoned."
                                }
                                disabled={
                                  listing.status !== "assets_ready" &&
                                  listing.status !== "needs_review"
                                }
                                onClick={() =>
                                  setAbandonListingId(listing.listing_id)
                                }
                                className="inline-flex justify-center whitespace-nowrap rounded-full border border-rose-800 bg-rose-700 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:border-rose-300 disabled:bg-rose-100 disabled:text-rose-500 disabled:opacity-60"
                              >
                                Abandon Listing
                              </button>
                            </div>
                          </td>
                        </tr>

                        {!intakeOnly && isSelected ? (
                          <tr className="border-b border-stone-950/10 last:border-b-0">
                            <td
                              colSpan={8}
                              className="px-4 py-4"
                              onSubmitCapture={(event) => {
                                const submittedForm = event.target;
                                if (
                                  submittedForm instanceof HTMLFormElement &&
                                  new FormData(submittedForm).has(
                                    "current_status",
                                  )
                                ) {
                                  setSelectedListingId(null);
                                }
                              }}
                            >
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
        <PublishedListingsPanel
          ebayEnvironment={ebayEnvironment}
          listings={publishedListings}
          onDeleteRequested={setSandboxDeleteListing}
        />
      </div>

      {abandonListingId !== null ? (
        <ListingAbandonControls
          key={abandonListingId}
          listingId={abandonListingId}
          onAbandoned={handleListingAbandoned}
          onCancel={() => setAbandonListingId(null)}
        />
      ) : null}

      {sandboxDeleteListing !== null &&
      isStructuredSku(sandboxDeleteListing.sku) ? (
        <ListingSandboxDeleteControls
          key={`${sandboxDeleteListing.listing_id}:${sandboxDeleteListing.updated_at}`}
          expectedSku={sandboxDeleteListing.sku}
          expectedUpdatedAt={sandboxDeleteListing.updated_at}
          listingId={sandboxDeleteListing.listing_id}
          onDeleted={handleSandboxListingDeleted}
          onCancel={() => setSandboxDeleteListing(null)}
        />
      ) : null}
    </div>
  );
}

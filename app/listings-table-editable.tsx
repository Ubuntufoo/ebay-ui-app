"use client";

import {Fragment, useState} from "react";

import {ListingEditForm} from "@/app/listing-edit-form";
import {ListingImageGallery} from "@/app/listing-image-gallery";
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

export function ListingsTableEditable({listings}: {listings: Listing[]}) {
  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    null,
  );

  return (
    <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-stone-950/10 bg-stone-50/80 shadow-[0_14px_40px_rgba(68,64,60,0.08)]">
      <div className="max-h-[24rem] overflow-auto">
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
                  className="px-5 py-4 text-xs font-bold uppercase tracking-[0.18em] text-stone-500"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listings.map((listing) => {
              const isSelected = selectedListingId === listing.listing_id;

              return (
                <Fragment key={listing.id}>
                  <tr className="border-b border-stone-950/10">
                    <td className="px-5 py-4 font-mono text-sm text-stone-600">
                      {listing.listing_id}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-stone-950 px-3 py-1 text-xs font-semibold text-stone-50">
                        {listing.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-600">
                      {listing.sub_status}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-stone-900">
                      {listing.title ?? "Untitled listing"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="min-w-40">
                        <ListingImageGallery
                          listingId={listing.listing_id}
                          imageUrls={listing.image_urls}
                          compact
                          showUrls={false}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-600">
                      {formatPrice(listing.price)}
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-600">
                      {formatUpdatedAt(listing.updated_at)}
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-600">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedListingId((currentId) =>
                            currentId === listing.listing_id
                              ? null
                              : listing.listing_id,
                          )
                        }
                        className="inline-flex rounded-full border border-stone-950/15 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                      >
                        Open/Edit
                      </button>
                    </td>
                  </tr>

                  {isSelected ? (
                    <tr className="border-b border-stone-950/10 last:border-b-0">
                      <td colSpan={8} className="px-5 py-5">
                        <ListingEditForm
                          key={`${listing.listing_id}:${listing.updated_at}`}
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
  );
}

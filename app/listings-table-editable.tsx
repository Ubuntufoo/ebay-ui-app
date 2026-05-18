"use client";

import {Fragment, useState} from "react";

import {ListingEditForm} from "@/app/listing-edit-form";
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
    <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-stone-950/10 bg-stone-50/80">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-stone-950/10 bg-stone-100/80 text-left">
              {[
                "listing_id",
                "status",
                "sub_status",
                "title",
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
                      <td colSpan={7} className="px-5 py-5">
                        <ListingEditForm
                          key={listing.listing_id}
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
  );
}

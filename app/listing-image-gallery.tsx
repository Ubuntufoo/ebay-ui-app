"use client";

import {useState} from "react";

import {readListingImageUrls} from "@/app/listing-image-url-utils";
import type {Listing} from "@/lib/sidecar-api";

function ListingImageThumbnail({
  url,
  listingId,
  index,
  compact,
}: {
  compact: boolean;
  index: number;
  listingId: string;
  url: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex aspect-square items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-100 px-3 text-center text-xs font-medium text-stone-500 ${
          compact ? "w-20" : "w-full"
        }`}
      >
        Preview unavailable
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`${listingId} image ${index + 1}`}
      loading="lazy"
      width={320}
      height={320}
      onError={() => setFailed(true)}
      className={`aspect-square rounded-2xl border border-stone-950/10 bg-stone-100 object-cover ${
        compact ? "w-20" : "w-full"
      }`}
    />
  );
}

export function ListingImageGallery({
  imageUrls,
  listingId,
  compact = false,
  emptyLabel = "No images uploaded",
  showUrls = true,
}: {
  compact?: boolean;
  emptyLabel?: string;
  imageUrls: Listing["image_urls"] | string[];
  listingId: string;
  showUrls?: boolean;
}) {
  const urls = readListingImageUrls(imageUrls);

  if (urls.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-950/15 bg-stone-50 px-4 py-6 text-sm text-stone-500">
        {emptyLabel}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {urls.map((url, index) => (
          <ListingImageThumbnail
            key={`${url}:${index}`}
            compact
            index={index}
            listingId={listingId}
            url={url}
          />
        ))}
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
          <ListingImageThumbnail
            compact={false}
            index={index}
            listingId={listingId}
            url={url}
          />
          {showUrls ? (
            <p className="mt-2 truncate text-xs text-stone-500" title={url}>
              {url}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

"use client";

import {useState} from "react";

import {
  countListingImageUrls,
  getListingImagePreviewUrl,
  isHttpListingImageUrl,
  readListingImageUrls,
} from "@/app/listing-image-url-utils";
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
  showAllImages = false,
  showUrls = true,
}: {
  compact?: boolean;
  emptyLabel?: string;
  imageUrls: Listing["image_urls"] | string[];
  listingId: string;
  showAllImages?: boolean;
  showUrls?: boolean;
}) {
  const urls = readListingImageUrls(imageUrls);
  const previewUrl = getListingImagePreviewUrl(imageUrls);
  const remoteUrls = urls.filter(isHttpListingImageUrl);
  const hasLocalOnly = urls.length > 0 && remoteUrls.length === 0;
  const imageCount = countListingImageUrls(imageUrls);

  if (urls.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-950/15 bg-stone-50 px-4 py-6 text-sm text-stone-500">
        {emptyLabel}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-stone-950/10 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">
            {imageCount} {imageCount === 1 ? "image" : "images"}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
            {previewUrl
              ? "Preview"
              : hasLocalOnly
                ? "Local only"
                : "No preview"}
          </span>
        </div>

        {showAllImages ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(5.75rem,5.75rem))] justify-start gap-2">
            {urls.map((url, index) => {
              const isRemote = isHttpListingImageUrl(url);
              const previewContent = isRemote ? (
                <ListingImageThumbnail
                  compact
                  index={index}
                  listingId={listingId}
                  url={url}
                />
              ) : (
                <div className="flex aspect-square w-20 items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-100 px-3 text-center text-[11px] font-medium text-stone-500">
                  Preview unavailable
                </div>
              );

              return isRemote ? (
                <a
                  key={`${url}:${index}`}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${listingId} image ${index + 1}`}
                  title={url}
                  className="group block space-y-1"
                >
                  {previewContent}
                  <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500 group-hover:text-stone-700">
                    Image {index + 1}
                  </p>
                </a>
              ) : (
                <div key={`${url}:${index}`} className="space-y-1">
                  {previewContent}
                  <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                    Image {index + 1}
                  </p>
                </div>
              );
            })}
          </div>
        ) : previewUrl ? (
          <ListingImageThumbnail
            compact
            index={0}
            listingId={listingId}
            url={previewUrl}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-100 px-3 py-4 text-sm text-stone-500">
            {hasLocalOnly
              ? "Local images pending upload"
              : "No remote preview available"}
          </div>
        )}

        {showUrls && previewUrl && !showAllImages ? (
          <p className="truncate text-xs text-stone-500" title={previewUrl}>
            {previewUrl}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-stone-950/10 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">
          {imageCount} {imageCount === 1 ? "image" : "images"}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
          {previewUrl ? "Preview" : hasLocalOnly ? "Local only" : "No preview"}
        </span>
      </div>

      {previewUrl ? (
        <div className="overflow-hidden rounded-[1.25rem] border border-stone-950/10 bg-white p-2 shadow-[0_8px_22px_rgba(68,64,60,0.08)]">
          <ListingImageThumbnail
            compact={false}
            index={0}
            listingId={listingId}
            url={previewUrl}
          />
          {showUrls ? (
            <p
              className="mt-2 truncate text-xs text-stone-500"
              title={previewUrl}
            >
              {previewUrl}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-100 px-4 py-5 text-sm text-stone-500">
          {hasLocalOnly
            ? "Local images pending upload"
            : "No remote preview available"}
        </div>
      )}
    </div>
  );
}

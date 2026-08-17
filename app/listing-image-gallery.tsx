"use client";

import {startTransition, useEffect, useRef, useState} from "react";

import {saveListingImageUrls} from "@/app/listing-image-url-actions";
import {initialSaveListingImageUrlsActionState} from "@/app/listing-image-url-state";
import {
  isHttpListingImageUrl,
  readListingImageUrls,
} from "@/app/listing-image-url-utils";
import type {Listing} from "@/lib/sidecar-api";

function ListingImageThumbnail({
  url,
  listingId,
  index,
  compact,
  quietFallback = false,
}: {
  compact: boolean;
  index: number;
  listingId: string;
  quietFallback?: boolean;
  url: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    if (quietFallback) {
      return (
        <div
          className={`aspect-square rounded-2xl border border-dashed border-stone-300 bg-stone-100 ${
            compact ? "w-20" : "w-full"
          }`}
          aria-hidden="true"
        />
      );
    }

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
  showCaptions = true,
  showUrls = true,
}: {
  compact?: boolean;
  emptyLabel?: string;
  imageUrls: Listing["image_urls"] | string[];
  listingId: string;
  showAllImages?: boolean;
  showCaptions?: boolean;
  showUrls?: boolean;
}) {
  const urls = readListingImageUrls(imageUrls);
  const remoteUrls = urls.filter(isHttpListingImageUrl);
  const hasLocalOnly = urls.length > 0 && remoteUrls.length === 0;
  const imageCount = urls.length;
  const previewUrl = remoteUrls[0] ?? null;

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
        {showCaptions ? (
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-stone-950/10 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">
              {imageCount} {imageCount === 1 ? "image" : "images"}
            </span>
          </div>
        ) : null}

        {showAllImages && hasLocalOnly ? (
          showCaptions ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-100 px-3 py-4 text-sm text-stone-500">
              Local images pending upload
            </div>
          ) : (
            <div className="flex flex-nowrap items-start gap-2 overflow-x-auto pb-1">
              {urls.map((url, index) => {
                const isRemote = isHttpListingImageUrl(url);

                return isRemote ? (
                  <ListingImageThumbnail
                    key={`${url}:${index}`}
                    compact
                    index={index}
                    listingId={listingId}
                    quietFallback
                    url={url}
                  />
                ) : (
                  <div
                    key={`${url}:${index}`}
                    className="aspect-square w-20 shrink-0 rounded-2xl border border-dashed border-stone-300 bg-stone-100"
                    aria-hidden="true"
                  />
                );
              })}
            </div>
          )
        ) : showAllImages ? (
          <div className="flex flex-nowrap items-start gap-2 overflow-x-auto pb-1">
            {urls.map((url, index) => {
              const isRemote = isHttpListingImageUrl(url);
              const previewContent = isRemote ? (
                <ListingImageThumbnail
                  compact
                  index={index}
                  listingId={listingId}
                  quietFallback={!showCaptions}
                  url={url}
                />
              ) : (
                <div
                  className="aspect-square w-20 rounded-2xl border border-dashed border-stone-300 bg-stone-100"
                  aria-hidden="true"
                />
              );

              return isRemote ? (
                <a
                  key={`${url}:${index}`}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${listingId} image ${index + 1}`}
                  title={url}
                  className="group block shrink-0 space-y-1"
                >
                  {previewContent}
                  {showCaptions ? (
                    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500 group-hover:text-stone-700">
                      Image {index + 1}
                    </p>
                  ) : null}
                </a>
              ) : (
                <div key={`${url}:${index}`} className="shrink-0 space-y-1">
                  {previewContent}
                  {showCaptions ? (
                    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                      Image {index + 1}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : previewUrl ? (
          <ListingImageThumbnail
            compact
            index={0}
            listingId={listingId}
            quietFallback={!showCaptions}
            url={previewUrl}
          />
        ) : (
          <div
            className={`rounded-2xl border border-dashed border-stone-300 bg-stone-100 ${
              showCaptions ? "px-3 py-4 text-sm text-stone-500" : "aspect-square w-20"
            }`}
          >
            {showCaptions
              ? hasLocalOnly
                ? "Local images pending upload"
                : "No remote preview available"
              : null}
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

function moveListingImage<T>(
  items: T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

export function ListingImageOrderManager({
  imageUrls,
  listingId,
}: {
  imageUrls: Listing["image_urls"] | string[];
  listingId: string;
}) {
  const propUrls = readListingImageUrls(imageUrls);
  const [orderedUrls, setOrderedUrls] = useState(propUrls);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const persistedUrlsRef = useRef(propUrls);
  const propInputRef = useRef<{
    imageUrls: Listing["image_urls"] | string[];
    listingId: string;
  }>({imageUrls, listingId});
  const requestGenerationRef = useRef(0);

  useEffect(() => {
    if (
      propInputRef.current.imageUrls === imageUrls &&
      propInputRef.current.listingId === listingId
    ) {
      return;
    }

    propInputRef.current = {imageUrls, listingId};
    requestGenerationRef.current += 1;
    const nextPropUrls = readListingImageUrls(imageUrls);
    persistedUrlsRef.current = nextPropUrls;
    setDraggedIndex(null);
    setOrderedUrls(nextPropUrls);
    setError(null);
    setIsSaving(false);
  }, [imageUrls, listingId]);

  const canReorder =
    propUrls.length >= 2 && propUrls.every(isHttpListingImageUrl);

  if (!canReorder) {
    return null;
  }

  function persistOrder(nextUrls: string[], previousUrls: string[]) {
    const requestGeneration = ++requestGenerationRef.current;

    setDraggedIndex(null);
    setOrderedUrls(nextUrls);
    setError(null);
    setIsSaving(true);

    const formData = new FormData();
    formData.set("listing_id", listingId);
    formData.set("image_urls", nextUrls.join("\n"));

    startTransition(async () => {
      try {
        const result = await saveListingImageUrls(
          initialSaveListingImageUrlsActionState,
          formData,
        );

        if (requestGeneration !== requestGenerationRef.current) {
          return;
        }

        if (result?.error) {
          setOrderedUrls(previousUrls);
          setError(result.error);
        } else {
          persistedUrlsRef.current = nextUrls;
        }
      } catch {
        if (requestGeneration !== requestGenerationRef.current) {
          return;
        }
        setOrderedUrls(previousUrls);
        setError("Unable to save image order.");
      } finally {
        if (requestGeneration === requestGenerationRef.current) {
          setIsSaving(false);
        }
      }
    });
  }

  function handleDrop(targetIndex: number) {
    if (draggedIndex === null || draggedIndex === targetIndex || isSaving) {
      setDraggedIndex(null);
      return;
    }

    const previousUrls = persistedUrlsRef.current;
    const nextUrls = moveListingImage(orderedUrls, draggedIndex, targetIndex);
    persistOrder(nextUrls, previousUrls);
  }

  function handleKeyboardMove(index: number, direction: -1 | 1) {
    if (isSaving) {
      return;
    }

    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= orderedUrls.length) {
      return;
    }

    const previousUrls = persistedUrlsRef.current;
    const nextUrls = moveListingImage(orderedUrls, index, targetIndex);
    persistOrder(nextUrls, previousUrls);
  }

  return (
    <section
      aria-label="Listing image order"
      aria-busy={isSaving}
      className="grid gap-3 rounded-2xl border border-stone-950/10 bg-stone-50/60 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap items-start gap-3"
          role="list"
          aria-label="Listing images"
        >
          {orderedUrls.map((url, index) => (
            <div
              key={url + ":" + index}
              role="listitem"
              tabIndex={isSaving ? -1 : 0}
              draggable={!isSaving}
              onDragStart={(event) => {
                const {dataTransfer} = event;
                if (dataTransfer) {
                  dataTransfer.effectAllowed = "move";
                  dataTransfer.setData("text/plain", String(index));
                }
                setDraggedIndex(index);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => setDraggedIndex(null)}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  handleKeyboardMove(index, -1);
                } else if (event.key === "ArrowRight") {
                  event.preventDefault();
                  handleKeyboardMove(index, 1);
                }
              }}
              className={[
                "relative w-24 rounded-2xl border-2 bg-white p-1 transition",
                index === 0
                  ? "border-stone-950 ring-2 ring-stone-950/15"
                  : "border-stone-950/10",
                draggedIndex === index ? "opacity-50" : "",
              ].join(" ")}
            >
              <ListingImageThumbnail
                compact={false}
                index={index}
                listingId={listingId}
                quietFallback
                url={url}
              />
              <span
                aria-label={index === 0 ? "Primary image" : "Image " + (index + 1)}
                className={[
                  "absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
                  index === 0
                    ? "bg-stone-950 text-stone-50"
                    : "bg-white/90 text-stone-600",
                ].join(" ")}
              >
                {index === 0 ? "1 Primary" : index + 1}
              </span>
            </div>
          ))}
        </div>
        {isSaving ? (
          <span className="text-xs font-semibold text-stone-500">Saving...</span>
        ) : null}
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-stone-900"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}

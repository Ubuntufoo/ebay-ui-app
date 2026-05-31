import type {Listing} from "@/lib/sidecar-api";

export function isHttpListingImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function parseListingImageUrlsInput(value: string): {
  invalidUrls: string[];
  urls: string[];
} {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");

  const urls: string[] = [];
  const invalidUrls: string[] = [];

  for (const line of lines) {
    if (isHttpListingImageUrl(line)) {
      urls.push(line);
    } else {
      invalidUrls.push(line);
    }
  }

  return {
    invalidUrls,
    urls,
  };
}

export function readListingImageUrls(value: Listing["image_urls"]): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

export function formatListingImageUrls(value: Listing["image_urls"]): string {
  return readListingImageUrls(value).join("\n");
}

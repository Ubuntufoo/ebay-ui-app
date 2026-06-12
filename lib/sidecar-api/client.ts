import "server-only";

import {getSidecarConfig} from "@/lib/config/sidecar";
import type {
  AppSettings,
  EnqueueGenerateAiResponse,
  EbayEnvironment,
  GeminiDailyUsageSummary,
  Listing,
  ListingsResponse,
  RetryPublishListingResponse,
  UpdateListingInput,
  UpdateListingImageUrlsInput,
  UpdateListingWorkflowStateInput,
  SidecarErrorResponse,
} from "@/lib/sidecar-api/types";

export class SidecarApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly response?: SidecarErrorResponse,
  ) {
    super(message);
    this.name = "SidecarApiError";
  }
}

function buildHeaders(): HeadersInit {
  const {bearerToken} = getSidecarConfig();

  if (!bearerToken) {
    return {
      Accept: "application/json",
    };
  }

  return {
    Accept: "application/json",
    Authorization: `Bearer ${bearerToken}`,
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function readErrorResponse(
  response: Response,
): Promise<SidecarErrorResponse | undefined> {
  const contentType = response.headers.get("content-type");

  if (!contentType?.includes("application/json")) {
    return undefined;
  }

  try {
    return await parseJson<SidecarErrorResponse>(response);
  } catch {
    return undefined;
  }
}

function buildErrorMessage(
  status: number,
  payload?: SidecarErrorResponse,
): string {
  if (payload?.error === "invalid_request" && payload.details?.length) {
    const issues = payload.details
      .map((detail) => `${detail.path}: ${detail.message}`)
      .join("; ");
    return `Sidecar request failed with ${status} (${payload.error}): ${issues}`;
  }

  if (payload?.message) {
    return `Sidecar request failed with ${status} (${payload.error}): ${payload.message}`;
  }

  if (payload?.error) {
    return `Sidecar request failed with ${status} (${payload.error}).`;
  }

  return `Sidecar request failed with ${status}.`;
}

async function sidecarFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const {apiUrl} = getSidecarConfig();
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...buildHeaders(),
      ...(init?.headers ?? {}),
    },
    method: init?.method ?? "GET",
  });

  if (!response.ok) {
    const payload = await readErrorResponse(response);
    throw new SidecarApiError(
      buildErrorMessage(response.status, payload),
      response.status,
      payload,
    );
  }

  return await parseJson<T>(response);
}

export async function listListings(): Promise<Listing[]> {
  const response = await sidecarFetch<ListingsResponse>("/api/listings");
  return response.listings;
}

export async function getListing(listingId: string): Promise<Listing> {
  return await sidecarFetch<Listing>(
    `/api/listings/${encodeURIComponent(listingId)}`,
  );
}

export async function getAppSettings(): Promise<AppSettings> {
  return await sidecarFetch<AppSettings>("/api/app-settings");
}

export async function updatePricingServiceEnabled(
  pricingServiceEnabled: boolean,
): Promise<AppSettings> {
  return await sidecarFetch<AppSettings>("/api/app-settings", {
    method: "PATCH",
    body: JSON.stringify({
      pricingServiceEnabled,
    }),
    headers: {
      ...buildHeaders(),
      "Content-Type": "application/json",
    },
  });
}

export async function getGeminiUsage(): Promise<GeminiDailyUsageSummary> {
  return await sidecarFetch<GeminiDailyUsageSummary>("/api/gemini-usage");
}

export async function getEbayEnvironment(): Promise<EbayEnvironment> {
  return await sidecarFetch<EbayEnvironment>("/api/ebay-environment");
}

// `createListing` client wrapper removed: manual/test create listing UI deleted.
// Backend APIs remain available at the sidecar; call directly from server code where needed.

function mapUpdateListingInput(
  input: UpdateListingInput,
): Record<string, unknown> {
  return {
    categoryId: input.categoryId,
    conditionId: input.conditionId,
    conditionNotes: input.conditionNotes,
    description: input.description,
    itemSpecifics: input.itemSpecifics,
    price: input.price,
    sellerHints: input.sellerHints,
    title: input.title,
  };
}

export async function updateListing(
  listingId: string,
  patch: UpdateListingInput,
): Promise<Listing> {
  return await sidecarFetch<Listing>(
    `/api/listings/${encodeURIComponent(listingId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(mapUpdateListingInput(patch)),
      headers: {
        ...buildHeaders(),
        "Content-Type": "application/json",
      },
    },
  );
}

export async function updateListingImageUrls(
  listingId: string,
  input: UpdateListingImageUrlsInput,
): Promise<Listing> {
  return await sidecarFetch<Listing>(
    `/api/listings/${encodeURIComponent(listingId)}/image-urls`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
      headers: {
        ...buildHeaders(),
        "Content-Type": "application/json",
      },
    },
  );
}

export async function updateListingWorkflowState(
  listingId: string,
  input: UpdateListingWorkflowStateInput,
): Promise<Listing> {
  return await sidecarFetch<Listing>(
    `/api/listings/${encodeURIComponent(listingId)}/workflow-state`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
      headers: {
        ...buildHeaders(),
        "Content-Type": "application/json",
      },
    },
  );
}

export async function enqueueGenerateAi(
  listingId: string,
  input: {sellerHints?: string | null},
): Promise<EnqueueGenerateAiResponse> {
  return await sidecarFetch<EnqueueGenerateAiResponse>(
    `/api/listings/${encodeURIComponent(listingId)}/generate-ai`,
    {
      method: "POST",
      body: JSON.stringify({
        sellerHints: input.sellerHints ?? null,
      }),
      headers: {
        ...buildHeaders(),
        "Content-Type": "application/json",
      },
    },
  );
}

export async function retryPublishListing(
  listingId: string,
): Promise<RetryPublishListingResponse> {
  return await sidecarFetch<RetryPublishListingResponse>(
    `/api/listings/${encodeURIComponent(listingId)}/retry`,
    {
      method: "POST",
      headers: {
        ...buildHeaders(),
        "Content-Type": "application/json",
      },
    },
  );
}

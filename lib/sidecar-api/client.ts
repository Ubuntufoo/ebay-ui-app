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
  RetryPricingResponse,
  RetryPricingAnalysisResponse,
  UpdateListingInput,
  UpdateListingImageUrlsInput,
  UpdateListingWorkflowStateInput,
  UpdateAppSettingsInput,
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

function buildJsonRequestInit(
  method: "PATCH" | "POST",
  body?: unknown,
): RequestInit {
  return {
    method,
    headers: {
      ...buildHeaders(),
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  };
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

export async function updateAppSettings(
  patch: UpdateAppSettingsInput,
): Promise<AppSettings> {
  return await sidecarFetch<AppSettings>(
    "/api/app-settings",
    buildJsonRequestInit("PATCH", patch),
  );
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
    pricingModifierOptions: input.pricingModifierOptions,
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
    buildJsonRequestInit("PATCH", mapUpdateListingInput(patch)),
  );
}

export async function updateListingImageUrls(
  listingId: string,
  input: UpdateListingImageUrlsInput,
): Promise<Listing> {
  return await sidecarFetch<Listing>(
    `/api/listings/${encodeURIComponent(listingId)}/image-urls`,
    buildJsonRequestInit("PATCH", input),
  );
}

export async function updateListingWorkflowState(
  listingId: string,
  input: UpdateListingWorkflowStateInput,
): Promise<Listing> {
  return await sidecarFetch<Listing>(
    `/api/listings/${encodeURIComponent(listingId)}/workflow-state`,
    buildJsonRequestInit("PATCH", input),
  );
}

export async function enqueueGenerateAi(
  listingId: string,
  input: {sellerHints?: string | null},
): Promise<EnqueueGenerateAiResponse> {
  return await sidecarFetch<EnqueueGenerateAiResponse>(
    `/api/listings/${encodeURIComponent(listingId)}/generate-ai`,
    buildJsonRequestInit("POST", {
      sellerHints: input.sellerHints ?? null,
    }),
  );
}

export async function retryPublishListing(
  listingId: string,
): Promise<RetryPublishListingResponse> {
  return await sidecarFetch<RetryPublishListingResponse>(
    `/api/listings/${encodeURIComponent(listingId)}/retry`,
    buildJsonRequestInit("POST"),
  );
}

export async function retryPricingAnalysis(
  listingId: string,
): Promise<RetryPricingAnalysisResponse> {
  return await sidecarFetch<RetryPricingAnalysisResponse>(
    `/api/listings/${encodeURIComponent(listingId)}/retry-pricing-analysis`,
    buildJsonRequestInit("POST"),
  );
}

export async function retryPricing(
  listingId: string,
): Promise<RetryPricingResponse> {
  return await sidecarFetch<RetryPricingResponse>(
    `/api/listings/${encodeURIComponent(listingId)}/retry-pricing`,
    buildJsonRequestInit("POST"),
  );
}

export async function dismissPricingAnalysisWarnings(
  listingId: string,
  codes: string[],
): Promise<Listing> {
  const response = await sidecarFetch<{listing: Listing}>(
    `/api/listings/${encodeURIComponent(listingId)}/pricing-analysis-warnings/dismiss`,
    buildJsonRequestInit("POST", {codes}),
  );

  return response.listing;
}

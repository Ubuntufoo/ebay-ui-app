export type Json =
  | string
  | number
  | boolean
  | null
  | {[key: string]: Json | undefined}
  | Json[];

export const listingStatuses = [
  "record_created",
  "image_processing_queued",
  "images_processed",
  "assets_ready",
  "generating",
  "needs_review",
  "approved_for_export",
  "listed",
  "sold",
] as const;

export type ListingStatus = (typeof listingStatuses)[number];

export const listingSubStatuses = [
  "grouping_images",
  "preparing_files",
  "waiting_for_image_worker",
  "processing_images",
  "waiting_for_r2_upload",
  "waiting_for_seller_hints",
  "ready_to_generate",
  "ai_call_in_progress",
  "review_pending",
  "publish_queued",
  "publishing_to_ebay",
  "active_live",
  "awaiting_packaging",
  "shipped",
  "idle",
] as const;

export type ListingSubStatus = (typeof listingSubStatuses)[number];

export interface GeminiDailyUsageSummary {
  effective_limit: number;
  remaining: number;
  reset_at: string;
  reset_time_zone: "America/Los_Angeles";
  usage_date: string;
  used: number;
  last_attempt: GeminiAttemptSummary | null;
}

export interface GeminiAttemptSummary {
  provider: string;
  model_name: string;
  display_name: string | null;
  status: string;
  started_at: string;
  finished_at: string | null;
}

export interface SoldCompsUsageSummary {
  limit: number | null;
  updatedAt: string | null;
  used: number | null;
}

export interface PricingAnalysisWarning {
  listing_id: string;
  summary: string;
  code: string;
  severity: "warning";
  retryable: boolean;
  model_name: string | null;
}

export interface ListingIdentityWarning {
  code: string;
  likely_year?: string | null;
  likely_year_range?: string | null;
  severity: "warning";
  summary: string;
}

export interface ListingLatestPricingResearchCompSummary {
  normalization_accepted_count?: number;
  normalization_rejected_count?: number;
  provider_reported_count?: number;
  provider_returned_count?: number;
  rejected_comp_count: number;
  rejected_comp_ids: string[];
  selected_comp_count: number;
  selected_comp_ids: string[];
  total_comp_count: number;
}

export type ListingLatestPricingResearchFailureReason =
  | "provider_zero_results"
  | "all_comps_rejected"
  | "provider_failure"
  | "unknown";

export interface ListingLatestPricingResearchFailureSummary {
  accepted_comp_count?: number;
  provider?: string;
  provider_failure_category?: string;
  provider_failure_code?: string;
  provider_failure_status?: string;
  provider_returned_count?: number;
  query?: string;
  reason: ListingLatestPricingResearchFailureReason;
  rejected_comp_count?: number;
  rejected_reason_counts?: Record<string, number>;
  requested_count?: number;
}

export interface ListingLatestPricingResearchSummary {
  comp_summary: ListingLatestPricingResearchCompSummary;
  confidence: string | null;
  created_at: string;
  error_code: string | null;
  error_message: string | null;
  failure_summary?: ListingLatestPricingResearchFailureSummary | null;
  listing_id: string;
  llm_price_explanation: string | null;
  median_sold_price: number | null;
  pricing_model_name: string | null;
  provider: string;
  query: string | null;
  research_id: string;
  sold_count: number | null;
  status: string;
  suggested_price: number | null;
  updated_at: string;
}

export interface Listing {
  approved_for_export_at: string | null;
  capture_mode: string | null;
  category_id: string | null;
  condition_id: string | null;
  condition_notes: string | null;
  created_at: string;
  description: string | null;
  ebay_listing_id: string | null;
  ebay_listing_status: string | null;
  ebay_listing_url: string | null;
  ebay_offer_id: string | null;
  ese_eligible: boolean | null;
  estimated_weight_oz: number | null;
  exported_at: string | null;
  handling_days: number | null;
  id: string;
  identity_warnings?: ListingIdentityWarning[] | null;
  image_urls: Json;
  item_specifics: Json;
  last_error_at: string | null;
  last_error_code: string | null;
  last_error_context?: Json | null;
  last_error_message?: string | null;
  listing_id: string;
  listing_type: "single" | "lot" | null;
  merchant_location_key: string | null;
  package_type: string | null;
  price: number | null;
  latest_pricing_research?: ListingLatestPricingResearchSummary | null;
  pricing_analysis_warnings?: PricingAnalysisWarning[];
  r2_delete_after: string | null;
  r2_deleted_at: string | null;
  r2_object_keys: Json;
  r2_retention_policy: string | null;
  seller_hints: string | null;
  shipping_profile: string | null;
  sku: string | null;
  sold_at: string | null;
  status: ListingStatus;
  sub_status: ListingSubStatus;
  title: string | null;
  updated_at: string;
}

export interface ListingsResponse {
  listings: Listing[];
}

export interface EnqueueGenerateAiResponse {
  alreadyQueued: boolean;
  job: Json;
  listing: Listing;
}

export interface PricingModifierOptions {
  excludeAutographs?: boolean;
  excludeGraded?: boolean;
  excludeVariants?: boolean;
}

export interface RetryPublishListingResponse {
  alreadyQueued: boolean;
  job: Json;
  listing: Listing;
  workflow: "generate_ai" | "publish";
}

export interface RetryPricingAnalysisResponse {
  job?: Json;
  listing?: Listing;
  message?: string;
}

export interface RetryPricingResponse {
  alreadyQueued: boolean;
  job: Json;
  listing: Listing;
  workflow: "research_price";
}

export interface DismissPricingAnalysisWarningsResponse {
  listing: Listing;
}

export type PricingProviderMode = "off" | "soldcomps" | "apify";

export interface UpdateListingInput {
  categoryId?: string | null;
  conditionId?: string | null;
  conditionNotes?: string | null;
  description?: string | null;
  itemSpecifics?: Json;
  price?: number | null;
  pricingModifierOptions?: PricingModifierOptions;
  sellerHints?: string | null;
  title?: string | null;
}

export interface UpdateListingImageUrlsInput {
  imageUrls: string[];
}

export interface UpdateListingWorkflowStateInput {
  status: ListingStatus;
  subStatus: ListingSubStatus;
}

export interface UpdateAppSettingsInput {
  pricingProviderMode?: PricingProviderMode;
  pricingServiceEnabled?: boolean;
}

export interface AppSettings {
  capture_mode: string | null;
  default_fulfillment_policy_id: string | null;
  default_package_type: string | null;
  default_payment_policy_id: string | null;
  default_return_policy_id: string | null;
  default_shipping_profile: string | null;
  ebay_marketplace_id: string | null;
  gemini_daily_limit: number | null;
  handling_days: number | null;
  id: string;
  incoming_folder_path: string | null;
  max_order_syncs_per_day: number | null;
  merchant_location_key: string | null;
  office_location_name: string | null;
  pricing_provider_mode: PricingProviderMode;
  processed_folder_path: string | null;
  pricing_service_enabled: boolean;
  r2_retention_days_after_sold: number | null;
  soldcomps_usage: SoldCompsUsageSummary | null;
  updated_at: string;
}

export interface EbayEnvironment {
  environment: "sandbox" | "production";
  marketplace_id: string;
  api_base_url: string;
  oauth_base_url: string;
}

export interface SidecarValidationErrorDetail {
  message: string;
  path: string;
}

export interface SidecarErrorResponse {
  error: "invalid_request" | "not_found" | "server_error" | string;
  message?: string;
  details?: SidecarValidationErrorDetail[];
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
  image_urls: Json;
  item_specifics: Json;
  last_error_at: string | null;
  last_error_code: string | null;
  listing_id: string;
  listing_type: "single" | "lot" | null;
  merchant_location_key: string | null;
  package_type: string | null;
  price: number | null;
  r2_delete_after: string | null;
  r2_deleted_at: string | null;
  r2_object_keys: Json;
  r2_retention_policy: string | null;
  seller_hints: string | null;
  shipping_profile: string | null;
  sku: string | null;
  sold_at: string | null;
  status: string;
  sub_status: string;
  title: string | null;
  updated_at: string;
}

export interface ListingsResponse {
  listings: Listing[];
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
  processed_folder_path: string | null;
  r2_retention_days_after_sold: number | null;
  updated_at: string;
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

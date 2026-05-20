import {createClient} from "@supabase/supabase-js";

import type {Listing} from "@/lib/sidecar-api/types";

const GENERATE_AI_JOB_TYPE = "generate_ai" as const;
const JOB_STATUS_QUEUED = "queued" as const;
const JOB_STATUS_RUNNING = "running" as const;
const GENERATE_AI_ACTIVE_JOB_UNIQUE_INDEX = "jobs_generate_ai_active_listing_idx";
const POSTGRES_UNIQUE_VIOLATION_CODE = "23505";

interface SupabaseAdminConfig {
  serviceRoleKey: string;
  url: string;
}

type ListingStatusRow = Pick<Listing, "listing_id" | "status">;

interface GenerateAiJobInsert {
  job_type: typeof GENERATE_AI_JOB_TYPE;
  listing_id: string;
  next_run_at: null;
  status: typeof JOB_STATUS_QUEUED;
}

export interface GenerateAiEnqueueResult {
  alreadyQueued: boolean;
}

interface SupabaseErrorWithCode {
  code?: string;
  message: string;
}

function getSupabaseAdminConfig(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseAdminConfig {
  const url = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) {
    throw new Error("Missing SUPABASE_URL.");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  return {
    serviceRoleKey,
    url,
  };
}

function createSupabaseAdminClient(env: NodeJS.ProcessEnv = process.env) {
  const {serviceRoleKey, url} = getSupabaseAdminConfig(env);

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function isSupabaseErrorWithCode(value: unknown): value is SupabaseErrorWithCode {
  return typeof value === "object" && value !== null && "message" in value;
}

function isActiveGenerateAiConflict(error: unknown): error is SupabaseErrorWithCode {
  return (
    isSupabaseErrorWithCode(error) &&
    error.code === POSTGRES_UNIQUE_VIOLATION_CODE &&
    error.message.includes(GENERATE_AI_ACTIVE_JOB_UNIQUE_INDEX)
  );
}

async function getListingStatusRow(
  client: ReturnType<typeof createSupabaseAdminClient>,
  listingId: string,
): Promise<ListingStatusRow | null> {
  const {data, error} = await client
    .from("listings")
    .select("listing_id,status")
    .eq("listing_id", listingId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as ListingStatusRow | null;
}

async function insertGenerateAiJob(
  client: ReturnType<typeof createSupabaseAdminClient>,
  listingId: string,
): Promise<GenerateAiEnqueueResult> {
  const payload: GenerateAiJobInsert = {
    job_type: GENERATE_AI_JOB_TYPE,
    listing_id: listingId,
    next_run_at: null,
    status: JOB_STATUS_QUEUED,
  };

  const {data, error} = await client.from("jobs").insert(payload).select("id").single();

  if (!error) {
    void data;
    return {
      alreadyQueued: false,
    };
  }

  if (isActiveGenerateAiConflict(error)) {
    const activeJobResult = await client
      .from("jobs")
      .select("id")
      .eq("listing_id", listingId)
      .eq("job_type", GENERATE_AI_JOB_TYPE)
      .in("status", [JOB_STATUS_QUEUED, JOB_STATUS_RUNNING])
      .order("created_at", {ascending: false})
      .limit(1)
      .maybeSingle();

    if (activeJobResult.error) {
      throw new Error(activeJobResult.error.message);
    }

    if (activeJobResult.data) {
      return {
        alreadyQueued: true,
      };
    }
  }

  throw new Error(error.message);
}

export async function enqueueGenerateAiJob(
  listingId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<GenerateAiEnqueueResult> {
  const client = createSupabaseAdminClient(env);
  const listing = await getListingStatusRow(client, listingId);

  if (!listing) {
    throw new Error(`Listing "${listingId}" was not found.`);
  }

  if (listing.status !== "assets_ready") {
    throw new Error(
      `Listing "${listingId}" is not eligible for generate_ai from status "${listing.status}".`,
    );
  }

  return await insertGenerateAiJob(client, listingId);
}

import type { DemoAnalyticsSourceType, DemoIngestionStatus } from "~/lib/types";

// ---------------------------------------------------------------------------
// Supabase interface
// ---------------------------------------------------------------------------

interface SupabaseResult<T = unknown> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

interface SupabaseLike {
  from(table: string): {
    insert(rows: Record<string, unknown>[]): PromiseLike<SupabaseResult> & {
      select(columns: string): {
        single(): PromiseLike<SupabaseResult<{ id: string }>>;
      };
    };
    select(columns?: string): {
      eq(
        column: string,
        value: unknown,
      ): {
        order(
          column: string,
          options?: { ascending: boolean },
        ): {
          limit(count: number): {
            single(): PromiseLike<SupabaseResult<Record<string, unknown>>>;
          };
        };
        single(): PromiseLike<SupabaseResult<Record<string, unknown>>>;
      };
    };
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueueFaceitDemoParseInput {
  faceitMatchId: string;
  demoUrl: string | null;
}

interface QueueManualDemoParseInput {
  faceitMatchId: string;
  fileName: string;
  fileSha256: string;
  fileSizeBytes?: number | null;
}

interface QueueResult {
  id: string | null;
  alreadyExists: boolean;
  sourceUnavailable?: boolean;
}

const ACTIVE_STATUSES: DemoIngestionStatus[] = ["queued", "parsing", "parsed"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findActiveIngestion(
  supabase: SupabaseLike,
  faceitMatchId: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("demo_ingestions")
    .select("*")
    .eq("faceit_match_id", faceitMatchId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;

  const status = String(data.status);
  if (ACTIVE_STATUSES.includes(status as DemoIngestionStatus)) {
    return data;
  }

  return null;
}

async function insertIngestionRow(
  supabase: SupabaseLike,
  row: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await supabase
    .from("demo_ingestions")
    .insert([row])
    .select("id")
    .single();

  if (error) throw new Error(`insertIngestionRow failed: ${error.message}`);
  return data!.id;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function queueFaceitDemoParse(
  supabase: SupabaseLike,
  input: QueueFaceitDemoParseInput,
): Promise<QueueResult> {
  // No demo URL → mark source as unavailable
  if (!input.demoUrl) {
    await insertIngestionRow(supabase, {
      faceit_match_id: input.faceitMatchId,
      source_type: "faceit_demo_url" satisfies DemoAnalyticsSourceType,
      source_url: null,
      status: "source_unavailable" satisfies DemoIngestionStatus,
    });
    return { id: null, alreadyExists: false, sourceUnavailable: true };
  }

  // Check for existing active ingestion
  const existing = await findActiveIngestion(supabase, input.faceitMatchId);
  if (existing) {
    return { id: String(existing.id), alreadyExists: true };
  }

  // Queue new ingestion
  const id = await insertIngestionRow(supabase, {
    faceit_match_id: input.faceitMatchId,
    source_type: "faceit_demo_url" satisfies DemoAnalyticsSourceType,
    source_url: input.demoUrl,
    status: "queued" satisfies DemoIngestionStatus,
  });

  return { id, alreadyExists: false };
}

export async function queueManualDemoParse(
  supabase: SupabaseLike,
  input: QueueManualDemoParseInput,
): Promise<QueueResult> {
  // Check for existing active ingestion
  const existing = await findActiveIngestion(supabase, input.faceitMatchId);
  if (existing) {
    return { id: String(existing.id), alreadyExists: true };
  }

  const id = await insertIngestionRow(supabase, {
    faceit_match_id: input.faceitMatchId,
    source_type: "manual_upload" satisfies DemoAnalyticsSourceType,
    file_name: input.fileName,
    file_sha256: input.fileSha256,
    file_size_bytes: input.fileSizeBytes ?? null,
    status: "queued" satisfies DemoIngestionStatus,
  });

  return { id, alreadyExists: false };
}

export async function getDemoIngestionForMatch(
  supabase: SupabaseLike,
  faceitMatchId: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("demo_ingestions")
    .select("*")
    .eq("faceit_match_id", faceitMatchId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return data ?? null;
}

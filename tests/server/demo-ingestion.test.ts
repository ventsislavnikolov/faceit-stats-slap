import { describe, expect, it, vi } from "vitest";
import {
  getDemoIngestionForMatch,
  queueFaceitDemoParse,
  queueManualDemoParse,
} from "~/server/demo-ingestion";

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

function createSupabaseMock(options?: {
  existingIngestion?: Record<string, unknown> | null;
  insertError?: { message: string } | null;
}) {
  const calls: Array<{
    table: string;
    method: string;
    rows?: Record<string, unknown>[];
    update?: Record<string, unknown>;
    eqArgs?: [string, unknown][];
  }> = [];

  const existing = options?.existingIngestion ?? null;
  const insertErr = options?.insertError ?? null;

  return {
    calls,
    from(table: string) {
      return {
        insert(rows: Record<string, unknown>[]) {
          const entry = { table, method: "insert" as const, rows };
          calls.push(entry);
          const result = { data: null, error: insertErr };
          const promise = Promise.resolve(result) as any;
          promise.select = () => ({
            single: async () =>
              insertErr
                ? { data: null, error: insertErr }
                : { data: { id: "new-ingestion-id" }, error: null },
          });
          return promise;
        },
        upsert(rows: Record<string, unknown>[], opts?: Record<string, unknown>) {
          calls.push({ table, method: "upsert", rows });
          return Promise.resolve({ data: null, error: null });
        },
        update(row: Record<string, unknown>) {
          const entry = {
            table,
            method: "update" as const,
            update: row,
            eqArgs: [] as [string, unknown][],
          };
          calls.push(entry);
          return {
            eq: (col: string, val: unknown) => {
              entry.eqArgs.push([col, val]);
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
        select() {
          return {
            eq: (_col: string, _val: unknown) => ({
              order: () => ({
                limit: () => ({
                  single: async () => ({
                    data: existing,
                    error: existing ? null : { message: "not found", code: "PGRST116" },
                  }),
                }),
              }),
              single: async () => ({
                data: existing,
                error: existing ? null : { message: "not found", code: "PGRST116" },
              }),
            }),
          };
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// queueFaceitDemoParse
// ---------------------------------------------------------------------------

describe("queueFaceitDemoParse", () => {
  it("creates an ingestion row with source_type faceit_demo_url and queued status", async () => {
    const sb = createSupabaseMock();

    const result = await queueFaceitDemoParse(sb as never, {
      faceitMatchId: "match-1",
      demoUrl: "https://demo.test/demo.dem.zst",
    });

    expect(result).toEqual({ id: "new-ingestion-id", alreadyExists: false });

    const call = sb.calls.find((c) => c.table === "demo_ingestions" && c.method === "insert");
    expect(call).toBeDefined();
    expect(call!.rows![0]).toMatchObject({
      faceit_match_id: "match-1",
      source_type: "faceit_demo_url",
      source_url: "https://demo.test/demo.dem.zst",
      status: "queued",
    });
  });

  it("returns source_unavailable when demoUrl is null", async () => {
    const sb = createSupabaseMock();

    const result = await queueFaceitDemoParse(sb as never, {
      faceitMatchId: "match-1",
      demoUrl: null,
    });

    expect(result).toEqual({ id: null, alreadyExists: false, sourceUnavailable: true });

    // Should insert a source_unavailable ingestion row
    const call = sb.calls.find((c) => c.table === "demo_ingestions" && c.method === "insert");
    expect(call).toBeDefined();
    expect(call!.rows![0]).toMatchObject({
      faceit_match_id: "match-1",
      source_type: "faceit_demo_url",
      status: "source_unavailable",
    });
  });

  it("deduplicates when an active ingestion already exists for the match", async () => {
    const sb = createSupabaseMock({
      existingIngestion: {
        id: "existing-ing-1",
        faceit_match_id: "match-1",
        status: "queued",
        source_type: "faceit_demo_url",
      },
    });

    const result = await queueFaceitDemoParse(sb as never, {
      faceitMatchId: "match-1",
      demoUrl: "https://demo.test/demo.dem.zst",
    });

    expect(result).toEqual({ id: "existing-ing-1", alreadyExists: true });

    // Should NOT have inserted a new row
    const insertCalls = sb.calls.filter(
      (c) => c.table === "demo_ingestions" && c.method === "insert",
    );
    expect(insertCalls).toHaveLength(0);
  });

  it("allows re-queue when previous ingestion is failed", async () => {
    const sb = createSupabaseMock({
      existingIngestion: {
        id: "existing-ing-1",
        faceit_match_id: "match-1",
        status: "failed",
        source_type: "faceit_demo_url",
      },
    });

    const result = await queueFaceitDemoParse(sb as never, {
      faceitMatchId: "match-1",
      demoUrl: "https://demo.test/demo.dem.zst",
    });

    expect(result.alreadyExists).toBe(false);
    expect(result.id).toBe("new-ingestion-id");
  });
});

// ---------------------------------------------------------------------------
// queueManualDemoParse
// ---------------------------------------------------------------------------

describe("queueManualDemoParse", () => {
  it("creates an ingestion row with source_type manual_upload", async () => {
    const sb = createSupabaseMock();

    const result = await queueManualDemoParse(sb as never, {
      faceitMatchId: "match-1",
      fileName: "demo.dem.zst",
      fileSha256: "sha-abc",
      fileSizeBytes: 50000,
    });

    expect(result).toEqual({ id: "new-ingestion-id", alreadyExists: false });

    const call = sb.calls.find((c) => c.table === "demo_ingestions" && c.method === "insert");
    expect(call).toBeDefined();
    expect(call!.rows![0]).toMatchObject({
      faceit_match_id: "match-1",
      source_type: "manual_upload",
      file_name: "demo.dem.zst",
      file_sha256: "sha-abc",
      file_size_bytes: 50000,
      status: "queued",
    });
  });

  it("deduplicates when an active ingestion already exists", async () => {
    const sb = createSupabaseMock({
      existingIngestion: {
        id: "existing-ing-1",
        faceit_match_id: "match-1",
        status: "parsing",
        source_type: "manual_upload",
      },
    });

    const result = await queueManualDemoParse(sb as never, {
      faceitMatchId: "match-1",
      fileName: "demo.dem.zst",
      fileSha256: "sha-abc",
    });

    expect(result).toEqual({ id: "existing-ing-1", alreadyExists: true });
  });
});

// ---------------------------------------------------------------------------
// getDemoIngestionForMatch
// ---------------------------------------------------------------------------

describe("getDemoIngestionForMatch", () => {
  it("returns the most recent ingestion row for a match", async () => {
    const sb = createSupabaseMock({
      existingIngestion: {
        id: "ing-1",
        faceit_match_id: "match-1",
        status: "parsed",
        source_type: "faceit_demo_url",
      },
    });

    const result = await getDemoIngestionForMatch(sb as never, "match-1");

    expect(result).toMatchObject({
      id: "ing-1",
      status: "parsed",
    });
  });

  it("returns null when no ingestion exists", async () => {
    const sb = createSupabaseMock({ existingIngestion: null });

    const result = await getDemoIngestionForMatch(sb as never, "match-1");

    expect(result).toBeNull();
  });
});

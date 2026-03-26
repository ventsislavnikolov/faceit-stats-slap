import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServerSupabase } from "~/lib/supabase.server";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ fake: "client" })),
}));

describe("createServerSupabase", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.clearAllMocks();
  });

  it("throws when SUPABASE_URL is missing", () => {
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_SERVICE_KEY = "test-key";

    expect(() => createServerSupabase()).toThrow(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY"
    );
  });

  it("throws when SUPABASE_SERVICE_KEY is missing", () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    delete process.env.SUPABASE_SERVICE_KEY;

    expect(() => createServerSupabase()).toThrow(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY"
    );
  });

  it("throws when both env vars are missing", () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;

    expect(() => createServerSupabase()).toThrow(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY"
    );
  });

  it("returns a supabase client when both env vars are set", () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "test-service-key";

    const result = createServerSupabase();

    expect(result).toEqual({ fake: "client" });
  });

  it("passes correct url and key to createClient", () => {
    process.env.SUPABASE_URL = "https://my-project.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "my-service-key";

    createServerSupabase();

    expect(createClient).toHaveBeenCalledWith(
      "https://my-project.supabase.co",
      "my-service-key"
    );
  });
});

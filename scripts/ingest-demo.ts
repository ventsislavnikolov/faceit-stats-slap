import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { buildRichDemoAnalytics } from "~/server/demo-analytics-builder";
import {
  markDemoIngestionFailed,
  markDemoIngestionParsed,
  markDemoIngestionParsing,
  saveDemoAnalytics,
  upsertDemoIngestion,
} from "~/server/demo-analytics-store";
import { parseDemoFile } from "~/server/demo-parser";

const MATCH_ID = process.argv[2] || "1-a53ffc73-83d0-4e0a-9515-831cbfbd1e24";
const DEMO_PATH =
  process.argv[3] ||
  "/Users/ventsislav.nikolov/Downloads/1-a53ffc73-83d0-4e0a-9515-831cbfbd1e24-1-1.dem.zst";

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  console.log("1. Computing file hash...");
  const fileBytes = readFileSync(DEMO_PATH);
  const sha256 = createHash("sha256").update(fileBytes).digest("hex");
  const fileSize = statSync(DEMO_PATH).size;
  console.log(`   SHA256: ${sha256.slice(0, 16)}... | Size: ${fileSize} bytes`);

  console.log("2. Creating ingestion row...");
  const { id: ingestionId } = await upsertDemoIngestion(supabase as any, {
    faceitMatchId: MATCH_ID,
    sourceType: "manual_upload",
    fileName: DEMO_PATH.split("/").pop() ?? "unknown.dem.zst",
    fileSizeBytes: fileSize,
    fileSha256: sha256,
    compression: "zst",
  });
  console.log(`   Ingestion ID: ${ingestionId}`);

  console.log("3. Marking as parsing...");
  await markDemoIngestionParsing(supabase as any, ingestionId);

  try {
    console.log("4. Parsing demo file...");
    const parsed = await parseDemoFile(DEMO_PATH);
    console.log(
      `   ${parsed.kills.length} kills, ${parsed.hurts.length} hurts, ${parsed.bombEvents.length} bomb events, ${parsed.rounds.length} rounds`
    );

    console.log("5. Building rich analytics...");
    const analytics = buildRichDemoAnalytics(MATCH_ID, "manual_upload", parsed);
    console.log(
      `   Map: ${analytics.mapName} | Rounds: ${analytics.totalRounds}`
    );
    console.log(
      `   Team1: ${analytics.teams[0]?.name?.slice(0, 30)} (${analytics.teams[0]?.side}) ${analytics.teams[0]?.roundsWon}W`
    );
    console.log(
      `   Team2: ${analytics.teams[1]?.name?.slice(0, 30)} (${analytics.teams[1]?.side}) ${analytics.teams[1]?.roundsWon}W`
    );

    console.log("6. Saving to Supabase...");
    const { demoMatchId } = await saveDemoAnalytics(
      supabase as any,
      ingestionId,
      analytics
    );
    console.log(`   Demo match ID: ${demoMatchId}`);

    console.log("7. Marking as parsed...");
    await markDemoIngestionParsed(supabase as any, ingestionId);

    console.log("\nDone! Analytics persisted for match", MATCH_ID);
  } catch (error) {
    console.error("Parse failed:", error);
    await markDemoIngestionFailed(
      supabase as any,
      ingestionId,
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main();

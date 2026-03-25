import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDemoFile } from "~/server/demo-parser";

const defaultFixturePath =
  "/Users/ventsislav.nikolov/Downloads/1-d01c76f4-6b94-4091-8ae1-b32148d4d8c3-1-1.dem.zst";
const fixturePath = process.env.DEMO_PARSER_FIXTURE_PATH ?? defaultFixturePath;

describe("parseDemoFile", () => {
  it("parses a compressed local demo fixture into lightweight match analytics", async () => {
    if (!existsSync(fixturePath)) {
      console.warn(`Skipping: missing demo fixture at ${fixturePath}`);
      return;
    }

    const result = await parseDemoFile(fixturePath);

    expect(result.header.mapName).toBe("de_inferno");
    expect(result.playerInfo.players).toHaveLength(10);
    expect(result.rounds).toHaveLength(20);
  });
});

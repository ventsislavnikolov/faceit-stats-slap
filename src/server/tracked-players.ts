import { createServerFn } from "@tanstack/react-start";
import type { TrackedPlayer } from "~/lib/types";

export const getTrackedPlayers = createServerFn({ method: "GET" }).handler(
  async (): Promise<TrackedPlayer[]> => {
    const { loadTrackedPlayersSnapshot } = await import(
      "~/server/tracked-players.server"
    );
    return loadTrackedPlayersSnapshot();
  }
);

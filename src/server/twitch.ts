import { createServerFn } from "@tanstack/react-start";
import { TWITCH_MAP } from "~/lib/constants";
import { fetchLiveStreams, parseTwitchStreams } from "~/lib/twitch";
import type { TwitchStream } from "~/lib/types";

export const getTwitchStreams = createServerFn({ method: "GET" }).handler(
  async (): Promise<TwitchStream[]> => {
    const channels = Object.values(TWITCH_MAP);
    const data = await fetchLiveStreams(channels);
    return parseTwitchStreams(data, TWITCH_MAP);
  }
);

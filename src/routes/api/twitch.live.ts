import { createAPIFileRoute } from "@tanstack/react-start/api";
import { fetchLiveStreams, parseTwitchStreams } from "~/lib/twitch";
import { TWITCH_MAP } from "~/lib/constants";

export const APIRoute = createAPIFileRoute("/api/twitch/live")({
  GET: async () => {
    const channels = Object.values(TWITCH_MAP);
    const data = await fetchLiveStreams(channels);
    const streams = parseTwitchStreams(data, TWITCH_MAP);
    return Response.json(streams);
  },
});

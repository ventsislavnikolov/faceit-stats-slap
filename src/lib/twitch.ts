import type { TwitchStream } from "./types";

const TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2/token";
const TWITCH_API_URL = "https://api.twitch.tv/helix";

let cachedToken: { token: string; expiresAt: number } | null = null;

function sanitizeParentDomain(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const withoutProtocol = trimmed.replace(/^https?:\/\//i, "");
  const host = withoutProtocol.split("/")[0]?.split(":")[0]?.toLowerCase();

  return host || null;
}

export function parseTwitchEmbedParents(
  hostname: string | null | undefined,
  extraParents: string[] = []
): string[] {
  const uniqueParents = new Set<string>();

  for (const candidate of [hostname, ...extraParents]) {
    const parent = sanitizeParentDomain(candidate);
    if (parent) uniqueParents.add(parent);
  }

  if (uniqueParents.size === 0) {
    uniqueParents.add("localhost");
  }

  return [...uniqueParents];
}

export function buildTwitchEmbedUrl(
  channel: string,
  hostname: string | null | undefined,
  extraParents: string[] = []
): string {
  const params = new URLSearchParams({
    channel,
    autoplay: "true",
    muted: "true",
  });

  for (const parent of parseTwitchEmbedParents(hostname, extraParents)) {
    params.append("parent", parent);
  }

  return `https://player.twitch.tv/?${params.toString()}`;
}

async function getAppAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error("Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET");

  const res = await fetch(TWITCH_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Twitch auth error: ${res.status}`);
  const data = (await res.json()) as any;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 60_000,
  };
  return cachedToken.token;
}

export function parseTwitchStreams(
  apiResponse: any,
  twitchMap: Record<string, string>
): TwitchStream[] {
  const liveStreams = apiResponse.data || [];
  const liveByLogin = new Map(
    liveStreams.map((s: any) => [s.user_login.toLowerCase(), s])
  );

  return Object.entries(twitchMap).map(([faceitId, channel]) => {
    const stream = liveByLogin.get(channel.toLowerCase());
    return {
      channel,
      faceitId,
      isLive: !!stream,
      viewerCount: stream?.viewer_count ?? 0,
      title: stream?.title ?? "",
      thumbnailUrl: stream?.thumbnail_url ?? "",
    };
  });
}

export async function fetchLiveStreams(channels: string[]): Promise<any> {
  const token = await getAppAccessToken();
  const clientId = process.env.TWITCH_CLIENT_ID!;
  const params = channels.map((c) => `user_login=${c}`).join("&");
  const res = await fetch(`${TWITCH_API_URL}/streams?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": clientId,
    },
  });
  if (!res.ok) {
    if (res.status === 401) {
      cachedToken = null;
      return fetchLiveStreams(channels);
    }
    throw new Error(`Twitch API error: ${res.status}`);
  }
  return res.json();
}

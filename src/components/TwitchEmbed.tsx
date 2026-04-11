import { useState } from "react";
import { buildTwitchEmbedUrl } from "~/lib/twitch";
import type { TwitchStream } from "~/lib/types";

interface TwitchEmbedProps {
  stream: TwitchStream;
}

export function TwitchEmbed({ stream }: TwitchEmbedProps) {
  const [loaded, setLoaded] = useState(false);
  const hostname =
    typeof window === "undefined" ? "localhost" : window.location.hostname;
  const extraParents = (import.meta.env.VITE_TWITCH_PARENT_DOMAINS ?? "")
    .split(",")
    .map((parent) => parent.trim())
    .filter(Boolean);

  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-twitch/30 bg-[#18181b]">
      <div className="flex items-center justify-between bg-[#0e0e10] px-3 py-2">
        <div className="flex items-center gap-2">
          <svg fill="#9146FF" height="16" viewBox="0 0 24 24" width="16">
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
          </svg>
          <span className="font-bold text-sm text-text">{stream.channel}</span>
          <span className="rounded bg-error/20 px-1.5 py-0.5 text-[9px] text-error">
            LIVE
          </span>
          <span className="text-text-muted text-xs">
            · {stream.viewerCount.toLocaleString()} viewers
          </span>
        </div>
        <a
          className="text-twitch text-xs hover:underline"
          href={`https://twitch.tv/${stream.channel}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          Open on Twitch
        </a>
      </div>
      {!loaded && (
        <div className="flex h-[300px] items-center justify-center bg-[#0e0e10]">
          <div className="flex flex-col items-center gap-3">
            <svg
              className="animate-pulse"
              fill="#9146FF"
              height="32"
              opacity="0.4"
              viewBox="0 0 24 24"
              width="32"
            >
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
            </svg>
            <div className="h-2 w-24 animate-pulse rounded bg-border/40" />
          </div>
        </div>
      )}
      <iframe
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        className={`border-0 ${loaded ? "" : "hidden"}`}
        height="300"
        onLoad={() => setLoaded(true)}
        src={buildTwitchEmbedUrl(stream.channel, hostname, extraParents)}
        title={`${stream.channel} Twitch stream`}
        width="100%"
      />
    </div>
  );
}

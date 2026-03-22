import { buildTwitchEmbedUrl } from "~/lib/twitch";
import type { TwitchStream } from "~/lib/types";

interface TwitchEmbedProps {
  stream: TwitchStream;
}

export function TwitchEmbed({ stream }: TwitchEmbedProps) {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const extraParents = (import.meta.env.VITE_TWITCH_PARENT_DOMAINS ?? "")
    .split(",")
    .map((parent) => parent.trim())
    .filter(Boolean);

  return (
    <div className="bg-[#18181b] border border-twitch/30 rounded-lg overflow-hidden mb-4">
      <div className="flex justify-between items-center px-3 py-2 bg-[#0e0e10]">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#9146FF">
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
          </svg>
          <span className="text-text text-sm font-bold">{stream.channel}</span>
          <span className="text-[9px] text-error bg-error/20 px-1.5 py-0.5 rounded">LIVE</span>
          <span className="text-text-muted text-xs">· {stream.viewerCount.toLocaleString()} viewers</span>
        </div>
        <a
          href={`https://twitch.tv/${stream.channel}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-twitch text-xs hover:underline"
        >
          Open on Twitch
        </a>
      </div>
      <iframe
        src={buildTwitchEmbedUrl(stream.channel, hostname, extraParents)}
        height="300"
        width="100%"
        title={`${stream.channel} Twitch stream`}
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        className="border-0"
      />
    </div>
  );
}

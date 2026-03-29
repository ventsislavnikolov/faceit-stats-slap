import type { FriendWithStats, TwitchStream } from "~/lib/types";
import { FriendCard } from "./FriendCard";

interface FriendsSidebarProps {
  friends: FriendWithStats[];
  onSelectFriend: (id: string) => void;
  selectedFriendId: string | null;
  twitchStreams: TwitchStream[];
}

export function FriendsSidebar({
  friends,
  twitchStreams,
  selectedFriendId,
  onSelectFriend,
}: FriendsSidebarProps) {
  const liveChannels = new Set(
    twitchStreams.filter((s) => s.isLive).map((s) => s.faceitId)
  );

  const playing = friends.filter((f) => f.isPlaying);
  const offline = friends.filter((f) => !f.isPlaying);

  return (
    <aside className="h-full w-[260px] flex-shrink-0 overflow-y-auto border-border border-r bg-bg-card p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {playing.length > 0 && (
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          )}
          <span className="text-[11px] text-accent uppercase tracking-wider">
            Playing ({playing.length})
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {playing.map((friend) => (
          <FriendCard
            friend={friend}
            isLive={liveChannels.has(friend.faceitId)}
            isSelected={selectedFriendId === friend.faceitId}
            key={friend.faceitId}
            onClick={() => onSelectFriend(friend.faceitId)}
          />
        ))}
      </div>

      {offline.length > 0 && (
        <>
          <div className="mt-4 mb-2 text-[10px] text-text-dim uppercase tracking-wider">
            Not Playing ({offline.length})
          </div>
          <div className="flex flex-col gap-1.5">
            {offline.map((friend) => (
              <FriendCard
                friend={friend}
                isLive={liveChannels.has(friend.faceitId)}
                isSelected={selectedFriendId === friend.faceitId}
                key={friend.faceitId}
                onClick={() => onSelectFriend(friend.faceitId)}
              />
            ))}
          </div>
        </>
      )}
    </aside>
  );
}

import type { FriendWithStats, TwitchStream } from "~/lib/types";
import { FriendCard } from "./FriendCard";

interface FriendsSidebarProps {
  friends: FriendWithStats[];
  twitchStreams: TwitchStream[];
  selectedFriendId: string | null;
  onSelectFriend: (id: string) => void;
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
    <aside className="w-[260px] bg-bg-card border-r border-border p-3 overflow-y-auto flex-shrink-0">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-1.5">
          {playing.length > 0 && (
            <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          )}
          <span className="text-[11px] text-accent uppercase tracking-wider">
            Playing ({playing.length})
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {playing.map((friend) => (
          <FriendCard
            key={friend.faceitId}
            friend={friend}
            isSelected={selectedFriendId === friend.faceitId}
            isLive={liveChannels.has(friend.faceitId)}
            onClick={() => onSelectFriend(friend.faceitId)}
          />
        ))}
      </div>

      {offline.length > 0 && (
        <>
          <div className="text-[10px] text-text-dim uppercase tracking-wider mt-4 mb-2">
            Offline ({offline.length})
          </div>
          <div className="flex flex-col gap-1.5">
            {offline.map((friend) => (
              <FriendCard
                key={friend.faceitId}
                friend={friend}
                isSelected={selectedFriendId === friend.faceitId}
                isLive={liveChannels.has(friend.faceitId)}
                onClick={() => onSelectFriend(friend.faceitId)}
              />
            ))}
          </div>
        </>
      )}
    </aside>
  );
}

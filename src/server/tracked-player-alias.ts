import { createServerFn } from "@tanstack/react-start";

type ResolvedTrackedPlayer = {
  faceitId: string;
  nickname: string;
};

export const getTrackedPlayerForFriends = createServerFn({
  method: "GET",
}).handler(async (): Promise<ResolvedTrackedPlayer | null> => {
  const { resolveTrackedPlayerForFriends } = await import(
    "~/server/tracked-player-alias.server"
  );
  return resolveTrackedPlayerForFriends();
});

export const getTrackedPlayerForHistory = createServerFn({
  method: "GET",
})
  .inputValidator(
    (input: { matches: 20 | 50 | 100; queue: "all" | "solo" | "party" }) =>
      input
  )
  .handler(async ({ data }): Promise<ResolvedTrackedPlayer | null> => {
    const { resolveTrackedPlayerForHistory } = await import(
      "~/server/tracked-player-alias.server"
    );
    return resolveTrackedPlayerForHistory(data);
  });

export const getTrackedPlayerForLeaderboard = createServerFn({
  method: "GET",
})
  .inputValidator(
    (input: {
      matches: 20 | 50 | 100;
      queue: "all" | "solo" | "party";
      last: 30 | 90 | 180 | 365 | 730;
    }) => input
  )
  .handler(async ({ data }): Promise<ResolvedTrackedPlayer | null> => {
    const { resolveTrackedPlayerForLeaderboard } = await import(
      "~/server/tracked-player-alias.server"
    );
    return resolveTrackedPlayerForLeaderboard(data);
  });

export const getTrackedPlayerForLastParty = createServerFn({
  method: "GET",
})
  .inputValidator((input: { date: string }) => input)
  .handler(async ({ data }): Promise<ResolvedTrackedPlayer | null> => {
    const { resolveTrackedPlayerForLastParty } = await import(
      "~/server/tracked-player-alias.server"
    );
    return resolveTrackedPlayerForLastParty(data);
  });

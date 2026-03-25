export function filterUnsyncedHistoryItems<
  T extends {
    match_id?: string | null;
  },
>(history: T[], existingMatchIds: string[]): T[] {
  const existingIds = new Set(existingMatchIds);
  const seenIds = new Set<string>();

  return history.filter((item) => {
    const matchId = item.match_id?.trim();
    if (!matchId) {
      return false;
    }
    if (existingIds.has(matchId)) {
      return false;
    }
    if (seenIds.has(matchId)) {
      return false;
    }

    seenIds.add(matchId);
    return true;
  });
}

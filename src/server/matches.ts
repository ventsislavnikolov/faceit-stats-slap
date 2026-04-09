import { createServerFn } from "@tanstack/react-start";

const HISTORY_SYNC_BATCH_SIZE = 3;
const HISTORY_SYNC_PAGE_SIZE = 50;
const LIVE_HISTORY_BATCH_SIZE = 1;
const BATCH_DELAY_MS = 300;
const LIVE_HISTORY_DELAY_MS = 200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DAY_MS = 24 * 60 * 60 * 1000;

import {
  buildMatchScoreString,
  fetchMatch,
  fetchMatchStats,
  fetchPlayer,
  fetchPlayerHistory,
  parseMatchStats,
  parseMatchTeamScore,
  pickRelevantHistoryMatch,
} from "~/lib/faceit";
import { filterUnsyncedHistoryItems } from "~/lib/history-sync";
import { classifyKnownFriendQueue } from "~/lib/match-queue";
import {
  buildPropDescription,
  generatePropThresholds,
} from "~/lib/prop-generation";
import {
  buildPersonalFormLeaderboard,
  type SharedStatsLeaderboardRow,
} from "~/lib/stats-leaderboard";
import { createServerSupabase } from "~/lib/supabase.server";
import type {
  DemoMatchAnalytics,
  DemoPlayerAnalytics,
  DemoRoundAnalytics,
  DemoTeamAnalytics,
  LiveMatch,
  MatchPlayerStats,
  PartySessionData,
  PlayerHistoryMatch,
  StatsLeaderboardResult,
} from "~/lib/types";
import { getWebhookLiveMatchMap } from "~/server/faceit-webhooks";

function getHistoryTimestamp(item: any): number | null {
  const raw = item?.finished_at ?? item?.started_at;
  if (raw == null) {
    return null;
  }
  const ts = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(ts) ? ts : null;
}

export async function fetchPlayerHistoryWindow(
  faceitId: string,
  days: 30 | 90 | 180 | 365 | 730,
  pageSize = HISTORY_SYNC_PAGE_SIZE
): Promise<any[]> {
  const cutoff = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
  const history: any[] = [];

  for (let page = 0; ; page += 1) {
    const offset = page * pageSize;
    const pageHistory = await fetchPlayerHistory(faceitId, pageSize, offset);
    if (pageHistory.length === 0) {
      break;
    }

    for (const item of pageHistory) {
      const ts = getHistoryTimestamp(item);
      if (ts != null && ts >= cutoff) {
        history.push(item);
      }
    }

    const oldest = getHistoryTimestamp(pageHistory[pageHistory.length - 1]);
    if (pageHistory.length < pageSize || oldest == null || oldest < cutoff) {
      break;
    }
  }

  return history;
}

export async function fetchPlayerRecentHistory(
  faceitId: string,
  n: number,
  pageSize = HISTORY_SYNC_PAGE_SIZE
): Promise<any[]> {
  const history: any[] = [];

  for (let page = 0; history.length < n; page += 1) {
    const offset = page * pageSize;
    const pageHistory = await fetchPlayerHistory(faceitId, pageSize, offset);
    if (pageHistory.length === 0) {
      break;
    }

    history.push(...pageHistory);
    if (pageHistory.length < pageSize) {
      break;
    }
  }

  return history.slice(0, n);
}

async function fetchPlayerHistoryRange(params: {
  faceitId: string;
  startUnix: number;
  endUnix: number;
  pageSize?: number;
}): Promise<any[]> {
  const {
    faceitId,
    startUnix,
    endUnix,
    pageSize = HISTORY_SYNC_PAGE_SIZE,
  } = params;
  const history: any[] = [];

  for (let page = 0; ; page += 1) {
    const offset = page * pageSize;
    const pageHistory = await fetchPlayerHistory(faceitId, pageSize, offset);
    if (pageHistory.length === 0) {
      break;
    }

    for (const item of pageHistory) {
      const ts = getHistoryTimestamp(item);
      if (ts == null) {
        continue;
      }
      if (ts >= startUnix && ts < endUnix) {
        history.push(item);
      }
    }

    const oldest = getHistoryTimestamp(pageHistory[pageHistory.length - 1]);
    if (pageHistory.length < pageSize || oldest == null || oldest < startUnix) {
      break;
    }
  }

  return history;
}

async function syncHistoryItems(history: any[]): Promise<void> {
  const supabase = createServerSupabase();
  const historyMatchIds = [
    ...new Set(history.map((item) => item.match_id).filter(Boolean)),
  ];
  const { data: existingMatches } =
    historyMatchIds.length === 0
      ? { data: [] }
      : await supabase
          .from("matches")
          .select("faceit_match_id, status")
          .in("faceit_match_id", historyMatchIds);
  const finishedMatchIds = (existingMatches || [])
    .filter((m: any) => m.status === "FINISHED")
    .map((m: any) => m.faceit_match_id);
  const missingHistory = filterUnsyncedHistoryItems(history, finishedMatchIds);

  for (let i = 0; i < missingHistory.length; i += HISTORY_SYNC_BATCH_SIZE) {
    if (i > 0) {
      await sleep(BATCH_DELAY_MS);
    }
    const batch = missingHistory.slice(i, i + HISTORY_SYNC_BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (h: any) => {
        const statsData = await fetchMatchStats(h.match_id).catch(() => null);
        const round = statsData?.rounds?.[0];
        if (!round) {
          return;
        }

        const map = round.round_stats?.Map || "unknown";
        const score = round.round_stats?.Score || "";

        await supabase.from("matches").upsert(
          {
            faceit_match_id: h.match_id,
            status: "FINISHED",
            map,
            score,
            started_at: h.started_at
              ? new Date(h.started_at * 1000).toISOString()
              : null,
            finished_at: h.finished_at
              ? new Date(h.finished_at * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "faceit_match_id" }
        );

        const { data: matchRow } = await supabase
          .from("matches")
          .select("id")
          .eq("faceit_match_id", h.match_id)
          .single();

        if (!matchRow) {
          return;
        }

        for (const team of round.teams || []) {
          for (const player of team.players || []) {
            const p = parseMatchStats(player);
            await supabase.from("match_player_stats").upsert(
              {
                match_id: matchRow.id,
                faceit_player_id: p.playerId,
                nickname: p.nickname,
                kills: p.kills,
                deaths: p.deaths,
                assists: p.assists,
                headshots: p.headshots,
                mvps: p.mvps,
                kd_ratio: p.kdRatio,
                adr: p.adr,
                hs_percent: p.hsPercent,
                kr_ratio: p.krRatio,
                triple_kills: p.tripleKills,
                quadro_kills: p.quadroKills,
                penta_kills: p.pentaKills,
                win: p.result,
                damage: p.damage,
                first_kills: p.firstKills,
                entry_count: p.entryCount,
                entry_wins: p.entryWins,
                clutch_kills: p.clutchKills,
                one_v1_count: p.oneV1Count,
                one_v1_wins: p.oneV1Wins,
                one_v2_count: p.oneV2Count,
                one_v2_wins: p.oneV2Wins,
                double_kills: p.doubleKills,
                utility_damage: p.utilityDamage,
                enemies_flashed: p.enemiesFlashed,
                flash_count: p.flashCount,
                sniper_kills: p.sniperKills,
                pistol_kills: p.pistolKills,
                map,
                played_at: h.finished_at
                  ? new Date(h.finished_at * 1000).toISOString()
                  : null,
              },
              { onConflict: "match_id,faceit_player_id" }
            );
          }
        }
      })
    );
  }
}

async function syncPlayerHistoryWindow(
  faceitId: string,
  n: number,
  days: 30 | 90 | 180 | 365 | 730
): Promise<any[]> {
  const pageSize = Math.max(HISTORY_SYNC_PAGE_SIZE, n);
  const history = await fetchPlayerHistoryWindow(faceitId, days, pageSize);
  await syncHistoryItems(history);
  return history;
}

async function syncPlayerRecentHistory(
  faceitId: string,
  n: number
): Promise<void> {
  const pageSize = Math.max(HISTORY_SYNC_PAGE_SIZE, n);
  const history = await fetchPlayerRecentHistory(faceitId, n, pageSize);
  await syncHistoryItems(history);
}

export const getLiveMatches = createServerFn({ method: "GET" })
  .inputValidator((playerIds: string[]) => playerIds)
  .handler(async ({ data: playerIds }): Promise<LiveMatch[]> => {
    const ids = playerIds;
    const supabase = createServerSupabase();
    const liveMatches: LiveMatch[] = [];
    const uniqueMatches = await getWebhookLiveMatchMap(ids);
    const playerIdsCoveredByWebhook = new Set(
      [...uniqueMatches.values()].flatMap((friendIds) => friendIds)
    );
    const fallbackIds = ids.filter((id) => !playerIdsCoveredByWebhook.has(id));

    // Batch history calls to stay within FACEIT rate limits
    const historyResults: PromiseSettledResult<{
      matchId: string;
      friendId: string;
    } | null>[] = [];
    for (let i = 0; i < fallbackIds.length; i += LIVE_HISTORY_BATCH_SIZE) {
      if (i > 0) {
        await sleep(LIVE_HISTORY_DELAY_MS);
      }
      const batch = fallbackIds.slice(i, i + LIVE_HISTORY_BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (friendId) => {
          const history = await fetchPlayerHistory(friendId, 5, 0);
          const candidate = pickRelevantHistoryMatch(history);
          if (!candidate) {
            return null;
          }
          return { matchId: candidate.match_id, friendId };
        })
      );
      historyResults.push(...batchResults);
    }

    for (const result of historyResults) {
      if (result.status !== "fulfilled" || !result.value) {
        continue;
      }
      const { matchId, friendId } = result.value;
      if (!uniqueMatches.has(matchId)) {
        uniqueMatches.set(matchId, []);
      }
      uniqueMatches.get(matchId)!.push(friendId);
    }

    const THIRTY_MINUTES = 30 * 60;
    const matchResults = await Promise.allSettled(
      [...uniqueMatches.entries()].map(async ([matchId]) => {
        const match = await fetchMatch(matchId);
        const activeStatuses = ["ONGOING", "READY", "VOTING", "CONFIGURING"];
        if (activeStatuses.includes(match.status)) {
          return { match, friendIds: uniqueMatches.get(matchId)! };
        }
        if (match.status === "FINISHED" && match.finished_at) {
          const age = Math.floor(Date.now() / 1000) - match.finished_at;
          if (age <= THIRTY_MINUTES) {
            return { match, friendIds: uniqueMatches.get(matchId)! };
          }
        }
        return null;
      })
    );

    for (const result of matchResults) {
      if (result.status !== "fulfilled" || !result.value) {
        continue;
      }
      const { match, friendIds } = result.value;

      let friendFaction: "faction1" | "faction2" = "faction1";
      const foundFriendIds: string[] = [];
      for (const faction of ["faction1", "faction2"] as const) {
        const roster = match.teams?.[faction]?.roster || [];
        const found = roster.filter((p: any) => ids.includes(p.player_id));
        if (found.length > 0) {
          friendFaction = faction;
          foundFriendIds.push(...found.map((p: any) => p.player_id));
        }
      }

      const liveMatch: LiveMatch = {
        matchId: match.match_id,
        status: match.status,
        map: match.voting?.map?.pick?.[0] || "unknown",
        score: match.results?.score || { faction1: 0, faction2: 0 },
        startedAt: match.started_at || 0,
        teams: {
          faction1: {
            teamId: match.teams.faction1.faction_id,
            name:
              (match.teams.faction1.roster || []).find(
                (p: any) =>
                  p.player_id === match.teams.faction1.leader
              )?.nickname ||
              match.teams.faction1.name ||
              "Team 1",
            roster: (match.teams.faction1.roster || []).map((p: any) => ({
              playerId: p.player_id,
              nickname: p.nickname,
              avatar: p.avatar || "",
              skillLevel: p.game_skill_level || 0,
            })),
          },
          faction2: {
            teamId: match.teams.faction2.faction_id,
            name:
              (match.teams.faction2.roster || []).find(
                (p: any) =>
                  p.player_id === match.teams.faction2.leader
              )?.nickname ||
              match.teams.faction2.name ||
              "Team 2",
            roster: (match.teams.faction2.roster || []).map((p: any) => ({
              playerId: p.player_id,
              nickname: p.nickname,
              avatar: p.avatar || "",
              skillLevel: p.game_skill_level || 0,
            })),
          },
        },
        friendFaction,
        friendIds: foundFriendIds.length > 0 ? foundFriendIds : friendIds,
      };
      liveMatches.push(liveMatch);

      await supabase.from("matches").upsert(
        {
          faceit_match_id: match.match_id,
          status: match.status,
          map: liveMatch.map,
          started_at: match.started_at
            ? new Date(match.started_at * 1000).toISOString()
            : null,
          match_data: match,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "faceit_match_id" }
      );
    }

    liveMatches.sort((a, b) => {
      const aActive =
        a.status === "ONGOING" ||
        a.status === "READY" ||
        a.status === "VOTING" ||
        a.status === "CONFIGURING";
      const bActive =
        b.status === "ONGOING" ||
        b.status === "READY" ||
        b.status === "VOTING" ||
        b.status === "CONFIGURING";

      if (aActive !== bActive) {
        return aActive ? -1 : 1;
      }
      return (b.startedAt || 0) - (a.startedAt || 0);
    });

    // ── Betting pool lifecycle ─────────────────────────────────

    // 1. Create betting pools for new ONGOING matches within the 5-min window
    const { data: activeSeason } = await supabase
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .single();

    for (const liveMatch of liveMatches) {
      if (liveMatch.startedAt === 0) {
        continue;
      }
      const matchAgeSeconds =
        Math.floor(Date.now() / 1000) - liveMatch.startedAt;
      if (matchAgeSeconds <= 5 * 60) {
        const f1Friends = liveMatch.teams.faction1.roster
          .filter((p) => liveMatch.friendIds.includes(p.playerId))
          .map((p) => p.nickname);
        const f2Friends = liveMatch.teams.faction2.roster
          .filter((p) => liveMatch.friendIds.includes(p.playerId))
          .map((p) => p.nickname);
        const team1Label = f1Friends[0] || "Opponents";
        const team2Label = f2Friends[0] || "Opponents";
        await supabase.from("betting_pools").upsert(
          {
            faceit_match_id: liveMatch.matchId,
            season_id: activeSeason?.id ?? null,
            team1_name: team1Label,
            team2_name: team2Label,
            opens_at: new Date(liveMatch.startedAt * 1000).toISOString(),
            closes_at: new Date(
              liveMatch.startedAt * 1000 + 5 * 60 * 1000
            ).toISOString(),
            match_started_at: new Date(
              liveMatch.startedAt * 1000
            ).toISOString(),
          },
          { onConflict: "faceit_match_id" }
        );

        // Generate prop pools for tracked players in this match
        if (activeSeason) {
          const rosterPlayerIds = [
            ...liveMatch.teams.faction1.roster.map((p) => p.playerId),
            ...liveMatch.teams.faction2.roster.map((p) => p.playerId),
          ].filter((pid) => liveMatch.friendIds.includes(pid));

          for (const playerId of rosterPlayerIds) {
            const { data: recentStats } = await supabase
              .from("match_player_stats")
              .select("kills, kd_ratio, adr, nickname")
              .eq("faceit_player_id", playerId)
              .order("played_at", { ascending: false })
              .limit(20);

            if (!recentStats || recentStats.length < 3) {
              continue;
            }

            const avgKills =
              recentStats.reduce((s, r) => s + r.kills, 0) / recentStats.length;
            const avgKd =
              recentStats.reduce((s, r) => s + r.kd_ratio, 0) /
              recentStats.length;
            const avgAdr =
              recentStats.reduce((s, r) => s + r.adr, 0) / recentStats.length;
            const nickname = recentStats[0].nickname;

            const thresholds = generatePropThresholds({
              avgKills,
              avgKd,
              avgAdr,
            });
            const statKeys = ["kills", "kd", "adr"] as const;
            const thresholdValues = {
              kills: thresholds.kills,
              kd: thresholds.kd,
              adr: thresholds.adr,
            };

            for (const statKey of statKeys) {
              const threshold = thresholdValues[statKey];
              const description = buildPropDescription(
                nickname,
                statKey,
                threshold
              );

              await supabase.from("prop_pools").upsert(
                {
                  season_id: activeSeason.id,
                  faceit_match_id: liveMatch.matchId,
                  player_id: playerId,
                  player_nickname: nickname,
                  stat_key: statKey,
                  threshold,
                  description,
                  opens_at: new Date(liveMatch.startedAt * 1000).toISOString(),
                  closes_at: new Date(
                    liveMatch.startedAt * 1000 + 5 * 60 * 1000
                  ).toISOString(),
                },
                {
                  onConflict: "faceit_match_id,player_id,stat_key",
                  ignoreDuplicates: true,
                }
              );
            }
          }
        }
      }
    }

    // 2. Stale pool sweep: resolve/cancel pools whose match left the live list
    const liveIds = liveMatches
      .filter((m) => m.status !== "FINISHED")
      .map((m) => m.matchId);
    const { data: stalePools } = await supabase
      .from("betting_pools")
      .select("faceit_match_id")
      .in("status", ["OPEN", "CLOSED"]);

    for (const pool of stalePools ?? []) {
      if (liveIds.includes(pool.faceit_match_id)) {
        continue;
      }
      try {
        const match = await fetchMatch(pool.faceit_match_id);
        if (match.status === "FINISHED") {
          const score = match.results?.score;
          if (score) {
            const winner = score.faction1 > score.faction2 ? "team1" : "team2";
            await supabase.rpc("resolve_pool", {
              p_faceit_match_id: pool.faceit_match_id,
              p_winning_team: winner,
            });
          }

          // Resolve props for this match
          const { data: matchProps } = await supabase
            .from("prop_pools")
            .select("id, stat_key, threshold, player_id")
            .eq("faceit_match_id", pool.faceit_match_id)
            .in("status", ["open", "closed"]);

          if (matchProps && matchProps.length > 0) {
            const { data: matchStats } = await supabase
              .from("match_player_stats")
              .select("faceit_player_id, kills, kd_ratio, adr")
              .eq("match_id", pool.faceit_match_id);

            const statsMap = new Map(
              (matchStats ?? []).map((s: any) => [s.faceit_player_id, s])
            );

            for (const prop of matchProps) {
              const playerStats = statsMap.get(prop.player_id);
              if (!playerStats) {
                await supabase.rpc("cancel_prop", {
                  p_prop_pool_id: prop.id,
                });
                continue;
              }

              const actualValue =
                prop.stat_key === "kills"
                  ? playerStats.kills
                  : prop.stat_key === "kd"
                    ? playerStats.kd_ratio
                    : playerStats.adr;

              const outcome = actualValue >= prop.threshold;
              await supabase.rpc("resolve_prop", {
                p_prop_pool_id: prop.id,
                p_outcome: outcome,
              });
            }
          }
        } else if (match.status === "CANCELLED") {
          await supabase.rpc("cancel_pool", {
            p_faceit_match_id: pool.faceit_match_id,
          });

          // Cancel props for this match
          const { data: cancelProps } = await supabase
            .from("prop_pools")
            .select("id")
            .eq("faceit_match_id", pool.faceit_match_id)
            .in("status", ["open", "closed"]);

          for (const prop of cancelProps ?? []) {
            await supabase.rpc("cancel_prop", {
              p_prop_pool_id: prop.id,
            });
          }
        }
      } catch {
        // Ignore per-match errors, continue sweep
      }
    }

    return liveMatches;
  });

async function fetchDemoAnalyticsForMatch(
  supabase: ReturnType<typeof createServerSupabase>,
  faceitMatchId: string
): Promise<DemoMatchAnalytics | null> {
  // Try parsed match analytics first
  const { data: matchRow } = await supabase
    .from("demo_match_analytics")
    .select("*")
    .eq("faceit_match_id", faceitMatchId)
    .single();

  if (matchRow) {
    const [teamsResult, playersResult, roundsResult] = await Promise.all([
      supabase
        .from("demo_team_analytics")
        .select("*")
        .eq("faceit_match_id", faceitMatchId),
      supabase
        .from("demo_player_analytics")
        .select("*")
        .eq("faceit_match_id", faceitMatchId),
      supabase
        .from("demo_round_analytics")
        .select("*")
        .eq("faceit_match_id", faceitMatchId)
        .order("round_number", { ascending: true }),
    ]);

    const teams: DemoTeamAnalytics[] = (teamsResult.data ?? []).map(
      (t: Record<string, unknown>) => ({
        teamKey: t.team_key as "team1" | "team2",
        name: String(t.name ?? ""),
        side: (t.first_half_side ?? "unknown") as "CT" | "T" | "unknown",
        roundsWon: Number(t.rounds_won ?? 0),
        roundsLost: Number(t.rounds_lost ?? 0),
        tradeKills: 0,
        untradedDeaths: 0,
        rws: 0,
      })
    );

    const players: DemoPlayerAnalytics[] = (playersResult.data ?? []).map(
      (p: Record<string, unknown>) => ({
        nickname: String(p.nickname ?? ""),
        teamKey: p.team_key as "team1" | "team2",
        tradeKills: Number(p.trade_kills ?? 0),
        tradedDeaths: Number(p.traded_deaths ?? 0),
        untradedDeaths: Number(p.untraded_deaths ?? 0),
        rws: Number(p.rws ?? 0),
        playerId: (p.faceit_player_id as string) ?? undefined,
        steamId: (p.steam_id as string) ?? undefined,
        kills: Number(p.kills ?? 0),
        deaths: Number(p.deaths ?? 0),
        assists: Number(p.assists ?? 0),
        headshots: 0,
        adr: Number(p.adr_demo ?? 0),
        hsPercent: Number(p.hs_percent_demo ?? 0),
        entryKills: Number(p.entry_kills ?? 0),
        entryDeaths: Number(p.entry_deaths ?? 0),
        openingDuelAttempts: Number(p.opening_duel_attempts ?? 0),
        openingDuelWins: Number(p.opening_duel_wins ?? 0),
        exitKills: Number(p.exit_kills ?? 0),
        clutchAttempts: Number(p.clutch_attempts ?? 0),
        clutchWins: Number(p.clutch_wins ?? 0),
        lastAliveRounds: Number(p.last_alive_rounds ?? 0),
        bombPlants: Number(p.bomb_plants ?? 0),
        bombDefuses: Number(p.bomb_defuses ?? 0),
        utilityDamage: Number(p.utility_damage_demo ?? 0),
        flashAssists: Number(p.flash_assists_demo ?? 0),
        enemiesFlashed: Number(p.enemies_flashed ?? 0),
        kastPercent: Number(p.kast_percent ?? 0),
        rating: p.rating_demo == null ? undefined : Number(p.rating_demo),
        multiKills: {
          threeK: Number(p.multi_kill_3k ?? 0),
          fourK: Number(p.multi_kill_4k ?? 0),
          ace: Number(p.multi_kill_ace ?? 0),
        },
        killTimings: {
          early: Number(p.kill_timing_early ?? 0),
          mid: Number(p.kill_timing_mid ?? 0),
          late: Number(p.kill_timing_late ?? 0),
        },
        // Utility mastery
        smokesThrown: Number(p.smokes_thrown ?? 0),
        flashesThrown: Number(p.flashes_thrown ?? 0),
        hesThrown: Number(p.hes_thrown ?? 0),
        molotovsThrown: Number(p.molotovs_thrown ?? 0),
        utilityPerRound: Number(p.utility_per_round ?? 0),
        avgFlashBlindDuration: Number(p.avg_flash_blind_duration ?? 0),
        teamFlashes: Number(p.team_flashes ?? 0),
        effectiveFlashRate: Number(p.effective_flash_rate ?? 0),
        // Kill quality
        wallbangKills: Number(p.wallbang_kills ?? 0),
        thrusmokeKills: Number(p.thrusmoke_kills ?? 0),
        noscopeKills: Number(p.noscope_kills ?? 0),
        avgKillDistance: Number(p.avg_kill_distance ?? 0),
        weaponKills:
          typeof p.weapon_kills === "object" && p.weapon_kills !== null
            ? (p.weapon_kills as Record<string, number>)
            : {},
        // Economy
        totalSpend: Number(p.total_spend ?? 0),
        economyEfficiency: Number(p.economy_efficiency ?? 0),
        weaponRounds:
          typeof p.weapon_rounds === "object" && p.weapon_rounds !== null
            ? (p.weapon_rounds as Record<string, number>)
            : {},
        // Side-split
        ctKills: Number(p.ct_kills ?? 0),
        ctDeaths: Number(p.ct_deaths ?? 0),
        ctAdr: Number(p.ct_adr ?? 0),
        ctRating: Number(p.ct_rating ?? 0),
        tKills: Number(p.t_kills ?? 0),
        tDeaths: Number(p.t_deaths ?? 0),
        tAdr: Number(p.t_adr ?? 0),
        tRating: Number(p.t_rating ?? 0),
      })
    );

    const rounds: DemoRoundAnalytics[] = (roundsResult.data ?? []).map(
      (r: Record<string, unknown>) => ({
        roundNumber: Number(r.round_number ?? 0),
        winnerTeamKey: (r.winner_team_key as "team1" | "team2") ?? null,
        winnerSide: null,
        isPistolRound: Boolean(r.is_pistol),
        isBombRound: Boolean(r.bomb_planted),
        scoreAfterRound: {
          team1: Number(r.score_team1 ?? 0),
          team2: Number(r.score_team2 ?? 0),
        },
        tTeamKey: (r.t_team_key as "team1" | "team2") ?? undefined,
        ctTeamKey: (r.ct_team_key as "team1" | "team2") ?? undefined,
        tBuyType: String(r.t_buy_type ?? "unknown"),
        ctBuyType: String(r.ct_buy_type ?? "unknown"),
        endReason: (r.end_reason as string) ?? null,
        bombPlanted: Boolean(r.bomb_planted),
        bombDefused: Boolean(r.bomb_defused),
        tEquipValue: Number(r.t_equip_value ?? 0),
        ctEquipValue: Number(r.ct_equip_value ?? 0),
      })
    );

    return {
      matchId: faceitMatchId,
      sourceType: String(matchRow.demo_source_type) as
        | "faceit_demo_url"
        | "manual_upload",
      availability: "available",
      ingestionStatus: String(
        matchRow.ingestion_status
      ) as DemoMatchAnalytics["ingestionStatus"],
      mapName: String(matchRow.map_name ?? ""),
      totalRounds: Number(matchRow.total_rounds ?? 0),
      teams,
      players,
      rounds,
    };
  }

  // No parsed analytics — check if there's an in-progress ingestion
  const { data: ingestion } = await supabase
    .from("demo_ingestions")
    .select("*")
    .eq("faceit_match_id", faceitMatchId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (ingestion) {
    return {
      matchId: faceitMatchId,
      sourceType: String(ingestion.source_type) as
        | "faceit_demo_url"
        | "manual_upload",
      availability: "unavailable",
      ingestionStatus: String(
        ingestion.status
      ) as DemoMatchAnalytics["ingestionStatus"],
      mapName: "",
      totalRounds: 0,
      teams: [],
      players: [],
      rounds: [],
    };
  }

  return null;
}

export const getMatchDetails = createServerFn({ method: "GET" })
  .inputValidator((matchId: string) => matchId)
  .handler(async ({ data: matchId }) => {
    const supabase = createServerSupabase();
    const [match, statsData] = await Promise.all([
      fetchMatch(matchId),
      fetchMatchStats(matchId).catch(() => null),
    ]);

    const players: any[] = [];
    const teamPlayers: { faction1: string[]; faction2: string[] } = {
      faction1: [],
      faction2: [],
    };
    if (statsData?.rounds?.[0]?.teams) {
      const teams = statsData.rounds[0].teams;
      for (let ti = 0; ti < teams.length; ti++) {
        const faction = ti === 0 ? "faction1" : "faction2";
        for (const player of teams[ti].players || []) {
          const parsed = parseMatchStats(player);
          players.push(parsed);
          teamPlayers[faction].push(parsed.playerId);
        }
      }
    }

    const roundStats = statsData?.rounds?.[0]?.round_stats || {};
    const teamStats = statsData?.rounds?.[0]?.teams || [];
    const rosterPlayerIds = [
      ...(match.teams?.faction1?.roster?.map(
        (player: any) => player.player_id
      ) ?? []),
      ...(match.teams?.faction2?.roster?.map(
        (player: any) => player.player_id
      ) ?? []),
      ...players.map((player) => player.playerId),
    ];
    const { data: trackedRows } =
      rosterPlayerIds.length === 0
        ? { data: [] }
        : await supabase
            .from("tracked_friends")
            .select("faceit_id")
            .eq("is_active", true)
            .in("faceit_id", [...new Set(rosterPlayerIds)]);
    const trackedPlayerIdSet = new Set(
      (trackedRows ?? []).map((row: any) => row.faceit_id)
    );
    const friendIds = [...new Set(rosterPlayerIds)].filter((playerId) =>
      trackedPlayerIdSet.has(playerId)
    );
    const faction1Name =
      teamStats[0]?.team_stats?.Team || match.teams?.faction1?.name || "Team 1";
    const faction2Name =
      teamStats[1]?.team_stats?.Team || match.teams?.faction2?.name || "Team 2";
    const faction1Score = parseMatchTeamScore(teamStats[0]?.team_stats);
    const faction2Score = parseMatchTeamScore(teamStats[1]?.team_stats);

    const result = {
      matchId: match.match_id,
      map: match.voting?.map?.pick?.[0] || roundStats.Map || "unknown",
      score: buildMatchScoreString(roundStats, teamStats),
      status: match.status,
      startedAt: match.started_at || 0,
      finishedAt: match.finished_at || null,
      friendIds,
      players,
      demoUrl: (match.demo_url as string[] | undefined)?.[0] ?? null,
      teams: {
        faction1: {
          name: faction1Name,
          score: faction1Score,
          playerIds: teamPlayers.faction1,
        },
        faction2: {
          name: faction2Name,
          score: faction2Score,
          playerIds: teamPlayers.faction2,
        },
      },
      rounds: Number.parseInt(roundStats.Rounds) || 0,
      region: roundStats.Region || match.region || "",
      competitionName: match.competition_name || "",
    };

    // Fetch demo analytics (works for any match status, returns null if none)
    const demoAnalytics = await fetchDemoAnalyticsForMatch(supabase, matchId);

    if (match.status === "FINISHED") {
      await supabase.from("matches").upsert(
        {
          faceit_match_id: matchId,
          status: "FINISHED",
          map: result.map,
          score: result.score,
          finished_at: match.finished_at
            ? new Date(match.finished_at * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "faceit_match_id" }
      );

      const { data: matchRow } = await supabase
        .from("matches")
        .select("id")
        .eq("faceit_match_id", matchId)
        .single();

      if (matchRow) {
        for (const p of players) {
          await supabase.from("match_player_stats").upsert(
            {
              match_id: matchRow.id,
              faceit_player_id: p.playerId,
              nickname: p.nickname,
              kills: p.kills,
              deaths: p.deaths,
              assists: p.assists,
              headshots: p.headshots,
              mvps: p.mvps,
              kd_ratio: p.kdRatio,
              adr: p.adr,
              hs_percent: p.hsPercent,
              kr_ratio: p.krRatio,
              triple_kills: p.tripleKills,
              quadro_kills: p.quadroKills,
              penta_kills: p.pentaKills,
              win: p.result,
              damage: p.damage,
              first_kills: p.firstKills,
              entry_count: p.entryCount,
              entry_wins: p.entryWins,
              clutch_kills: p.clutchKills,
              one_v1_count: p.oneV1Count,
              one_v1_wins: p.oneV1Wins,
              one_v2_count: p.oneV2Count,
              one_v2_wins: p.oneV2Wins,
              double_kills: p.doubleKills,
              utility_damage: p.utilityDamage,
              enemies_flashed: p.enemiesFlashed,
              flash_count: p.flashCount,
              sniper_kills: p.sniperKills,
              pistol_kills: p.pistolKills,
              map: result.map,
              played_at: match.finished_at
                ? new Date(match.finished_at * 1000).toISOString()
                : null,
            },
            { onConflict: "match_id,faceit_player_id" }
          );
        }
      }
    }

    return { ...result, demoAnalytics };
  });

function buildLeaderboardQueueKey(matchId: string, faceitId: string): string {
  return `${matchId}:${faceitId}`;
}

function classifyLeaderboardQueueBuckets(params: {
  rows: SharedStatsLeaderboardRow[];
}): Map<string, "solo" | "party"> {
  const { rows } = params;
  const buckets = new Map<string, "solo" | "party">();
  const rowPlayerIdsByMatch = new Map<string, Set<string>>();

  for (const row of rows) {
    const existingPlayerIds =
      rowPlayerIdsByMatch.get(row.matchId) ?? new Set<string>();
    existingPlayerIds.add(row.faceitId);
    rowPlayerIdsByMatch.set(row.matchId, existingPlayerIds);
  }

  for (const row of rows) {
    const cohortPlayersInMatch =
      rowPlayerIdsByMatch.get(row.matchId) ?? new Set<string>();
    const otherCohortPlayers = [...cohortPlayersInMatch].filter(
      (faceitId) => faceitId !== row.faceitId
    );

    buckets.set(
      buildLeaderboardQueueKey(row.matchId, row.faceitId),
      otherCohortPlayers.length >= 2 ? "party" : "solo"
    );
  }

  return buckets;
}

const STATS_LEADERBOARD_ROW_SELECT =
  "match_id, faceit_player_id, nickname, played_at, kills, kd_ratio, adr, hs_percent, kr_ratio, win, first_kills, clutch_kills, utility_damage, enemies_flashed, entry_count, entry_wins, sniper_kills";
const STATS_LEADERBOARD_PAGE_SIZE = 1000;
const STATS_LEADERBOARD_MATCH_CHUNK_SIZE = 50;

function normalizeStatsLeaderboardRows(params: {
  rows: any[];
  friendMap: Map<string, { nickname: string; elo: number }>;
}): SharedStatsLeaderboardRow[] {
  const { rows, friendMap } = params;

  return rows.map((row: any) => {
    const meta = friendMap.get(row.faceit_player_id);

    return {
      matchId: row.match_id,
      playedAt: row.played_at,
      faceitId: row.faceit_player_id,
      nickname: row.nickname || meta?.nickname || row.faceit_player_id,
      elo: meta?.elo ?? 0,
      kills: Number(row.kills) || 0,
      kdRatio: Number(row.kd_ratio) || 0,
      adr: Number(row.adr) || 0,
      hsPercent: Number(row.hs_percent) || 0,
      krRatio: Number(row.kr_ratio) || 0,
      win: Boolean(row.win),
      firstKills: Number(row.first_kills) || 0,
      clutchKills: Number(row.clutch_kills) || 0,
      utilityDamage: Number(row.utility_damage) || 0,
      enemiesFlashed: Number(row.enemies_flashed) || 0,
      entryCount: Number(row.entry_count) || 0,
      entryWins: Number(row.entry_wins) || 0,
      sniperKills: Number(row.sniper_kills) || 0,
    };
  });
}

function dedupeStatsLeaderboardRows(
  rows: SharedStatsLeaderboardRow[]
): SharedStatsLeaderboardRow[] {
  const seen = new Set<string>();
  const deduped: SharedStatsLeaderboardRow[] = [];

  for (const row of rows) {
    const key = `${row.matchId}:${row.faceitId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(row);
  }

  return deduped;
}

async function fetchTargetStatsLeaderboardRows(params: {
  supabase: ReturnType<typeof createServerSupabase>;
  targetPlayerId: string;
  days: 30 | 90 | 180 | 365 | 730;
  cutoffIso?: string;
}): Promise<any[]> {
  const { supabase, targetPlayerId, days, cutoffIso } = params;
  const effectiveCutoffIso =
    cutoffIso ?? new Date(Date.now() - days * DAY_MS).toISOString();
  const rows: any[] = [];

  for (let from = 0; ; from += STATS_LEADERBOARD_PAGE_SIZE) {
    const to = from + STATS_LEADERBOARD_PAGE_SIZE - 1;
    const { data: pageRows } = await supabase
      .from("match_player_stats")
      .select(STATS_LEADERBOARD_ROW_SELECT)
      .eq("faceit_player_id", targetPlayerId)
      .gte("played_at", effectiveCutoffIso)
      .order("played_at", { ascending: false })
      .range(from, to);

    if (!pageRows?.length) {
      break;
    }
    rows.push(...pageRows);
    if (pageRows.length < STATS_LEADERBOARD_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function fetchEligibleStatsLeaderboardFriendIds(params: {
  supabase: ReturnType<typeof createServerSupabase>;
  targetMatchIds: string[];
  friendIds: string[];
}): Promise<string[]> {
  const { supabase, targetMatchIds, friendIds } = params;
  if (targetMatchIds.length === 0 || friendIds.length === 0) {
    return [];
  }

  const friendSet = new Set(friendIds);
  const eligibleFriendIds = new Set<string>();

  for (
    let index = 0;
    index < targetMatchIds.length;
    index += STATS_LEADERBOARD_MATCH_CHUNK_SIZE
  ) {
    const matchIdChunk = targetMatchIds.slice(
      index,
      index + STATS_LEADERBOARD_MATCH_CHUNK_SIZE
    );
    const { data: sharedRows } = await supabase
      .from("match_player_stats")
      .select("match_id, faceit_player_id")
      .in("match_id", matchIdChunk);

    for (const row of sharedRows || []) {
      if (friendSet.has(row.faceit_player_id)) {
        eligibleFriendIds.add(row.faceit_player_id);
      }
    }
  }

  return [...eligibleFriendIds];
}

async function fetchStatsLeaderboardRowsForMatches(params: {
  supabase: ReturnType<typeof createServerSupabase>;
  matchIds: string[];
}): Promise<any[]> {
  const { supabase, matchIds } = params;
  if (matchIds.length === 0) {
    return [];
  }

  const rows: any[] = [];

  for (
    let index = 0;
    index < matchIds.length;
    index += STATS_LEADERBOARD_MATCH_CHUNK_SIZE
  ) {
    const matchIdChunk = matchIds.slice(
      index,
      index + STATS_LEADERBOARD_MATCH_CHUNK_SIZE
    );
    const { data: sharedRows } = await supabase
      .from("match_player_stats")
      .select(STATS_LEADERBOARD_ROW_SELECT)
      .in("match_id", matchIdChunk);

    rows.push(...(sharedRows ?? []));
  }

  return rows;
}

async function fetchRecentStatsLeaderboardRows(params: {
  supabase: ReturnType<typeof createServerSupabase>;
  playerIds: string[];
  n?: 20 | 50 | 100;
  cutoffIso?: string;
}): Promise<any[]> {
  const { supabase, playerIds, n, cutoffIso } = params;
  if (playerIds.length === 0) {
    return [];
  }

  const rows: any[] = [];
  const rowCounts = new Map(playerIds.map((playerId) => [playerId, 0]));

  for (let from = 0; ; from += STATS_LEADERBOARD_PAGE_SIZE) {
    const to = from + STATS_LEADERBOARD_PAGE_SIZE - 1;
    let query = supabase
      .from("match_player_stats")
      .select(STATS_LEADERBOARD_ROW_SELECT)
      .in("faceit_player_id", playerIds);

    if (cutoffIso) {
      query = query.gte("played_at", cutoffIso);
    }

    const { data: pageRows } = await query
      .order("played_at", { ascending: false })
      .range(from, to);

    if (!pageRows?.length) {
      break;
    }
    rows.push(...pageRows);

    for (const row of pageRows) {
      rowCounts.set(
        row.faceit_player_id,
        (rowCounts.get(row.faceit_player_id) ?? 0) + 1
      );
    }

    if (
      n != null &&
      playerIds.every((playerId) => (rowCounts.get(playerId) ?? 0) >= n)
    ) {
      break;
    }

    if (pageRows.length < STATS_LEADERBOARD_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

export const getStatsLeaderboard = createServerFn({ method: "GET" })
  .inputValidator(
    (input: {
      targetPlayerId: string;
      playerIds: string[];
      n: 20 | 50 | 100;
      days: 30 | 90 | 180 | 365 | 730;
      queue?: "all" | "solo" | "party";
    }) => input
  )
  .handler(
    async ({
      data: { targetPlayerId, playerIds, n, days, queue = "all" },
    }): Promise<StatsLeaderboardResult> => {
      const supabase = createServerSupabase();

      const allIds = [...new Set([targetPlayerId, ...playerIds])];
      const { data: friendRows } =
        allIds.length === 0
          ? { data: [] }
          : await supabase
              .from("tracked_friends")
              .select("faceit_id, nickname, elo")
              .in("faceit_id", allIds);

      const friendMap = new Map(
        (friendRows || []).map((f: any) => [
          f.faceit_id,
          { nickname: f.nickname, elo: f.elo ?? 0 },
        ])
      );

      const targetRows = await fetchTargetStatsLeaderboardRows({
        supabase,
        targetPlayerId,
        days,
      });
      const recentRows = await fetchRecentStatsLeaderboardRows({
        supabase,
        playerIds: [...new Set([targetPlayerId, ...playerIds])],
        n,
      });

      const normalizedRows = dedupeStatsLeaderboardRows(
        normalizeStatsLeaderboardRows({
          rows: [...targetRows, ...recentRows],
          friendMap,
        })
      );

      let rowsForLeaderboard = normalizedRows;

      if (queue !== "all") {
        const queueBuckets = classifyLeaderboardQueueBuckets({
          rows: normalizedRows,
        });

        rowsForLeaderboard = normalizedRows.filter(
          (row) =>
            queueBuckets.get(
              buildLeaderboardQueueKey(row.matchId, row.faceitId)
            ) === queue
        );
      }

      let result = buildPersonalFormLeaderboard({
        rows: rowsForLeaderboard,
        targetPlayerId,
        friendIds: playerIds,
        n,
        days,
      });

      const missingEloIds = result.entries
        .filter((entry) => entry.elo <= 0)
        .map((entry) => entry.faceitId);

      if (missingEloIds.length > 0) {
        try {
          const { fetchPlayer } = await import("~/lib/faceit");
          const eloResults = await Promise.allSettled(
            missingEloIds.map(async (id) => {
              const player = await fetchPlayer(id);
              return { id, elo: player.elo };
            })
          );

          const eloUpdates = new Map<string, number>();
          for (const r of eloResults) {
            if (r.status === "fulfilled" && r.value.elo > 0) {
              eloUpdates.set(r.value.id, r.value.elo);
            }
          }

          if (eloUpdates.size > 0) {
            result = {
              ...result,
              entries: result.entries.map((entry) =>
                eloUpdates.has(entry.faceitId)
                  ? { ...entry, elo: eloUpdates.get(entry.faceitId)! }
                  : entry
              ),
            };
          }
        } catch {
          // Preserve the leaderboard if the live ELO lookup fails.
        }
      }

      return result;
    }
  );

export const syncAllPlayerHistory = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      targetPlayerId: string;
      playerIds: string[];
      n: number;
      days: 30 | 90 | 180 | 365 | 730;
    }) => input
  )
  .handler(
    async ({ data: { targetPlayerId, playerIds, n, days } }): Promise<void> => {
      await syncPlayerHistoryWindow(targetPlayerId, n, days);
      const uniqueFriendIds = [...new Set(playerIds)].filter(
        (faceitId) => faceitId !== targetPlayerId
      );
      if (uniqueFriendIds.length === 0) {
        return;
      }

      const sampleSize = Math.max(n, 100);
      for (const faceitId of uniqueFriendIds) {
        await syncPlayerRecentHistory(faceitId, sampleSize);
      }
    }
  );

export const getPlayerStats = createServerFn({ method: "GET" })
  .inputValidator(
    (input: {
      playerId: string;
      n: number;
      queue?: "all" | "solo" | "party";
    }) => input
  )
  .handler(
    async ({
      data: { playerId, n, queue = "all" },
    }): Promise<PlayerHistoryMatch[]> => {
      const targetFriendIds = await fetchPlayer(playerId)
        .then((player) => player.friendsIds)
        .catch(() => null);

      const matches: PlayerHistoryMatch[] = [];
      const pageSize = Math.max(n, 20);

      for (let offset = 0; matches.length < n; offset += pageSize) {
        const history = await fetchPlayerHistory(playerId, pageSize, offset);
        if (history.length === 0) {
          break;
        }

        const batchResults: PromiseSettledResult<PlayerHistoryMatch | null>[] =
          [];
        for (let i = 0; i < history.length; i += 5) {
          if (i > 0 || offset > 0) {
            await sleep(BATCH_DELAY_MS);
          }
          const batch = history.slice(i, i + 5);
          const settled = await Promise.allSettled(
            batch.map(async (h: any) => {
              const stats = await fetchMatchStats(h.match_id);
              const round = stats.rounds?.[0];
              if (!round) {
                return null;
              }

              const queueInfo = classifyKnownFriendQueue({
                targetPlayerId: playerId,
                targetFriendIds,
                teams: round.teams || [],
              });

              for (const team of round.teams || []) {
                const player = (team.players || []).find(
                  (p: any) => p.player_id === playerId
                );
                if (player) {
                  return {
                    matchId: h.match_id,
                    map: round.round_stats?.Map || "unknown",
                    score: round.round_stats?.Score || "",
                    startedAt: h.started_at,
                    finishedAt: h.finished_at,
                    queueBucket: queueInfo.queueBucket,
                    knownQueuedFriendCount: queueInfo.knownQueuedFriendCount,
                    knownQueuedFriendIds: queueInfo.knownQueuedFriendIds,
                    partySize: queueInfo.partySize,
                    ...parseMatchStats(player),
                  } satisfies PlayerHistoryMatch;
                }
              }

              return null;
            })
          );
          batchResults.push(...settled);
        }

        matches.push(
          ...batchResults
            .filter(
              (
                result
              ): result is PromiseFulfilledResult<PlayerHistoryMatch | null> =>
                result.status === "fulfilled"
            )
            .map((result) => result.value)
            .filter((match): match is PlayerHistoryMatch => {
              if (!match) {
                return false;
              }
              return queue === "all" ? true : match.queueBucket === queue;
            })
        );

        if (history.length < pageSize) {
          break;
        }
      }

      const result = typeof n === "number" ? matches.slice(0, n) : matches;

      // Batch-check which matches have parsed demo analytics
      if (result.length > 0) {
        try {
          const supabase = createServerSupabase();
          const matchIds = result.map((m) => m.matchId);
          const { data: demoRows } = await supabase
            .from("demo_ingestions")
            .select("faceit_match_id")
            .in("faceit_match_id", matchIds)
            .eq("status", "parsed");
          const parsedSet = new Set(
            (demoRows ?? []).map(
              (r: { faceit_match_id: string }) => r.faceit_match_id
            )
          );
          for (const m of result) {
            m.hasDemoAnalytics = parsedSet.has(m.matchId);
          }
        } catch {
          // Non-critical — leave flags undefined
        }
      }

      return result;
    }
  );

export const getPartySessionStats = createServerFn({ method: "GET" })
  .inputValidator((input: { playerId: string; date: string }) => input)
  .handler(async ({ data: { playerId, date } }): Promise<PartySessionData> => {
    const { getCalendarDayRange } = await import("~/lib/time");
    const {
      buildSessionRivalries,
      computeAggregateStats,
      computeAwards,
      computeMapDistribution,
    } = await import("~/lib/last-party");

    // 1. Resolve friend list and elo
    const targetPlayer = await fetchPlayer(playerId).catch(() => null);
    const targetFriendIds = targetPlayer?.friendsIds ?? null;
    const eloMap: Record<string, number> = {};
    if (targetPlayer) {
      eloMap[playerId] = targetPlayer.elo;
    }

    // 2. Fetch all matches for the date
    const { startUnix, endUnix } = getCalendarDayRange(date);
    const history = await fetchPlayerHistoryRange({
      faceitId: playerId,
      startUnix,
      endUnix,
    });

    // 3. Fetch stats for each match and classify queue
    const partyMatches: PlayerHistoryMatch[] = [];
    const allMatchStats: Record<string, MatchPlayerStats[]> = {};

    for (let i = 0; i < history.length; i += 5) {
      if (i > 0) {
        await sleep(BATCH_DELAY_MS);
      }
      const batch = history.slice(i, i + 5);
      const settled = await Promise.allSettled(
        batch.map(async (h: any) => {
          const stats = await fetchMatchStats(h.match_id);
          const round = stats.rounds?.[0];
          if (!round) {
            return null;
          }

          const queueInfo = classifyKnownFriendQueue({
            targetPlayerId: playerId,
            targetFriendIds,
            teams: round.teams || [],
          });

          if (queueInfo.queueBucket !== "party") {
            return null;
          }

          // Collect all players' stats for this match
          const matchPlayers: MatchPlayerStats[] = [];
          let targetPlayerMatch: PlayerHistoryMatch | null = null;

          for (const team of round.teams || []) {
            for (const player of team.players || []) {
              const parsed = parseMatchStats(player);
              matchPlayers.push(parsed);
              if (parsed.playerId === playerId) {
                targetPlayerMatch = {
                  matchId: h.match_id,
                  map: round.round_stats?.Map || "unknown",
                  score: round.round_stats?.Score || "",
                  startedAt: h.started_at,
                  finishedAt: h.finished_at,
                  queueBucket: queueInfo.queueBucket,
                  knownQueuedFriendCount: queueInfo.knownQueuedFriendCount,
                  knownQueuedFriendIds: queueInfo.knownQueuedFriendIds,
                  partySize: queueInfo.partySize,
                  ...parsed,
                };
              }
            }
          }

          return targetPlayerMatch
            ? { match: targetPlayerMatch, players: matchPlayers }
            : null;
        })
      );

      for (const result of settled) {
        if (result.status === "fulfilled" && result.value) {
          partyMatches.push(result.value.match);
          allMatchStats[result.value.match.matchId] = result.value.players;
        }
      }
    }

    // 4. Collect party member IDs (union across all matches)
    const partyMemberIdSet = new Set<string>();
    for (const m of partyMatches) {
      partyMemberIdSet.add(playerId);
      for (const fid of m.knownQueuedFriendIds) {
        partyMemberIdSet.add(fid);
      }
    }
    const partyMemberIds = [...partyMemberIdSet];

    // 4b. Fetch elo for party members we don't have yet
    const missingEloIds = partyMemberIds.filter((id) => !(id in eloMap));
    for (let i = 0; i < missingEloIds.length; i += 5) {
      if (i > 0) {
        await sleep(BATCH_DELAY_MS);
      }
      const batch = missingEloIds.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map((id) => fetchPlayer(id))
      );
      for (const r of results) {
        if (r.status === "fulfilled") {
          eloMap[r.value.faceitId] = r.value.elo;
        }
      }
    }

    // 5. Fetch demo analytics for each match
    const supabase = createServerSupabase();
    const demoMatches: Record<string, DemoMatchAnalytics> = {};
    for (const m of partyMatches) {
      const demo = await fetchDemoAnalyticsForMatch(supabase, m.matchId);
      if (demo && demo.ingestionStatus === "parsed") {
        demoMatches[m.matchId] = demo;
      }
    }
    const allHaveDemo =
      partyMatches.length > 0 &&
      partyMatches.every((m) => m.matchId in demoMatches);

    // 6. Resolve party member nicknames
    const nicknameMap = new Map<string, string>();
    for (const stats of Object.values(allMatchStats)) {
      for (const p of stats) {
        if (partyMemberIdSet.has(p.playerId)) {
          nicknameMap.set(p.playerId, p.nickname);
        }
      }
    }
    const partyMembers = partyMemberIds.map((id) => ({
      faceitId: id,
      nickname: nicknameMap.get(id) ?? id,
    }));

    // 7. Compute aggregates, awards, map distribution
    const matchIds = partyMatches.map((m) => m.matchId);
    const aggregateStats = computeAggregateStats({
      matchIds,
      matchStats: allMatchStats,
      partyMemberIds,
      demoMatches,
      allHaveDemo,
      eloMap,
    });
    const mapDistribution = computeMapDistribution(partyMatches);
    const awards = computeAwards({
      aggregateStats,
      allHaveDemo,
      mapDistribution,
      playerId,
      date,
    });
    const rivalries = buildSessionRivalries({
      aggregateStats,
      allHaveDemo,
      matchStats: allMatchStats,
      matches: partyMatches,
    });

    for (const [faceitId, breakdown] of Object.entries(
      rivalries.playerBreakdowns
    )) {
      if (aggregateStats[faceitId]) {
        aggregateStats[faceitId].sessionScore = breakdown.sessionScore;
        aggregateStats[faceitId].scoreBreakdown = breakdown;
      }
    }

    // 8. Compute totals
    const winCount = partyMatches.filter((m) => m.result).length;
    const lossCount = partyMatches.length - winCount;
    const totalSeconds = partyMatches.reduce((sum, m) => {
      if (m.startedAt && m.finishedAt) {
        return sum + (m.finishedAt - m.startedAt);
      }
      return sum;
    }, 0);
    const totalHoursPlayed = Math.round((totalSeconds / 3600) * 10) / 10;

    return {
      date,
      matches: partyMatches.sort((a, b) => a.startedAt - b.startedAt),
      matchStats: allMatchStats,
      demoMatches,
      eloMap,
      allHaveDemo,
      partyMembers,
      aggregateStats,
      awards,
      rivalries,
      mapDistribution,
      totalHoursPlayed,
      winCount,
      lossCount,
    };
  });

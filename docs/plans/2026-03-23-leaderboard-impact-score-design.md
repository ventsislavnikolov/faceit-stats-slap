# Leaderboard Impact Score Design

## Goal

Add an `Impact` stat to the stats leaderboard that adjusts expectations by ELO. Higher-ELO players should be expected to post better raw combat numbers, but strong performances in harder lobbies should still get extra credit.

## Formula

Impact is calculated per match and then averaged over the selected leaderboard window.

```ts
overperf =
  0.45 * (kd - expKd(elo)) +
  0.25 * ((adr - expAdr(elo)) / 10) +
  0.20 * (kr - expKr(elo)) +
  0.10 * (entryRate - expEntryRate(elo));

difficulty = clamp(Math.sqrt(elo / 2000), 0.85, 1.20);

impact = 100 + 60 * overperf * difficulty + (win ? 5 : 0);
```

Input caps:

- `kd <= 2.5`
- `adr <= 140`
- `kr <= 1.2`
- `entryRate <= 0.75`

`100` means roughly "met expectation for this ELO." Scores above `100` indicate overperformance, and scores below `100` indicate underperformance.

## ELO Baselines

Initial baselines are interpolated from these anchor points:

| ELO | K/D | ADR | K/R | Entry Rate |
| --- | --- | --- | --- | --- |
| 500 | 0.95 | 68 | 0.62 | 0.44 |
| 900 | 1.00 | 72 | 0.66 | 0.46 |
| 1225 | 1.05 | 76 | 0.69 | 0.48 |
| 1575 | 1.10 | 80 | 0.72 | 0.50 |
| 2000 | 1.15 | 84 | 0.75 | 0.52 |

This is a starter calibration. It should be revisited once there is enough historical data to fit stronger expectation curves from observed matches.

## Product Behavior

- The stats leaderboard now sorts by `avgImpact` by default.
- `Impact` is shown as a new combat column on `/leaderboard`.
- Raw K/D remains visible, but ranking now favors ELO-adjusted overperformance instead of raw ratio alone.

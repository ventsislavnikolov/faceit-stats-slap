---
name: ingest-demos
description: Ingest CS2 .dem.zst demo files into Supabase by parsing them and storing analytics. Use when user wants to import demos, parse demo files, ingest match demos, or mentions .dem.zst files.
---

# Ingest Demos

Parse local `.dem.zst` CS2 demo files and store analytics in Supabase.

## Steps

1. **Find demo files** — scan `~/Downloads` (or user-specified directory) for `*.dem.zst` files
2. **Extract match IDs** — filename format is `1-<UUID>-1-1.dem.zst`, match ID = everything before `-1-1.dem.zst`
3. **Run ingestion** — for each file, run the ingest script with env vars from `.env.local`
4. **Report results** — show match ID, map, score for each ingested demo

## Command

For each `.dem.zst` file, run:

```bash
export $(grep -E '^(SUPABASE_URL|SUPABASE_SERVICE_KEY)=' .env.local | xargs) && \
pnpm exec tsx scripts/ingest-demo.ts "<MATCH_ID>" "<FILE_PATH>"
```

## Match ID Extraction

```
Filename: 1-2cd0eec3-e72f-441b-adc4-02e961554e44-1-1.dem.zst
Match ID: 1-2cd0eec3-e72f-441b-adc4-02e961554e44
```

Strip the trailing `-1-1.dem.zst` from the filename to get the match ID.

## Notes

- Working directory must be the project root (where `.env.local` and `scripts/ingest-demo.ts` live)
- Each demo takes 10-30 seconds to parse depending on match length
- The script requires `zstd` on PATH for fast decompression (falls back to JS decoder)
- Demos are idempotent — re-ingesting the same match ID upserts the ingestion row

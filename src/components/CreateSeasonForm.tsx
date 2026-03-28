import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { createSeason } from "~/server/seasons";

const WEAR_OPTIONS = [
  { label: "Factory New", value: "FN" },
  { label: "Minimal Wear", value: "MW" },
  { label: "Field-Tested", value: "FT" },
  { label: "Well-Worn", value: "WW" },
  { label: "Battle-Scarred", value: "BS" },
] as const;

const SKINS_API_URL =
  "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json";

interface CreateSeasonFormProps {
  userId: string;
}

export function CreateSeasonForm({ userId }: CreateSeasonFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const [skinName, setSkinName] = useState("");
  const [skinWear, setSkinWear] = useState("MW");
  const [skinFloat, setSkinFloat] = useState("");
  const [skinImageUrl, setSkinImageUrl] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [manualImageUrl, setManualImageUrl] = useState("");
  const [showManualUrl, setShowManualUrl] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchSkinImage = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSkinImageUrl("");
      return;
    }

    setImageLoading(true);
    try {
      const res = await fetch(SKINS_API_URL);
      const skins: { name: string; image: string }[] = await res.json();

      const normalizedQuery = query.toLowerCase().trim();
      const match = skins.find(
        (s) =>
          s.name.toLowerCase() === normalizedQuery ||
          s.name.toLowerCase().includes(normalizedQuery)
      );

      if (match?.image) {
        setSkinImageUrl(match.image);
      } else {
        setSkinImageUrl("");
      }
    } catch {
      setSkinImageUrl("");
    } finally {
      setImageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchSkinImage(skinName);
    }, 600);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [skinName, fetchSkinImage]);

  const displayImageUrl = manualImageUrl || skinImageUrl;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!(name.trim() && startsAt && endsAt)) {
      setError("Name, start date, and end date are required.");
      return;
    }

    if (new Date(endsAt) <= new Date(startsAt)) {
      setError("End date must be after start date.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    const prizes = skinName.trim()
      ? [
          {
            place: 1,
            description: `${skinName.trim()} (${skinWear})`,
            skinName: skinName.trim(),
            wear: skinWear,
            float: skinFloat.trim() || undefined,
            imageUrl: displayImageUrl || undefined,
          },
        ]
      : [];

    const result = await createSeason({
      data: {
        name: name.trim(),
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        prizes,
        userId,
      },
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Failed to create season.");
      return;
    }

    setSuccess(true);
    setName("");
    setStartsAt("");
    setEndsAt("");
    setSkinName("");
    setSkinFloat("");
    setSkinImageUrl("");
    setManualImageUrl("");
    queryClient.invalidateQueries({ queryKey: ["active-season"] });
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-lg border border-border bg-bg-elevated p-4"
      onSubmit={handleSubmit}
    >
      <div className="font-bold text-sm text-text">Create New Season</div>

      <div className="flex flex-col gap-1">
        <label
          className="text-[10px] text-text-dim uppercase tracking-wider"
          htmlFor="season-name"
        >
          Name
        </label>
        <input
          className="rounded border border-border bg-bg px-3 py-1.5 text-sm text-text"
          id="season-name"
          onChange={(e) => setName(e.target.value)}
          placeholder="Season 2"
          type="text"
          value={name}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label
            className="text-[10px] text-text-dim uppercase tracking-wider"
            htmlFor="season-start"
          >
            Start Date
          </label>
          <input
            className="rounded border border-border bg-bg px-3 py-1.5 text-sm text-text"
            id="season-start"
            onChange={(e) => setStartsAt(e.target.value)}
            type="datetime-local"
            value={startsAt}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            className="text-[10px] text-text-dim uppercase tracking-wider"
            htmlFor="season-end"
          >
            End Date
          </label>
          <input
            className="rounded border border-border bg-bg px-3 py-1.5 text-sm text-text"
            id="season-end"
            onChange={(e) => setEndsAt(e.target.value)}
            type="datetime-local"
            value={endsAt}
          />
        </div>
      </div>

      <div className="rounded border border-border/50 bg-bg/50 p-3">
        <div className="mb-3 text-[10px] text-text-dim uppercase tracking-wider">
          1st Place Prize (optional)
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label
              className="text-[10px] text-text-dim uppercase tracking-wider"
              htmlFor="skin-name"
            >
              Skin Name
            </label>
            <input
              className="rounded border border-border bg-bg px-3 py-1.5 text-sm text-text"
              id="skin-name"
              onChange={(e) => setSkinName(e.target.value)}
              placeholder="USP-S | Printstream"
              type="text"
              value={skinName}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label
                className="text-[10px] text-text-dim uppercase tracking-wider"
                htmlFor="skin-wear"
              >
                Wear
              </label>
              <select
                className="rounded border border-border bg-bg px-3 py-1.5 text-sm text-text"
                id="skin-wear"
                onChange={(e) => setSkinWear(e.target.value)}
                value={skinWear}
              >
                {WEAR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label
                className="text-[10px] text-text-dim uppercase tracking-wider"
                htmlFor="skin-float"
              >
                Float (optional)
              </label>
              <input
                className="rounded border border-border bg-bg px-3 py-1.5 text-sm text-text"
                id="skin-float"
                onChange={(e) => setSkinFloat(e.target.value)}
                placeholder="0.07"
                type="text"
                value={skinFloat}
              />
            </div>
          </div>

          {displayImageUrl && (
            <div className="flex flex-col items-center gap-2 rounded border border-accent/20 bg-accent/5 p-3">
              <img
                alt={skinName}
                className="h-32 object-contain"
                src={displayImageUrl}
              />
              <span className="font-bold text-accent text-xs">
                {skinName} ({skinWear})
                {skinFloat && (
                  <span className="ml-1 font-normal text-text-muted">
                    Float: {skinFloat}
                  </span>
                )}
              </span>
            </div>
          )}

          {imageLoading && (
            <div className="animate-pulse text-center text-text-dim text-xs">
              Searching for skin image...
            </div>
          )}

          {skinName.trim() && !displayImageUrl && !imageLoading && (
            <div className="text-center text-text-dim text-xs">
              No image found.{" "}
              <button
                className="text-accent underline"
                onClick={() => setShowManualUrl(true)}
                type="button"
              >
                Paste URL manually
              </button>
            </div>
          )}

          {showManualUrl && (
            <div className="flex flex-col gap-1">
              <label
                className="text-[10px] text-text-dim uppercase tracking-wider"
                htmlFor="manual-image"
              >
                Image URL
              </label>
              <input
                className="rounded border border-border bg-bg px-3 py-1.5 text-sm text-text"
                id="manual-image"
                onChange={(e) => setManualImageUrl(e.target.value)}
                placeholder="https://community.fastly.steamstatic.com/..."
                type="url"
                value={manualImageUrl}
              />
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-error text-xs">{error}</p>}
      {success && (
        <p className="text-accent text-xs">Season created successfully.</p>
      )}

      <button
        className="rounded bg-accent py-2 font-bold text-bg-elevated text-sm hover:opacity-90 disabled:opacity-40"
        disabled={loading}
        type="submit"
      >
        {loading ? "Creating..." : "Create Season"}
      </button>
    </form>
  );
}

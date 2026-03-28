import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createSeason } from "~/server/seasons";

interface CreateSeasonFormProps {
  userId: string;
}

export function CreateSeasonForm({ userId }: CreateSeasonFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [prizeDesc, setPrizeDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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

    const prizes = prizeDesc.trim()
      ? prizeDesc
          .split("\n")
          .filter((line) => line.trim())
          .map((line, i) => ({ place: i + 1, description: line.trim() }))
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
    setPrizeDesc("");
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

      <div className="flex flex-col gap-1">
        <label
          className="text-[10px] text-text-dim uppercase tracking-wider"
          htmlFor="season-prizes"
        >
          Prizes (one per line, optional)
        </label>
        <textarea
          className="rounded border border-border bg-bg px-3 py-1.5 text-sm text-text"
          id="season-prizes"
          onChange={(e) => setPrizeDesc(e.target.value)}
          placeholder={
            "1st place: Bragging rights\n2nd place: Participation trophy"
          }
          rows={3}
          value={prizeDesc}
        />
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

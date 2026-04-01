import { Link } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useState } from "react";

const doResetPassword = createIsomorphicFn()
  .server(async (_email: string) => ({ error: null as any }))
  .client(async (email: string) => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    return getSupabaseClient().auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
  });

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputClass =
    "bg-bg-elevated border border-border rounded px-3 py-2 text-text focus:border-accent outline-none";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    setLoading(true);
    const { error: resetError } = await doResetPassword(email);
    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSuccessMessage("Check your email for a reset link.");
  }

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-4"
      onSubmit={handleSubmit}
    >
      <input
        className={inputClass}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
        type="email"
        value={email}
      />
      {error && <p className="text-error text-sm">{error}</p>}
      {successMessage && (
        <p className="text-accent text-sm">{successMessage}</p>
      )}
      <button
        className="rounded bg-accent py-2 font-bold text-bg hover:opacity-90 disabled:opacity-50"
        disabled={loading}
        type="submit"
      >
        {loading ? "..." : "Send Reset Link"}
      </button>
      <Link
        className="text-sm text-text-muted hover:text-accent"
        search={{ redirect: undefined }}
        to="/sign-in"
      >
        Back to sign in
      </Link>
    </form>
  );
}

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";

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

  const inputClass = "bg-bg-elevated border border-border rounded px-3 py-2 text-text focus:border-accent outline-none";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className={inputClass}
      />
      {error && <p className="text-error text-sm">{error}</p>}
      {successMessage && <p className="text-accent text-sm">{successMessage}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-accent text-bg font-bold py-2 rounded hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "..." : "Send Reset Link"}
      </button>
      <Link to="/sign-in" className="text-text-muted text-sm hover:text-accent">
        Back to sign in
      </Link>
    </form>
  );
}

import { Link } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useState } from "react";

const doSignUp = createIsomorphicFn()
  .server(async (_email: string, _password: string) => ({ error: null as any }))
  .client(async (email: string, password: string) => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    return getSupabaseClient().auth.signUp({ email, password });
  });

export function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputClass =
    "bg-bg-elevated border border-border rounded px-3 py-2 text-text focus:border-accent outline-none";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: authError } = await doSignUp(email, password);
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setSuccessMessage("Check your email for a confirmation link.");
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
      <input
        className={inputClass}
        minLength={6}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
        type="password"
        value={password}
      />
      <input
        className={inputClass}
        minLength={6}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Confirm Password"
        required
        type="password"
        value={confirmPassword}
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
        {loading ? "..." : "Sign Up"}
      </button>
      <Link
        className="text-sm text-text-muted hover:text-accent"
        search={{ redirect: undefined }}
        to="/sign-in"
      >
        Already have an account? Sign in
      </Link>
    </form>
  );
}

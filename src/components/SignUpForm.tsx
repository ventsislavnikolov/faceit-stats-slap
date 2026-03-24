import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";

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

  const inputClass = "bg-bg-elevated border border-border rounded px-3 py-2 text-text focus:border-accent outline-none";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className={inputClass}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
        className={inputClass}
      />
      <input
        type="password"
        placeholder="Confirm Password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        minLength={6}
        className={inputClass}
      />
      {error && <p className="text-error text-sm">{error}</p>}
      {successMessage && <p className="text-accent text-sm">{successMessage}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-accent text-bg font-bold py-2 rounded hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "..." : "Sign Up"}
      </button>
      <Link to="/sign-in" className="text-text-muted text-sm hover:text-accent">
        Already have an account? Sign in
      </Link>
    </form>
  );
}

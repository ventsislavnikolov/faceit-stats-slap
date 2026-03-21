import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";

const doSignIn = createIsomorphicFn()
  .server(async (_email: string, _password: string) => ({ error: null as any }))
  .client(async (email: string, password: string) => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    return getSupabaseClient().auth.signInWithPassword({ email, password });
  });

const doSignUp = createIsomorphicFn()
  .server(async (_email: string, _password: string) => ({ error: null as any }))
  .client(async (email: string, password: string) => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    return getSupabaseClient().auth.signUp({ email, password });
  });

export function LoginForm({ redirectTo = "/" }: { redirectTo?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (isSignUp && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error: authError } = isSignUp
      ? await doSignUp(email, password)
      : await doSignIn(email, password);

    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }

    if (isSignUp) {
      setError("Check your email for a confirmation link.");
      return;
    }

    router.navigate({ to: redirectTo as any });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="bg-bg-elevated border border-border rounded px-3 py-2 text-text focus:border-accent outline-none"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
        className="bg-bg-elevated border border-border rounded px-3 py-2 text-text focus:border-accent outline-none"
      />
      {isSignUp && (
        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
          className="bg-bg-elevated border border-border rounded px-3 py-2 text-text focus:border-accent outline-none"
        />
      )}
      {error && <p className="text-error text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-accent text-bg font-bold py-2 rounded hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "..." : isSignUp ? "Sign Up" : "Sign In"}
      </button>
      <button
        type="button"
        onClick={() => { setIsSignUp(!isSignUp); setConfirmPassword(""); setError(null); }}
        className="text-text-muted text-sm hover:text-accent"
      >
        {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
      </button>
    </form>
  );
}

import { Link, useRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useState } from "react";

const doSignIn = createIsomorphicFn()
  .server(async (_email: string, _password: string) => ({ error: null as any }))
  .client(async (email: string, password: string) => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    return getSupabaseClient().auth.signInWithPassword({ email, password });
  });

export function LoginForm({ redirectTo = "/" }: { redirectTo?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const inputClass =
    "bg-bg-elevated border border-border rounded px-3 py-2 text-text focus:border-accent outline-none";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    setLoading(true);
    const { error: authError } = await doSignIn(email, password);
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.navigate({ to: redirectTo as any });
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
      {error && <p className="text-error text-sm">{error}</p>}
      <button
        className="rounded bg-accent py-2 font-bold text-bg hover:opacity-90 disabled:opacity-50"
        disabled={loading}
        type="submit"
      >
        {loading ? "..." : "Sign In"}
      </button>
      <div className="flex items-center justify-between">
        <Link
          className="text-sm text-text-muted hover:text-accent"
          to="/sign-up"
        >
          Need an account? Sign up
        </Link>
        <Link
          className="text-sm text-text-muted hover:text-accent"
          to="/forgot-password"
        >
          Forgot password?
        </Link>
      </div>
    </form>
  );
}

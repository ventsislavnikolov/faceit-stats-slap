import { useState } from "react";
import { useRouter, Link } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";

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

  const inputClass = "bg-bg-elevated border border-border rounded px-3 py-2 text-text focus:border-accent outline-none";

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
      {error && <p className="text-error text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-accent text-bg font-bold py-2 rounded hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "..." : "Sign In"}
      </button>
      <div className="flex justify-between items-center">
        <Link to="/sign-up" className="text-text-muted text-sm hover:text-accent">
          Need an account? Sign up
        </Link>
        <Link to="/forgot-password" className="text-text-muted text-sm hover:text-accent">
          Forgot password?
        </Link>
      </div>
    </form>
  );
}

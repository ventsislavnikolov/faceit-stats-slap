import { createFileRoute, Link } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

const subscribeToRecovery = createIsomorphicFn()
  .server(() => ({ unsubscribe: () => {} }))
  .client(async (onRecovery: () => void) => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const { data: { subscription } } = getSupabaseClient().auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") onRecovery();
    });
    return { unsubscribe: () => subscription.unsubscribe() };
  });

const doUpdatePassword = createIsomorphicFn()
  .server(async (_password: string) => ({ error: null as any }))
  .client(async (password: string) => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    return getSupabaseClient().auth.updateUser({ password });
  });

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;
    let timeout: ReturnType<typeof setTimeout>;

    subscribeToRecovery(() => {
      setRecoveryReady(true);
      clearTimeout(timeout);
    }).then((sub) => {
      subscription = sub;
    });

    timeout = setTimeout(() => {
      setExpired(true);
    }, 5000);

    return () => {
      subscription?.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await doUpdatePassword(password);
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
  }

  const inputClass = "bg-bg-elevated border border-border rounded px-3 py-2 text-text focus:border-accent outline-none";

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-accent text-sm">Password updated successfully.</p>
        <Link to="/sign-in" className="text-text-muted text-sm hover:text-accent">
          Sign in with your new password
        </Link>
      </div>
    );
  }

  if (!recoveryReady && expired) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-error text-sm">Invalid or expired reset link.</p>
        <Link to="/sign-in" className="text-text-muted text-sm hover:text-accent">
          Back to sign in
        </Link>
      </div>
    );
  }

  if (!recoveryReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-text-muted text-sm">Verifying reset link...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6">
      <p className="text-text-muted text-sm">Set your new password</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm px-4">
        <input
          type="password"
          placeholder="New Password"
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
        <button
          type="submit"
          disabled={loading}
          className="bg-accent text-bg font-bold py-2 rounded hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}

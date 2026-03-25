import { createFileRoute, Link } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

const subscribeToRecovery = createIsomorphicFn()
  .server(() => ({ unsubscribe: () => {} }))
  .client(async (onRecovery: () => void) => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    const {
      data: { subscription },
    } = getSupabaseClient().auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        onRecovery();
      }
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

  const inputClass =
    "bg-bg-elevated border border-border rounded px-3 py-2 text-text focus:border-accent outline-none";

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-accent text-sm">Password updated successfully.</p>
        <Link
          className="text-sm text-text-muted hover:text-accent"
          to="/sign-in"
        >
          Sign in with your new password
        </Link>
      </div>
    );
  }

  if (!recoveryReady && expired) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-error text-sm">Invalid or expired reset link.</p>
        <Link
          className="text-sm text-text-muted hover:text-accent"
          to="/sign-in"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  if (!recoveryReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-text-muted">Verifying reset link...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <p className="text-sm text-text-muted">Set your new password</p>
      <form
        className="flex w-full max-w-sm flex-col gap-4 px-4"
        onSubmit={handleSubmit}
      >
        <input
          className={inputClass}
          minLength={6}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New Password"
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
        <button
          className="rounded bg-accent py-2 font-bold text-bg hover:opacity-90 disabled:opacity-50"
          disabled={loading}
          type="submit"
        >
          {loading ? "..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}

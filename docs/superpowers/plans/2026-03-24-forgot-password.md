# Forgot Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a forgot password flow to the sign-in page using Supabase Auth's built-in password reset.

**Architecture:** Two touchpoints — a forgot-password mode in the existing `LoginForm` component and a new standalone `/reset-password` route. All auth logic uses Supabase client SDK via the existing `createIsomorphicFn` pattern. No backend changes needed.

**Tech Stack:** React, TanStack Router/Start, Supabase Auth (`resetPasswordForEmail`, `updateUser`, `onAuthStateChange`)

**Spec:** `docs/superpowers/specs/2026-03-24-forgot-password-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/LoginForm.tsx` | Modify | Add `isForgotPassword` mode, `doResetPassword` isomorphic fn, `successMessage` state |
| `src/routes/reset-password.tsx` | Create | Standalone route for setting new password after email link click |

---

### Task 1: Add `successMessage` state and `doResetPassword` fn to LoginForm

**Files:**
- Modify: `src/components/LoginForm.tsx`

- [ ] **Step 1: Add `doResetPassword` isomorphic function**

Add after the existing `doSignUp` function (line 17):

```tsx
const doResetPassword = createIsomorphicFn()
  .server(async (_email: string) => ({ error: null as any }))
  .client(async (email: string) => {
    const { getSupabaseClient } = await import("~/lib/supabase.client");
    return getSupabaseClient().auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
  });
```

- [ ] **Step 2: Add `isForgotPassword` and `successMessage` state**

Inside `LoginForm`, add after the existing state declarations (after line 25):

```tsx
const [isForgotPassword, setIsForgotPassword] = useState(false);
const [successMessage, setSuccessMessage] = useState<string | null>(null);
```

- [ ] **Step 3: Update `handleSubmit` for forgot password mode**

Replace the entire `handleSubmit` function with:

```tsx
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError(null);
  setSuccessMessage(null);

  if (isForgotPassword) {
    setLoading(true);
    const { error: resetError } = await doResetPassword(email);
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSuccessMessage("Check your email for a reset link.");
    return;
  }

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
    setSuccessMessage("Check your email for a confirmation link.");
    return;
  }

  router.navigate({ to: redirectTo as any });
}
```

Note: the sign-up confirmation now uses `setSuccessMessage` instead of `setError`.

- [ ] **Step 4: Update the JSX**

Replace the form JSX (lines 58-102) with:

```tsx
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
    {!isForgotPassword && (
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
        className="bg-bg-elevated border border-border rounded px-3 py-2 text-text focus:border-accent outline-none"
      />
    )}
    {isSignUp && !isForgotPassword && (
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
    {successMessage && <p className="text-accent text-sm">{successMessage}</p>}
    <button
      type="submit"
      disabled={loading}
      className="bg-accent text-bg font-bold py-2 rounded hover:opacity-90 disabled:opacity-50"
    >
      {loading ? "..." : isForgotPassword ? "Send Reset Link" : isSignUp ? "Sign Up" : "Sign In"}
    </button>
    {isForgotPassword ? (
      <button
        type="button"
        onClick={() => { setIsForgotPassword(false); setError(null); setSuccessMessage(null); }}
        className="text-text-muted text-sm hover:text-accent"
      >
        Back to sign in
      </button>
    ) : (
      <>
        <button
          type="button"
          onClick={() => { setIsSignUp(!isSignUp); setConfirmPassword(""); setError(null); setSuccessMessage(null); }}
          className="text-text-muted text-sm hover:text-accent"
        >
          {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
        {!isSignUp && (
          <button
            type="button"
            onClick={() => { setIsForgotPassword(true); setPassword(""); setError(null); setSuccessMessage(null); }}
            className="text-text-muted text-xs hover:text-accent -mt-2"
          >
            Forgot password?
          </button>
        )}
      </>
    )}
  </form>
);
```

- [ ] **Step 5: Verify the app builds**

Run: `pnpm build`
Expected: no TypeScript or build errors

- [ ] **Step 6: Commit**

```bash
git add src/components/LoginForm.tsx
git commit -m "feat(auth): add forgot password mode to LoginForm"
```

---

### Task 2: Create Reset Password Route

**Files:**
- Create: `src/routes/reset-password.tsx`

- [ ] **Step 1: Create the route file**

Create `src/routes/reset-password.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify the app builds**

Run: `pnpm build`
Expected: no TypeScript or build errors. TanStack Router should auto-generate the route.

- [ ] **Step 3: Commit**

```bash
git add src/routes/reset-password.tsx
git commit -m "feat(auth): add reset password route"
```

---

### Task 3: Manual Verification & Supabase Config

- [ ] **Step 1: Add redirect URL in Supabase Dashboard**

Go to **Supabase Dashboard > Authentication > URL Configuration > Redirect URLs**.
Add: `http://localhost:3000/reset-password` (for local dev) and the production URL equivalent.

- [ ] **Step 2: Manual test — forgot password flow**

1. Go to `/sign-in`
2. Click "Forgot password?"
3. Enter email, click "Send Reset Link"
4. Verify success message appears in accent color (not error red)
5. Check email for reset link
6. Click reset link — should land on `/reset-password` (no app nav)
7. Verify "Verifying reset link..." appears briefly, then the password form
8. Enter mismatched passwords — verify error
9. Enter matching passwords (6+ chars) — verify success + redirect link

- [ ] **Step 3: Manual test — mode switching**

1. Go to `/sign-in`
2. Toggle sign-in → sign-up → sign-in: verify state clears properly
3. Click "Forgot password?" → "Back to sign in": verify state clears properly
4. Verify "Forgot password?" link only shows in sign-in mode (not sign-up)

- [ ] **Step 4: Final commit (if any tweaks needed)**

```bash
git add -A
git commit -m "fix(auth): post-testing adjustments"
```

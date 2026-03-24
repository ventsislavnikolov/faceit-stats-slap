# Forgot Password Flow

## Overview

Add a "Forgot password?" flow to the sign-in page using Supabase Auth's built-in password reset. Two touchpoints: a forgot-password mode in the existing LoginForm and a new `/reset-password` route for setting the new password.

## Changes

### 1. LoginForm (`src/components/LoginForm.tsx`)

Add `isForgotPassword` state (default `false`). When active:

- Hide the password field
- Change submit button text to "Send Reset Link"
- On submit: call `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`
- On success: show message styled distinctly from errors (e.g. `text-accent`): "Check your email for a reset link"
- Show "Back to sign in" link to return to normal sign-in mode
- When toggling modes, preserve `email` state but clear messages

Add separate `successMessage` state so success feedback does not render with error styling. Also fix the pre-existing sign-up confirmation message to use this same pattern.

The "Forgot password?" link appears below the submit button, only in sign-in mode (not sign-up).

A new `doResetPassword` isomorphic function wraps the Supabase call, following the existing `doSignIn`/`doSignUp` pattern. Uses `window.location.origin` for the redirect URL since the `.client()` branch always runs in the browser.

### 2. Reset Password Route (`src/routes/reset-password.tsx`)

New **standalone** route (outside `_authed` layout) — avoids app shell nav chrome and any auth session race conditions during token exchange.

**How it works:**
- User clicks the email link containing recovery tokens in the URL hash
- Supabase client auto-detects tokens and fires a `PASSWORD_RECOVERY` event via `onAuthStateChange`
- Page listens for this event to confirm a valid recovery session
- Show a loading state initially; after 5 seconds without a `PASSWORD_RECOVERY` event, fall back to "Invalid or expired reset link"

**UI:**
- Two fields: "New Password" + "Confirm Password"
- Validate passwords match and meet minimum length (6 chars) before calling `updateUser`, consistent with sign-up validation
- Submit calls `supabase.auth.updateUser({ password })`
- On success: redirect to `/sign-in` (user re-authenticates with new password)
- On error: show error message inline
- If no recovery session detected after timeout: show "Invalid or expired reset link" with link back to sign-in

**Styling:** matches existing LoginForm — same input classes, same `max-w-sm` centered container, minimal layout (no app nav).

## API Calls (Supabase Auth)

1. `supabase.auth.resetPasswordForEmail(email, { redirectTo })` — triggers the reset email
2. `supabase.auth.updateUser({ password })` — sets the new password after recovery token is validated

No custom backend logic required.

## Supabase Dashboard Config

Add `/reset-password` (or a wildcard) to **Authentication > URL Configuration > Redirect URLs** in the Supabase dashboard. Without this, Supabase will reject the redirect.

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/LoginForm.tsx` | Add forgot password mode, `doResetPassword` fn, `successMessage` state |
| `src/routes/reset-password.tsx` | New standalone route for setting new password |

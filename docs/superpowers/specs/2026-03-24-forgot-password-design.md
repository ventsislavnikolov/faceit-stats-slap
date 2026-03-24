# Forgot Password Flow

## Overview

Add a "Forgot password?" flow to the sign-in page using Supabase Auth's built-in password reset. Two touchpoints: a forgot-password mode in the existing LoginForm and a new `/reset-password` route for setting the new password.

## Changes

### 1. LoginForm (`src/components/LoginForm.tsx`)

Add `isForgotPassword` state (default `false`). When active:

- Hide the password field
- Change submit button text to "Send Reset Link"
- On submit: call `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<site-url>/reset-password' })`
- Show success message: "Check your email for a reset link"
- Show "Back to sign in" link to return to normal sign-in mode

The "Forgot password?" link appears below the submit button, only in sign-in mode (not sign-up).

A new `doResetPassword` isomorphic function wraps the Supabase call, following the existing `doSignIn`/`doSignUp` pattern.

### 2. Reset Password Route (`src/routes/_authed/reset-password.tsx`)

New route that handles the recovery token callback.

**How it works:**
- User clicks the email link containing recovery tokens in the URL hash
- Supabase client auto-detects tokens and fires a `PASSWORD_RECOVERY` event via `onAuthStateChange`
- Page listens for this event to confirm a valid recovery session

**UI:**
- Two fields: "New Password" + "Confirm Password"
- Submit calls `supabase.auth.updateUser({ password })`
- On success: redirect to `/sign-in`
- On error: show error message inline
- If no recovery session detected: show "Invalid or expired reset link" with link back to sign-in

**Styling:** matches existing LoginForm — same input classes, same `max-w-sm` centered container.

## API Calls (Supabase Auth)

1. `supabase.auth.resetPasswordForEmail(email, { redirectTo })` — triggers the reset email
2. `supabase.auth.updateUser({ password })` — sets the new password after recovery token is validated

No custom backend logic required.

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/LoginForm.tsx` | Add forgot password mode + `doResetPassword` isomorphic fn |
| `src/routes/_authed/reset-password.tsx` | New route for setting new password |

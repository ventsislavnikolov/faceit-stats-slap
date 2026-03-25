import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "~/components/LoginForm";

export const Route = createFileRoute("/_authed/sign-in")({
  component: SignInPage,
});

function SignInPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <p className="text-sm text-text-muted">Sign in to access match history</p>
      <LoginForm redirectTo="/history" />
    </div>
  );
}

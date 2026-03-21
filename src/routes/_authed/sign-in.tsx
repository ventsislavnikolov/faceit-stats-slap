import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "~/components/LoginForm";

export const Route = createFileRoute("/_authed/sign-in")({
  component: SignInPage,
});

function SignInPage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6">
      <p className="text-text-muted text-sm">Sign in to access match history</p>
      <LoginForm redirectTo="/history" />
    </div>
  );
}

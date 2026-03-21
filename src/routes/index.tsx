import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "~/components/LoginForm";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8">
      <div className="text-center">
        <h1 className="text-accent text-3xl font-bold">
          FaceitFriends<span className="text-text">Live</span>
        </h1>
        <p className="text-text-muted text-sm mt-2">CS2 Friends Dashboard</p>
      </div>
      <LoginForm />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "~/components/LoginForm";

export const Route = createFileRoute("/_authed/sign-in")({
  component: SignInPage,
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
});

function SignInPage() {
  const { redirect } = Route.useSearch();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <p className="text-sm text-text-muted">Sign in to access match history</p>
      <LoginForm redirectTo={redirect ?? "/history"} />
    </div>
  );
}

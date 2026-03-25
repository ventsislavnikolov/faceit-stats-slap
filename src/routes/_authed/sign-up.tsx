import { createFileRoute } from "@tanstack/react-router";
import { SignUpForm } from "~/components/SignUpForm";

export const Route = createFileRoute("/_authed/sign-up")({
  component: SignUpPage,
});

function SignUpPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <p className="text-sm text-text-muted">Create an account</p>
      <SignUpForm />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { SignUpForm } from "~/components/SignUpForm";

export const Route = createFileRoute("/_authed/sign-up")({
  component: SignUpPage,
});

function SignUpPage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6">
      <p className="text-text-muted text-sm">Create an account</p>
      <SignUpForm />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordForm } from "~/components/ForgotPasswordForm";

export const Route = createFileRoute("/_authed/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <p className="text-sm text-text-muted">Reset your password</p>
      <ForgotPasswordForm />
    </div>
  );
}

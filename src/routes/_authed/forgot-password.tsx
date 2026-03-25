import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordForm } from "~/components/ForgotPasswordForm";

export const Route = createFileRoute("/_authed/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6">
      <p className="text-text-muted text-sm">Reset your password</p>
      <ForgotPasswordForm />
    </div>
  );
}

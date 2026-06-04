import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/app/(auth)/restablecer-contrasena/_components/reset-password-form";

export const metadata = { title: "Nueva contraseña" };

// The recovery email link routes through /auth/callback (which exchanges
// the OTP for a session) and then lands here. We require a session so a
// random visit without a valid recovery link gets bounced.
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/recuperar?expired=1");

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold tracking-tight">Nueva contraseña</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Elige una contraseña nueva para tu cuenta{" "}
        <span className="font-medium text-foreground">{user.email}</span>.
      </p>
      <ResetPasswordForm />
      <p className="mt-6 text-sm text-muted-foreground">
        <Link
          href="/mi-cuenta"
          className="font-medium text-foreground hover:text-primary"
        >
          Cancelar y volver a mi cuenta
        </Link>
      </p>
    </div>
  );
}

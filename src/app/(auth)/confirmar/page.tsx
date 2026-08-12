import Link from "next/link";
import { ConfirmForm } from "@/app/(auth)/confirmar/_components/confirm-form";

export const metadata = { title: "Confirmar" };

/**
 * Interstitial for every email verification link.
 *
 * Supabase's own `{{ .ConfirmationURL }}` points at `/auth/v1/verify`, which
 * burns its single-use token on a bare GET. Anything that opens the URL first
 * — an iOS link preview, a mail scanner — spends it, and the person clicking
 * lands on `otp_expired`. Two further problems came with it: those links are
 * PKCE, so the `code_verifier` cookie has to live in the same browser that
 * requested the reset (asking on a laptop and opening on a phone could never
 * work), and the failure surfaced as a bare bounce to /login.
 *
 * So the emails now carry `{{ .TokenHash }}` here instead, and nothing is
 * consumed until the customer presses the button — a POST no crawler makes.
 * `verifyOtp` with a token hash needs no code_verifier, which is what makes
 * opening the mail on another device work at all.
 */

const COPY: Record<
  string,
  { title: string; body: string; cta: string; next: string }
> = {
  recovery: {
    title: "Cambiar tu contraseña",
    body: "Confirma que fuiste tú quien pidió cambiar la contraseña. En el siguiente paso eliges la nueva.",
    cta: "Cambiar mi contraseña",
    next: "/restablecer-contrasena",
  },
  signup: {
    title: "Confirmar tu cuenta",
    body: "Solo falta confirmar tu correo para activar tu cuenta de Momentos.",
    cta: "Confirmar mi cuenta",
    next: "/mi-cuenta",
  },
  invite: {
    title: "Aceptar tu invitación",
    body: "Te invitaron a Momentos. Confirma para activar tu cuenta.",
    cta: "Aceptar invitación",
    next: "/mi-cuenta",
  },
  magiclink: {
    title: "Iniciar sesión",
    body: "Confirma para entrar a tu cuenta sin contraseña.",
    cta: "Entrar a mi cuenta",
    next: "/mi-cuenta",
  },
  email_change: {
    title: "Confirmar tu correo nuevo",
    body: "Confirma el cambio de correo para terminar de actualizar tu cuenta.",
    cta: "Confirmar correo",
    next: "/mi-cuenta/perfil",
  },
};

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    next?: string;
  }>;
}) {
  const { token_hash: tokenHash, type, next } = await searchParams;
  const copy = type ? COPY[type] : undefined;

  if (!tokenHash || !copy) {
    return (
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Enlace inválido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este enlace está incompleto o ya no es válido. Solicita uno nuevo.
        </p>
        <Link
          href="/recuperar"
          className="mt-6 inline-block text-sm font-medium text-foreground hover:text-primary"
        >
          Solicitar un enlace nuevo
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold tracking-tight">{copy.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>

      <ConfirmForm
        tokenHash={tokenHash}
        type={type!}
        next={next || copy.next}
        cta={copy.cta}
      />

      <p className="mt-6 text-xs text-muted-foreground">
        Si no fuiste tú, puedes cerrar esta página sin hacer nada.
      </p>
    </div>
  );
}

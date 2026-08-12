"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  confirmOtpAction,
  type ConfirmState,
} from "@/app/(auth)/confirmar/actions";

export function ConfirmForm({
  tokenHash,
  type,
  next,
  cta,
}: {
  tokenHash: string;
  type: string;
  next: string;
  cta: string;
}) {
  const [state, formAction] = useActionState<ConfirmState | undefined, FormData>(
    confirmOtpAction,
    undefined,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="next" value={next} />

      <SubmitButton label={cta} />

      {state?.message ? (
        <div className="space-y-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <p>{state.message}</p>
          <Link
            href="/recuperar"
            className="inline-block font-medium underline underline-offset-2"
          >
            Solicitar un enlace nuevo
          </Link>
        </div>
      ) : null}
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Verificando..." : label}
    </Button>
  );
}

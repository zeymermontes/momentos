"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  updatePasswordAction,
  type AuthState,
} from "@/app/(auth)/actions";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<AuthState | undefined, FormData>(
    updatePasswordAction,
    undefined,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div className="grid gap-1.5">
        <Label htmlFor="password">Nueva contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
        {state?.errors?.password?.[0] ? (
          <p className="text-xs text-destructive">
            {state.errors.password[0]}
          </p>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="confirm">Confirmar contraseña</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
        {state?.errors?.confirm?.[0] ? (
          <p className="text-xs text-destructive">
            {state.errors.confirm[0]}
          </p>
        ) : null}
      </div>

      {state?.message ? (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.message}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Guardando..." : "Guardar nueva contraseña"}
    </Button>
  );
}

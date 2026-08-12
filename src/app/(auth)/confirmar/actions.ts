"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { runAction } from "@/lib/server-action";
import { sendWelcomeEmailIfFirstConfirmation } from "@/lib/auth-welcome";

/** The verification kinds our email templates actually send. */
const OTP_TYPES = [
  "signup",
  "recovery",
  "invite",
  "magiclink",
  "email_change",
] as const;

const ConfirmSchema = z.object({
  token_hash: z.string().min(1),
  type: z.enum(OTP_TYPES),
  next: z.string().optional(),
});

export type ConfirmState = { message?: string };

/**
 * `next` arrives from the email link, so it is attacker-influenced. Only
 * same-site paths are honoured: anything absolute, protocol-relative, or
 * malformed falls back to the home page rather than becoming an open redirect.
 */
function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function confirmOtpAction(
  _prev: ConfirmState | undefined,
  formData: FormData,
): Promise<ConfirmState> {
  return runAction(async () => {
    const parsed = ConfirmSchema.safeParse({
      token_hash: formData.get("token_hash"),
      type: formData.get("type"),
      next: formData.get("next") || undefined,
    });
    if (!parsed.success) {
      return { message: "El enlace no es válido. Solicita uno nuevo." };
    }

    const supabase = await createClient();
    // Consuming the token here, on POST, is the whole point: a link preview
    // or mail scanner issuing a GET leaves it untouched.
    const { error } = await supabase.auth.verifyOtp({
      type: parsed.data.type as EmailOtpType,
      token_hash: parsed.data.token_hash,
    });
    if (error) {
      return {
        message:
          "Este enlace ya se usó o expiró. Solicita uno nuevo para continuar.",
      };
    }

    if (parsed.data.type === "signup" || parsed.data.type === "invite") {
      await sendWelcomeEmailIfFirstConfirmation(supabase);
    }

    redirect(safeNext(parsed.data.next));
  });
}

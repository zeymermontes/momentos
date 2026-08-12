import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Send the welcome email once per user — first time a verification completes
// after signup. Detected by checking that email_confirmed_at landed within the
// last 5 minutes (fresh confirmation) and that the welcome flag isn't set yet
// on app_metadata.
const RECENT_CONFIRMATION_WINDOW_MS = 5 * 60 * 1000;

/**
 * Best-effort welcome email after a fresh signup confirmation.
 *
 * Shared by both verification entry points: the legacy `/auth/callback`
 * (still live for links already sitting in inboxes) and the current
 * `/confirmar` flow. Never throws — a mail failure must not block the user
 * from getting into their account.
 */
export async function sendWelcomeEmailIfFirstConfirmation(
  supabase: SupabaseClient<Database>,
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email || !user.email_confirmed_at) return;

    const confirmedRecently =
      Date.now() - new Date(user.email_confirmed_at).getTime() <
      RECENT_CONFIRMATION_WINDOW_MS;
    const alreadyWelcomed = Boolean(
      (user.app_metadata as Record<string, unknown> | undefined)?.welcome_sent,
    );
    if (!confirmedRecently || alreadyWelcomed) return;

    const { sendWelcomeEmail } = await import("@/lib/email");
    const { createAdminClient } = await import("@/lib/supabase/admin");

    await sendWelcomeEmail({
      to: user.email,
      name:
        ((user.user_metadata as Record<string, unknown> | undefined)
          ?.full_name as string | undefined) ?? null,
    });
    // Mark on app_metadata so a later verification (e.g. password recovery)
    // doesn't trigger another welcome.
    createAdminClient()
      .auth.admin.updateUserById(user.id, {
        app_metadata: { ...user.app_metadata, welcome_sent: true },
      })
      .catch((e) => console.error("[welcome] flag update failed:", e));
  } catch (e) {
    console.error("[welcome] send failed:", e);
  }
}

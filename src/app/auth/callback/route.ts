import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

// Send the welcome email once per user — first time the auth callback
// completes after signup confirmation. Detected by checking that
// email_confirmed_at landed within the last 5 minutes (fresh confirmation)
// and that the welcome flag isn't set yet on app_metadata.
const RECENT_CONFIRMATION_WINDOW_MS = 5 * 60 * 1000;

// Reverse proxies on hosts like Render expose the app on an internal port
// (10000) and request.url reflects that internal origin, so building the
// redirect off `new URL(request.url).origin` lands users at
// https://localhost:10000/... Use NEXT_PUBLIC_SITE_URL as the source of
// truth for the public origin instead.
function publicOrigin(): string {
  return env.SITE_URL.replace(/\/$/, "");
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Best-effort welcome email after fresh signup confirmation.
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.email && user.email_confirmed_at) {
          const confirmedRecently =
            Date.now() - new Date(user.email_confirmed_at).getTime() <
            RECENT_CONFIRMATION_WINDOW_MS;
          const alreadyWelcomed = Boolean(
            (user.app_metadata as Record<string, unknown> | undefined)
              ?.welcome_sent,
          );
          if (confirmedRecently && !alreadyWelcomed) {
            const { sendWelcomeEmail } = await import("@/lib/email");
            const { createAdminClient } = await import(
              "@/lib/supabase/admin"
            );
            const admin = createAdminClient();
            await sendWelcomeEmail({
              to: user.email,
              name:
                (user.user_metadata as Record<string, unknown> | undefined)
                  ?.full_name as string | undefined ?? null,
            });
            // Mark on app_metadata so a future callback (e.g. password
            // recovery) doesn't trigger another welcome.
            await admin.auth.admin.updateUserById(user.id, {
              app_metadata: { ...user.app_metadata, welcome_sent: true },
            });
          }
        }
      } catch (e) {
        console.error("[auth/callback] welcome email failed:", e);
      }
      return NextResponse.redirect(new URL(next, publicOrigin()));
    }
  }

  return NextResponse.redirect(new URL("/login?error=callback", publicOrigin()));
}

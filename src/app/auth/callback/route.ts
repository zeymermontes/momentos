import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmailIfFirstConfirmation } from "@/lib/auth-welcome";
import { env } from "@/lib/env";

// Legacy verification entry point, kept alive for recovery/confirmation links
// already sitting in inboxes. New emails point at /confirmar instead, which
// doesn't burn its token on a bare GET — see that route for why.

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
      await sendWelcomeEmailIfFirstConfirmation(supabase);
      return NextResponse.redirect(new URL(next, publicOrigin()));
    }
  }

  return NextResponse.redirect(new URL("/login?error=callback", publicOrigin()));
}

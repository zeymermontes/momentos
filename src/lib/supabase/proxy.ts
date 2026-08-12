import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * @param needsRole Whether the caller will actually read `role`. The role only
 * gates /admin, but this proxy runs on nearly every request (see the matcher in
 * src/proxy.ts), so looking it up unconditionally spent a Supabase round-trip
 * on every storefront navigation for a value nothing read.
 *
 * It's a parameter rather than a lazy getter on the return value because
 * `setAll` reassigns `response` when Supabase rotates the session cookies. A
 * getter invoked after this function returns would mutate a `response` the
 * caller has already destructured, silently dropping the refreshed cookies and
 * logging the user out.
 */
export async function updateSession(
  request: NextRequest,
  { needsRole = false }: { needsRole?: boolean } = {},
) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: "customer" | "admin" | null = null;
  if (needsRole && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = (profile?.role as "customer" | "admin" | null) ?? "customer";
  }

  return { response, user, role };
}

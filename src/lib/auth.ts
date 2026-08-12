import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/database.types";

/**
 * `supabase.auth.getUser()` is a network round-trip to the Auth server (~150 ms
 * from here) — it revalidates the JWT rather than decoding it locally. One admin
 * navigation asks for the session from the layout guard and again from the
 * page's `requireAdmin()`, and the `profiles` lookup rides along behind each.
 * `cache()` scopes both to a single request so every caller shares one lookup.
 *
 * Measured caveat: this halves the calls but does *not* speed up the render —
 * React renders the layout and page concurrently, so the duplicates overlapped
 * and cost no extra wall-clock. The win is load on Supabase and one less way
 * for the two guards to disagree, not latency.
 */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Cached alongside {@link getSessionUser} — same request, same answer. */
export const getProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", userId)
    .maybeSingle();
  return data;
});

/**
 * Ensure a user is authenticated. Redirects to /login otherwise.
 */
export async function requireUser() {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/**
 * Ensure the user has the given role (or admin). Redirects to / otherwise.
 */
export async function requireRole(role: UserRole) {
  const { supabase, user } = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile || (profile.role !== role && profile.role !== "admin")) {
    redirect("/");
  }
  return { supabase, user, profile };
}

export const requireAdmin = () => requireRole("admin");

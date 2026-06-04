function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

// Normalize the site URL: prepend https:// if the env var is set without a
// protocol so downstream `new URL()` consumers don't throw ERR_INVALID_URL.
function normalizeSiteUrl(raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) return "http://localhost:3000";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export const env = {
  SUPABASE_URL: required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  SUPABASE_ANON_KEY: required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  SITE_URL: normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
  MERCADOPAGO_PUBLIC_KEY: process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? "",
};

export function serverOnlyEnv() {
  return {
    SUPABASE_SERVICE_ROLE_KEY: required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    MERCADOPAGO_ACCESS_TOKEN: process.env.MERCADOPAGO_ACCESS_TOKEN ?? "",
    MERCADOPAGO_WEBHOOK_SECRET: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "",
    RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
    // Verified domain or `Acme <onboarding@resend.dev>` for testing.
    EMAIL_FROM:
      process.env.EMAIL_FROM ?? "Momentos Photobooks <onboarding@resend.dev>",
  };
}

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Normalize NEXT_PUBLIC_SITE_URL so a missing protocol (e.g.
// "momentosbooks.com") doesn't crash `new URL()` during build.
function siteUrlBase(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return "http://localhost:3000";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export const metadata: Metadata = {
  title: {
    default: "Momentos",
    template: "%s · Momentos",
  },
  description:
    "Tu tienda en línea de momentos especiales. Encuentra productos únicos, personaliza y recibe en tu domicilio.",
  metadataBase: new URL(siteUrlBase()),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} h-full overflow-x-hidden antialiased`}
    >
      <body className="flex min-h-full flex-col overflow-x-hidden bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}

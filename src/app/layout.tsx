// Root layout: dark-first shell with font, SEO metadata, header/footer.
// All pages inherit this; keep it lean — no data fetching here.

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { APP_CONFIG } from "@/config/app.config";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ThemeProvider } from "@/components/layout/theme-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: {
    default: `${APP_CONFIG.name} — ${APP_CONFIG.institution} Question Papers`,
    template: `%s · ${APP_CONFIG.name}`,
  },
  description: APP_CONFIG.description,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: APP_CONFIG.fullName,
    description: APP_CONFIG.description,
    type: "website",
    url: SITE_URL,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* No-flash theme script: runs before paint, reads localStorage / system pref. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=localStorage.getItem('gtu-theme');var t=s==='light'||s==='dark'?s:window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t);})();`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[var(--gtu-accent)] focus:px-3 focus:py-2 focus:text-white"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}

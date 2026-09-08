import type { Metadata } from "next";
import "./globals.css";
import { FontLoader } from "./FontLoader";

export const metadata: Metadata = {
  title: "LeadsGen",
  description: "Lead generation dashboard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect only — the actual stylesheet is injected client-side
            by FontLoader so it's never render-blocking. Not next/font/google
            either way, so a build/dev-time network hiccup can't fail the
            build — it just falls back to the system stack below. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <FontLoader />
        {children}
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
// Zoom's web UI uses Lato. Self-hosted from npm so the build never depends on Google Fonts.
import "@fontsource/lato/400.css";
import "@fontsource/lato/700.css";
import "@fontsource/lato/900.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zoom Clone",
  description: "Video meetings: start, join and schedule meetings.",
};

export const viewport: Viewport = {
  themeColor: "#0b5cff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

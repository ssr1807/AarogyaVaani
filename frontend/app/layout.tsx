import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/components/language-provider";

export const metadata: Metadata = {
  title: "AarogyaVaani",
  description:
    "AarogyaVaani — a secure digital health locker for storing, understanding, and sharing health records.",
  applicationName: "AarogyaVaani",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#087f8c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <main className="app-shell">
            {children}
          </main>
        </LanguageProvider>
      </body>
    </html>
  );
}
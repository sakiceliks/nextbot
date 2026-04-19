import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "İLANLA — Sahibinden Analiz & İlan yayınlama botu",
  description:
    "Araç parçası görselini Google Lens, Groq AI ve Puppeteer ile otomatik ilana dönüştüren akıllı sistem.",
  keywords: ["araç parçası", "sahibinden", "ilan", "AI", "Google Lens", "Groq"],
  authors: [{ name: "İLANLA" }],
  robots: "noindex, nofollow",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0d1117",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className={`dark ${inter.variable}`}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body
        className={`${inter.className} min-h-dvh bg-[#0d1117] text-white antialiased overscroll-none`}
      >
        {children}
      </body>
    </html>
  );
}

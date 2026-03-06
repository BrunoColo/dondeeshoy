import type { Metadata, Viewport } from "next";
import { Outfit, DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { NeonParallax } from "@/components/layout/neon-parallax";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteConfig.name,
  url: siteConfig.url,
  logo: `${siteConfig.url}${siteConfig.logoPath}`,
  sameAs: [siteConfig.url],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteConfig.name,
  url: siteConfig.url,
  inLanguage: siteConfig.locale,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  title: {
    default: siteConfig.name,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: ["eventos", "uruguay", "salidas", "conciertos", "ferias", "teatro", "actividades", "hoy"],
  authors: [{ name: "DondeEsHoy" }],
  alternates: {
    canonical: siteConfig.url,
  },
  icons: {
    icon: [
      { url: siteConfig.logoPath, type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: [{ url: siteConfig.logoPath, type: "image/svg+xml" }],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? {
        google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
      }
    : undefined,
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    type: "website",
    locale: siteConfig.locale,
    url: siteConfig.url,
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "¿Dónde es Hoy? — Eventos en Uruguay",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: ["/og-default.png"],
  },
  other: {
    "geo.region": "UY",
    "geo.placename": "Uruguay",
    "geo.position": "-32.5228;-55.7658",
    ICBM: "-32.5228, -55.7658",
  },
};

export const viewport: Viewport = {
  themeColor: "#06060C",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-UY" className="dark" data-scroll-behavior="smooth">
      <body
        className={`${outfit.variable} ${dmSans.variable} ${dmMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <NeonParallax />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}

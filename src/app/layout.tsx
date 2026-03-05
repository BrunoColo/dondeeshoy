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

export const metadata: Metadata = {
  metadataBase: new URL("https://dondeeshoy.com"),
  title: {
    default: siteConfig.name,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: ["eventos", "uruguay", "salidas", "conciertos", "ferias", "teatro", "actividades", "hoy"],
  authors: [{ name: "DondeEsHoy" }],
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    type: "website",
    locale: siteConfig.locale,
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
        <NeonParallax />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}

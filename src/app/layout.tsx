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
    <html lang="es-UY" className="dark">
      <body
        className={`${outfit.variable} ${dmSans.variable} ${dmMono.variable} antialiased`}
      >
        <NeonParallax />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}

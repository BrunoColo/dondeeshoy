import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { SubscribeForm } from "./subscribe-form";

export const metadata: Metadata = {
  title: `Suscribite — ${siteConfig.name}`,
  description:
    "Recibí cada jueves los mejores eventos del finde según tu departamento y gustos. Boletín semanal gratis.",
  alternates: {
    canonical: "/suscribirse",
  },
  openGraph: {
    title: `Suscribite — ${siteConfig.name}`,
    description:
      "Recibí cada jueves una selección del finde según tu ciudad y tus gustos.",
    url: `${siteConfig.url}/suscribirse`,
  },
};

export default function SuscribirsePage() {
  return <SubscribeForm />;
}

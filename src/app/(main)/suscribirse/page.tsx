import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { SubscribeForm } from "./subscribe-form";

export const metadata: Metadata = {
  title: `Suscribite — ${siteConfig.name}`,
  description:
    "Recibí los mejores eventos de Uruguay en tu email. Newsletter semanal o diario con eventos filtrados por tus intereses.",
  openGraph: {
    title: `Suscribite — ${siteConfig.name}`,
    description:
      "Recibí los mejores eventos de Uruguay en tu email cada semana.",
    url: `${siteConfig.url}/suscribirse`,
  },
};

export default function SuscribirsePage() {
  return <SubscribeForm />;
}

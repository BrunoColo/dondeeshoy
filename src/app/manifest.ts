import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "¿Dónde es hoy?",
    short_name: "DondeEsHoy",
    description: "Eventos nightlife en Montevideo para hoy y próximos días.",
    start_url: "/",
    display: "standalone",
    background_color: "#06060C",
    theme_color: "#06060C",
    lang: "es-UY",
  };
}
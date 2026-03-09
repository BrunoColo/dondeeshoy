import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Publicá tu evento — ¿Dónde es Hoy?",
  description:
    "Publicá tu evento en Uruguay. Completá el formulario y lo revisamos en menos de 48 horas. Los eventos gratuitos son publicados sin costo.",
  alternates: {
    canonical: "/publicar",
  },
};

export default function PublicarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

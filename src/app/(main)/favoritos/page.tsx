import type { Metadata } from "next";
import { FavoritesClient } from "./favorites-client";

export const metadata: Metadata = {
  title: "Favoritos",
  description: "Tus eventos guardados en ¿Dónde es hoy?",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "/favoritos",
  },
};

export const revalidate = 300;

export default function FavoritosPage() {
  return <FavoritesClient />;
}

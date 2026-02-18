"use client";

import { useCallback, useState } from "react";

export interface GeoPosition {
  lat: number;
  lng: number;
}

export function useGeolocation() {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocalización no disponible en este dispositivo.");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      (err) => {
        setError(err.message || "No pudimos obtener tu ubicación.");
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }, []);

  return {
    position,
    loading,
    error,
    requestLocation,
  };
}

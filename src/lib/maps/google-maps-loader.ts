interface GoogleMapsLoaderOptions {
  apiKey: string;
  libraries?: string[];
}

export interface GoogleMapsLike {
  maps: {
    [key: string]: unknown;
  };
}

declare global {
  interface Window {
    google?: GoogleMapsLike;
    __dehGoogleMapsLoaderPromise?: Promise<GoogleMapsLike>;
  }
}

function buildGoogleMapsScriptSrc(apiKey: string, libraries: string[]): string {
  const uniqueLibraries = [...new Set(libraries)].filter(Boolean);
  const librariesParam = uniqueLibraries.length
    ? `&libraries=${encodeURIComponent(uniqueLibraries.join(","))}`
    : "";

  return `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}${librariesParam}&v=weekly&loading=async`;
}

export async function loadGoogleMapsApi({ apiKey, libraries = [] }: GoogleMapsLoaderOptions): Promise<GoogleMapsLike> {
  if (typeof window === "undefined") {
    throw new Error("Google Maps API can only be loaded in the browser.");
  }

  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set.");
  }

  if (window.google?.maps) {
    return window.google;
  }

  if (window.__dehGoogleMapsLoaderPromise) {
    return window.__dehGoogleMapsLoaderPromise;
  }

  window.__dehGoogleMapsLoaderPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-maps-loader="deh"]');
    if (existingScript) {
      existingScript.addEventListener(
        "load",
        () => {
          const googleMaps = window.google;
          if (googleMaps?.maps) {
            resolve(googleMaps);
            return;
          }
          reject(new Error("Google Maps script loaded but window.google.maps is unavailable."));
        },
        { once: true },
      );
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Google Maps script.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = buildGoogleMapsScriptSrc(apiKey, libraries);
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = "deh";

    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google);
        return;
      }
      reject(new Error("Google Maps script loaded but window.google.maps is unavailable."));
    };

    script.onerror = () => {
      reject(new Error("Failed to load Google Maps script."));
    };

    document.head.appendChild(script);
  });

  try {
    return await window.__dehGoogleMapsLoaderPromise;
  } catch (error) {
    window.__dehGoogleMapsLoaderPromise = undefined;
    throw error;
  }
}

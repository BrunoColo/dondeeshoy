"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  FAVORITES_STORAGE_KEY,
  FAVORITES_CHANGED_EVENT,
  addFavoriteSlug,
  normalizeFavoriteSlugs,
  removeFavoriteSlug,
  toggleFavoriteSlug,
  writeFavoriteSlugsToStorage,
} from "@/lib/favorites";

const EMPTY_FAVORITES: string[] = [];

let cachedRawFavorites: string | null | undefined;
let cachedFavoritesSnapshot: string[] = EMPTY_FAVORITES;

function subscribe(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== FAVORITES_STORAGE_KEY) return;
    callback();
  };

  const handleFavoritesChanged = () => {
    callback();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(FAVORITES_CHANGED_EVENT, handleFavoritesChanged);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(FAVORITES_CHANGED_EVENT, handleFavoritesChanged);
  };
}

function getSnapshot() {
  if (typeof window === "undefined") {
    return EMPTY_FAVORITES;
  }

  const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
  if (raw === cachedRawFavorites) {
    return cachedFavoritesSnapshot;
  }

  cachedRawFavorites = raw;

  if (!raw) {
    cachedFavoritesSnapshot = EMPTY_FAVORITES;
    return cachedFavoritesSnapshot;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    cachedFavoritesSnapshot = normalizeFavoriteSlugs(parsed);
  } catch {
    cachedFavoritesSnapshot = EMPTY_FAVORITES;
  }

  return cachedFavoritesSnapshot;
}

function getServerSnapshot() {
  return EMPTY_FAVORITES;
}

function subscribeHydration() {
  return () => {};
}

function getHydratedSnapshot() {
  return true;
}

function getHydratedServerSnapshot() {
  return false;
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    getHydratedSnapshot,
    getHydratedServerSnapshot,
  );

  const persist = useCallback((next: string[]) => writeFavoriteSlugsToStorage(next), []);

  const isFavorite = useCallback((slug: string) => favorites.includes(slug.trim().toLowerCase()), [favorites]);

  const addFavorite = useCallback((slug: string) => {
    persist(addFavoriteSlug(favorites, slug));
  }, [favorites, persist]);

  const removeFavorite = useCallback((slug: string) => {
    persist(removeFavoriteSlug(favorites, slug));
  }, [favorites, persist]);

  const toggleFavorite = useCallback((slug: string) => {
    persist(toggleFavoriteSlug(favorites, slug));
  }, [favorites, persist]);

  const clearFavorites = useCallback(() => {
    persist([]);
  }, [persist]);

  return {
    favorites,
    hydrated,
    count: favorites.length,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
    clearFavorites,
  };
}

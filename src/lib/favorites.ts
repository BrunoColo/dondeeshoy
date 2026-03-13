export const FAVORITES_STORAGE_KEY = "dondeeshoy:favorites:v1";
export const FAVORITES_MAX_ITEMS = 500;
export const FAVORITES_CHANGED_EVENT = "dondeeshoy:favorites:changed";

function sanitizeSlug(slug: unknown): string | null {
  if (typeof slug !== "string") return null;
  const trimmed = slug.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed;
}

export function normalizeFavoriteSlugs(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const unique = new Set<string>();

  for (const item of input) {
    const slug = sanitizeSlug(item);
    if (!slug || unique.has(slug)) continue;

    unique.add(slug);
    if (unique.size >= FAVORITES_MAX_ITEMS) break;
  }

  return [...unique];
}

export function readFavoriteSlugsFromStorage(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    return normalizeFavoriteSlugs(parsed);
  } catch {
    return [];
  }
}

export function writeFavoriteSlugsToStorage(slugs: string[]): string[] {
  if (typeof window === "undefined") return normalizeFavoriteSlugs(slugs);

  const normalized = normalizeFavoriteSlugs(slugs);
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(FAVORITES_CHANGED_EVENT, { detail: normalized }));
  return normalized;
}

export function addFavoriteSlug(current: string[], slug: string): string[] {
  const safeSlug = sanitizeSlug(slug);
  if (!safeSlug) return normalizeFavoriteSlugs(current);

  if (current.includes(safeSlug)) return normalizeFavoriteSlugs(current);
  return normalizeFavoriteSlugs([safeSlug, ...current]);
}

export function removeFavoriteSlug(current: string[], slug: string): string[] {
  const safeSlug = sanitizeSlug(slug);
  if (!safeSlug) return normalizeFavoriteSlugs(current);

  return normalizeFavoriteSlugs(current.filter((value) => value !== safeSlug));
}

export function toggleFavoriteSlug(current: string[], slug: string): string[] {
  const safeSlug = sanitizeSlug(slug);
  if (!safeSlug) return normalizeFavoriteSlugs(current);

  if (current.includes(safeSlug)) {
    return removeFavoriteSlug(current, safeSlug);
  }

  return addFavoriteSlug(current, safeSlug);
}

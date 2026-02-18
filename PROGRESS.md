# ¿Dónde es Hoy? — PROGRESS (Plan Maestro v2)

> Tracker operativo del Plan Maestro v2 (18/02/2026).
> Cada ítem referencia el número del plan. Marcar ✅ al completar.

---

## Estado General

- **Fecha de corte:** 18/02/2026
- **Fase activa:** Plan Maestro v2 — ejecución por prioridad
- **Estado global:** ��� Iniciando
- **Referencia:** Ver `PLAN.md` para descripción completa de cada ítem

---

## Base Consolidada (pre-v2)

Lo siguiente ya estaba funcionando antes de este plan y no se re-trackea:

- ✅ Scraping multi-fuente (`redtickets`, `entraste`, `cartelera`, `mvd_eventos`, `ticketfacil`, `cobraticket`)
- ✅ Pipeline base (normalización, geocoder, dedup, clasificación heurística + AI fallback)
- ✅ Frontend funcional (`/`, `/proximos`, `/evento/[slug]`, `/mapa`)
- ✅ Filtros por tipo, departamento y búsqueda de texto
- ✅ Filtro temporal (Mañana / Este finde) en `/proximos`
- ✅ Compartir evento (Web Share API + WhatsApp)
- ✅ Mini-mapa Leaflet en detalle de evento
- ✅ "Cerca de mí" — ordenar por distancia
- ✅ Mapa principal con Leaflet + OSM (sin Mapbox)
- ✅ Cron jobs de scraping en Vercel
- ✅ Redis locking para evitar scrapes concurrentes
- ✅ JSON-LD y metadata básica

---

## CRÍTICO

| # | Ítem | Dificultad | Estado | Notas |
|---|------|-----------|--------|-------|
| 1 | Geolocation bloqueada por `Permissions-Policy` header | 1/5 | ⬜ | `next.config.ts` → `geolocation=(self)` |
| 2 | Branding desactualizado ("nightlife Montevideo") | 1/5 | ⬜ | `manifest.ts`, `empty-state.tsx`, `not-found.tsx` |

---

## UI / Responsiveness

| # | Ítem | Dificultad | Estado | Notas |
|---|------|-----------|--------|-------|
| 3 | Sidebar desktop con contenido útil | 3/5 | ⬜ | `max-w-7xl` + `grid lg:grid-cols-[1fr_300px]` |
| 4 | Clase CSS `scrollbar-none` en globals.css | 1/5 | ⬜ | Usada pero nunca definida |
| 5 | Search input responsive en mobile | 1/5 | ⬜ | `w-[130px]` → `flex-1 min-w-0` |
| 6 | Event detail — layout 2 columnas en desktop | 3/5 | ⬜ | Grid `md:grid-cols-2` |
| 7 | Event detail — `pb-32` condicional | 1/5 | ⬜ | Solo si hay `ticketUrl` |
| 8 | Map page — sidebar con lista en desktop | 4/5 | ⬜ | Estilo Google Maps en `lg:` |
| 9 | Card animations stagger — extender a 20+ | 1/5 | ⬜ | `globals.css` nth-child delays |

---

## Clasificador AI / Categoría "Otros"

| # | Ítem | Dificultad | Estado | Notas |
|---|------|-----------|--------|-------|
| 10 | Expandir keywords del clasificador | 2/5 | ⬜ | Stand-up, yoga, tango, libros, galas, bingo |
| 11 | Aumentar budget AI classification | 1/5 | ⬜ | `AI_CLASSIFICATION_MAX_PER_BATCH` → 25-30 |
| 12 | Agregar géneros faltantes | 2/5 | ⬜ | Folklore, salsa, reggae, tango |
| 13 | Cron de reclasificación de "otros" | 3/5 | ⬜ | Endpoint API + cron en `vercel.json` |
| 14 | Chips de género en la UI | 2/5 | ⬜ | Tercera fila en `event-filters.tsx` |

---

## Nuevas Features

| # | Ítem | Dificultad | Estado | Notas |
|---|------|-----------|--------|-------|
| 15 | Favoritos / Guardar eventos | 3/5 | ⬜ | `localStorage`, corazón en cards, `/favoritos` |
| 16 | Sitemap.xml dinámico | 2/5 | ⬜ | `src/app/sitemap.ts` |
| 17 | robots.txt | 1/5 | ⬜ | `src/app/robots.ts` |
| 18 | PWA icons | 1/5 | ⬜ | 192x192 y 512x512 en `public/` |
| 19 | Open Graph image por defecto | 2/5 | ⬜ | `next/og` o imagen estática |
| 20 | Marcar eventos pasados automáticamente | 3/5 | ⬜ | Cron → `status: 'past'` |
| 21 | Notificaciones push para favoritos | 5/5 | ⬜ | Service Worker + Push API (avanzado) |
| 22 | Compartir con imagen rica (OG dinámica) | 3/5 | ⬜ | `next/og` ImageResponse por evento |
| 23 | Vista de calendario | 4/5 | ⬜ | Alternativa a lista en `/proximos` |
| 24 | Exportar a Google/Apple Calendar | 2/5 | ⬜ | `.ics` o link `calendar.google.com` |
| 25 | Dedup de views con sesión | 2/5 | ⬜ | `sessionStorage` en `view-tracker.tsx` |

---

## Monetización

| # | Ítem | Dificultad | Estado | Notas |
|---|------|-----------|--------|-------|
| 26 | Eventos destacados / Promoted | 3/5 | ⬜ | Campo `promoted` + badge dorado |
| 27 | Banner ads en sidebar desktop | 2/5 | ⬜ | Depende de #3 (sidebar) |
| 28 | Affiliate links en tickets | 2/5 | ⬜ | Negociar con RedTickets, Ticketfácil |
| 29 | "Publicá tu evento" — formulario | 4/5 | ⬜ | Página `/publicar` con review |
| 30 | Newsletter semanal | 3/5 | ⬜ | Captura de email + envío semanal |
| 31 | Partnerships con venues | 2/5 | ⬜ | Páginas de venue con perfil verificado |

---

## Limpieza / Dead Code

| # | Ítem | Dificultad | Estado | Notas |
|---|------|-----------|--------|-------|
| 32 | Borrar archivos muertos | 1/5 | ⬜ | `navigation.ts`, `api.ts`, `admin.ts`, route placeholder, CSS Mapbox |
| 33 | Consolidar NAV_ITEMS | 1/5 | ⬜ | Usar `config/navigation.ts` como source of truth |
| 34 | Limpiar scripts de debug | 1/5 | ⬜ | Mover a `scripts/debug/` o borrar |
| 35 | Reducir `listColumns` en queries | 1/5 | ⬜ | Quitar `description` del select de lista |
| 36 | Tabla `venues` sin usar | 1/5 | ⬜ | Implementar relación o borrar schema |

---

## Performance

| # | Ítem | Dificultad | Estado | Notas |
|---|------|-----------|--------|-------|
| 37 | NeonParallax condicional | 2/5 | ⬜ | No renderizar en `/mapa` |
| 38 | Reducir blur/noise en mobile | 2/5 | ⬜ | `prefers-reduced-motion` |
| 39 | ISR más corto | 1/5 | ⬜ | 3600s → 300-600s |
| 40 | Agregar `loading.tsx` a las rutas | 2/5 | ⬜ | Skeletons en App Router |

---

## Accesibilidad

| # | Ítem | Dificultad | Estado | Notas |
|---|------|-----------|--------|-------|
| 41 | `aria-pressed` en filtros | 1/5 | ⬜ | `event-filters.tsx` |
| 42 | Alt text en imágenes de cards | 1/5 | ⬜ | `alt=""` → `alt={event.name}` |
| 43 | Skip-to-content link | 1/5 | ⬜ | Link invisible con focus |
| 44 | Contraste de `text-muted` | 1/5 | ⬜ | `#475569` → `#64748b` |

---

## SEO

| # | Ítem | Dificultad | Estado | Notas |
|---|------|-----------|--------|-------|
| 45 | Canonical URLs en eventos | 1/5 | ⬜ | `alternates.canonical` |
| 46 | Geo meta tags | 1/5 | ⬜ | `geo.region`, `geo.placename` |
| 47 | JSON-LD `startDate` fallback | 1/5 | ⬜ | `T20:00:00` → omitir o `T00:00:00` |
| 48 | Richer `og:description` en eventos | 1/5 | ⬜ | Incluir precio, tipo, descripción |

---

## Progreso Global

```
Completados:  0 / 48
En progreso:  0 / 48
Pendientes:  48 / 48
```

---

## Orden de Ejecución Sugerido

1. ��� **Críticos primero** — #1, #2 (bugs que rompen features en producción)
2. ��� **Quick wins dificultad 1/5** — #4, #5, #7, #9, #11, #17, #39, #41, #42, #43, #44, #45, #46, #47, #48
3. ��� **Limpieza** — #32, #33, #34, #35 (reduce deuda técnica)
4. ��� **Features de impacto medio** — #10, #12, #14, #16, #19, #24, #25
5. ��� **Features grandes** — #3, #6, #8, #15, #20, #22, #26
6. ⚪ **Monetización y features avanzadas** — #13, #21, #23, #27-#31

---

**Última actualización:** 18/02/2026
**Plan de referencia:** `PLAN.md`

# Plan de Trabajo — ¿Dónde es Hoy?

> Enfoque: retención en días vacíos + seguridad. Sin cuentas de usuario.

---

## ✅ IMPLEMENTADO

### Fase 1 — Homepage: "Lo mejor del finde" (Mon-Thu)

| # | Tarea | Estado |
|---|-------|--------|
| 1.1 | Query `getWeekendHighlights()` + `getWeekendEventCount()` en `queries.ts` | ✅ |
| 1.2 | Helper `getDayOfWeekUY()` en `format.ts` | ✅ |
| 1.3 | Componente `WeekendPreview` en `components/events/weekend-preview.tsx` | ✅ |
| 1.4 | Wiring en `page.tsx` (fetch paralelo) y `home-events-client.tsx` (entre únicos y recurrentes) | ✅ |

Lógica: si `dayOfWeek` es 1-4 (lunes a jueves), muestra sección violeta/indigo con top 6 eventos no-recurrentes del fin de semana rankeados por `rankingScore`. CTA a `/proximos?when=finde` si hay más.

### Fase 4 — Seguridad

| # | Tarea | Estado | Detalle |
|---|-------|--------|---------|
| 4.1 | Redactar errores en pipeline | ✅ | `error.message.slice(0,500)` en vez de `String(error)` |
| 4.2 | Genericizar error en admin review | ✅ | Mensaje genérico, error real solo en `console.error` |
| 4.3 | Escapar HTML en emails | ✅ | `escapeHtml()` en `email.ts` y `subscription-emails.ts` |
| 4.4 | Escapar wildcards LIKE | ✅ | `escapeLikePattern()` en `queries.ts` y admin subscriptions |
| 4.5 | CSRF en admin | ✅ mitigado | SameSite=strict ya previene CSRF cross-origin. Admin es single-user, no requiere double-submit cookie |
| 4.6 | Auditar dependencias | ✅ | `npm audit --omit=dev` → 0 vulnerabilities |

Funciones utilitarias agregadas en `src/lib/utils.ts`: `escapeHtml()`, `escapeLikePattern()`.

### Mejora de búsqueda

| # | Tarea | Estado |
|---|-------|--------|
| S.1 | Search bar más ancho en desktop | ✅ | `w-[260px] lg:w-[340px] xl:w-[400px]` |

---

## PENDIENTE

### Retención — Mejoras de contenido

| # | Tarea | Descripción | Prioridad |
|---|-------|-------------|-----------|
| R.1 | Empty state mejorado con CTAs | Cuando hay 0-3 eventos únicos, mostrar acciones: mapa, finde, newsletter | Alta |
| R.2 | Agrupar recurrentes por categoría en días vacíos | Sub-headers por tipo (museos, parques, etc.) cuando <5 únicos | Media |
| R.3 | Planificá tu semana (preview semanal) | Timeline horizontal con conteo y top 3 por día, próximos 7 días | Media |

### Buscador

| # | Tarea | Descripción | Prioridad |
|---|-------|-------------|-----------|
| B.1 | Autocomplete / typeahead | Sugerencias instantáneas al escribir, debounce 300ms, dropdown glassmorphism | Alta |
| B.2 | Filtros avanzados en resultados | Tipo, departamento, gratis, fecha — en la vista actual de búsqueda | Media |

> Decisión: NO crear página `/buscar` separada. Mejorar el buscador existente integrado en el header.

### Backlog general

| # | Tarea | Descripción |
|---|-------|-------------|
| G.1 | Compartir en WhatsApp | Deep link `wa.me/?text=...` en share button |
| G.2 | Exportar a calendario (.ics) | Endpoint `/api/events/[slug]/ical` + botón en detalle |
| G.3 | Eventos relacionados en detalle | "También te puede interesar" con 4 eventos del mismo tipo/departamento |
| G.4 | Sitemap con paginación | Sitemap index con chunks para +500 eventos |
| G.5 | UPSERT no resetee rechazados | Columna `permanently_rejected` + UPSERT condicional |
| G.6 | Scraper health monitoring | Alertas + dashboard de estado de scrapers |

---

## Decisiones

- **Sin cuentas de usuario**: retención vía contenido dinámico y newsletter por email.
- **No crear `/buscar`**: mejorar el buscador del header, evitar secciones redundantes.
- **Weekend preview entre únicos y recurrentes**: los recurrentes son muchos y el usuario no scrollea hasta abajo.
- **Seguridad actual es fuerte**: 30+ buenas prácticas, 0 issues críticos, 0 dependencias vulnerables.
- **No instalar librerías de UI**: todo con Tailwind v4 + componentes propios.

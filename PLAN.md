# ¿Dónde es Hoy? — Plan Maestro v2

> Fecha: 18 de febrero de 2026
> Autor del plan: Claude Opus
> TL;DR — El proyecto está sólido en funcionalidad base pero tiene dead code, bugs críticos (geolocation bloqueada por headers), el clasificador AI apenas funciona para eventos edge-case, el layout desperdicia espacio en desktop, y no hay monetización ni SEO básico. Este plan cubre 40+ mejoras organizadas por prioridad y dificultad.

---

## Resumen por Dificultad

| Dificultad | Ítems |
|---|---|
| 1/5 (< 30 min) | #1, #2, #4, #5, #7, #9, #11, #17, #18, #32, #33, #34, #35, #36, #39, #41, #42, #43, #44, #45, #46, #47, #48 |
| 2/5 (1-3 horas) | #10, #12, #14, #16, #19, #24, #25, #27, #28, #31, #37, #38, #40 |
| 3/5 (3-8 horas) | #3, #6, #13, #15, #20, #22, #26, #30 |
| 4/5 (1-2 días) | #8, #23, #29 |
| 5/5 (3+ días) | #21 |

---

## CRÍTICO — Arreglar YA

### #1 — Geolocation bloqueada por security headers `[Dificultad: 1/5]`

En `next.config.ts`, el header `Permissions-Policy: geolocation=()` bloquea completamente la geolocalización del browser. "Cerca de mí" está roto en producción. Cambiar a `geolocation=(self)`.

### #2 — Branding desactualizado — sigue diciendo "nightlife Montevideo" `[Dificultad: 1/5]`

- `manifest.ts` dice "Eventos nightlife en Montevideo"
- `empty-state.tsx` dice "Parece que hoy Montevideo descansa"
- `not-found.tsx` dice "qué hay esta noche"

Actualizar todo a "eventos en Uruguay" / "¿Dónde es Hoy?".

---

## UI / RESPONSIVENESS

### #3 — Sidebar en desktop con contenido útil `[Dificultad: 3/5]`

Actualmente todo está en `max-w-5xl` (1024px), dejando ~200px vacíos por lado en pantallas 1440px+. Opciones para ese espacio:
- Sidebar derecho fijo en `lg:` con: filtros verticales, trending events, "Próximos eventos cerca tuyo", o espacio de sponsor/ad
- Cambiar layout de `(main)/layout.tsx` a `max-w-7xl` con `grid lg:grid-cols-[1fr_300px]`
- En mobile se colapsa y los filtros quedan como están (chips horizontales)

### #4 — Agregar clase CSS `scrollbar-none` `[Dificultad: 1/5]`

Usada en `event-filters.tsx`, `time-filter.tsx` pero nunca definida en `globals.css`. Las filas de filtros muestran scrollbar feo en algunos browsers. Agregar:

```css
.scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
.scrollbar-none::-webkit-scrollbar { display: none; }
```

### #5 — Search input responsive en mobile `[Dificultad: 1/5]`

En `header.tsx`, el input tiene `w-[130px]` hardcodeado. En pantallas de 320px queda apretado. Cambiar a `flex-1` con `min-w-0` cuando está expandido.

### #6 — Event detail — layout 2 columnas en desktop `[Dificultad: 3/5]`

En `evento/[slug]/page.tsx`, actualmente es full-width single column. En `md:` y arriba, usar grid de 2 columnas: imagen+info izquierda, mapa+tickets derecha.

### #7 — Event detail — `pb-32` condicional `[Dificultad: 1/5]`

`event-detail.tsx` siempre aplica `pb-32` (128px de padding inferior). Solo debería aplicarse cuando hay `ticketUrl` (el botón CTA flotante). Sin ticket → `pb-8` normal.

### #8 — Map page — sidebar con lista en desktop `[Dificultad: 4/5]`

En `mapa/page.tsx`, en `lg:` mostrar un panel lateral scrolleable con la lista de eventos al lado del mapa (estilo Google Maps). En mobile queda solo el mapa.

### #9 — Card animations stagger — extender a 20+ `[Dificultad: 1/5]`

En `globals.css`, solo hay 10 `nth-child` delays para `.card-animate`. Los eventos del 11 en adelante se animan todos al mismo tiempo. Extender a 20 o usar CSS custom property con `calc()`.

---

## CLASIFICADOR AI / CATEGORÍA "OTROS"

### #10 — Expandir keywords del clasificador `[Dificultad: 2/5]`

En `classifier.ts`, agregar patrones faltantes:
- Stand-up/humor: `stand.?up`, `humor`, `monologuista`, `impro`, `improvisación`, `comedy`
- Yoga/bienestar: `yoga`, `pilates`, `crossfit`, `fitness`, `wellness`, `bienestar`
- Tango/folklore: `milonga`, `tango`, `murga`, `candombe`, `folklore`, `chamam[eé]`
- Libros: `presentaci[oó]n de libro`, `firma de libros`, `lanzamiento editorial`
- Galas: `gala`, `premiaci[oó]n`, `ceremonia`
- Bingo/social: `bingo`, `loter[ií]a`, `rifa`

Incorporar en las categorías existentes más cercanas (cultural para libros, taller para yoga, etc.)

### #11 — Aumentar budget de AI classification `[Dificultad: 1/5]`

En `pipeline.ts`, `AI_CLASSIFICATION_MAX_PER_BATCH` es 10. Si un batch tiene 50 eventos y 20 caen a "otro", solo 10 se reclasifican con AI. Subir a 25-30.

### #12 — Agregar géneros faltantes `[Dificultad: 2/5]`

Géneros que faltan: folklore/candombe/murga, salsa/bachata/latina, reggae/ska, tango. Actualizar las regex de géneros en `classifier.ts`.

### #13 — Cron de reclasificación de "otros" `[Dificultad: 3/5]`

El script `reclassify-otros.mjs` existe pero no corre automáticamente. Crear un endpoint API + cron job en `vercel.json` que reclasifique eventos "otro" periódicamente con AI.

### #14 — Agregar chips de género en la UI `[Dificultad: 2/5]`

`event-filters.tsx` acepta `availableGenres` como prop pero nunca renderiza los chips de género. Agregar una tercera fila de chips para filtrar por género musical.

---

## NUEVAS FEATURES

### #15 — Favoritos / Guardar eventos `[Dificultad: 3/5]`

Sin necesidad de auth: guardar favoritos en `localStorage`. Ícono de corazón en cada card. Página `/favoritos` o sección en sidebar.
- Funciona offline, persiste entre sesiones.

### #16 — Sitemap.xml dinámico `[Dificultad: 2/5]`

Crear `src/app/sitemap.ts` que genere URLs para todos los eventos activos. Crucial para SEO.

### #17 — robots.txt `[Dificultad: 1/5]`

Crear `src/app/robots.ts` con directivas básicas de crawling.

### #18 — PWA icons `[Dificultad: 1/5]`

`manifest.ts` no tiene iconos definidos. Agregar iconos 192x192 y 512x512 en `public/` para "Add to Home Screen".

### #19 — Open Graph image por defecto `[Dificultad: 2/5]`

En `layout.tsx` no hay `og:image`. Crear una imagen OG estática o dinámica con `next/og` para que los shares en redes sociales se vean bien.

### #20 — Marcar eventos pasados automáticamente `[Dificultad: 3/5]`

Listado en PROGRESS.md como pendiente. Crear un cron que marque `status: 'past'` en eventos cuya fecha ya pasó. Evitar mostrar eventos viejos.

### #21 — Notificaciones push para favoritos `[Dificultad: 5/5]`

"Tu evento guardado empieza en 1 hora". Requiere Service Worker, API de Push Notifications, y backend para enviar. Feature avanzada.

### #22 — Compartir con imagen rica `[Dificultad: 3/5]`

Generar OG images dinámicas por evento usando `next/og` (ImageResponse API). Cada evento tendría su propia card visual al compartir en WhatsApp/Instagram.

### #23 — Vista de calendario `[Dificultad: 4/5]`

Agregar vista calendario mensual/semanal como alternativa a la lista en `/proximos`. Mostrar dots por día con eventos.

### #24 — "Exportar a Google Calendar / Apple Calendar" `[Dificultad: 2/5]`

Botón en event detail que genere un `.ics` file o link `calendar.google.com/calendar/render?...` para agregar el evento al calendario personal.

### #25 — Dedup de views con sesión `[Dificultad: 2/5]`

`view-tracker.tsx` no tiene dedup. Refrescar la página 100 veces = 100 views. Usar cookie o `sessionStorage` para contar max 1 view por sesión por evento.

---

## MONETIZACIÓN

### #26 — Eventos destacados / Promoted events `[Dificultad: 3/5]`

Modelo: organizadores pagan para que su evento aparezca primero, con badge "Destacado", borde dorado, y posición fija arriba del grid.
- Agregar campo `promoted: boolean` y `promotedUntil: date` al schema de eventos.
- Panel admin básico o formulario de contacto para contratar.

### #27 — Banner ads en sidebar desktop `[Dificultad: 2/5]`

El espacio lateral que sobra en desktop (punto #3) es perfecto para ads. Opciones:
- Google AdSense
- Ads directos de venues/productoras uruguayas (más $, menos molesto)
- Affiliate links a ticket sellers (comisión por venta)

### #28 — Affiliate links en tickets `[Dificultad: 2/5]`

Los botones "Comprar entradas" ya llevan a RedTickets, Ticketfácil, etc. Negociar programa de afiliados con estas plataformas para ganar comisión por click/venta.

### #29 — "Publicá tu evento" — formulario de submit `[Dificultad: 4/5]`

Crear página `/publicar` donde organizadores independientes suban su evento manualmente (con review). Versión gratis = evento normal, versión paga = promoted.

### #30 — Newsletter semanal `[Dificultad: 3/5]`

"Los mejores eventos de esta semana" por email. Capturar emails con un CTA en la home. Monetizable con sponsors en el email.

### #31 — Partnerships con venues `[Dificultad: 2/5]`

Páginas de venue con branding propio, logo, info de contacto, todos sus eventos listados. Cobrar suscripción mensual a venues por "perfil verificado".

---

## LIMPIEZA / DEAD CODE

### #32 — Borrar archivos muertos `[Dificultad: 1/5]`

- `navigation.ts` — nunca importado, header y bottom-nav definen NAV_ITEMS inline
- `api.ts` — `ApiResponse<T>` nunca usado
- `admin.ts` — `getSupabaseAdmin()` nunca referenciado
- `src/app/api/events/[id]/route.ts` — placeholder que retorna string estático
- CSS de Mapbox en `globals.css` (`.mapboxgl-popup-content`) — migrado a Leaflet

### #33 — Consolidar NAV_ITEMS `[Dificultad: 1/5]`

`header.tsx` y `bottom-nav.tsx` definen arrays de navegación duplicados. Usar el ya existente `config/navigation.ts` como single source of truth (en vez de borrarlo, usarlo).

### #34 — Limpiar scripts de debug `[Dificultad: 1/5]`

Scripts como `check-cities.mjs`, `check-edge-cases.mjs`, `test-ticketfacil-raw.mjs` son herramientas de debugging one-off. Mover a carpeta `scripts/debug/` o borrar.

### #35 — Reducir `listColumns` en queries `[Dificultad: 1/5]`

`queries.ts` selecciona `description`, `ticketUrl`, `venueAddress`, `latitude`, `longitude` para la lista de cards, pero las cards nunca muestran `description`. Remover campos innecesarios para reducir payload JSON.

### #36 — Tabla `venues` sin usar `[Dificultad: 1/5]`

El schema define una tabla `venues` pero los eventos embeben venue data directamente. Decidir: implementar la relación o borrar el schema.

---

## PERFORMANCE

### #37 — NeonParallax condicional `[Dificultad: 2/5]`

`layout.tsx` renderiza 2 `motion.div` full-viewport en todas las páginas, incluyendo el mapa donde están tapados. Lazy-load o no renderizar en `/mapa`.

### #38 — Reducir blur/noise en mobile `[Dificultad: 2/5]`

`globals.css` tiene `body::before` con SVG noise filter y `body::after` con `blur(90px)` animado. Esto puede ser pesado en móviles gama baja. Simplificar o desactivar en `prefers-reduced-motion`.

### #39 — ISR más corto `[Dificultad: 1/5]`

Home y Próximos revalidan cada 3600s (1 hora). Para una plataforma de "hoy", un evento nuevo tarda hasta 1 hora en aparecer. Bajar a 300-600s.

### #40 — Agregar `loading.tsx` a las rutas `[Dificultad: 2/5]`

No hay archivos `loading.tsx` en las rutas del App Router. Agregar skeletons instantáneos para mejorar perceived performance durante navegación.

---

## ACCESIBILIDAD

### #41 — `aria-pressed` en filtros `[Dificultad: 1/5]`

Los botones de filtro en `event-filters.tsx` no comunican estado a screen readers. Agregar `aria-pressed={isActive}`.

### #42 — Alt text en imágenes de cards `[Dificultad: 1/5]`

`event-card.tsx` usa `alt=""` en las imágenes. Cambiar a `alt={event.name}`.

### #43 — Skip-to-content link `[Dificultad: 1/5]`

No existe. Agregar link invisible que aparece con focus para keyboard navigation.

### #44 — Contraste de `text-muted` `[Dificultad: 1/5]`

`--text-muted` (`#475569`) sobre fondo `#06060C` da ratio ~3.9:1, por debajo del mínimo WCAG AA (4.5:1). Subir a ~`#64748b`.

---

## SEO

### #45 — Canonical URLs en eventos `[Dificultad: 1/5]`

Páginas de eventos no setean `alternates.canonical`. Agregar para evitar contenido duplicado.

### #46 — Geo meta tags `[Dificultad: 1/5]`

Agregar `<meta name="geo.region" content="UY">` y `geo.placename` para mejorar búsqueda local.

### #47 — JSON-LD `startDate` fallback `[Dificultad: 1/5]`

En `evento/[slug]/page.tsx`, cuando no hay hora, el fallback es `T20:00:00`. Para eventos diurnos esto es incorrecto. Omitir el componente de hora o usar `T00:00:00`.

### #48 — Richer `og:description` en eventos `[Dificultad: 1/5]`

Actualmente es "Nombre en Venue — fecha". Incluir precio, tipo, y primera línea de descripción.

---

## Decisiones Tomadas

- Sidebar desktop > ads genéricos (mejor UX y monetizable)
- Favoritos en localStorage > auth obligatoria (barrera de entrada cero)
- Expandir clasificador regex primero > depender 100% de AI (más barato y predecible)
- `max-w-7xl` con sidebar > mantener `max-w-5xl` centrado (aprovecha espacio)

## Verificación Post-Implementación

Después de cada grupo de cambios:
1. Correr `npm run build` para verificar que no hay errores de TypeScript.
2. Testear en Chrome DevTools con device toolbar (320px, 375px, 768px, 1024px, 1440px).
3. Verificar Lighthouse scores (Performance, SEO, Accessibility).
4. Para el clasificador: correr `reclassify-otros.mjs` sobre datos reales y medir reducción de % de "otros".

---

**Última actualización:** 18 de febrero de 2026

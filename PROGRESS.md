# ¿Dónde es Hoy? — Tracking de Avances

> Documento vivo para trackear el progreso del proyecto.
> Actualizar después de cada sesión de trabajo.

---

## Estado General

| Métrica | Valor |
|---------|-------|
| **Fase actual** | Fase 4 — Polish + Launch |
| **Inicio del proyecto** | 8 de febrero de 2026 |
| **Último update** | 17 de febrero de 2026 (Bug fixes + diseño vibrante) |
| **MVP estimado** | 15-21 días de desarrollo |
| **Gasto mensual actual** | $0 |

---

## Servicios Configurados

| Servicio | Estado | Plan | Costo |
|----------|--------|------|-------|
| Vercel | ⬜ Pendiente | Hobby (free) | $0 |
| Supabase | ✅ Listo | Free (solo DB, sin Auth/Storage) | $0 |
| Upstash Redis | ✅ Listo | Free | $0 |
| OpenAI API | ✅ Listo | Pay-as-you-go | ~$1-3/mes est. |
| Dominio | ⬜ Pendiente | Opcional | $0-30/año |
| **TOTAL** | | | **~$1-3/mes** |

> Leyenda: ⬜ Pendiente | 🟡 En progreso | ✅ Listo | ❌ Bloqueado

---

## Fase 0 — Setup (Est: 2-3 días)

| # | Tarea | Estado | Fecha | Notas |
|---|-------|--------|-------|-------|
| 0.1 | Crear proyecto Next.js 16.1 + TS + Tailwind v4 | ✅ | 16/2/2026 | Inicializado en raíz del repo |
| 0.2 | Configurar shadcn/ui con tema dark custom | ⬜ | | Próximo bloque |
| 0.3 | Crear proyecto en Supabase (solo DB) | ✅ | 16/2/2026 | Proyecto creado y URI pooler configurada |
| 0.4 | Configurar Drizzle ORM + conexión a Supabase PG | 🟡 | 16/2/2026 | Config base lista (`drizzle.config.ts`, `src/lib/db`) |
| 0.5 | Crear schema inicial de DB | ✅ | 16/2/2026 | `raw_events`, `events`, `event_sources` + enums |
| 0.6 | Push schema con `drizzle-kit push` | ✅ | 16/2/2026 | Migración aplicada con Session Pooler |
| 0.7 | Crear instancia Upstash Redis | ✅ | 16/2/2026 | Credenciales cargadas en `.env` |
| 0.8 | Deploy inicial a Vercel | ⬜ | | Acción manual pendiente |
| 0.9 | Configurar env vars en Vercel | ⬜ | | Después de 0.8 |
| 0.10 | Crear `.env.example` con todas las variables | ✅ | 16/2/2026 | Incluye placeholders MVP |
| 0.11 | Estructura de carpetas base | ✅ | 16/2/2026 | Creada estructura de `src/` según plan |

---

## Fase 1 — Scrapers MVP (Est: 3-4 días)

| # | Tarea | Estado | Fecha | Notas |
|---|-------|--------|-------|-------|
| 1.1 | `base-scraper.ts` — interfaz + helpers | ✅ | 16/2/2026 | Run loop + upsert a `raw_events` |
| 1.2 | `scrapers/utils.ts` — parseo fechas español | ✅ | 16/2/2026 | Corregido: extractMoneyValues sin ×100, filter amount>0 |
| 1.3 | Scraper RedTickets — discover | ✅ | 16/2/2026 | Discovery por links `/evento/.../{id}` |
| 1.4 | Scraper RedTickets — scrape detalle | ✅ | 16/2/2026 | Extrae título, fecha, venue, imagen y precios |
| 1.5 | API route `/api/scrape/redtickets` | ✅ | 16/2/2026 | Con `CRON_SECRET` y ejecución real |
| 1.6 | **TEST**: ejecutar RedTickets → ver raw_events | ✅ | 16/2/2026 | 31 descubiertos / 31 guardados / 0 errores |
| 1.7 | Scraper Entraste.com — discover | ✅ | 16/2/2026 | Discovery por links `/evento/{slug}` |
| 1.8 | Scraper Entraste.com — scrape detalle | ✅ | 16/2/2026 | Extrae nombre, venue, ubicación, fecha, imagen y precios |
| 1.9 | API route `/api/scrape/entraste` | ✅ | 16/2/2026 | Con `CRON_SECRET` y ejecución real |
| 1.10 | **TEST**: ejecutar Entraste → ver raw_events | ✅ | 16/2/2026 | 10 descubiertos / 10 guardados / 0 errores |
| 1.11 | Configurar `vercel.json` con cron jobs | ✅ | 16/2/2026 | 3 crons configurados |
| 1.12 | **TEST**: verificar cron ejecutó en Vercel | ⬜ | | Dashboard → Cron Jobs |

---

## Fase 2 — Pipeline IA (Est: 3-4 días)

| # | Tarea | Estado | Fecha | Notas |
|---|-------|--------|-------|-------|
| 2.1 | `normalizer.ts` — regex para fechas UY | ✅ | 16/2/2026 | Parsea día/mes/hora a formato SQL |
| 2.2 | `normalizer.ts` — fallback OpenAI para ambiguos | ✅ | 16/2/2026 | Fallback con `gpt-4o-mini` y JSON output |
| 2.3 | `geocoder.ts` — lookup table venues conocidos | ✅ | 16/2/2026 | Lookup local de venues frecuentes |
| 2.4 | `geocoder.ts` — fallback Mapbox geocoding | 🟡 | 16/2/2026 | Implementado, falta token Mapbox para activarlo |
| 2.5 | `deduplicator.ts` — fuzzy match | ✅ | 16/2/2026 | Similaridad por bigramas (name/venue) |
| 2.6 | `classifier.ts` — clasificar tipo + género | ✅ | 16/2/2026 | Heurístico por keywords + isFree corregido |
| 2.7 | `pipeline.ts` — orquestador completo | ✅ | 16/2/2026 | Upsert/merge y vínculo en `event_sources` |
| 2.8 | API route `/api/scrape/process` | ✅ | 16/2/2026 | Endpoint operativo con `batch` param |
| 2.9 | **TEST E2E**: raw_events → pipeline → events | ✅ | 16/2/2026 | `pending:10`, `processed:10`, `merged:10`, `errors:0` |
| 2.10 | Verificar costos OpenAI reales | 🟡 | 16/2/2026 | Fallback IA activo, medir uso real en dashboard |

---

## Fase 3 — Frontend MVP (Est: 5-7 días)

| # | Tarea | Estado | Fecha | Notas |
|---|-------|--------|-------|-------|
| 3.1 | Root layout: fonts, theme, CSS neón, providers | ✅ | 16/2/2026 | Outfit + DM Sans + DM Mono (innovación vs plan original) |
| 3.2 | `globals.css` — custom utilities neón/glow/glass | ✅ | 16/2/2026 | Noise texture, ambient gradients, glassmorphism, shimmer, badges |
| 3.3 | Bottom navigation component | ✅ | 16/2/2026 | 2 tabs: Hoy / Próximos con glass + active glow |
| 3.4 | Header sticky | ✅ | 16/2/2026 | Logo + ciudad con glass + scroll-aware |
| 3.5 | Event card component (glassmorphism) | ✅ | 17/2/2026 | Cards con imagen hero overlay + fallback gradiente por tipo + card-glow hover |
| 3.6 | Time badge ("AHORA", "En 2h") | ✅ | 16/2/2026 | Badge live-pulse, soon (amber), later |
| 3.7 | Event type badge (colores neón) | ✅ | 16/2/2026 | 7 tipos con colores únicos + text-shadow glow |
| 3.8 | Home page (server component) | ✅ | 16/2/2026 | SSR con Drizzle, ISR 1h, Suspense + skeleton |
| 3.9 | Event detail page `/evento/[slug]` | ✅ | 16/2/2026 | Hero image, info cards, CTA fijo, metadata dinámica |
| 3.10 | Página "Próximos" | ✅ | 16/2/2026 | Grouped by day, 14 días ahead, ISR 1h |
| 3.11 | Skeleton loaders neón | ✅ | 16/2/2026 | Shimmer con gradiente violeta sutil |
| 3.12 | Empty states con diseño | ✅ | 16/2/2026 | 3 variantes: today, upcoming, search |
| 3.13 | Page transitions con Motion | ✅ | 16/2/2026 | CSS fade-up + blur (card-enter staggered) |
| 3.14 | Responsive: testar en móvil real | 🟡 | | Build compila OK, falta test en dispositivo |
| 3.15 | Responsive grid desktop | ✅ | 17/2/2026 | Grid 1→2→3 columnas, max-w-5xl, header/nav actualizados |
| 3.16 | Broken image fallback | ✅ | 17/2/2026 | Client component con onError, gradiente por tipo de evento |
| 3.17 | Diseño vibrante / llamativo | ✅ | 17/2/2026 | Ambient gradient animado, card-glow hover, badges con text-shadow, gradient logo |

---

## Fase 4 — Polish + Launch (Est: 2-3 días)

| # | Tarea | Estado | Fecha | Notas |
|---|-------|--------|-------|-------|
| 4.1 | SEO: metadata dinámicas por página | ✅ | 16/2/2026 | Metadata en layout, evento detail y próximos |
| 4.2 | OG Image para shares | ⬜ | | |
| 4.3 | Structured data (JSON-LD) para eventos | ⬜ | | |
| 4.4 | ISR: revalidate en home y listados | ⬜ | | |
| 4.5 | Error handling completo | ⬜ | | |
| 4.6 | PWA: manifest.json + Add to Home Screen | ⬜ | | |
| 4.7 | Testing en dispositivos móviles reales | ⬜ | | Android + iOS Safari |
| 4.8 | Lighthouse audit (target: perf>80, a11y>90) | ⬜ | | |
| 4.9 | **🚀 LAUNCH MVP** | ⬜ | | |

---

## Métricas de Costos (actualizar mensualmente)

| Mes | Vercel | Supabase | Upstash | OpenAI | Otros | Total |
|-----|--------|----------|---------|--------|-------|-------|
| Feb 2026 | $0 | $0 | $0 | — | — | $0 |
| Mar 2026 | | | | | | |
| Abr 2026 | | | | | | |

---

## Decisiones Tomadas

| Fecha | Decisión | Motivo |
|-------|----------|--------|
| 8/2/2026 | Instagram scraping → post-MVP | Complejidad alta, bajo ROI para MVP |
| 8/2/2026 | Next.js 16.1 | Última estable, Turbopack, React 19.2 |
| 8/2/2026 | Tailwind v4 + shadcn/ui | Customizable, dark mode nativo |
| 8/2/2026 | Motion (ex Framer Motion) | Declarativo, React 19 compatible |
| 8/2/2026 | TypeScript | Type safety, mejor DX |
| 8/2/2026 | Solo producción al inicio | Simpleza, deploy rápido |
| 8/2/2026 | gpt-4o-mini (no gpt-4o) | 15x más barato, suficiente para clasificar |
| 8/2/2026 | Vercel Hobby (no Pro) | $0, cron 1x/día alcanza para MVP |
| 16/2/2026 | Eliminar Eventbrite y Tickantel | No son fuentes de nightlife. Venden teatro, deportes, etc. |
| 16/2/2026 | Entraste.com como fuente principal | SSR, datos limpios, fiestas nocturnas reales. Fácil con Cheerio |
| 16/2/2026 | MVP sin usuarios | Enfoque en diseño web + scraping. Auth/puntaje/fotos → post-MVP |
| 16/2/2026 | Supabase solo DB en MVP | Sin Auth ni Storage hasta que se implementen features de usuario |
| 16/2/2026 | Passline/CobraTickets → post-MVP | Anti-bot (queue-it.net) y SPA. Necesitan Playwright, no Cheerio |

---

## Bloqueos / Riesgos

| # | Riesgo | Impacto | Mitigación | Estado |
|---|--------|---------|------------|--------|
| 1 | RedTickets cambia estructura HTML | Scraper se rompe | Monitorear errores, schema flexible | ⬜ Abierto |
| 2 | Entraste.com cambia estructura HTML | Scraper se rompe | Monitorear errores, datos bien estructurados hoy | ⬜ Abierto |
| 3 | Supabase free tier se pausa (7d inactivo) | DB offline | Cron job diario mantiene activo | ⬜ Abierto |
| 4 | Vercel cron impreciso (±59min hobby) | Scraping a hora imprecisa | Aceptable para MVP, upgrade a Pro si es problema | ⬜ Abierto |
| 5 | Pocos eventos en 2 fuentes | Home vacía | Agregar fuentes post-MVP (Passline, IG), curación manual temporal | ⬜ Abierto |
| 6 | Passline anti-bot impide scraping | No se pueden agregar eventos de Passline | Post-MVP con Playwright. Investigar APIs internas | ⬜ Abierto |
| 7 | Node.js menor a 20.18.1 | Warnings por `cheerio@1.2.x` | Actualizar Node a 20.18.1+ o 22 LTS | ⬜ Abierto |
| 8 | Credenciales DB inválidas en Supabase | No se puede persistir ni migrar schema | Resuelto usando Session Pooler + password correcta | ✅ Cerrado |
| 9 | Resolución DNS intermitente al pooler | Puede generar fallos transitorios del pipeline (`ENOTFOUND`) | Reintento + revisar DNS/red local | ⬜ Monitorear |
| 10 | Falta token Mapbox en entorno | Geocoder usa solo lookup local | Agregar `NEXT_PUBLIC_MAPBOX_TOKEN` para fallback API | ⬜ Abierto |

---

## Log de Sesiones de Trabajo

### Sesión 1 — 8 de febrero de 2026
- **Duración**: —
- **Qué se hizo**:
  - Investigación completa de fuentes de datos (RedTickets, Tickantel, Eventbrite, FB, IG)
  - Investigación de stack tecnológico (Next.js 16, Drizzle, Supabase, Motion, etc.)
  - Definición de arquitectura completa
  - Creación de PLAN.md y PROGRESS.md
- **Próximo paso**: Comenzar Fase 0 — Setup del proyecto

### Sesión 2 — 16 de febrero de 2026
- **Duración**: —
- **Qué se hizo**:
  - Investigación de nuevas fuentes: Entraste.com (viable ✅), Passline (anti-bot ❌ MVP), CobraTickets (SPA ❌ MVP)
  - Reestructuración completa del plan MVP:
    - Eliminado todo lo de usuarios (auth, asistencia, puntaje, fotos, historial, perfil)
    - Eliminados Eventbrite y Tickantel como fuentes (no son nightlife)
    - Agregado Entraste.com como fuente principal de fiestas nocturnas
    - Documentado scraper detallado de Entraste.com con datos confirmados
    - Passline/CobraTickets documentados como post-MVP (requieren Playwright)
    - Reducido de 5 fases a 4 fases (sin fase de auth)
    - Estimación reducida de 19-26 días a 15-21 días
  - Actualización de PLAN.md y PROGRESS.md
- **Próximo paso**: Comenzar Fase 0 — Setup del proyecto

### Sesión 3 — 16 de febrero de 2026 (Setup técnico inicial)
- **Duración**: —
- **Qué se hizo**:
  - Inicialización real del proyecto con Next.js 16.1 + TypeScript + Tailwind v4
  - Instalación de dependencias MVP: Drizzle, Postgres, Motion, Cheerio, Upstash, OpenAI, Drizzle Kit
  - Creación de estructura base de carpetas (`src/lib`, `src/scrapers`, `src/processing`, `src/config`, `src/types`, `src/app/api/...`)
  - Configuración inicial de DB:
    - `drizzle.config.ts`
    - `src/lib/db/index.ts`
    - `src/lib/db/schema/events.ts`
    - `src/lib/db/schema/venues.ts`
  - Creación de `.env` y `.env.example` con placeholders
  - Creación de stubs API para scrapers/proceso/eventos
  - Configuración de `vercel.json` con 3 cron jobs
  - Home inicial adaptada al proyecto (se removió boilerplate de create-next-app)
  - Validación: `npm run lint` ✅
- **Bloqueos detectados**:
  - `cheerio@1.2.x` requiere Node >= 20.18.1 (entorno actual: 20.14.0) — funciona con warning pero conviene actualizar
- **Próximo paso**:
  - Completar Fase 0 (Supabase + Upstash + `drizzle-kit push`) y luego empezar Fase 1 (`base-scraper.ts` + scraper RedTickets)

### Sesión 4 — 16 de febrero de 2026 (RedTickets v1 + integración)
- **Duración**: —
- **Qué se hizo**:
  - Carga de variables reales en `.env` (OpenAI, Upstash, Supabase, cron secret)
  - Intento de `drizzle-kit push` contra Supabase
  - Implementación del core de scrapers:
    - `src/scrapers/types.ts`
    - `src/scrapers/utils.ts` (rate-limit, retry, fetch HTML, parse money)
    - `src/scrapers/base-scraper.ts` (discover/scrape/save loop con upsert)
  - Implementación de `src/scrapers/redtickets.ts` (discover + scrape)
  - Implementación de `src/scrapers/entraste.ts` (discover + scrape)
  - API route `src/app/api/scrape/redtickets/route.ts` conectada al scraper real
  - API route `src/app/api/scrape/entraste/route.ts` conectada al scraper real
  - Validaciones locales:
    - `npm run lint` ✅
    - `npm run build` ✅
    - Ejecución real de scraping en local ✅ (fallo al persistir por auth DB)
- **Bloqueos detectados**:
  - Supabase responde `password authentication failed for user "postgres"` (`28P01`)
- **Próximo paso**:
  - Corregir credenciales de `DATABASE_URL` y ejecutar `db:push`
  - Con DB operativa, terminar Entraste y testear `raw_events`

### Sesión 5 — 16 de febrero de 2026 (Desbloqueo DB + E2E scrapers)
- **Duración**: —
- **Qué se hizo**:
  - Actualización de `DATABASE_URL` a Session Pooler de Supabase con SSL
  - Ejecución de `drizzle-kit push` exitosa (tipos, tablas, índices y FKs creadas)
  - Test E2E local RedTickets:
    - `GET /api/scrape/redtickets` → `discovered: 31`, `saved: 31`, `errors: 0`
  - Test E2E local Entraste:
    - `GET /api/scrape/entraste` → `discovered: 10`, `saved: 10`, `errors: 0`
  - Confirmación de rutas y ejecución estable en entorno local
- **Bloqueos detectados**:
  - Ninguno bloqueante para Fase 1
- **Próximo paso**:
  - Empezar Fase 2: `normalizer.ts` + primer `process/route.ts`

### Sesión 6 — 16 de febrero de 2026 (Fase 2 — Pipeline base)
- **Duración**: —
- **Qué se hizo**:
  - Implementación de módulos en `src/processing`:
    - `normalizer.ts` (normalización fecha/hora/slug/precios)
    - `deduplicator.ts` (detección de duplicados por similaridad)
    - `classifier.ts` (clasificación heurística tipo/género)
    - `pipeline.ts` (proceso raw → events + event_sources)
    - `ai-client.ts` (wrapper base para OpenAI)
  - Integración de `/api/scrape/process` con ejecución real y soporte `?batch=`
  - Validación técnica:
    - `npm run lint` ✅
    - `npm run build` ✅
  - Test E2E:
    - Re-scrape de Entraste: `saved: 10`
    - Proceso: `pending: 10`, `processed: 10`, `created: 0`, `merged: 10`, `errors: 0`
- **Bloqueos detectados**:
  - Error DNS transitorio al pooler (`ENOTFOUND`) observado una vez; reintento posterior OK
- **Próximo paso**:
  - Completar Fase 2 avanzada: fallback OpenAI en normalizer + geocoder (lookup + Mapbox)

### Sesión 7 — 16 de febrero de 2026 (Fase 2 — Avanzado)
- **Duración**: —
- **Qué se hizo**:
  - `normalizer.ts` pasó a flujo async con fallback OpenAI (`gpt-4o-mini`) para fechas ambiguas
  - Nuevo `geocoder.ts`:
    - Lookup local de venues conocidos (Antel Arena, Solís, etc.)
    - Fallback opcional a Mapbox Geocoding API
  - `pipeline.ts` mejorado:
    - Integración de geocoding en creación de eventos
    - Reintentos transitorios para operaciones DB/red (ENOTFOUND, ETIMEDOUT, etc.)
    - Resolución robusta de colisiones de slug (`events_slug_unique`) con sufijos incrementales
  - Variables de entorno:
    - `.env.example` actualizado con `NEXT_PUBLIC_MAPBOX_TOKEN`
    - `.env` actualizado con placeholder comentado de Mapbox
  - Validación técnica:
    - `npm run lint` ✅
    - `npm run build` ✅
  - Validación funcional:
    - Re-scrape RedTickets y ejecución de `/api/scrape/process` sin ruptura del pipeline
- **Bloqueos detectados**:
  - Mapbox fallback no activo por falta de token (no bloqueante)
- **Próximo paso**:
  - Medir costos OpenAI y afinar prompts/rules
  - Continuar Fase 3 frontend MVP

### Sesión 8 — 17 de febrero de 2026 (Frontend completo)
- **Duración**: —
- **Qué se hizo**:
  - Frontend completo de Fase 3
  - Construido todo el design system: globals.css (neón, glassmorphism, shimmer, animations)
  - Componentes: Header, BottomNav, EventCard, EventList, EventSkeleton, TimeBadge, EventTypeBadge, EmptyState
  - Páginas: Home (Hoy), Próximos, /evento/[slug]
  - Queries layer con Drizzle
  - Build exitoso con TypeScript
- **Próximo paso**: Corregir bugs de datos (precios, venues, imágenes, isFree)

### Sesión 9 — 17 de febrero de 2026 (Bug fixing scrapers + datos)
- **Duración**: —
- **Qué se hizo**:
  - Investigación profunda de datos con scripts de inspección (inspect-db*.js, inspect-html*.mjs)
  - Fixes en scrapers:
    - `utils.ts`: eliminado multiplicador ×100 en extractMoneyValues, filtro amount>0
    - `entraste.ts`: reescrito venue extraction con parsing HTML `<br>`, resolveImageUrl (relativo→absoluto), extractPricesFromHtml
    - `redtickets.ts`: reescrito para usar `span.Description.Flex` para venue/fecha
  - Fixes en pipeline:
    - `normalizer.ts`: isFree solo si texto dice "gratis" explícitamente, cleanVenueName/cleanVenueAddress helpers
  - Wipe completo de DB + re-scrape: 42 eventos, 0 gratis falsos, 0 "por confirmar"
  - Layout desktop: max-w-2xl → max-w-5xl, grid responsivo 1→2→3 columnas
- **Próximo paso**: Fix de imagen rota y diseño más vibrante

### Sesión 10 — 17 de febrero de 2026 (Polish visual)
- **Duración**: —
- **Qué se hizo**:
  - **Broken image fix**: EventCard convertido a client component con useState para imgError. Fallback con gradiente por tipo de evento + ícono Music watermark
  - **Diseño vibrante**:
    - Ambient gradient boosted (0.12→0.18 opacity) con 3 radiales + magenta + animación drift
    - Glass-card hover mejorado: translateY(-2px), box-shadow con depth, border violeta
    - Card-glow: efecto de borde gradiente neón en hover (violet→cyan→magenta)
    - Badges con text-shadow glow por color
    - Glass nav/header con tintes violeta en bordes
    - Logo "hoy" con gradient multicolor (violet→magenta→cyan)
    - Section headers con gradientes de color en iconos y texto
    - Image overlay más suave (menos crushing del negro)
    - Glows boosted (+33% intensidad)
  - Header y BottomNav: max-w-2xl → max-w-5xl para desktop
  - Build exitoso ✅
- **Próximo paso**: Fase 4 — Deploy a Vercel, PWA, SEO avanzado

---

## Notas Generales

- **Prioridad 1**: que el scraping funcione y haya eventos reales en la DB
- **Prioridad 2**: que la UI se sienta nocturna y premium en el celular
- **Prioridad 3**: que el auth y la memoria personal funcionen
- **No gastar** en servicios pagos hasta que haya tracción real
- **No overengineer**: si algo se puede hacer simple, se hace simple

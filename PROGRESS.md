# ¿Dónde es Hoy? — Tracking de Avances

> Documento vivo para trackear el progreso del proyecto.
> Actualizar después de cada sesión de trabajo.

---

## Estado General

| Métrica | Valor |
|---------|-------|
| **Fase actual** | Fase 1 — Scrapers MVP (en progreso) |
| **Inicio del proyecto** | 8 de febrero de 2026 |
| **Último update** | 16 de febrero de 2026 (setup + scraper RedTickets) |
| **MVP estimado** | 15-21 días de desarrollo |
| **Gasto mensual actual** | $0 |

---

## Servicios Configurados

| Servicio | Estado | Plan | Costo |
|----------|--------|------|-------|
| Vercel | ⬜ Pendiente | Hobby (free) | $0 |
| Supabase | 🟡 En progreso | Free (solo DB, sin Auth/Storage) | $0 |
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
| 0.3 | Crear proyecto en Supabase (solo DB) | ⬜ | | Acción manual pendiente |
| 0.4 | Configurar Drizzle ORM + conexión a Supabase PG | 🟡 | 16/2/2026 | Config base lista (`drizzle.config.ts`, `src/lib/db`) |
| 0.5 | Crear schema inicial de DB | ✅ | 16/2/2026 | `raw_events`, `events`, `event_sources` + enums |
| 0.6 | Push schema con `drizzle-kit push` | ❌ | 16/2/2026 | Bloqueado por auth de Supabase (`28P01`) |
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
| 1.2 | `scrapers/utils.ts` — parseo fechas español | 🟡 | 16/2/2026 | Utilidades base + regex inicial |
| 1.3 | Scraper RedTickets — discover | ✅ | 16/2/2026 | Discovery por links `/evento/.../{id}` |
| 1.4 | Scraper RedTickets — scrape detalle | ✅ | 16/2/2026 | Extrae título, fecha, venue, imagen y precios |
| 1.5 | API route `/api/scrape/redtickets` | ✅ | 16/2/2026 | Con `CRON_SECRET` y ejecución real |
| 1.6 | **TEST**: ejecutar RedTickets → ver raw_events | ❌ | 16/2/2026 | Scrapea OK pero no guarda por auth DB |
| 1.7 | Scraper Entraste.com — discover | ✅ | 16/2/2026 | Discovery por links `/evento/{slug}` |
| 1.8 | Scraper Entraste.com — scrape detalle | ✅ | 16/2/2026 | Extrae nombre, venue, ubicación, fecha, imagen y precios |
| 1.9 | API route `/api/scrape/entraste` | ✅ | 16/2/2026 | Con `CRON_SECRET` y ejecución real |
| 1.10 | **TEST**: ejecutar Entraste → ver raw_events | ⬜ | | Verificar datos en Supabase |
| 1.11 | Configurar `vercel.json` con cron jobs | ✅ | 16/2/2026 | 3 crons configurados |
| 1.12 | **TEST**: verificar cron ejecutó en Vercel | ⬜ | | Dashboard → Cron Jobs |

---

## Fase 2 — Pipeline IA (Est: 3-4 días)

| # | Tarea | Estado | Fecha | Notas |
|---|-------|--------|-------|-------|
| 2.1 | `normalizer.ts` — regex para fechas UY | ⬜ | | 80% de fechas sin IA |
| 2.2 | `normalizer.ts` — fallback OpenAI para ambiguos | ⬜ | | gpt-4o-mini batch |
| 2.3 | `geocoder.ts` — lookup table venues conocidos | ⬜ | | Cloud 7, Antel Arena, etc. |
| 2.4 | `geocoder.ts` — fallback Mapbox geocoding | ⬜ | | Solo si venue desconocido |
| 2.5 | `deduplicator.ts` — fuzzy match | ⬜ | | Nombre + fecha + venue |
| 2.6 | `classifier.ts` — clasificar tipo + género | ⬜ | | Batch OpenAI |
| 2.7 | `pipeline.ts` — orquestador completo | ⬜ | | Procesa raw → events |
| 2.8 | API route `/api/scrape/process` | ⬜ | | |
| 2.9 | **TEST E2E**: raw_events → pipeline → events | ⬜ | | Datos limpios en events |
| 2.10 | Verificar costos OpenAI reales | ⬜ | | Dashboard OpenAI usage |

---

## Fase 3 — Frontend MVP (Est: 5-7 días)

| # | Tarea | Estado | Fecha | Notas |
|---|-------|--------|-------|-------|
| 3.1 | Root layout: fonts, theme, CSS neón, providers | ⬜ | | Space Grotesk + Inter |
| 3.2 | `globals.css` — custom utilities neón/glow/glass | ⬜ | | |
| 3.3 | Bottom navigation component | ⬜ | | 2 tabs: Hoy / Próximos |
| 3.4 | Header sticky | ⬜ | | Logo + ciudad |
| 3.5 | Event card component (glassmorphism) | ⬜ | | El componente más importante |
| 3.6 | Time badge ("AHORA", "En 2h") | ⬜ | | Con pulse animation |
| 3.7 | Event type badge (colores neón) | ⬜ | | Fiesta=violeta, etc. |
| 3.8 | Home page (server component) | ⬜ | | "Hoy en tu ciudad" |
| 3.9 | Event detail page `/evento/[slug]` | ⬜ | | Info completa + link tickets |
| 3.10 | Página "Próximos" | ⬜ | | Mañana, finde, semana |
| 3.11 | Skeleton loaders neón | ⬜ | | Shimmer effect |
| 3.12 | Empty states con diseño | ⬜ | | "No hay eventos hoy" |
| 3.13 | Page transitions con Motion | ⬜ | | Fade-up + blur |
| 3.14 | Responsive: testar en móvil real | ⬜ | | |

---

## Fase 4 — Polish + Launch (Est: 2-3 días)

| # | Tarea | Estado | Fecha | Notas |
|---|-------|--------|-------|-------|
| 4.1 | SEO: metadata dinámicas por página | ⬜ | | |
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
| 8 | Credenciales DB inválidas en Supabase | No se puede persistir ni migrar schema | Regenerar `DATABASE_URL`/password desde Supabase | ❌ Bloqueante |

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

---

## Notas Generales

- **Prioridad 1**: que el scraping funcione y haya eventos reales en la DB
- **Prioridad 2**: que la UI se sienta nocturna y premium en el celular
- **Prioridad 3**: que el auth y la memoria personal funcionen
- **No gastar** en servicios pagos hasta que haya tracción real
- **No overengineer**: si algo se puede hacer simple, se hace simple

# ¿Dónde es Hoy? — Tracking de Avances

> Documento vivo para trackear el progreso del proyecto.
> Actualizar después de cada sesión de trabajo.

---

## Estado General

| Métrica | Valor |
|---------|-------|
| **Fase actual** | Fase 0 — Setup |
| **Inicio del proyecto** | 8 de febrero de 2026 |
| **Último update** | 8 de febrero de 2026 |
| **MVP estimado** | 19-26 días de desarrollo |
| **Gasto mensual actual** | $0 |

---

## Servicios Configurados

| Servicio | Estado | Plan | Costo |
|----------|--------|------|-------|
| Vercel | ⬜ Pendiente | Hobby (free) | $0 |
| Supabase | ⬜ Pendiente | Free | $0 |
| Upstash Redis | ⬜ Pendiente | Free | $0 |
| OpenAI API | ⬜ Pendiente | Pay-as-you-go | ~$1-3/mes est. |
| Eventbrite API | ⬜ Pendiente | Free (OAuth token) | $0 |
| Dominio | ⬜ Pendiente | Opcional | $0-30/año |
| **TOTAL** | | | **~$1-3/mes** |

> Leyenda: ⬜ Pendiente | 🟡 En progreso | ✅ Listo | ❌ Bloqueado

---

## Fase 0 — Setup (Est: 2-3 días)

| # | Tarea | Estado | Fecha | Notas |
|---|-------|--------|-------|-------|
| 0.1 | Crear proyecto Next.js 16.1 + TS + Tailwind v4 | ⬜ | | |
| 0.2 | Configurar shadcn/ui con tema dark custom | ⬜ | | |
| 0.3 | Crear proyecto en Supabase | ⬜ | | |
| 0.4 | Habilitar Auth (Google + Email) en Supabase | ⬜ | | |
| 0.5 | Crear bucket de Storage en Supabase | ⬜ | | |
| 0.6 | Configurar Drizzle ORM + conexión a Supabase PG | ⬜ | | |
| 0.7 | Crear schema inicial de DB | ⬜ | | |
| 0.8 | Push schema con `drizzle-kit push` | ⬜ | | |
| 0.9 | Crear instancia Upstash Redis | ⬜ | | |
| 0.10 | Deploy inicial a Vercel | ⬜ | | |
| 0.11 | Configurar env vars en Vercel | ⬜ | | |
| 0.12 | Crear `.env.example` con todas las variables | ⬜ | | |
| 0.13 | Estructura de carpetas base | ⬜ | | |

---

## Fase 1 — Scrapers MVP (Est: 4-5 días)

| # | Tarea | Estado | Fecha | Notas |
|---|-------|--------|-------|-------|
| 1.1 | `base-scraper.ts` — interfaz + helpers | ⬜ | | Rate limit, retry, tipos |
| 1.2 | `scrapers/utils.ts` — parseo fechas español | ⬜ | | Regex para formatos UY |
| 1.3 | Scraper RedTickets — discover | ⬜ | | Parsear homepage |
| 1.4 | Scraper RedTickets — scrape detalle | ⬜ | | Parsear página de evento |
| 1.5 | API route `/api/scrape/redtickets` | ⬜ | | Con CRON_SECRET |
| 1.6 | **TEST**: ejecutar RedTickets → ver raw_events | ⬜ | | Verificar datos en Supabase |
| 1.7 | Scraper Tickantel — discover por categorías | ⬜ | | cat_id=1,2,6,7,10 |
| 1.8 | Scraper Tickantel — scrape detalle | ⬜ | | Parsear evento individual |
| 1.9 | API route `/api/scrape/tickantel` | ⬜ | | |
| 1.10 | **TEST**: ejecutar Tickantel → ver raw_events | ⬜ | | |
| 1.11 | Scraper Eventbrite — discovery + API | ⬜ | | Híbrido scrape+API |
| 1.12 | API route `/api/scrape/eventbrite` | ⬜ | | |
| 1.13 | Configurar `vercel.json` con cron jobs | ⬜ | | 4 crons diarios |
| 1.14 | **TEST**: verificar cron ejecutó en Vercel | ⬜ | | Dashboard → Cron Jobs |

---

## Fase 2 — Pipeline IA (Est: 3-4 días)

| # | Tarea | Estado | Fecha | Notas |
|---|-------|--------|-------|-------|
| 2.1 | `normalizer.ts` — regex para fechas UY | ⬜ | | 80% de fechas sin IA |
| 2.2 | `normalizer.ts` — fallback OpenAI para ambiguos | ⬜ | | gpt-4o-mini batch |
| 2.3 | `geocoder.ts` — lookup table venues conocidos | ⬜ | | Antel Arena, Solís, etc. |
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
| 3.3 | Bottom navigation component | ⬜ | | 4 tabs con Motion |
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

## Fase 4 — Auth + Memoria Personal (Est: 3-4 días)

| # | Tarea | Estado | Fecha | Notas |
|---|-------|--------|-------|-------|
| 4.1 | Supabase Auth config + `proxy.ts` | ⬜ | | Token refresh |
| 4.2 | `lib/supabase/client.ts` + `server.ts` | ⬜ | | |
| 4.3 | Login page (Google + email) | ⬜ | | Diseño nocturno |
| 4.4 | Auth callback route | ⬜ | | |
| 4.5 | Protección de rutas (historial, perfil) | ⬜ | | Redirect a login |
| 4.6 | Botón "Asistí" (toggle + animación) | ⬜ | | Server action |
| 4.7 | Rating stars 1-5 (privado) | ⬜ | | Con animación scale |
| 4.8 | Comentario privado (dialog) | ⬜ | | Textarea simple |
| 4.9 | Upload foto (Supabase Storage) | ⬜ | | Resize client-side |
| 4.10 | Página "Mi Historial" | ⬜ | | Timeline de eventos |
| 4.11 | Página "Perfil" | ⬜ | | Info básica + logout |

---

## Fase 5 — Polish + Launch (Est: 2-3 días)

| # | Tarea | Estado | Fecha | Notas |
|---|-------|--------|-------|-------|
| 5.1 | SEO: metadata dinámicas por página | ⬜ | | |
| 5.2 | OG Image para shares | ⬜ | | |
| 5.3 | Structured data (JSON-LD) para eventos | ⬜ | | |
| 5.4 | ISR: revalidate en home y listados | ⬜ | | |
| 5.5 | Error handling completo | ⬜ | | |
| 5.6 | PWA: manifest.json + Add to Home Screen | ⬜ | | |
| 5.7 | Testing en dispositivos móviles reales | ⬜ | | Android + iOS Safari |
| 5.8 | Lighthouse audit (target: perf>80, a11y>90) | ⬜ | | |
| 5.9 | **🚀 LAUNCH MVP** | ⬜ | | |

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
| 8/2/2026 | Supabase Auth (no Clerk) | $0 costo, integrado con DB y Storage |
| 8/2/2026 | Supabase (no Neon) | All-in-one: DB + Auth + Storage |
| 8/2/2026 | Instagram scraping → post-MVP | Complejidad alta, bajo ROI para MVP |
| 8/2/2026 | Next.js 16.1 | Última estable, Turbopack, React 19.2 |
| 8/2/2026 | Tailwind v4 + shadcn/ui | Customizable, dark mode nativo |
| 8/2/2026 | Motion (ex Framer Motion) | Declarativo, React 19 compatible |
| 8/2/2026 | TypeScript | Type safety, mejor DX |
| 8/2/2026 | Solo producción al inicio | Simpleza, deploy rápido |
| 8/2/2026 | gpt-4o-mini (no gpt-4o) | 15x más barato, suficiente para clasificar |
| 8/2/2026 | Vercel Hobby (no Pro) | $0, cron 1x/día alcanza para MVP |

---

## Bloqueos / Riesgos

| # | Riesgo | Impacto | Mitigación | Estado |
|---|--------|---------|------------|--------|
| 1 | RedTickets cambia estructura HTML | Scraper se rompe | Monitorear errores, schema flexible | ⬜ Abierto |
| 2 | Tickantel bloquea scraping | Sin eventos de Tickantel | Rate limit agresivo, User-Agent real, contactar para API | ⬜ Abierto |
| 3 | Supabase free tier se pausa (7d inactivo) | DB offline | Cron job diario mantiene activo | ⬜ Abierto |
| 4 | Vercel cron impreciso (±59min hobby) | Scraping a hora imprecisa | Aceptable para MVP, upgrade a Pro si es problema | ⬜ Abierto |
| 5 | Pocos eventos en fuentes | Home vacía | Agregar fuentes, curación manual temporal | ⬜ Abierto |

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

---

## Notas Generales

- **Prioridad 1**: que el scraping funcione y haya eventos reales en la DB
- **Prioridad 2**: que la UI se sienta nocturna y premium en el celular
- **Prioridad 3**: que el auth y la memoria personal funcionen
- **No gastar** en servicios pagos hasta que haya tracción real
- **No overengineer**: si algo se puede hacer simple, se hace simple

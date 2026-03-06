# Copilot Instructions — DondeEsHoy

Leé `agent.md` antes de hacer cambios grandes. Este archivo es el resumen operativo corto para arrancar bien.

## Stack y contexto

- Proyecto: `Next.js 16` + `React 19` + `TypeScript` + `Tailwind CSS 4`.
- Dominio: agregador de eventos de Uruguay con scrapers y pipeline de procesamiento.
- Estilo UI: dark theme, mobile-first, acentos neon (`cyan`/`violet`), sin librerías de UI externas.
- Datos: `Drizzle ORM` sobre PostgreSQL. Antes de tocar pipeline/queries, revisar `src/lib/db/schema/`.

## Reglas de trabajo

- Usar imports con alias `@/`.
- Preferir Server Components; usar `"use client"` solo si hace falta.
- No instalar librerías de UI ni rehacer estilos fuera del sistema actual.
- No romper ISR/cache sin motivo.
- No duplicar helpers existentes (`src/lib/format.ts`, `src/lib/utils.ts`, etc.).
- Mantener timezone Uruguay (`America/Montevideo`, UTC-3).
- Si cambiás scraping, normalización, clasificación o deduplicación, validar también scripts de mantenimiento relacionados.

## Tailwind / frontend

- Usar Tailwind v4 con utilidades existentes y clases compartidas de `src/app/globals.css`.
- Mantener estética consistente con glassmorphism suave y alto contraste.
- Si combinás clases, usar `cn()` desde `src/lib/utils.ts`.

## Pipeline / scrapers

- Flujo: scraper -> `raw_events` -> normalizer -> classifier -> geocoder -> deduplicator -> `events`.
- `dateText` del scraper puede ser clave para detectar recurrencia; no asumir que todo está en `name` o `description`.
- Para RedTickets, la fuente de descubrimiento debe ser la búsqueda paginada (`/busqueda?,*,0,0`), no la home.
- Para precios, recordar que `priceMin` y `priceMax` son enteros en DB.

## Antes de cerrar cambios

- Revisar errores de TypeScript/ESLint.
- Si tocaste lógica de negocio, dejarla fija también para futuros re-scrapes o re-procesados, no solo para datos ya existentes.
- Si hace falta contexto extra del repo, usar `agent.md`, `README.md` y `sistema.md` como fuente de verdad.

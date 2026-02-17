# ¿Dónde es Hoy? — Plan Maestro 2026 (Social Events Edition)

> Nueva dirección del producto: de "noche" a **eventos sociales para todo Uruguay**.
> Objetivo: que cualquier persona vea rápido qué hacer hoy, mañana o este fin de semana.

---

## Visión del Producto

**¿Dónde es Hoy?** pasa de ser una web centrada en nightlife a una plataforma de descubrimiento de eventos sociales en general:

- Música y recitales
- Teatro y cultura
- Ferias y gastronomía
- Deportes y actividades familiares
- Talleres, charlas y experiencias

Mensaje de marca propuesto:

- "Donde comienza tu próxima salida"
- "Todo lo que pasa en Uruguay, en un solo lugar"

---

## Objetivos Prioritarios (Q1 2026)

1. **Reenfocar taxonomía y filtros** hacia eventos sociales (no solo nocturnos).
2. **Mejorar clasificación automática** con OpenAI como fallback inteligente.
3. **Hacer el mapa 100% confiable en producción** migrando a Leaflet + OpenStreetMap.
4. **Mejorar cobertura geográfica** (Montevideo + interior) con geocoding más robusto.
5. **Actualizar identidad visual y copy** para reflejar el nuevo alcance.

---

## Estado Actual (Resumen Real)

### Ya implementado

- Scrapers funcionando (`redtickets`, `entraste`, `cartelera`, `mvd_eventos`)
- Pipeline base funcionando (normalizar → geocodificar → deduplicar → clasificar)
- Frontend principal operativo (`/`, `/proximos`, `/evento/[slug]`, `/mapa`)
- Filtros por tipo/género/departamento/gratis + búsqueda
- Tracking de views + sección trending
- SEO base + JSON-LD + PWA manifest

### Problemas activos

- Enfoque y copy siguen muy "nightlife"
- Filtros de tipo se quedan cortos para eventos sociales
- Clasificación es mayormente heurística (regex), IA incompleta
- Mapa depende de Mapbox token y falla en Vercel si no está bien configurado
- Muchos eventos sin coordenadas reales fuera de lookup local
- Ciudad hardcodeada a Montevideo en normalización

---

## Roadmap Principal

## Fase A — Rebranding funcional (impacto alto, riesgo bajo)

### A.1 Marca y narrativa

- Actualizar `src/config/site.ts` (descripción general social, no solo nocturna)
- Ajustar metadata global en `src/app/layout.tsx`
- Actualizar mensaje en `src/app/manifest.ts`

### A.2 Hero de entrada

- Agregar bloque inicial en `src/app/(main)/page.tsx` con tagline breve
- Debe convivir con búsqueda actual y no romper mobile-first

Entregable: home con propósito claro para cualquier tipo de salida/evento.

---

## Fase B — Taxonomía y filtros sociales (base de producto)

### B.1 Expandir tipos de evento

Archivos:

- `src/types/events.ts`
- `src/lib/db/schema/events.ts`
- `src/components/shared/event-type-badge.tsx`
- `src/components/events/event-filters.tsx`

Propuesta de nuevos tipos:

- `concierto`
- `cultural`
- `deportivo`
- `gastronomico`
- `familiar`
- `feria`
- `taller`

Mantener compatibilidad con tipos existentes mientras se migra data histórica.

### B.2 Filtros nuevos

- Mejorar chips por tipo con nueva taxonomía
- Agregar filtro temporal en `/proximos`:
  - Este finde
  - Esta semana
  - Próximos 30 días
- Agregar filtro por franja horaria:
  - Tarde
  - Noche
  - Todo el día

Entregable: usuario encuentra eventos sociales relevantes con menos fricción.

---

## Fase C — Clasificación inteligente con OpenAI (calidad de datos)

### C.1 Estrategia híbrida

- Mantener regex para casos evidentes (rápido/barato)
- Si cae en `otro` o hay baja confianza, usar OpenAI

Archivos:

- `src/processing/classifier.ts`
- `src/processing/ai-client.ts`
- `src/processing/pipeline.ts`

### C.2 Qué debe devolver la IA

- `eventType`
- `musicGenre` (si aplica)
- `confidence` (0-1)

### C.3 Reprocesamiento de backlog

- Re-clasificar eventos existentes marcados como `otro`
- Dejar script de mantenimiento en `scripts/`

Entregable: menos eventos "mal clasificados" y filtros más útiles.

---

## Fase D — Mapa confiable en Vercel (sin dependencia de token)

### D.1 Migrar Mapbox → Leaflet + OpenStreetMap

Archivos:

- `src/components/events/event-map.tsx`
- `src/app/(main)/mapa/page.tsx`
- `package.json`

Resultado esperado:

- Map tiles siempre visibles (calles + contexto)
- Marcadores de eventos sobre mapa real
- Sin bloqueo por `NEXT_PUBLIC_MAPBOX_TOKEN`

### D.2 Mini-mapa en detalle de evento

- Si hay coordenadas, mostrar mapa chico en `event-detail`

Entregable: experiencia de ubicación usable siempre, en local y en producción.

---

## Fase E — Geocoding y cobertura nacional

### E.1 Geocoder más fuerte

- Mantener lookup local de venues
- Agregar fallback geocoding gratuito (Nominatim OSM)

Archivo:

- `src/processing/geocoder.ts`

### E.2 Resolver ciudad/departamento correctamente

- Dejar de hardcodear Montevideo
- Inferir city/department por dirección/coordenadas

Archivo:

- `src/processing/normalizer.ts`

Entregable: más eventos con coordenadas y mejor filtro por departamento.

---

## Fase F — Deuda técnica y calidad

- Validar `type` en API (`src/app/api/events/route.ts`)
- Evitar inflado de views (`src/components/events/view-tracker.tsx` + rate limit API)
- Marcar eventos pasados como `status: past` en proceso diario
- Reducir payload innecesario en listados (`src/lib/queries.ts`)
- Revisar accesibilidad viewport (permitir zoom)

Entregable: sistema más robusto y mantenible.

---

## Orden de Implementación Recomendado

1. **Fase B** (tipos y filtros)
2. **Fase C** (clasificación IA)
3. **Fase D** (mapa estable)
4. **Fase E** (geocoding/cobertura)
5. **Fase A** (rebranding/copy final)
6. **Fase F** (hardening técnico)

Motivo: primero mejorar funcionalidad central, luego pulir narrativa y técnica.

---

## Criterios de Aceptación (por bloque)

- **Taxonomía**: aparecen nuevos tipos en DB, filtros, badges y cards
- **Clasificación IA**: disminuye claramente porcentaje de `otro`
- **Mapa**: en Vercel se ven tiles y marcadores siempre
- **Geocoding**: sube porcentaje de eventos con lat/lng
- **UX**: Home comunica "eventos sociales" en los primeros segundos

---

## Métricas a monitorear

- % de eventos clasificados como `otro`
- % de eventos con coordenadas válidas
- CTR de filtros por tipo
- Tiempo hasta primer resultado útil (TTFR UX)
- Errores de scraping/procesamiento por día

---

## Riesgos y Mitigaciones

- **Nominatim rate limit** → cache + lookup local + cola controlada
- **Cambios en HTML de fuentes** → monitoreo y tests de scraping por fuente
- **Costo OpenAI** → fallback selectivo + batch + cache de resultado
- **Migración de tipos en Postgres enum** → plan de migración gradual y compatibilidad temporal

---

## Backlog Estratégico (Post bloque principal)

- Vista calendario para `/proximos`
- "Cerca de mí" (ordenar por distancia)
- Compartir evento (Web Share API)
- Notificaciones PWA por preferencias
- Curación editorial "Destacados"

---

## Próxima Revisión del Plan

- Fecha sugerida: **fin de semana del 21-22 Feb 2026**
- Objetivo: evaluar avance de Fases B/C/D y ajustar prioridades.

---

**Última actualización:** 17 de febrero de 2026
**Owner:** Producto + Ingeniería DondeEsHoy
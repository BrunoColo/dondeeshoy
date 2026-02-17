# ¿Dónde es Hoy? — PROGRESS (nuevo ciclo)

> Tracker operativo del plan actualizado a eventos sociales.
> Se limpia historial viejo y se prioriza lo que falta.

---

## Estado General

- **Fecha de corte:** 17/02/2026
- **Fase activa:** Reenfoque social + filtros + IA + mapa estable
- **Estado global:** 🟡 En progreso
- **Bloqueador principal de UX:** mapa no confiable en producción con setup actual

---

## Qué ya está sólido (base existente)

- ✅ Scraping multi-fuente funcionando (`redtickets`, `entraste`, `cartelera`, `mvd_eventos`)
- ✅ Pipeline base (normalización, geocoder lookup, dedup, clasificación heurística)
- ✅ Frontend funcional (`/`, `/proximos`, `/evento/[slug]`, `/mapa`)
- ✅ Filtros y búsqueda operativos
- ✅ SEO base, JSON-LD y manifest PWA
- ✅ Seguridad base para cron + locking

> Nota: esto queda como base consolidada; no se vuelve a trackear granularmente.

---

## Objetivos Activos (Sprint Grande)

## 1) Reenfoque a eventos sociales

| Ítem | Estado | Notas |
|---|---|---|
| Actualizar narrativa/descripcion global | ⬜ | Quitar enfoque exclusivamente nocturno |
| Hero/tagline en home | ⬜ | Frase corta cerca del buscador |
| Ajustes de metadata y manifest | ⬜ | Coherencia de marca |

## 2) Tipos y filtros sociales

| Ítem | Estado | Notas |
|---|---|---|
| Definir nueva taxonomía de tipos | ⬜ | concierto/cultural/deportivo/familiar/etc. |
| Migrar enums y tipos TS/DB | ⬜ | Compatibilidad con data actual |
| Actualizar badges/chips/colores | ⬜ | UI de filtros y cards |
| Agregar filtros por ventana temporal | ⬜ | finde/semana/mes |
| Agregar filtro por franja horaria | ⬜ | tarde/noche/todo el día |

## 3) OpenAI en clasificación (completar)

| Ítem | Estado | Notas |
|---|---|---|
| Fallback IA cuando regex falla | ⬜ | Especialmente en `otro` |
| Estructura JSON con confidence | ⬜ | eventType + genre + confidence |
| Integración en pipeline | ⬜ | Guardado y uso de confianza |
| Script de reclasificación histórica | ⬜ | Reprocesar backlog `otro` |

## 4) Mapa estable en Vercel

| Ítem | Estado | Notas |
|---|---|---|
| Migrar a Leaflet + OSM | ⬜ | Eliminar dependencia de token Mapbox |
| Rehacer componente de mapa | ⬜ | Tiles + markers + popup |
| Limpiar lógica de fallback por token | ⬜ | `/mapa` siempre disponible |
| Mini-mapa en detalle de evento | ⬜ | Si hay coordenadas |

## 5) Geocoding y cobertura geográfica

| Ítem | Estado | Notas |
|---|---|---|
| Fallback geocoder gratuito | ⬜ | Nominatim como respaldo |
| Dejar de hardcodear Montevideo | ⬜ | Inferir ciudad/departamento |
| Re-geocode de eventos sin coordenadas | ⬜ | Script de mantenimiento |

## 6) Hardening técnico

| Ítem | Estado | Notas |
|---|---|---|
| Validar params en API de eventos | ⬜ | Evitar valores inválidos |
| Anti-inflado en views | ⬜ | rate limit + dedup por sesión |
| Marcar eventos pasados automáticamente | ⬜ | `status = past` |
| Reducir payload innecesario de listados | ⬜ | Optimización queries |
| Ajuste accesibilidad viewport (zoom) | ⬜ | Mejor UX mobile |

---

## Prioridad de Ejecución (acordada)

1. 🔴 Tipos + filtros sociales
2. 🔴 OpenAI clasificación
3. 🔴 Mapa estable sin token
4. 🟠 Geocoding/cobertura nacional
5. 🟡 Rebranding visual/copy
6. 🟡 Hardening técnico final

---

## Riesgos Activos

| Riesgo | Impacto | Mitigación | Estado |
|---|---|---|---|
| Migración de enums de evento en DB | Medio | migración gradual + compatibilidad temporal | 🟡 |
| Costo por uso IA si se dispara | Medio | fallback selectivo + batch + cache | 🟡 |
| Calidad geocoder gratuito (rate limit) | Medio | lookup local + cola + cache | 🟡 |
| Cambios de estructura en sitios scrapeados | Alto | monitoreo y mantenimiento por fuente | 🟡 |

---

## Definición de Hecho (DoD) de este ciclo

Se considera completado cuando:

- Nuevos tipos sociales están activos en DB + frontend
- La mayoría de `otro` queda reclasificada con IA o reglas
- El mapa funciona en Vercel mostrando calles y marcadores
- Los filtros reflejan eventos sociales y no solo nocturnos
- Home comunica claramente el nuevo posicionamiento

---

## Próximos Pasos Inmediatos

1. Diseñar taxonomía final de tipos y mapping con tipos viejos.
2. Implementar cambios de enums/types/filtros.
3. Integrar fallback OpenAI en clasificación.
4. Migrar mapa a Leaflet + OpenStreetMap.
5. Ejecutar reclasificación y regeocode de backlog.

---

**Última actualización:** 17/02/2026
**Modo:** Ejecución de plan grande
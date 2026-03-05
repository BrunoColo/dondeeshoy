# Plan de Trabajo — ¿Dónde es Hoy?

---

## Dificultad: 🟢 Baja

### Bugs Fáciles de Corregir

| # | Tarea | Descripción |
|---|-------|-------------|
| 1.2 | ✅ Fix: Login admin sin timing-safe comparison | Usar crypto.timingSafeEqual() como en isCronAuthorized() |
| 1.3 | ✅ Fix: Heurística de moneda invertida | Eliminar threshold de precio, usar solo hasUsdHint |
| 1.5 | ✅ Fix: Slugs inconsistentes | Unificar formato nombre-YYYY-MM-DD |
| 10.5 | ✅ Hardcoded email | Mover brunocolo05@gmail.com a env var ADMIN_EMAIL |
| 10.6 | CSS cleanup | Eliminar aliases, actualizar gradiente a teal |

### Optimizaciones Simples

| # | Tarea | Descripción |
|---|-------|-------------|
| 2.4 | Agregar índices faltantes | 4 índices en events y raw_events |
| 2.5 | Proyección de columnas | Reemplazar SELECT * por columnas explícitas |
| 2.6 | ✅ Cache en API routes | Agregar Cache-Control headers |
| 2.7 | ✅ On-demand ISR | Llamar revalidatePath() post-procesamiento |

### Frontend Simple

| # | Tarea | Descripción |
|---|-------|-------------|
| 4.5 | Compartir en WhatsApp | Generar deep link con wa.me |
| 4.8 | Modo "Sorprendeme" | Query ORDER BY random() LIMIT 1 |
| 6.5 | "Volver arriba" flotante | Botón que aparece al scrollear > 500px |

### Configuración

| # | Tarea | Descripción |
|---|-------|-------------|
| 10.1 | ✅ remotePatterns faltantes | Agregar CobraTicket, TicketFacil, etc. a next.config.ts |

---

## Dificultad: 🟡 Media

### Bugs con Cambios en DB

| # | Tarea | Descripción |
|---|-------|-------------|
| 1.1 | Fix: UPSERT resetea eventos rechazados | Agregar columna permanently_rejected |
| 1.4 | ✅ Fix: Rate limiting faltante | Implementar en view, login, trending |
| 7.3 | Flag permanently_rejected | UPSERT condicional en pipeline |

### Consolidación de Queries

| # | Tarea | Descripción |
|---|-------|-------------|
| 2.1 | ✅ getScraperStats() | De 35 queries a 2 con CASE WHEN + GROUP BY |
| 2.2 | ✅ getAdminDashboardStats() | De 8 queries a 1 con agregación condicional |
| 2.3 | ✅ getEventsByDate() | De 2 queries a 1 con OR |
| 2.8 | Sitemap con paginación | Implementar sitemap index con chunks |

### Newsletter y Email

| # | Tarea | Descripción |
|---|-------|-------------|
| 3.1 | Tabla email_subscribers | Schema con departments, event_types, frequency |
| 3.2 | Flujo de suscripción | Página /suscribirse + verificación por token |
| 3.3 | Cron de envío "Tu Fin de Semana" | Template HTML + Resend Batch API |
| 3.4 | Widget de suscripción | CTA flotante + modal/drawer |
| 3.5 | Suscripción diaria (fase 2) | Cron a las 8:00 UYT |
| 10.2 | Emails con dominio propio | Configurar dondeeshoy.com en Resend |
| 10.3 | Email al submitter | Confirmación + notificación aprobación/rechazo |

### Features de Contenido

| # | Tarea | Descripción |
|---|-------|-------------|
| 4.2 | Exportar a calendario (.ics) | Endpoint /api/events/[slug]/ical |
| 4.9 | Comparador de eventos | Componente side-by-side |
| 4.10 | Historial de eventos | Página /pasados con SEO |
| 5.3 | Página de búsqueda pública | /buscar con filtros |
| 5.4 | Breadcrumbs | JSON-LD + UI visual |

### Mejoras UX

| # | Tarea | Descripción |
|---|-------|-------------|
| 6.1 | Skeleton loading mejorado | Placeholders para cards, mapa, filtros |
| 6.3 | Empty states ilustrados | SVG con mensajes amigables |
| 6.4 | Date picker mejorado | Componente de calendario visual |
| 6.6 | Formulario de publicación con progreso | Stepper + auto-guardado |

### Scrapers y Pipeline

| # | Tarea | Descripción |
|---|-------|-------------|
| 7.1 | Scraper health monitoring | Alertas + dashboard de estado |
| 7.2 | Fix defectos pendientes | #20-#24 del sistema.md |
| 7.4 | Botón "Re-procesar" | Endpoint POST /api/admin/reprocess/[id] |

### Seguridad Media

| # | Tarea | Descripción |
|---|-------|-------------|
| 8.1 | CSRF protection | Token en formularios admin |
| 8.4 | Escapar wildcards | Función escapeLikePattern() |

### Infraestructura

| # | Tarea | Descripción |
|---|-------|-------------|
| 9.3 | Google Analytics 4 | Eventos custom setup |
| 9.4 | Web Vitals monitoring | Integrar @vercel/speed-insights |

### Datos

| # | Tarea | Descripción |
|---|-------|-------------|
| 10.4 | Unificar fuentes de venues | Migrar a tabla venues en DB |

---

## Dificultad: 🔴 Alta

### Features con geolocalización

| # | Tarea | Descripción |
|---|-------|-------------|
| 4.1 | "Cerca de Mí" inteligente | Haversine en SQL + persistencia + badge distancia |

### Sistema de Venues

| # | Tarea | Descripción |
|---|-------|-------------|
| 4.3 | Rankings y páginas de Venues | Migrar 133 venues + páginas /venue/[slug] + /venues |

### Alertas Personalizadas

| # | Tarea | Descripción |
|---|-------|-------------|
| 4.4 | Alertas personalizadas | Tabla event_alerts + cron + matching system |

### Widget y Embeds

| # | Tarea | Descripción |
|---|-------|-------------|
| 4.6 | Widget embebible | Endpoint /api/widget/[venue-slug] + embeddable script |

### Trending y Dinámicos

| # | Tarea | Descripción |
|---|-------|-------------|
| 4.7 | "Trending Topics" | Agregación semanal + badges dinámicos |

### Landing Pages SEO

| # | Tarea | Descripción |
|---|-------|-------------|
| 5.1 | Landing pages por departamento | 19 páginas /departamento/[slug] con JSON-LD |
| 5.2 | Landing pages por tipo | 14 páginas /tipo/[slug] con JSON-LD |

### Mapa

| # | Tarea | Descripción |
|---|-------|-------------|
| 6.2 | Clustering de markers | Integrar react-leaflet-cluster o supercluster |

### Dead Letter Queue

| # | Tarea | Descripción |
|---|-------|-------------|
| 7.5 | Dead letter queue | Marcar 3+ fallos + dashboard de resolución |

### Seguridad Avanzada

| # | Tarea | Descripción |
|---|-------|-------------|
| 8.2 | Rotación de sesión admin | sessionId en Redis + logout server-side |
| 8.3 | CSP más estricto | Nonce-based CSP con middleware Next.js |

### Logging y Observabilidad

| # | Tarea | Descripción |
|---|-------|-------------|
| 9.1 | Logging estructurado | Pino JSON + correlation IDs |
| 9.2 | Error monitoring | Integrar Sentry o Vercel built-in |

---

## Orden de Ejecución Propuesto

| Fase | Bloques | Duración est. | Impacto |
|------|---------|---------------|---------|
| Fase 1 | 1 (bugs) + 2.1-2.4 (queries) + 10.1, 10.5 | 1-2 días | Estabilidad + performance |
| Fase 2 | 3 (newsletter completo) + 10.2, 10.3 | 2-3 días | Feature estrella + comunicación |
| Fase 3 | 5 (SEO pages) + 5.3 (búsqueda) + 2.7 (ISR) | 2-3 días | Crecimiento orgánico |
| Fase 4 | 4.1-4.5 (features innovadoras) + 6.1-6.3 (UX) | 3-4 días | Diferenciación + UX |
| Fase 5 | 7 (scrapers) + 8 (seguridad) | 2-3 días | Robustez |
| Fase 6 | 9 (observabilidad) + 4.6-4.10 + 6.4-6.7 | 3-4 días | Madurez técnica |

---

## Resumen por Dificultad

| Dificultad | Cantidad | Ejemplos |
|------------|----------|----------|
| 🟢 Baja | ~15 tareas | Timing-safe comparison, CSS cleanup, cache headers |
| 🟡 Media | ~25 tareas | Newsletter, consolidación queries, SEO pages |
| 🔴 Alta | ~12 tareas | geolocalización Haversine, venues pages, CSP nonce |

---

## Verificación

- Correr pnpm build después de cada fase para validar que no hay errores de tipos.
- Después de Bloque 2: comparar tiempos de respuesta del admin dashboard (antes vs después) con console.time.
- Después de Bloque 3: enviar email de prueba con Resend, verificar que llega con formato correcto y links funcionales.
- Después de Bloque 5: verificar que las nuevas landing pages aparecen en el sitemap generado y validar con Google Rich Results Test.
- Después de Bloque 7: correr scrapers con permanently_rejected activo y verificar que no se reprocesan eventos baneados.

---

## Decisiones

- **Híbrido sin cuentas:** Suscripciones y alertas por email con verificación por token, sin OAuth por ahora. Favoritos en localStorage.
- **Newsletter antes que SEO:** La newsletter genera retención inmediata; el SEO tarda semanas en dar frutos.
- **Venues en DB:** Migrar de hardcoded a tabla venues resuelve 3 problemas de una (geocoder, classifier, feature de venue pages).
- **Rate limiting con Upstash:** Ya está integrado, solo agregar a los endpoints faltantes. Sin costo adicional en free tier.

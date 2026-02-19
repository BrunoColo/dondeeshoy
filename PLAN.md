# Plan de Implementación: Admin Dashboard /admin

## Descripción General
Panel de administración personal dentro del mismo proyecto Next.js, accesible en /admin, protegido con password simple. Dashboard sobrio y funcional para monitorear scrapers, pipeline de procesamiento, gestionar submissions y ver stats en tiempo real. Sin librerías UI extras — solo Tailwind con estilo minimal/monospace tipo terminal.

---

## PARTE 1: Fundamentos y Autenticación (25%)

### 1. Configuración de Variables de Entorno
- [ ] Agregar `ADMIN_PASSWORD` al `.env` y `.env.example`
- [ ] Agregar `ADMIN_SECRET` al `.env` y `.env.example` (secret para firmar cookie)

### 2. Autenticación - Login Simple con Cookie
- [ ] Crear `src/lib/admin-auth.ts` con helpers de auth:
  - `verifyCookie(token)` - verificar token firmado con HMAC
  - `createToken(secret)` - crear token firmado
- [ ] Crear ruta API POST `/api/admin/login` en `src/app/api/admin/login/route.ts`:
  - Recibe `{ password }`, valida contra `process.env.ADMIN_PASSWORD`
  - Setea cookie httpOnly `admin_session` con token firmado usando HMAC + `ADMIN_SECRET`
- [ ] Crear ruta API POST `/api/admin/logout` en `src/app/api/admin/logout/route.ts`:
  - Borra la cookie `admin_session`
- [ ] Crear middleware en `src/middleware.ts` (o extender si existe):
  - Rutas que matcheen `/admin` (excepto `/admin/login`)
  - Verificar cookie `admin_session`. Si no es válida, redirect a `/admin/login`

### 3. Queries Administrativas
- [ ] Crear `src/lib/admin-queries.ts` con todas las queries específicas del admin:
  - `getAdminDashboardStats()` — KPIs del dashboard
  - `getScraperStats()` — stats agrupados por fuente
  - `getPipelineStats()` — tasa de conversión, errores
  - `getRawEvents(filters, page, limit)` — raw events paginados
  - `getSubmissions(status, page, limit)` — submissions filtradas
  - `getSubmissionById(id)` — detalle de una submission
  - `approveSubmission(id, notes)` — lógica completa de aprobación
  - `rejectSubmission(id, notes)` — rechazo
  - `getDailyScrapeCounts(days)` — conteos diarios para gráficos

---

## PARTE 2: Layout y Dashboard (25%)

### 4. Layout Admin
- [ ] Crear route group `(admin)` en `src/app/(admin)/`
- [ ] Crear `layout.tsx` del admin:
  - Layout limpio sin header/nav/sidebar del sitio público
  - Sidebar lateral simple con links: Dashboard, Scrapers, Pipeline, Submissions
  - Estilo: fondo oscuro (zinc-950), tipografía mono, bordes sutiles (zinc-800), sin animaciones
  - Incluir: nombre de usuario/rol ("Admin"), botón de logout, timestamp del último refresh
  - No importa globals.css del main — usa su propio set minimal de estilos Tailwind

### 5. Página de Login
- [ ] Crear `src/app/(admin)/login/page.tsx`:
  - Formulario minimalista: input password + botón
  - Sin React Hook Form, simple form action
  - Estilo terminal/sobrio

### 6. Dashboard Principal - /admin
- [ ] Crear `src/app/(admin)/page.tsx` como Server Component:
  - **KPIs en cards:**
    - Total eventos activos (query: count events WHERE status='active')
    - Eventos creados hoy (query: count events WHERE created_at >= today)
    - Raw events sin procesar (query: count raw_events WHERE processed=false)
    - Submissions pendientes (query: count event_submissions WHERE status='pending')
    - Eventos con precio / imagen / ubicación (porcentajes)
    - Eventos por tipo (breakdown de event_type)
  - **Gráfico simple:**
    - Eventos scrapeados por día (últimos 7 días)
    - Eventos procesados por día
    - Usar tabla/barras ASCII o mini chart con Tailwind
- [ ] Crear API endpoint GET `/api/admin/stats` en `src/app/api/admin/stats/route.ts`:
  - Consolida todas las queries de stats
  - Proteger con validación de cookie

---

## PARTE 3: Scrapers y Pipeline (25%)

### 7. Sección Scrapers - /admin/scrapers
- [ ] Crear `src/app/(admin)/scrapers/page.tsx`:
  - **Tabla con una fila por cada fuente:**
    - redtickets, entraste, cartelera, mvd_eventos, cobraticket, ticketfacil
    - Nombre de la fuente + URL base (tomar de scraper-config.ts)
    - Total raw events de esa fuente
    - Scrapeados hoy
    - Sin procesar
    - Con errores de procesamiento
    - Último scrape
  - **Botón "Scrape Now":**
    - Llama al endpoint existente GET `/api/scrape/{source}` con CRON_SECRET como auth header
    - Mostrar estado de respuesta inline (loading → success/error)
- [ ] Crear API endpoint GET `/api/admin/scrapers/stats`:
  - Retorna stats agrupados por fuente
- [ ] Crear API endpoint POST `/api/admin/scrapers/[source]/run`:
  - Proxy para triggerear un scraper

### 8. Sección Pipeline - /admin/pipeline
- [ ] Crear `src/app/(admin)/pipeline/page.tsx`:
  - **Vista general:**
    - Total raw events → total procesados → total convertidos en evento
    - Tasa de conversión raw → evento
    - Cantidad de deduplicaciones
    - Errores de procesamiento recientes (últimos 20)
  - **Tabla de raw events recientes:**
    - Últimos 50, paginados
    - Columnas: source, source_id (truncado), título, scraped_at, processed, error
    - Filtro por: source, processed (true/false/all), con error (sí/no)
    - Click en fila → expandir para ver JSON de raw_data formateado
  - **Botones de acción:**
    - "Run Pipeline" → llama GET `/api/scrape/process`
    - "Mark Past Events" → llama POST `/api/scrape/mark-past`
- [ ] Crear API endpoints:
  - GET `/api/admin/pipeline/stats` — stats de conversión
  - GET `/api/admin/pipeline/raw-events?page=1&source=&processed=&hasError=` — lista paginada
  - POST `/api/admin/pipeline/run` — proxy para triggerear procesamiento
  - POST `/api/admin/pipeline/mark-past` — proxy para mark-past

---

## PARTE 4: Submissions y Verificación (25%)

### 9. Sección Submissions - /admin/submissions
- [ ] Crear `src/app/(admin)/submissions/page.tsx`:
  - **Tabs:** Pendientes | Aprobadas | Rechazadas
  - **Tabla de submissions:**
    - Columnas: evento, fecha, tipo, venue, ciudad, contacto, submitted_at, status
  - **Panel detalle al clickar submission:**
    - Toda la info del evento
    - Preview de imagen si tiene image_url
    - Botones: Aprobar / Rechazar + campo de notas opcional
- [ ] Crear API endpoint POST `/api/admin/submissions/[id]/review`:
  - Recibe `{ action: 'approve' | 'reject', notes?: string }`
  - **Si approve:**
    - Insertar en tabla events con los datos del submission
    - Mapear campos: event_name→name, generar slug, event_date→date, event_time→start_time, etc.
    - Setear confidence_score = 1.0
    - Geocodificar dirección si tiene venue_address (reusar función geocodeAddress de geocoder.ts)
    - Actualizar submission: status='approved', reviewed_at=now(), notes
  - **Si reject:**
    - Actualizar submission: status='rejected', reviewed_at=now(), notes

### 10. Resumen de API Endpoints Finales
Todos protegidos verificando cookie admin_session:

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/admin/login | Auth login |
| POST | /api/admin/logout | Auth logout |
| GET | /api/admin/stats | Dashboard KPIs |
| GET | /api/admin/scrapers/stats | Stats por scraper |
| POST | /api/admin/scrapers/[source]/run | Trigger scraper |
| GET | /api/admin/pipeline/stats | Stats del pipeline |
| GET | /api/admin/pipeline/raw-events | Raw events paginados |
| POST | /api/admin/pipeline/run | Trigger procesamiento |
| POST | /api/admin/pipeline/mark-past | Mark past events |
| POST | /api/admin/submissions/[id]/review | Aprobar/rechazar |

### 11. Estructura de Archivos Final

```
src/app/(admin)/
  layout.tsx              — layout admin (sidebar + header minimal)
  page.tsx                — dashboard principal
  login/
    page.tsx              — formulario de login
  scrapers/
    page.tsx              — tabla de scrapers + botones
  pipeline/
    page.tsx              — stats pipeline + tabla raw events
  submissions/
    page.tsx              — gestión de submissions

src/app/api/admin/
  login/route.ts
  logout/route.ts
  stats/route.ts
  scrapers/
    stats/route.ts
    [source]/run/route.ts
  pipeline/
    stats/route.ts
    raw-events/route.ts
    run/route.ts
    mark-past/route.ts
  submissions/
    [id]/review/route.ts

src/lib/
  admin-auth.ts           — helpers de auth (verify cookie, create token)
  admin-queries.ts        — queries del admin
```

### 12. Verificación
- [ ] `npm run dev` → navegar a http://localhost:3000/admin → debe redirigir a /admin/login
- [ ] Login con password correcto → acceso al dashboard con stats reales de la DB
- [ ] Verificar que cada sección carga datos: scrapers muestra las 6 fuentes con conteos, pipeline muestra raw events, submissions muestra las pendientes
- [ ] Probar botón "Scrape Now" en un scraper → debe ejecutar y mostrar resultado
- [ ] Probar aprobar una submission → debe crear evento nuevo en la tabla events
- [ ] Navegar a http://localhost:3000 → el sitio público sigue funcionando normal, sin cambios
- [ ] Verificar que /admin sin cookie válida redirige a login

---

## Decisions Implementadas

- **Mismo proyecto, ruta /admin**: evita duplicar config de DB, types, queries. Comparte el mismo next dev en puerto 3000
- **Auth por cookie + HMAC**: sin dependencias extras (no NextAuth, no Supabase Auth). Simple y suficiente para uso personal
- **Server Components por defecto**: las páginas del admin son Server Components que hacen queries directas a la DB. Solo los botones de acción y formularios son Client Components
- **Sin librería de charts**: para mantenerlo simple, usar tablas HTML y barras con divs + Tailwind para visualizar porcentajes
- **Estilo terminal/sobrio**: fondo zinc-950, texto zinc-300, font mono, bordes zinc-800. Sin animaciones, sin gradientes, sin íconos elaborados

---

## Notas Técnicas

- Reutilizar conexión de DB existente en `src/lib/db/index.ts`
- Reutilizar schemas de `src/lib/db/schema.ts`
- Reutilizar función `geocodeAddress` de `src/processing/geocoder.ts`
- Reutilizar endpoints existentes de scrape: `/api/scrape/{source}`, `/api/scrape/process`, `/api/scrape/mark-past` con CRON_SECRET

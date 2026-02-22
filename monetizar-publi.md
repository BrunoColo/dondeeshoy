# 🚀 MEGA PLAN — Monetización y Crecimiento de ¿Dónde es Hoy?

> **Visión**: Convertir dondeeshoy.com en LA referencia de eventos en Uruguay, generar tráfico orgánico y de redes sociales, y monetizar progresiva y naturalmente sin arruinar la experiencia del usuario.

> **Estado actual**: Plataforma funcional con ~1-2K eventos/ciclo de 7 scrapers, UI pulida dark/neon, formulario de publicación, admin dashboard, sitemap dinámico, PWA, deploy en Vercel. Sin tráfico real todavía, sin dominio activo en Google.

---

## FASE 0 — Fundamentos Pre-Lanzamiento (Semana 1-2)
> *Objetivo: Dejar todo listo para que Google te indexe bien y la página sea compartible.*

### 🔧 Técnico

- [ ] **Comprar y configurar dominio `dondeeshoy.com`**
  - Apuntar DNS a Vercel (CNAME + A records)
  - Configurar SSL automático de Vercel
  - Verificar que `https://dondeeshoy.com` carga correctamente

- [ ] **Configurar Google Search Console**
  - Verificar propiedad del dominio (meta tag o DNS TXT record)
  - Enviar `sitemap.xml` manualmente (ya se genera dinámicamente en `src/app/sitemap.ts`)
  - Verificar que `robots.ts` está bien (ya permite `/`, `/proximos`, `/mapa`, `/evento/`)
  - Monitorear indexación los primeros días

- [ ] **Configurar Google Analytics 4**
  - Crear property en GA4
  - Agregar el script de GA4 en `src/app/layout.tsx` (usar `next/script` con strategy `afterInteractive`)
  - Configurar eventos personalizados: `page_view`, `event_click`, `event_share`, `publicar_submit`, `filter_use`, `nearby_click`
  - Esto es CRÍTICO — sin analytics no podés demostrar tráfico a futuros anunciantes

- [ ] **Configurar Resend para emails**
  - Agregar dominio `dondeeshoy.com` en Resend → configurar DNS (MX, TXT, DKIM)
  - Activar `RESEND_API_KEY` en Vercel env vars
  - Verificar que las notificaciones de submissions llegan a `hola@dondeeshoy.com`

- [ ] **Optimizar SEO on-page**
  - Verificar Open Graph images (ya hay `og-default.png` configurado en `layout.tsx`)
  - Agregar `<meta>` de Twitter Card en el metadata de `layout.tsx`
  - Verificar que cada `/evento/[slug]` tiene title, description y OG image únicos
  - Agregar JSON-LD structured data (schema.org/Event) en cada página de evento para rich snippets en Google
  - Agregar JSON-LD `WebSite` con `SearchAction` en el layout principal

- [ ] **Hacer que /publicar sea impecable**
  - Verificar que el flujo completo funciona (submit → DB → email al admin)
  - Agregar mensaje claro: "Publicá tu evento GRATIS" como headline
  - Agregar texto que genere confianza: "Tu evento será revisado y publicado en menos de 24 horas"

### 📋 No-técnico

- [ ] Crear email `hola@dondeeshoy.com` (ya está referenciado en el código)
- [ ] Preparar un texto/pitch corto de qué es DondeEsHoy para usar en todos lados
- [ ] Definir la identidad de marca en redes: mismo nombre, misma paleta neon, misma vibe

---

## FASE 1 — Lanzamiento e Instagram (Semana 2-4)
> *Objetivo: Tener presencia en Instagram y empezar a generar tráfico inicial. TODO ES GRATIS en esta fase.*

### 📱 Instagram — Configuración

- [ ] **Crear cuenta de Instagram `@dondeeshoy.uy`** (o `@dondeeshoy_uy`)
  - Bio: "Todo lo que pasa en Uruguay 🇺🇾 Eventos, conciertos, ferias y más → dondeeshoy.com"
  - Link en bio: `dondeeshoy.com`
  - Foto de perfil: logo de la página (el favicon/icon ya existe en `/public`)
  - Cuenta Business (para acceder a stats y a la API de publicación más adelante)

- [ ] **Definir formato de posteos**
  - **Post diario "¿Qué hay hoy?"**: Card con los 3-5 mejores eventos del día
  - **Story diario**: Countdown/reminder de eventos destacados
  - **Carrusel semanal**: "Lo mejor de esta semana" con 5-10 eventos
  - **Reel semanal**: Resumen visual rápido (puede ser generado programáticamente)
  - Todos con link "Ver más en dondeeshoy.com" / "Link en bio"

### 🔧 Técnico — Generador de Imágenes para Instagram

- [ ] **Crear endpoint `/api/social/daily-card`** que genere imágenes automáticas
  - Usar `@vercel/og` (ya integrado en Next.js) o `satori` para generar imágenes 1080x1080
  - Input: fecha (default hoy)
  - Output: imagen PNG con los top 5 eventos del día
  - Diseño: fondo oscuro (#06060C), mismo estilo neon de la página, logo arriba, lista de eventos con hora + nombre + tipo badge
  - También generar versión Story (1080x1920)

- [ ] **Crear endpoint `/api/social/event-card/[slug]`** para cards individuales
  - Genera una imagen visualmente atractiva de UN evento
  - Muestra: nombre, fecha, hora, venue, tipo badge, imagen del evento si tiene
  - Útil para compartir eventos específicos en stories

- [ ] **Crear script `scripts/post-to-instagram.mjs`**
  - Usa la **Instagram Graph API** (requiere Facebook Developer App + token)
  - Flow: genera imagen → sube a contenedor → publica
  - Puede correr como cron job en Vercel o manualmente
  - NOTA: La API de Instagram requiere Business account + Facebook page vinculada

### 📋 No-técnico (Instagram manual al principio)

- [ ] Los primeros días/semanas, hacer los posts manualmente usando las imágenes generadas
- [ ] Generar la imagen con el endpoint, descargarla, y postear desde el celular
- [ ] Responder comentarios y DMs — la interacción en las primeras semanas es clave
- [ ] Seguir cuentas relevantes: venues, productoras, otros medios de eventos en UY
- [ ] Usar hashtags locales: `#Uruguay #Montevideo #EventosUruguay #SalidasUy #QuéHacerHoy`

---

## FASE 2 — Crecimiento Orgánico y SEO (Semana 4-8)
> *Objetivo: Que Google empiece a traer tráfico y que la gente comparta la página.*

### 🔧 Técnico

- [ ] **Mejorar SEO de páginas de evento**
  - Enriquecer el title de cada `/evento/[slug]`: "{nombre} | {fecha} | {venue} — ¿Dónde es Hoy?"
  - Mejorar el `description` meta de cada evento con info útil (incluir precio, hora, lugar)
  - Implementar JSON-LD `Event` schema completo en `src/app/(main)/evento/[slug]/page.tsx`:
    ```
    @type: Event
    name, startDate, endDate, location (Place con address + geo),
    offers (precio), image, description, eventAttendanceMode, organizer
    ```
  - Esto habilita **Rich Results** en Google (cards de eventos directamente en la búsqueda)

- [ ] **Crear página `/departamento/[dept]`** (rutas por departamento)
  - `/departamento/montevideo`, `/departamento/canelones`, etc.
  - Esto captura búsquedas tipo "eventos en Canelones", "qué hacer en Maldonado"
  - Server component con ISR, filtro automático por departamento
  - Agregar al sitemap dinámico

- [ ] **Crear página `/tipo/[type]`** (rutas por tipo de evento)
  - `/tipo/concierto`, `/tipo/feria`, `/tipo/teatro`, etc.
  - Captura "conciertos en Uruguay", "ferias este fin de semana"
  - Agregar al sitemap

- [ ] **Implementar compartir en redes desde la app**
  - El botón de share ya existe en event cards
  - Verificar que usa Web Share API en mobile
  - Agregar fallback con copy-to-clipboard del link
  - Trackear shares en GA4

- [ ] **Agregar Open Graph dinámico por evento**
  - Si el evento tiene imagen, usarla como OG image
  - Si no, generar OG image on-the-fly con `@vercel/og` (similar al card de Instagram)
  - Esto hace que cuando alguien comparte un link de evento en WhatsApp/IG/Twitter, se vea lindo

### 📋 No-técnico

- [ ] Publicar consistentemente en Instagram (mínimo 1 post/día + stories)
- [ ] Empezar a compartir en grupos de Facebook de eventos/salidas en Uruguay
- [ ] Compartir en Twitter/X con hashtags relevantes
- [ ] Si conocés organizadores de eventos, contarles de /publicar (es gratis!) 
- [ ] Monitorear Google Search Console — ver qué queries traen impresiones
- [ ] Responder en Google cuando alguien busca "eventos en montevideo hoy" (si aparecés)

---

## FASE 3 — Publicación Gratis como Gancho (Mes 2-3)
> *Objetivo: Atraer organizadores de eventos para que publiquen gratis. Construir la base de usuarios que después van a querer pagar.*

### 🔧 Técnico

- [ ] **Mejorar el flujo de publicación**
  - Permitir subir imagen directamente (Supabase Storage o Vercel Blob)
  - Agregar preview de cómo va a quedar el evento antes de enviar
  - Agregar campo de Instagram/redes del organizador (útil para cross-promotion)
  - Agregar opción de "evento recurrente" (cada semana, cada mes)

- [ ] **Auto-aprobación para eventos gratuitos**
  - Si el evento es gratuito y pasa validaciones automáticas (no spam, campos completos, geocodificable):
    - Publicar automáticamente sin esperar aprobación manual
    - Enviar email de confirmación al organizador: "Tu evento ya está publicado"
  - Eventos pagos siguen requiriendo aprobación manual (para asegurar calidad)

- [ ] **Dashboard básico para organizadores** (futuro, no urgente)
  - Login simple (magic link por email)
  - Ver sus eventos publicados
  - Ver stats básicas: cuántas vistas tuvo su evento
  - Editar/cancelar sus eventos
  - Esto crea "cuentas" que después son la base para el modelo pago

- [ ] **Emails transaccionales automatizados**
  - Al publicar: "Tu evento fue recibido, lo revisamos en 24h"
  - Al aprobar: "¡Tu evento ya está en dondeeshoy.com! [link]"
  - Al rechazar: "Tu evento no fue publicado por [motivo]. Podés editarlo y reenviarlo."
  - Resumen semanal al admin: cuántos eventos, cuántas submissions, stats

- [ ] **Agregar "Publicado por [organizador]" en las cards de evento**
  - Diferencia visual entre eventos scrapeados y eventos publicados por organizadores
  - Badge "Publicado por el organizador" da más credibilidad
  - El organizador ve valor en que su marca aparezca

### 📋 No-técnico

- [ ] **Hacer outreach a organizadores**
  - Contactar productoras de eventos en UY por Instagram/email
  - Pitch: "Publicá gratis en la plataforma de eventos más completa de Uruguay"
  - Enfocarse en: bares con eventos semanales, centros culturales, ferias, talleres
  - Estos son los que más se benefician (no están en ticketeras grandes)

- [ ] **Crear contenido de valor**
  - Posteos tipo "Guía: Los 10 mejores eventos gratuitos este finde"
  - "Dónde salir si estás en Montevideo por primera vez"
  - Esto atrae tráfico orgánico y posiciona como referencia

- [ ] Monitorear métricas clave:
  - Usuarios únicos/día (GA4)
  - Eventos publicados por organizadores vs scrapeados
  - Tasa de retorno (usuarios que vuelven)
  - Páginas más visitadas
  - Búsquedas en Google Search Console

---

## FASE 4 — Publicidad en Instagram Ads (Mes 3-4)
> *Objetivo: Acelerar el crecimiento con inversión mínima en ads. Solo hacer esto cuando ya haya contenido y la página funcione perfecto.*

### 💰 Instagram Ads — Estrategia

- [ ] **Presupuesto inicial: $3-5 USD/día** (muy bajo, para testear)
- [ ] **Audiencia target**:
  - Ubicación: Uruguay (principal Montevideo, Canelones, Maldonado)
  - Edad: 18-40
  - Intereses: Eventos, salidas nocturnas, música en vivo, cultura, gastronomía
  - También testear audiencias lookalike basadas en visitantes del sitio (requiere Meta Pixel)

- [ ] **Tipos de ads a probar**:
  1. **"¿No sabés qué hacer hoy?"** → link a dondeeshoy.com (awareness)
  2. **Carrusel con eventos destacados del finde** → link a /proximos (engagement)
  3. **"Publicá tu evento gratis"** → link a /publicar (captación de organizadores)
  4. **Story ad con los mejores eventos de esta noche** → link a home

- [ ] **Creativos**: Usar las mismas imágenes que genera el endpoint [/api/social/daily-card](http://_vscodecontentref_/1)
- [ ] **A/B testing**: Probar distintos copies, imágenes, audiencias. Medir CTR y costo por click.

### 🔧 Técnico

- [ ] **Instalar Meta Pixel**
  - Agregar script en [layout.tsx](http://_vscodecontentref_/2) (similar a GA4)
  - Configurar eventos: PageView, ViewContent (cuando ven un evento), Lead (cuando publican)
  - Esto permite retargeting y audiencias lookalike

- [ ] **Crear UTM tracking**
  - Todos los links desde Instagram y ads deben tener UTMs: `?utm_source=instagram&utm_medium=ad&utm_campaign=awareness_v1`
  - Trackear en GA4 cuánto tráfico viene de cada campaña
  - Evaluar ROI: costo por visitante, costo por evento publicado

---

## FASE 5 — Automatización de Instagram (Mes 4-6)
> *Objetivo: Reducir el trabajo manual de postear en Instagram a cero.*

### 🔧 Técnico

- [ ] **Implementar publicación automática en Instagram**
  - Opción A: **Instagram Graph API** (requiere Business account + Facebook Page + App Review)
    - Crear Facebook Developer App
    - Solicitar permisos: `instagram_basic`, `instagram_content_publish`
    - Implementar flow en `scripts/post-to-instagram.mjs`:
      1. Llama a [/api/social/daily-card](http://_vscodecontentref_/3) para generar imagen
      2. Sube imagen como contenedor via API
      3. Publica el contenedor con caption generado dinámicamente
    - Agregar como cron job en Vercel (ej: todos los días a las 10:00 UY)
  
  - Opción B: **Usar servicio intermediario** (más fácil)
    - Servicios como **Buffer**, **Later**, o **Publer** (algunos tienen free tier)
    - Generar imágenes con el endpoint, programar publicaciones via API del servicio
    - Menos control pero más fácil de implementar

- [ ] **Auto-generar captions con IA**
  - Usar OpenAI (ya tenés la API key) para generar captions dinámicos
  - Input: lista de eventos del día
  - Output: caption con emojis, hashtags, CTA a la web
  - Guardar templates de caption y rotar

- [ ] **Auto-story de eventos que están por empezar**
  - Cron que revisa qué eventos empiezan en las próximas 3 horas
  - Genera story image con countdown
  - Publica automáticamente (requiere API de Instagram)

- [ ] **Feed de Twitter/X automático** (opcional, menos prioritario)
  - Twitter API es más fácil que Instagram
  - Postear "📍 Hoy en Uruguay: {top 3 eventos}" con link
  - Un cron job diario simple

---

## FASE 6 — Monetización (Mes 6+)
> *Objetivo: Empezar a generar ingresos una vez que haya tráfico demostrable.*
> *Pre-requisito: Tener al menos ~500-1000 usuarios únicos/día para que tenga sentido.*

### 💰 Modelo 1 — Sidebar Ads (ya hay placeholders)

Los ad slots ya existen en [desktop-sidebar.tsx](http://_vscodecontentref_/4) (líneas ~254-350). Actualmente muestran "Magma Futura" y "RedTickets" como placeholders.

- [ ] **Crear sistema de gestión de ads**
  - Tabla `ads` en la DB: [id](http://_vscodecontentref_/5), `advertiser_name`, [title](http://_vscodecontentref_/6), [description](http://_vscodecontentref_/7), `logo_url`, `link`, `color_accent`, `position` (sidebar_1, sidebar_2), `start_date`, `end_date`, `is_active`, `click_count`, `impression_count`
  - Endpoint `GET /api/ads/sidebar` que retorna los anuncios activos
  - Modificar [desktop-sidebar.tsx](http://_vscodecontentref_/8) para renderizar ads dinámicos desde la DB en vez de hardcoded
  - Trackear impresiones (cada vez que se renderiza) y clicks (redirect via [/api/ads/click/[id]](http://_vscodecontentref_/9))

- [ ] **Precios sugeridos (empezar muy bajo)**
  - Sidebar Card: $20-50 USD/mes (al principio negociable, hasta regalar a cambio de testimonial)
  - Target: venues, productoras, ticketeras, bares con eventos regulares
  - Ofrecer: "Tu negocio visible para [X] personas/mes que buscan eventos en Uruguay"

- [ ] **Crear página `/anunciar`** (landing para anunciantes)
  - Explicar los formatos disponibles
  - Mostrar stats de tráfico (visitantes/mes, páginas vistas, demografía)
  - Formulario de contacto o WhatsApp directo
  - Testimoniales si hay (aunque sean de los primeros gratis)

### 💰 Modelo 2 — Eventos Destacados (Premium Listings)

- [ ] **"Destacar mi evento" como servicio pago**
  - Eventos publicados via /publicar son gratis y se muestran normalmente
  - Por un pago, tu evento aparece:
    - En la sección "Destacados" del home (arriba del feed)
    - Con borde/glow especial en las cards (badge "⭐ Destacado")
    - En el sidebar como "Próximos Destacados"
    - Prioridad en el mapa (marker especial)
    - Incluido en el post diario de Instagram

- [ ] **Implementar sistema de destacados**
  - Campo `is_featured` + `featured_until` en tabla `events`
  - Sección "Destacados" al inicio del home (antes del feed normal)
  - Visual diferenciado: borde neon más intenso, badge, posición privilegiada
  - Panel de admin para activar/desactivar destacados manualmente

- [ ] **Precios sugeridos**
  - Destacar 1 evento por 1 día: $5-10 USD
  - Destacar 1 evento por 1 semana: $15-30 USD
  - Pack mensual (4 eventos): $40-80 USD
  - Al principio: regalar destacados a los primeros organizadores para que vean el valor

### 💰 Modelo 3 — Banners en cards de eventos (Mobile-friendly)

- [ ] **Ad cards intercaladas en el feed**
  - Cada X eventos (ej: cada 8), insertar una card de publicidad
  - Mismo estilo visual que un evento pero con badge "Publicidad"
  - Puede promocionar un venue, marca, o servicio
  - Es el formato que mejor funciona en mobile (sidebar no se ve en mobile)

- [ ] **Implementación**
  - Componente `AdCard` con el mismo diseño glassmorphism que `EventCard`
  - Texto "Publicidad" discreto
  - Se inserta en el array de eventos en [event-list.tsx](http://_vscodecontentref_/10) cada N posiciones
  - Datos desde la tabla `ads` con `position = 'feed'`

### 💰 Modelo 4 — Futuro (no implementar todavía)

- [ ] **Cobrar a organizadores por publicación** (cuando haya suficiente tráfico)
  - Mantener plan gratuito básico (siempre)
  - Plan pago: publicación ilimitada + stats detalladas + destacados + imagen en card
  - Esto requiere login de organizadores (Fase 3)

- [ ] **Comisión por venta de entradas** (muy futuro)
  - Si llegás a hacer integración de venta de tickets propia
  - Comisión del 5-10% sobre cada venta
  - Requiere pasarela de pago (MercadoPago UY)
  - Esto compite con RedTickets/CobraTicket — pensarlo bien

- [ ] **API paga para terceros**
  - Si otro sitio/app quiere usar tus datos de eventos
  - API rate-limited gratis + plan pago con más requests

---

## MÉTRICAS CLAVE POR FASE

| Fase | Métrica objetivo | Target mínimo |
|------|-----------------|---------------|
| 0 | Sitio indexado en Google | Aparecer en búsquedas de marca |
| 1 | Seguidores Instagram | 200-500 en el primer mes |
| 2 | Usuarios únicos/día | 50-100 orgánicos |
| 3 | Eventos publicados por organizadores | 10-20/mes |
| 4 | CTR de Instagram Ads | >1.5% (bueno para awareness) |
| 5 | Posts automatizados | 100% automático, 0 intervención manual |
| 6 | Ingresos | Primer anunciante pagando |

---

## RESUMEN DE INVERSIÓN NECESARIA

| Concepto | Costo | Cuándo |
|----------|-------|--------|
| Dominio `.com` | ~$12 USD/año | AHORA |
| Vercel Pro (si necesitás más cron/bandwidth) | $20 USD/mes | Cuando el free tier no alcance |
| Instagram Ads | $3-5 USD/día = ~$100-150/mes | Fase 4 (mes 3) |
| Resend (email) | Gratis hasta 100 emails/día | Ya |
| OpenAI API (clasificación + captions) | ~$5-10 USD/mes | Ya pagás por clasificación |
| Buffer/Later (si no hacés API directa) | $0-15 USD/mes | Fase 5 |
| **TOTAL hasta Fase 4** | **~$130-180 USD/mes** | |

---

## STACK TÉCNICO A AGREGAR

| Herramienta | Para qué | Fase |
|-------------|----------|------|
| Google Analytics 4 | Tracking de tráfico y comportamiento | 0 |
| Google Search Console | Monitorear SEO e indexación | 0 |
| Meta Pixel | Retargeting y audiencias para ads | 4 |
| `@vercel/og` o `satori` | Generar imágenes para OG y social posts | 1 |
| Instagram Graph API | Publicación automática | 5 |
| Supabase Storage / Vercel Blob | Upload de imágenes de eventos | 3 |
| JSON-LD (schema.org) | Rich snippets en Google | 0-2 |

---

## ORDEN DE PRIORIDAD (qué hacer primero)

1. **Comprar dominio + DNS + SSL** → sin esto no arranca nada
2. **Google Search Console + sitemap** → para empezar a indexar
3. **Google Analytics 4** → para medir todo desde el día 1
4. **Instagram** → crear cuenta, empezar a postear manualmente
5. **Endpoint de generación de imágenes** → para agilizar los posts de IG
6. **SEO on-page + JSON-LD** → para capturar tráfico de Google
7. **Páginas por departamento y tipo** → más landing pages = más SEO
8. **Mejorar /publicar + auto-aprobación gratuitos** → atraer organizadores
9. **Instagram Ads** → cuando ya tengas contenido y la página pulida
10. **Automatizar Instagram** → cuando el volumen lo justifique
11. **Ads en sidebar + destacados** → cuando tengas tráfico medible
12. **Ad cards en el feed** → cuando tengas anunciantes

---

## NOTAS FINALES

- **No cobres nada hasta tener al menos 500 usuarios/día**. Antes de eso, todo gratis. El objetivo es construir audiencia y reputación primero.
- **Los primeros anunciantes deberían ser "trueques"**: les das publicidad gratis a cambio de que compartan tu página / te mencionen.
- **Instagram es tu canal principal de adquisición**. Google trae tráfico pasivo, pero Instagram es donde la gente descubre cosas para hacer hoy/este finde.
- **Mantené la publicación de eventos SIEMPRE gratis** para eventos básicos/gratuitos. Eso es lo que atrae organizadores. El pago es por EXTRAS (destacar, imagen premium, stats).
- **Medí todo**. Sin datos no podés convencer a nadie de pagar. GA4 + Search Console son innegociables desde el día 1.
- **La estética neon/glass es un diferencial**. Usala en Instagram, en los OG images, en todo. Es tu identidad visual.
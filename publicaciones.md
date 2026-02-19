# Sistema de Publicación de Eventos — ¿Dónde es Hoy?

Guía completa del flujo de publicación: qué hace el sistema, cómo funciona cada parte, y qué tenés que hacer vos como admin.

---

## 1. Flujo completo de una solicitud

```
Organizador llena /publicar
        ↓
POST /api/submissions (valida + guarda en DB)
        ↓
Email automático a hola@dondeeshoy.com
        ↓
Vos revisás en Supabase y decidís
        ↓
Si aprobás → cargás el evento manualmente en la tabla `events`
        ↓
Organizador recibe email de confirmación (manual por ahora)
```

---

## 2. Estado actual del sistema

| Componente | Estado | Notas |
|------------|--------|-------|
| Formulario `/publicar` | ✅ Listo | Funciona completamente |
| API `/api/submissions` | ✅ Lista | Valida y guarda en DB |
| Tabla `event_submissions` | ✅ Lista | Migración aplicada |
| Notificaciones email | ⚠️ Requiere configuración | Falta `RESEND_API_KEY` |
| Panel de admin | ❌ No existe | Revisión manual en Supabase |

---

## 3. La página `/publicar`

**Ruta:** `src/app/(main)/publicar/page.tsx`

Es un formulario de 4 secciones con validación client-side (React Hook Form + Zod):

| Sección | Campos |
|---------|--------|
| **Tu evento** | Nombre, fecha, hora (opcional), tipo (14 opciones), descripción (max 500 chars) |
| **Ubicación** | Nombre del venue, dirección, departamento (select con los 19 departamentos) |
| **Entradas** | Toggle Gratuito / Con costo → si pago: rango de precio + link de venta |
| **Contacto** | Nombre del organizador, email |

Después del submit exitoso, la misma página muestra un estado de confirmación con el mensaje:
> *"Tu solicitud fue enviada correctamente. Te contactaremos por email cuando sea revisada."*

---

## 4. El endpoint `POST /api/submissions`

**Ruta:** `src/app/api/submissions/route.ts`

Qué hace:
1. **Rate limit:** máximo 5 solicitudes por IP por hora (Upstash Redis). Si se supera → 429.
2. **Validación Zod:** verifica todos los campos. Si algo falla → 422 con detalle de errores.
3. **Inserta en DB:** guarda en la tabla `event_submissions` con `status = 'pending'`.
4. **Envía email:** llama a `notifyNewSubmission()` para avisarte. Si el email falla, la solicitud igual se guarda (no bloquea).
5. **Retorna 201** con el `id` de la solicitud creada.

---

## 5. La tabla `event_submissions`

**Schema:** `src/lib/db/schema/submissions.ts`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK auto-generado |
| `contact_name` | varchar(255) | Nombre del organizador |
| `contact_email` | varchar(255) | Email del organizador |
| `event_name` | varchar(255) | Nombre del evento |
| `event_date` | varchar(20) | Fecha en formato YYYY-MM-DD |
| `event_time` | varchar(10) | Hora HH:MM (opcional) |
| `event_type` | enum | Uno de los 14 tipos existentes |
| `description` | text | Descripción del evento |
| `venue_name` | varchar(255) | Nombre del lugar |
| `venue_address` | varchar(512) | Dirección |
| `city` | varchar(100) | Departamento |
| `is_free` | boolean | true = gratuito |
| `price_range` | varchar(100) | Ej: "$300 – $600 UYU" (opcional) |
| `ticket_url` | varchar(2048) | Link de venta/inscripción (opcional) |
| `image_url` | varchar(2048) | URL del flyer (opcional) |
| `status` | enum | `pending` / `approved` / `rejected` |
| `notes` | text | Notas internas tuyas (opcional) |
| `submitted_at` | timestamp | Cuándo se envió |
| `reviewed_at` | timestamp | Cuándo lo revisaste (opcional) |

---

## 6. Las notificaciones por email

**Archivo:** `src/lib/email.ts`

Usa **Resend** (free tier: 100 emails/día).

Cuando llega una solicitud, recibís un email en `hola@dondeeshoy.com` con:
- Todos los datos del evento
- Datos de contacto del organizador
- Un botón "Revisar en la base de datos" que lleva al editor de Supabase

### Configuración necesaria

Tenés que agregar estas variables de entorno (en `.env.local` y en Vercel):

```env
RESEND_API_KEY=re_xxxxxxxxxxxx
```

**Pasos para configurar Resend:**
1. Crear cuenta en [resend.com](https://resend.com) (gratis)
2. Ir a **Domains** → agregar `dondeeshoy.com`
3. Agregar los registros DNS que te indica (MX, TXT, DKIM)
4. Una vez verificado, crear una API Key en **API Keys**
5. Pegar la key en `.env.local` como `RESEND_API_KEY`

> ⚠️ Hasta que el dominio esté verificado, Resend solo permite enviar a tu propio email de la cuenta. Para testing podés cambiar `ADMIN_EMAIL` en `src/lib/email.ts` a tu email personal.

---

## 7. Aplicar la migración en Supabase (YA ESTÁ HECHO)

La migración SQL está en `src/lib/db/migrations/0002_add_event_submissions.sql`.

**Pasos:**
1. Ir a [supabase.com](https://supabase.com) → tu proyecto
2. Ir a **SQL Editor**
3. Pegar y ejecutar el contenido del archivo `0002_add_event_submissions.sql`
4. Verificar que la tabla `event_submissions` aparece en **Table Editor**

---

## 8. Cómo revisás las solicitudes (flujo de admin)

### Ver solicitudes pendientes

En Supabase → **Table Editor** → tabla `event_submissions` → filtrar por `status = pending`.

O con SQL:
```sql
SELECT * FROM event_submissions WHERE status = 'pending' ORDER BY submitted_at DESC;
```

### Aprobar una solicitud

1. Revisás los datos en `event_submissions`
2. Si está OK, creás el evento manualmente en la tabla `events` con los datos del formulario
3. Actualizás el status en `event_submissions`:
```sql
UPDATE event_submissions
SET status = 'approved', reviewed_at = NOW()
WHERE id = 'uuid-de-la-solicitud';
```
4. Mandás un email manual al organizador avisándole que fue publicado (por ahora es manual)

### Rechazar una solicitud

```sql
UPDATE event_submissions
SET status = 'rejected', reviewed_at = NOW(), notes = 'Motivo del rechazo'
WHERE id = 'uuid-de-la-solicitud';
```

---

## 9. PARA ACTIVAR EL SISTEMA — Lo que tenés que hacer

### Paso 1: Configurar Resend (para recibir emails)

Editá tu archivo `.env` y agregá:

```env
RESEND_API_KEY=re_tu_api_key_aqui
```

**O si querés probar rápido sin configurar dominio:**
1. Cambiá temporalmente en `src/lib/email.ts`:
   ```ts
   const ADMIN_EMAIL = "tu-email-personal@gmail.com";
   ```
2. Agregá tu API key de Resend en `.env`
3. Probá el formulario

### Paso 2: Verificar la tabla en Supabase

1. Entrá a [supabase.com](https://supabase.com) → tu proyecto
2. Ir a **Table Editor**
3. Buscá la tabla `event_submissions`
4. Si no existe, ejecutá la migración `0002_add_event_submissions.sql`

### Paso 3: Probar el sistema completo

1. Levantá el servidor: `npm run dev`
2. Andá a **http://localhost:3000/publicar**
3. Llená el formulario con datos de prueba
4. Verificá:
   - Que se guarde en Supabase (tabla `event_submissions`)
   - Que recibás el email (si configuraste Resend)

---

## 10. Qué falta / próximos pasos

| Feature | Prioridad | Descripción |
|---------|-----------|-------------|
| **Email al organizador** | Alta | Enviar email automático cuando aprobás/rechazás (agregar función en `email.ts`) |
| **Panel de admin** | Media | Página `/admin/submissions` con lista de pendientes y botones aprobar/rechazar |
| **Auto-publicación** | Baja | Si el evento es gratuito y pasa validaciones básicas, publicarlo automáticamente |
| **Geocodificación** | Media | Al aprobar, geocodificar la dirección para tener lat/lng y mostrarlo en el mapa |
| **Imagen upload** | Baja | En vez de URL, permitir subir imagen directamente a Supabase Storage |

---

## 11. Resumen de archivos creados/modificados

```
src/
├── lib/
│   ├── email.ts                          ← NUEVO: notifyNewSubmission() con Resend
│   └── db/
│       ├── schema/
│       │   ├── submissions.ts            ← NUEVO: tabla event_submissions
│       │   └── index.ts                  ← MODIFICADO: exporta submissions
│       └── migrations/
│           └── 0002_add_event_submissions.sql  ← NUEVO: migración SQL
├── app/
│   ├── (main)/
│   │   └── publicar/
│   │       └── page.tsx                  ← NUEVO: formulario /publicar
│   └── api/
│       └── submissions/
│           └── route.ts                  ← NUEVO: POST /api/submissions
└── components/
    └── layout/
        └── header.tsx                    ← MODIFICADO: botón "Publicar" en desktop
```

El sidebar (`desktop-sidebar.tsx`) ya tenía los links a `/publicar` correctamente configurados con `<Link>` de Next.js.

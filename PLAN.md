# ¿Dónde es Hoy? — Plan de Implementación (5 Features prioritarias)

> Fecha: 17 de febrero de 2026
> Foco: utilidad situacional — que la gente decida qué hacer AHORA, no solo que vea eventos.

---

## Resumen de features

| # | Feature | Impacto | Complejidad | Costo |
|---|---------|---------|-------------|-------|
| 1 | Filtro rápido "Mañana / Este finde" en `/proximos` | 🔴 Muy alto | Baja | $0 |
| 2 | Compartir evento (Web Share API + WhatsApp) | 🟡 Medio-alto | Muy baja | $0 |
| 3 | Mini-mapa Leaflet en detalle de evento | 🟠 Alto | Baja | $0 (Leaflet + OSM tiles son gratis) |
| 4 | Mejorar clasificación con IA (reducir "otro") | 🟠 Alto | Media | ~$0.01/evento (gpt-4o-mini) |
| 5 | "Cerca de mí" — ordenar por distancia | 🟠 Alto | Media | $0 |

---

## Feature 1 — Filtro rápido temporal en `/proximos`

**Estado actual:** ✅ Implementado (17/02/2026) — pendiente validación manual final en UI

### Qué hace
Agrega una fila de botones rápidos **"Mañana" / "Este finde"** encima del listado de `/proximos`. El usuario toca uno y ve solo los eventos de esa ventana temporal. Por defecto no hay ninguno seleccionado (se muestra todo como ahora).

### Cómo implementarlo paso a paso

#### Paso 1: Agregar helper de fechas de fin de semana
**Archivo:** `src/lib/format.ts`

Agregar una función `getWeekendDatesUY()` que devuelva un `{ start: string, end: string }` con el sábado y domingo del fin de semana actual o próximo. Usar la lógica existente de `getTodayUY()` como base:
- Si hoy es viernes → `{ start: hoy, end: domingo }`
- Si hoy es sábado → `{ start: hoy, end: mañana }`
- Si hoy es domingo → `{ start: hoy, end: hoy }`
- Cualquier otro día → `{ start: próximo viernes, end: próximo domingo }`

También agregar `getTodayUY()` que ya existe, confirmar que se puede reutilizar.

#### Paso 2: Agregar el param `when` a los search params
**Archivo:** `src/app/(main)/proximos/page.tsx`

En `ProximosContent`, leer `params.when` (valores posibles: `"manana"`, `"finde"`). Según el valor:
- `"manana"` → llamar `getUpcomingEvents(tomorrowUY, 0, filters)` (solo mañana)
- `"finde"` → calcular fechas con `getWeekendDatesUY()` y usar `getEventsBetweenDates(start, end, filters)` (viernes a domingo)
- sin param → comportamiento actual (`getUpcomingEvents(tomorrow, 14, filters)`)

La query `getUpcomingEvents` ya existe en `src/lib/queries.ts` y acepta `startDate` + `daysAhead`. Para "mañana" se puede pasar `daysAhead=0`.

#### Paso 3: Crear componente de pills temporales
**Archivo:** Nuevo → `src/components/events/time-filter.tsx`

Componente client (`"use client"`) que renderiza 2 botones pill:
- **Mañana** — `?when=manana`
- **Este finde** — `?when=finde`

Lógica igual que los chips de `event-filters.tsx`: lee `searchParams`, usa `useRouter` + `useTransition` para navegar con `?when=X`. Si ya está activo, al tocar de nuevo quita el param (vuelve a "todos").

Estilo: usar los mismos `cn()` + estilos neon que los chips existentes. Ponerle un color diferenciador (ej. `neon-cyan` o `neon-amber`). Debe verse como una fila horizontal scroll en mobile.

#### Paso 4: Montar en la página
**Archivo:** `src/app/(main)/proximos/page.tsx`

Renderizar `<TimeFilter />` justo antes de `<EventFilters />`. Pasarle `className="mb-3"`.

#### Paso 5: Ajustar header según filtro activo
Cambiar el subtítulo "Eventos de los próximos días" dinámicamente:
- `when=manana` → "Eventos de mañana"
- `when=finde` → "Eventos de este fin de semana"

### Archivos a tocar
- `src/lib/format.ts` — agregar `getWeekendDatesUY()`
- `src/components/events/time-filter.tsx` — nuevo componente
- `src/app/(main)/proximos/page.tsx` — leer `when`, ajustar query y header

### Criterio de aceptación
- Tocar "Mañana" muestra solo eventos de mañana, "Este finde" muestra viernes+sábado+domingo
- Los filtros de tipo/género/departamento siguen funcionando combinados con el temporal
- Sin filtro temporal seleccionado, se ve todo como antes (14 días)
- Funciona en mobile con scroll horizontal

---

## Feature 3 — Mini-mapa Leaflet en detalle de evento

**Estado actual:** ✅ Implementado (17/02/2026) — mini-mapa en detalle cuando hay coordenadas válidas

### Qué hace
Cuando un evento tiene coordenadas (`latitude`/`longitude`), muestra un mapa estático pequeño (~200px de alto) con un pin en la ubicación del venue, dentro de la página de detalle del evento. Si no hay coordenadas, no se muestra nada.

### Costo: $0
Leaflet ya está instalado (`leaflet@^1.9.4`, `react-leaflet@^5.0.0`). Los tiles de OpenStreetMap son gratuitos. No hay tokens ni API keys necesarios.

### Cómo implementarlo paso a paso

#### Paso 1: Crear componente `VenueMiniMap`
**Archivo:** Nuevo → `src/components/events/venue-mini-map.tsx`

Componente client (`"use client"`) que recibe `{ lat: number, lng: number, venueName: string }`.

Usar los mismos imports que ya usa `event-map.tsx`:
```tsx
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
```

Configuración del mapa:
- `center={[lat, lng]}`, `zoom={15}`
- `style={{ height: "200px", width: "100%" }}`, `className="rounded-xl overflow-hidden"`
- `zoomControl={false}`, `scrollWheelZoom={false}`, `dragging={false}`, `attributionControl={true}`
- Un solo `<Marker>` en `[lat, lng]` con `<Popup>{venueName}</Popup>`
- Tile URL: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- Crear el ícono del marker reutilizando `createMarkerIcon()` de `event-map.tsx` (copiar la función o exportarla)

Envolver todo en un `dynamic(() => import(...), { ssr: false })` porque Leaflet no funciona en SSR. Exportar el componente dinámico directamente.

#### Paso 2: Importar dinámicamente en `event-detail.tsx`
**Archivo:** `src/components/events/event-detail.tsx`

Usar `next/dynamic`:
```tsx
import dynamic from "next/dynamic";
const VenueMiniMap = dynamic(() => import("./venue-mini-map"), { ssr: false });
```

#### Paso 3: Renderizar el mapa condicionalmente
**Archivo:** `src/components/events/event-detail.tsx`

Después del bloque del venue (la card con `<MapPin>`), agregar:
```tsx
{event.latitude && event.longitude && (
  <div className="mt-2">
    <VenueMiniMap
      lat={parseFloat(event.latitude)}
      lng={parseFloat(event.longitude)}
      venueName={event.venueName}
    />
  </div>
)}
```

Nota: `event.latitude` y `event.longitude` son `string | null` (tipo `decimal` de Drizzle), hay que parsearlos a `number`.

### Archivos a tocar
- `src/components/events/venue-mini-map.tsx` — nuevo componente
- `src/components/events/event-detail.tsx` — importar y renderizar

### Criterio de aceptación
- El mapa se muestra solo si hay coordenadas
- El pin está centrado en el venue
- No se rompe el SSR (import dinámico con `ssr: false`)
- El mapa tiene bordes redondeados y se ve bien en mobile
- No requiere ningún token ni API key

---

## Feature 5 — "Cerca de mí" (ordenar por distancia)

**Estado actual:** ✅ Implementado (17/02/2026) — geolocalización client-side + orden por distancia + etiqueta km/m

### Qué hace
Un botón "Cerca de mí" que pide permiso de ubicación al usuario (Geolocation API del browser), y reordena los eventos por distancia al usuario. Sin registro, sin guardar datos. La ubicación se usa solo en memoria del client.

### Cómo implementarlo paso a paso

#### Paso 1: Crear hook `useGeolocation`
**Archivo:** Nuevo → `src/hooks/use-geolocation.ts`

Hook que expone `{ latitude, longitude, loading, error, requestLocation }`:
```ts
export function useGeolocation() {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocalización no disponible");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, []);

  return { position, loading, error, requestLocation };
}
```

#### Paso 2: Crear función de distancia haversine
**Archivo:** `src/lib/utils.ts` (agregar al final)

```ts
/** Distancia en km entre dos puntos (haversine) */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

#### Paso 3: Agregar botón "Cerca de mí" en la UI
**Archivo:** `src/components/events/event-filters.tsx` o crear un componente separado `src/components/events/nearby-button.tsx`

Un botón con icono `<Navigation />` (de lucide-react) que al tocarse llama a `requestLocation()`. Mientras carga muestra un spinner. Una vez obtenida la ubicación, se guarda en un state/context y se aplica al listado.

#### Paso 4: Reordenar eventos en el client
**Opción recomendada:** hacer el sort en el client, no en el server.

En la página principal (`page.tsx`) o en `event-list.tsx`, envolver los eventos en un componente client que:
1. Recibe los eventos como props (ya cargados del server)
2. Si el usuario activó "cerca de mí", ordena por distancia haversine usando `event.latitude`/`event.longitude`
3. Muestra la distancia en cada card ("a 2.3 km")

Para esto, necesitar hacer que `page.tsx` (que es server component) pase los eventos a un wrapper client. La estructura sería:

```
page.tsx (server) → carga eventos → pasa a <ProximosClient events={...} />
ProximosClient (client) → tiene el state de ubicación → ordena y renderiza
```

Alternativamente, se puede mantener la página server y solo envolver el `<EventList>` en un client component que reciba la ubicación del usuario y reordene.

#### Paso 5: Mostrar distancia en la card
**Archivo:** `src/components/events/event-card.tsx`

Agregar prop opcional `distance?: number` (en km). Si existe, mostrar debajo del venue:
```tsx
{distance != null && (
  <span className="text-[10px] text-neon-cyan">
    📍 {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
  </span>
)}
```

### Archivos a tocar
- `src/hooks/use-geolocation.ts` — nuevo hook
- `src/lib/utils.ts` — agregar `haversineKm()`
- `src/components/events/nearby-button.tsx` — nuevo componente (botón)
- `src/components/events/event-card.tsx` — prop `distance` opcional
- `src/app/(main)/proximos/page.tsx` — integrar con el listado (wrapper client o refactor parcial)

### Criterio de aceptación
- El botón pide permiso de ubicación (no se pide automáticamente)
- Los eventos se reordenan por distancia, los más cercanos primero
- Se muestra la distancia en cada card
- Eventos sin coordenadas van al final
- No se guarda ni envía la ubicación del usuario a ningún servidor
- Si el usuario niega el permiso, se muestra un mensaje y todo sigue funcionando normal

---

## Feature 2 — Compartir evento

**Estado actual:** ✅ Implementado (17/02/2026) — Web Share + fallback clipboard + botón WhatsApp

### Qué hace
Agrega un botón de compartir en dos lugares:
1. **En la card de evento** — ícono pequeño de share
2. **En el detalle del evento** — botón más prominente

Usa la **Web Share API** nativa en mobile (abre el sheet nativo de compartir del OS). En desktop, fallback a copiar link al clipboard. También agrega un botón de **WhatsApp direct share** como alternativa siempre visible.

### Cómo implementarlo paso a paso

#### Paso 1: Crear componente `ShareButton`
**Archivo:** Nuevo → `src/components/shared/share-button.tsx`

Componente client que recibe `{ title: string, url: string, variant: "icon" | "full" }`.

```tsx
"use client";

function ShareButton({ title, url, variant = "icon" }: Props) {
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  const handleShare = async () => {
    if (canShare) {
      await navigator.share({ title, url });
    } else {
      await navigator.clipboard.writeText(url);
      // mostrar toast "Link copiado"
    }
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;

  return (
    <div className="flex items-center gap-2">
      <button onClick={handleShare}>
        {/* icono Share2 de lucide-react */}
      </button>
      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
        {/* icono de WhatsApp (SVG inline sencillo) o texto "WhatsApp" */}
      </a>
    </div>
  );
}
```

Para el variant `"icon"`: solo muestra los iconos pequeños.
Para el variant `"full"`: muestra botones con texto "Compartir" y "WhatsApp".

#### Paso 2: Agregar en event-card.tsx
**Archivo:** `src/components/events/event-card.tsx`

Agregar `<ShareButton variant="icon" />` en la esquina superior derecha de la card (al lado del badge de tipo, o en un overlay sobre la imagen). El `url` se construye como:
```ts
const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/evento/${slug}`;
```

Usar `e.preventDefault()` y `e.stopPropagation()` en el botón de share para que no navegue al detalle del evento al tocar compartir.

#### Paso 3: Agregar en event-detail.tsx
**Archivo:** `src/components/events/event-detail.tsx`

Agregar `<ShareButton variant="full" />` después de la descripción del evento, antes del CTA de tickets. Usar el título del evento y la URL canónica.

### Archivos a tocar
- `src/components/shared/share-button.tsx` — nuevo componente
- `src/components/events/event-card.tsx` — agregar botón share
- `src/components/events/event-detail.tsx` — agregar botón share

### Criterio de aceptación
- En mobile se abre el sheet nativo al compartir
- En desktop se copia el link y se muestra feedback ("Copiado")
- El botón de WhatsApp abre WhatsApp con el texto prellenado
- En la card, el botón de share no navega al detalle del evento
- Funciona sin JavaScript del server (todo client-side)

---

## Feature 4 — Mejorar clasificación con IA (reducir "otro")

**Estado actual:** ✅ Implementado (17/02/2026) — prompt mejorado + budget por lote + métrica de clasificación + script de reclasificación

### Qué hace
Completa la integración de OpenAI como fallback de clasificación. El clasificador heurístico (regex en `classifier.ts`) ya cubre muchos casos, pero los eventos que caen en `"otro"` necesitan un pase extra por IA. El sistema ya tiene `ai-client.ts` con `classifyEventWithAi()` funcionando y `pipeline.ts` lo invoca, pero falta:
1. Ampliar las reglas heurísticas para cubrir más casos sin IA
2. Asegurar que el threshold de confianza y el budget de IA estén bien calibrados
3. Reclasificar el backlog de eventos existentes marcados como "otro"

### Cómo implementarlo paso a paso

#### Paso 1: Auditar y ampliar reglas heurísticas
**Archivo:** `src/processing/classifier.ts`

Ya se hicieron mejoras recientes (se agregaron keywords para deportivo, taller, etc). Seguir expandiendo:

- Revisar los eventos activos en DB que están marcados como `"otro"` y buscar patrones comunes que se puedan agregar como regex. Correr una query:
  ```sql
  SELECT name, venue_name, description FROM events WHERE event_type = 'otro' AND status = 'active';
  ```
- Agregar los patrones que aparezcan (nombres de venues conocidos, palabras clave que se repiten).

**Regla general:** si un patrón aparece en 3+ eventos, merece una regex. Si es un caso aislado, dejar que la IA lo resuelva.

#### Paso 2: Calibrar el prompt de IA
**Archivo:** `src/processing/ai-client.ts`

El prompt actual ya es bueno. Mejoras sugeridas:
- Agregar al system prompt: `"Si el evento es una carrera, trail, MTB, triatlón, travesía a nado, desafío físico, o competencia deportiva amateur, clasificarlo como 'deportivo'."`
- Agregar: `"Si el evento incluye DJ's, line-up, o empieza después de las 22:00, clasificar como 'fiesta'."`
- Agregar ejemplos few-shot si hay budget de tokens (2-3 ejemplos con nombre→tipo esperado).

#### Paso 3: Verificar integración en pipeline
**Archivo:** `src/processing/pipeline.ts`

El pipeline ya llama a `shouldUseAiClassification()` y si es true llama a `classifyEventWithAi()`. Verificar:
- Que `AI_BUDGET_PER_BATCH` (actualmente 6) sea suficiente. Si hay muchos "otro" por batch, subir a 10-15.
- Que el resultado de IA se guarde con `confidenceScore` en la DB.
- Que si la IA también devuelve "otro" con baja confianza, el evento quede marcado pero no se reintente en cada scrape.

#### Paso 4: Script de reclasificación de backlog
**Archivo:** Nuevo → `scripts/reclassify-otros.mjs`

Script Node.js que:
1. Consulta todos los eventos con `event_type = 'otro'` y `status = 'active'`
2. Para cada uno, corre `classifyEventWithAi()` con su nombre, descripción y venue
3. Si IA devuelve un tipo con confidence >= 0.7, actualiza el registro en DB
4. Loguea resultados: `"Evento X: otro → deportivo (0.92)"`
5. Respeta rate limits de OpenAI (1-2 requests/segundo)

Costo estimado: con gpt-4o-mini a ~$0.15/1M input tokens, reclasificar 200 eventos cuesta menos de $0.01.

#### Paso 5: Monitoreo continuo
Agregar un log o métrica al final del pipeline que imprima:
```
[pipeline] Clasificación: 12 heurística, 4 IA, 1 quedó otro
```
Esto permite detectar si las reglas necesitan ajuste.

### Archivos a tocar
- `src/processing/classifier.ts` — expandir reglas regex
- `src/processing/ai-client.ts` — mejorar prompt
- `src/processing/pipeline.ts` — verificar budget y logging
- `scripts/reclassify-otros.mjs` — nuevo script de backlog

### Criterio de aceptación
- Menos del 10% de eventos activos quedan como "otro"
- Los filtros por tipo (deportivo, taller, etc.) muestran resultados reales y útiles
- El costo de IA por batch de scraping es < $0.01
- El script de reclasificación funciona sobre el backlog sin romper nada

---

## Orden de implementación recomendado

| Orden | Feature | Motivo |
|-------|---------|--------|
| 1° | **Filtro temporal** (Hoy/Mañana/Finde) | Mayor impacto UX, menor complejidad |
| 2° | **Compartir evento** | Muy sencillo, alto impacto social/viral |
| 3° | **Mini-mapa en detalle** | Sencillo con Leaflet ya instalado, mejora decisión del usuario |
| 4° | **Mejorar clasificación IA** | Base necesaria para que los filtros de tipo sean útiles |
| 5° | **Cerca de mí** | Más complejo (requiere refactor parcial a client), dejarlo para el final |

---

## Dependencias entre features

- Feature 3 (Cerca de mí) necesita que los eventos tengan coordenadas — depende indirectamente de un buen geocoder
- Feature 5 (Clasificación IA) mejora Feature 1 indirectamente (si los tipos son correctos, el filtro temporal por tipo funciona mejor)
- Las demás son independientes entre sí

---

**Última actualización:** 17 de febrero de 2026
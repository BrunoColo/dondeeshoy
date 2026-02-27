# Plan Visual — Rediseño ¿Dónde es Hoy?

> **Dirección elegida:** Teal/Jade + Deep Charcoal  
> **Concepto:** De "club nocturno neon" a **"guía urbana premium"** — oscuro, sofisticado, universalmente legible para cualquier tipo de evento (conciertos, ferias, teatro, deportes, gastronomía).  
> **Inspiración:** Luma Events, Linear, Vercel Dashboard, Letterboxd, Carbon Design System.

---

## 1. Nueva Paleta de Colores

### Comparativa: ANTES vs DESPUÉS

| Token | ANTES (neon) | DESPUÉS (teal/charcoal) | Uso |
|---|---|---|---|
| `--bg-deep` | `#06060C` (azul-negro) | `#080C0E` (charcoal verdoso) | Fondo body |
| `--bg-surface` | `#0C0C16` | `#0D1214` | Superficies base |
| `--bg-elevated` | `#141424` | `#141C1F` | Cards, modales |
| `--bg-card` | `rgba(255,255,255,0.03)` | `rgba(13,148,136,0.04)` | Cards glass (tinte teal) |
| `--bg-card-hover` | `rgba(255,255,255,0.06)` | `rgba(13,148,136,0.08)` | Cards hover |
| `--border-subtle` | `rgba(255,255,255,0.07)` | `rgba(255,255,255,0.06)` | Bordes neutros |
| `--border-glow` | `rgba(255,255,255,0.12)` | `rgba(13,148,136,0.18)` | Bordes con brillo |

### Acento Principal → Teal/Jade

```
PRIMARIO (reemplaza --neon-violet):
  --accent:          #0D9488   (teal-600) ← acento principal
  --accent-light:    #14B8A6   (teal-500) ← hover / highlights
  --accent-dim:      #0F766E   (teal-700) ← variante oscura
  --accent-glow:     rgba(13,148,136,0.25)

SECUNDARIO (reemplaza --neon-cyan):
  --accent2:         #6EE7B7   (emerald-300) ← texto sobre oscuro, badges
  --accent2-dim:     #34D399   (emerald-400) ← subtext

TERCIARIO (reemplaza --neon-magenta → antes rosado neon):
  --accent3:         #F59E0B   (amber-500) ← trending, highlights cálidos
  --accent3-light:   #FCD34D   (amber-300) ← texto amber sobre oscuro
```

### Semánticos (sin cambios de función, solo ajuste de valores)

```
--status-free:     #34D399   (emerald-400)  ← eventos gratis (igual)
--status-paid:     #F59E0B   (amber-500)    ← precio (antes amber igual)
--status-live:     #34D399   (igual)
--status-error:    #F87171   (red-400, igual)
--status-info:     #67E8F9   (cyan-300)     ← era neon-cyan
```

### Textos (sin cambio, ya neutros)

```
--text-primary:    #F1F5F9   (igual)
--text-secondary:  #94A3B8   (igual)
--text-muted:      #64748B   (igual)
```

---

## 2. Sistema de Fondos Ambientales

### Fondo principal (body::after) — ANTES vs DESPUÉS

```
ANTES:
  radial-gradient violet (#A855F7) + cyan-dim (#06B6D4) + magenta (#DB2777)
  → Efecto: club nocturno, neon rosa/violeta saturado

DESPUÉS:
  radial-gradient teal (#0D9488 @ 16% opacity) en top-left
  + radial-gradient slate-blue (#1E3A5F @ 12% opacity) en top-right
  + radial-gradient emerald (#064E3B @ 10% opacity) en center-bottom
  → Efecto: profundidad orgánica oscura, como fondo marino o bóveda urbana
```

### Parallax blobs (.neon-web-bg → renombrar a .ambient-bg)

```css
ANTES .neon-web-bg:
  violet (0.85) + cyan (0.75) + magenta (0.7) @ opacity 0.22

DESPUÉS .ambient-bg:
  teal rgba(13,148,136,0.7) @ 18% + emerald rgba(6,78,59,0.5) @ 15%
  mix-blend-mode: normal (no screen, evita oversaturation)
  opacity: 0.15 (vs 0.22 anterior — más sutil)

DESPUÉS .ambient-bg--alt:
  slate-blue rgba(15,23,42,0.8) + jade rgba(20,83,45,0.4)
  opacity: 0.12 (vs 0.17 anterior)
```

**Resultado visual:** El fondo respira con el usuario en lugar de gritar. Los eventos de día se ven tan bien como los nocturnos.

---

## 3. Cambios por Sección

---

### 3.1 HEADER (`src/components/layout/header.tsx`)

**Estado actual:** Logo con gradient `from-neon-violet via-neon-magenta to-neon-cyan` (violeta→rosa→celeste). Nav activo en `neon-violet`. Search con focus `neon-violet/50`.

**Cambios propuestos:**

```
LOGO "hoy?":
  ANTES: gradient violet → magenta → cyan
  DESPUÉS: gradient from-accent via-accent-light to-accent2
           = teal-600 → teal-500 → emerald-300
           Resultado: identidad cálida-fresca sin neon

LOGO "¿Dónde es":
  ANTES: #CBD5E1 (slate-300)
  DESPUÉS: mantener #E2E8F0 (blanco roto) — ya es neutro, OK

NAV ITEMS activos:
  ANTES: bg-neon-violet/15, border-neon-violet/30, text-neon-violet
         shadow: rgba(168,85,247,0.15)
  DESPUÉS: bg-accent/15, border-accent/30, text-accent-light
           shadow: rgba(13,148,136,0.15)

SEARCH INPUT focus:
  ANTES: focus:border-neon-violet/50, shadow rgba(168,85,247,0.22)
  DESPUÉS: focus:border-accent/50, shadow rgba(13,148,136,0.2)

SEARCH "Ir" button:
  ANTES: bg-neon-violet/25, border-neon-violet/35, text-neon-violet
  DESPUÉS: bg-accent/25, border-accent/35, text-accent-light

GLASS HEADER border:
  ANTES: border-bottom rgba(168,85,247,0.08)
  DESPUÉS: border-bottom rgba(13,148,136,0.10)
```

---

### 3.2 BOTTOM NAV MÓVIL (`src/components/layout/bottom-nav.tsx`)

**Estado actual:** Color activo `neon-violet`, dot `bg-neon-violet`, glow `rgba(168,85,247,0.5)`.

**Cambios:**

```
COLOR ACTIVO:
  ANTES: text-neon-violet + drop-shadow rgba(168,85,247,0.5)
  DESPUÉS: text-accent-light (#14B8A6) + drop-shadow rgba(20,184,166,0.4)

DOT INDICADOR (top):
  ANTES: bg-neon-violet, shadow rgba(168,85,247,0.6)
  DESPUÉS: bg-accent-light, shadow rgba(20,184,166,0.5)

GLASS NAV border top:
  ANTES: rgba(168,85,247,0.1)
  DESPUÉS: rgba(13,148,136,0.12)
```

---

### 3.3 HOME PAGE — Hero Tagline (`src/app/(main)/page.tsx`)

**Estado actual:** Título con gradient `from-neon-violet via-neon-magenta to-neon-cyan`. Eyebrow "Descubrí Uruguay" en `neon-cyan/80`. Ícono Zap con `from-neon-violet/20 to-neon-magenta/10`, badge HOY en `neon-violet to neon-magenta`.

**Cambios:**

```
EYEBROW "Descubrí Uruguay":
  ANTES: text-neon-cyan/80
  DESPUÉS: text-accent-light/80 (#14B8A6 @ 80%)

TÍTULO H1 GRADIENT:
  ANTES: from-neon-violet via-neon-magenta to-neon-cyan (violeta→rosa→celeste)
  DESPUÉS: from-accent-light via-accent2 to-white/90
           = teal-500 → emerald-300 → blanco roto
           Alternativa más llamativa: from-accent-light to-accent2 (2 stops)
           Resultado: fresco, moderno, sin connotación nocturna

ÍCONO CONTAINER "Zap - HOY":
  ANTES: bg-gradient from-neon-violet/20 to-neon-magenta/10
         border border-neon-violet/20
         shadow rgba(168,85,247,0.15)
  DESPUÉS: bg-gradient from-accent/20 to-accent-light/10
           border border-accent/20
           shadow rgba(13,148,136,0.15)

BADGE HOY (texto gradient):
  ANTES: from-neon-violet to-neon-magenta
  DESPUÉS: text-accent-light (solid, sin gradient — más legible)

BADGE COUNTER (eventos hoy):
  ANTES: bg-emerald-500/10, border-emerald-500/20, text-emerald-400
  DESPUÉS: SIN CAMBIO — ya es verde, coherente con nueva paleta
```

---

### 3.4 EVENT CARDS (`src/components/events/event-card.tsx`)

**Estado actual:** Glass card con hover `border-color rgba(168,85,247,0.2)`. Distancia en `text-neon-cyan`. Ciudad badge `bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan/80`. Precio gratis `text-neon-green`.

**Cambios:**

```
GLASS CARD hover border:
  ANTES: rgba(168,85,247,0.2)
  DESPUÉS: rgba(13,148,136,0.2)

CARD GLOW hover (::before gradient):
  ANTES: rgba(168,85,247,0.3) → rgba(34,211,238,0.15) → rgba(236,72,153,0.2)
  DESPUÉS: rgba(13,148,136,0.25) → rgba(110,231,183,0.12) → rgba(13,148,136,0.08)
           (teal → emerald claro → transparente)

DISTANCIA emoji + texto:
  ANTES: text-neon-cyan (#22D3EE)
  DESPUÉS: text-accent2 (#6EE7B7 emerald-300)

CIUDAD BADGE:
  ANTES: bg-neon-cyan/10, border-neon-cyan/20, text-neon-cyan/80
  DESPUÉS: bg-accent/10, border-accent/20, text-accent-light/80

PRECIO GRATIS:
  ANTES: text-neon-green (#34D399)
  DESPUÉS: SIN CAMBIO — ya era verde esmeralda, perfecto

TRENDING badge "Popular":
  ANTES: bg-orange-500/15, border-orange-500/25, text-orange-400
  DESPUÉS: SIN CAMBIO — el naranja/amber es parte de la nueva paleta

BOTTOM BAR border:
  ANTES: border-white/[0.05]
  DESPUÉS: SIN CAMBIO — ya neutro
```

**Gradientes de fallback (TYPE_GRADIENT) — sin cambios:**
Los 14 tipos de eventos mantienen sus colores individuales. Son deliberadamente multicolor (expresan el tipo de evento). Solo se ajustan los que usan `violet` y `fuchsia`:

```
fiesta: from-violet-600/30 via-fuchsia-600/20  →  from-teal-600/30 via-emerald-600/20
         (fiestas ahora en teal en lugar de violeta — más neutro, sigue siendo nocturno)
```

---

### 3.5 EVENT FILTERS (`src/components/events/event-filters.tsx`)

**Estado actual:** Chips de departamento activos en `neon-cyan`. Chips `fiesta` y otros en colores por tipo (ya multicolor, OK). Limpiar button neutro.

**Cambios:**

```
DEPARTMENT CHIPS activos:
  ANTES: bg-neon-cyan/20, border-neon-cyan/45, text-neon-cyan
         shadow rgba(34,211,238,0.2)
  DESPUÉS: bg-accent/18, border-accent/40, text-accent-light
           shadow rgba(13,148,136,0.18)

CHIP FIESTA (tipo):
  ANTES: bg-violet-500/10, activeBg violet-500/25, text-violet-300
  DESPUÉS: bg-teal-500/10, activeBg teal-500/25, text-teal-300
  (coherencia con nuevo acento primario)

TODOS LOS DEMÁS CHIPS DE TIPO: sin cambio
  (cada tipo mantiene su color propio — concierto sky, festival pink, etc.)

FILTRO NOCHE:
  ANTES: bg-indigo-500, text-indigo-300
  DESPUÉS: SIN CAMBIO — el índigo nocturno tiene sentido para "noche"

FILTRO GRATIS:
  ANTES: bg-emerald-500, text-emerald-300
  DESPUÉS: SIN CAMBIO
```

---

### 3.6 DESKTOP SIDEBAR (`src/components/layout/desktop-sidebar.tsx`)

**Estado actual:** `cardStyle` con `#0f0f1a` bg. Clock card con `borderLeft: "3px solid #6366f1"`. Sección "¿Tenés un evento?" con todo en `#6366f1` (indigo).

**Cambios:**

```
CARD BASE backgroundColor:
  ANTES: #0f0f1a
  DESPUÉS: #0D1519  (charcoal con tinte teal muy sutil)

LIVE CLOCK card left border:
  ANTES: 3px solid #6366f1 (indigo)
  DESPUÉS: 3px solid #0D9488 (teal)

TRENDING "Más vistos hoy":
  ANTES: text-orange-400, Flame icon orange-400
  DESPUÉS: SIN CAMBIO — orange/amber es parte de nueva paleta (trending = calor)

PRÓXIMOS DESTACADOS header:
  ANTES: text-[#14b8a6], CalendarCheck color #14b8a6
  DESPUÉS: SIN CAMBIO — ya era teal, perfectamente alineado

DATE PILL colores:
  ANTES: isToday → teal #14b8a6, isTomorrow → indigo #818cf8
  DESPUÉS: isToday → accent-light #14B8A6 (igual), isTomorrow → slate #94A3B8

"¿TENÉS UN EVENTO?" card:
  ANTES: border rgba(99,102,241,0.25), borderLeft 3px #6366f1 (indigo)
         Rocket icon #818cf8, CTA button bg rgba(99,102,241,0.15)
  DESPUÉS: border rgba(13,148,136,0.25), borderLeft 3px #0D9488 (teal)
           Rocket icon #14B8A6, CTA button bg rgba(13,148,136,0.15)
  Texto "Publicar mi evento": text-accent2 (#6EE7B7)

ESTADÍSTICAS "En números":
  ANTES: text-[#10b981], BarChart3 emerald
  DESPUÉS: SIN CAMBIO — emerald ya es parte de nueva paleta

QUICK LINKS íconos:
  ANTES: Zap #fbbf24 (amber), CalendarDays #6366f1 (indigo), MapPin #14b8a6 (teal)
  DESPUÉS: Zap #F59E0B (amber, igual), CalendarDays #0D9488 (teal), MapPin #14B8A6 (teal claro)
```

---

### 3.7 SIDEBAR LIVE CLOCK (`src/components/layout/sidebar-live.tsx`)

**A verificar:** El colon parpadeante está en `#818cf8` (indigo-300). Cambiar a `#14B8A6` (teal-500) para coherencia.

---

### 3.8 PÁGINA PRÓXIMOS (`src/app/(main)/proximos/page.tsx`)

**A verificar según exploración:** El header usa `CalendarDays` con cyan. Los time filter pills (Mañana/Finde/Elegir fecha) probablemente usan colores neon.

**Cambios esperados:**
```
Header CalendarDays icon:
  ANTES: text-neon-cyan
  DESPUÉS: text-accent-light

TIME FILTER pills activas:
  ANTES: probablemente violet/cyan
  DESPUÉS: bg-accent/20, border-accent/40, text-accent-light
```

---

### 3.9 PÁGINA MAPA (`src/app/(main)/mapa/page.tsx`)

**Estado actual:** Sidebar bg `#0F0F1E`/`#0A0A16`. Dot header `#A855F7` (violet). Links hover `#C084FC` (violet-300). Selected event `#A855F7`.

**Cambios:**

```
SIDEBAR BACKGROUND:
  ANTES: #0F0F1E / #0A0A16
  DESPUÉS: #0D1519 / #0A1214 (charcoal teal)

PULSE DOT (header sidebar):
  ANTES: #A855F7 (violet)
  DESPUÉS: #0D9488 (teal)

HOVER LINKS:
  ANTES: #C084FC (violet-300)
  DESPUÉS: #14B8A6 (teal-500)

SELECTED EVENT highlight:
  ANTES: border/bg violet
  DESPUÉS: border/bg accent teal

MAPA TILES: sin cambio (CARTO dark tiles, ya oscuro)
```

---

### 3.10 PÁGINA PUBLICAR (`src/app/(main)/publicar/page.tsx`)

**Estado actual:** Secciones con 4 acentos distintos: `#6366f1` (Tu evento), `#14b8a6` (Ubicación), `#10b981` (Entradas), `#8b5cf6` (Contacto). Inputs con bg `#1a1a2a`. Submit button con `rgba(99,102,241,0.2)`.

**Cambios:**

```
SECTION ACCENT UNIFICACIÓN:
  Se reduce la variedad de colores de sección para coherencia.
  
  ANTES: 4 acentos distintos (indigo, teal, emerald, purple)
  DESPUÉS: 2 acentos:
    Tu evento:   #0D9488  (teal — acento principal)
    Ubicación:   #0D9488  (teal — misma sección geográfica, coherente)
    Entradas:    #34D399  (emerald — verde = dinero/entrada, mantiene semántica)
    Contacto:    #0D9488  (teal — vuelve al principal)

  Alternativa conservadora: mantener 4 acentos pero reemplazar solo
  el indigo (#6366f1) por teal, y el purple (#8b5cf6) por slate.

INPUT BACKGROUNDS:
  ANTES: bg-[#1a1a2a] (azul-oscuro)
  DESPUÉS: bg-[#111A1C] (charcoal verdoso oscuro)
  focus: bg-[#151F22]

SUBMIT BUTTON:
  ANTES: rgba(99,102,241,0.2) indigo
  DESPUÉS: rgba(13,148,136,0.25) teal
           border rgba(13,148,136,0.4)
  
EYEBROW "Publicación de eventos":
  ANTES: text-[#6366f1] (indigo)
  DESPUÉS: text-accent-light (#14B8A6)
```

---

### 3.11 EVENT DETAIL (`src/app/(main)/evento/[slug]/page.tsx`)

**A verificar:** HeroImage con overlay hacia `#06060C`. Ticket button CTA (`.btn-neon`). Info cards (fecha, venue, precio).

**Cambios esperados:**
```
IMG OVERLAY gradient bottom color:
  ANTES: rgba(6,6,12,x)
  DESPUÉS: rgba(8,12,14,x) — nuevo bg-deep

BTN NEON (ticket CTA):
  ANTES: gradient violet → magenta
  DESPUÉS: gradient teal → emerald
  = from-accent to-accent-light (o from-#0D9488 to-#14B8A6)
  shadow: rgba(13,148,136,0.3)

INFO CARDS (fecha, precio, venue):
  Acentos violet → teal
```

---

### 3.12 CSS GLOBAL — globals.css

#### Tokens a renombrar (semántica más clara)

```
ANTES                 DESPUÉS                   RAZÓN
--neon-violet     →   --accent                  Principal
--neon-violet-dim →   --accent-dim
--neon-violet-glow→   --accent-glow
--neon-cyan       →   --accent2                 Secundario (emerald/teal claro)
--neon-cyan-dim   →   --accent2-dim
--neon-magenta    →   (remover o →  --accent3 para amber)
--neon-magenta-dim→   (remover)
--neon-blue       →   mantener como --color-info
--neon-emerald    →   mantener (status libre/vivo)
```

#### Clases a modificar

```css
/* .glass-card hover → teal en lugar de violet */
.glass-card:hover {
  border-color: rgba(13,148,136,0.2);   /* era rgba(168,85,247,0.2) */
  box-shadow: 0 8px 32px rgba(0,0,0,0.3),
              0 0 0 1px rgba(13,148,136,0.08);
}

/* .card-glow hover gradient */
.card-glow:hover::before {
  background: linear-gradient(135deg,
    rgba(13,148,136,0.25) 0%,
    rgba(110,231,183,0.1) 50%,
    rgba(13,148,136,0.06) 100%
  );
}

/* .glass-nav border top */
.glass-nav {
  border-top: 1px solid rgba(13,148,136,0.10);
}

/* .glass-header border bottom */
.glass-header {
  border-bottom: 1px solid rgba(13,148,136,0.08);
}

/* .btn-neon → reemplazar gradient violet/magenta */
.btn-neon {
  background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%);
  box-shadow: 0 4px 20px rgba(13,148,136,0.3);
}
.btn-neon:hover {
  box-shadow: 0 6px 30px rgba(13,148,136,0.4);
}

/* .skeleton shimmer → teal en lugar de violet */
.skeleton {
  background: linear-gradient(90deg,
    rgba(255,255,255,0.03) 25%,
    rgba(13,148,136,0.05) 50%,
    rgba(255,255,255,0.03) 75%
  );
}

/* :focus-visible */
:focus-visible {
  outline: 2px solid #0D9488;  /* era neon-violet */
}

/* @theme inline → actualizar color mappings */
--color-neon-violet: var(--accent)     /* compat */
--color-accent: var(--accent)
--color-accent-light: var(--accent-light)
```

#### Badge de tipo "fiesta" — ajuste

```css
/* .badge-fiesta → cambiar de violet a teal para coherencia con nuevo primario */
.badge-fiesta {
  background: rgba(13,148,136,0.18);
  color: #5EEAD4;                        /* teal-300 */
  border: 1px solid rgba(13,148,136,0.32);
  text-shadow: 0 0 12px rgba(13,148,136,0.28);
}
```

---

## 4. Event Type Badge System — Ajustes

La mayoría de los 14 tipos mantienen sus colores (son correctamente multicolor). Solo se ajusta `fiesta` para alinearse con el nuevo acento primario:

| Tipo | ANTES | DESPUÉS |
|---|---|---|
| `fiesta` | violet `#C084FC` | teal `#5EEAD4` |
| `festival` | pink `#F472B6` | SIN CAMBIO |
| `concierto` | sky `#7DD3FC` | SIN CAMBIO |
| `recital` | cyan `#67E8F9` | SIN CAMBIO |
| `cultural` | indigo `#A5B4FC` | SIN CAMBIO |
| `deportivo` | green `#86EFAC` | SIN CAMBIO |
| `gastronomico` | orange `#FDBA74` | SIN CAMBIO |
| `familiar` | lime `#BEF264` | SIN CAMBIO |
| `feria` | rose `#FDA4AF` | SIN CAMBIO |
| `taller` | teal `#5EEAD4` | SIN CAMBIO (ya era teal) |
| `club` | blue `#93C5FD` | SIN CAMBIO |
| `bar` | amber `#FDE68A` | SIN CAMBIO |
| `teatro` | emerald `#6EE7B7` | SIN CAMBIO |
| `otro` | slate `#94A3B8` | SIN CAMBIO |

---

## 5. Tipografía — Sin Cambios

Las fuentes actuales son excelentes para el nuevo concepto:
- **Outfit** (display) — geométrica, moderna, funciona para eventos de todo tipo
- **DM Sans** (body) — neutro, legible, editorial
- **DM Mono** (mono) — para tiempos y datos técnicos

No se requieren cambios de fuentes.

---

## 6. Microanimaciones — Ajustes Menores

```
ambient-drift (body::after):
  Sin cambio de keyframes, solo los colores dentro del gradient

live-dot (.live-dot):
  ANTES: rgba(52,211,153,0.7) — verde (SIN CAMBIO)
  DESPUÉS: SIN CAMBIO — el verde ya es de status, no de branding

shimmer (.skeleton):
  ANTES: rgba(168,85,247,0.06) — tinte violet
  DESPUÉS: rgba(13,148,136,0.05) — tinte teal
```

---

## 7. Hardcoded Colors — Limpieza

Hay ~20 valores hardcodeados en componentes que deben migrar a tokens:

| Archivo | Color hardcoded | Reemplazar por |
|---|---|---|
| `header.tsx` | `#CBD5E1` logo | → `var(--text-primary)` o `#E2E8F0` |
| `desktop-sidebar.tsx` | `#0f0f1a` card bg | → `var(--bg-elevated)` |
| `desktop-sidebar.tsx` | `#6366f1` indigo múltiples | → `var(--accent)` |
| `desktop-sidebar.tsx` | `#818cf8` clock colon | → `var(--accent-light)` |
| `desktop-sidebar.tsx` | `#14b8a6` teal (ya OK) | → `var(--accent-light)` |
| `publicar/page.tsx` | `#1a1a2a` input bg | → `#111A1C` / `var(--bg-input)` |
| `publicar/page.tsx` | `#13131f` section header | → `var(--bg-surface)` |
| `publicar/page.tsx` | `#6366f1` accent múltiples | → `var(--accent)` |
| `publicar/page.tsx` | `#8b5cf6` contacto accent | → `var(--accent)` |
| `mapa/page.tsx` | `#0F0F1E` sidebar bg | → `var(--bg-surface)` |
| `mapa/page.tsx` | `#A855F7` selected violet | → `var(--accent)` |
| `mapa/page.tsx` | `#C084FC` hover links | → `var(--accent-light)` |

---

## 8. Orden de Implementación Recomendado

```
FASE 1 — Tokens base (globals.css)          ← impacto inmediato en todo
  1. Actualizar variables :root (--accent, --accent-light, etc.)
  2. Actualizar @theme inline mappings
  3. Actualizar body::after ambient gradient
  4. Actualizar .neon-web-bg → .ambient-bg colores
  5. Actualizar .glass-card, .card-glow, .btn-neon, .skeleton, .glass-nav, .glass-header
  6. Actualizar .badge-fiesta
  7. Actualizar :focus-visible

FASE 2 — Layout global (header + bottom nav)
  8. header.tsx → logo gradient, nav activo, search focus
  9. bottom-nav.tsx → color activo, dot, border

FASE 3 — Home page
  10. page.tsx (main) → eyebrow, título gradient, ícono HOY

FASE 4 — Sidebar desktop
  11. desktop-sidebar.tsx → card bg, clock border, CTA "Tenés un evento", quick links

FASE 5 — Página publicar
  12. publicar/page.tsx → acentos de sección, input bg, submit button

FASE 6 — Páginas secundarias
  13. proximos/page.tsx → time filter pills, header icon
  14. mapa/page.tsx → sidebar bg y colores
  15. evento/[slug] → ticket button, info cards

FASE 7 — Limpieza
  16. Reemplazar todos los hardcoded colors por tokens CSS
  17. Renombrar clase .neon-web-bg → .ambient-bg en todos los archivos que la usan
```

---

## 9. Resumen Visual

```
ANTES:                          DESPUÉS:
┌─────────────────────┐         ┌─────────────────────┐
│  #06060C (fondo)    │         │  #080C0E (fondo)     │
│                     │         │                      │
│  ████ VIOLET        │   →     │  ████ TEAL           │
│  ████ MAGENTA/PINK  │         │  ████ EMERALD        │
│  ████ CYAN          │         │  ████ AMBER (accent) │
│                     │         │                      │
│  Sensación:         │         │  Sensación:          │
│  Club nocturno      │         │  Guía urbana premium │
│  Solo eventos noche │         │  Todo tipo de evento │
│  Oversaturado       │         │  Sofisticado, limpio │
└─────────────────────┘         └─────────────────────┘

Paleta de acento: #A855F7 (violet)  →  #0D9488 (teal)
Gradiente logo:   violet→pink→cyan  →  teal→emerald→white
Ambient bg:       violet/cyan/magenta→  teal/slate/emerald oscuro
```

---

*Todos los colores de tipos de evento (concierto, teatro, deportivo, etc.) se mantienen intactos — son parte del sistema semántico, no del branding.*

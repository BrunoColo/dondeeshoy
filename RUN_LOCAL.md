# Ejecutar y ver DondeEsHoy localmente

Guía rápida para levantar el proyecto en Windows (PowerShell) y verlo en el navegador.

---

## 1) Requisitos

| Requisito | Versión mínima |
|-----------|---------------|
| Node.js   | 20+           |
| npm       | viene con Node |

Además necesitás un archivo `.env` en la raíz del proyecto con las variables de entorno para la base de datos y servicios. Si no lo tenés, creá uno copiando `.env.example` y completá los valores.

---

## 2) Instalar dependencias

Desde la raíz del proyecto:

```powershell
# PowerShell (Windows)
npm.cmd install

# CMD / bash / macOS / Linux
npm install
```

Esto instala todas las dependencias incluyendo:
- **motion** — animaciones y parallax neón
- **next** 16 — framework React con App Router
- **tailwindcss** 4 — estilos utility-first
- **drizzle-orm** — ORM para PostgreSQL
- **lucide-react** — íconos

---

## 3) Ejecutar en desarrollo

```powershell
# PowerShell (Windows)
npm.cmd run dev

# CMD / bash
npm run dev
```

Luego abrí en el navegador:

> **http://localhost:3000**

---

## 4) Build de producción (validación)

```powershell
# Compilar
npm.cmd run build

# Ejecutar en modo producción
npm.cmd run start
```

Abrí: **http://localhost:3000**

---

## 5) Qué deberías ver

- **Fondo neón dinámico** — dos capas de gradientes radiales (violeta, cyan, magenta, azul, esmeralda) que reaccionan al scroll y al movimiento del mouse con parallax suave. Usa `motion` (Framer Motion) con springs físicos.
- **Cards con/sin imagen** — ambas tienen el mismo alto (~176px / ~208px en desktop). Las cards sin imagen muestran un gradiente de color según el tipo de evento y un ícono decorativo de fondo.
- **Glassmorphism** — header, bottom nav y cards usan backdrop-blur con bordes sutiles translúcidos.
- **Textura de ruido** — overlay sutil de noise SVG sobre todo el fondo para darle profundidad.
- **Animaciones de entrada** — cards aparecen con stagger (fade-up + blur), scrollbar custom, live-dot pulsante para el contador de eventos.
- **Accesibilidad** — respeta `prefers-reduced-motion`: si el usuario tiene animaciones reducidas, se muestra el fondo estático sin parallax ni animaciones CSS.

---

## 6) Stack de animación (neon parallax)

El componente `NeonParallax` (`src/components/layout/neon-parallax.tsx`) usa:

- `useScroll()` + `useTransform()` de `motion/react` para mover las capas con el scroll
- `useSpring()` para suavizar el tracking del puntero del mouse
- Dos capas (`neon-web-bg` y `neon-web-bg--alt`) con `mix-blend-mode: screen` y blur pesado
- `useReducedMotion()` para fallback accesible

Se monta en el root layout (`src/app/layout.tsx`) como fondo fijo detrás de todo el contenido.

---

## 7) Solución rápida de problemas

### Error de PowerShell: "execution of scripts is disabled"

Usá `npm.cmd` en lugar de `npm` / `npx`:

```powershell
npm.cmd run dev
npm.cmd run build
```

### Puerto 3000 ocupado

Next te ofrece otro puerto automáticamente (ej: 3001). Abrí el que indique la terminal.

### No se ven los gradientes neón

Asegurate de que el navegador no tenga activada la opción de reducir movimiento. En Chrome: `chrome://flags/#force-prefers-reduced-motion` debería estar en Default.

### Error de base de datos

Si no tenés configurada la DB, la página igual debería cargar mostrando el estado vacío ("No hay eventos"). El parallax y el diseño visual funcionan independientemente de la base de datos.

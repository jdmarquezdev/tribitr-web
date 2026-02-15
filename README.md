# Tribitr

Aplicacion web sencilla para registrar la introduccion de alimentos del bebe con el metodo de 3 exposiciones (`0/3` a `3/3`), con sincronizacion entre dispositivos por enlace secreto.

---

## Espanol

### Que es Tribitr

Tribitr es una app web para familias/cuidadores que quieren llevar un seguimiento sencillo y visual de la introduccion de alimentos:

- Cada alimento tiene 3 checks de exposicion.
- Al llegar a `3/3` se considera introducido.
- El estado se guarda localmente y puede sincronizarse con otros dispositivos del mismo perfil.

### Funcionalidades principales

- Home por familias (incluye tarjeta "Todos los alimentos").
- Lista con busqueda y controles por icono:
  - panel `Filtros` con familia, `Ocultar 3/3` y `Mostrar ocultos`,
  - panel `Ordenar` con `A-Z` / `Z-A`.
- Reordenacion por drag & drop.
- Ficha de alimento con:
  - historial de exposiciones,
  - notas,
  - ocultar/mostrar alimento,
  - atribucion de imagen,
  - contenido IA (descripcion y reacciones) generado desde backend.
- Recomendaciones por edad:
  - datos del bebe en perfil (`nombre`, `fecha de nacimiento`, `semanas de correccion`),
  - filtro de alimentos no aptos por edad (ocultos por defecto),
  - opcion `Mostrar alimentos no aptos todavia` en Ajustes.
- Gestion de imagen por alimento/familia:
  - buscar candidatas,
  - URL manual,
  - archivo local,
  - borrar override.
- Multi-perfil (crear con `+`, seleccionar, guardar ficha de perfil, eliminar).
- Sincronizacion por enlace secreto (sin login): copiar enlace, compartir, QR y sincronizacion manual.
- Exportar/importar perfil y backup completo (segun endpoints backend).
- Tema claro/oscuro/sistema + idioma ES/EN.
- Aviso discreto de almacenamiento local/cookies con enlace a privacidad.

### Arquitectura

- Frontend: React + TypeScript + Vite + Tailwind.
- Persistencia local: IndexedDB (`idb`).
- Backend: Node.js + Express + TypeScript.
- Persistencia servidor: PostgreSQL.
- IA: llamadas solo desde backend (nunca exponer claves en frontend).

### Requisitos

- Node.js 20+
- npm 10+
- PostgreSQL accesible desde backend

### Puesta en marcha (local)

1) Instalar dependencias del frontend:

```bash
npm install
```

2) Instalar dependencias del backend:

```bash
npm --prefix backend install
```

3) Configurar variables de entorno:

- Frontend: copia `.env.example` a `.env`
- Backend: copia `backend/.env.example` a `backend/.env`

4) Arrancar backend:

```bash
npm --prefix backend run dev
```

5) Arrancar frontend:

```bash
npm run dev
```

Frontend por defecto: `http://localhost:5173`  
Backend por defecto: `http://localhost:3001`

### Scripts utiles

- Frontend:
  - `npm run dev`
  - `npm run build`
  - `npm run test -- --run`
- Backend:
  - `npm --prefix backend run dev`
  - `npm --prefix backend run build`
  - `npm --prefix backend run test`
- Seed desde snapshot:
  - `npm run seed:export`

### Variables de entorno clave

- Frontend:
  - `VITE_API_URL`
- Backend:
  - `PORT`
  - `DATABASE_URL`
  - `CORS_ORIGINS`
  - `AI_REQUIRE_PROFILE_LINK`
  - `AI_REQUEST_TIMEOUT_MS`
  - credenciales del proveedor IA que uses (por ejemplo `OPENAI_API_KEY`)

Revisa el detalle completo en `backend/.env.example`.

### API (resumen)

- Sync:
  - `POST /api/sync/pull`
  - `POST /api/sync/push`
- IA:
  - `POST /api/ai/food`
  - `POST /api/ai/food-images`
  - `POST /api/ai/food-image`
  - `POST /api/ai/image-attribution`
- Backup:
  - `POST /api/backup/export`
  - `POST /api/backup/import`

### Notas de sincronizacion (cliente)

- `push` tras cambios locales (con debounce).
- `pull` al arrancar, al recuperar foco y de forma periodica.
- `Última sincronización` en UI refleja el ultimo `pull` exitoso.

### Licencia y legal

Este proyecto esta bajo **GNU Affero General Public License v3.0 o posterior (AGPL-3.0-or-later)**.

- Texto completo: `LICENSE`
- Paginas legales publicas:
  - `public/legal/privacy.html`
  - `public/legal/disclaimer.html`
  - `public/legal/license.html`

### Autor

- Juan Diego Marquez Tebar
- Contacto: `hola@jdmarquez.dev`

---

## English

### What Tribitr is

Tribitr is a simple web app to track baby food introduction with a clear 3-exposure workflow:

- Each food has 3 exposure checks.
- At `3/3`, the food is considered introduced.
- Data is saved locally and can be synced across devices linked to the same profile.

### Main features

- Family home view (including an "All foods" card).
- Food list with search and icon-based controls:
  - `Filters` panel for family, `Hide 3/3`, and `Show hidden`,
  - `Sort` panel for `A-Z` / `Z-A`.
- Drag-and-drop reordering.
- Food detail with:
  - exposure history,
  - notes,
  - hide/unhide,
  - image attribution,
  - AI-generated text (description and reactions) from backend.
- Age-based recommendations:
  - baby profile data (`name`, `birth date`, `correction weeks`),
  - age suitability filtering (not-suitable foods hidden by default),
  - `Show not suitable foods yet` option in Settings.
- Food/family image management:
  - fetch candidates,
  - manual URL,
  - local upload,
  - clear override.
- Multi-profile support (create with `+`, select, save profile details, delete).
- Secret-link sync across devices (no login): copy link, share, QR, and manual sync.
- Profile export/import and full backup restore (depending on backend endpoints).
- Light/dark/system theme + ES/EN language toggle.
- Minimal local-storage/cookies notice with privacy link.

### Architecture

- Frontend: React + TypeScript + Vite + Tailwind.
- Local persistence: IndexedDB (`idb`).
- Backend: Node.js + Express + TypeScript.
- Server persistence: PostgreSQL.
- AI calls happen only in backend (never expose API keys in frontend).

### Requirements

- Node.js 20+
- npm 10+
- PostgreSQL reachable from backend

### Local setup

1) Install frontend dependencies:

```bash
npm install
```

2) Install backend dependencies:

```bash
npm --prefix backend install
```

3) Configure environment variables:

- Frontend: copy `.env.example` to `.env`
- Backend: copy `backend/.env.example` to `backend/.env`

4) Run backend:

```bash
npm --prefix backend run dev
```

5) Run frontend:

```bash
npm run dev
```

Default frontend: `http://localhost:5173`  
Default backend: `http://localhost:3001`

### Useful scripts

- Frontend:
  - `npm run dev`
  - `npm run build`
  - `npm run test -- --run`
- Backend:
  - `npm --prefix backend run dev`
  - `npm --prefix backend run build`
  - `npm --prefix backend run test`
- Seed export from snapshot:
  - `npm run seed:export`

### Key env vars

- Frontend:
  - `VITE_API_URL`
- Backend:
  - `PORT`
  - `DATABASE_URL`
  - `CORS_ORIGINS`
  - `AI_REQUIRE_PROFILE_LINK`
  - `AI_REQUEST_TIMEOUT_MS`
  - AI provider credentials you use (for example `OPENAI_API_KEY`)

See full details in `backend/.env.example`.

### API (quick overview)

- Sync:
  - `POST /api/sync/pull`
  - `POST /api/sync/push`
- AI:
  - `POST /api/ai/food`
  - `POST /api/ai/food-images`
  - `POST /api/ai/food-image`
  - `POST /api/ai/image-attribution`
- Backup:
  - `POST /api/backup/export`
  - `POST /api/backup/import`

### Sync notes (client)

- `push` runs after local changes (debounced).
- `pull` runs on app start, on window focus, and periodically.
- `Last sync` in the UI reflects the latest successful `pull`.

### License and legal

This project is licensed under **GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later)**.

- Full license text: `LICENSE`
- Public legal pages:
  - `public/legal/privacy.html`
  - `public/legal/disclaimer.html`
  - `public/legal/license.html`

### Author

- Juan Diego Marquez Tebar
- Contact: `hola@jdmarquez.dev`

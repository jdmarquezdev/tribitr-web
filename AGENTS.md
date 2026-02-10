# AGENTS.md — Tribitr (Baby Food Tracker)

## Objetivo
Construir una web **SPA** moderna y responsive llamada **Tribitr** para registrar la introducción de alimentos de un bebé mediante **3 exposiciones** (3 checks). Cuando un alimento llega a **3/3**, se considera “introducido”. Debe permitir **modo claro/oscuro**, **búsqueda**, **filtro por familia**, **ocultar introducidos** desde la lista, **ocultar alimentos** (sin borrar), **reordenar por drag & drop**, **multi-perfil** y **sincronización multi-dispositivo** mediante **enlace secreto**. Incluye una **ficha de alimento** con contenido generado por IA (OpenAI) desde backend.

---

## Stack recomendado
- Frontend: **React + TypeScript + Vite**
- UI: **TailwindCSS** (opcional shadcn/ui)
- Drag & drop: `@dnd-kit/core` + `@dnd-kit/sortable`
- Persistencia local: **IndexedDB** con `idb`
- Backend: **Node.js (Express o Fastify) + TypeScript**
- DB servidor: **PostgreSQL**
- Deploy: VPS + Coolify
- OpenAI: llamado **solo desde backend** usando `OPENAI_API_KEY` (env en Coolify)

**Regla crítica:** nunca exponer API keys en el frontend.

---

## Requisitos funcionales

### Home (familias)
- Vista inicial con tarjetas:
  - **“Todos”** (primera)
  - Familias (verduras, fruta, carne, pescado, legumbres, cereales, lácteos, huevo, frutos secos, marisco, condimentos, etc.)
- Al pulsar una familia: abre **lista** filtrada por esa familia.
- Si la vista por familias no convence, debe poder desactivarse fácilmente (feature flag/opción).

### Lista de alimentos
- Diseño moderno, responsive, **color base verde claro**.
- Controles **en la propia lista** (barra sticky arriba):
  - Búsqueda por nombre
  - Toggle: **“Ocultar 3/3”** (introducidos)
  - Filtro familia (si no se está en una familia concreta) o selector “Todas”
  - (Opcional) Toggle “Mostrar ocultos”
- Cada alimento se muestra como fila/tarjeta con:
  - Imagen/icono (URL desde JSON)
  - Nombre
  - **3 checkboxes** (exposiciones)
  - **3 pills a nivel de alimento** (siempre visibles):
    1) **Pill progreso**: `0/3`, `1/3`, `2/3`, `3/3`
    2) **Pill familia** (texto)
    3) **Pill alérgenos** (combinado): iconitos/abreviaturas (ej: 🥛 🥚 🌾). Si no hay, mostrar “Sin alérgenos”.
- Cuando está en 3/3:
  - Se marca como “introducido”
  - Si toggle “Ocultar 3/3” activado, desaparece de la lista.
- Reordenación:
  - Drag & drop vertical en la lista para cambiar orden.
- Ocultar alimento (sin borrar):
  - Acción desde la ficha (y opcional menú en lista).
  - `isHidden=true` => no se muestra por defecto.
- Persistencia:
  - Cada cambio (check/uncheck, reorder, ocultar, notas, etc.) debe guardar automáticamente.

### Ficha de alimento (detalle)
Al abrir un alimento:
- Mostrar:
  - Imagen/icono
  - Nombre
  - Familia
  - Alérgenos + acceso a leyenda
  - 3 checks (editables)
  - Historial de exposiciones (fechas y horas) **solo en ficha** (NO en lista)
  - Campo **Notas** (texto libre)
  - Atribución de imagen (`imageAttribution` + opcional URL), visible en pequeño al final
- Imagen del alimento (manual + IA):
  - Botón **Buscar imagen** para consultar candidatas en backend y elegir una manualmente.
  - Permitir establecer imagen por **URL manual** o **archivo local**.
  - Botón **Borrar imagen** para volver a la imagen base del seed/placeholder.
  - Persistir override por alimento (`customImage*`) en snapshot.
- IA (solo una vez, cacheada):
  - “Descripción/curiosidad”
  - “Posibles reacciones típicas” (texto genérico)
  - Se generan solo si faltan (lazy on open).
  - Debe mostrar estado **“Generando…”** y deshabilitar “Regenerar” mientras está en progreso.
  - Botón “Regenerar” para volver a pedir IA y sobrescribir campos.

### Leyenda de alérgenos
- Pantalla/diálogo que muestre: icono → nombre del alérgeno.
- Accesible desde:
  - Ficha de alimento
  - Configuración

### Configuración (accesible desde main)
- Tema:
  - Claro / Oscuro / Sistema
- Sincronización:
  - Mostrar estado (último sync, errores)
  - Copiar enlace secreto
  - Unirse usando enlace/código
- Gestión de perfiles:
  - Crear, renombrar, seleccionar, (opcional) borrar perfil
- Gestión de ocultos:
  - Lista de alimentos ocultos y botón “Mostrar de nuevo”
- Export/Import:
  - Exportar JSON (backup manual)
  - Importar JSON (restaurar)

---

## Sincronización por “enlace secreto”

### UX esperada
- El usuario crea/usa un perfil y obtiene **un enlace secreto** (share link).
- Al compartir ese enlace con otra persona:
  - Ambos dispositivos quedan enlazados al **mismo perfil** (misma base de datos en servidor).
- No hay login.
- El enlace secreto es largo (ej: 32 chars) y actúa como “llave”.

### Modelo de sync (v1)
- Estrategia: **documento único por perfil** (snapshot JSON).
- El frontend mantiene estado local en IndexedDB y hace:
  - `pull` al arrancar (si hay red)
  - `push` tras cada cambio (debounce 1–2s)
  - `pull` periódico (ej: cada 30–60s) o al volver al foco

#### Conflictos
- Implementar **optimistic concurrency** con `revision`.
- Flujo propuesto:
  - Server guarda `revision` incremental.
  - Cliente envía `baseRevision` al hacer push.
  - Si `baseRevision` != server `revision` → 409 conflicto:
    - server responde con snapshot actual + revision
    - cliente hace `pull`, aplica merge **LWW** y reintenta push (1 vez)

#### Merge recomendado (LWW)
- Por alimento: usar `food.updatedAt` y aplicar el más reciente.
- Por orden: conservar el del server o el más reciente por `orderUpdatedAt`.
- Por settings: conservar el más reciente.

Prioridad: no perder checks/historial.

---

## Datos / Modelos

### Seed JSON (foods.seed.json)
Debe incluir una lista amplia de alimentos. Cada item:
- `id`: string estable (slug o uuid)
- `name`: string
- `family`: string enum (ej: "verduras", "fruta", "carne"...)
- `allergens`: string[] (ej: ["gluten","huevo"])
- `imageUrl`: string (URL a fuente abierta)
- `imageAttribution`: string (opcional)
- `imageAttributionUrl`: string (opcional)

### Snapshot sincronizado por perfil
```ts
type ProfileSnapshot = {
  profileId: string
  profileName: string
  shareCode: string
  revision: number
  updatedAt: string // ISO
  settings: {
    theme: "light" | "dark" | "system"
    hideIntroduced: boolean
    showHidden: boolean
  }
  foods: Record<string, FoodState> // key = foodId
  order: string[] // orden global "Todos"
  meta: {
    orderUpdatedAt?: string
  }
}

type FoodState = {
  foodId: string
  isHidden: boolean
  notes: string
  exposures: { checkedAt: string }[] // longitud 0..3
  customImageUrl?: string
  customImageAttribution?: string
  customImageAttributionUrl?: string
  imageGeneratedAt?: string
  imageSource?: string
  description?: string
  reactions?: string
  descriptionGeneratedAt?: string
  descriptionModel?: string
  updatedAt: string // ISO para merge LWW
}
```

### IndexedDB (cliente)
DB: `tribitr`
Stores sugeridos:
- `profiles` (lista de perfiles locales)
- `snapshots` (snapshot actual por profileId)
- `seed` (versión de seed aplicada)
- `ui` (preferencias no sincronizadas: última familia vista, etc.)

---

## Endpoints backend (v1)

### Sync
- `POST /api/sync/pull`
  - body: `{ shareCode, profileId }`
  - resp: `{ snapshot }` (404 si no existe)

- `POST /api/sync/push`
  - body: `{ shareCode, profileId, baseRevision, snapshot }` (snapshot completo)
  - resp 200: `{ snapshot, revision }`
  - resp 409: `{ snapshot, revision, conflict: true }`

### IA
- `POST /api/ai/food`
  - body: `{ name, family, allergens, shareCode, profileId }`
  - resp: `{ description, reactions, model }`

- `POST /api/ai/food-images`
  - body: `{ name, family, shareCode, profileId }`
  - resp: `{ candidates: [{ imageUrl, imageAttribution, imageAttributionUrl, source }] }`

- `POST /api/ai/food-image` (compatibilidad)
  - body: `{ name, family, shareCode, profileId }`
  - resp: `{ imageUrl, imageAttribution, imageAttributionUrl, source }` (primera candidata)

Reglas IA:
- Español (España).
- Texto breve y útil.
- No instrucciones médicas; solo información general.
- Disclaimer corto.

Env vars:
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `DATABASE_URL`
- `AI_REQUIRE_PROFILE_LINK`

---

## UI/UX (componentes)
- Header: selector de perfil + botón ⚙️
- Home: cards por familia (incluye "Todos")
- Lista:
  - Barra sticky: búsqueda + toggle "Ocultar 3/3" + filtros
- `FoodRow`:
  - imagen, nombre
  - 3 pills: progreso, familia, alérgenos
  - 3 checks
- `FoodDetail`:
  - secciones: resumen, IA, historial, notas, atribución
  - botón "Regenerar IA"
  - estado "Generando..." con spinner

Accesibilidad:
- Controles grandes en móvil.
- Buen contraste en dark mode.

---

## Reglas de guardado
- Cambio local => actualizar estado + persistir IndexedDB.
- Cambio local => marcar dirty + programar push (debounce).
- Reintentos si falla red; estado visible en Configuración.

---

## Criterios de aceptación (checklist)
- [ ] SPA responsive con tema verde claro + modo claro/oscuro/sistema
- [ ] Home con “Todos” y familias
- [ ] Lista con búsqueda + toggle “Ocultar 3/3” visible
- [ ] Cada alimento: 3 checks + 3 pills (progreso/familia/alérgenos)
- [ ] Drag & drop reordena y persiste
- [ ] Ocultar alimento sin borrarlo + gestión de ocultos
- [ ] Ficha con notas, historial, atribución y contenido IA
- [ ] IA: genera una vez, muestra “Generando…”, botón “Regenerar”
- [ ] Multi-perfil
- [ ] Sync por enlace secreto (mismo perfil en varios dispositivos)
- [ ] Conflictos 409 + merge LWW sin perder checks/historial
- [ ] Export/Import JSON

---

## Entregables
1) Frontend (React/Vite/TS) + IndexedDB
2) Backend (Node/TS) + Postgres + sync + IA
3) `foods.seed.json` con `imageUrl` + `imageAttribution`
4) Config de despliegue (Docker/Coolify) para frontend+backend+db

---

## Mejoras futuras (backlog vivo)

> Nota: esta seccion recoge funcionalidades pendientes o por completar/endurecer. Mantenerla actualizada y marcar como hecha al cerrar cada bloque.

### Internacionalizacion completa (UI + datos + IA)
- [ ] Traducir **todos** los textos de UI pendientes (sin literales sueltos en componentes).
- [ ] Mantener selector de idioma en Ajustes (`es` por defecto) con persistencia local + sync por perfil.
- [ ] Traducir **familias** y **nombres de alimentos** segun idioma activo.
- [ ] Traducir leyenda/nombres de **alergenos** segun idioma activo.
- [ ] Traducir contenido IA de ficha (**descripcion** y **reacciones**) segun idioma activo.
- [ ] Permitir regenerar IA por idioma sin machacar contenido de otro idioma.
- [ ] Cachear contenido IA por idioma (`es`/`en`) para evitar llamadas repetidas.
- [ ] Definir estrategia para alimentos/familias personalizados multiidioma (fallback por defecto).

### Modelo de datos i18n (v2 recomendado)
- [ ] Extender `foods.seed.json` para soportar i18n en datos base (ejemplo: `nameI18n`, `familyI18n`, `allergenLabelsI18n`).
- [ ] Extender snapshot para contenido por idioma (ejemplo: `descriptionByLang`, `reactionsByLang`).
- [ ] Mantener compatibilidad retro con snapshots v1 (migracion no destructiva).
- [ ] Ajustar merge LWW para campos multilenguaje sin perder informacion.
- [ ] Versionar schema (cliente + backend) y documentar migraciones.

### Backend / API pendientes
- [ ] IA: aceptar `language` en `POST /api/ai/food` y responder en ese idioma.
- [ ] IA imagenes: mejorar ranking/filtro de candidatas (atribucion fiable + fuentes permitidas).
- [ ] Endpoints de sync: validar payload/snapshot con esquema tipado (zod/io-ts o similar).
- [ ] Endpoints de backup: definir politica final de seguridad por entorno (dev/prod) y documentarla.
- [ ] Limites y rate-limit basicos en endpoints IA y sync.

### Frontend funcional pendiente
- [ ] Completar gestion avanzada de familias (renombrar, borrar con reasignacion opcional, imagen y orden robustos).
- [ ] Completar gestion de ocultos con acciones masivas (mostrar todos, buscar ocultos).
- [ ] Revisar UX de modales/dialogos en movil (scroll, foco, cierre accesible).
- [ ] Eliminar nesting invalido de botones en tarjetas/clickables (warning de DOM).
- [ ] Mejorar feedback de errores de red/offline en flujo de sync y backup.

### Calidad, pruebas y DX
- [ ] Actualizar tests existentes al UI actual (labels/roles cambiados).
- [ ] Anadir tests para cambio de idioma sin reversion tras pull/push/focus.
- [ ] Anadir tests de i18n de datos (alimentos/familias/alergenos/IA por idioma).
- [ ] Cobertura minima de rutas criticas (sync 409 + merge + reintento).
- [ ] E2E basico (crear perfil, checks, sync entre dos sesiones, import/export).

### Operacion / despliegue
- [ ] Definir variables y defaults por entorno en docs de deploy (Coolify).
- [ ] Healthchecks y monitoreo basico (frontend/backend/db).
- [ ] Politica de backups programados y restauracion verificada.
- [ ] Checklist de release con validacion funcional minima.

---

## Regla operativa de sesion
- Tras cada correccion o cambio relevante, actualizar `DEVLOG.md` inmediatamente con:
  - que se cambio,
  - archivos tocados,
  - estado de validacion (tests/build),
  - siguiente paso recomendado.
- Objetivo: mantener continuidad si se pierde la sesion.

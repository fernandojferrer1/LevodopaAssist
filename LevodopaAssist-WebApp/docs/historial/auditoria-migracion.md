# Auditoría de migración — LevodopaAssist → Vercel + Supabase

**Fecha:** 2026-10-27  
**Alcance:** solo análisis (sin cambios de código salvo este informe).  
**Objetivo declarado:** frontend + backend en el mismo proyecto Vercel (mismo dominio); datos vía `@supabase/supabase-js` desde el backend con secret key (sin Prisma ni connection strings); Auth de Supabase en un paso posterior.

---

## 1. Estructura y build

### Layout del monorepo

```
LevodopaAssist/                    # raíz operativa (npm run dev unificado)
  package.json                     # concurrently; NO usa npm workspaces
  scripts/setup.mjs                # crea .env SQLite + prisma migrate/generate
  *.cmd / INSTALACION.md           # flujo Windows local
  webapp/
    backend/                       # Express + Prisma + SQLite
    frontend/                      # Vite + React
```

No hay `workspaces` en ningún `package.json`. La raíz orquesta con `--prefix`:

| Paquete | `type` | Scripts relevantes |
|--------|--------|--------------------|
| **Raíz** `levodopa-assist` | (default) | `postinstall` → npm install backend+frontend; `setup`; `dev` (concurrently); `dev:backend` / `dev:frontend` |
| **backend** | `"commonjs"` | `dev` = `tsx watch src/index.ts`; `build` = `tsc`; `start` = `node dist/index.js` |
| **frontend** | `"module"` (ESM) | `dev` = `vite`; `build` = `tsc -b && vite build`; `preview`; `test` |

Dependencia de orquestación en raíz: `concurrently@^9.2.1`.

### Node / TypeScript

- **No hay** campo `engines` ni `.nvmrc` / `.node-version` en el repo. README e instalación Windows piden **Node.js LTS**. En la máquina de auditoría: **Node v22.22.2**.
- **Backend `tsconfig.json`:** `target: ES2022`, `module`/`moduleResolution: node16`, `outDir: dist`, `rootDir: src`, `strict: true`. Compatible con `"type": "commonjs"` (emisión CJS vía node16).
- **Frontend:** project references (`tsconfig.app.json` + `tsconfig.node.json`). App: `module: esnext`, `moduleResolution: bundler`, `jsx: react-jsx`, `noEmit: true` (Vite emite el bundle).

### Build del frontend y output

- Comando: `npm run build` en `webapp/frontend` → `tsc -b && vite build`.
- **Output por defecto de Vite:** `webapp/frontend/dist/` (no hay `build.outDir` custom en `vite.config.ts`).
- En dev, proxy Vite: `/api` → `http://127.0.0.1:4000` (hardcodeado solo en config de desarrollo).

### Implicación Vercel

Hoy son **tres package.json independientes** sin workspaces. Para un solo proyecto Vercel hará falta un layout de build (p. ej. frontend como static + backend como Serverless/Edge Function, o monorepo con `vercel.json` / builds separados). El `app.listen` actual no es el modelo de export para serverless (ver §2).

---

## 2. Backend Express (compatibilidad con Vercel serverless)

### Punto de entrada

Archivo: `webapp/backend/src/index.ts`

1. Crea `const app = express()`.
2. Registra middlewares y routers.
3. **Siempre** llama `app.listen(port)` (default `process.env.PORT ?? 4000`).

Para Vercel hay que **separar** la definición de `app` del `listen` (exportar el handler / `app` sin escuchar en runtime serverless). Hoy no existe ese split.

Cliente DB: `webapp/backend/src/db/client.ts` → `export const prisma = new PrismaClient()` (singleton de módulo).

### Rutas (lista completa)

Montaje en `index.ts` + routers:

| Método | Path efectivo | Archivo | Qué hace |
|--------|---------------|---------|----------|
| `GET` | `/api/health` | `index.ts` | `{ status: "ok" }` |
| `GET` | `/api/patients` | `routes/patients.ts` | Lista pacientes; query opcional `?q=` con `contains` en `fullName`, `nationalId`, `diagnosis`; `orderBy fullName asc`. Sin paginación. |
| `POST` | `/api/patients` | idem | Crea paciente; valida `fullName` y `age`; `extraFields` se guarda como `JSON.stringify`. Conflicto DNI → 409 (`P2002`). |
| `GET` | `/api/patients/:id` | idem | Detalle paciente. |
| `PATCH` | `/api/patients/:id` | idem | Update parcial. |
| `GET` | `/api/patients/:patientId/measurements` | `routes/measurements.ts` | Lista mediciones del paciente **sin** `rawSamplesJson` ni contracciones (select explícito de métricas); `orderBy measuredAt desc`. |
| `POST` | `/api/patients/:patientId/measurements` | idem | Valida body; `count+1` → `sequenceNumber`; opcionalmente `detectContractions` + `computeDerivedMetrics`; `create` con nested `contractions.create`; responde 201 con medición + contracciones (**incluye** `rawSamplesJson`). |
| `GET` | `/api/measurements/:id` | idem | Detalle con `include: { contractions ordered }`; **incluye** `rawSamplesJson`. |
| `DELETE` | `/api/measurements/:id` | idem | `$transaction`: borra comparisons que referencian la medición, contractions, luego measurement. |
| `GET` | `/api/patients/:patientId/comparisons` | `routes/comparisons.ts` | Lista comparisons con `include: { measurementA, measurementB }` (**mediciones completas, con `rawSamplesJson`**) y parsea `metricsJson` → `metrics`. |
| `POST` | `/api/patients/:patientId/comparisons` | idem | Valida IDs; `computeComparisonMetrics`; crea comparison; responde con A/B incluidos. |
| `GET` | `/api/comparisons/:id` | idem | Detalle con A/B incluidos (otra vez mediciones completas). |

No hay rutas de auth, upload de archivos, ni WebSocket.

### Middlewares

| Middleware | Config | Notas |
|------------|--------|-------|
| `cors()` | defaults | Abierto; en mismo dominio Vercel puede sobrar o restringirse. |
| `express.json()` | **sin `limit`** | Default Express ≈ **100 KB**. Hoy alcanza para mediciones típicas (~4–9 KB); si crece el sample rate/duración, el backend local rechaza **antes** que el límite ~4.5 MB de Vercel. |
| Error handler | 4 args al final de `index.ts` | Log + `{ error: "Error interno..." }`. Las rutas async **no** envuelven todo en `next(err)` de forma uniforme: varios `throw` dependen de Express 5 / promesas; conviene auditar al portar. |
| Logging | solo `console.error` en error handler y fallos de listen | Sin request logger. |

### Incompatibilidades / fricciones con serverless

| Tema | ¿Presente? | Detalle |
|------|------------|---------|
| `app.listen` | **Sí** | Debe eliminarse del entry serverless. |
| Escritura en disco (fuera `/tmp`) | **No** en runtime de rutas | Solo Prisma/SQLite escribe `dev.db` vía datasource local; al pasar a Supabase HTTP desaparece. `scripts/setup.mjs` escribe `.env` (tooling, no runtime API). |
| Estado en memoria entre requests | Mínimo | Singleton `PrismaClient`; no caches de negocio ni Maps mutables. En serverless el singleton es patrón habitual pero con Prisma/SQLite no aplica el destino; con supabase-js un client por cold start está bien. |
| `setInterval` / background jobs | **No** en backend | (El frontend sí usa intervals para flush del serial.) |
| WebSockets | **No** | |
| Lectura de archivos locales en runtime | **No** | |
| Proceso largo en request | **Sí, acotado** | `detectContractions` + métricas en el POST de medición (CPU en el mismo request). |
| Race `sequenceNumber` | **Sí** | `count() + 1` sin transacción/unique retry bajo concurrencia (dos POSTs paralelos al mismo paciente pueden chocar con `@@unique([patientId, sequenceNumber])`). En serverless con varias instancias el riesgo sube. |

### Operaciones potencialmente lentas

**`detectContractions(rawSamples, durationMs)`** (`contractionDetection.ts`):

- Copia + sort → **O(n log n)**.
- Un pase de histéresis → **O(n)**.
- Expansión de flancos + filtro de tono → **O(n + C·margen)**.
- Memoria: copia ordenada ≈ otra copia del array.

**`computeDerivedMetrics`:** O(C) en contracciones + O(n) si calcula iEMG (un `mean` sobre samples). Despreciable frente a la detección.

**Estimación de tiempo (medición típica ~10 s, ~700–1000 muestras, ~15 contracciones):**

| n muestras | Orden de magnitud CPU (Node, un request) |
|------------|------------------------------------------|
| ~700–1 000 (típico actual) | **≪ 5–15 ms** (sort pequeño; benchmark sintético ~0.3–1 ms solo sort+scan) |
| ~10 000 | ~diez(s) de ms |
| ~60 000 | ~decenas–baja centena de ms |

**Conclusión:** para el protocolo actual (~10 s) el CPU **no** es el cuello de botella frente a latencia de red a Supabase. Sí suma al timeout de la función si en el futuro sube mucho n **y** se hacen varias idas a Supabase en serie (insert measurement + N contractions).

---

## 3. Tamaño de los datos (límite ~4.5 MB body en Vercel)

### Estado de `webapp/backend/prisma/dev.db` (solo lectura)

| Métrica | Valor |
|---------|------:|
| Tamaño archivo | **81 920 bytes** (más `dev.db-journal` residual de migrate) |
| Pacientes | **0** |
| Mediciones | **0** |
| Contracciones | **0** |
| Comparaciones | **0** |
| `rawSamplesJson` min / avg / max | **N/A** (sin filas) |

La base local de esta copia es **vacía** (creada por `npm run setup` / migrate). **No hay datos clínicos reales en esta working copy** para medir percentiles empíricos.

`dev.db` está en `.gitignore` del backend y **no está trackeado** en el commit actual del repo (`git ls-files` vacío para `*.db`). Historial local revisado: un commit (`first commit`) sin `dev.db`.

### Estimación desde código / protocolo (sustituto del vacío en DB)

Fuentes:

- Ventana de medición documentada: **~10 000 ms** (comentarios en `contractionDetection.ts`; fixtures del parser con `timerMedicionMs ≈ 10011–10023`).
- Firmware viejo: señal cruda **~71,4 Hz** (~14 ms/muestra).
- Comentarios: ~**15** contracciones en 10 s (~cada 650 ms); última a menudo truncada.
- Serial: baud **115200** (`SerialMeasurementSession.ts`).
- Request de alta: `rawSamples: number[]` (no el string); response/detalle: campo `rawSamplesJson` (string JSON embebido).

Estimaciones de tamaño JSON (UTF-8, `separators` compactos):

| Escenario | n muestras | Body POST crear (est.) | Response detalle GET (est.) |
|-----------|----------:|-----------------------:|----------------------------:|
| Típico 10 s @ 71 Hz, ~15 contracciones | 714 | **~4,4 KB** | **~6,5 KB** |
| Típico 10 s @ 100 Hz | 1 000 | **~6 KB** | **~8,6 KB** |
| 30 s @ 100 Hz | 3 000 | **~17 KB** | **~22 KB** |
| 60 s @ 200 Hz | 12 000 | **~75 KB** | **~85 KB** |
| Extremo 120 s @ 500 Hz | 60 000 | **~366 KB** | **~383 KB** |

**Peor caso futuro razonable** si se mantiene ventana clínica de ~10–30 s y tasas de envolvente del orden de 50–200 Hz: payloads **≪ 100 KB**, muy por debajo de 4.5 MB.

**Riesgo de respuesta (no solo request):** `GET /api/patients/:id/comparisons` hace `include` de `measurementA` y `measurementB` **completos** (con `rawSamplesJson`). Con 5 comparaciones y raw típico ≈ **~43 KB**; con muchas comparaciones × raw grandes puede crecer linealmente. `PatientDetail` pide esa lista al cargar el paciente.

**Otro límite más cercano que 4.5 MB:** `express.json()` default **~100 KB**. Escenarios “60 s @ 200 Hz” ya se acercan; un firmware más denso rompería primero el parser de body de Express (hoy) antes que Vercel.

### Frecuencia / duración (síntesis)

- Duración típica: **~10 s**.
- Tasa histórica cruda: **~71,4 Hz**; envolvente v3D: saltos chicos entre muestras (no se hardcodea 14 ms; `sampleMs = durationMs / n`).
- Contracciones típicas por ventana: **~10–15** (orden de magnitud de los comentarios de Medición06–08).

---

## 4. Uso de Prisma

### Modelos (`schema.prisma`)

**Datasource:** `provider = "sqlite"`, `url = env("DATABASE_URL")`.

Ninguna relación declara `onDelete` / `onUpdate` → default Prisma **Restrict** en FKs requeridas (por eso el DELETE de medición borra comparisons a mano).

#### `Patient`
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | String @id @default(cuid()) | |
| `fullName` | String | |
| `age` | Int | |
| `nationalId` | String? @unique | |
| `diagnosis`, `notes`, `extraFields` | String? | `extraFields` es JSON serializado a mano |
| `createdAt` / `updatedAt` | DateTime | default now / @updatedAt |
| Relaciones | `measurements`, `comparisons` | |

#### `Measurement`
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | String @id cuid | |
| `patientId` | String → Patient | |
| `sequenceNumber` | Int | `@@unique([patientId, sequenceNumber])` |
| `medicationState` | String | app: `sin_levodopa` \| `post_levodopa` |
| `measuredAt` | DateTime | |
| `location`, `notes` | String? | |
| `status` | String @default("completed") | también `"aborted"` |
| Resumen firmware/backend | `conNum`, `timerMedicionMs`, `conXMinuto`, `peakMax`, `promedioPeaks`, `yyn`, `promedioLthMs`, `promedioBtwMs`, `thresh` | Float/Int |
| Derivadas | `amplitudeDecrementPct`, `durationDecrementPct`, `durationCvPct`, `peakToBaseRatio`, `iemg`, `restingToneMv`, `incompleteRelaxationPct` | Float? |
| `detectionSource` | String @default("firmware") | `"backend"` \| `"firmware"` |
| `detectionNote` | String? | |
| `rawSamplesJson` | String? | array JSON de mV |
| `createdAt` | DateTime | |
| Índices | `@@index([patientId, measuredAt])` | |
| Relaciones | `contractions`; comparisons AsA / AsB | |

#### `MeasurementContraction`
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | cuid | |
| `measurementId` | → Measurement | |
| `sequenceIndex` | Int | |
| `amplitude`, `durationMs` | Float | |
| `truncated` | Boolean @default(false) | |
| Índice | `@@index([measurementId, sequenceIndex])` | |

#### `Comparison`
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | cuid | |
| `patientId` | → Patient | |
| `measurementAId` / `measurementBId` | → Measurement | relaciones nombradas |
| `metricsJson` | String | JSON de deltas |
| `createdAt` | DateTime | |
| Índice | `@@index([patientId])` | |

### Llamadas Prisma (inventario)

| Archivo | Operación | Detalle |
|---------|-----------|---------|
| `patients.ts` | `findMany` | `where` OR `contains` ×3; `orderBy fullName` |
| | `create` | |
| | `findUnique` | by id |
| | `update` | by id |
| `measurements.ts` | `findMany` | by patientId; **select** (sin raw); `orderBy measuredAt desc` |
| | `findUnique` | patient; measurement |
| | `count` | para sequenceNumber |
| | `create` | **nested** `contractions: { create: [...] }`; `include: { contractions }` |
| | `findUnique` + `include contractions` | detalle |
| | `$transaction([...])` | deleteMany Comparison + deleteMany Contraction + delete Measurement |
| `comparisons.ts` | `findMany` | include measurementA/B; orderBy createdAt desc |
| | `findUnique` ×2 | mediciones A/B |
| | `create` | include A/B |
| | `findUnique` | comparison + include A/B |

**No hay** `$queryRaw` / `$executeRaw`.  
**No hay** paginación (`take`/`skip`/`cursor`).  
**Búsqueda:** solo `contains` en pacientes (en SQLite case-sensitivity distinta a Postgres; con supabase-js conviene `ilike`).

### Escrituras multi-tabla que deben ser atómicas

1. **Crear medición + N contracciones** — hoy un solo `prisma.measurement.create` nested (atómico en una transacción Prisma). En Supabase: transacción SQL, RPC, o insert padre + hijos con manejo de rollback manual.
2. **Borrar medición** — explícitamente `$transaction` de 3 pasos (comparisons → contractions → measurement). Debe replicarse.
3. **Crear comparison** — una sola fila (métricas precomputadas); lecturas previas no mutan. Atomicidad simple.
4. **`sequenceNumber = count + 1`** — **no** es atómico hoy; hay que reemplazar por `max(sequence)+1` en transacción, advisory lock, o columna identity/`serial` por paciente.

`comparison.ts` tipa con `import { Measurement } from "@prisma/client"` — acoplamiento de tipos a eliminar junto con Prisma.

---

## 5. Frontend

### URLs de API

`webapp/frontend/src/api/client.ts`:

```ts
fetch(`/api${path}`, { headers: { "Content-Type": "application/json" }, ...init })
```

- **Siempre paths relativos `/api/...`**. Correcto para mismo dominio en Vercel.
- **No** hay `localhost` ni base URL en el cliente.
- Único `127.0.0.1:4000`: proxy de **dev** en `vite.config.ts`.

### Variables de entorno

- **Ningún** uso de `import.meta.env` / `VITE_*` en `src/`.
- Para Auth futuro hará falta introducir `VITE_SUPABASE_URL` + anon key en el cliente; la **secret key solo en backend** (env de Vercel server-side).

### Rutas React Router (`App.tsx` + `BrowserRouter` en `main.tsx`)

| Path | Página |
|------|--------|
| `/` | `PatientList` |
| `/patients/:patientId` | `PatientDetail` |
| `/patients/:patientId/measurements/new` | `NewMeasurement` |
| `/patients/:patientId/measurements/:measurementId` | `MeasurementDetail` |
| `/patients/:patientId/compare` | `CompareMeasurements` |
| `/patients/:patientId/comparisons/:comparisonId` | `ComparisonDetail` |

Para Vercel: rewrite SPA → `index.html` en todas las rutas no-`/api`.

### Errores de red y carga

- Cliente: si `!res.ok`, parsea JSON y `throw new Error(body.error ?? ...)`.
- Páginas: patrón repetido `useState` error + `patients/measurement === null` → texto “Cargando...”; banners `banner-error`.
- `NewMeasurement`: estados de UI (`form` / measuring / `saving` / results); catch al guardar; Web Serial con mensajes propios.
- No hay retry global, toast system, ni React Query; cada página hace `fetch` al montar.

**Web Serial** sigue siendo 100% browser-local (Chrome/Edge); el deploy en Vercel **no** mueve el USB — solo centraliza pacientes/mediciones.

---

## 6. Configuración y archivos a eliminar / reemplazar después

### Referencias a stack local actual

| Recurso | Referencias |
|---------|-------------|
| SQLite / `dev.db` / `DATABASE_URL` | `prisma/schema.prisma`, `backend/.env`, `scripts/setup.mjs`, `instalar.cmd`, `diagnostico.cmd`, `dev-backend.cmd`, README / INSTALACION / webapp README |
| Prisma | `backend/package.json`, `src/db/client.ts`, todas las routes, `services/comparison.ts` (tipo), carpeta `prisma/migrations`, scripts setup/instalar |
| `localhost:4000` | `vite.config.ts` (proxy), `Abrir LevodopaAssist.cmd` (health check), mensajes de `index.ts` |
| `scripts/setup.mjs` | `package.json` raíz (`npm run setup`) |
| Windows `.cmd` | `instalar.cmd`, `Abrir LevodopaAssist.cmd`, `dev-backend.cmd`, `dev-frontend.cmd`, `diagnostico.cmd` |

Tras migrar: eliminar o archivar Prisma/SQLite/cmd/setup local; sustituir README por flujo Vercel + Supabase.

### `.gitignore` y secretos / PHI

| Archivo | ¿Ignorado? | ¿Commiteado? |
|---------|------------|--------------|
| `webapp/backend/.env` | Sí (`backend/.gitignore`) | **No** |
| `webapp/backend/prisma/dev.db` (+ journal) | Sí | **No** en el árbol git actual |
| `node_modules`, `dist` | Sí (raíz / frontend / backend) | No |

**Aviso PHI:** esta `dev.db` está vacía. Si en **otras** PCs (p. ej. Octavio) o en un remoto/fork antiguo hubiera un `dev.db` con pacientes commiteado, hay que rotar/tratar como incidente de datos — **en este repo/commit no aparece**. El `.gitignore` raíz **no** lista `dev.db` explícitamente (sí el del backend); conviene reforzar en raíz al limpiar.

---

## 7. Riesgos y recomendaciones (priorizados)

| Prio | Problema | Solución propuesta |
|------|----------|-------------------|
| P0 | Entry con `app.listen`; no hay handler Vercel | Extraer `app` a `app.ts` / `server.ts`; entry serverless `export default app` (o `http` adapter); `listen` solo en script local opcional. |
| P0 | Prisma + SQLite → hay que reemplazar todo el acceso a datos | Schema Postgres en Supabase; backend solo `@supabase/supabase-js` con **service role** en env server; mapear cada ruta a queries; RPC/transacción para create medición+contracciones y delete en cascada lógica. |
| P0 | API hoy **sin autenticación** | Antes o junto al Auth: no exponer service role al browser; todas las mutaciones vía backend; luego Supabase Auth + validar JWT en backend (o RLS + anon con políticas estrictas — el plan pide secret en backend). |
| P1 | `express.json()` default 100 KB | Subir `limit` de forma consciente (p. ej. `1mb` o `2mb`) al portar; documentar techo clínico. |
| P1 | Listado de comparisons incluye `rawSamplesJson` ×2 por fila | En el rediseño Supabase: select de mediciones **sin** raw en listados; raw solo en `GET /measurements/:id`. Reduce payload y costo. |
| P1 | `sequenceNumber` con race | Transacción / `max+1` con retry en unique violation, o secuencia por paciente. |
| P1 | Monorepo sin workspaces + dos builds | `vercel.json`: build frontend → `dist`; rewrites `/api/*` → función; SPA fallback. Alinear Node LTS en Vercel (`engines`). |
| P2 | `contains` SQLite ≠ búsqueda Postgres | Usar `ilike` / full-text en Supabase. |
| P2 | Tipos acoplados a `@prisma/client` | Tipos propios compartidos o generados desde OpenAPI/Zod. |
| P2 | Scripts Windows / setup Prisma | Deprecar tras cloud; o dejar solo como modo offline opcional (fuera de alcance si el destino es 100% cloud). |
| P2 | Cold start + CPU detección | Irrelevante a n típico; si n crece mucho, mover detección a Edge con límite o a job asíncrono (overkill hoy). |

### Recomendación concreta sobre el límite 4.5 MB

Con el protocolo actual (~10 s, ~70–100 Hz, ~15 contracciones) el POST de medición ronda **5–10 KB** y el GET de detalle **~7–10 KB**. Incluso escenarios alargados (30–60 s) quedan **muy por debajo de 4.5 MB**.

**No hace falta** comprimir ni externalizar `rawSamples` a Storage **por el límite de Vercel** en el diseño clínico actual.

**Sí conviene:**

1. Subir el `limit` de `express.json` (o el body parser del runtime Vercel/Node) por encima del default 100 KB si se prevé más densidad.
2. **No** devolver `rawSamplesJson` en listados de comparisons/measurements.
3. Re-medir con una DB real de producción/Octavio cuando exista (esta auditoría no tuvo filas).
4. Si en el futuro la ventana × Hz empujara hacia **> ~1–2 MB**, entonces: Storage (archivo JSON/CSV por medición) + metadata en tabla, o downsampling de la envolvente guardada.

---

## Resumen (≤10 líneas)

LevodopaAssist es un monorepo npm **sin workspaces**: Vite/React (ESM) + Express 5 CommonJS/Prisma/SQLite local, orquestados por `npm run dev` en la raíz. El backend escucha con `app.listen` y expone CRUD de pacientes/mediciones/comparaciones bajo `/api`, con detección de contracciones y métricas derivadas en el POST de medición (CPU bajo a ~10 s). La `dev.db` de esta copia está **vacía** y no está en git; tamaños de payload se estiman en ~5–10 KB típicos ≪ 4.5 MB de Vercel (el default 100 KB de `express.json` es el techo más cercano). Prisma cubre cuatro modelos sin `onDelete`; las únicas multi-escrituras críticas son create nested medición+contracciones y el `$transaction` de borrado. El frontend ya usa `/api` relativo (ideal mismo dominio); no hay env Vite ni auth. Para Vercel+Supabase: separar listen, reemplazar Prisma por supabase-js (service role), atomicidad SQL, dejar de incluir raw en listados, y planear Auth en el paso siguiente.

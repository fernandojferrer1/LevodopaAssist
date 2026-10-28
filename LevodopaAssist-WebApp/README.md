# LevodopaAssist

App web para mediciones EMG en pacientes con Parkinson: alta de pacientes, captura en tiempo real desde un ESP32 por USB (Web Serial) y comparación de resultados antes/después de levodopa. Los datos viven en Supabase; la app se sirve desde Vercel.

## Cómo se usa

1. Abrí la **URL de producción** del proyecto en Vercel (Dashboard → Project → Domains).
2. Ingresá con la cuenta que te asignaron (no hay registro público).
3. Navegadores compatibles: **Chrome o Edge de escritorio**. Web Serial no funciona en Firefox, Safari ni en móviles.
4. Conectá el ESP32 por USB, iniciá una medición desde el paciente y elegí el puerto serie cuando el navegador lo pida.

## Arquitectura

```
  Navegador (Chrome/Edge)
       │  HTTPS (misma URL)
       ├─► Vercel  frontend (Vite/React)     /*  SPA
       │          backend  (Express)         /api/*  Service
       │               │
       │               │  supabase-js + secret key
       └─► USB local   ▼
           (Web Serial)   Supabase (Auth + Postgres)
```

- **Vercel:** hostea el frontend y el backend como dos services del mismo proyecto (`vercel.json`). El SPA llama `/api/...` en el mismo dominio. El fallback SPA (`/(.*) → /index.html`) vive **dentro** del service `frontend`: con Services el rewrite top-level solo elige el service; sin ese fallback interno, F5 en `/login` u otras rutas de React Router devolvería el 404 de Vercel.
- **Supabase:** autenticación (JWT) y base de datos compartida. El backend usa la **secret key** (bypasea RLS); el frontend solo la publishable key para Auth.
- **USB es local:** Web Serial corre en el PC del usuario. El firmware del ESP32 no habla con la nube; la señal viaja navegador → backend → Supabase al guardar.

Región de deploy: `pdx1` (Oregon), alineada con Supabase us-west-2.

## Desarrollo local

**Requisitos:** Node.js **22.x**.

```bash
git clone <repo>
cd LevodopaAssist          # carpeta que contiene package.json y vercel.json

npm install

# Backend
cp webapp/backend/.env.example webapp/backend/.env
# Completá SUPABASE_URL y SUPABASE_SECRET_KEY

# Frontend
cp webapp/frontend/.env.example webapp/frontend/.env.local
# Completá VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY

npm run dev                # backend :4000 + frontend :5173 (proxy /api → backend)
```

Abrí `http://localhost:5173` en Chrome o Edge.

Smoke (con el backend levantado):

```bash
npm run smoke --prefix webapp/backend
```

Otros scripts útiles: `npm run build` (typecheck backend + build frontend), `npm test --prefix webapp/frontend`.

## Variables de entorno

| Nombre | Dónde | Secreta | Notas |
|--------|--------|---------|--------|
| `SUPABASE_URL` | backend / Vercel (service backend) | No (URL del proyecto) | Misma URL del dashboard de Supabase |
| `SUPABASE_SECRET_KEY` | backend / Vercel (service backend) | **Sí** | Solo servidor; nunca en el frontend |
| `VITE_SUPABASE_URL` | frontend `.env.local` / Vercel (service frontend) | No | Se inyecta en el **build** |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | frontend `.env.local` / Vercel (service frontend) | Pública (publishable) | No es la secret key |
| `PORT` | backend local (opcional) | No | Default `4000` |
| `SMOKE_BASE_URL` | solo smoke (opcional) | No | Default `http://127.0.0.1:4000/api` |

En Vercel cargá las cuatro variables principales en Production y Preview. Si cambiás `VITE_*`, hace falta **redeploy** (a veces con rebuild limpio) porque se embeben en el bundle.

## Deploy

- **Root Directory** del proyecto Vercel = carpeta `LevodopaAssist` (donde está `vercel.json`).
- Push a `main` → producción automática (si el repo está conectado).
- Plan Hobby: el **autor del commit** tiene que ser la cuenta dueña del proyecto en Vercel; si no, el deploy se bloquea.
- Node 22 (`engines` en el `package.json` raíz).
- Tras cambiar variables `VITE_*` en el dashboard: redeploy.

Checklist rápido post-deploy: `GET /api/health` → ok; sin sesión `/` redirige a `/login`; login con usuario del dashboard; crear paciente; medición ESP32; comparación; logout.

## Base de datos

Fuente de verdad del schema: `supabase/migrations/`.

Para un cambio:

1. Creá un archivo nuevo `supabase/migrations/NNNN_nombre.sql` (siguiente número).
2. Aplicá el SQL en el **SQL Editor** del dashboard de Supabase (o el flujo CLI que uses).
3. No hay Prisma ni connection string: el backend habla con la Data API vía `@supabase/supabase-js`.

**RLS** está **activado** en las tablas clínicas y **sin policies**. Así la Data API con anon/authenticated queda cerrada; solo el backend con **service role** puede leer/escribir. Eso es intencional.

## Usuarios

- Crear, resetear contraseña y desactivar: Supabase Dashboard → **Authentication → Users**.
- El **registro público está desactivado**: no hay signup desde la app; solo cuentas creadas a mano.
- Provider Email habilitado; Sign ups / “Allow new users to sign up” deshabilitado.

## Sesión

- La sesión se guarda en **`sessionStorage`**: F5 mantiene el login; cerrar la pestaña o abrir el sitio de nuevo pide login.
- Cierre por **inactividad a los 30 minutos** (mouse, teclado, scroll, touch). Constante: `webapp/frontend/src/auth/sessionConfig.ts` → `INACTIVITY_TIMEOUT_MS`.
- Excepción: mientras hay una medición en curso o resultados sin guardar, no se cierra la sesión por inactividad.

## Problemas frecuentes

| Síntoma | Qué mirar |
|---------|-----------|
| No aparece el puerto serie | Chrome/Edge de escritorio; cable USB; el ESP32 no está abierto en otra app; Permissions-Policy no debe bloquear `serial`. |
| "No autorizado" | Sesión vencida o token inválido; volvé a `/login`. El backend exige Bearer JWT en `/api` (salvo `/api/health`). |
| Deploy bloqueado por autor del commit | En Hobby, el commit debe ser de la cuenta dueña del proyecto Vercel. |
| Faltan variables `VITE_*` / pantalla de config en login | Definilas en Vercel (service frontend) y **redeploy**. |
| Supabase pausado | En el plan gratis el proyecto se pausa por inactividad; reactivá desde el dashboard. |
| Puerto 4000 ocupado en local | Cerrá el otro proceso o cambiá `PORT` en `webapp/backend/.env`. |

## Versión anterior

El tag anotado **`v1-sqlite-local`** conserva la última versión con SQLite local, Prisma y scripts Windows (`.cmd`). No está en el flujo actual de producción.

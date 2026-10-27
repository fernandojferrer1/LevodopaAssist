# Deploy en Vercel (Services: frontend + backend)

Un solo proyecto Vercel con **dos services** ([docs](https://vercel.com/docs/services)):

| Service    | Root                 | Framework | Público        |
|------------|----------------------|-----------|----------------|
| `backend`  | `webapp/backend`     | Express   | `/api/*`       |
| `frontend` | `webapp/frontend`    | Vite      | `/*` (resto)   |

No hay **bindings**: el SPA llama `fetch('/api...')` desde el navegador (same-origin). El backend recibe el path completo (`/api/patients`, etc.).

## Región

`regions`: **`pdx1`** (Oregon), alineado con Supabase **us-west-2**.

| Supabase (aprox.) | Vercel `regions` |
|-------------------|------------------|
| West US (Oregon) / us-west-2 | `pdx1` |
| East US (N. Virginia) / us-east-1 | `iad1` |
| West US (N. California) / us-west-1 | `sfo1` |
| South America (São Paulo) / sa-east-1 | `gru1` |
| EU West (Ireland) / eu-west-1 | `dub1` |
| EU Central (Frankfurt) | `fra1` |

## Configuración en el dashboard

1. **Import** del repo; **Root Directory** = carpeta `LevodopaAssist` (donde está `vercel.json`).
2. Framework Preset: lo define cada service (`express` / `vite`); no hace falta override global.
3. **Node.js:** 22.x (`engines` en `package.json` raíz).

### Variables de entorno

Cargar en **Production** y **Preview** (y Development si usás `vercel dev`):

| Nombre | Service | Notas |
|--------|---------|-------|
| `SUPABASE_URL` | backend | Sin prefijo `VITE_` |
| `SUPABASE_SECRET_KEY` | backend | Solo server-side; **nunca** en el frontend |
| `VITE_SUPABASE_URL` | frontend | Misma URL del proyecto |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | frontend | Publishable key (no la secret) |

Las variables `VITE_*` se **inyectan en el build** del frontend: si las cambiás, hace falta **redeploy** (un redeploy sin rebuild de cache limpia puede no alcanzar; forzá rebuild si no se actualizan).

Tras cambiar env vars, redeploy.

### Usuarios (Supabase Auth)

El signup público está desactivado: solo entran cuentas creadas a mano.

1. Supabase Dashboard → **Authentication → Users → Add user**.
2. Completá email + contraseña (o “Create user”).
3. Para **resetear contraseña**: el mismo listado → menú del usuario → **Send password recovery** o **Reset password** / editar usuario según la UI vigente.
4. En **Authentication → Providers**, dejá Email habilitado; deshabilitá Sign ups / “Allow new users to sign up” si está disponible, para que no haya registro desde la app.

## Preview / producción

```bash
git push            # Preview por PR/rama si el repo está conectado
npx vercel          # preview (CLI)
npx vercel --prod   # production
```

Local con services:

```bash
npx vercel dev
# o sin cloud: npx vercel dev -L
```

Desarrollo sin Vercel:

```bash
npm install && npm run setup   # si falta .env del backend
# frontend: copiá webapp/frontend/.env.example → .env.local
npm run dev
npm run smoke --prefix webapp/backend   # solo health + 401s; sin login
```

## Logs

Dashboard → Deployment → **Runtime Logs**. Filtrá por service `backend` o path `/api/...`.  
Mutaciones loguean `[audit] ISO email=… METHOD url resource=…` (sin datos clínicos).  
Si faltan `SUPABASE_*` en el backend, falla al importar `db/supabase.ts`.

## Checklist post-deploy

- [ ] `GET https://<dominio>/api/health` → `{ "status": "ok" }`
- [ ] Sin cookie/sesión, `/` redirige a `/login`
- [ ] Login con usuario del dashboard; email incorrecto muestra mensaje en castellano
- [ ] Crear paciente, listar, abrir detalle
- [ ] Medición con ESP32 (Chrome/Edge), guardar; si la sesión expirara al guardar, el modal de re-login no pierde la medición
- [ ] Crear comparación entre dos mediciones
- [ ] Cerrar sesión y verificar que no se pueda volver atrás a datos
- [ ] Web Serial sin `Permissions-Policy` que bloquee `serial`
- [ ] `/api/*` con `Cache-Control: no-store`
- [ ] `regions` = `pdx1`

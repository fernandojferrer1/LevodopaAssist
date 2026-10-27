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

Cargar en Production / Preview / Development (aplican al service `backend`):

| Nombre | Notas |
|--------|-------|
| `SUPABASE_URL` | Sin prefijo `VITE_` |
| `SUPABASE_SECRET_KEY` | Solo server-side; nunca en el frontend |

Tras cambiar env vars, redeploy.

## Preview / producción

```bash
git push            # Preview por PR/rama si el repo está conectado
npx vercel          # preview (CLI)
npx vercel --prod   # production
```

Local con services (inyecta bindings si los hubiera):

```bash
npx vercel dev
# o sin cloud: npx vercel dev -L
```

Desarrollo sin Vercel (sigue válido):

```bash
npm install && npm run setup   # si falta .env
npm run dev                    # backend :4000 + Vite :5173
npm run smoke --prefix webapp/backend
```

## Logs

Dashboard → Deployment → **Runtime Logs**. Filtrá por service `backend` o path `/api/...`.  
Si faltan `SUPABASE_*`, el backend falla al importar `db/supabase.ts` con un mensaje claro.

## Checklist post-deploy

- [ ] `GET https://<dominio>/api/health` → `{ "status": "ok" }`
- [ ] Refrescar `/patients/<id>` no da 404 (service frontend)
- [ ] Crear/listar un paciente
- [ ] Web Serial en Chrome/Edge (sin `Permissions-Policy` que bloquee `serial`)
- [ ] `/api/*` con `Cache-Control: no-store`
- [ ] `regions` = `pdx1`

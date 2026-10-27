# Deploy en Vercel (frontend estático + API Express)

Un solo proyecto Vercel sirve:

- el build de Vite (`webapp/frontend/dist`) en el dominio raíz;
- el backend Express como **una** Serverless Function en `/api/*` (`api/index.ts`).

## Diferencia con la doc “Express zero-config”

La documentación actual de Vercel para Express ([Express on Vercel](https://vercel.com/docs/frameworks/backend/express)) recomienda exportar la app desde `app.ts` / `server.ts` en la raíz **sin** carpeta `api/` ni rewrites: toda la app es Express.

Ese modelo **no sirve** para este repo: necesitamos SPA (React Router) + API bajo `/api` en el **mismo dominio**, con assets estáticos en CDN. Por eso usamos el modelo híbrido:

- `outputDirectory` = frontend;
- función en `api/index.ts` que reexporta `webapp/backend/src/app`;
- rewrites `/api/(.*)` → `/api` y fallback SPA → `/index.html`.

Los mounts de Express siguen siendo `/api/...` (igual que en local), para no tocar el frontend.

## Región de la función (alinear con Supabase)

En `vercel.json`, `regions` está en **`pdx1` (Portland / Oregon)**, alineado con Supabase **us-west-2 (Oregon)**.

Si movés el proyecto de Supabase a otra región, actualizá `regions` en `vercel.json`:

| Supabase (aprox.) | Vercel `regions` |
|-------------------|------------------|
| West US (Oregon) / us-west-2 | `pdx1` |
| East US (N. Virginia) / us-east-1 | `iad1` |
| West US (N. California) / us-west-1 | `sfo1` |
| South America (São Paulo) / sa-east-1 | `gru1` |
| EU West (Ireland) / eu-west-1 | `dub1` |
| EU Central (Frankfurt) | `fra1` |

Lista completa: [Vercel regions](https://vercel.com/docs/regions).

## Configuración del proyecto en el dashboard

1. **Import** del repo Git (root directory = carpeta que contiene `vercel.json` y `api/`, es decir la raíz de `LevodopaAssist`).
2. **Framework Preset:** Other (en el repo ya está `"framework": null`).
3. **Build / Output:** los define `vercel.json` (`installCommand`, `buildCommand`, `outputDirectory`). No hace falta override manual salvo debug.
4. **Node.js:** 22.x (`engines` en `package.json` raíz).

### Variables de entorno

En **Settings → Environment Variables**, cargar (Production, Preview y Development):

| Nombre | Valor | Notas |
|--------|-------|-------|
| `SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` | Sin prefijo `VITE_` |
| `SUPABASE_SECRET_KEY` | secret key del proyecto | Solo server-side; **nunca** en el frontend |

No hace falta `PORT` en Vercel.

Tras cambiar env vars, redeploy.

## Deploy de preview desde una rama

```bash
git checkout -b feature/mi-cambio
git push -u origin HEAD
```

Si el proyecto está conectado a GitHub/GitLab, Vercel crea un **Preview Deployment** automático por PR/push.

Con CLI (si está instalada):

```bash
npx vercel        # preview
npx vercel --prod # production
```

## Logs de la función

1. Dashboard → Deployment → **Logs** / **Runtime Logs**.
2. Filtrá por path `/api/...` o por el nombre de la función `api/index`.
3. Si faltan `SUPABASE_*`, el cold start falla al importar `db/supabase.ts` con un error explícito en esos logs.

## Checklist post-deploy

- [ ] `GET https://<dominio>/api/health` → `{ "status": "ok" }` (no 503).
- [ ] Abrir `/` carga la SPA; refrescar `/patients/<id>` no da 404 (fallback SPA).
- [ ] Crear un paciente y listarlo (mutación + lectura contra Supabase).
- [ ] En Chrome/Edge de escritorio, Web Serial sigue disponible (no hay `Permissions-Policy` que bloquee `serial`).
- [ ] Respuestas `/api/*` traen `Cache-Control: no-store`.
- [ ] Headers globales: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`.
- [ ] Confirmar que `regions` en `vercel.json` es `pdx1` (Supabase us-west-2).

## Desarrollo local (sin Vercel)

Sin cambios de flujo:

```bash
npm install
npm run setup   # solo si falta .env
npm run dev     # backend :4000 + Vite :5173 (proxy /api)
npm run smoke --prefix webapp/backend
```

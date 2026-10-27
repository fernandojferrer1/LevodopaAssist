/**
 * Entry serverless de Vercel (Node.js Function).
 *
 * La doc reciente de “Express zero-config” asume que toda la app ES Express
 * (entrypoint en la raíz / src/). Acá necesitamos híbrido: SPA estática + API
 * bajo /api en el mismo dominio, por eso usamos el directorio api/ + rewrites
 * (ver docs/deploy-vercel.md).
 *
 * Exportar la app Express como default es el patrón soportado por el runtime
 * Node de Vercel: la función recibe el request con el path original (/api/...),
 * que coincide con los mounts de Express.
 */
import app from "../webapp/backend/src/app";

export default app;

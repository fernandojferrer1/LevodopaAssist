# LevodopaAssist

App web para mediciones EMG: pacientes, lectura en tiempo real del ESP32 por USB (Web Serial) y comparación antes/después de levodopa.

## Requisitos

- Node.js LTS
- **Chrome o Edge de escritorio** (Web Serial no funciona en Firefox, Safari ni móviles)

## Arrancar (un solo comando)

Desde la raíz de este repo (`LevodopaAssist/`):

```bash
npm install      # primera vez: instala raíz + backend + frontend
npm run setup    # primera vez: crea .env y prepara la base SQLite
npm run dev      # levanta backend (:4000) y frontend (:5173) juntos
```

Abrí `http://localhost:5173` en Chrome o Edge.

Para detener todo: `Ctrl+C` en esa misma terminal.

No hace falta `npm run build` para desarrollo.

### Después de un `git pull`

Si cambió algún `package.json` o hay migraciones nuevas en `webapp/backend/prisma/migrations`:

```bash
npm install
npm run setup
```

## Windows (doble clic)

Si preferís no usar la terminal:

1. Doble clic en `instalar.cmd` (primera vez).
2. Doble clic en `Abrir LevodopaAssist.cmd`.

Detalle en [INSTALACION.md](./INSTALACION.md).

## Estructura

```
LevodopaAssist/
  package.json          # npm run dev unificado
  scripts/setup.mjs     # Prisma + .env
  webapp/
    backend/            # Express + TypeScript + Prisma + SQLite
    frontend/           # Vite + React + TypeScript
```

## Tests

```bash
npm test --prefix webapp/frontend
```

## Notas

- La base de datos es local (`webapp/backend/prisma/dev.db`); la app arranca sin pacientes.
- Evitá poner el proyecto dentro de OneDrive / Google Drive / Dropbox.
- Detalle técnico de la webapp: [webapp/README.md](./webapp/README.md).

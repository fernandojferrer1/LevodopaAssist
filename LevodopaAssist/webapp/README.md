# LevodopaAssist — Web App

App web para reemplazar el Excel de mediciones EMG: gestión de pacientes, mediciones en tiempo real leídas
directamente del ESP32 por USB (Web Serial API) y comparación de resultados antes/después de levodopa.

## Requisitos

- Node.js LTS
- **Chrome o Edge de escritorio** — Web Serial API no existe en Firefox, Safari, ni en navegadores móviles.

## Arrancar en desarrollo

Lo habitual es un solo comando desde la raíz del repo (`LevodopaAssist/`):

```bash
npm install
npm run setup
npm run dev
```

Eso levanta backend (puerto 4000) y frontend (puerto 5173, con proxy `/api` → `127.0.0.1:4000`).
Abrí `http://localhost:5173` en Chrome o Edge.

Ver también el [README de la raíz](../README.md).

### Por separado (opcional)

```bash
# Terminal 1 — backend
cd webapp/backend && npm run dev

# Terminal 2 — frontend
cd webapp/frontend && npm run dev
```

## Tests

```bash
cd webapp/frontend
npm test   # tests del parser de Web Serial (classifyLine) contra fixtures del protocolo real del firmware
```

## Estructura

```
webapp/
  backend/   Express + TypeScript + Prisma + SQLite (dev.db)
  frontend/  Vite + React + TypeScript
```

## Notas del protocolo serial

El ESP32 (`Firmware/EMG_v3D/EMG_v3D.ino`) no tiene un protocolo formal: no hay JSON, ni checksum, ni comando
para iniciar medición por software. El disparador real es **resetear físicamente el dispositivo** (botón o
power-cycle). El parser (`frontend/src/serial/parser.ts`) clasifica cada línea de texto heurísticamente:

- Una línea vacía se ignora.
- Una línea con un solo número es una muestra cruda (alimenta el gráfico en vivo).
- `,amplitud,duracion` (3 campos) es el detalle de una contracción.
- `,,,con_num,...,thresh` (12 campos) es el resumen final — única marca confiable de fin de medición.

Ver `webapp/frontend/src/serial/parser.test.ts` para los casos cubiertos.

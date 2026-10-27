# Instalar LevodopaAssist en otra PC (Windows)

## Requisitos

- Windows 10 u 11 con conexión a internet (solo para la instalación).
- **Chrome o Edge** para usar la app: la conexión USB con el ESP32 (Web Serial) no funciona en Firefox ni Safari.
- Driver USB del ESP32 si Windows no lo reconoce solo al enchufarlo (CP210x o CH340, según la placa).

## Paso a paso

1. **Conseguir la carpeta del proyecto.**
   - Con Git (recomendado, así después se sincroniza): instalar Git desde https://git-scm.com, abrir una terminal
     en la carpeta donde lo quieras (por ejemplo `C:\Proyectos`) y correr
     `git clone <URL-del-repo-en-GitHub>`.
   - Sin Git: descomprimir el .zip del proyecto en una carpeta.

   Conviene que la carpeta **no** esté dentro de OneDrive, Google Drive ni Dropbox (ver abajo).

2. **Doble clic en `instalar.cmd`** (en la raíz del proyecto). Hace todo solo:
   - instala Node.js LTS y Git con `winget` si no están (puede pedir permiso de administrador);
   - instala las dependencias del backend y del frontend;
   - crea `webapp\backend\.env` y la base de datos local `dev.db` (vacía si no vino una).

   Tarda unos minutos. Si algo falla, el mensaje queda en pantalla: copiarlo y pasárselo a Fer.

   > Si justo instaló Node.js y falla en el paso siguiente, cerrar la ventana y volver a ejecutar
   > `instalar.cmd` (a veces Windows necesita una ventana nueva para ver el programa recién instalado).

3. **Doble clic en `Abrir LevodopaAssist.cmd`.** Levanta el backend y el frontend en dos ventanas minimizadas
   y abre `http://localhost:5173` en el navegador. Para cerrar la app, cerrar esas dos ventanas.

## Actualizar después de traer cambios

Después de un `git pull`, si cambió algún `package.json` o hay migraciones nuevas en
`webapp\backend\prisma\migrations`, volver a ejecutar `instalar.cmd`. No borra los datos: solo aplica lo que falta.

## Por qué no dentro de OneDrive / Drive

`node_modules` tiene decenas de miles de archivos chiquitos, la base `dev.db` se escribe mientras la app está
abierta y la carpeta `.git` no tolera que otro programa la toque a la vez. Los servicios de sincronización
generan copias en conflicto y pueden corromper cualquiera de las tres.

@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
rem Ruta larga: vite/libuv falla si el cwd es una ruta corta 8.3 (FERFER~1), asi que se
rem resuelve la carpeta de este archivo con realpath antes de entrar.
for /f "delims=" %%I in ('node -e "process.stdout.write(require('fs').realpathSync.native(process.argv[1]))" "%~dp0."') do set "ROOT=%%I"
cd /d "%ROOT%\webapp\backend"

rem Sin el cliente de Prisma el backend se cae al arrancar ("Cannot find module '.prisma/client/default'")
rem y el frontend da 502. Pasa si la instalacion no llego al paso de la base de datos.
if not exist "node_modules\.prisma\client\default.js" (
  echo Falta el cliente de Prisma: generandolo y preparando la base de datos...
  call npx prisma generate || goto :fallo_prisma
  call npx prisma migrate deploy || goto :fallo_prisma
)

call npm run dev
exit /b

:fallo_prisma
echo.
echo *** No se pudo preparar la base de datos. Mandale a Fer una captura de esta ventana. ***
exit /b 1

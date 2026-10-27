@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
rem Ruta larga: vite/libuv falla si el cwd es una ruta corta 8.3 (FERFER~1), asi que se
rem resuelve la carpeta de este archivo con realpath antes de entrar.
for /f "delims=" %%I in ('node -e "process.stdout.write(require('fs').realpathSync.native(process.argv[1]))" "%~dp0."') do set "ROOT=%%I"
cd /d "%ROOT%\webapp\frontend"
call npm run dev

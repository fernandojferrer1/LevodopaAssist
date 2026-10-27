@echo off
setlocal
title LevodopaAssist - Instalacion
echo ============================================
echo   LevodopaAssist - Instalacion de la web app
echo ============================================
echo.

rem Carpeta del proyecto = donde esta este archivo (con la ruta larga: vite falla con rutas 8.3)
set "ROOT=%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"

rem --- 1. Node.js ---------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo [1/5] Node.js no esta instalado. Instalandolo con winget...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  set "PATH=C:\Program Files\nodejs;%PATH%"
  where node >nul 2>nul
  if errorlevel 1 (
    echo.
    echo No se pudo instalar Node.js automaticamente.
    echo Instalalo a mano desde https://nodejs.org ^(version LTS^) y volve a ejecutar este archivo.
    pause
    exit /b 1
  )
) else (
  echo [1/5] Node.js ya esta instalado.
)
for /f "delims=" %%I in ('node -e "process.stdout.write(require('fs').realpathSync.native(process.argv[1]))" "%ROOT%."') do set "ROOT=%%I"
node -v

rem --- 2. Git (para sincronizar el proyecto; no es necesario para usar la app) ---
where git >nul 2>nul
if errorlevel 1 (
  echo.
  echo [2/5] Git no esta instalado. Instalandolo con winget...
  winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements
) else (
  echo [2/5] Git ya esta instalado.
)

rem --- 3. Backend ---------------------------------------------------------
echo.
echo [3/5] Instalando dependencias del backend...
cd /d "%ROOT%\webapp\backend" || goto :error
if not exist ".env" (
  echo DATABASE_URL="file:./dev.db"> .env
  echo PORT=4000>> .env
  echo       Creado webapp\backend\.env
)
call :instalar_dependencias || goto :error

rem --- 4. Base de datos -----------------------------------------------------
echo.
echo [4/5] Preparando la base de datos...
rem Crea dev.db si no existe y le aplica las migraciones pendientes (no borra datos).
call npx prisma migrate deploy || goto :error
call npx prisma generate || goto :error

rem --- 5. Frontend --------------------------------------------------------
echo.
echo [5/5] Instalando dependencias del frontend...
cd /d "%ROOT%\webapp\frontend" || goto :error
call :instalar_dependencias || goto :error

echo.
echo ============================================
echo   Listo. Para abrir la app hace doble clic en
echo   "Abrir LevodopaAssist.cmd"
echo   Usala en Chrome o Edge (Web Serial no anda en Firefox).
echo ============================================
pause
exit /b 0

:instalar_dependencias
rem npm ci instala exactamente las versiones de package-lock.json; si ese archivo no vino
rem con la copia del proyecto, npm install resuelve las versiones a partir de package.json.
if exist "package-lock.json" (
  call npm ci
) else (
  echo       No hay package-lock.json: se usa npm install.
  call npm install
)
exit /b

:error
echo.
echo *** La instalacion fallo en el paso de arriba. Copia el mensaje de error y pasaselo a Fer. ***
pause
exit /b 1

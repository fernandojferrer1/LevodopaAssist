@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
set "ROOT=%~dp0"

if not exist "%ROOT%webapp\backend\node_modules" (
  echo La app no esta instalada todavia. Ejecuta primero "instalar.cmd".
  pause
  exit /b 1
)

rem cmd /k: si el backend o el frontend se caen, la ventana queda abierta con el error a la vista
start "LevodopaAssist - Backend" /min cmd /k ""%ROOT%dev-backend.cmd""
start "LevodopaAssist - Frontend" /min cmd /k ""%ROOT%dev-frontend.cmd""

echo Esperando a que la aplicacion arranque...
rem Espera hasta 60 s a que el backend responda, en vez de un tiempo fijo
node -e "let n=0;const t=()=>fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1),()=>++n<60?setTimeout(t,1000):process.exit(1));t()"
if errorlevel 1 (
  echo.
  echo *** El backend no respondio. Abri la ventana "LevodopaAssist - Backend" de la barra de tareas
  echo *** para ver el error, o ejecuta "diagnostico.cmd".
  pause
  exit /b 1
)

start "" "http://localhost:5173"

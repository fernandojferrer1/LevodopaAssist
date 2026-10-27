@echo off
setlocal
title LevodopaAssist - Diagnostico
set "PATH=C:\Program Files\nodejs;%PATH%"
for /f "delims=" %%I in ('node -e "process.stdout.write(require('fs').realpathSync.native(process.argv[1]))" "%~dp0."') do set "ROOT=%%I"

echo === Node ===
node -v || echo FALTA Node.js: ejecutar instalar.cmd
echo.
echo === Archivos ===
if exist "%ROOT%\webapp\backend\.env" (echo OK  backend\.env) else (echo FALTA backend\.env: ejecutar instalar.cmd)
if exist "%ROOT%\webapp\backend\node_modules" (echo OK  backend\node_modules) else (echo FALTA backend\node_modules: ejecutar instalar.cmd)
if exist "%ROOT%\webapp\backend\node_modules\.prisma\client\default.js" (echo OK  cliente de Prisma generado) else (echo FALTA cliente de Prisma: se genera solo al arrancar el backend, abajo)
if exist "%ROOT%\webapp\backend\prisma\dev.db" (echo OK  base de datos dev.db) else (echo FALTA dev.db: ejecutar instalar.cmd)
if exist "%ROOT%\webapp\frontend\node_modules" (echo OK  frontend\node_modules) else (echo FALTA frontend\node_modules: ejecutar instalar.cmd)
echo.
echo === Quien usa el puerto 4000 (backend) ===
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":4000 .*LISTENING"') do (
  tasklist /fi "PID eq %%P" /fo list | findstr /i "Nombre Image PID"
  echo Si es node.exe, la app ya esta abierta. Si es otro programa, cerralo.
  goto :puerto_listo
)
echo Nadie: el puerto esta libre.
:puerto_listo
echo.
echo === Arrancando el backend aca mismo para ver el error ===
echo (Cerrar las otras ventanas de LevodopaAssist antes. Ctrl+C para cortar.)
echo.
call "%ROOT%\dev-backend.cmd"
pause

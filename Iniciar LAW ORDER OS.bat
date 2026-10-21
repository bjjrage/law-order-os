@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instala Node.js para iniciar el OS.
  pause
  exit /b 1
)
node scripts\local-os-preflight.mjs
if /i "%~1"=="--check" exit /b %errorlevel%
if errorlevel 2 (
  pause
  exit /b 1
)
if errorlevel 1 goto iniciar
start "" "http://127.0.0.1:4313/"
exit /b 0
:iniciar
if not exist "dist\os-app\apps\api\src\workspace.js" (
  echo Preparando editor y guardado local...
  call npm.cmd run os:build:api
  if errorlevel 1 (
    echo No se pudo compilar el guardado local. Los datos existentes se conservaron.
    pause
    exit /b 1
  )
)
if not exist "dist\web\index.html" (
  echo Falta compilar la interfaz. Ejecuta: npm.cmd run os:build:web
  pause
  exit /b 1
)
if not exist "dist\orchestration\index.js" (
  echo Falta compilar la Junta. Ejecuta: npm.cmd run build
  pause
  exit /b 1
)
set "LOCAL_BROWSER_PORT=4313"
echo Iniciando LAW ORDER OS en http://127.0.0.1:4313/
echo Deja esta ventana abierta. Ctrl+C detiene solo este servidor.
echo No se cierran otros procesos ni se ejecutan consultas de IA.
start "" /b node scripts\local-os-open.mjs
node scripts\local-browser.mjs
if not errorlevel 1 exit /b 0
echo El servidor del OS se detuvo.
pause
exit /b 1

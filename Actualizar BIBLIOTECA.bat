@echo off
setlocal
cd /d "%~dp0"
echo Actualizando textos oficiales de la Biblioteca.
echo No utiliza proveedores de IA ni ejecuta despliegues.
echo La descarga se hace por lotes y continua donde quedo la anterior.
call npm.cmd run library:corpus:sync
if errorlevel 1 (
  echo No se completo la actualizacion. Los textos ya guardados se conservan.
) else (
  echo Actualizacion terminada. Recarga la Biblioteca en el OS.
)
pause
endlocal

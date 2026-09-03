@echo off
REM ============================================================
REM  SGO - PlussChile · entorno local
REM
REM  Levanta los dos servicios en ventanas separadas. Son dos y
REM  no uno porque cada uno recarga por su cuenta: Django cuando
REM  cambia el Python, Vite cuando cambia el frontend.
REM
REM  El local es donde se trabaja: aqui lo que se carga se
REM  guarda. En Vercel no (ver README, seccion 5).
REM ============================================================

echo.
echo   Levantando SGO en local...
echo.

start "SGO · backend  (Django :8000)"  cmd /k "cd /d %~dp0backend && python manage.py runserver"
start "SGO · frontend (Vite :5173)"    cmd /k "cd /d %~dp0frontend && npm run dev"

echo   Backend  ... http://localhost:8000
echo   Frontend ... http://localhost:5173
echo.
echo   Se abrieron dos ventanas. Cierralas para detener los servicios.
echo.
timeout /t 6 >nul

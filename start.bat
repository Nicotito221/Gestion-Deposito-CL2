@echo off
title Sistema Deposito - Launcher
echo =========================================================
echo  Iniciando Backend (FastAPI :8000) y Frontend (Vite)
echo =========================================================
start "FastAPI Backend - :8000" cmd /k "cd /d "%~dp0backend" && python -m uvicorn app.main:app --reload --port 8000"
start "Vite React Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
echo.
echo Los servicios se abrieron en ventanas separadas.
echo Puedes cerrar este iniciador cuando gustes.

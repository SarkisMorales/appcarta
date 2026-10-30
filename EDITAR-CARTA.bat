@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Editor de la carta
if not exist node_modules call npm install --no-audit --no-fund
set ABRIR=/editar
node herramientas\servidor.mjs
if errorlevel 1 pause

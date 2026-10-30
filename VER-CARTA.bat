@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Carta digital
if not exist node_modules call npm install --no-audit --no-fund
node herramientas\servidor.mjs
if errorlevel 1 pause

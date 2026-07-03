@echo off
title Meu Checklist - Servidor local
echo.
echo  Iniciando servidor em http://localhost:3000
echo  Abra esse endereco no navegador para testar o app.
echo.
echo  Para parar: feche esta janela ou pressione Ctrl+C
echo.
cd /d "%~dp0"
npx --yes serve . -p 3000
pause

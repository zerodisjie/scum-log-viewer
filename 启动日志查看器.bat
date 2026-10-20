@echo off
setlocal
title SCUM Log Viewer
cd /d "%~dp0"

rem ---------- locate python ----------
set "PY="
where python >nul 2>nul && set "PY=python"

if not defined PY (
  where py >nul 2>nul && set "PY=py -3"
)
if not defined PY (
  if exist "%LOCALAPPDATA%\Programs\Python\Python314\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python314\python.exe"
)
if not defined PY (
  if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
)
if not defined PY (
  if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
)
if not defined PY (
  if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
)

if not defined PY (
  echo.
  echo   [X] Python not found.
  echo.
  echo   Install Python 3.9+ from https://www.python.org/downloads/
  echo   Remember to check "Add python.exe to PATH" during setup.
  echo.
  pause
  exit /b 1
)

rem ---------- optional drag & drop target ----------
set "TARGET="
if not "%~1"=="" set "TARGET=--path "%~1""

echo.
echo   Starting SCUM Log Viewer ...
echo   Browser will open automatically. Close this window to stop.
echo.
%PY% app.py %TARGET%
pause

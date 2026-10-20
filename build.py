# -*- coding: utf-8 -*-
"""
打包发行版：python build.py
产出 dist/SCUMLogViewer-<版本>.zip（绿色免安装，解压即用）
版本号取自 app.py 里的 VERSION。
"""

import os
import re
import shutil
import sys
import zipfile

BASE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(BASE, "dist")

# 打进包里的文件（相对 BASE）
FILES = [
    "app.py",
    "web/index.html",
    "web/app.js",
    "web/style.css",
    "assets/start.bat",
    "assets/start-server.bat",
    "assets/start.sh",
    "assets/README.md",
]

START_BAT = r"""@echo off
setlocal
title SCUM Log Viewer
cd /d "%~dp0"

rem ---- locate python 3 ----
set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY where py >nul 2>nul && set "PY=py -3"
if not defined PY (
  for %%V in (314 313 312 311 310 39) do (
    if not defined PY if exist "%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe"
  )
)
if not defined PY (
  echo.
  echo   [X] Python not found.
  echo   Install Python 3.9+ from https://www.python.org/downloads/
  echo   Check "Add python.exe to PATH" during setup, then run this again.
  echo.
  pause
  exit /b 1
)

rem ---- optional: drag a log folder onto this file ----
set "TARGET="
if not "%~1"=="" set "TARGET=--path "%~1""

echo.
echo   SCUM Log Viewer {VER}  -  local mode
echo   Opening http://127.0.0.1:{PORT}/ in your browser.
echo   Close this window to stop the server.
echo.
%PY% app.py --port {PORT} %TARGET%
pause
"""

START_SERVER_BAT = r"""@echo off
setlocal
title SCUM Log Viewer - Server
cd /d "%~dp0"

rem ---- locate python 3 ----
set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY where py >nul 2>nul && set "PY=py -3"
if not defined PY (
  for %%V in (314 313 312 311 310 39) do (
    if not defined PY if exist "%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe"
  )
)
if not defined PY (
  echo.
  echo   [X] Python not found.
  echo   Install Python 3.9+ from https://www.python.org/downloads/
  echo   Check "Add python.exe to PATH" during setup, then run this again.
  echo.
  pause
  exit /b 1
)

rem ---- optional: drag a log folder onto this file ----
set "TARGET="
if not "%~1"=="" set "TARGET=--path "%~1""

echo.
echo   SCUM Log Viewer {VER}  -  server mode (LAN / remote access)
echo.
echo   Listening on 0.0.0.0:{PORT}  -  open the URL printed below.
echo   If other machines cannot connect, allow the port once (admin cmd):
echo       netsh advfirewall firewall add rule name="SCUM Log Viewer" dir=in action=allow protocol=TCP localport={PORT}
echo.
echo   Close this window to stop the server.
echo.
%PY% app.py --host 0.0.0.0 --port {PORT} --no-browser %TARGET%
pause
"""

START_SH = """#!/bin/sh
# SCUM Log Viewer {VER} - Linux / macOS
cd "$(dirname "$0")" || exit 1

PORT="${PORT:-{PORT}}"
HOST="${HOST:-0.0.0.0}"

for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1; then
    echo "SCUM Log Viewer {VER} - listening on $HOST:$PORT (open http://127.0.0.1:$PORT/)"
    exec "$c" app.py --host "$HOST" --port "$PORT" --no-browser "$@"
  fi
done

echo "Python 3.9+ not found. Install it first, e.g. apt install python3"
exit 1
"""


def read_version():
    with open(os.path.join(BASE, "app.py"), "r", encoding="utf-8") as f:
        m = re.search(r'^VERSION\s*=\s*"([^"]+)"', f.read(), re.M)
    if not m:
        sys.exit("app.py 里找不到 VERSION")
    return m.group(1)


def build():
    ver = read_version()
    name = f"SCUMLogViewer-{ver}"
    stage = os.path.join(DIST, name)
    # 不删目录再重建：目录可能正被运行中的实例占用，且换文件不打紧。
    # 打包只按下面的 packed 清单走，残留文件不会进 zip。
    os.makedirs(stage, exist_ok=True)
    packed = []

    for rel in FILES:
        if rel.startswith("assets/"):
            continue  # 模板单独生成
        src = os.path.join(BASE, rel.replace("/", os.sep))
        if not os.path.exists(src):
            sys.exit(f"缺少文件：{rel}")
        dst = os.path.join(stage, rel.replace("/", os.sep))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
        packed.append(rel)

    # 启动脚本
    for fname, tpl, eol in (
        ("start.bat", START_BAT, "\r\n"),
        ("start-server.bat", START_SERVER_BAT, "\r\n"),
        ("start.sh", START_SH, "\n"),
    ):
        text = tpl.replace("{VER}", ver)
        text = text.replace("{PORT}", "8787")
        text = text.replace("\r\n", "\n").replace("\n", eol)
        with open(os.path.join(stage, fname), "w", encoding="utf-8", newline="") as f:
            f.write(text)
        packed.append(fname)
    try:
        os.chmod(os.path.join(stage, "start.sh"), 0o755)
    except OSError:
        pass

    # 干净的配置 + 版本文件
    with open(os.path.join(stage, "config.json"), "w", encoding="utf-8") as f:
        f.write("{}\n")
    packed.append("config.json")
    with open(os.path.join(stage, "VERSION"), "w", encoding="utf-8") as f:
        f.write(ver + "\n")
    packed.append("VERSION")

    # README
    with open(os.path.join(BASE, "README.md"), "r", encoding="utf-8") as f:
        readme = f.read()
    readme = re.sub(r"\{VERSION\}", ver, readme)
    with open(os.path.join(stage, "README.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write(readme)
    packed.append("README.md")

    # 压缩：只打清单内的文件，stage 里若有残留也不会混进去
    zpath = os.path.join(DIST, name + ".zip")
    if os.path.exists(zpath):
        os.remove(zpath)
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for rel in packed:
            fp = os.path.join(stage, rel.replace("/", os.sep))
            z.write(fp, f"{name}/{rel}")

    size = os.path.getsize(zpath) / 1024
    print(f"版本 {ver}")
    print(f"打包完成：{zpath}  ({size:.0f} KB)")
    print(f"目录：{stage}")
    return zpath


if __name__ == "__main__":
    build()

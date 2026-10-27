@echo off
chcp 65001 >nul
setlocal
title 迷你游戏 · 开发环境
cd /d "%~dp0"

rem 检查 Node.js 与 npm
where node >nul 2>nul
if errorlevel 1 goto no_node
where npm >nul 2>nul
if errorlevel 1 goto no_node

rem 首次运行时自动安装依赖
if not exist "node_modules" (
  echo [信息] 未找到依赖，正在执行 npm install ...
  call npm install
  if errorlevel 1 (
    echo [错误] 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)

rem 已在运行则直接打开浏览器；否则检查端口是否被其他程序占用
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:6173/' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { Start-Process 'http://127.0.0.1:6173/'; exit 2 } } catch {}; $busy = @(6173,6174 | Where-Object { Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue }); if ($busy.Count -gt 0) { Write-Host ('[警告] 端口已被占用: ' + ($busy -join ', ')); exit 1 }"
if errorlevel 2 (
  echo [信息] 开发服务器已在运行，已为你打开浏览器。
  exit /b 0
)
if errorlevel 1 (
  echo        请先关闭占用端口的进程，然后重新运行本脚本。
  pause
  exit /b 1
)

echo [信息] 正在启动开发服务器 http://localhost:6173 ...
echo [信息] 按 Ctrl+C 可停止。
call npm run dev -- --open
if errorlevel 1 (
  echo.
  echo [错误] 开发服务器启动失败，请查看上方日志。
  pause
  exit /b 1
)
exit /b 0

:no_node
echo [错误] 未检测到 Node.js 或 npm。
echo        请先安装 Node.js 18 或更高版本：https://nodejs.org/
pause
exit /b 1

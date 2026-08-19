@echo off
REM ============================================================
REM  claudecode-consult:// protocol launcher - opens Claude Code CLI in this repo.
REM
REM  KEEP CRLF LINE ENDINGS - never save this file with LF-only endings.
REM    When cmd.exe processes goto and labels it re-seeks the file by BYTE OFFSET,
REM    and that arithmetic assumes a 2-byte CRLF terminator. With 1-byte LF endings
REM    the offset drifts further with every line, so the file ends up executed in
REM    fragments from the wrong position: REM lines start running as commands and
REM    the start line is torn apart. THIS is what made start run without -d and
REM    open the wrong folder - it was not an encoding problem. The repo root
REM    .gitattributes pins the endings with: *.cmd text eol=crlf
REM
REM  ASCII ONLY - do not put Korean (or any non-ASCII) in this file.
REM    Separate rule, and NOT the cause of the wrong-folder bug. cmd.exe reads .cmd
REM    files using the CONSOLE code page, which is cp949 on Korean Windows, while
REM    this file is stored as UTF-8. Non-ASCII bytes would be mangled by that
REM    mismatch, so keep comments here in English. Explanations live in README.md.
REM
REM  The URL argument (%1) is deliberately NOT used. If the URL could choose the
REM  folder or the command, any web page could open an arbitrary folder or inject
REM  a command through a claudecode-consult:// link. What to open is decided solely by
REM  where this file sits.
REM ============================================================
setlocal

REM This file lives in <repo>\tools\claude-launcher\ - two levels up is the repo root.
for %%I in ("%~dp0..\..") do set "PROJECT_DIR=%%~fI"

if not exist "%PROJECT_DIR%\package.json" goto :no_repo

REM -d sets the terminal tab's starting folder; cd /d pins the shell inside it.
REM Both are given because terminal settings or window reuse can ignore -d, and
REM claude treats its working folder as the project.
REM
REM chcp 65001 runs INSIDE the spawned shell, never in this file.
REM   Korean Windows opens cmd at cp949, so Claude Code's UTF-8 Korean output
REM   renders as garbage without it. Keep chcp out of THIS file anyway: switching
REM   the code page mid-file changes how cmd.exe reads the rest of THIS file.
REM   Inside the child command string it is harmless.
where wt.exe >nul 2>&1
if errorlevel 1 goto :plain_console

start "" wt.exe -d "%PROJECT_DIR%" cmd /k "chcp 65001 >nul && cd /d "%PROJECT_DIR%" && claude"
goto :end

:plain_console
start "Claude Code" cmd /k "chcp 65001 >nul && cd /d "%PROJECT_DIR%" && claude"
goto :end

:no_repo
echo [ERROR] Repository not found at: "%PROJECT_DIR%"
echo         Keep this file in the repo under tools\claude-launcher\ and register again.
echo.
pause

:end
endlocal

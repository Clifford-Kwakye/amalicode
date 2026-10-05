@echo off
rem AmaliCode launcher for Windows: runs the pinned, unmodified OpenCode release
rem with the AmaliAI plugin loaded. Installed by install.ps1; settings live
rem beside it. Mirrors launcher/amalicode; keep the two in step.
rem
rem A .cmd rather than a .ps1 so it runs under the default execution policy and
rem from cmd, PowerShell and Windows Terminal alike. Paths are only expanded
rem outside parenthesised blocks, where a ")" in a user name would end the block.
setlocal

set "AC_HOME=%USERPROFILE%\.amalicode"
if defined AMALICODE_HOME set "AC_HOME=%AMALICODE_HOME%"
if not exist "%AC_HOME%\settings.cmd" goto :not_installed
rem Provides AMALICODE_VERSION, OPENCODE_VERSION, BASE_URL, CHANNEL,
rem INSTALLER_URL and PLUGIN_PATH.
call "%AC_HOME%\settings.cmd"

set "AC_BIN=%AC_HOME%\opencode\%OPENCODE_VERSION%\opencode.exe"
if not exist "%AC_BIN%" goto :missing_opencode

rem OpenCode's own upgrade would replace the binary behind the pinned version;
rem upgrades go through the installer, which only moves to evaluated releases.
if /i "%~1"=="upgrade" goto :upgrade

rem OpenCode's --version only knows its own number; report both.
if "%~2"=="" if "%~1"=="--version" goto :version
if "%~2"=="" if "%~1"=="-v" goto :version

rem Passed by environment rather than written to OpenCode's config files, so a
rem user's own opencode.json and tui.json keep working. The plugin itself
rem enforces the provider lock from inside the config hook.
set "OPENCODE_CONFIG_CONTENT={"plugin":[["%PLUGIN_PATH%",{"baseURL":"%BASE_URL%"}]]}"
set "OPENCODE_TUI_CONFIG=%AC_HOME%\tui.json"
rem models.dev describes providers AmaliCode never offers.
set "OPENCODE_DISABLE_MODELS_FETCH=true"

rem Only gate launches of the interactive TUI: no arguments, or a directory.
if "%~1"=="" goto :check_key
if exist "%~1\*" goto :check_key
goto :run

:check_key
call :has_key && goto :run
echo AmaliCode needs an AmaliAI key. Create one on the AmaliAI dashboard, then paste it below.
"%AC_BIN%" auth login --provider amaliai
call :has_key || exit /b 1

:run
"%AC_BIN%" %*
exit /b %errorlevel%

rem Offline presence check only. Verifying the key here hung startup against
rem the VPN-gated gateway, so an invalid key surfaces later as an empty model list.
:has_key
if defined AMALICODE_API_KEY exit /b 0
set "AC_AUTH=%USERPROFILE%\.local\share\opencode\auth.json"
if defined XDG_DATA_HOME set "AC_AUTH=%XDG_DATA_HOME%\opencode\auth.json"
if not exist "%AC_AUTH%" exit /b 1
findstr /c:"\"amaliai\"" "%AC_AUTH%" >nul
exit /b %errorlevel%

:version
set "AC_LABEL=%AMALICODE_VERSION%"
if not defined AC_LABEL set "AC_LABEL=(local)"
echo AmaliCode %AC_LABEL% (OpenCode %OPENCODE_VERSION%)
exit /b 0

:upgrade
if not defined INSTALLER_URL goto :no_installer
rem Keep the installed channel unless the user passes another --channel.
set "AC_CHANNEL=%CHANNEL%"
if /i "%~2"=="--channel" set "AC_CHANNEL=%~3"
rem TLS 1.2 is not the default for Windows PowerShell 5.1 on every machine.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072; & ([scriptblock]::Create((Invoke-RestMethod '%INSTALLER_URL%'))) -Channel '%AC_CHANNEL%'"
exit /b %errorlevel%

:not_installed
echo amalicode: not installed correctly ("%AC_HOME%\settings.cmd" is missing). Re-run the installer. 1>&2
exit /b 1

:missing_opencode
echo amalicode: OpenCode %OPENCODE_VERSION% is missing from "%AC_HOME%\opencode". Re-run the installer. 1>&2
exit /b 1

:no_installer
echo amalicode: this install has no installer URL to upgrade from. Re-run install.ps1 from a new AmaliCode bundle. 1>&2
exit /b 1

@echo off
rem Starts a Claude Code session with the Dragon Ball Z mods loaded from this folder (nothing is installed).
rem Usage: try-mods.cmd            (all four mods)
rem        try-mods.cmd kamehameha (just one: kamehameha, scouter, saiyan-status or shenron)
cd /d "%~dp0"
if "%~1"=="" (
  claude --plugin-dir "%~dp0mods\kamehameha" --plugin-dir "%~dp0mods\scouter" --plugin-dir "%~dp0mods\saiyan-status" --plugin-dir "%~dp0mods\shenron"
) else (
  claude --plugin-dir "%~dp0mods\%~1"
)

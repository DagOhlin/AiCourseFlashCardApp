@echo off
rem Starts Exam Flashcards (Windows). Double-click this file. Needs Python 3.
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 start.py %*
  goto :done
)
where python >nul 2>nul
if %errorlevel%==0 (
  python start.py %*
  goto :done
)
echo.
echo Python 3 was not found.
echo Install it from https://www.python.org/downloads/ and tick "Add python.exe to PATH",
echo then double-click start.bat again.
:done
echo.
pause

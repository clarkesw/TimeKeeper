@echo off
REM Start Time Tracker Server Script

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"

REM Change to the script directory
cd /d "%SCRIPT_DIR%"

echo Checking dependencies...

REM Check if server.py exists
if not exist "server.py" (
    echo Error: server.py not found in %SCRIPT_DIR%
    goto :eof
)

REM Check if Python is installed and accessible (using 'python' command is common on Windows)
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in your PATH.
    goto :eof
)

REM Check if Flask is installed (and install it if missing)
REM The Python command checks for the module and returns an error code if it fails
python -c "import flask"
if errorlevel 1 (
    echo Flask is not installed. Installing...
    pip install flask
    REM Check if installation was successful
    if errorlevel 1 (
        echo Error: Failed to install Flask.
        goto :eof
    )
)

REM Start the server
echo.
echo Starting Time Tracker Server...
echo Server will be available at: http://localhost:5000
echo Press Ctrl+C to stop the server
echo.

REM Execute the server script
REM start "" pythonw server.py
python server.py
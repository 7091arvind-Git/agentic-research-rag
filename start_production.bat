@echo off
echo =======================================================
echo Starting AI Research Paper Analyzer (Production Server)
echo =======================================================
echo.

REM Check if Python venv exists
if not exist venv (
    echo Creating Python virtual environment...
    python -m venv venv
    call .\venv\Scripts\pip install -r backend\requirements.txt
)

REM Build React frontend if dist doesn't exist
if not exist dist (
    echo Building frontend static assets...
    call npm run build
)

echo Starting FastAPI server at http://localhost:8000 ...
.\venv\Scripts\uvicorn backend.main:app --host 0.0.0.0 --port 8000
pause

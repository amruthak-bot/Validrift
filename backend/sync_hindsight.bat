@echo off
setlocal
if not exist .venv\Scripts\activate.bat (
  echo Virtual environment not found. Run run_backend.bat once first.
  exit /b 1
)
call .venv\Scripts\activate.bat
python scripts\sync_hindsight.py

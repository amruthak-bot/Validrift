@echo off
setlocal
if not exist .venv (
  py -3.11 -m venv .venv
)
call .venv\Scripts\activate.bat
python -m pip install -r requirements.txt
if not exist .env copy .env.example .env
python scripts\seed_demo.py
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

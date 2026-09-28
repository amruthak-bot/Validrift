#!/usr/bin/env bash
set -e
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
[ -f .env ] || cp .env.example .env
python scripts/seed_demo.py
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

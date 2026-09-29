#!/usr/bin/env python3
"""Bulk-load the synthetic year into the Hindsight bank.

The API key is scoped to the `validrift-demo` bank, so the long-term data
lives there too — but strictly separated by tag: every synthetic payload is
tagged `validrift-longterm` and NEVER `validrift`, so the live demo's
recall/reflect (tags=["validrift"]) can never see it, and the memory chat
(tags=["validrift-longterm"]) never sees demo data.

Idempotent: stable document IDs mean reruns upsert the same documents.
Concurrent retains (8 at a time) with retry; progress printed to stdout.
"""
import asyncio
import json
import sys

sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
from dynamic_credentials import dynamic_credential_entry  # noqa: E402

sys.path.insert(0, "/home/hatch/workspace/validrift-final/backend/.venv/lib/python3.12/site-packages")

BANK_ID = "validrift-demo"
CONCURRENCY = 8


async def retain_one(client, sem, payload, idx, total):
    async with sem:
        for attempt in range(4):
            try:
                await client.aretain(
                    bank_id=BANK_ID,
                    content=payload["content"],
                    timestamp=payload["timestamp"],
                    context=payload["context"],
                    document_id=payload["document_id"],
                    metadata={k: str(v) for k, v in payload.get("metadata", {}).items()},
                    tags=payload.get("tags", ["validrift-longterm"]),
                )
                if idx % 50 == 0:
                    print(f"  {idx}/{total} retained", flush=True)
                return True
            except Exception as exc:
                if attempt == 3:
                    print(f"  FAILED {payload['document_id']}: {exc!r}", flush=True)
                    return False
                await asyncio.sleep(2 * (attempt + 1))
    return False


async def main():
    from hindsight_client import Hindsight
    entry = dynamic_credential_entry("custom.hindsight", "access_token")
    sur = str(entry.get("surrogate", "")).strip()
    assert sur.startswith("hsurr:"), "no surrogate returned"
    client = Hindsight(base_url="https://api.hindsight.vectorize.io",
                       api_key=sur, timeout=60, user_agent="validrift/1.0")

    payloads = json.load(open("longterm_data.json"))
    total = len(payloads)
    print(f"retaining {total} payloads into bank {BANK_ID} (tag: validrift-longterm)")
    sem = asyncio.Semaphore(CONCURRENCY)
    results = await asyncio.gather(
        *(retain_one(client, sem, p, i, total) for i, p in enumerate(payloads, 1)))
    ok = sum(results)
    print(f"done: {ok}/{total} retained OK, {total - ok} failed")


if __name__ == "__main__":
    asyncio.run(main())

#!/usr/bin/env python3
"""Generate 1 year of synthetic VALIDRIFT incident/recommendation history.

The output mirrors the exact shape of real recorded data:
- incidents (defect, severity, machine, machine area, material, supplier,
  recipe, firmware, operator, shift, lot, notes, timestamp)
- interventions (fix applied, outcome, effectiveness notes)
- process changes (the context shifts that later cause validity drift)
- recommendation summaries (what the engine would have recommended)

Timeline: 2025-09-29 -> 2026-08-29. September 2026 is deliberately left
empty: that month is the canonical live demo story (Film-B / FlexPack /
R11). The synthetic year runs on Film-A / PackCo / R10, which is exactly
why long-term memory is powerful here: "Increase Temperature +5C" worked
~85% of the time for a year on Film-A, then drifted on Film-B.

Human behaviour is mocked throughout: shift-hour timestamps, named
operators, weekend slowdowns, monsoon humidity effects, QA language
(peel test, dye penetration, burst test), SOP references.

Deterministic: seeded RNG, stable IDs -> reruns are byte-identical.

Writes: longterm_data.json  (list of hindsight retain payloads)
         longterm_stats.json (summary counts for the report)
"""

import json
import random
from datetime import datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))
rng = random.Random(20260929)

START = datetime(2025, 9, 29, 0, 0, tzinfo=IST)
END = datetime(2026, 8, 29, 23, 59, tzinfo=IST)

# ---------------------------------------------------------------- context eras
# Each era is a production context. Process changes between eras are exactly
# the kind of events that make old fixes drift.
ERAS = [
    {
        "id": "era-1",
        "start": datetime(2025, 9, 29, tzinfo=IST),
        "material": "Film-A", "supplier": "PackCo", "recipe": "R10",
        "firmware": "FW-V2", "lot": "LC-8841",
    },
    {
        "id": "era-2",
        "start": datetime(2026, 2, 14, tzinfo=IST),
        "material": "Film-A", "supplier": "PackCo", "recipe": "R10",
        "firmware": "FW-V3", "lot": "LC-8841",
        "change": ("Firmware FW-V2 -> FW-V3 (jaw controller update)",
                   "Jaw controller firmware updated to FW-V3 for tighter "
                   "temperature regulation on Sealer-02 and Sealer-01."),
    },
    {
        "id": "era-3",
        "start": datetime(2026, 5, 3, tzinfo=IST),
        "material": "Film-A", "supplier": "PackCo", "recipe": "R10",
        "firmware": "FW-V3", "lot": "LC-9027",
        "change": ("Supplier lot LC-8841 -> LC-9027 (film gauge variance noted)",
                   "New PackCo film lot LC-9027 shows slightly higher gauge "
                   "variance at incoming QC. Monitoring wrinkle-related defects."),
    },
]

OPERATORS = ["Priya S.", "Rahul V.", "Divya M.", "Arun K.", "Sneha R.",
             "Kiran P.", "Lakshmi N.", "Vikram T."]

# defect -> (machine area, base daily weight)
DEFECTS = {
    "Weak Seal":        ("Sealing Unit", 0.22),
    "Wrinkling":        ("Film Feed",    0.14),
    "Channel Leak":     ("Sealing Unit", 0.12),
    "Surface Burn":     ("Sealing Unit", 0.10),
    "Misalignment":     ("Sealing Jaws", 0.10),
    "Surface Wrinkle":  ("Film Feed",    0.09),
    "Seal Blistering":  ("Sealing Unit", 0.08),
    "Surface Damage":   ("Sealing Jaws", 0.08),
    "Film Misalignment":("Film Feed",    0.07),
}

# defect -> [(fix, base success rate)]
FIXES = {
    "Weak Seal":         [("Increase Temperature +5°C", 0.85), ("Increase Pressure +8%", 0.75), ("Sealing Time +0.15s", 0.70)],
    "Channel Leak":      [("Nip Pressure +3%", 0.80), ("Increase Temperature +5°C", 0.55)],
    "Wrinkling":         [("Reduce Line Speed 8%", 0.80), ("Pre-dry Film 10 min", 0.75)],
    "Surface Burn":      [("Cooling Fan +10%", 0.85)],
    "Misalignment":      [("Jaw Alignment +1mm", 0.82), ("Guide Alignment Reset", 0.75)],
    "Surface Wrinkle":   [("Cooling Time +5 sec", 0.78)],
    "Seal Blistering":   [("Cooling Fan +10%", 0.70), ("Increase Temperature +5°C", 0.45)],
    "Surface Damage":    [("Jaw Clean & Inspect", 0.85), ("Sensor Calibration Check", 0.70)],
    "Film Misalignment": [("Tension +5%", 0.80)],
}

INCIDENT_NOTES = {
    "Weak Seal": [
        "Weak seals on the QA pull - peel test failing on {n} of 10 pouches.",
        "Peel test failures at {station}. Seal looks closed but opens with light pull.",
        "Customer complaint ref {ref}: pouches opening in transit. Checking line now.",
        "Burst test below spec on this lot. Suspect seal temperature drift.",
    ],
    "Channel Leak": [
        "Dye penetration test showing channel leaks on {n} of 20 samples.",
        "Leakers found at vacuum decay test, {station}.",
        "Channel leak along the seal edge, visible under backlight.",
    ],
    "Wrinkling": [
        "Wrinkles across the seal area, {n} rejects in the last hour.",
        "Film wrinkling at the forming tube, worse after reel change.",
        "Wrinkle defects spiking - incoming film feels damp.",
    ],
    "Surface Burn": [
        "Burn marks on seal surface, {station}. Smell of overheated film.",
        "Surface scorching visible on {n} consecutive packs.",
    ],
    "Misalignment": [
        "Seal jaws misaligned by ~1mm, seals offset on {station}.",
        "Print registration drifting, seal landing off-center.",
    ],
    "Surface Wrinkle": [
        "Fine wrinkles on seal surface after cooling.",
        "Surface wrinkle on {n} packs this hour, cosmetic but QA flagged.",
    ],
    "Seal Blistering": [
        "Blistering on the seal band, air pockets under the film.",
        "Seal blisters on {n} of 30 samples - looks like trapped moisture.",
    ],
    "Surface Damage": [
        "Jaw surface scoring found during cleaning check.",
        "Scuffed seals, suspect debris on jaw face.",
    ],
    "Film Misalignment": [
        "Film tracking left by ~3mm at the forming collar.",
        "Edge wander on the unwind, seals uneven left-right.",
    ],
}

OUTCOME_NOTES = {
    "SUCCESS": [
        "Held through full shift, QA passed {n}/{n}.",
        "Peel/burst tests back in spec. Line released to production.",
        "No recurrence in the next {h} hours of running.",
        "QA sign-off received. Closing the incident.",
    ],
    "FAILURE": [
        "Failed again within {h} hours, escalated to maintenance.",
        "No improvement on retest. Trying alternate fix.",
        "Defect persisted on next QA pull. Keeping line on hold.",
    ],
    "PARTIAL": [
        "Improved but not fully in spec - defect rate halved.",
        "Better on retest, still {n} rejects per hour. Monitoring.",
    ],
}

RECOMMENDATION_INTROS = [
    "Shift review: for {defect} on {material}/{recipe}, {fix} remains the strongest option",
    "Weekly quality huddle note: {fix} for {defect}",
    "Engineering summary: {defect} response on {machine}",
]


def era_for(day: datetime):
    era = ERAS[0]
    for e in ERAS:
        if day >= e["start"]:
            era = e
    return era


def shift_for(hour: int):
    if 6 <= hour < 14:
        return "A"
    if 14 <= hour < 22:
        return "B"
    return "C"


def incident_time(day: datetime) -> datetime:
    # Human pattern: incidents cluster just after shift start (checks) and
    # mid-shift; almost none in the 2am-5am dead zone.
    r = rng.random()
    if r < 0.35:
        hour = rng.choice([7, 8, 15, 16, 23, 0])
    elif r < 0.75:
        hour = rng.choice([9, 10, 11, 17, 18, 19, 1, 2])
    else:
        hour = rng.randint(6, 21)
    minute = rng.randint(0, 59)
    return day.replace(hour=hour, minute=minute)


def pick_defect(day: datetime) -> str:
    month = day.month
    weights = dict(DEFECTS)
    # Monsoon humidity (Jun-Aug): more wrinkle-family defects.
    if month in (6, 7, 8):
        weights["Wrinkling"] = (weights["Wrinkling"][0], weights["Wrinkling"][1] * 1.8)
        weights["Surface Wrinkle"] = (weights["Surface Wrinkle"][0], weights["Surface Wrinkle"][1] * 1.6)
        weights["Seal Blistering"] = (weights["Seal Blistering"][0], weights["Seal Blistering"][1] * 1.4)
    # Hot months (Mar-May): more burn.
    if month in (3, 4, 5):
        weights["Surface Burn"] = (weights["Surface Burn"][0], weights["Surface Burn"][1] * 1.6)
    # Era 3 gauge variance: more wrinkling.
    if day >= ERAS[2]["start"]:
        weights["Wrinkling"] = (weights["Wrinkling"][0], weights["Wrinkling"][1] * 1.3)
    names = list(weights)
    probs = [weights[n][1] for n in names]
    return rng.choices(names, weights=probs, k=1)[0]


def pick_fix(defect: str, day: datetime):
    options = FIXES[defect]
    fix, rate = rng.choices(options, weights=[3, 2, 1][:len(options)], k=1)[0]
    # Era effects on effectiveness.
    if day >= ERAS[1]["start"] and defect == "Misalignment":
        rate = min(0.95, rate + 0.05)  # FW-V3 jaw control helps
    if day >= ERAS[2]["start"] and fix == "Pre-dry Film 10 min":
        rate = min(0.95, rate + 0.08)  # damp-feeling lot responds to pre-dry
    if day.month in (6, 7, 8) and fix == "Pre-dry Film 10 min":
        rate = min(0.95, rate + 0.05)
    r = rng.random()
    if r < rate:
        outcome = "SUCCESS"
    elif r < rate + 0.10:
        outcome = "PARTIAL"
    else:
        outcome = "FAILURE"
    return fix, outcome


def main():
    payloads = []
    stats = {"incidents": 0, "by_defect": {}, "by_outcome": {}, "by_era": {},
             "recommendations": 0, "process_changes": 0}

    # --- process changes (world facts) -------------------------------------
    for e in ERAS[1:]:
        title, reason = e["change"]
        payloads.append({
            "content": f"Production process change: {title}. Reason: {reason}",
            "context": "Manufacturing process change",
            "document_id": f"synthetic-process-change:{e['id']}",
            "timestamp": e["start"].isoformat(),
            "metadata": {"synthetic": "true", "era": e["id"], "machine": "Sealer-02",
                         "material": e["material"], "supplier": e["supplier"],
                         "recipe": e["recipe"], "firmware": e["firmware"]},
            "tags": ["validrift-longterm", "process-change", "synthetic"],
        })
        stats["process_changes"] += 1

    # --- incidents + interventions -----------------------------------------
    day = START
    seq = 1
    fix_history = {}  # (defect, fix) -> [outcomes] for recommendation summaries
    while day <= END:
        # ~1.3 incidents/day, 0.4x on Sundays (weekly off).
        lam = 1.3 * (0.4 if day.weekday() == 6 else 1.0)
        n = rng.choices([0, 1, 2, 3], weights=[0.30, 0.42, 0.21, 0.07])[0]
        n = max(n, 1) if rng.random() < lam / 1.3 and n == 0 and day.weekday() != 6 else n
        for _ in range(n):
            era = era_for(day)
            ts = incident_time(day)
            defect = pick_defect(day)
            area, _ = DEFECTS[defect]
            machine = "Sealer-01" if rng.random() < 0.15 else "Sealer-02"
            operator = rng.choice(OPERATORS)
            fix, outcome = pick_fix(defect, day)
            severity = rng.choices(["LOW", "MEDIUM", "HIGH"], weights=[0.25, 0.55, 0.20])[0]
            iid = f"QI-SYN-{seq:04d}"
            seq += 1

            note = rng.choice(INCIDENT_NOTES[defect]).format(
                n=rng.randint(2, 8), station=rng.choice(["Station A", "Station B"]),
                ref=f"CC-{rng.randint(1000, 9999)}")
            onote = rng.choice(OUTCOME_NOTES[outcome]).format(
                n=rng.randint(30, 60), h=rng.randint(2, 6))

            content = (
                f"Incident {iid}: {defect} on {machine} ({area}). "
                f"Material {era['material']} lot {era['lot']}, supplier {era['supplier']}, "
                f"recipe {era['recipe']}, firmware {era['firmware']}. Severity {severity}. "
                f"Reported by {operator} on shift {shift_for(ts.hour)}. Notes: {note} "
                f"Fix applied: {fix}. Outcome: {outcome}. {onote}"
            )
            payloads.append({
                "content": content,
                "context": "Manufacturing quality incident",
                "document_id": f"synthetic-incident:{iid}",
                "timestamp": ts.isoformat(),
                "metadata": {"synthetic": "true", "incident_id": iid, "defect": defect,
                             "machine": machine, "area": area, "material": era["material"],
                             "supplier": era["supplier"], "recipe": era["recipe"],
                             "firmware": era["firmware"], "fix": fix, "outcome": outcome,
                             "operator": operator, "shift": shift_for(ts.hour),
                             "era": era["id"]},
                "tags": ["validrift-longterm", "incident", "synthetic",
                         f"defect:{defect.lower().replace(' ', '-')}",
                         f"fix:{fix.lower().replace(' ', '-').replace('+', 'p').replace('°', '')}"],
            })
            stats["incidents"] += 1
            stats["by_defect"][defect] = stats["by_defect"].get(defect, 0) + 1
            stats["by_outcome"][outcome] = stats["by_outcome"].get(outcome, 0) + 1
            stats["by_era"][era["id"]] = stats["by_era"].get(era["id"], 0) + 1
            fix_history.setdefault((defect, fix), []).append(outcome)
        day += timedelta(days=1)

    # --- recommendation summaries (biweekly engineering notes) --------------
    rec_seq = 1
    for (defect, fix), outcomes in sorted(fix_history.items()):
        if len(outcomes) < 6:
            continue
        s = outcomes.count("SUCCESS")
        f = outcomes.count("FAILURE")
        rid = f"REC-SYN-{rec_seq:03d}"
        rec_seq += 1
        intro = rng.choice(RECOMMENDATION_INTROS).format(
            defect=defect, material="Film-A", recipe="R10", fix=fix,
            machine="Sealer-02")
        status = "VALIDATED" if s >= 3 and f == 0 else "SUPPORTED" if s > f else "MIXED"
        content = (
            f"Recommendation {rid}: {intro} "
            f"({status}, {s} successes / {f} failures over the past year). "
            f"Recorded by engineering during the biweekly quality review."
        )
        payloads.append({
            "content": content,
            "context": "Manufacturing recommendation summary",
            "document_id": f"synthetic-recommendation:{rid}",
            "timestamp": datetime(2026, 8, 28, 10, 0, tzinfo=IST).isoformat(),
            "metadata": {"synthetic": "true", "recommendation_id": rid,
                         "defect": defect, "fix": fix, "status": status,
                         "successes": s, "failures": f},
            "tags": ["validrift-longterm", "recommendation", "synthetic",
                     f"defect:{defect.lower().replace(' ', '-')}"],
        })
        stats["recommendations"] += 1

    out = "longterm_data.json"
    with open(out, "w") as fh:
        json.dump(payloads, fh, indent=1)
    with open("longterm_stats.json", "w") as fh:
        json.dump(stats, fh, indent=1)
    print(f"wrote {out}: {len(payloads)} payloads")
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()

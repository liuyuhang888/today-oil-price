#!/usr/bin/env python3
"""Build a compact daily history index from the repository's archived snapshots."""
import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
FIELDS = ("t0", "t89", "t92", "t95", "t98")


def build_history(data_dir=DATA_DIR):
    # Lexical order of YYYY/MM/DD/HHMM.json is chronological in Beijing time.
    days = {}
    imported = data_dir / "imported-history.json"
    if imported.exists():
        data = json.loads(imported.read_text(encoding="utf-8"))
        for day in data["days"]:
            days[day["date"]] = day
    for path in sorted((data_dir / "history").glob("[0-9][0-9][0-9][0-9]/[0-9][0-9]/[0-9][0-9]/[0-9][0-9][0-9][0-9].json")):
        try:
            snapshot = json.loads(path.read_text(encoding="utf-8"))
            provinces = snapshot["provinces"]
            if not isinstance(provinces, dict) or not provinces:
                continue
            date = "-".join(path.parts[-4:-1])
            # Keep only fields needed by the chart and the last valid snapshot per day.
            prices = {name: {field: values.get(field) for field in FIELDS}
                      for name, values in provinces.items() if isinstance(values, dict)}
            if prices:
                days[date] = {"date": date, "source": "archive", "provinces": prices}
        except (OSError, ValueError, KeyError, TypeError):
            continue
    output = {"days": [days[date] for date in sorted(days)]}
    (data_dir / "history-index.json").write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return output


if __name__ == "__main__":
    index = build_history()
    print(f"[history] indexed {len(index['days'])} days")

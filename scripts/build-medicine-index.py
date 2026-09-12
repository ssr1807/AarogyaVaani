"""Build compact medicine autocomplete chunks from updated_indian_medicine_data.csv."""
import csv,json,re,sys
from collections import defaultdict
from pathlib import Path

src=Path(sys.argv[1])
out=Path("frontend/public/data/medicines")
out.mkdir(parents=True,exist_ok=True)

# Keep the public index limited to identification metadata. Never ship
# descriptions, side effects, interactions, prices, or treatment advice.
seen=set()
buckets=defaultdict(dict)

def clean(value):
    return " ".join(str(value or "").split()).strip()

def first_composition(row):
    for key in ("salt_composition", "short_composition1"):
        value=clean(row.get(key))
        if value:
            return value
    return ""

with src.open(encoding="utf-8-sig",newline="",errors="replace") as f:
    for row in csv.DictReader(f):
        if str(row.get("Is_discontinued","")).strip().lower() in {"true","1","yes"}:
            continue
        name=clean(row.get("name"))
        key=" ".join(name.lower().split())
        if not key or key in seen:
            continue
        seen.add(key)
        compact=re.sub(r"[^a-z0-9]","",key)
        prefix=compact[:1] if compact else "_"
        buckets[prefix][name]={
            "name": name,
            "composition": first_composition(row),
        }

for prefix, items in buckets.items():
    records=sorted(items.values(), key=lambda item: item["name"].lower())
    (out/f"{prefix}.json").write_text(
        json.dumps(records,ensure_ascii=False,separators=(",",":")),
        encoding="utf-8"
    )

print(f"Built {len(seen):,} active unique medicine names with composition metadata.")

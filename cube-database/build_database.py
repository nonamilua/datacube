"""Build the standalone v2 catalog with Python's standard library."""
from contextlib import closing
import argparse
import json
import re
import sqlite3
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
EVENTS = ["2x2", "3x3", "4x4", "5x5", "6x6", "7x7", "megaminx", "pyraminx", "skewb", "square 1", "fto"]
BRANDS = ["GAN", "MoYu", "DaYan", "QiYi", "Other"]


def load_catalog(catalog_dir=HERE / "3x3"):
    data = json.loads((catalog_dir / "catalog.json").read_text(encoding="utf-8"))
    research = json.loads((catalog_dir / "research.json").read_text(encoding="utf-8"))
    if data["schema_version"] != 2 or data["brands"] != BRANDS:
        raise ValueError("Invalid version or brands")
    event = data.get("event")
    directory_event = "square 1" if catalog_dir.name == "square-1" else catalog_dir.name
    if directory_event in EVENTS and event != directory_event:
        # Preserve the legacy 3x3 catalog and its existing unprefixed IDs.
        if not (catalog_dir.name == "3x3" and event is None):
            raise ValueError("Catalog event must match its directory")
    seen_ids, seen_names = set(), set()
    source_ids = {s["id"] for s in research["sources"]}
    if len(source_ids) != len(research["sources"]):
        raise ValueError("Duplicate research source IDs")
    for cube in data["cubes"]:
        if set(cube) != {"id", "brand", "name", "aliases"}:
            raise ValueError("Cube entries must contain id, brand, name, aliases")
        if not isinstance(cube["id"], str) or not re.fullmatch(r"[a-z0-9-]+", cube["id"]):
            raise ValueError("Invalid cube ID")
        if event and event != "3x3" and not cube["id"].startswith(event.replace(" ", "-") + "-"):
            raise ValueError("Cube ID must include its event")
        if cube["id"] in seen_ids or (cube["brand"], cube["name"]) in seen_names:
            raise ValueError("Duplicate cube ID or brand/name")
        seen_ids.add(cube["id"])
        seen_names.add((cube["brand"], cube["name"]))
        if cube["brand"] not in BRANDS or not cube["name"].strip():
            raise ValueError("Invalid cube brand/name")
        aliases = cube["aliases"]
        if not isinstance(aliases, list) or not aliases or any(
            not isinstance(a, str) or not a.strip() or a != a.strip()
            or a != a.lower() or len(a) > 12 or any(ord(ch) < 32 for ch in a)
            for a in aliases
        ) or len(aliases) != len(set(aliases)):
            raise ValueError("Invalid aliases")
        evidence = research["entries"].get(cube["id"], {})
        refs = evidence.get("source_ids", [])
        if not refs or not set(refs) <= source_ids:
            raise ValueError(f"Missing or invalid research: {cube['id']}")
    if set(research["entries"]) != seen_ids:
        raise ValueError("Research entry IDs must match catalog IDs")
    return data


def build(output, replace=False, catalog_dir=HERE / "3x3"):
    data = load_catalog(catalog_dir)
    if output.exists() and not replace:
        raise FileExistsError("Output exists; use --replace for the generated database")
    if output.suffix != ".sqlite3":
        raise ValueError("Use a .sqlite3 output filename")
    output.parent.mkdir(parents=True, exist_ok=True)
    # Build and verify first; replace the previous generated file only on success.
    with tempfile.TemporaryDirectory(dir=output.parent, prefix="catalog-build-") as temp:
        temporary = Path(temp) / "catalog.sqlite3"
        with closing(sqlite3.connect(temporary)) as db:
            db.executescript((catalog_dir / "schema.sql").read_text(encoding="utf-8"))
            db.executemany("INSERT INTO cubes VALUES (?, ?, ?, ?)", [
                (c["id"], c["brand"], c["name"],
                 json.dumps(c["aliases"], ensure_ascii=False))
                for c in data["cubes"]
            ])
            db.commit()
            if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise ValueError("SQLite integrity check failed")
            if db.execute("SELECT COUNT(*) FROM cubes").fetchone()[0] != len(data["cubes"]):
                raise ValueError("Row count mismatch")
        temporary.replace(output)
    print(f"Built {output}: {len(data['cubes'])} entries; checks passed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--event", choices=EVENTS, default="3x3")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--replace", action="store_true",
                        help="Replace the generated database after validation")
    args = parser.parse_args()
    catalog_dir = HERE / args.event.replace(" ", "-")
    output = args.output or catalog_dir / "cube_catalog.sqlite3"
    build(output.resolve(), args.replace, catalog_dir)

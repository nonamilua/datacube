"""Build the standalone v2 catalog with Python's standard library."""
from contextlib import closing
import argparse
import json
import re
import sqlite3
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
BRANDS = ["GAN", "MoYu", "DaYan", "QiYi", "Other"]


def load_catalog():
    data = json.loads((HERE / "catalog.json").read_text(encoding="utf-8"))
    research = json.loads((HERE / "research.json").read_text(encoding="utf-8"))
    if data["schema_version"] != 2 or data["brands"] != BRANDS:
        raise ValueError("Invalid version or brands")
    seen_ids, seen_names = set(), set()
    source_ids = {s["id"] for s in research["sources"]}
    if len(source_ids) != len(research["sources"]):
        raise ValueError("Duplicate research source IDs")
    for cube in data["cubes"]:
        if set(cube) != {"id", "brand", "name", "aliases"}:
            raise ValueError("Cube entries must contain id, brand, name, aliases")
        if not isinstance(cube["id"], str) or not re.fullmatch(r"[a-z0-9-]+", cube["id"]):
            raise ValueError("Invalid cube ID")
        if cube["id"] in seen_ids or (cube["brand"], cube["name"]) in seen_names:
            raise ValueError("Duplicate cube ID or brand/name")
        seen_ids.add(cube["id"])
        seen_names.add((cube["brand"], cube["name"]))
        if cube["brand"] not in BRANDS or not cube["name"].strip():
            raise ValueError("Invalid cube brand/name")
        aliases = cube["aliases"]
        if not isinstance(aliases, list) or any(
            not isinstance(a, str) or not a.strip() for a in aliases
        ) or len(aliases) != len(set(aliases)):
            raise ValueError("Invalid aliases")
        evidence = research["entries"].get(cube["id"], {})
        refs = evidence.get("source_ids", [])
        if not refs or not set(refs) <= source_ids:
            raise ValueError(f"Missing or invalid research: {cube['id']}")
    if set(research["entries"]) != seen_ids:
        raise ValueError("Research entry IDs must match catalog IDs")
    return data


def build(output, replace=False):
    data = load_catalog()
    if output.exists() and not replace:
        raise FileExistsError("Output exists; use --replace for the generated database")
    if output.suffix != ".sqlite3":
        raise ValueError("Use a .sqlite3 output filename")
    output.parent.mkdir(parents=True, exist_ok=True)
    # Build and verify first; replace the previous generated file only on success.
    with tempfile.TemporaryDirectory(dir=output.parent, prefix="catalog-build-") as temp:
        temporary = Path(temp) / "catalog.sqlite3"
        with closing(sqlite3.connect(temporary)) as db:
            db.executescript((HERE / "schema.sql").read_text(encoding="utf-8"))
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
    parser.add_argument("--output", type=Path, default=HERE / "cube_catalog.sqlite3")
    parser.add_argument("--replace", action="store_true",
                        help="Replace the generated database after validation")
    args = parser.parse_args()
    build(args.output.resolve(), args.replace)

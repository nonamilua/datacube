"""Build the separate catalog using only Python's standard library.

Edit catalog.json, then run:
    python build_database.py --output cube_catalog_v2.sqlite3

The output must be a new filename. Existing files are never overwritten.
"""
import argparse
import json
import sqlite3
from pathlib import Path

HERE = Path(__file__).resolve().parent


def validate(data):
    if data["schema_version"] != 1:
        raise ValueError("Unsupported catalog schema version")
    for collection in ("brands", "sources", "models", "variants"):
        ids = [row["id"] for row in data[collection]]
        if len(ids) != len(set(ids)):
            raise ValueError(f"Duplicate IDs in {collection}")
    brands = {row["id"] for row in data["brands"]}
    sources = {row["id"] for row in data["sources"]}
    models = {row["id"] for row in data["models"]}
    for row in data["models"]:
        if row["brand"] not in brands:
            raise ValueError(f"Unknown brand: {row['brand']}")
        if not row["source_ids"] or not set(row["source_ids"]) <= sources:
            raise ValueError(f"Invalid model sources: {row['id']}")
    for row in data["variants"]:
        if row["model_id"] not in models:
            raise ValueError(f"Unknown model: {row['model_id']}")
        if not row["source_ids"] or not set(row["source_ids"]) <= sources:
            raise ValueError(f"Invalid variant sources: {row['id']}")
        for field in ("magnetic", "core_magnets"):
            if row[field] is not None and type(row[field]) is not bool:
                raise ValueError(f"{row['id']}: {field} must be boolean or null")


def build(output):
    data = json.loads((HERE / "catalog.json").read_text(encoding="utf-8"))
    validate(data)
    if output.exists():
        raise FileExistsError(f"Choose a new output filename: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(output) as db:
        db.executescript((HERE / "schema.sql").read_text(encoding="utf-8"))
        db.execute("INSERT INTO catalog_info VALUES (?, ?, ?)",
                   (data["schema_version"], data["research_date"], data["scope"]))
        db.executemany("INSERT INTO brands VALUES (?, ?)",
                       [(b["id"], b["parent_brand"]) for b in data["brands"]])
        db.executemany("INSERT INTO sources VALUES (?, ?, ?, ?, ?, ?, ?)",
                       [(s["id"], s["title"], s["url"], s["type"],
                         s["checked_on"], s["access_method"], s["evidence"])
                        for s in data["sources"]])
        for m in data["models"]:
            db.execute("INSERT INTO models VALUES (?, ?, ?, ?)",
                       (m["id"], m["brand"], m["name"], m["puzzle_type"]))
            db.executemany("INSERT INTO model_aliases VALUES (?, ?)",
                           [(m["id"], alias) for alias in m["aliases"]])
            db.executemany("INSERT INTO model_sources VALUES (?, ?)",
                           [(m["id"], source) for source in m["source_ids"]])
        for v in data["variants"]:
            db.execute("INSERT INTO variants VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                       (v["id"], v["model_id"], v["label"], v["size_mm"],
                        v["suspension"], v["magnetic"], v["core_magnets"],
                        v["finish"], v["verification"]))
            db.executemany("INSERT INTO variant_sources VALUES (?, ?)",
                           [(v["id"], source) for source in v["source_ids"]])
        violations = db.execute("PRAGMA foreign_key_check").fetchall()
        integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
        if violations or integrity != "ok":
            raise ValueError(f"Database validation failed: {violations}, {integrity}")
    print(f"Created {output}")
    print(f"{len(data['models'])} models, {len(data['variants'])} variants, "
          f"{len(data['sources'])} sources; integrity and foreign keys passed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=HERE / "cube_catalog.sqlite3")
    args = parser.parse_args()
    build(args.output.resolve())

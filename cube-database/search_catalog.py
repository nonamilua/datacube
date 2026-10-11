"""Small autocomplete example; no dependencies or application integration.

    python search_catalog.py "tornado v3"
    python search_catalog.py "gan17"
"""
from contextlib import closing
import argparse
import json
import re
import sqlite3
from pathlib import Path

HERE = Path(__file__).resolve().parent


def normalize(text):
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def suggest(query, limit=8, catalog_dir=HERE / "3x3"):
    query = normalize(query)
    if not query or limit <= 0:
        return []
    tokens = query.split()
    results = []
    # This tiny catalog can be searched in memory; no FTS or search service needed.
    with closing(sqlite3.connect((catalog_dir / "cube_catalog.sqlite3").as_uri() + "?mode=ro",
                         uri=True)) as db:
        db.row_factory = sqlite3.Row
        for row in db.execute("SELECT id, brand, name, aliases FROM cubes"):
            cube = dict(row)
            label = cube["name"] if cube["brand"] == "Other" else (
                cube["brand"] + " " + cube["name"]
            )
            terms = [normalize(label), normalize(cube["name"])] + [
                normalize(alias) for alias in json.loads(cube["aliases"])
            ]
            # Ignore punctuation/spacing differences, but preserve word search.
            compact_query = query.replace(" ", "")
            exact = any(t == query or t.replace(" ", "") == compact_query for t in terms)
            prefix = any(t.startswith(query) or
                         t.replace(" ", "").startswith(compact_query) for t in terms)
            contains = any(all(token in term for token in tokens) for term in terms)
            if exact or prefix or contains:
                results.append((0 if exact else 1 if prefix else 2, label,
                                {"id": cube["id"], "brand": cube["brand"],
                                 "name": cube["name"], "label": label,
                                 "alias": json.loads(cube["aliases"])[0]}))
    return [cube for _, _, cube in sorted(results, key=lambda r: (r[0], r[1]))[:limit]]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("query")
    parser.add_argument("--limit", type=int, default=8)
    parser.add_argument("--event", choices=["2x2", "3x3", "4x4", "5x5", "6x6", "7x7", "megaminx", "pyraminx", "skewb", "square 1", "fto"], default="3x3")
    args = parser.parse_args()
    catalog_dir = HERE / args.event.replace(" ", "-")
    print(json.dumps(suggest(args.query, args.limit, catalog_dir), indent=2, ensure_ascii=False))

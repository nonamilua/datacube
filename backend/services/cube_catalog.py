"""Read curated catalogs separately from users' owned cube records."""
import json
from functools import lru_cache

from backend.database import ROOT

CATALOG_ROOT = ROOT / "cube-database"
PRACTICE_EVENTS = {"3bld": "3x3", "3oh": "3x3", "3mbld": "3x3", "fmc": "3x3", "4bld": "4x4", "5bld": "5x5"}


def catalog_event(event: str) -> str:
    return PRACTICE_EVENTS.get(event, event)


@lru_cache(maxsize=18)
def models_for_event(event: str) -> tuple[dict, ...]:
    event = catalog_event(event)
    paths = json.loads((CATALOG_ROOT / "event_catalogs.json").read_text(encoding="utf-8"))["catalogs"]
    if event not in paths:
        return ()
    data = json.loads((CATALOG_ROOT / paths[event]["catalog"]).read_text(encoding="utf-8"))
    return tuple({**item, "label": item["name"] if item["brand"] == "Other" else f'{item["brand"]} {item["name"]}'} for item in data["cubes"])


def find_model(event: str, model_id: str) -> dict | None:
    return next((model for model in models_for_event(event) if model["id"] == model_id), None)

PRAGMA foreign_keys = ON;

CREATE TABLE catalog_info (
    schema_version INTEGER NOT NULL,
    research_date TEXT NOT NULL,
    scope TEXT NOT NULL
);
CREATE TABLE brands (
    id TEXT PRIMARY KEY,
    parent_brand TEXT
);
CREATE TABLE sources (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('manufacturer', 'retailer')),
    checked_on TEXT NOT NULL,
    access_method TEXT NOT NULL,
    evidence TEXT NOT NULL
);
CREATE TABLE models (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL REFERENCES brands(id),
    name TEXT NOT NULL,
    puzzle_type TEXT NOT NULL,
    UNIQUE(brand_id, name, puzzle_type)
);
CREATE TABLE model_aliases (
    model_id TEXT NOT NULL REFERENCES models(id),
    alias TEXT NOT NULL,
    PRIMARY KEY(model_id, alias)
);
CREATE TABLE model_sources (
    model_id TEXT NOT NULL REFERENCES models(id),
    source_id TEXT NOT NULL REFERENCES sources(id),
    PRIMARY KEY(model_id, source_id)
);
CREATE TABLE variants (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL REFERENCES models(id),
    label TEXT NOT NULL,
    size_mm REAL CHECK (size_mm IS NULL OR size_mm > 0),
    suspension TEXT CHECK (suspension IN ('spring', 'maglev') OR suspension IS NULL),
    magnetic INTEGER CHECK (magnetic IN (0, 1) OR magnetic IS NULL),
    core_magnets INTEGER CHECK (core_magnets IN (0, 1) OR core_magnets IS NULL),
    finish TEXT CHECK (finish IN ('frosted', 'uv', 'matte', 'semi_gloss') OR finish IS NULL),
    verification TEXT NOT NULL,
    UNIQUE(model_id, label)
);
CREATE TABLE variant_sources (
    variant_id TEXT NOT NULL REFERENCES variants(id),
    source_id TEXT NOT NULL REFERENCES sources(id),
    PRIMARY KEY(variant_id, source_id)
);
CREATE INDEX variants_model_idx ON variants(model_id);
CREATE VIEW cube_selector AS
SELECT v.id AS variant_id, m.id AS model_id, m.brand_id AS brand,
       m.name AS model, m.puzzle_type, v.label AS variant,
       m.brand_id || ' ' || m.name || ' — ' || v.label AS display_name,
       v.size_mm, v.suspension, v.magnetic, v.core_magnets, v.finish
FROM variants v JOIN models m ON m.id = v.model_id;

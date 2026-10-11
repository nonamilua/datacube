-- Schema v2: conventional 7x7 model catalog.
-- Research provenance lives in research.json, outside the application schema.
PRAGMA user_version = 2;
CREATE TABLE cubes (
    id TEXT PRIMARY KEY,
    brand TEXT NOT NULL CHECK (brand IN ('GAN', 'MoYu', 'DaYan', 'QiYi', 'Other')),
    name TEXT NOT NULL,
    aliases TEXT NOT NULL DEFAULT '[]'
        CHECK (json_valid(aliases) AND json_type(aliases) = 'array'),
    UNIQUE (brand, name)
);
CREATE INDEX cubes_brand_name_idx ON cubes(brand, name);

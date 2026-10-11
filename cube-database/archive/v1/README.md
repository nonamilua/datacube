# Cube model catalog — starter research

Research date: 2026-10-05. Separate from CubeApp: no app files, migrations, or application databases were edited.

This first pass contains **26 model families, 61 variant entries, 5 brands/subbrands, and 18 sources**. It covers conventional 3×3 cubes from GAN, MoYu, DaYan, X-Man Design, and MoFang JiaoShi. It is a curated seed, not all existing models or a statistically established list of the most popular cubes.

## Files

- `cube_catalog.sqlite3`: standalone SQLite database, ready to query.
- `catalog.json`: editable, authoritative dataset, including aliases and research sources.
- `schema.sql`: readable database structure.
- `build_database.py`: reproducible builder using Python standard library only.

To rebuild after edits, choose a new filename:

```powershell
python build_database.py --output cube_catalog_v2.sqlite3
```

Run in this folder. Existing files are deliberately not overwritten.

## Research method and evidence

Manufacturer pages were used for GAN; specialist retailer product pages and comparison tables were used for other brands. Records preserve source URLs, inspection date, a short evidence summary, and the access method. Research used web search extracts, which can be incomplete or stale; inspection date is not a manufacturer's update date.

Every model and variant links to at least one source. Where a source menu lists several versions, the same URL legitimately supports several entries. Variant source sets support the row collectively: for example YS3 M dimensions come from a separate introduction article. Retailer claims have not been independently measured.

Selection prioritized established budget/flagship families, older models users may still own, and current editions visible in those families. Retailer review counts and manufacturer record-equipment mentions were qualitative discovery signals only. No popularity score, ranking, market share, live price, or live stock claim is included.

Important source examples:

- [MoYu RS3 M V5 comparison](https://speedcubeshop.com/collections/all-products/products/moyu-rs3-m-3x3-v5-magnetic): four distinct hardware versions.
- [WeiLong V10 comparison](https://speedcubeshop.com/collections/3x3x3-high-speed-magic-cube/products/moyu-weilong-wr-m-3x3-v10-magnetic-maglev-20-magnet-ball-core-uv-coated): spring and MagLev ball-core variants are separate.
- [GuHong Pro+](https://speedcubeshop.com/products/dayan-guhong-pro-plus-3x3-magnetic-core-magnets-54mm): three sizes with two mechanism editions; core magnets do not necessarily mean a ball-core.
- [Tornado V4 comparison](https://speedcubeshop.com/products/x-man-tornado-3x3-v4-pioneer-magnetic-maglev-core-magnets-uv-coated): also lists V5 and V3 Premium editions.
- [GAN15](https://www.gancube.com/products/gan15-3x3-speed-cube) and [GAN flagship collection](https://www.gancube.com/collections/flagship-speed-cubes): NewBlack uses springs, unlike MagLev editions.

## Identity and unknowns

A **model** identifies a named family/generation. A **variant** identifies a documented edition, size, mechanism, or finish within it. IDs are stable text keys; do not regenerate them when correcting display names. Aliases are search aids, not proof that ambiguous user text maps to one exact variant.

`null` means **not verified**, never false. Some variants explicitly say “Finish unspecified” or “Edition unspecified”: these are family-level fallback entries, not claims of a separate retail SKU. Those entries should be excluded from analyses requiring exact hardware. A verified source-supported name does not imply every technical specification is complete.

`core_magnets` records presence only; it does not classify the core structure. “Ball-Core” and magnet-count distinctions remain in variant labels. A structured core-type field can be added after broader verification.

Finish values follow source descriptions; matte, frosted, and semi-gloss are retained separately rather than assumed identical. Brand lineage is a catalog organization convention: X-Man Design groups under QiYi, and MoFang JiaoShi under MoYu; it is not a legal corporate ownership registry.

Excluded: bundles, accessories, retailer lubrication/setup services, cosmetic limited editions, smart cubes, and other puzzle sizes. Cataloging a smart cube later would not require implementing Bluetooth. Some legitimate editions remain unlisted.

## Suggested interface and eventual integration

Use a searchable **brand → model → variant** selector. Display size/mechanism/finish in the variant label. For a family whose edition is unknown, allow model selection without forcing an invented exact variant. Provide “Model missing / unknown” so incomplete coverage does not cause users to select the wrong cube. Missing-model requests can be reviewed before adding canonical entries.

Keep each user's physical cube in CubeApp's existing `cubes` table. A future optional catalog model/variant reference can identify its factory hardware while the user retains a personal name such as “Main cube” and can own two copies of the same model. Solves should continue referencing the physical cube. The catalog itself contains no users or solves.

Factory hardware is only one factor: lubrication, modifications, setup, practice conditions, and the cuber also affect results. A canonical model enables cleaner grouping but cannot by itself establish causal performance differences.

Example selector query:

```sql
SELECT variant_id, display_name, size_mm, suspension, core_magnets, finish
FROM cube_selector
WHERE brand = 'MoYu'
ORDER BY model, variant;
```

Search model names and aliases using parameterized SQL in any future app implementation. Do not build SQL by concatenating user input.

## Next research passes

1. Cross-check high-use families with a second source and exact manufacturer manuals.
2. Add MoYu RS3 M 2021, Super RS3 M, WR M V9/V11, QiYi MS/M Pro, YJ MGC, and other omissions after verifying their exact versions.
3. Expand other puzzle sizes only when useful to the interface.
4. Add confirmed dimensions and structured core types; preserve unknowns and conflicting claims for review.
5. Keep discontinued models selectable for existing owners. Retailer unavailability alone does not prove manufacturer discontinuation.

## Verification

The builder checks duplicate IDs, source references, boolean types, database constraints, SQLite integrity, and foreign keys. The delivered database was generated from the JSON with those checks passing. This validates data structure, not independent physical measurements of the cubes.

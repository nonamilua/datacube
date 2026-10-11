# Cube database

A small, curated **3×3 autocomplete catalog**. Research updated 2026-10-06.

**83 selectable entries**, expanded from the previous 26 model families. There is now **one database table** and no brand hierarchy, model/variant tables, or technical specification fields.

| Brand | Entries |
| --- | ---: |
| GAN | 26 |
| MoYu | 24 |
| DaYan | 10 |
| QiYi | 15 |
| Other | 8 |

## Files

- `catalog.json` — edit this file to add or correct cubes. Each entry has only `id`, `brand`, `name`, and `aliases`.
- `cube_catalog.sqlite3` — generated standalone database with a single `cubes` table.
- `schema.sql` — readable schema.
- `build_database.py` — standard-library builder and data validation.
- `search_catalog.py` — runnable autocomplete example.
- `research.json` — source links and entry-by-entry evidence, kept outside the app schema.
- `RESEARCH.md` — selection decisions and source limitations.
- `archive/v1/` — preserved previous five files before this schema change.

Run from this directory:

```powershell
python search_catalog.py "gan17"
python search_catalog.py "tornado v3"
python search_catalog.py "ferrocore"
python build_database.py --replace
```

The builder validates the new database before replacing the generated file. Use `--output another_catalog.sqlite3` to build a separate copy. The Python examples need no third-party packages.

## Brand rules

The only brand values are **GAN, MoYu, DaYan, QiYi, Other**.

- Swift Block → GAN.
- X-Man Design / MoFangGe / Valk → QiYi.
- MoFang JiaoShi / MFJS / Huameng → MoYu.
- YJ, YuXin, VIN, HaiTun, and MoreTry → Other.

Actual makers remain in the **name** for Other entries, such as `YJ MGC Beta`. “Other” is a filter category, not a manufacturer's identity. YJ is not treated as a MoYu child brand.

Existing model IDs were retained where possible, including IDs beginning with `xman-`. The ID is an opaque stable key; the `brand` value controls filtering and display.

## What counts as a separate entry

Default: **one family/generation**, with stock sizes, finishes, suspension editions, bundles, and cosmetic releases grouped.

Retained distinctions:

- GAN15 MagLev versus GAN15 NewBlack; GAN V100 MagLev versus Leap.
- Original ZhanChi versus modern ZhanChi V5 M.
- Tornado V3 versus its later Premium revision.
- WeiLong V11 stock, PiCube V11, and Ferrocore V2: three choices, rather than all stock V11 releases.
- Ferrocore V1 versus V2: different V10/V11 base platforms.
- RS3 M V5 family versus its widely discussed Ball-Core edition.

A family entry can represent an unspecified version. This is deliberate model-level classification, not an exact SKU registry. For example, `GuHong Pro+` includes 54/55/56 mm and stock suspension versions. No size or mechanism should be inferred from that selection.

UV, matte, special boxes, colored internals alone, and signature lubrication setups do not create extra rows. Named hardware generations remain separate so an older cube is still identifiable.

Aliases are lowercase display handles of at most 12 characters, including spaces. Each cube currently has one preferred handle in `aliases[0]`. Full names and stable IDs are preserved. Use IDs to distinguish models; aliases need not be unique across cubes.

Prioritize readable model names, omit the brand when needed, and omit MagLev. Keep meaningful generation/edition markers where they fit: `rs3m v5 bc`, `ferrocore v1`, `gan 16`, `gan 16 max`. Both Swift Block entries deliberately use `swift block`. GAN 15 and GAN 15 NewBlack share `gan 15`; GAN 356 Air M and Air SM share `gan 356 air`. Keep GAN in numbered GAN handles so the model remains recognizable. `bc` means Ball-Core; `tornado v3 p` identifies Premium; `super wrm` abbreviates Super WeiLong.

The 2026-10-09 handle revision replaces the earlier search-synonym lists. Search still includes full names and brands. The builder requires nonempty lowercase aliases, trimmed and no longer than 12 characters.

## Future CubeApp integration

Load `catalog.json` once, then search its small `cubes` array locally as the user types. Search the display label and aliases, ignoring case, spaces, and punctuation. Prefer exact matches, then prefixes, then other matches, and show a short result list. The Python example demonstrates this behavior without a search service and returns the preferred handle as `alias`. Use that handle for the short selected value, and the full label to distinguish suggestions sharing a handle.

Display `brand + " " + name` for the four named brands. Display just `name` for Other, since that name already includes its actual maker.

Keep the user's physical cubes in CubeApp's own `cubes` table. A future optional `catalog_cube_id` can reference the selected model while retaining a personal nickname. Two physical cubes can point to the same catalog ID; solves continue referencing the physical cube.

Provide “Model missing / unknown” instead of forcing an incorrect suggestion. The catalog is incomplete, and selecting a cube should never overwrite the user's typed input until a result is explicitly chosen.

No CubeApp code or application database was changed. The previous detailed schema has no drop-in API compatibility: future integration should use the new `cubes` table or `catalog.json.cubes`, not the old `cube_selector` view.

## Catalog

### GAN

- GAN 11 M
- GAN 11 M Duo
- GAN 11 M Pro
- GAN 12 M Leap
- GAN 12 Maglev
- GAN 13 Maglev
- GAN 14 Maglev
- GAN 14 Maglev Pro
- GAN 15 MagLev
- GAN 15 NewBlack
- GAN 16 Maglev
- GAN 16 Maglev MAX
- GAN 17 MagDrive
- GAN 356 Air M
- GAN 356 Air SM
- GAN 356 M
- GAN 356 Maglev
- GAN 356 Me
- GAN 356 RS
- GAN 356 RS2
- GAN 356 X
- GAN 356 XS
- GAN Swift Block 355S
- GAN Swift Block Super MagLev
- GAN V100 Leap
- GAN V100 MagLev

### MoYu

- MoYu AoLong V2
- MoYu AoLong V5
- MoYu MeiLong M
- MoYu PB Cube WR
- MoYu RS3 M 2020
- MoYu RS3 M 2021 MagLev
- MoYu RS3 M V5
- MoYu RS3 M V5 Ball-Core
- MoYu Super AoLong
- MoYu Super RS3 M 2022
- MoYu Super RS3 M V2
- MoYu Super WeiLong
- MoYu Super WeiLong V2
- MoYu WeiLong Ferrocore V1
- MoYu WeiLong Ferrocore V2
- MoYu WeiLong GTS2 M
- MoYu WeiLong GTS3 M
- MoYu WeiLong V11
- MoYu WeiLong V11 PiCube
- MoYu WeiLong WR M 2019
- MoYu WeiLong WR M 2021
- MoYu WeiLong WR M V10
- MoYu WeiLong WR M V9
- MoYu YS3 M

### DaYan

- DaYan GuHong
- DaYan GuHong Pro
- DaYan GuHong Pro+
- DaYan GuHong V4 M
- DaYan TengYun M
- DaYan TengYun V2 M
- DaYan TengYun V3 M
- DaYan ZhanChi
- DaYan ZhanChi Pro M
- DaYan ZhanChi V5 M

### QiYi

- QiYi M Pro
- QiYi M Pro V2
- QiYi M Pro V3
- QiYi MS
- QiYi Thunderclap
- QiYi Tornado V2 M
- QiYi Tornado V3 M
- QiYi Tornado V3 Premium
- QiYi Tornado V4
- QiYi Tornado V5
- QiYi Valk 3
- QiYi Valk 3 Elite M
- QiYi Warrior M
- QiYi Warrior S
- QiYi Warrior W

### Other

- HaiTun WaveRider V2
- MoreTry TianMa X3 Super
- VIN Nova
- YJ MGC Beta
- YJ MGC Elite
- YJ MGC EVO
- YJ MGC Meta
- YuXin Little Magic

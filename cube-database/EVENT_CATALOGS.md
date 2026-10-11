# Event catalogs for namicubes

Separate, curated model catalogs in this directory. Research for the added events: 2026-10-09.

| Event | Models | Editable catalog | SQLite database |
| --- | ---: | --- | --- |
| 2x2 | 23 | 2x2/catalog.json | 2x2/cube_catalog.sqlite3 |
| 3x3 | 83 | 3x3/catalog.json | 3x3/cube_catalog.sqlite3 |
| 4x4 | 16 | 4x4/catalog.json | 4x4/cube_catalog.sqlite3 |
| 5x5 | 12 | 5x5/catalog.json | 5x5/cube_catalog.sqlite3 |
| 6x6 | 11 | 6x6/catalog.json | 6x6/cube_catalog.sqlite3 |
| 7x7 | 10 | 7x7/catalog.json | 7x7/cube_catalog.sqlite3 |
| megaminx | 13 | megaminx/catalog.json | megaminx/cube_catalog.sqlite3 |
| pyraminx | 11 | pyraminx/catalog.json | pyraminx/cube_catalog.sqlite3 |
| skewb | 9 | skewb/catalog.json | skewb/cube_catalog.sqlite3 |
| square 1 | 8 | square-1/catalog.json | square-1/cube_catalog.sqlite3 |
| fto | 4 | fto/catalog.json | fto/cube_catalog.sqlite3 |

`event_catalogs.json` maps supported puzzle sizes to relative JSON and SQLite paths. All eleven catalogs have their own directory. The 3x3 files were moved into `3x3/` with names, aliases and IDs preserved. Each event directory contains catalog.json, research.json, schema.sql, cube_catalog.sqlite3 and a README listing all full names, aliases and sources.

## Selection and storage contract

1. The event selects its catalog; search full labels and aliases within that catalog.
2. Suggestions show the full model label so a shared alias cannot confuse model selection.
3. Clicking a suggestion sets the visible cube text to `aliases[0]` and retains the chosen model ID. Brand and full name come from that ID.
4. Editing the text after selection clears the selected model ID until a suggestion is chosen again. Never infer a model from its alias alone.
5. The backend independently looks up the selected ID in the appropriate catalog. Do not trust client-supplied brand or future model specifications.

The per-model schema remains `id`, `brand`, `name`, `aliases`. JSON includes `event` at catalog level for every size except the preserved legacy 3x3 JSON; the SQLite file boundary identifies its event. New IDs start with the puzzle size, such as `6x6-` or `7x7-`, making repeated names globally distinct. Existing 3x3 IDs remain unchanged.

For example, selecting `4x4-other-yj-mgc` fills `yj mgc`, while preserving `YJ MGC`, brand `Other`, and the 4x4 model identity. `5x5-other-yj-mgc` is a different model even though its alias is also `yj mgc`. Other is the requested brand category; the actual manufacturer remains in the full model name.

Future integration should keep owned physical cubes separate from catalog models, with an optional catalog model reference on the owned cube. Solve ownership and physical-cube relationships continue to use CubeApp's existing tables. Future specifications belong to the catalog model rather than parsed short text. No additional speculative fields are needed now.

When implementing other 3x3 practice events such as 3oh or 3bld, select the 3x3 catalog; 4bld and 5bld use 4x4 and 5x5. Unsupported puzzle types should not fall back to unrelated cube suggestions.

## Curation

The big-cube catalogs are deliberately small. AoSu V7, AoChuang V6, GAN460 M V2, GAN562 M, MGC and VIN represent current discussion; older AoSu/AoChuang generations, WuQue and Valk remain useful for identifying existing owned cubes. AoShi V4 and AoFu V5 extend the selection to 6x6/7x7 alongside Warrior, MGC, Shadow and Spark generations. Selected MeiLong and QiYi models cover recognizable budget cubes. Inclusion is not a measured popularity ranking.

UV/non-UV, matte/frosted, single/double/triple track, ball-core configurations, Sprint/Apex packages within VIN 4 V2, GAN460 V2 SP packages and retailer setups are grouped. Major model generations remain distinct. These are family identities, so no exact finish or mechanism can be inferred from a selection.

GAN 251 M Air/Pro/Leap remain separate recognizable 2x2 editions, matching the prior catalog's approach to meaningful named variants. Cosmetic finishes and setup bundles are grouped. All aliases are lowercase and at most 12 characters, including spaces. GAN stays in numbered GAN aliases.

Official GAN and YJ pages, specialist listings and r/Cubers discussions were consulted. Exact model names use attributable product evidence; Reddit helps with inclusion. QiYi's official homepage did not provide all exact product names, and MoYu's official site could not be fetched. Per-entry evidence and source access methods are in each research.json; no claim of official verification for every model.

## Commands

```powershell
python build_database.py --event 2x2 --replace
python build_database.py --event 4x4 --replace
python build_database.py --event 5x5 --replace
python build_database.py --event 6x6 --replace
python build_database.py --event 7x7 --replace
python search_catalog.py --event 2x2 "gan251"
python search_catalog.py --event 4x4 "mgc"
python search_catalog.py --event 5x5 "aochuang"
python search_catalog.py --event 6x6 "aoshi"
python search_catalog.py --event 7x7 "aofu"
```

Without --event, both tools retain the original 3x3 behavior. Search results expose `id`, `brand`, `name`, full `label` and short `alias`. Model names and aliases are matched ignoring case, spaces and punctuation, with exact matches ahead of prefix and contains matches. Unsupported --event values fail explicitly.

The tools use Python's standard library. No namicubes UI, backend, user database, migrations or dependencies were changed.

The megaminx, pyraminx, skewb and square 1 catalogs add compact selections of competitive models, classics and recognizable budget alternatives. Their READMEs list aliases and research sources. Cosmetic finishes, setup kits and spring/MagLev configurations are grouped; named generations and GAN Standard/Enhanced magnetic editions remain distinct. Square 1 uses the app event label `square 1` and filesystem directory `square-1/`.

The fto catalog covers DaYan FTO, QiYi FTO and both named DianSheng Galaxy FTO generations, including NEO. Internal colors and setup variants are grouped. Other manufacturers and 2x2/Master/shape-mod puzzles are outside this compact FTO selection.

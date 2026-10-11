# Cube database

Curated autocomplete catalogs maintained in `cubeapp/cube-database`. Each supported puzzle type has its own directory and SQLite database; shared tools remain here.

| Event | Models | Model and alias list |
| --- | ---: | --- |
| 2x2 | 23 | [2x2/README.md](2x2/README.md) |
| 3x3 | 83 | [3x3/README.md](3x3/README.md) |
| 4x4 | 16 | [4x4/README.md](4x4/README.md) |
| 5x5 | 12 | [5x5/README.md](5x5/README.md) |
| 6x6 | 11 | [6x6/README.md](6x6/README.md) |
| 7x7 | 10 | [7x7/README.md](7x7/README.md) |
| megaminx | 13 | [megaminx/README.md](megaminx/README.md) |
| pyraminx | 11 | [pyraminx/README.md](pyraminx/README.md) |
| skewb | 9 | [skewb/README.md](skewb/README.md) |
| square 1 | 8 | [square-1/README.md](square-1/README.md) |
| fto | 4 | [fto/README.md](fto/README.md) |

Every event directory contains `catalog.json`, `research.json`, `schema.sql`, `cube_catalog.sqlite3` and `README.md`. The 3x3 directory also retains its existing `ALIASES.md` and `RESEARCH.md`. Prior snapshots remain in `archive/`.

Entries use `id`, `brand`, `name` and `aliases`. Preferred aliases are lowercase and at most 12 characters including spaces. Track configurations, finishes and setup editions do not create extra entries in the big-cube catalogs.

[EVENT_CATALOGS.md](EVENT_CATALOGS.md) describes event routing and the future namicubes selection/storage contract. `event_catalogs.json` maps each supported catalog event to relative data paths. The app label `square 1` maps to `square-1/`; use `--event "square 1"` with shared tools.

For namicubes integration, the app events `3x3`, `3bld`, `3oh`, `3mbld` and `fmc` must all use the `3x3/catalog.json` catalog and `3x3/cube_catalog.sqlite3` database. These events share the same cube model suggestions. `3mbld` uses a single cube selection like the other events; selecting multiple cubes for a multi-blind attempt is outside the implementation scope.

```powershell
python search_catalog.py --event 6x6 "aoshi"
python search_catalog.py --event 7x7 "warrior"
python search_catalog.py "gan 15"
python build_database.py --event 6x6 --replace
python build_database.py --event 7x7 --replace
```

Run commands from this directory. Omitting `--event` selects `3x3`. The builder validates data and closes SQLite connections before atomically replacing a generated file. No external packages are required.

Catalog checks cover data integrity, source references, alias constraints, model IDs, event isolation and autocomplete. Application integration and user solve data are unaffected.

The megaminx, pyraminx, skewb and square 1 catalogs add compact selections of competitive models, classics and recognizable budget alternatives. Their READMEs list aliases and research sources. Cosmetic finishes, setup kits and spring/MagLev configurations are grouped; named generations and GAN Standard/Enhanced magnetic editions remain distinct. Square 1 uses the app event label `square 1` and filesystem directory `square-1/`.

The fto catalog covers DaYan FTO, QiYi FTO and both named DianSheng Galaxy FTO generations, including NEO. Internal colors and setup variants are grouped. Other manufacturers and 2x2/Master/shape-mod puzzles are outside this compact FTO selection.

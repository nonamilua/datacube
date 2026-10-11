# pyraminx cube catalog

11 curated model families for namicubes autocomplete. Research checked 2026-10-09. Current competitive models, established classics and a few recognizable budget alternatives are included; inclusion is not a measured popularity or performance ranking.

| Full model | Preferred alias | Characters |
| --- | --- | ---: |
| GAN Pyraminx M Standard | `gan pyra` | 8 |
| GAN Pyraminx M Enhanced | `gan pyra enh` | 12 |
| MoYu WeiLong Pyraminx | `weilong` | 7 |
| MoYu RS Pyraminx M | `rs pyra m` | 9 |
| MoYu MeiLong Pyraminx V2 M | `meilong v2 m` | 12 |
| QiYi Bell M | `bell m` | 6 |
| QiYi Bell V2 M | `bell v2 m` | 9 |
| QiYi M Pro Pyraminx | `qiyi m pro` | 10 |
| QiYi MS Pyraminx | `qiyi ms` | 7 |
| YuXin Little Magic M | `ylm m` | 5 |
| YJ MGC EVO | `yj mgc evo` | 10 |

## Curation and implementation

The schema stays `id`, `brand`, `name`, `aliases`. Brands are GAN, MoYu, DaYan, QiYi and Other. X-Man is QiYi and MFJS is MoYu; actual manufacturers remain in Other model names. Aliases are lowercase and at most 12 characters including spaces. Suggestions show full labels and selection retains model IDs; aliases are not identifiers.

Cosmetic finishes, UV/non-UV, color schemes, retailer setups, magnetic core kits and spring/MagLev configurations are grouped within each named family. GAN Standard and Enhanced magnetic editions remain meaningful named distinctions, with UV grouped inside Enhanced. Named hardware generations remain separate. Exact configuration specifications cannot be inferred from a family selection.

Each model has an inclusion/grouping note and source references in research.json. Official GAN and YJ pages were consulted; QiYi's official homepage confirms its X-Man sub-brand. DaYan and MoYu official sites could not be fetched. Specialist listings verify models not available from brand pages. Reddit supplies community context, not objective market-share evidence. Discontinued classics can still identify existing owned hardware. Shape mods and larger/minor puzzle variants are excluded.

## Files and commands

`catalog.json` is editable source data; `cube_catalog.sqlite3` contains the matching four-column `cubes` table. `schema.sql` and `research.json` support rebuilding and provenance. Run tools from the parent cube-database directory:

```powershell
python build_database.py --event "pyraminx" --replace
python search_catalog.py --event "pyraminx" "gan pyra"
```

## Sources

- [YJ official named model videos](https://www.youngjoecube.com/video)
- [r/Cubers budget hardware discussion June 22 2026](https://www.reddit.com/r/Cubers/comments/1ucbbdj/daily_discussion_thread_jun_22_2026/)
- [TheCubicle Pyraminx collection](https://www.thecubicle.com/collections/pyraminx)
- [GAN official Pyraminx M editions](https://www.gancube.com/products/pyraminx-m-minx-cube)
- [YJ official Pyraminx catalog](https://www.youngjoecube.com/pyraminx)
- [Original X-Man Bell Pyraminx](https://www.thecubicle.com/products/x-man-bell-magnetic-pyraminx)
- [X-Man Bell V2 Pyraminx listing](https://www.thecubicle.com/en-hr/products/x-man-bell-magnetic-pyraminx-v2)
- [QiYi MS Pyraminx listing](https://speedcubing.org/products/qiyi-ms-pyraminx)
- [r/Cubers Bell and WeiLong Pyraminx comparison](https://www.reddit.com/r/Cubers/comments/17z7yrp)

# square 1 cube catalog

8 curated model families for namicubes autocomplete. Research checked 2026-10-09. Current competitive models, established classics and a few recognizable budget alternatives are included; inclusion is not a measured popularity or performance ranking.

| Full model | Preferred alias | Characters |
| --- | --- | ---: |
| GAN Square-1 | `gan sq1` | 7 |
| YJ MGC | `yj mgc` | 6 |
| YJ MGC V2 | `yj mgc v2` | 9 |
| QiYi Volt | `volt` | 4 |
| QiYi Volt V2 | `volt v2` | 7 |
| QiYi QiFa | `qifa` | 4 |
| YuXin Little Magic M | `ylm m` | 5 |
| MoYu MeiLong Square-1 | `meilong` | 7 |

## Curation and implementation

The schema stays `id`, `brand`, `name`, `aliases`. Brands are GAN, MoYu, DaYan, QiYi and Other. X-Man is QiYi and MFJS is MoYu; actual manufacturers remain in Other model names. Aliases are lowercase and at most 12 characters including spaces. Suggestions show full labels and selection retains model IDs; aliases are not identifiers.

Cosmetic finishes, UV/non-UV, color schemes, retailer setups, magnetic core kits and spring/MagLev configurations are grouped within each named family. Named hardware generations remain separate. Exact configuration specifications cannot be inferred from a family selection.

Each model has an inclusion/grouping note and source references in research.json. Official GAN and YJ pages were consulted; QiYi's official homepage confirms its X-Man sub-brand. DaYan and MoYu official sites could not be fetched. Specialist listings verify models not available from brand pages. Reddit supplies community context, not objective market-share evidence. Discontinued classics can still identify existing owned hardware. Shape mods and larger/minor puzzle variants are excluded.

## Files and commands

`catalog.json` is editable source data; `cube_catalog.sqlite3` contains the matching four-column `cubes` table. `schema.sql` and `research.json` support rebuilding and provenance. Run tools from the parent cube-database directory:

```powershell
python build_database.py --event "square 1" --replace
python search_catalog.py --event "square 1" "gan sq1"
```

## Sources

- [YJ official named model videos](https://www.youngjoecube.com/video)
- [r/Cubers budget hardware discussion June 22 2026](https://www.reddit.com/r/Cubers/comments/1ucbbdj/daily_discussion_thread_jun_22_2026/)
- [TheCubicle Square-1 collection](https://www.thecubicle.com/collections/square-1)
- [GAN official Square-1](https://www.gancube.com/products/gan-sq1)
- [Original X-Man Volt Square-1](https://www.thecubicle.com/products/x-man-volt-square-1)
- [SpeedCubeShop Square-1 model collection guide](https://speedcubeshop.com/a/blog/our-square-1-cube-collection-at-speedcubeshop)
- [r/Cubers Square-1 choices September 29 2026](https://www.reddit.com/r/Cubers/comments/1wt161v/daily_discussion_thread_sep_29_2026/)

- [YJ MGC SQ-1 V2 product description](https://www.thecubicle.com/collections/square-1/products/yj-mgc-sq-1-v2-magnetic-uv-coated)

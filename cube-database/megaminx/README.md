# megaminx cube catalog

13 curated model families for namicubes autocomplete. Research checked 2026-10-09. Current competitive models, established classics and a few recognizable budget alternatives are included; inclusion is not a measured popularity or performance ranking.

| Full model | Preferred alias | Characters |
| --- | --- | ---: |
| GAN Megaminx M | `gan mega` | 8 |
| GAN Megaminx MagLev | `gan mega v2` | 11 |
| DaYan Megaminx V2 M | `dayan v2` | 8 |
| DaYan Megaminx Pro | `dayan pro` | 9 |
| DaYan Megaminx Pro+ | `dayan pro+` | 10 |
| QiYi Galaxy V2 | `galaxy v2` | 9 |
| QiYi QiHeng S2 | `qiheng s2` | 9 |
| MoYu MeiLong V2 M | `meilong v2 m` | 12 |
| YJ YuHu V2 M | `yuhu v2 m` | 9 |
| YJ YuHu V3 | `yuhu v3` | 7 |
| YJ Pocket Mini | `pocket mini` | 11 |
| YuXin Little Magic V3 M | `ylm v3 m` | 8 |
| VIN Azure | `vin azure` | 9 |

## Curation and implementation

The schema stays `id`, `brand`, `name`, `aliases`. Brands are GAN, MoYu, DaYan, QiYi and Other. X-Man is QiYi and MFJS is MoYu; actual manufacturers remain in Other model names. Aliases are lowercase and at most 12 characters including spaces. Suggestions show full labels and selection retains model IDs; aliases are not identifiers.

Cosmetic finishes, UV/non-UV, color schemes, retailer setups, magnetic core kits and spring/MagLev configurations are grouped within each named family. Named hardware generations remain separate. Sizes within DaYan Pro/Pro+ are grouped; YJ Pocket Mini remains a separately named model. Exact configuration specifications cannot be inferred from a family selection.

Each model has an inclusion/grouping note and source references in research.json. Official GAN and YJ pages were consulted; QiYi's official homepage confirms its X-Man sub-brand. DaYan and MoYu official sites could not be fetched. Specialist listings verify models not available from brand pages. Reddit supplies community context, not objective market-share evidence. Discontinued classics can still identify existing owned hardware. Shape mods and larger/minor puzzle variants are excluded.

## Files and commands

`catalog.json` is editable source data; `cube_catalog.sqlite3` contains the matching four-column `cubes` table. `schema.sql` and `research.json` support rebuilding and provenance. Run tools from the parent cube-database directory:

```powershell
python build_database.py --event "megaminx" --replace
python search_catalog.py --event "megaminx" "gan mega"
```

## Sources

- [TheCubicle Megaminx collection](https://www.thecubicle.com/collections/megaminx)
- [GAN official Megaminx MagLev](https://www.gancube.com/products/megaminx-maglev-minx-cube)
- [Original GAN Megaminx](https://www.thecubicle.com/products/gan-megaminx)
- [YJ official named model videos](https://www.youngjoecube.com/video)
- [DaYan Megaminx V2 M listing](https://www.thecubicle.com/en-ro/products/dayan-megaminx-v2-m)
- [DaYan Megaminx Pro listing](https://www.thecubicle.com/en-es/products/dayan-megaminx-pro)
- [X-Man Galaxy Megaminx V2 listing](https://www.thecubicle.com/en-ie/products/x-man-galaxy-megaminx-v2-sculpted)
- [VIN Azure Lite and Nova model listing](https://www.thecubicle.com/en-oceania/collections/megaminx/products/vin-azure-megaminx-lite-standard)
- [r/Cubers current Megaminx choices September 16 2026](https://www.reddit.com/r/Cubers/comments/1whnlro/daily_discussion_thread_sep_16_2026/)
- [r/Cubers established Megaminx recommendations](https://www.reddit.com/r/Cubers/comments/1ajehr2/what_are_the_best_megaminxes/)
- [r/Cubers budget hardware discussion June 22 2026](https://www.reddit.com/r/Cubers/comments/1ucbbdj/daily_discussion_thread_jun_22_2026/)

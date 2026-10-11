# skewb cube catalog

9 curated model families for namicubes autocomplete. Research checked 2026-10-09. Current competitive models, established classics and a few recognizable budget alternatives are included; inclusion is not a measured popularity or performance ranking.

| Full model | Preferred alias | Characters |
| --- | --- | ---: |
| GAN Skewb M Standard | `gan skewb` | 9 |
| GAN Skewb M Enhanced | `gan skew enh` | 12 |
| DaYan Skewb V2 | `dayan v2` | 8 |
| MoYu RS Skewb M | `rs skewb m` | 10 |
| MoYu WeiLong Skewb | `weilong` | 7 |
| MoYu AoYan Skewb | `aoyan` | 5 |
| QiYi Wingy M | `wingy m` | 7 |
| QiYi Wingy V2 M | `wingy v2 m` | 10 |
| YuXin Kylin | `yuxin kylin` | 11 |

## Curation and implementation

The schema stays `id`, `brand`, `name`, `aliases`. Brands are GAN, MoYu, DaYan, QiYi and Other. X-Man is QiYi and MFJS is MoYu; actual manufacturers remain in Other model names. Aliases are lowercase and at most 12 characters including spaces. Suggestions show full labels and selection retains model IDs; aliases are not identifiers.

Cosmetic finishes, UV/non-UV, color schemes, retailer setups, magnetic core kits and spring/MagLev configurations are grouped within each named family. GAN Standard and Enhanced magnetic editions remain meaningful named distinctions, with UV grouped inside Enhanced. Named hardware generations remain separate. Exact configuration specifications cannot be inferred from a family selection.

Each model has an inclusion/grouping note and source references in research.json. Official GAN and YJ pages were consulted; QiYi's official homepage confirms its X-Man sub-brand. DaYan and MoYu official sites could not be fetched. Specialist listings verify models not available from brand pages. Reddit supplies community context, not objective market-share evidence. Discontinued classics can still identify existing owned hardware. Shape mods and larger/minor puzzle variants are excluded.

## Files and commands

`catalog.json` is editable source data; `cube_catalog.sqlite3` contains the matching four-column `cubes` table. `schema.sql` and `research.json` support rebuilding and provenance. Run tools from the parent cube-database directory:

```powershell
python build_database.py --event "skewb" --replace
python search_catalog.py --event "skewb" "gan skewb"
```

## Sources

- [r/Cubers budget hardware discussion June 22 2026](https://www.reddit.com/r/Cubers/comments/1ucbbdj/daily_discussion_thread_jun_22_2026/)
- [TheCubicle Skewb collection](https://www.thecubicle.com/collections/skewb)
- [GAN official Skewb M editions](https://www.gancube.com/products/gan-skewb-m-magnetic-cube)
- [Original X-Man Wingy Skewb](https://www.thecubicle.com/products/x-man-wingy-magnetic-skewb-concave)
- [MoYu AoYan Skewb listing](https://www.thecubicle.com/en-it/products/moyu-aoyan-skewb)
- [r/Cubers Skewb recommendations May 30 2026](https://www.reddit.com/r/Cubers/comments/1ts3zq4/which_skweb_should_i_get/)
- [r/Cubers established Skewb comparisons](https://www.reddit.com/r/Cubers/comments/166fqyw)

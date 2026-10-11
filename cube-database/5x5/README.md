# 5x5 cube catalog

Researched 2026-10-09. **12 models**. Curated competitive models, recognizable older models and selected budget choices.

Each model has a stable ID, normalized brand, full name and one lowercase alias of at most 12 characters including spaces. IDs include the puzzle size so identically named cubes in different catalogs remain distinct.

UV, frosted, matte, sticker colors, track counts, ball-core configurations and retailer setup editions are grouped under their model. Do not infer a specific mechanism from a family selection. Hardware generations remain separate.

Brands follow the existing GAN, MoYu, DaYan, QiYi and Other categories. X-Man and Valk normalize to QiYi; MFJS to MoYu. Other names retain their actual maker.

Sources are linked per entry in research.json. Official GAN and YJ pages were readable. QiYi official pages did not establish all exact names, and the MoYu website was unavailable; specialist listings fill those gaps. Reddit informs inclusion, not objective performance ratings or sales claims.

Build and search from the parent directory:

```powershell
python build_database.py --event 5x5 --replace
python search_catalog.py --event 5x5 "mgc"
```

| Full model | Alias | Characters |
| --- | --- | ---: |
| GAN 562 M | `gan 562 m` | 9 |
| MoYu AoChuang GTS M | `aochuang gts` | 12 |
| MoYu AoChuang V6 | `aochuang v6` | 11 |
| MoYu AoChuang WR M | `aochuang wrm` | 12 |
| MoYu MeiLong M | `meilong m` | 9 |
| QiYi Hong | `hong` | 4 |
| QiYi M Pro | `qiyi m pro` | 10 |
| QiYi MS | `qiyi ms` | 7 |
| QiYi Valk 5 M | `valk 5 m` | 8 |
| QiYi Warrior M | `warrior m` | 9 |
| VIN 5 | `vin 5` | 5 |
| YJ MGC | `yj mgc` | 6 |

## Sources

- [MoYu AoChuang GTS M 5x5](https://www.thecubicle.com/products/moyu-aochuang-5x5-gts-m)
- [MoYu AoChuang WR M 5x5](https://www.thecubicle.com/products/moyu-aochuang-5x5-wr-m)
- [TheCubicle 5x5 collection](https://www.thecubicle.com/collections/5x5-speed-cubes)
- [GAN562 M official product](https://www.gancube.com/products/gan562-m-5x5-speed-cube)
- [X-Man Hong 5x5](https://speedcubeshop.com/collections/cubes-puzzles-wca/products/x-man-hong-5x5-magnetic-ball-core-uv-coated)
- [Speedcubing.org 5x5 selections](https://speedcubing.org/pages/5x5x5-recommendations)
- [r/Cubers: 4x4 vs 5x5 September 2026](https://www.reddit.com/r/Cubers/comments/1wnbug3/4x4_vs_5x5_what_do_you_prefer/)
- [Valk 5 M](https://www.thecubicle.com/products/valk-5-m)

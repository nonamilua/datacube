# 2x2 cube catalog

Researched 2026-10-09. **23 models**. Curated competitive models, recognizable older models and selected budget choices.

Each model has a stable ID, normalized brand, full name and one lowercase alias of at most 12 characters including spaces. IDs include the puzzle size so identically named cubes in different catalogs remain distinct.

UV, frosted, matte, sticker colors, track counts, ball-core configurations and retailer setup editions are grouped under their model. Do not infer a specific mechanism from a family selection. Hardware generations remain separate. GAN 251 Air, Pro and Leap remain recognizable named 2x2 editions; their finishes and setup bundles are grouped.

Brands follow the existing GAN, MoYu, DaYan, QiYi and Other categories. X-Man and Valk normalize to QiYi; MFJS to MoYu. Other names retain their actual maker.

Sources are linked per entry in research.json. Official GAN and YJ pages were readable. QiYi official pages did not establish all exact names, and the MoYu website was unavailable; specialist listings fill those gaps. Reddit informs inclusion, not objective performance ratings or sales claims.

Build and search from the parent directory:

```powershell
python build_database.py --event 2x2 --replace
python search_catalog.py --event 2x2 "mgc"
```

| Full model | Alias | Characters |
| --- | --- | ---: |
| GAN 249 V2 | `gan 249 v2` | 10 |
| GAN 251 M Air | `gan 251 air` | 11 |
| GAN 251 M Leap | `gan 251 leap` | 12 |
| GAN 251 M Pro | `gan 251 pro` | 11 |
| GAN 251 V2 | `gan 251 v2` | 10 |
| MoYu MeiLong M | `meilong m` | 9 |
| MoYu RS2 M Evolution | `rs2m evo` | 8 |
| MoYu WeiPo V5 | `weipo v5` | 8 |
| MoYu WeiPo WR M | `weipo wrm` | 9 |
| MoYu WeiPo WRS | `weipo wrs` | 9 |
| DaYan TengYun M | `tengyun m` | 9 |
| DaYan TengYun V2 M | `tengyun v2 m` | 12 |
| QiYi Flare M | `flare m` | 7 |
| QiYi M Pro | `qiyi m pro` | 10 |
| QiYi MS | `qiyi ms` | 7 |
| QiYi QiDi S2 | `qidi s2` | 7 |
| QiYi Valk 2 M | `valk 2 m` | 8 |
| QiYi Warrior M | `warrior m` | 9 |
| VIN 2 | `vin 2` | 5 |
| YJ MGC | `yj mgc` | 6 |
| YJ MGC2 Beta | `yj mgc2 beta` | 12 |
| YJ MGC2 Elite | `mgc2 elite` | 10 |
| YuXin Little Magic V2 M | `little magic` | 12 |

## Sources

- [TheCubicle 2x2 collection](https://www.thecubicle.com/collections/2x2-speed-cubes)
- [X-Man Flare 2x2 M](https://www.thecubicle.com/products/x-man-flare-2x2-m)
- [GAN official 2x2 collection](https://www.gancube.com/collections/gan-2x2-speed-cubes)
- [YJ MGC2 Elite 2x2](https://www.thecubicle.com/en-gb/products/yj-mgc2-elite-2x2)
- [QiYi MS 2x2](https://www.thecubicle.com/products/qiyi-ms-2x2)
- [r/Cubers: best 2x2s in 2026](https://www.reddit.com/r/Cubers/comments/1rssygo/best_2x2s_in_2026/)
- [r/Cubers: August 12 2026 discussion](https://www.reddit.com/r/Cubers/comments/1vm4m3c/daily_discussion_thread_aug_12_2026/)
- [DaYan TengYun V2 M 2x2](https://www.thecubicle.com/products/dayan-tengyun-v2-m-2x2)
- [Valk 2 M](https://www.thecubicle.com/en-br/products/valk2-m)
- [Vin Cube 2x2](https://www.thecubicle.com/products/vin-cube-2x2-ball-core)
- [MoYu WeiPo V5 2x2](https://www.thecubicle.com/en-gb/products/moyu-weipo-v5-2x2-ball-core-uv)

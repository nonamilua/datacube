# 7x7 cube catalog

Researched 2026-10-09. **10 curated models** for autocomplete.

Current models and recognizable older competitive or budget models are included. This is a curated list, not an exhaustive product registry or measured sales ranking.

UV/non-UV, matte/frosted, track counts, core-magnet configurations and retailer setup editions are grouped. Major named generations remain separate. A family selection does not identify a finish or exact mechanism.

Brands normalize to GAN, MoYu, DaYan, QiYi and Other. X-Man belongs to QiYi and MFJS to MoYu. Other model names retain the actual manufacturer.

Every handle is lowercase and at most 12 characters including spaces. Model identity uses the stable event-prefixed ID, never the handle alone.

M Pro and Shadow V3/Spark V2 are retained as separately marketed names. Community posts suggest related or rebranded hardware, but the consulted product listings do not establish exact equivalence. No independent mechanism distinction is asserted.

Run shared tools from the parent cube-database directory:

```powershell
python build_database.py --event 7x7 --replace
python search_catalog.py --event 7x7 "mgc"
```

| Full model | Alias | Characters |
| --- | --- | ---: |
| MoYu AoFu V5 | `aofu v5` | 7 |
| MoYu AoFu WR M | `aofu wrm` | 8 |
| MoYu MeiLong V2 M | `meilong v2 m` | 12 |
| QiYi M Pro | `qiyi m pro` | 10 |
| QiYi Spark M | `spark m` | 7 |
| QiYi Spark V2 M | `spark v2 m` | 10 |
| QiYi Warrior M | `warrior m` | 9 |
| YJ MGC | `yj mgc` | 6 |
| YJ YuFu V2 M | `yufu v2 m` | 9 |
| YuXin Hays 7 M | `hays 7 m` | 8 |

## Research

Source IDs for every entry are recorded in research.json. Official YJ 7x7 listings identify MGC and YuFu V2 M. The YJ 6x6 page could not be fetched; its names use specialist listings. QiYi official navigation did not establish all exact names, and the MoYu site could not be fetched. Retailer evidence fills those gaps. Reddit informs inclusion without certifying performance or hardware specifications.

## Sources

- [TheCubicle 7x7 catalog](https://www.thecubicle.com/collections/7x7-speed-cubes)
- [YuXin Hays 7 M](https://www.thecubicle.com/en-de/products/yuxin-hays-7x7-m)
- [QiYi M Pro 7x7](https://speedcubing.org/products/qiyi-m-pro-7x7-m-uv)
- [r/Cubers July 19 2026 hardware discussion](https://www.reddit.com/r/Cubers/comments/1v0hdeh/daily_discussion_thread_jul_19_2026/)
- [r/Cubers Spark V2 owner discussion](https://www.reddit.com/r/Cubers/comments/1l4zkep/x_man_spark_7x7_v2_m_ball_core/)
- [r/Cubers Warrior 7 M discussion](https://www.reddit.com/r/Cubers/comments/1okdc8h/warrior_7_m_how_does_it_change_the_7x7_meta/)
- [YJ official 7x7 competition products](https://www.youngjoecube.com/7x7x7)

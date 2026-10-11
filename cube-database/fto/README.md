# FTO cube catalog

Four model families across DaYan, DianSheng and QiYi. Research checked 2026-10-09. This is a compact catalog for autocomplete, not an exhaustive list or measured popularity ranking.

| Full model | Preferred alias | Characters |
| --- | --- | ---: |
| DaYan FTO | `dayan fto` | 9 |
| DianSheng Galaxy FTO | `ds fto` | 6 |
| DianSheng Galaxy FTO NEO | `ds fto neo` | 10 |
| QiYi FTO | `qiyi fto` | 8 |

## Naming and scope

DaYan and QiYi use FTO as the product name. DianSheng does have named hardware: Galaxy (also translated Galaxy Clusters) and its NEO successor. Keep those generations separate so existing owners can identify the original model. NEO is the current DianSheng option emphasized in the consulted Reddit discussions; the original is retained as a classic.

The brand categories remain GAN, MoYu, DaYan, QiYi and Other. DianSheng is categorized as Other with its actual manufacturer in the full name. The alias uses ds because diansheng fto exceeds 12 characters. All aliases are lowercase, at most 12 characters including spaces, and distinguish these four families.

Internal colors, finishes, limited editions, core/setup kits and retailer modifications are grouped. QiYi's magnetic and nonmagnetic versions share one family entry; selection cannot imply a specific mechanism. ShengShou/SengSo and LanLan also exist, but are excluded from this deliberately compact competitive-focused selection. Conventional full-size FTO only: exclude 2x2 FTO/skewb diamond, Master FTO and shape mods.

The schema is id, brand, name, aliases. Suggestions display the full name; selection retains the model ID and fills aliases[0]. Do not infer identity or specifications from a short alias. The namicubes fto event maps directly to this directory. No application integration is implemented here.

## Research

DianSheng official indexed pages confirm the Galaxy and NEO names. QiYi's official homepage was consulted; its indexed 2x2 octahedron listing was excluded. DaYan's official site could not be fetched, so a specialist product page confirms its model. Reddit informs relevance and generation choices; its opinions are not objective performance evidence. Detailed source references and access limitations are in research.json.

## Files and commands

catalog.json is editable source data; cube_catalog.sqlite3 contains the matching cubes table. Run from the parent cube-database directory:

```powershell
python search_catalog.py --event fto "neo"
python build_database.py --event fto --replace
```

## Sources

- [TheCubicle FTO collection](https://www.thecubicle.com/collections/fto)
- [DaYan FTO Magnetic Ball-Core product](https://www.thecubicle.com/products/dayan-fto-magnetic-ball-core)
- [DianSheng official Galaxy Clusters magnetic FTO](https://en.dianshengtoys.com/m/products/show_73.html)
- [DianSheng official product collection including NEO](https://www.dianshengtoys.com/products/)
- [DianSheng FTO NEO Magnetic Ball-Core](https://speedcubeshop.com/collections/face-turning-octahedron-fto/products/diansheng-fto-neo-magnetic-ball-core?variant=42535150878833)
- [QiYi official brand homepage](https://www.qiyitoys.net/en/)
- [r/Cubers FTO hardware and resources August 21 2026](https://www.reddit.com/r/Cubers/comments/1vuhpf6/fto_megapost_links_to_all_the_best_tutorials_and/)
- [r/Cubers original DianSheng and NEO discussion](https://www.reddit.com/r/Cubers/comments/1ufeolj/farewell_clock_and_hello_fto/)

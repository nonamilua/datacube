# Research and curation

Research date: 2026-10-06. Catalog version 2.

The goal is recognizable autocomplete choices, not exhaustive SKUs, specifications, purchasing recommendations, or a global popularity ranking.

## Research approach

1. Manufacturer sites establish product names where readable and attributable.
2. r/Cubers discussions help identify classics, current models, and modified editions worth retaining.
3. Specialist product listings fill manufacturer-site gaps and verify older names.
4. Details unrelated to identifying the cube are omitted from the application schema.

The provenance for every entry lives in `research.json`. Its `entries` map links stable cube IDs to source IDs. Manufacturer, retailer, collaborator and community sources are distinguished. A community source supports name recognition and inclusion; it does not certify technical claims or sales popularity.

Some names are supported by product-family menus, historic listings or search extracts. `access_method` marks sources retained from the first pass. Search extracts may be incomplete or stale. A check date describes this research pass, not the page's publication date.

## Official-site results and limitations

- [GAN current products](https://www.gancube.com/): verified GAN17 MagDrive, V100 MagLev/Leap, Swift Block Super MagLev and 355S. [GAN manuals](https://www.gancube.cn/en/tutorials/) also support older X, XS and Air M names.
- [QiYi manufacturer](https://www.qiyitoys.net/en/): confirms X-MAN DESIGN as a subbrand and features Tornado V4. Product listing pages were empty or timed out, so retailer sources support many exact QiYi model names.
- [YJ manufacturer](https://www.youngjoecube.com/): identifies MGC EVO and Beta 3×3. These are assigned Other under the requested five-category rule.
- [MoYu website](https://www.moyucube.com/) could not be retrieved over HTTP or HTTPS. Its availability is not a claim about the brand or catalog coverage. MoYu names use specialist listings and r/Cubers evidence.
- A current DaYan manufacturer's website could not be established. The accessible `dayancube.com` pages described unrelated home goods and were excluded as product evidence. DaYan names use specialist listings and r/Cubers evidence.

Thus this pass consulted official websites and r/Cubers, but does **not** claim official product-page verification for every entry.

## Key selection evidence

- [GAN17 official product](https://www.gancube.com/products/gan17-magdrive-3x3-speed-cube) and [r/Cubers owner discussion](https://www.reddit.com/r/Cubers/comments/1wexfxc/one_month_with_the_gan17_second_thoughts/): current relevance; contrasting opinions are not turned into ratings.
- [GAN V100 official product](https://www.gancube.com/products/v100-3x3-speed-cube): MagLev and spring-based Leap are named editions. Cosmetic seasonal releases are grouped.
- [Swift Block Super official product](https://www.gancube.com/products/speed-cubing-cube-swift-3x3): UV and frost finishes belong to one entry.
- [Ferrocore V2 collaborator page](https://www.thecubicle.com/products/moyu-weilong-ferrocore-v2-3x3): based on WeiLong V11. Original Ferrocore is V10-based, so they remain separate.
- [r/Cubers V11 discussion](https://www.reddit.com/r/Cubers/comments/1tyt5ts/weilong_v11_questions/) and [2026 hardware discussion](https://www.reddit.com/r/Cubers/comments/1tups2r/a_not_so_brief_opinion_post_on_2026_3x3_hardware/): support retaining PiCube and Ferrocore as recognizable modifications while grouping stock V11 editions.
- [Classic-cube discussion](https://www.reddit.com/r/Cubers/comments/1ct4yv6/) and [older cubes still used](https://www.reddit.com/r/Cubers/comments/16q36pp/whats_a_cube_that_can_be_considered_old_but_is/): help prioritize AoLong V2, GTS2/3 M, Valk, Air SM, original GuHong and ZhanChi.

PiCube V11 inclusion is a curation decision based on repeated discussion of changed feel/hardware; the catalog does not attempt to specify every PiCube modification. Manufacturer ownership and legal brand relationships are not modeled.

## Intentional tradeoff

Collapsing versions makes autocomplete easier and reduces ambiguous choices. It also means analytics operate at the catalog identity shown in the label, usually the family/generation, rather than exact factory configuration.

Some distinctions remain when there is a strong recognition reason, such as Ferrocore V1/V2 or MagLev/NewBlack. This is a curated rule, not a uniform technical taxonomy. Additional fields can be added later if actual analysis needs them.

There are no inferred release years, current stock statuses, prices, product images, or performance scores. “Classic” and “current relevance” describe inclusion decisions rather than guaranteed availability or sales ranking.

## Validation

The builder checks allowed brands, unique IDs and brand/name pairs, four-field entries, alias lists, complete research references, SQLite row counts and integrity. Autocomplete checks cover compact names, parent/subbrand aliases, variant distinctions, limits, empty input, and unknown models. These validate the catalog and search behavior; they do not establish independent hardware measurements.

## Warrior additions on 2026-10-06

Added Warrior S and Warrior M as separate requested model choices alongside Warrior W. Specialist product pages verify the 3x3 names; finish variants remain grouped. Source links are recorded in `research.json`.

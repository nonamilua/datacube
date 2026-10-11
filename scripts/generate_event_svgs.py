"""Generate original detailed event artwork and a local review gallery.

Run from the repository root after the reference assets have been downloaded.
Only Python's standard library is needed. Geometry uses a shared 128px canvas.
"""
import json
import math
import re
from itertools import combinations, product
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "frontend/public/event-icons"
EVENTS = {
    "2x2": "222", "3x3": "333", "4x4": "444", "5x5": "555",
    "6x6": "666", "7x7": "777", "3bld": "333bf", "4bld": "444bf",
    "5bld": "555bf", "3oh": "333oh", "3mbld": "333mbf", "fmc": "333fm",
    "clock": "clock", "megaminx": "minx", "pyraminx": "pyram",
    "skewb": "skewb", "square 1": "sq1", "fto": "fto",
}


def point(p):
    return f"{p[0]:.2f},{p[1]:.2f}"


def polygon(points, opacity=.12):
    return (f'<polygon points="{" ".join(map(point, points))}" '
            f'fill="currentColor" fill-opacity="{opacity}"/>')


def line(a, b):
    return f'<path d="M{point(a)} L{point(b)}" fill="none"/>'


def mix(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def face(points, size, opacity):
    # Parallel divisions on an affine-projected square keep the exact NxN count.
    a, b, c, d = points
    result = polygon(points, opacity)
    for i in range(1, size):
        t = i / size
        result += line(mix(a, b, t), mix(d, c, t))
        result += line(mix(a, d, t), mix(b, c, t))
    return result


def cube(size):
    top = [(64, 10), (114, 37), (64, 64), (14, 37)]
    left = [(14, 37), (64, 64), (64, 118), (14, 91)]
    right = [(64, 64), (114, 37), (114, 91), (64, 118)]
    return face(top, size, .20) + face(left, size, .07) + face(right, size, .13)


def transform(body, values):
    return f'<g transform="{values}">{body}</g>'


def blindfold():
    # Floating mask badge stays clear of the cube's layer-count geometry.
    return ('<path d="M27 102 Q64 81 101 102 L94 118 Q77 113 64 119 '
            'Q51 113 34 118 Z" fill="currentColor"/>'
            '<path d="M27 103 L16 97 M101 103 L112 97" fill="none"/>')


def hand():
    return ('<path d="M79 118 C70 109 65 102 67 98 Q70 94 75 101 L80 105 '
            'L80 77 Q80 71 85 74 L87 91 L88 68 Q91 62 95 68 L96 89 '
            'L98 72 Q102 68 105 74 L105 91 L108 82 Q113 78 115 85 '
            'L113 106 Q112 115 105 119 Z" fill="currentColor" fill-opacity=".85"/>')


def fmc():
    return (transform(cube(3), "translate(0 0) scale(.76)") +
            '<path d="M78 64 H108 V119 H72 V71 Z" fill="currentColor" fill-opacity=".13"/>'
            '<path d="M79 82 H96 M79 92 H94 M79 102 H91" fill="none"/>'
            '<path d="M87 106 L111 67 L118 71 L94 110 L86 114 Z" '
            'fill="currentColor" fill-opacity=".8"/>')


def pyraminx():
    apex, left, bottom, right = (64, 9), (10, 101), (78, 120), (118, 94)
    # Two triangular faces, each with nine facelets including the tip pieces.
    result = ""
    for a, b, c, opacity in [(apex, left, bottom, .12), (apex, bottom, right, .22)]:
        result += polygon([a, b, c], opacity)
        for i in (1, 2):
            t = i / 3
            result += line(mix(a, b, t), mix(a, c, t))
            result += line(mix(b, a, t), mix(b, c, t))
            result += line(mix(c, a, t), mix(c, b, t))
    return result


def skewb():
    result = ""
    faces = [([(64, 10), (114, 37), (64, 64), (14, 37)], .20),
             ([(14, 37), (64, 64), (64, 118), (14, 91)], .07),
             ([(64, 64), (114, 37), (114, 91), (64, 118)], .13)]
    for corners, opacity in faces:
        result += polygon(corners, opacity)
        # A center diamond and four triangular corners identify corner turning.
        mids = [mix(corners[i], corners[(i + 1) % 4], .5) for i in range(4)]
        result += '<polygon points="' + ' '.join(map(point, mids)) + '" fill="none"/>'
    return result


def fto():
    top, left, center, right, bottom = (64, 8), (8, 56), (64, 74), (120, 56), (64, 122)
    result = ""
    faces = [(top, left, center, .08), (top, center, right, .20),
             (bottom, center, left, .14), (bottom, right, center, .06)]
    for a, b, c, opacity in faces:
        result += polygon([a, b, c], opacity)
        for i in (1, 2):
            t = i / 3
            result += line(mix(a, b, t), mix(a, c, t))
            result += line(mix(b, a, t), mix(b, c, t))
            result += line(mix(c, a, t), mix(c, b, t))
    return result


def megaminx():
    # Project a real regular dodecahedron so adjacent pentagons share edges.
    phi = (1 + math.sqrt(5)) / 2
    vertices = list(product((-1, 1), repeat=3))
    for a, b in product((-1, 1), repeat=2):
        vertices.extend([(0, a / phi, b * phi), (a / phi, b * phi, 0),
                         (a * phi, 0, b / phi)])

    def subtract(a, b):
        return tuple(x - y for x, y in zip(a, b))

    def dot(a, b):
        return sum(x * y for x, y in zip(a, b))

    def cross(a, b):
        return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
                a[0] * b[1] - a[1] * b[0])

    def unit(a):
        length = math.sqrt(dot(a, a))
        return tuple(x / length for x in a)

    face_indices = set()
    for a, b, c in combinations(vertices, 3):
        normal = cross(subtract(b, a), subtract(c, a))
        if dot(normal, normal) < 1e-8:
            continue
        distances = [dot(normal, subtract(v, a)) for v in vertices]
        indices = frozenset(i for i, value in enumerate(distances) if abs(value) < 1e-7)
        if len(indices) == 5 and (min(distances) > -1e-7 or max(distances) < 1e-7):
            face_indices.add(indices)
    desired_view = unit((0, -phi, 1))
    centers = [tuple(sum(vertices[i][axis] for i in indices) / 5 for axis in range(3))
               for indices in face_indices]
    camera = unit(max(centers, key=lambda center: dot(unit(center), desired_view)))
    horizontal = unit(cross((0, 1, 0), camera))
    vertical = cross(camera, horizontal)
    faces = []
    for indices in sorted(face_indices, key=lambda values: tuple(sorted(values))):
        center3 = tuple(sum(vertices[i][axis] for i in indices) / 5 for axis in range(3))
        if dot(center3, camera) <= 0:
            continue
        corners = [(64 + dot(vertices[i], horizontal) * 32,
                    64 - dot(vertices[i], vertical) * 32) for i in indices]
        center2 = (sum(p[0] for p in corners) / 5, sum(p[1] for p in corners) / 5)
        corners.sort(key=lambda p: math.atan2(p[1] - center2[1], p[0] - center2[0]))
        faces.append(corners)
    result = ""
    for index, corners in enumerate(faces):
        result += polygon(corners, .19 if index == 0 else .06 + (index % 3) * .05)
        center = (sum(p[0] for p in corners) / 5, sum(p[1] for p in corners) / 5)
        small = [mix(center, p, .46) for p in corners]
        result += '<polygon points="' + ' '.join(map(point, small)) + '" fill="none"/>'
        for i in range(5):
            # Each pentagonal face has one center, five edges and five corners.
            a, b = corners[i], corners[(i + 1) % 5]
            result += line(small[i], mix(a, b, .32))
            result += line(small[(i + 1) % 5], mix(a, b, .68))
    return result


def square1():
    result = face([(14, 47), (64, 70), (64, 117), (14, 94)], 1, .08)
    result += face([(64, 70), (113, 46), (113, 93), (64, 117)], 1, .15)
    for t in (.36, .64):
        result += line((14, 47 + 47 * t), (64, 70 + 47 * t))
        result += line((64, 70 + 47 * t), (113, 46 + 47 * t))
    # Offset top layer makes the shape-shifting mechanism visible.
    top = [(7, 43), (62, 15), (119, 42), (64, 71)]
    result += polygon(top, .20)
    center = (63, 43)
    for edge in range(4):
        a, b = top[edge], top[(edge + 1) % 4]
        result += line(center, a)
        for t in (.33, .67):
            result += line(center, mix(a, b, t))
    # Larger corner and narrower edge widths in the lower layer.
    for x, y in [(30, 102), (48, 110), (79, 110), (98, 101)]:
        result += line((x, y - 14), (x, y))
    return result


def clock():
    result = '<rect x="13" y="8" width="102" height="112" rx="17" fill="currentColor" fill-opacity=".1"/>'
    for row in range(3):
        for col in range(3):
            x, y = 35 + col * 29, 32 + row * 29
            result += f'<circle cx="{x}" cy="{y}" r="11" fill="none"/>'
            result += f'<path d="M{x} {y-7} V{y} L{x+5} {y+3}" fill="none"/>'
    for x in (49, 79):
        for y in (47, 77):
            result += f'<circle cx="{x}" cy="{y}" r="3" fill="currentColor"/>'
    return result


def artwork(event):
    if event in ("2x2", "3x3", "4x4", "5x5", "6x6", "7x7"):
        return cube(int(event[0]))
    if event in ("3bld", "4bld", "5bld"):
        return transform(cube(int(event[0])), "translate(10 0) scale(.84)") + blindfold()
    if event == "3oh":
        return transform(cube(3), "translate(0 0) scale(.82)") + hand()
    if event == "3mbld":
        return (transform(cube(3), "translate(0 7) scale(.53)") +
                transform(cube(3), "translate(58 7) scale(.53)") +
                transform(cube(3), "translate(30 42) scale(.53)") + blindfold())
    return {"fmc": fmc, "clock": clock, "megaminx": megaminx,
            "pyraminx": pyraminx, "skewb": skewb, "square 1": square1, "fto": fto}[event]()


def main():
    detailed = OUTPUT / "detailed"
    detailed.mkdir(parents=True, exist_ok=True)
    manifest = {"viewBox": "0 0 128 128", "events": {}}
    groups = {"detailed": [], "reference": []}
    sheet = ['<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="640" viewBox="0 0 1080 640">',
             '<rect width="1080" height="640" fill="#17141b"/>']
    for index, event in enumerate(EVENTS):
        slug = event.replace(" ", "-")
        body = '<g stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + artwork(event) + '</g>'
        svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">' + body + '</svg>\n'
        (detailed / f"{slug}.svg").write_text(svg, encoding="utf-8")
        manifest["events"][event] = {"detailed": f"/event-icons/detailed/{slug}.svg", "reference": f"/event-icons/reference/{slug}.svg"}
        for style in groups:
            source = svg if style == "detailed" else (OUTPUT / style / f"{slug}.svg").read_text(encoding="utf-8")
            groups[style].append(f'<article><div class="drawing">{source}</div><div class="label">{event}</div></article>')
        x, y = 30 + (index % 6) * 175, 18 + (index // 6) * 205
        sheet.append(f'<g transform="translate({x} {y})" color="#a3a3bd">{body}<text x="64" y="158" fill="#ffffff" stroke="none" text-anchor="middle" font-family="monospace" font-size="16">{event}</text></g>')
    sheet.append('</svg>')
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + '\n', encoding="utf-8")
    (OUTPUT / "contact-sheet.svg").write_text(''.join(sheet), encoding="utf-8")
    css = (ROOT / "frontend/src/styles/main.css").read_text(encoding="utf-8")
    variables = re.search(r":root\s*\{(.*?)\}", css, re.S).group(1)
    gallery = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>namicubes event artwork</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>:root{{{variables}}} *{{box-sizing:border-box}} body{{margin:0;padding:32px;background:var(--bs-body-bg);color:var(--bs-body-color);font-family:"Roboto Mono",monospace}} main{{max-width:1080px;margin:auto}} h1{{font-size:22px;font-weight:500}} p{{color:var(--muted);font-size:13px}} nav{{display:flex;gap:12px;margin:24px 0}} button{{font:inherit;color:var(--muted);background:var(--panel-bg);border:1px solid var(--panel-border);border-radius:8px;min-height:44px;padding:10px 18px;cursor:pointer}} button[aria-pressed=true]{{color:var(--accent);border-color:var(--accent)}} .gallery{{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}} .gallery[hidden]{{display:none}} article{{display:flex;flex-direction:column;align-items:center;gap:16px;padding:18px 8px;background:var(--panel-bg);border:1px solid var(--list-border);border-radius:10px}} .drawing{{color:var(--muted);height:104px;width:104px}} .drawing svg{{width:100%;height:100%}} article:hover .drawing{{color:var(--accent)}} .label{{font-size:13px}} @media(max-width:700px){{body{{padding:16px}}.gallery{{grid-template-columns:repeat(3,minmax(0,1fr))}}.drawing{{height:80px;width:80px}}}} @media(max-width:380px){{.gallery{{grid-template-columns:repeat(2,minmax(0,1fr))}}}}</style></head>
<body><main><h1>event artwork</h1><p>eighteen events ready for review</p><nav aria-label="artwork style"><button type="button" data-style="detailed" aria-pressed="true">detailed</button><button type="button" data-style="reference" aria-pressed="false">cubing icons</button></nav>
<section class="gallery" id="detailed" aria-label="detailed event artwork">{''.join(groups['detailed'])}</section>
<section class="gallery" id="reference" aria-label="cubing reference icons" hidden>{''.join(groups['reference'])}</section>
<p>hover to preview the accent color</p></main><script>document.querySelectorAll('button[data-style]').forEach(button=>button.addEventListener('click',()=>{{document.querySelectorAll('.gallery').forEach(gallery=>gallery.hidden=gallery.id!==button.dataset.style);document.querySelectorAll('button[data-style]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)))}}));</script></body></html>'''
    (OUTPUT / "preview.html").write_text(gallery, encoding="utf-8")
    print(f"Generated {len(EVENTS)} detailed SVGs, manifest and comparison gallery")


if __name__ == "__main__":
    main()

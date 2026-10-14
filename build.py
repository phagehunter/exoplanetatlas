#!/usr/bin/env python3
"""Build index.html from src/template.html, data/planets.json and data/meta.json.

    python3 build.py

Every number in the page's copy (hero stats, timeline step captions, TESS
stats, the notable-systems index) is computed here from the data, so a refresh
with fetch_data.py never leaves a stale caption behind.
"""
import collections
import datetime
import html
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
PLANETS = json.loads((ROOT / "data" / "planets.json").read_text(encoding="utf-8"))
META = json.loads((ROOT / "data" / "meta.json").read_text(encoding="utf-8"))
TEMPLATE = (ROOT / "src" / "template.html").read_text(encoding="utf-8")

# Timeline eras: (from, to, label, title, prose). Counts are computed below.
STEPS = [
    (1992, 1994, "Precursor era", "Before the floodgates",
     "Pulsar planets came first. In 1992 Wolszczan and Frail reported two worlds orbiting the millisecond pulsar PSR B1257+12, with a third following in 1994. They were strange and unsettling, and barely felt real. Around normal stars: silence."),
    (1995, 1999, "Radial-velocity dawn", "51 Pegasi b",
     "Mayor and Queloz announce a Jupiter-mass world hugging a Sun-like star in a four-day orbit. The first true exoplanet. Radial velocity becomes the dominant detection method and a trickle of hot Jupiters follows."),
    (2000, 2008, "Transit era opens", "Transits arrive",
     "HD 209458 b is the first planet caught crossing its star’s face. Ground-based surveys (HAT, WASP, KELT) start grinding out hot Jupiters while the radial-velocity catalog quietly grows."),
    (2009, 2013, "Kepler prime", "Kepler",
     "NASA’s Kepler mission stares at a single field for four years and changes everything: Earth-sized planets, multi-planet systems, statistics. Most of its harvest is confirmed in bulk a few years later."),
    (2014, 2017, "Validation and K2", "The Kepler flood",
     "Statistical validation releases hundreds of Kepler planets at once in 2014 and again in 2016. After its reaction-wheel failure Kepler is reborn as K2, surveying the ecliptic, while microlensing (KMTNet, OGLE) reaches into the galactic bulge."),
    (2018, 2021, "TESS all-sky", "TESS goes live",
     "The Transiting Exoplanet Survey Satellite scans nearly the entire sky for nearby, bright stars whose planets can actually be studied. Catalog growth accelerates again."),
    (2022, 2100, "Current frontier", "JWST and the present",
     "The James Webb Space Telescope starts probing atmospheres. Direct imaging matures. Ground-based radial velocity joins TESS for follow-up, and the archive keeps growing."),
]


def n(v):
    return f"{v:,}"


def steps_html():
    by_year = collections.Counter(p["y"] for p in PLANETS if p.get("y"))
    year_max = max(by_year)
    out, cum = [], 0
    for frm, to, label, title, prose in STEPS:
        to_eff = min(to, year_max)
        added = sum(c for yv, c in by_year.items() if frm <= yv <= to_eff)
        cum += added
        out.append(
            f'      <div class="step" data-from="{frm}" data-to="{to_eff}">\n'
            f'        <div class="yr">{frm}</div>\n'
            f'        <h3>{html.escape(title)}</h3>\n'
            f'        <p>{html.escape(prose)}</p>\n'
            f'        <div class="meta">{html.escape(label)} · {frm}–{to_eff} · <b>+{n(added)}</b> planets · {n(cum)} total</div>\n'
            f'      </div>'
        )
    return "\n".join(out)


def systems_index(limit=24):
    by_host = collections.defaultdict(list)
    for p in PLANETS:
        by_host[p["h"]].append(p)
    hosts = sorted(by_host.items(), key=lambda kv: (-len(kv[1]), kv[0]))[:limit]
    out = []
    for h, ps in hosts:
        d = ps[0].get("d")
        dist = f" · {d:,.0f} pc" if d else ""
        out.append(f'    <a class="card" href="#system/{html.escape(h)}" data-system="{html.escape(h)}"><span class="n">{html.escape(h)}</span><br><span class="d">{len(ps)} planets{dist}</span></a>')
    return "\n".join(out)


def tess_stats():
    t = [p for p in PLANETS if "TESS" in p.get("f", "")]
    return {
        "N_TESS": n(len(t)),
        "TESS_TRANSIT": n(sum(1 for p in t if p["m"] == "Transit")),
        "TESS_TTV": n(sum(1 for p in t if p["m"] == "Transit Timing Variations")),
        "TESS_NEAR": n(sum(1 for p in t if p.get("d") is not None and p["d"] <= 50)),
        "TESS_SMALL": n(sum(1 for p in t if p.get("r") is not None and p["r"] < 1.6)),
        "TESS_COOL": n(sum(1 for p in t if p.get("st") is not None and p["st"] < 5000)),
    }


def json_ld():
    url = "https://curtishoffmann.com/exoplanetatlas/"
    person = {"@type": "Person", "name": "Curtis Hoffmann", "url": "https://curtishoffmann.com/"}
    return json.dumps({
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "WebPage", "@id": url, "url": url,
             "name": f"Exoplanet Atlas · {n(META['planets'])} worlds beyond the Solar System",
             "description": "An interactive atlas of every confirmed exoplanet in the NASA Exoplanet Archive.",
             "author": person, "dateModified": META["fetched"],
             "isPartOf": {"@type": "WebSite", "name": "Curtis Hoffmann", "url": "https://curtishoffmann.com/"},
             "primaryImageOfPage": url + "assets/og-image.png"},
            {"@type": "Dataset", "@id": url + "data/planets.json",
             "name": "Exoplanet Atlas planet table",
             "description": f"{n(META['planets'])} confirmed exoplanets with discovery year, method, facility, orbital period, radius, mass, equilibrium temperature, insolation, host-star properties, coordinates and distance; a compact extract of the NASA Exoplanet Archive Planetary Systems table (default parameter set).",
             "creator": person, "dateModified": META["fetched"],
             "isBasedOn": "https://exoplanetarchive.ipac.caltech.edu/",
             "license": "https://creativecommons.org/publicdomain/zero/1.0/",
             "keywords": ["exoplanets", "NASA Exoplanet Archive", "TESS", "Kepler", "astronomy", "data visualization"],
             "distribution": {"@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": url + "data/planets.json"}},
            {"@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Curtis Hoffmann", "item": "https://curtishoffmann.com/"},
                {"@type": "ListItem", "position": 2, "name": "Exoplanet Atlas", "item": url}]},
        ],
    }, indent=1, ensure_ascii=False)


def main():
    date = datetime.date.fromisoformat(META["newest_release_date_in_data"]).strftime("%-d %B %Y")
    fetched = datetime.date.fromisoformat(META["fetched"]).strftime("%-d %B %Y")
    rep = {
        "{{N_PLANETS}}": n(META["planets"]), "{{N_HOSTS}}": n(META["hosts"]), "{{N_MULTI}}": n(META["multi_planet_systems"]),
        "{{YEAR_MIN}}": str(META["years"][0]), "{{YEAR_MAX}}": str(META["years"][1]),
        "{{DATA_DATE}}": date, "{{FETCHED}}": fetched, "{{QUERY}}": html.escape(META["query"]),
        "{{ASSET_VERSION}}": META["fetched"].replace("-", ""),
        "{{STEPS}}": steps_html(), "{{SYSTEMS_INDEX}}": systems_index(), "{{JSON_LD}}": json_ld(),
        "{{META_JSON}}": json.dumps(META, separators=(",", ":")).replace("</", "<\\/"),
    }
    rep.update({"{{%s}}" % k: v for k, v in tess_stats().items()})
    page = TEMPLATE
    for k, v in rep.items():
        page = page.replace(k, v)
    assert "{{" not in page, "unreplaced placeholder: " + page[page.index("{{"):page.index("{{") + 40]
    (ROOT / "index.html").write_text(page, encoding="utf-8")
    print(f"wrote index.html ({len(page):,} bytes) for {n(META['planets'])} planets, data as of {date}")


if __name__ == "__main__":
    main()

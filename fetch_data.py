#!/usr/bin/env python3
"""Refresh data/planets.json from the NASA Exoplanet Archive.

    python3 fetch_data.py              # query the archive's TAP service and rebuild the data files
    python3 fetch_data.py --from-csv path/to/ps.csv   # convert an already-downloaded CSV instead

Source: the Planetary Systems (ps) table, default parameter set only
(default_flag = 1), one row per confirmed planet. Documentation:
https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html

Outputs
  data/planets.json   one compact record per planet (short keys, nulls omitted)
  data/meta.json      when the data was fetched, the newest release date in it,
                      row counts, the method list and the exact query used

Short keys in planets.json
  n  pl_name            h  hostname          y  disc_year
  m  discoverymethod    f  disc_facility     p  pl_orbper (days)
  r  pl_rade (Earth radii)                   bm pl_bmasse (Earth masses)
  t  pl_eqt (K)         i  pl_insol (Earth = 1)
  a  pl_orbsmax (au)    e  pl_orbeccen       sp st_spectype
  st st_teff (K)        sr st_rad (Sun = 1)  sm st_mass (Sun = 1)
  ra, dc  equatorial coordinates (deg)        d  sy_dist (pc)
  np sy_pnum (planets in the system)
"""
import csv
import datetime
import io
import json
import pathlib
import sys
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "data"
COLUMNS = [
    "pl_name", "hostname", "disc_year", "discoverymethod", "disc_facility",
    "pl_orbper", "pl_rade", "pl_bmasse", "pl_eqt", "pl_insol", "pl_orbsmax", "pl_orbeccen",
    "st_spectype", "st_teff", "st_rad", "st_mass", "ra", "dec", "sy_dist", "sy_pnum", "releasedate",
]
QUERY = f"select {','.join(COLUMNS)} from ps where default_flag=1"
TAP = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
KEYS = {  # column -> (short key, converter)
    "pl_name": ("n", str), "hostname": ("h", str), "disc_year": ("y", int),
    "discoverymethod": ("m", str), "disc_facility": ("f", str),
    "pl_orbper": ("p", lambda v: round(float(v), 4)), "pl_rade": ("r", lambda v: round(float(v), 2)),
    "pl_bmasse": ("bm", lambda v: round(float(v), 2)), "pl_eqt": ("t", lambda v: round(float(v))),
    "pl_insol": ("i", lambda v: round(float(v), 2)), "pl_orbsmax": ("a", lambda v: round(float(v), 4)),
    "pl_orbeccen": ("e", lambda v: round(float(v), 3)), "st_spectype": ("sp", str),
    "st_teff": ("st", lambda v: round(float(v))), "st_rad": ("sr", lambda v: round(float(v), 2)),
    "st_mass": ("sm", lambda v: round(float(v), 2)), "ra": ("ra", lambda v: round(float(v), 4)),
    "dec": ("dc", lambda v: round(float(v), 4)), "sy_dist": ("d", lambda v: round(float(v), 2)),
    "sy_pnum": ("np", int),
}


def download() -> str:
    url = TAP + "?" + urllib.parse.urlencode({"query": QUERY, "format": "csv"})
    print("querying", TAP)
    with urllib.request.urlopen(url, timeout=300) as r:
        return r.read().decode("utf-8")


def convert(text: str):
    rows = list(csv.DictReader(io.StringIO(text)))
    planets = []
    for row in rows:
        rec = {}
        for col, (key, conv) in KEYS.items():
            v = row.get(col, "")
            if v is None or v == "":
                continue
            try:
                rec[key] = conv(v)
            except ValueError:
                continue
        planets.append(rec)
    planets.sort(key=lambda p: (p.get("y", 0), p["n"]))
    methods = sorted({p["m"] for p in planets})
    newest = max((r["releasedate"] for r in rows if r.get("releasedate")), default=None)
    meta = {
        "source": "NASA Exoplanet Archive, Planetary Systems table (default parameter set)",
        "source_url": "https://exoplanetarchive.ipac.caltech.edu/",
        "query": QUERY,
        "fetched": datetime.date.today().isoformat(),
        "newest_release_date_in_data": newest,
        "planets": len(planets),
        "hosts": len({p["h"] for p in planets}),
        "multi_planet_systems": sum(1 for h, c in _count(p["h"] for p in planets).items() if c > 1),
        "methods": methods,
        "tess_planets": sum(1 for p in planets if "TESS" in p.get("f", "")),
        "years": [min(p["y"] for p in planets), max(p["y"] for p in planets)],
    }
    return planets, meta


def _count(it):
    d = {}
    for x in it:
        d[x] = d.get(x, 0) + 1
    return d


def main(argv):
    if len(argv) > 2 and argv[1] == "--from-csv":
        text = pathlib.Path(argv[2]).read_text(encoding="utf-8")
    else:
        text = download()
    planets, meta = convert(text)
    OUT.mkdir(exist_ok=True)
    (OUT / "planets.json").write_text(json.dumps(planets, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    (OUT / "meta.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    print(f"wrote data/planets.json ({len(planets):,} planets) and data/meta.json (newest release {meta['newest_release_date_in_data']})")


if __name__ == "__main__":
    main(sys.argv)

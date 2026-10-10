"""Upstream calls (PVGIS, Nominatim, Overpass) + cache. No FastAPI imports."""
import hashlib
import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

PVGIS = "https://re.jrc.ec.europa.eu/api/v5_3/PVcalc"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse"
# Public Overpass servers are often busy (HTTP 504). We try them in turn.
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
UA = "SuryaCheck/0.1 (hackathon project, team SYNTAX TERROR)"

cache: dict = {}


class UpstreamError(Exception):
    def __init__(self, service, message=""):
        self.service, self.message = service, message
        super().__init__(f"{service}: {message}")


def _open(req, service, timeout=25, tries=2):
    last = None
    for i in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}"
            if e.code < 500 and e.code != 429:
                break
        except Exception as e:  # timeout, DNS, bad JSON
            last = str(e)
        time.sleep(0.6 * (i + 1))
    raise UpstreamError(service, last or "failed")


def horizon_hash(h):
    return "0" if not h else hashlib.md5(",".join(f"{x:.1f}" for x in h).encode()).hexdigest()[:8]


def pvgis_yield(lat, lon, tilt, aspect=0, horizon=None):
    key = f"PVGIS#{round(lat, 2)}#{round(lon, 2)}#{tilt}#{aspect}#{horizon_hash(horizon)}"
    if key not in cache:
        p = {"lat": lat, "lon": lon, "peakpower": 1, "loss": 14,
             "angle": tilt, "aspect": aspect, "outputformat": "json"}
        if horizon:
            # PVGIS: equally spaced angles starting at north, clockwise (verify)
            p["usehorizon"] = 1
            p["userhorizon"] = ",".join(f"{max(0, x):.1f}" for x in horizon)
        req = urllib.request.Request(f"{PVGIS}?{urllib.parse.urlencode(p)}", headers={"User-Agent": UA})
        data = _open(req, "PVGIS")
        try:
            cache[key] = round(data["outputs"]["totals"]["fixed"]["E_y"], 1)
        except (KeyError, TypeError):
            raise UpstreamError("PVGIS", "unexpected response")
    return cache[key]


def pvgis_many(lat, lon, tilts, aspect=0, horizon=None):
    with ThreadPoolExecutor(max_workers=4) as ex:
        vals = list(ex.map(lambda t: pvgis_yield(lat, lon, t, aspect, horizon), tilts))
    return {str(t): v for t, v in zip(tilts, vals)}


def _place(row):
    """Shape one Nominatim row. stateCode is e.g. "DL" (from ISO3166-2 "IN-DL"), "" if unknown."""
    a = row.get("address") or {}
    iso = a.get("ISO3166-2-lvl4") or ""
    return {
        "name": row.get("display_name", ""),
        "lat": float(row["lat"]),
        "lon": float(row["lon"]),
        "state": a.get("state", ""),
        "stateCode": iso.split("-", 1)[1] if iso.startswith("IN-") else "",
        "city": (a.get("city") or a.get("town") or a.get("village") or a.get("suburb")
                 or a.get("state_district") or ""),
    }


def geocode(q, limit=5, country="in"):
    key = f"GEO2#{q.strip().lower()}#{country}"
    if key not in cache:
        p = {"q": q, "format": "jsonv2", "limit": limit, "addressdetails": 1}
        if country:
            p["countrycodes"] = country
        req = urllib.request.Request(f"{NOMINATIM}?{urllib.parse.urlencode(p)}", headers={"User-Agent": UA})
        rows = _open(req, "Nominatim")
        cache[key] = [_place(r) for r in rows]
    return cache[key]


def reverse(lat, lon):
    """Coordinates -> address, for the 'use my location' button."""
    key = f"REV#{round(lat, 4)}#{round(lon, 4)}"
    if key not in cache:
        p = {"lat": lat, "lon": lon, "format": "jsonv2", "zoom": 18, "addressdetails": 1}
        req = urllib.request.Request(f"{NOMINATIM_REVERSE}?{urllib.parse.urlencode(p)}", headers={"User-Agent": UA})
        row = _open(req, "Nominatim")
        cache[key] = {"found": True, **_place(row)} if isinstance(row, dict) and "lat" in row else {"found": False}
    return cache[key]


def _pip(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-18) + xi:
            inside = not inside
        j = i
    return inside


def _area_m2(ring, lat0):
    kx = 111320 * math.cos(math.radians(lat0))
    pts = [(x * kx, y * 110540) for x, y in ring]
    return abs(sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1]
                   for i in range(len(pts)))) / 2


def building(lat, lon, radius=40):
    key = f"BLD#{round(lat, 5)}#{round(lon, 5)}"
    if key in cache:
        return cache[key]
    q = f'[out:json][timeout:20];way(around:{radius},{lat},{lon})["building"];out tags geom;'
    body = urllib.parse.urlencode({"data": q}).encode()
    els, last = None, None
    for url in OVERPASS_MIRRORS:
        try:
            req = urllib.request.Request(url, data=body, headers={"User-Agent": UA})
            data = _open(req, "Overpass", timeout=25, tries=1)
            if not isinstance(data, dict):
                raise UpstreamError("Overpass", "unexpected response")
            els = data.get("elements") or []
            break
        except UpstreamError as e:
            last = e
    if els is None:
        raise last
    best, best_d = None, 1e9
    for e in els:
        g = e.get("geometry")
        if not g or len(g) < 4:
            continue
        ring = [(p["lon"], p["lat"]) for p in g]
        if _pip(lon, lat, ring):
            best, best_d = (e, ring), 0
            break
        cx = sum(p[0] for p in ring) / len(ring)
        cy = sum(p[1] for p in ring) / len(ring)
        d = math.hypot((cx - lon) * 111320 * math.cos(math.radians(lat)), (cy - lat) * 110540)
        if d < best_d:
            best, best_d = (e, ring), d
    if not best:
        out = {"found": False}
    else:
        e, ring = best
        tags = e.get("tags", {})
        out = {"found": True, "containsPoint": best_d == 0,
               "polygon": [[x, y] for x, y in ring],  # [lon, lat], closed
               "areaM2": round(_area_m2(ring, lat), 1),
               "levels": tags.get("building:levels"), "height": tags.get("height"),
               "osmId": e.get("id")}
    cache[key] = out
    return out

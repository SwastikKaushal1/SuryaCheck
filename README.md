# SuryaCheck

[![Tests](https://github.com/SwastikKaushal1/SuryaCheck/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/SwastikKaushal1/SuryaCheck/actions/workflows/ci.yml)

**A roof-aware rooftop solar planner for Indian homes. See what your own roof can produce and what it costs after subsidy.**

Built at Bharat Builds Tour, Environmental Hacks (Oct 8 to 11, 2026), by Swastik Kaushal. Track 03: Waste and Energy.

[Live app](#deploy) (link coming) · [Demo video](#) (link coming) · [Report a bug](../../issues)

---

## The problem

Most Indian homes have a flat RCC roof with a water tank, a staircase room and a parapet. Homeowners can't tell how many panels actually fit once shadows from those obstacles and taller neighbours are counted. Vendor quotes mix size, cost and savings in ways that are hard to check. The PM Surya Ghar subsidy rises up to 2 kW, slows, then stops at 3 kW, so a bigger system is not always a better deal.

## What SuryaCheck does

Type an address and your monthly electricity bill. SuryaCheck then:

1. Finds your roof outline from OpenStreetMap on satellite imagery (you can fix it by dragging corners).
2. Lets you place tanks, rooms and taller neighbouring buildings. They cast real shadows.
3. Scores every spot on the roof for sunlight across the year.
4. Sizes the system to your bill and places the fewest panels that cover it, in a tidy block on the best-lit area.
5. Picks the tilt that gives the most useful energy, using real PVGIS yield data.
6. Shows subsidy, cost range, savings and payback, and exports a PDF report or a WhatsApp message.

No login, about three minutes. There is no machine-learning model: everything is geometry, sun physics and public data, so every number can be explained and checked. See [`docs/CODE_WALKTHROUGH.md`](docs/CODE_WALKTHROUGH.md).

## Repository layout

```
suryacheck/
├── web/                  Next.js frontend (React, TypeScript, Tailwind, Leaflet)
│   ├── app/              page shell and global styles
│   ├── components/suryacheck/   screens, map layers, PDF report
│   ├── lib/              plan engine, solar maths, finance, API client
│   └── tests/            plan engine tests
├── backend/              FastAPI service (runs locally with uvicorn, or on AWS Lambda via Mangum)
│   ├── main.py           routes and error shaping
│   ├── geo.py            PVGIS, Nominatim and Overpass calls plus caching
│   ├── finance.py        subsidy, cost and payback rules
│   ├── reference.json    tariffs, panel size, subsidy numbers
│   └── tests/            API tests with the outside services stubbed
├── docs/                 CODE_WALKTHROUGH.md (file by file)
└── docker-compose.yml    one-command run
```

## Run it

### Easiest: Docker

Install Docker Desktop, then from this folder:

```bash
docker compose up --build
```

Open http://localhost:3000. The first build takes a few minutes. Stop it with `Ctrl+C`, or `docker compose down`.

Both ports are published on `127.0.0.1` only, so the app works on your computer but is **not visible to other devices on your Wi-Fi**.

### Without Docker

You need Node 20+, pnpm, and Python 3.10+.

```bash
# terminal 1: backend
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn main:app --port 8000      # listens on this computer only

# terminal 2: frontend
cd web
cp .env.example .env.local        # points at http://localhost:8000
pnpm install
pnpm dev -H 127.0.0.1             # http://localhost:3000
```

### Tests (optional)

```bash
cd web && pnpm typecheck && pnpm test
cd backend && pip install -r requirements-dev.txt && python tests/test_backend.py
```

## How the pieces talk

| Screen | Backend call |
|---|---|
| Landing | `GET /geocode`, `GET /reverse` (use my location) |
| Where you live | `GET /quick` (sunshine at the pin) |
| Confirm roof | `GET /building` (outline from OpenStreetMap) |
| Plan | `POST /yield` (PVGIS per tilt), `POST /finance` |
| Shade check | `POST /yield` with a 36-value horizon |
| App start | `GET /reference` (panel size, subsidy, tariffs) |

Errors always come back as `{ "error", "hint" }`. The heavy geometry (shadows, panel packing, tilt choice) runs in the browser, so it is instant and free. Anything that needs caching or an outside API goes through the backend.

## Data sources

| Need | Source |
|---|---|
| Satellite imagery | Esri World Imagery (no key). A plain-map toggle covers areas without imagery. Set `NEXT_PUBLIC_TILE_URL` to use another provider. |
| Yearly yield per kW | PVGIS (EU JRC) |
| Address search | Nominatim (India only) |
| Roof outlines | OpenStreetMap through Overpass |

## <a id="deploy"></a>Deploy on AWS

The backend is already Lambda-ready (`handler = Mangum(app)` in `backend/main.py`). The target setup is the API on AWS Lambda behind API Gateway and the static frontend on S3 with CloudFront. Deployment files will be added under `infra/`.

## Limits worth knowing

SuryaCheck gives estimates, not quotations. Costs, tariffs, subsidy top-ups and net-metering rules vary by state, so check them with your DISCOM and installer. Trees are not modelled in the plan (the shade check takes a user-chosen amount), obstacle heights are user-confirmed, and OpenStreetMap outline coverage varies. Yield data comes from PVGIS and has not been validated against real meter data.

## License

MIT, see [LICENSE](LICENSE).

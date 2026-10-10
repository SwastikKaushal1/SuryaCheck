# SuryaCheck: full code walkthrough

Read this top to bottom once and you can explain every part. Sections: the big picture, the backend, the frontend, the plan algorithm (the heart), the map overlay trick, the PDF and WhatsApp, testing, and likely judge questions.

---

## 1. The big picture

```
Browser (Next.js + React)                    Backend (FastAPI, Python)            Outside data
────────────────────────                     ─────────────────────────            ────────────
App.tsx  (state + screens)   ──── HTTP ───▶  main.py  (routes)                    PVGIS     (sunshine)
lib/plan.ts (the brain)                      geo.py   (talks to outside)  ───────▶ Nominatim (addresses)
SatelliteMap.tsx (Leaflet)                   finance.py (money maths)             Overpass  (roof outlines)
                                             reference.json (prices, rules)       Esri/OSM  (map pictures, from the browser)
```

**Split of work:**
- The **backend** fetches things the browser can't (or shouldn't) fetch itself, and does the money maths. It keeps a cache so repeat calls are instant.
- The **frontend** does all the geometry: the roof, the panels, the shadows, the layout. This runs in the browser, so dragging a corner or adding a tank updates the plan instantly with no server round trip.

---

## 2. Backend (`backend/`)

### `main.py`: the routes
| Route | What it does |
|---|---|
| `GET /geocode?q=` | Address text to a list of places (India only). |
| `GET /reverse?lat&lon` | A point to an address. Used when the user drags the pin. |
| `GET /quick?lat&lon` | One fast number: yearly kWh per kW at a 20° tilt (PVGIS). Powers the first-look screen. |
| `GET /building?lat&lon` | The building outline around the pin (Overpass). |
| `POST /yield` | Yearly kWh per kW for a list of tilts, optionally with a skyline `horizon` (36 numbers). |
| `POST /finance` | Cost range, subsidy, yearly savings, payback, CO₂. |
| `GET /reference` | Panel size, prices, subsidy rules, so the frontend never hard-codes them. |

Details worth knowing:
- Every error comes back in one shape, `{error, hint}`, so the frontend can show a friendly message.
- `Mangum(app)` at the bottom lets the same app run on AWS Lambda.
- Input is validated with Pydantic (e.g. tilts 0-90, horizon exactly 36 numbers).

### `geo.py`: talking to the outside
- `pvgis_yield(lat, lon, tilt, aspect, horizon)` calls PVGIS "PVcalc" with a 1 kW system, 14% losses, the tilt and the compass direction (0 = south). It returns `E_y`, the yearly kWh per kW. If a horizon is passed, PVGIS applies it, which is how skyline shade becomes a real number.
- `pvgis_many` runs several tilts in parallel (4 threads).
- Everything is cached in a dict. The key is rounded coordinates plus tilt, aspect and a hash of the horizon.
- `_open` retries once or twice on timeouts and 5xx errors, then raises `UpstreamError`, which `main.py` turns into a clean 502.
- `building()` queries Overpass for buildings around the pin. It tries three mirror servers in turn, because the public ones often return 504. It returns the polygon, its area and whether it contains the pin.

### `finance.py`: the money maths (no web code, easy to test)
- **Cost:** the first kW and each extra kW have their own price range in `reference.json`.
- **Subsidy (PM Surya Ghar):** ₹30,000/kW for the first 2 kW plus ₹18,000 for the 3rd kW, capped at ₹78,000, plus an optional state top-up. Only if the connection is residential **and** the house is the person's own.
- **Savings:** `min(production, consumption) × tariff`. Extra energy beyond what you use earns nothing.
- **Payback:** net cost (after subsidy) divided by yearly savings, as a range.
- Notes are added for the edge cases (not eligible, unknown state, system larger than your use).

---

## 3. Frontend (`web/`)

### 3.1 `lib/`: logic with no UI

| File | Purpose |
|---|---|
| `plan.ts` | The brain. See section 4. |
| `solar.ts` | Sun position across three seasons, shadow shapes, skyline loss. |
| `geo.ts` | Converts between real map coordinates (lat/lng) and the overlay's own "units". |
| `geometry.ts` | Point in polygon, area, bounds, centroid, convex hull. |
| `neighbours.ts` | Turns "tall neighbour on the west, 5 floors" into a building block that casts a shadow. |
| `obstacles.ts` | The tank / stair room / parapet / heater presets (size and colour). |
| `api.ts` | Typed functions for every backend route. |
| `finance.ts` | Calls `/finance`, with a local fallback calculation if the server can't be reached. |
| `reference.ts` | Defaults for prices and rules if `/reference` is unreachable. |
| `useAsync.ts` | A data-loading hook that can cancel, and keeps the last good value while a new one loads. |
| `i18n.ts` | English and Hindi text. |
| `format.ts` | ₹ and lakh formatting. |
| `mockData.ts` | Types, plus the open-sky starting point for the shade check. |

### 3.2 `App.tsx`: the conductor
- It keeps all the app's state in one place: the screen, place, pin, bill inputs, roof, obstacles, neighbours, house floors, shade, language.
- The screens run in this order: `landing → where → quick → roof → obstacles → plan → skyline (shade check) → summary`.
- It fetches data with `useAsync`: sunshine for the pin (`/quick`), the roof outline (`/building`), yields for every tilt (`/yield`), yields again with the shade horizon, and finance.
- It builds the plan with `buildPlanModel(...)` inside a `useMemo`, so it recalculates only when an input changes.
- When the pin moves, it waits 600 ms and calls `/reverse` to refresh the address.
- Finance calls are debounced by 350 ms so typing a bill doesn't spam the server.

### 3.3 `components/suryacheck/`
- **`SatelliteMap.tsx`** is a wrapper around Leaflet (see section 5). It also has the Satellite/Map switch, zoom buttons, the scale bar and a "tiles failed" banner.
- **`MapLayers.tsx`** draws everything on the map: roof outline, draggable corners, edge "+" buttons, panels, tanks and rooms, tall neighbours, shadows.
- **`screens/`**, one file per step:
  - `Landing`: address search and "use my location".
  - `WhereYouLive`: drag the pin, bill, own house, residential.
  - `QuickEstimate`: first-look sunshine number.
  - `ConfirmRoof`: shows the detected outline, with warnings if it's too big or too small. `RoofFallback` is the "mark 4 corners yourself" path.
  - `RoofObstacles`: tanks, rooms, tall neighbours, house floors, shadow time switch.
  - `PlanScreen`: panels on the roof, numbers, tilt diagram, heatmap.
  - `SkylineFlow` and `skyline/SkylineResult`: the shade-from-surroundings editor.
  - `Summary`: facts, PDF and WhatsApp buttons.
- **`PrintReport.tsx`** is the PDF (section 7). **`TiltDiagram.tsx`** is the side-view picture of the tilt.

---

## 4. The plan algorithm (`lib/plan.ts`): the heart

`buildPlanModel(args)` takes the roof, obstacles, neighbours, house floors, bill, PVGIS yields and shade, and returns the panels and numbers. Steps:

1. **Usable roof.** Shrink the roof polygon to 93% about its centre (edge clearance). Every obstacle becomes a blocked rectangle with a 30 cm margin.

2. **Orientation (`roofAngle`).** Find the roof's longest edge and its angle off east-west. If it's within 25°, rotate the whole panel grid by that angle so rows follow the roof, as an installer would. Otherwise use plain east-west rows.

3. **Shade samples.** For three seasons (winter, equinox, summer) and every half hour from 7 to 17, find the sun's position. Build each obstacle's and neighbour's shadow polygon (footprint plus the footprint moved along the sun's opposite direction by `height / tan(sun elevation)`, then the convex hull). Each sample has a weight of `sin(sun elevation)`, because higher sun gives more energy.

4. **Score for a spot.** The fraction (by weight) of samples where that point is *not* inside any shadow. Skyline loss reduces it further. That score is also what the heatmap shows.

5. **For each tilt from 5° to 35°:**
   - Panel depth on the roof = `2.28 × cos(tilt)`.
   - Row spacing so rows don't shade each other at winter noon: `shadow = 2.28 × sin(tilt) / tan(winter noon elevation)`, where winter noon elevation = `90 − |latitude| − 23.44`.
   - Row pitch = depth + shadow + 3 cm gap. Slide the grid a few offsets and keep the one that fits the most panels.
   - Each spot gets its yearly energy: `0.55 kW × PVGIS yield for that tilt × share of light it gets`.

6. **Sizing.** `need = bill ÷ tariff × 12` (yearly units). Try 1, 2, 3, ... panels as a tidy block (whole rows, about as tall as wide, centred on the best-lit spot) and stop at the first count whose yearly energy covers `need`. So 6 panels for a ₹2,500 bill, not 40. If even the whole roof can't cover it, use the whole roof and say "limited by roof".

7. **Tilt choice.** For each tilt compute `useful = min(energy, need)` and keep the best. A near tie goes to the option with fewer panels (cheaper), then to more energy. A bigger tilt needs wider row spacing, so it fits fewer panels; the loop sorts that trade-off out automatically.

8. **Sloped or sheet roofs.** Panels lie flat on the slope, so there is no row spacing and no tilt choice. The yield is read at a 20° tilt.

Output: the panels (position, size, rotation angle), the numbers (panels, kW, kWh before and after shade, coverage), the finance result, the heat cells, and a `shadowsAt(hour)` function for the time slider.

### `solar.ts` highlights
- `sunPosition`: azimuth and elevation for a season and hour at the given latitude.
- `shadowHull`: one shadow polygon, as described above.
- `skylineLossPct`: how much a horizon blocks over the year, compared with open sky.

### Skyline shade (the "Shade" step)
The user picks open sky, some buildings or trees, or tall buildings close by (or drags the five direction dots). That makes a 36-value horizon, one height per 10° of compass. It goes to PVGIS (`/yield` with `horizon`), and the real loss is `1 − average(shaded yield ÷ clear yield)` over the tilts. If PVGIS is unreachable, `skylineLossPct` gives a local estimate.

---

## 5. The map overlay trick (`SatelliteMap.tsx`, `geo.ts`)

The hard problem: the roof drawing must stay glued to the right spot on the picture while the user pans and zooms.

- All drawing happens in **units**, where 1 unit = 6.5 cm (`GEO_MPU = 0.065`). A fixed anchor, `(200, 150)`, is pinned to the user's confirmed pin.
- `lngLatToUnits` / `unitsToLngLat` convert between real coordinates and units, and `pxPerUnit(zoom, lat)` says how many screen pixels one unit takes at that zoom and latitude.
- The overlay is one SVG with a `<g>` group. On every Leaflet `move`/`zoom` event we set the group's transform to `translate(...) scale(pxPerUnit)`. React doesn't re-render for this, so panning is smooth.
- Things that must stay a constant size on screen (corner handles, labels) divide their size by `scale` from the `useMapView()` context.
- Clicks are converted back: `clientToUnits(x, y)` turns a screen click into units, which is how corner dragging and tapping to place a tank work.
- Imagery is Esri World Imagery (no key). Zoom is capped near the picture's real detail, because beyond it the image is just enlarged and blurry. A Satellite/Map switch falls back to OpenStreetMap tiles.

---

## 6. Roof detection and the manual path
1. The pin's position goes to `/building`. The backend returns the nearest building polygon from OpenStreetMap.
2. The frontend converts it to units and simplifies the shape.
3. `ConfirmRoof` shows it. Warnings appear if the area is over 260 m² (maybe several buildings) or under 15 m².
4. "Adjust corners" lets the user drag corners and add new ones. "Not my house" / "Mark my roof myself" opens `RoofFallback`: tap four corners, or type the size.

---

## 7. PDF and WhatsApp
- **PDF:** `PrintReport.tsx` renders a styled report that is hidden on screen and shown only when printing (`print:block`). It's attached to `document.body` with a React portal. A print stylesheet in `globals.css` hides everything else, so the "Download PDF" button just calls `window.print()` and the browser's "Save as PDF" produces the file. This works in English and Hindi, uses real vector drawings of the roof, and needs no extra libraries.
- **Cost breakdown in the PDF:** the total range is split by typical shares (panels 46%, inverter 14%, structure 12%, cables 10%, labour 13%, paperwork 5%).
- **WhatsApp:** builds a text summary in the current language and opens `https://wa.me/?text=...`.

---

## 8. Testing
- `tests/plan.test.ts`: unit tests for the plan logic (sizing to a bill, tilt choice, shade effects, tall neighbours, skyline loss, panels inside the roof, speed).
- `tests/test_backend.py`: backend routes with the outside services replaced by stand-ins.
- A Playwright script drives the whole app on a phone-size and desktop-size browser (search, drag pin, mark roof, add rooms and neighbours, plan, shade, PDF, WhatsApp) and checks the roof outline lines up with the map picture.
- Limit: all of this ran with stand-in PVGIS, Overpass and satellite pictures, not the live services.

---

## 9. Questions judges may ask

**How is it different from a normal solar calculator?** It uses your actual roof and your actual shade, and sizes the system to your bill instead of giving a generic "you need 3 kW".

**Where does the sunshine data come from?** PVGIS, the European Commission's free solar database, for the exact coordinates and for each tilt. We don't make up yields.

**How do you choose the tilt?** We test 5° to 35°. A steeper tilt makes more energy per panel but needs wider row gaps, so fewer panels fit. We keep the tilt that gives the most *useful* energy (capped at what the household uses), and on a tie we pick the cheaper one.

**How do you handle shade?** We simulate the sun across three seasons, build the real shadow of each tank, room and tall neighbour, and score every spot for how much light it gets. Panels go in the best-lit spots first. Distant buildings and trees are handled as a skyline horizon sent to PVGIS.

**Why only 6 panels on a big roof?** Because the system is sized to cover the household's electricity use, not to fill the roof. Extra power earns nothing under net metering, so extra panels would be wasted money.

**What if the roof outline from the map is wrong?** The app flags outlines that are too big or too small, and the user can drag corners or trace the roof themselves.

**What if the satellite picture is bad (like a rural area)?** The user can switch to a plain street map and mark the roof there. Stronger imagery just needs a different tile key in `.env.local`.

**How accurate are the money numbers?** They are ranges, labelled "estimate". The subsidy rule is exact for PM Surya Ghar. Costs come from typical per-kW prices in `reference.json`. Tariff is currently one flat rate per state, and real slab tariffs are future work.

**Does it work offline or when a service is down?** Each upstream call has retries, a cache and a clear error. The roof lookup has mirror servers and a manual fallback. Sunshine falls back to a regional estimate with a visible message. Finance falls back to a local calculation.

**Is the data private?** The address and roof are sent only to our own backend and the public map and sunshine services. Nothing is stored beyond a cache.

**What would you build next?** Reading a photo of the electricity bill, real tariff slabs per state, installer matching by pincode, and sharper imagery with a paid key.

import os
import threading
from typing import List, Optional

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mangum import Mangum
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

import finance
import geo

app = FastAPI(title="SuryaCheck API")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["*"])

DEFAULT_TILT = 20


# ---------- error shaping: always {error, hint} ----------
def err(status, error, hint):
    return JSONResponse(status_code=status, content={"error": error, "hint": hint})


@app.exception_handler(RequestValidationError)
async def on_validation(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    where = ".".join(str(x) for x in first.get("loc", []) if x != "body")
    return err(422, "invalid_input", f"Check the field '{where}': {first.get('msg', 'invalid value')}.")


@app.exception_handler(StarletteHTTPException)
async def on_http(_: Request, exc: StarletteHTTPException):
    hint = "That route does not exist." if exc.status_code == 404 else "Something went wrong with the request."
    return err(exc.status_code, str(exc.detail), hint)


@app.exception_handler(geo.UpstreamError)
async def on_upstream(_: Request, exc: geo.UpstreamError):
    return err(502, f"{exc.service}_unavailable",
               f"{exc.service} did not answer ({exc.message}). Please try again in a moment.")


@app.exception_handler(Exception)
async def on_any(_: Request, exc: Exception):
    return err(500, "server_error", "Something broke on our side. Please try again.")


# ---------- routes ----------
@app.get("/")
def root():
    return {"ok": True, "routes": ["/geocode", "/reverse", "/quick", "/building", "/yield", "/finance", "/reference", "/docs"]}


@app.get("/health")
def health():
    return {"ok": True, "cached": len(geo.cache)}


@app.get("/geocode")
def geocode(q: str = Query(..., min_length=2, max_length=200), country: str = "in"):
    return geo.geocode(q, country=country or None)


@app.get("/reverse")
def reverse(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    return geo.reverse(lat, lon)


@app.get("/quick")
def quick(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    return {"kwhPerKwp": geo.pvgis_yield(lat, lon, DEFAULT_TILT, 0), "tilt": DEFAULT_TILT, "source": "PVGIS"}


@app.get("/building")
def building(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    return geo.building(lat, lon)


class YieldReq(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    tilts: List[int] = Field(..., min_length=1, max_length=20)
    aspect: int = Field(0, ge=-180, le=180)       # 0 = south, sloped roofs can change it
    horizon: Optional[List[float]] = None          # 36 values, N clockwise


@app.post("/yield")
def yield_(r: YieldReq):
    if any(t < 0 or t > 90 for t in r.tilts):
        return err(422, "invalid_input", "Tilts must be between 0 and 90 degrees.")
    if r.horizon is not None and (len(r.horizon) != 36 or any(h < 0 or h > 90 for h in r.horizon)):
        return err(422, "invalid_input", "horizon needs exactly 36 numbers between 0 and 90 degrees.")
    return geo.pvgis_many(r.lat, r.lon, sorted(set(r.tilts)), r.aspect, r.horizon)


class FinanceReq(BaseModel):
    kwp: float = Field(..., gt=0, le=100)
    stateCode: str = Field("", max_length=3)
    monthlyBill: Optional[float] = Field(None, ge=0)   # rupees
    monthlyUnits: Optional[float] = Field(None, ge=0)  # alternative to bill
    residential: bool = True
    ownHouse: bool = True
    kwhPerKwp: Optional[float] = Field(None, gt=0)     # pass /yield or /quick result
    tariff: Optional[float] = Field(None, gt=0)        # rupees per kWh override


@app.post("/finance")
def finance_(r: FinanceReq):
    return finance.compute(r.kwp, r.stateCode, r.monthlyBill, r.residential, r.ownHouse,
                           r.kwhPerKwp, r.tariff, r.monthlyUnits)


@app.get("/reference")
def reference():
    """Panel specs, states and rules so the frontend never hard-codes them."""
    return finance.REF


# ---------- optional warm-up (set PREWARM=1 on the live host, not on Lambda) ----------
DEMO = [(28.6139, 77.2090), (28.4089, 77.3178), (19.0760, 72.8777), (12.9716, 77.5946)]


def _prewarm():
    for la, lo in DEMO:
        try:
            geo.pvgis_yield(la, lo, DEFAULT_TILT, 0)
        except Exception:
            pass


if os.environ.get("PREWARM") == "1":
    threading.Thread(target=_prewarm, daemon=True).start()

handler = Mangum(app)

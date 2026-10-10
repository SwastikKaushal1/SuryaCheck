"""Pure finance maths (no web framework imports, easy to unit test)."""
import json
import pathlib

REF = json.loads((pathlib.Path(__file__).parent / "reference.json").read_text(encoding="utf-8"))


def central_subsidy(kw: float) -> float:
    s = REF["subsidy"]
    v = (s["centralPerKwFirst2"] * min(kw, 2)
         + s["centralThirdKw"] * max(0.0, min(kw, 3) - 2))
    return min(v, s["centralCap"])


def state_top_up(kw: float, state) -> float:
    """State subsidy on top of the central one, e.g. Delhi: Rs 10,000/kW up to Rs 30,000."""
    s = state or {}
    return min(kw * (s.get("topUpPerKw") or 0), s.get("topUpCap") or 0)


def cost_range(kw: float):
    c = REF["cost"]
    extra = max(0.0, kw - 1)
    first = min(kw, 1)
    lo = first * c["firstKwRange"][0] + extra * c["extraKwRange"][0]
    hi = first * c["firstKwRange"][1] + extra * c["extraKwRange"][1]
    return [round(lo), round(hi)]


def compute(kwp, state_code, monthly_bill, residential, own_house=True,
            kwh_per_kwp=None, tariff=None, monthly_units=None):
    state = REF["states"].get((state_code or "").upper())
    d = REF["defaults"]
    tariff = tariff or (state or {}).get("avgTariff") or d["avgTariff"]
    yield_kwp = kwh_per_kwp or d["performanceKwhPerKwp"]

    production = kwp * yield_kwp
    if monthly_units:
        consumption = monthly_units * 12
    elif monthly_bill:
        consumption = monthly_bill / tariff * 12
    else:
        consumption = None
    offset = production if consumption is None else min(production, consumption)
    savings = offset * tariff

    eligible = bool(residential and own_house) or not REF["subsidy"]["residentialOnly"]
    central = central_subsidy(kwp) if eligible else 0
    top_up = state_top_up(kwp, state) if eligible else 0
    subsidy = central + top_up

    lo, hi = cost_range(kwp)
    net_lo, net_hi = max(0, lo - subsidy), max(0, hi - subsidy)
    payback = ([round(net_lo / savings, 1), round(net_hi / savings, 1)]
               if savings > 0 else None)
    notes = []
    if not eligible:
        notes.append("Central subsidy applies only to residential connections in your own house.")
    if state is None:
        notes.append("State not recognised, so a default tariff was used.")
    if consumption is not None and production > consumption:
        notes.append("System produces more than you use. Extra energy is not counted as savings.")
    return {
        "subsidy": round(subsidy),
        "subsidyBreakdown": {"central": round(central), "state": round(top_up), "eligible": eligible},
        "costRange": [lo, hi],
        "netCostRange": [round(net_lo), round(net_hi)],
        "savingsYear": round(savings),
        "paybackRange": payback,
        "co2": round(offset * REF["co2"]["kgPerKwh"]),  # kg per year
        "offsetKwhYear": round(offset),
        "tariffUsed": tariff,
        "notes": notes,
        "source": "estimate",
    }

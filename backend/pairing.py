"""Phone-to-laptop pairing for the skyline scan.

The laptop creates a session and shows a 4-digit code. The phone (which has the camera and compass)
sends each mark to that code; the laptop polls the session and draws the marks as they arrive.

Stored in memory with a 30-minute expiry: fine for one server (local dev, Docker). On AWS Lambda,
several copies of the backend may run, so a shared store (DynamoDB) would replace this class.
"""
import secrets
import threading
import time

TTL_S = 30 * 60
MAX_MARKS = 120  # a phone sweep sends one reading per 5° slice (49 from east to west)


class PairStore:
    def __init__(self):
        self._lock = threading.Lock()
        self._sessions: dict = {}

    def _sweep(self, now):
        for code in [c for c, s in self._sessions.items() if now - s["created"] > TTL_S]:
            del self._sessions[code]

    def create(self):
        """New session with an unused 4-digit code."""
        now = time.time()
        with self._lock:
            self._sweep(now)
            for _ in range(50):
                code = f"{secrets.randbelow(10000):04d}"
                if code not in self._sessions:
                    self._sessions[code] = {"created": now, "marks": [], "phoneSeen": None, "updated": now}
                    return {"code": code, "expiresIn": TTL_S}
        raise RuntimeError("no free pairing code")

    def _get(self, code):
        s = self._sessions.get(code)
        if not s or time.time() - s["created"] > TTL_S:
            return None
        return s

    def view(self, code):
        """What the laptop polls: the marks so far, and whether the phone has connected."""
        with self._lock:
            s = self._get(code)
            if not s:
                return None
            return {"marks": list(s["marks"]), "phoneConnected": s["phoneSeen"] is not None, "updated": s["updated"]}

    def hello(self, code):
        with self._lock:
            s = self._get(code)
            if not s:
                return False
            s["phoneSeen"] = s["updated"] = time.time()
            return True

    def add_mark(self, code, bearing, elevation):
        with self._lock:
            s = self._get(code)
            if not s:
                return None
            if len(s["marks"]) < MAX_MARKS:
                s["marks"].append({"bearing": round(bearing, 1), "elevation": round(elevation, 1)})
            s["phoneSeen"] = s["updated"] = time.time()
            return len(s["marks"])

    def set_marks(self, code, marks):
        """A phone sweep sends its whole traced skyline at once; it replaces what was there."""
        with self._lock:
            s = self._get(code)
            if not s:
                return None
            s["marks"] = [{"bearing": round(m["bearing"], 1), "elevation": round(m["elevation"], 1)} for m in marks[:MAX_MARKS]]
            s["phoneSeen"] = s["updated"] = time.time()
            return len(s["marks"])

    def undo(self, code):
        with self._lock:
            s = self._get(code)
            if not s:
                return None
            if s["marks"]:
                s["marks"].pop()
            s["updated"] = time.time()
            return len(s["marks"])


store = PairStore()

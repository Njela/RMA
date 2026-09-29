"""Auth and abuse-protection dependencies."""
import secrets
import time
from collections import defaultdict, deque

from fastapi import Header, HTTPException, Request

from ..config import get_settings

_hits: dict[str, deque] = defaultdict(deque)


def require_staff(x_api_key: str = Header(default="")) -> None:
    """Shared-secret staff auth for the demo. Replace with OIDC/SSO + per-user roles (see docs)."""
    if not secrets.compare_digest(x_api_key.encode(), get_settings().staff_api_key.encode()):
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")


def rate_limit(request: Request) -> None:
    """Per-IP sliding window, in-memory. Use Redis (or the API gateway) when running >1 replica."""
    ip = request.client.host if request.client else "unknown"
    q, now = _hits[ip], time.monotonic()
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= get_settings().public_rate_limit_per_minute:
        raise HTTPException(status_code=429, detail="Too many requests; try again in a minute")
    q.append(now)

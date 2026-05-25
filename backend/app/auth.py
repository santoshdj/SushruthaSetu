"""
JWT verification using Clerk's JWKS endpoint.

Provides two FastAPI dependencies:
  - get_current_user: verifies JWT, returns decoded claims. Requires any valid role.
  - require_admin: calls get_current_user, raises 403 if role != "admin".
"""

import time
import logging
from datetime import timedelta
from typing import Annotated

import jwt
from jwt import PyJWKClient
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

logger = logging.getLogger(__name__)

_jwks_cache: dict | None = None
_jwks_fetched_at: float = 0.0
_JWKS_TTL_SECONDS = 3600
_CLOCK_LEEWAY = timedelta(seconds=60)

bearer_scheme = HTTPBearer()

_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    """Return a cached PyJWKClient, refreshing after TTL."""
    global _jwks_client, _jwks_fetched_at
    now = time.monotonic()
    if _jwks_client is None or (now - _jwks_fetched_at) > _JWKS_TTL_SECONDS:
        logger.info("Refreshing Clerk JWKS client from %s", settings.clerk_jwks_url)
        _jwks_client = PyJWKClient(settings.clerk_jwks_url)
        _jwks_fetched_at = now
    return _jwks_client


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> dict:
    token = credentials.credentials
    try:
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=settings.clerk_issuer,
            leeway=_CLOCK_LEEWAY,
            options={"verify_aud": False},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {exc}")
    except Exception as exc:
        logger.error("JWT verification error: %s", exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")


def require_admin(
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    role = current_user.get("publicMetadata", {}).get("role", "clinician_user")
    if role != "clinician_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user

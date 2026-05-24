"""
FHIR R4 client. Single point of contact for all FHIR REST calls.
Reads FHIR_BASE_URL and FHIR_AUTH_TOKEN from settings.
"""

import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def _headers() -> dict:
    headers = {"Accept": "application/fhir+json", "Content-Type": "application/fhir+json"}
    if settings.fhir_auth_token:
        headers["Authorization"] = f"Bearer {settings.fhir_auth_token}"
    return headers


def _url(path: str) -> str:
    return f"{settings.fhir_base_url}/{path.lstrip('/')}"


def get_resource(resource_type: str, resource_id: str) -> dict:
    url = _url(f"{resource_type}/{resource_id}")
    response = httpx.get(url, headers=_headers(), timeout=15)
    response.raise_for_status()
    return response.json()


def search_resource(resource_type: str, params: dict) -> dict:
    url = _url(resource_type)
    response = httpx.get(url, headers=_headers(), params=params, timeout=15)
    response.raise_for_status()
    return response.json()


def create_resource(resource_type: str, body: dict) -> dict:
    url = _url(resource_type)
    response = httpx.post(url, headers=_headers(), json=body, timeout=15)
    response.raise_for_status()
    return response.json()


def update_resource(resource_type: str, resource_id: str, body: dict) -> dict:
    url = _url(f"{resource_type}/{resource_id}")
    response = httpx.put(url, headers=_headers(), json=body, timeout=15)
    response.raise_for_status()
    return response.json()


def fetch_bundle_page(url: str) -> dict:
    """Fetch a FHIR bundle page by absolute URL (used for pagination next links).

    HAPI FHIR behind a TLS-terminating proxy may return http:// pagination links
    even though the server only accepts https://.  Normalise here.
    """
    if url.startswith("http://"):
        url = "https://" + url[len("http://"):]
    response = httpx.get(url, headers=_headers(), timeout=15)
    response.raise_for_status()
    return response.json()

"""Tests for the application health endpoint."""

import asyncio

import httpx

from app.main import app


async def request_health_check() -> httpx.Response:
    """Call the ASGI app directly without opening a network port."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        return await client.get("/health")


def test_health_check_returns_ok() -> None:
    response = asyncio.run(request_health_check())

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

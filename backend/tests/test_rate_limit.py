"""Unit tests for the in-memory fixed-window chat limiter."""

from app.rate_limit import RateLimiter


def test_rate_limiter_allows_requests_after_its_window_expires() -> None:
    limiter = RateLimiter(max_requests=2, window_seconds=60)

    assert limiter.check("student", now=10) == 0
    assert limiter.check("student", now=20) == 0
    assert limiter.check("student", now=30) == 40
    assert limiter.check("student", now=70) == 0

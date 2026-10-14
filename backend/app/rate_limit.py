"""A small in-memory limiter suitable for local, single-process development."""

from collections import defaultdict, deque
from math import ceil
from threading import Lock
from time import monotonic

from fastapi import HTTPException, status

MAX_CHAT_REQUESTS = 20
WINDOW_SECONDS = 60


class RateLimiter:
    """Track request times by caller and return a retry delay when full."""

    def __init__(self, max_requests: int, window_seconds: int) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict[str, deque[float]] = defaultdict(deque)
        self.lock = Lock()

    def check(self, key: str, now: float | None = None) -> int:
        """Return 0 when allowed, otherwise the number of seconds to wait."""
        current_time = monotonic() if now is None else now
        with self.lock:
            request_times = self.requests[key]
            window_start = current_time - self.window_seconds
            while request_times and request_times[0] <= window_start:
                request_times.popleft()

            if len(request_times) >= self.max_requests:
                return max(1, ceil(self.window_seconds - (current_time - request_times[0])))

            request_times.append(current_time)
            return 0


chat_rate_limiter = RateLimiter(MAX_CHAT_REQUESTS, WINDOW_SECONDS)


def enforce_rate_limit(limiter: RateLimiter, caller_key: str) -> None:
    """Stop a request before it reaches Gemini when the limit is exhausted."""
    retry_after = limiter.check(caller_key)
    if retry_after:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many chat requests. Please wait a moment and try again.",
            headers={"Retry-After": str(retry_after)},
        )

import re
import time
from typing import Callable, TypeVar

from google.genai import errors

T = TypeVar("T")

MAX_ATTEMPTS = 5
# Rate limit and server-side errors are worth retrying; the rest are not.
RETRYABLE_CODES = {429, 500, 502, 503, 504}


def _retry_delay(error: errors.APIError, attempt: int) -> float:
    """Seconds to wait before retrying.

    On the free tier every text in an embedding batch counts toward a per-minute
    quota, and a 429 says exactly how long to wait ("Please retry in 16.6s"),
    so honor it. Otherwise back off 2, 4, 8... seconds.
    """
    match = re.search(r"retry in ([\d.]+)s", str(error), re.IGNORECASE)
    if match:
        return float(match.group(1)) + 1
    return 2 ** attempt


def with_retries(call: Callable[[], T]) -> T:
    """Runs a Gemini API call, retrying transient errors."""
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return call()
        except errors.APIError as e:
            if e.code not in RETRYABLE_CODES or attempt == MAX_ATTEMPTS:
                raise
            time.sleep(_retry_delay(e, attempt))
    raise AssertionError("unreachable")

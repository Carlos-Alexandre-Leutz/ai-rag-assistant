import re
import time

from fastapi import HTTPException
from google import genai
from google.genai import errors, types
from app.config import GEMINI_API_KEY

client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

EMBEDDING_MODEL = "gemini-embedding-001"
# Must match the vector(768) column of document_chunks.
EMBEDDING_DIMENSIONS = 768
# The Gemini API accepts up to 100 texts per embed_content call.
BATCH_SIZE = 100
MAX_ATTEMPTS = 5
# Rate limit and server-side errors are worth retrying; the rest are not.
RETRYABLE_CODES = {429, 500, 502, 503, 504}


def _retry_delay(error: errors.APIError, attempt: int) -> float:
    """Seconds to wait before retrying.

    On the free tier every text in a batch counts toward a per-minute quota, and
    a 429 says exactly how long to wait ("Please retry in 16.6s"), so honor it.
    """
    match = re.search(r"retry in ([\d.]+)s", str(error), re.IGNORECASE)
    if match:
        return float(match.group(1)) + 1
    return 2 ** attempt


def _embed_batch(texts: list[str]) -> list[list[float]]:
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            response = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=texts,
                config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIMENSIONS),
            )
            return [item.values for item in response.embeddings]
        except errors.APIError as e:
            if e.code not in RETRYABLE_CODES or attempt == MAX_ATTEMPTS:
                raise
            time.sleep(_retry_delay(e, attempt))


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Embeds many texts using as few API calls as possible, keeping order."""
    if not client:
        raise HTTPException(
            status_code=500, detail="GEMINI_API_KEY was not configured."
        )

    vectors: list[list[float]] = []
    try:
        for start in range(0, len(texts), BATCH_SIZE):
            vectors.extend(_embed_batch(texts[start:start + BATCH_SIZE]))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error generating embedding: {str(e)}"
        )
    return vectors


def generate_embedding(text: str) -> list[float]:
    return generate_embeddings([text])[0]

from fastapi import HTTPException
from google import genai
from google.genai import types
from app.services.retry import with_retries
from app.config import EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, GEMINI_API_KEY

client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# The Gemini API accepts up to 100 texts per embed_content call.
BATCH_SIZE = 100

def _embed_batch(texts: list[str]) -> list[list[float]]:
    response = with_retries(
        lambda: client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=texts,
            config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIMENSIONS),
        )
    )
    return [item.values for item in response.embeddings]


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

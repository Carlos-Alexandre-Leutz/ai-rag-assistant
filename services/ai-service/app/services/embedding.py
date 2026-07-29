from fastapi import HTTPException
from google import genai
from app.config import GEMINI_API_KEY

client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

def generate_embedding(text: str) -> list[float]:
    if not client:
        raise HTTPException(
            status_code=500, detail="GEMINI_API_KEY was not configured."
        )

    try:
        response = client.models.embed_content(
            model="gemini-embedding-001",
            contents=text,
        )

        if hasattr(response, "embedding") and hasattr(response.embedding, "values"):
            return response.embedding.values

        if hasattr(response, "embeddings") and len(response.embeddings) > 0:
            return response.embeddings[0].values

        raise Exception(f"Unexpected response structure: {response}")

    except Exception as e:
        try:
            response = client.models.embed_content(
                model="text-embedding-004",
                contents=text,
            )
            return response.embedding.values
        except Exception:
            pass

        raise HTTPException(
            status_code=500, detail=f"Error generating embedding: {str(e)}"
        )
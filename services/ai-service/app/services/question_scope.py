from google.genai import types

from app.config import GENERATION_MODEL
from app.services.retry import with_retries

CLASSIFIER_INSTRUCTION = """You classify a user's question about a document.
Reply GLOBAL if a good answer needs the whole document: a summary, an overall opinion, review or rating, the main themes or ideas, the structure, or the overall quality or tone.
Reply SPECIFIC if the question asks about a particular fact, detail, definition, number or section, or is a greeting or general-knowledge question.
Reply with one word only: GLOBAL or SPECIFIC."""


def is_global_question(client, message: str) -> bool:
    """True when the question is about the document as a whole. Any failure counts as no."""
    try:
        response = with_retries(
            lambda: client.models.generate_content(
                model=GENERATION_MODEL,
                contents=[f"QUESTION:\n{message}"],
                config=types.GenerateContentConfig(
                    system_instruction=CLASSIFIER_INSTRUCTION, temperature=0
                ),
            )
        )
        return (response.text or "").strip().upper().startswith("GLOBAL")
    except Exception:
        return False

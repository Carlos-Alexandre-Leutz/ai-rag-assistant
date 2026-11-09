import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Models. Changing EMBEDDING_MODEL needs every document to be uploaded again
# (vectors from different models are not comparable) and must keep producing
# EMBEDDING_DIMENSIONS values, the size of the document_chunks.embedding column.
GENERATION_MODEL = os.getenv("GENERATION_MODEL", "models/gemini-3.5-flash-lite")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001")
EMBEDDING_DIMENSIONS = 768


def _float_env(name: str, default: float | None) -> float | None:
    """Reads a float; an empty value turns the setting off (None)."""
    value = os.getenv(name)
    if value is None:
        return default
    return float(value) if value.strip() else None


# Retrieval: how many chunks go into the prompt, and the largest cosine
# distance (0 = identical, 2 = opposite) a chunk may have to count as relevant.
# Chunks farther than that are dropped, so an off-topic question gets no sources.
# 0.52 was tuned on the small evaluation document (see eval/): answerable
# questions stayed under 0.48 and off-topic ones were above 0.54. It cannot
# separate unanswerable questions about the same subject, so the model still
# decides "not found" in those cases. Set RETRIEVAL_MAX_DISTANCE= (empty) to
# disable, and re-run the evaluation after changing models or chunking.
RETRIEVAL_TOP_K = int(os.getenv("RETRIEVAL_TOP_K", "5"))

# Questions about the whole document (summary, rating, main themes) get the
# document text instead of the top-k chunks. Longer documents are sampled
# evenly so the prompt stays under this many characters (about 4 per token).
GLOBAL_CONTEXT_MAX_CHARS = int(os.getenv("GLOBAL_CONTEXT_MAX_CHARS", "300000"))
RETRIEVAL_MAX_DISTANCE = _float_env("RETRIEVAL_MAX_DISTANCE", 0.52)

from typing import List, Optional

from app.config import RETRIEVAL_MAX_DISTANCE, RETRIEVAL_TOP_K
from app.database import get_db_connection

EXCERPT_CHARS = 300


def retrieve_chunks(
    query_vector: List[float],
    user_id: str,
    document_id: Optional[str] = None,
    top_k: int = RETRIEVAL_TOP_K,
    max_distance: Optional[float] = RETRIEVAL_MAX_DISTANCE,
) -> List[dict]:
    """Closest chunks to the question by cosine distance, best first.

    With a document_id only that document is searched; otherwise all of the
    user's chunks (legacy guest flow). Chunks farther than max_distance are
    dropped, so an unrelated question returns nothing instead of noise.
    """
    scope = "document_id = %s AND user_id = %s" if document_id else "user_id = %s"
    scope_params = (document_id, user_id) if document_id else (user_id,)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT content, filename, page, (embedding <=> %s::vector) AS distance
                FROM document_chunks
                WHERE {scope}
                ORDER BY distance ASC
                LIMIT %s;
                """,
                (query_vector, *scope_params, top_k),
            )
            rows = cur.fetchall()

    chunks = [
        {"content": r[0], "filename": r[1], "page": r[2], "distance": float(r[3])}
        for r in rows
    ]
    if max_distance is not None:
        chunks = [c for c in chunks if c["distance"] <= max_distance]
    return chunks


def to_sources(chunks: List[dict]) -> List[dict]:
    """The part of each chunk that is shown to the user under the answer."""
    return [
        {
            "filename": c["filename"],
            "page": c["page"],
            "excerpt": c["content"][:EXCERPT_CHARS],
            "distance": round(c["distance"], 3),
        }
        for c in chunks
    ]

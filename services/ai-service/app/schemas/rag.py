from typing import List
from pydantic import BaseModel

class EmbeddingRequest(BaseModel):
    text: str

class EmbeddingResponse(BaseModel):
    embedding: List[float]

class ChunkResult(BaseModel):
    chunk_index: int
    content: str
    embedding: List[float]
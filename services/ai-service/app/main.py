import os
import tempfile
from io import BytesIO
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from pypdf import PdfReader
from google import genai
from google.genai import types
from app.config import GEMINI_API_KEY, GENERATION_MODEL
from app.schemas.rag import EmbeddingRequest, EmbeddingResponse
from app.services.text_splitter import split_pages_into_chunks
from app.services.embedding import generate_embedding, generate_embeddings
from app.services.prompt import SYSTEM_INSTRUCTION, build_user_prompt
from app.services.retry import with_retries
from app.services.retrieval import retrieve_chunks, to_sources
from app.database import get_db_connection


app = FastAPI(
    title="Saas Business Manager - AI Service",
    openapi_version="3.0.3"
)

client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

@app.get("/health")
async def health_check():
    return {"status": "online", "service": "ai-service"}

@app.post("/chat")
async def chat_endpoint(
    user_id: str = Form(...),
    message: str = Form(...),
    file: UploadFile = File(None),
    document_id: str = Form(None),
    history: str = Form(None),
):
    if not client:
        raise HTTPException(
            status_code=500, detail="GEMINI_API_KEY was not configured in the container."
        )

    temp_file_path = None
    try:
        query_vector = generate_embedding(message)
        chunks = retrieve_chunks(query_vector, user_id, document_id)
        user_prompt = build_user_prompt(message, chunks, history)

        contents_payload = []

        if file and file.filename:
            suffix = os.path.splitext(file.filename)[1]
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                content = await file.read()
                temp_file.write(content)
                temp_file_path = temp_file.name

            uploaded_gemini_file = client.files.upload(file=temp_file_path)
            contents_payload.append(uploaded_gemini_file)

        contents_payload.append(user_prompt)

        response = with_retries(
            lambda: client.models.generate_content(
                model=GENERATION_MODEL,
                contents=contents_payload,
                config=types.GenerateContentConfig(system_instruction=SYSTEM_INSTRUCTION),
            )
        )

        return {
            "user_id": user_id,
            "response": response.text,
            "filename": file.filename if (file and file.filename) else None,
            "context_used": bool(chunks),
            "sources": to_sources(chunks),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"AI processing error: {str(e)}"
        )

    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@app.post("/rag/embedding", response_model=EmbeddingResponse)
async def create_single_embedding(payload: EmbeddingRequest):
    try:
        vector = generate_embedding(payload.text)
        return {"embedding": vector}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating embedding: {str(e)}")


# Plain "def" on purpose: ingestion is long and blocking, so FastAPI runs it in
# a worker thread instead of freezing the event loop (and every /chat with it).
@app.post("/rag/process-pdf")
def process_pdf_for_rag(
    user_id: str = Form(...),
    file: UploadFile = File(...),
    document_id: str = Form(None),
):
    contents = file.file.read()

    # A real PDF starts with "%PDF-" near the beginning; the name is not enough.
    if not file.filename.lower().endswith(".pdf") or b"%PDF-" not in contents[:1024]:
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid PDF.")

    try:
        pdf_reader = PdfReader(BytesIO(contents))
        pages = [(page.extract_text() or "") for page in pdf_reader.pages]
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not read this PDF. It may be corrupted or password protected.",
        )

    if not any(text.strip() for text in pages):
        raise HTTPException(
            status_code=400,
            detail="No readable text found. This looks like a scanned PDF (images only), which is not supported yet.",
        )

    try:
        # (page_number, text) pairs; a chunk never crosses a page break.
        chunks = split_pages_into_chunks(pages)
        if not chunks:
            raise HTTPException(status_code=400, detail="No readable text found in this PDF.")

        # Embed everything first, so a failure leaves nothing half-saved.
        vectors = generate_embeddings([text for _, text in chunks])

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO document_chunks (user_id, document_id, filename, page, content, embedding)
                    VALUES (%s, %s, %s, %s, %s, %s);
                    """,
                    [
                        (user_id, document_id, file.filename, page, text, vector)
                        for (page, text), vector in zip(chunks, vectors)
                    ],
                )
            conn.commit()

        return {
            "message": "PDF successfully processed and saved!",
            "filename": file.filename,
            "user_id": user_id,
            "document_id": document_id,
            "total_chunks": len(chunks),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG pipeline error: {str(e)}")


# http://localhost:8000/ai/models
@app.get("/ai/models")
async def list_available_models():
    if not client:
        raise HTTPException(status_code=500, detail="Gemini API Key não configurada.")

    try:
        models_list = []
        for m in client.models.list():
            if "generateContent" in m.supported_actions:
                models_list.append({
                    "name": m.name,
                    "display_name": m.display_name,
                    "description": m.description
                })
        return {"total": len(models_list), "models": models_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

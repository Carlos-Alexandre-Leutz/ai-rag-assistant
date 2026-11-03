import json
import os
import tempfile
from io import BytesIO
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from pypdf import PdfReader
from google import genai
from app.config import GEMINI_API_KEY
from app.schemas.rag import EmbeddingRequest, EmbeddingResponse
from app.services.text_splitter import split_text_into_chunks
from app.services.embedding import generate_embedding, generate_embeddings
from app.database import get_db_connection


app = FastAPI(
    title="Saas Business Manager - AI Service",
    openapi_version="3.0.3"
)

client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

MAX_HISTORY_MESSAGES = 10


def format_history(raw_history: str | None) -> str:
    """Turns the JSON list [{role, content}] sent by the BFF into prompt text."""
    if not raw_history:
        return ""
    try:
        items = json.loads(raw_history)
    except ValueError:
        return ""
    if not isinstance(items, list):
        return ""

    lines = []
    for item in items[-MAX_HISTORY_MESSAGES:]:
        if not isinstance(item, dict) or not item.get("content"):
            continue
        speaker = "Assistant" if str(item.get("role", "")).lower() in ("ai", "assistant") else "User"
        lines.append(f"{speaker}: {item['content']}")

    if not lines:
        return ""
    return "\n=== PREVIOUS MESSAGES IN THIS CHAT ===\n" + "\n".join(lines) + "\n========================\n"


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

        retrieved_context = ""
        top_k = 3

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if document_id:
                    # Chat tied to a single document: search only its chunks.
                    cur.execute(
                        """
                        SELECT content, filename, (embedding <=> %s::vector) AS distance
                        FROM document_chunks
                        WHERE document_id = %s AND user_id = %s
                        ORDER BY distance ASC
                        LIMIT %s;
                        """,
                        (query_vector, document_id, user_id, top_k),
                    )
                else:
                    cur.execute(
                        """
                        SELECT content, filename, (embedding <=> %s::vector) AS distance
                        FROM document_chunks
                        WHERE user_id = %s
                        ORDER BY distance ASC
                        LIMIT %s;
                        """,
                        (query_vector, user_id, top_k),
                    )
                rows = cur.fetchall()

                if rows:
                    context_blocks = [
                        f"--- Trecho do arquivo {row[1]} ---\n{row[0]}"
                        for row in rows
                    ]
                    retrieved_context = "\n\n".join(context_blocks)

        history_block = format_history(history)

        augmented_prompt = f"""
You are Vermilion, a specialized AI assistant.
Always reply in the exact same language that the user used to ask the QUESTION.

=== YOUR IDENTITY & BEHAVIOR ===
- Your name is Vermilion.
- If the user asks what you can do or how you work, explain that your main purpose is to analyze and answer questions based on their documents (RAG), but you can also assist with broader questions or topics referencing web/external knowledge when asked.
- Your primary source of truth for document-related queries is the CONTEXT below.
- If the user asks a question specifically about external sources, web references, or general knowledge, you are allowed to answer beyond the provided context.
- For specific document queries: if the answer cannot be found or deduced from the provided CONTEXT (and the user isn't asking for external information), politely inform the user in their language that the information was not found in their documents.

=== DOCUMENT CONTEXT ===
{retrieved_context if retrieved_context else "No relevant document context found."}
========================
{history_block}
USER QUESTION:
{message}
"""
        contents_payload = []

        if file and file.filename:
            suffix = os.path.splitext(file.filename)[1]
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                content = await file.read()
                temp_file.write(content)
                temp_file_path = temp_file.name

            uploaded_gemini_file = client.files.upload(file=temp_file_path)
            contents_payload.append(uploaded_gemini_file)

        contents_payload.append(augmented_prompt)

        response = client.models.generate_content(
            model="models/gemini-3.5-flash-lite",
            contents=contents_payload,
        )

        return {
            "user_id": user_id,
            "response": response.text,
            "filename": file.filename if (file and file.filename) else None,
            "context_used": bool(retrieved_context),
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
        full_text = ""
        for page in pdf_reader.pages:
            extracted = page.extract_text()
            if extracted:
                full_text += extracted + "\n"
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not read this PDF. It may be corrupted or password protected.",
        )

    if not full_text.strip():
        raise HTTPException(
            status_code=400,
            detail="No readable text found. This looks like a scanned PDF (images only), which is not supported yet.",
        )

    try:
        chunks = split_text_into_chunks(full_text)

        # Embed everything first, so a failure leaves nothing half-saved.
        vectors = generate_embeddings(chunks)

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO document_chunks (user_id, document_id, filename, content, embedding)
                    VALUES (%s, %s, %s, %s, %s);
                    """,
                    [
                        (user_id, document_id, file.filename, chunk, vector)
                        for chunk, vector in zip(chunks, vectors)
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

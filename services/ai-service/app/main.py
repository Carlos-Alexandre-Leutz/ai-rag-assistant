import os
import tempfile
from io import BytesIO
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from pypdf import PdfReader
from google import genai
from app.config import GEMINI_API_KEY
from app.schemas.rag import EmbeddingRequest, EmbeddingResponse
from app.services.text_splitter import split_text_into_chunks
from app.services.embedding import generate_embedding
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
    file: UploadFile = File(None)
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


@app.post("/rag/process-pdf")
async def process_pdf_for_rag(
    user_id: str = Form(...),
    file: UploadFile = File(...)
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="The uploaded file must be a PDF..")

    try:
        contents = await file.read()
        pdf_reader = PdfReader(BytesIO(contents))

        full_text = ""
        for page in pdf_reader.pages:
            extracted = page.extract_text()
            if extracted:
                full_text += extracted + "\n"

        if not full_text.strip():
            raise HTTPException(status_code=400, detail="It was not possible to extract readable text from the PDF.")

        raw_chunks = split_text_into_chunks(full_text)

        saved_chunks = []
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                for index, chunk in enumerate(raw_chunks):
                    vector = generate_embedding(chunk)

                    cur.execute(
                        """
                        INSERT INTO document_chunks (user_id, filename, content, embedding)
                        VALUES (%s, %s, %s, %s)
                        RETURNING id;
                        """,
                        (user_id, file.filename, chunk, vector)
                    )
                    chunk_id = cur.fetchone()[0]

                    saved_chunks.append({
                        "id": str(chunk_id),
                        "chunk_index": index,
                        "content": chunk
                    })

            conn.commit()

        return {
            "message": "PDF successfully processed and saved!",
            "filename": file.filename,
            "user_id": user_id,
            "total_chunks": len(saved_chunks),
            "chunks": saved_chunks
        }

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

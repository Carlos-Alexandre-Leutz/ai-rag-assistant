-- Page of the PDF each chunk came from (NULL for chunks created before this).
ALTER TABLE document_chunks ADD COLUMN page INTEGER;

-- Sources shown under an AI answer.
ALTER TABLE "Message" ADD COLUMN "sources" JSONB;

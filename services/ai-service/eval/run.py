"""Evaluates retrieval and answers on a fixed document with known questions.

Run inside the ai-service container (needs GEMINI_API_KEY and DATABASE_URL):

    python -m eval.run                      # full run: retrieval + generated answers
    python -m eval.run --retrieval-only     # no LLM calls: page hit rate and distances per top-k
    python -m eval.run --from-id 26         # full run starting at question 26
    python -m eval.run --from-id 24 --to-id 24   # a single question

Settings come from the environment, so variants are compared by overriding them:

    RETRIEVAL_TOP_K=3 RETRIEVAL_MAX_DISTANCE=0.5 python -m eval.run

The handbook is stored under a throwaway user id and removed at the end.
"""
import argparse
import json
import re
import statistics
import time
import uuid
from pathlib import Path

from fastapi.testclient import TestClient

from app.database import get_db_connection
from app.main import app
from app.services.embedding import generate_embedding
from app.services.retrieval import retrieve_chunks
from eval.make_pdf import handbook_pdf

QUESTIONS = json.loads((Path(__file__).parent / "questions.json").read_text(encoding="utf-8"))

NOT_FOUND = re.compile(
    r"not (found|mentioned|specified|available|contain|include)|no (information|mention)|"
    r"cannot find|can't find|couldn't find|could not find|"
    r"(does not|doesn't|do not|don't) (mention|contain|specify|say|include|provide|offer)|"
    r"isn't (mentioned|specified|listed)|is not (mentioned|specified|listed)|"
    r"n[ãa]o (foi |est[áa] |consta|encontr)",
    re.IGNORECASE,
)


def ingest(client: TestClient, user_id: str) -> int:
    response = client.post(
        "/rag/process-pdf",
        data={"user_id": user_id},
        files={"file": ("handbook.pdf", handbook_pdf(), "application/pdf")},
    )
    response.raise_for_status()
    return response.json()["total_chunks"]


def cleanup(user_id: str) -> None:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM document_chunks WHERE user_id = %s", (user_id,))
        conn.commit()


def ask(client: TestClient, user_id: str, question: str) -> dict:
    for attempt in range(1, 5):
        response = client.post("/chat", data={"user_id": user_id, "message": question})
        if response.status_code == 200:
            return response.json()
        if not any(t in response.text for t in ("429", "503", "RESOURCE_EXHAUSTED", "UNAVAILABLE")):
            break
        time.sleep(20 * attempt)  # the service already retries; this covers longer outages
    raise RuntimeError(response.text[:300])


def judge(q: dict, answer: str) -> bool:
    kind = q["kind"]
    if kind in ("answer", "generic", "general"):
        return any(token.lower() in answer.lower() for token in q["expect_any"])
    if kind == "unanswerable":
        return bool(NOT_FOUND.search(answer))
    if kind == "offtopic":
        return bool(answer.strip())
    if kind == "injection":
        return answer.strip().strip(".!\"'").upper() != q["forbidden_exact"]
    return False


def retrieval_only(user_id: str) -> None:
    ks = [1, 3, 5, 8]
    ranks, top_by_kind = [], {}
    print(f"{'id':>3} {'kind':<12} {'top dist':>8}  rank of expected page")
    for q in QUESTIONS:
        vector = generate_embedding(q["question"])
        chunks = retrieve_chunks(vector, user_id, top_k=max(ks), max_distance=None)
        top = chunks[0]["distance"] if chunks else float("nan")
        top_by_kind.setdefault(q["kind"], []).append(top)
        rank = None
        if q["kind"] == "answer":
            rank = next((i for i, c in enumerate(chunks, 1) if c["page"] == q["page"]), None)
            ranks.append(rank)
        print(f"{q['id']:>3} {q['kind']:<12} {top:>8.3f}  {rank if q['kind'] == 'answer' else ''}")

    print("\nPage hit rate for answerable questions:")
    for k in ks:
        hits = sum(1 for r in ranks if r is not None and r <= k)
        print(f"  top-{k}: {hits}/{len(ranks)}")
    print("\nBest-chunk distance by kind (lower = closer):")
    for kind, values in top_by_kind.items():
        print(f"  {kind:<12} min {min(values):.3f}  mean {statistics.mean(values):.3f}  max {max(values):.3f}")


def full_run(client: TestClient, user_id: str, first_id: int, last_id: int) -> None:
    results = {}
    for q in QUESTIONS:
        if not first_id <= q["id"] <= last_id:
            continue
        data = ask(client, user_id, q["question"])
        answer = data["response"]
        sources = data["sources"]
        ok = judge(q, answer)
        hit = None
        if q["kind"] == "answer":
            hit = any(s["page"] == q["page"] for s in sources)
        results.setdefault(q["kind"], []).append((ok, hit))
        top = f"{sources[0]['distance']:.3f}" if sources else "  -  "
        flag = "PASS" if ok else "FAIL"
        print(f"{q['id']:>3} {q['kind']:<12} {flag}  sources={len(sources)} top={top}  {answer[:90]!r}")
        time.sleep(2)

    print("\nSummary:")
    for kind, items in results.items():
        passed = sum(1 for ok, _ in items if ok)
        line = f"  {kind:<12} {passed}/{len(items)} answered correctly"
        if kind == "answer":
            hits = sum(1 for _, hit in items if hit)
            line += f", source page found in {hits}/{len(items)}"
        print(line)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--retrieval-only", action="store_true")
    parser.add_argument("--from-id", type=int, default=1)
    parser.add_argument("--to-id", type=int, default=len(QUESTIONS))
    args = parser.parse_args()

    user_id = f"eval-{uuid.uuid4()}"
    client = TestClient(app)
    try:
        print(f"Ingested {ingest(client, user_id)} chunks.\n")
        if args.retrieval_only:
            retrieval_only(user_id)
        else:
            full_run(client, user_id, args.from_id, args.to_id)
    finally:
        cleanup(user_id)


if __name__ == "__main__":
    main()

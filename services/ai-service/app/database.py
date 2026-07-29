import os
import psycopg
from pgvector.psycopg import register_vector

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL It is not configured in the environment.")

    conn = psycopg.connect(DATABASE_URL)
    register_vector(conn)
    return conn
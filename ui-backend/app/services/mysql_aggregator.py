import os
import pymysql

def _get_conn():
    return pymysql.connect(
        host=os.environ.get("MYSQL_HOST", "mysql"),
        user=os.environ.get("MYSQL_USER", "emulator"),
        password=os.environ.get("MYSQL_PASSWORD", "emulator_pass"),
        database=os.environ.get("MYSQL_DATABASE", "pipeline_emulator"),
        cursorclass=pymysql.cursors.DictCursor,
    )

def get_stage_counts() -> dict:
    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            queries = {
                "bronze_raw": "SELECT COUNT(*) as cnt FROM bronze_document_hub",
                "silver_structured": "SELECT COUNT(*) as cnt FROM silver_structured_documents WHERE is_latest = 1",
                "silver_masked": "SELECT COUNT(*) as cnt FROM silver_masked_documents",
                "gold_chunked": "SELECT COUNT(*) as cnt FROM gold_chunked_documents",
                "gold_enriched": "SELECT COUNT(*) as cnt FROM gold_enriched_documents",
                "gold_staged": "SELECT COUNT(*) as cnt FROM gold_staged_documents",
            }
            result = {}
            for stage_id, query in queries.items():
                cur.execute(query)
                row = cur.fetchone()
                cnt = row["cnt"] if row else 0
                result[stage_id] = {"docs_in": cnt, "docs_out": cnt}
        conn.close()
        return result
    except Exception:
        return {}

def get_pii_stats() -> dict:
    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) as masked FROM silver_masked_documents WHERE is_masked = 1")
            masked = (cur.fetchone() or {}).get("masked", 0)
            cur.execute("SELECT COUNT(*) as total FROM silver_masked_documents")
            total = (cur.fetchone() or {}).get("total", 0)
        conn.close()
        return {"masked": masked, "unmasked": total - masked, "total": total}
    except Exception:
        return {"masked": 0, "unmasked": 0, "total": 0}

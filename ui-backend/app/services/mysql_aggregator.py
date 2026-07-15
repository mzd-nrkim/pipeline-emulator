import json
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

def get_gold_staged_documents() -> list:
    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, title, priority, security_class, vehicle_model, is_masked, stage_reached"
                " FROM gold_staged_documents"
            )
            rows = cur.fetchall()
        conn.close()
        result = []
        for row in rows:
            result.append({
                "id": str(row.get("id", "")),
                "title": row.get("title", ""),
                "priority": row.get("priority", "C"),
                "security": row.get("security_class", "INTERNAL"),
                "vehicleModel": row.get("vehicle_model", "NX01"),
                "masked": bool(row.get("is_masked", False)),
                "stageReached": row.get("stage_reached", "gold_staged"),
            })
        return result
    except Exception:
        return []

def get_pii_stats() -> dict:
    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) as masked FROM silver_masked_documents WHERE is_masked = 1")
            masked = (cur.fetchone() or {}).get("masked", 0)
            cur.execute("SELECT COUNT(*) as total FROM silver_masked_documents")
            total = (cur.fetchone() or {}).get("total", 0)
            cur.execute(
                "SELECT pii_pattern_types FROM silver_masked_documents"
                " WHERE is_masked = 1 AND pii_pattern_types IS NOT NULL"
            )
            rows = cur.fetchall()
        conn.close()
        type_breakdown: dict[str, int] = {}
        for row in rows:
            pt = row.get("pii_pattern_types")
            if isinstance(pt, str):
                try:
                    pt = json.loads(pt)
                except Exception:
                    continue
            if isinstance(pt, dict):
                for k, v in pt.items():
                    type_breakdown[k] = type_breakdown.get(k, 0) + (int(v) if v else 0)
        return {
            "masked": masked,
            "unmasked": total - masked,
            "total": total,
            "typeBreakdown": type_breakdown,
        }
    except Exception:
        return {"masked": 0, "unmasked": 0, "total": 0, "typeBreakdown": {}}

import json
import logging
import os
import pymysql

logger = logging.getLogger(__name__)

LABEL_MAP = {
    "KR_PHONE": "전화번호",
    "KR_RRN": "주민등록번호",
    "EMAIL": "이메일",
    "NAME": "이름",
    "ADDRESS": "주소",
}

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
                """
                SELECT
                    b.document_hub_hash_key AS doc_id,
                    b.source_primary_key,
                    MIN(gsd.pclrty_class) AS pclrty_class,
                    MIN(gsd.es_field_info) AS es_field_info,
                    MIN(smd.is_masked) AS is_masked,
                    MIN(smd.pii_pattern_types) AS pii_pattern_types,
                    MIN(ss.structured_content) AS structured_content
                FROM gold_staged_documents gsd
                JOIN gold_enriched_documents ged ON gsd.enriched_id = ged.enriched_id
                JOIN gold_chunked_documents gcd ON ged.chunk_id = gcd.chunk_id
                JOIN silver_masked_documents smd ON gcd.masked_doc_id = smd.masked_doc_id
                JOIN silver_structured_documents ss ON smd.structured_doc_id = ss.structured_doc_id
                JOIN bronze_document_hub b ON ss.document_hub_hash_key = b.document_hub_hash_key
                GROUP BY b.document_hub_hash_key, b.source_primary_key
                """
            )
            rows = cur.fetchall()
        conn.close()
        result = []
        for row in rows:
            source_primary_key = row.get("source_primary_key", "")
            doc_id = row.get("doc_id", "")

            # es_field_info JSON 파싱 → vehicleModel 추출
            vehicle_model = "NX01"
            es_field_info_raw = row.get("es_field_info")
            if es_field_info_raw:
                try:
                    es_info = json.loads(es_field_info_raw) if isinstance(es_field_info_raw, str) else es_field_info_raw
                    if isinstance(es_info, dict):
                        vehicle_model = (
                            es_info.get("vehicleModel")
                            or es_info.get("vehicle_model")
                            or "NX01"
                        )
                except (json.JSONDecodeError, ValueError):
                    pass

            # structured_content JSON 파싱 → title 추출
            title = None
            structured_content_raw = row.get("structured_content")
            if structured_content_raw:
                try:
                    sc = json.loads(structured_content_raw) if isinstance(structured_content_raw, str) else structured_content_raw
                    if isinstance(sc, dict):
                        data = sc.get("data", {})
                        if isinstance(data, dict):
                            title = data.get("title")
                except (json.JSONDecodeError, ValueError):
                    pass
            if not title:
                title = source_primary_key if source_primary_key else doc_id

            # pii_pattern_types JSON 파싱 → piiCounts 리스트 변환 (is_masked=TRUE인 문서만)
            pii_counts = []
            pii_raw = row.get("pii_pattern_types")
            if row.get("is_masked") and pii_raw:
                try:
                    pt = json.loads(pii_raw) if isinstance(pii_raw, str) else pii_raw
                    if isinstance(pt, dict):
                        for k, v in pt.items():
                            pii_counts.append({
                                "type": k,
                                "label": LABEL_MAP.get(k, k),
                                "count": int(v) if v else 0,
                            })
                except (json.JSONDecodeError, ValueError):
                    pass

            result.append({
                "id": str(source_primary_key or doc_id),
                "title": title,
                "priority": "C",  # TODO: Map from source_cft_problem_history.pilot_problem_importnrate_typecd via CDC pipeline
                "security": row.get("pclrty_class", "INTERNAL"),
                "vehicleModel": vehicle_model,
                "masked": bool(row.get("is_masked", False)),
                "stageReached": "gold_staged",
                "piiCounts": pii_counts,
            })
        return result
    except Exception as e:
        logger.error("get_gold_staged_documents failed: %s", e)
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

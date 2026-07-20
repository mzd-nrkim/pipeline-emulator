import os
from typing import Optional

ES_HOST = os.environ.get("ES_HOST", "localhost")
ES_PORT = int(os.environ.get("ES_PORT", "9200"))
ES_INDEX = "pdis_cft"


def _get_es():
    from elasticsearch import Elasticsearch
    return Elasticsearch(f"http://{ES_HOST}:{ES_PORT}")


def search(query: str, mode: str = "keyword", size: int = 10) -> list[dict]:
    """BM25(keyword) / kNN(semantic) / RRF(hybrid) 검색.

    반환: list of {staged_id, chunk_content, summary, category, pclrty_class,
                   score, keyword_score, semantic_score, metadata_tags}
    """
    if not query:
        return []
    try:
        es = _get_es()
        if not es.indices.exists(index=ES_INDEX):
            return []

        if mode == "keyword":
            resp = es.search(
                index=ES_INDEX,
                body={
                    "size": size,
                    "query": {"multi_match": {"query": query, "fields": ["chunk_content^2", "summary", "keywords"]}},
                },
            )
            hits = resp["hits"]["hits"]
            return [
                {
                    "staged_id": h["_source"].get("staged_id"),
                    "chunk_content": h["_source"].get("chunk_content", ""),
                    "summary": h["_source"].get("summary", ""),
                    "category": h["_source"].get("category", ""),
                    "pclrty_class": h["_source"].get("pclrty_class", ""),
                    "metadata_tags": h["_source"].get("metadata_tags", {}),
                    "score": h["_score"],
                    "keyword_score": h["_score"],
                    "semantic_score": None,
                }
                for h in hits
            ]

        elif mode == "semantic":
            # kNN — dense_vector 필드 필요 (SEARCH=hybrid 색인 전제)
            try:
                from sentence_transformers import SentenceTransformer
                model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
                query_vector = model.encode(query, normalize_embeddings=True).tolist()
            except Exception:
                return []
            resp = es.search(
                index=ES_INDEX,
                body={
                    "size": size,
                    "knn": {"field": "content_vector", "query_vector": query_vector, "k": size, "num_candidates": size * 2},
                },
            )
            hits = resp["hits"]["hits"]
            return [
                {
                    "staged_id": h["_source"].get("staged_id"),
                    "chunk_content": h["_source"].get("chunk_content", ""),
                    "summary": h["_source"].get("summary", ""),
                    "category": h["_source"].get("category", ""),
                    "pclrty_class": h["_source"].get("pclrty_class", ""),
                    "metadata_tags": h["_source"].get("metadata_tags", {}),
                    "score": h["_score"],
                    "keyword_score": None,
                    "semantic_score": h["_score"],
                }
                for h in hits
            ]

        else:  # hybrid — RRF
            # BM25 파트
            bm25_resp = es.search(
                index=ES_INDEX,
                body={
                    "size": size,
                    "query": {"multi_match": {"query": query, "fields": ["chunk_content^2", "summary", "keywords"]}},
                },
            )
            # kNN 파트
            try:
                from sentence_transformers import SentenceTransformer
                model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
                query_vector = model.encode(query, normalize_embeddings=True).tolist()
                knn_resp = es.search(
                    index=ES_INDEX,
                    body={"size": size, "knn": {"field": "content_vector", "query_vector": query_vector, "k": size, "num_candidates": size * 2}},
                )
                knn_hits = {h["_id"]: h["_score"] for h in knn_resp["hits"]["hits"]}
            except Exception:
                knn_hits = {}

            # RRF 결합
            rrf_k = 60
            bm25_ranks = {h["_id"]: i + 1 for i, h in enumerate(bm25_resp["hits"]["hits"])}
            knn_ranks = {doc_id: i + 1 for i, doc_id in enumerate(knn_hits.keys())}
            all_ids = set(bm25_ranks) | set(knn_ranks)

            scored = []
            for doc_id in all_ids:
                bm25_rank = bm25_ranks.get(doc_id, size + 1)
                knn_rank = knn_ranks.get(doc_id, size + 1)
                rrf_score = 1.0 / (rrf_k + bm25_rank) + 1.0 / (rrf_k + knn_rank)
                # 원본 hit 찾기
                hit = next((h for h in bm25_resp["hits"]["hits"] if h["_id"] == doc_id), None)
                if hit is None:
                    continue
                scored.append({
                    "staged_id": hit["_source"].get("staged_id"),
                    "chunk_content": hit["_source"].get("chunk_content", ""),
                    "summary": hit["_source"].get("summary", ""),
                    "category": hit["_source"].get("category", ""),
                    "pclrty_class": hit["_source"].get("pclrty_class", ""),
                    "metadata_tags": hit["_source"].get("metadata_tags", {}),
                    "score": rrf_score,
                    "keyword_score": bm25_resp["hits"]["hits"][bm25_rank - 1]["_score"] if doc_id in bm25_ranks else 0.0,
                    "semantic_score": knn_hits.get(doc_id, 0.0),
                })
            scored.sort(key=lambda x: x["score"], reverse=True)
            return scored[:size]

    except Exception:
        return []

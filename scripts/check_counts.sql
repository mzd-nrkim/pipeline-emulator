-- 단계별 문서 수 집계 (Week 2 ui-backend /stages 라우터가 흡수할 포맷)
SELECT 'Bronze Hub' as stage, COUNT(*) as doc_count FROM pipeline_emulator.bronze_document_hub
UNION ALL
SELECT 'Bronze Events', COUNT(*) FROM pipeline_emulator.bronze_rdb_events
UNION ALL
SELECT 'Silver Structured', COUNT(*) FROM pipeline_emulator.silver_structured_documents WHERE is_latest = TRUE
UNION ALL
SELECT 'Silver Masked', COUNT(*) FROM pipeline_emulator.silver_masked_documents
UNION ALL
SELECT 'Gold Chunked', COUNT(*) FROM pipeline_emulator.gold_chunked_documents
UNION ALL
SELECT 'Gold Enriched', COUNT(*) FROM pipeline_emulator.gold_enriched_documents
UNION ALL
SELECT 'Gold Staged', COUNT(*) FROM pipeline_emulator.gold_staged_documents;

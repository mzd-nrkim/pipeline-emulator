-- Pipeline Emulator 초기 스키마
-- FK 순서 엄수: hub → events → link/sat → silver → gold

-- 1. 파이프라인 데이터 DB
CREATE DATABASE IF NOT EXISTS pipeline_emulator;
USE pipeline_emulator;

-- 1-1. Bronze 레이어

CREATE TABLE IF NOT EXISTS bronze_document_hub (
  document_hub_hash_key CHAR(64) PRIMARY KEY COMMENT 'SHA256(PDIS||{pk})',
  source_name VARCHAR(50) NOT NULL DEFAULT 'pdis',
  source_primary_key VARCHAR(200) NOT NULL,
  record_load_dts DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bronze_rdb_events (
  bronze_rdb_event_id INT AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  batch_id VARCHAR(50) NOT NULL,
  s3_path VARCHAR(500) NOT NULL,
  record_count INT DEFAULT 0,
  change_operation VARCHAR(20) NOT NULL DEFAULT 'snapshot',
  event_dts DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bronze_document_rdb_link (
  rdb_link_hash_key CHAR(64) PRIMARY KEY,
  document_hub_hash_key CHAR(64) NOT NULL,
  bronze_rdb_event_id INT NOT NULL,
  FOREIGN KEY (document_hub_hash_key) REFERENCES bronze_document_hub(document_hub_hash_key),
  FOREIGN KEY (bronze_rdb_event_id) REFERENCES bronze_rdb_events(bronze_rdb_event_id)
);

CREATE TABLE IF NOT EXISTS bronze_document_assembly_sat (
  assembly_sat_hash_key CHAR(64) PRIMARY KEY,
  document_hub_hash_key CHAR(64) NOT NULL,
  document_type VARCHAR(50) DEFAULT 'cft_problem',
  assembly_status VARCHAR(20) DEFAULT 'assembled',
  retry_count INT DEFAULT 0,
  record_load_dts DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_hub_hash_key) REFERENCES bronze_document_hub(document_hub_hash_key)
);

-- 1-2. Silver 레이어

CREATE TABLE IF NOT EXISTS silver_structured_documents (
  structured_doc_id INT AUTO_INCREMENT PRIMARY KEY,
  document_hub_hash_key CHAR(64) NOT NULL,
  structured_content LONGTEXT NOT NULL,
  content_format VARCHAR(20) DEFAULT 'json',
  structuring_method VARCHAR(50) DEFAULT 'rdb_json_convert',
  is_latest BOOLEAN DEFAULT TRUE,
  content_hash CHAR(32),
  valid_from DATETIME DEFAULT CURRENT_TIMESTAMP,
  valid_to DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_hub_hash_key) REFERENCES bronze_document_hub(document_hub_hash_key)
);

CREATE TABLE IF NOT EXISTS silver_masked_documents (
  masked_doc_id INT AUTO_INCREMENT PRIMARY KEY,
  structured_doc_id INT NOT NULL,
  masked_content LONGTEXT,
  pii_detection_count INT DEFAULT 0,
  pii_pattern_types JSON,
  is_masked BOOLEAN DEFAULT FALSE,
  masking_method VARCHAR(20) DEFAULT 'regex',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (structured_doc_id) REFERENCES silver_structured_documents(structured_doc_id)
);

-- 1-3. Gold 레이어

CREATE TABLE IF NOT EXISTS gold_chunked_documents (
  chunk_id INT AUTO_INCREMENT PRIMARY KEY,
  masked_doc_id INT NOT NULL,
  chunk_content TEXT NOT NULL,
  chunk_sequence INT NOT NULL DEFAULT 0,
  chunk_metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (masked_doc_id) REFERENCES silver_masked_documents(masked_doc_id)
);

CREATE TABLE IF NOT EXISTS gold_enriched_documents (
  enriched_id INT AUTO_INCREMENT PRIMARY KEY,
  chunk_id INT NOT NULL,
  keywords JSON,
  entities JSON,
  summary TEXT,
  category VARCHAR(100),
  enrichment_metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chunk_id) REFERENCES gold_chunked_documents(chunk_id)
);

CREATE TABLE IF NOT EXISTS gold_staged_documents (
  staged_id INT AUTO_INCREMENT PRIMARY KEY,
  enriched_id INT NOT NULL,
  es_field_info JSON,
  role_ids JSON,
  metadata_tags JSON,
  pclrty_class VARCHAR(20),
  indexing_status VARCHAR(20) DEFAULT 'staged',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (enriched_id) REFERENCES gold_enriched_documents(enriched_id)
);

-- 2. Airflow 전용 DB (파이프라인 데이터와 분리)
CREATE DATABASE IF NOT EXISTS pipeline_emulator_airflow;

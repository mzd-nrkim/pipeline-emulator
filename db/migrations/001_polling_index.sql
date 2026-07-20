-- Polling CDC 성능: upd_dts 인덱스 추가 (멱등 — IF NOT EXISTS는 MySQL 미지원, 중복 실행 시 ERROR 1061 무시)
CREATE INDEX idx_source_cft_upd_dts
    ON source_cft_problem_history (upd_dts);

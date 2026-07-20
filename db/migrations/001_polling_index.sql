-- Polling CDC 성능: upd_dts 인덱스 추가 (멱등)
CREATE INDEX IF NOT EXISTS idx_source_cft_upd_dts
    ON source_cft_problem_history (upd_dts);

-- 실행 계정: root (binlog 활성 환경에서 CREATE TRIGGER에 SUPER 권한 필요)
-- emulator 계정으로 실행 시 ERROR 1419 발생 → docker exec ... mysql -uroot -p<root_pass>
-- F2b Trigger CDC: bronze_source_change_log 테이블 + AFTER 트리거 (MySQL, 멱등)
-- 참조: 06_news_cdc_pipeline_plan.md §5.3~5.4 plpgsql → MySQL 이식

-- 1. 변경 로그 테이블 (멱등)
CREATE TABLE IF NOT EXISTS bronze_source_change_log (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    operation     ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    pilot_problem_no  VARCHAR(50)  NOT NULL,
    reform_numseq     INT UNSIGNED NOT NULL,
    changed_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    processed     BOOL         NOT NULL DEFAULT FALSE,
    INDEX idx_change_log_proc_changed (processed, changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. AFTER INSERT 트리거 (멱등: DROP IF EXISTS 선행)
DROP TRIGGER IF EXISTS trg_source_cft_after_insert;
DELIMITER $$
CREATE TRIGGER trg_source_cft_after_insert
AFTER INSERT ON source_cft_problem_history
FOR EACH ROW
BEGIN
    INSERT INTO bronze_source_change_log (operation, pilot_problem_no, reform_numseq)
    VALUES ('INSERT', NEW.pilot_problem_no, NEW.reform_numseq);
END$$
DELIMITER ;

-- 3. AFTER UPDATE 트리거 (멱등: DROP IF EXISTS 선행)
DROP TRIGGER IF EXISTS trg_source_cft_after_update;
DELIMITER $$
CREATE TRIGGER trg_source_cft_after_update
AFTER UPDATE ON source_cft_problem_history
FOR EACH ROW
BEGIN
    INSERT INTO bronze_source_change_log (operation, pilot_problem_no, reform_numseq)
    VALUES ('UPDATE', NEW.pilot_problem_no, NEW.reform_numseq);
END$$
DELIMITER ;

-- 4. AFTER DELETE 트리거 (멱등: DROP IF EXISTS 선행)
DROP TRIGGER IF EXISTS trg_source_cft_after_delete;
DELIMITER $$
CREATE TRIGGER trg_source_cft_after_delete
AFTER DELETE ON source_cft_problem_history
FOR EACH ROW
BEGIN
    INSERT INTO bronze_source_change_log (operation, pilot_problem_no, reform_numseq)
    VALUES ('DELETE', OLD.pilot_problem_no, OLD.reform_numseq);
END$$
DELIMITER ;

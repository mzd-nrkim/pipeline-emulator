# db/migrations — 실행 가이드

## 파일 목록 및 실행 순서

| 순서 | 파일 | 실행 계정 | 설명 |
|------|------|-----------|------|
| 001 | `001_polling_index.sql` | emulator | `source_cft_problem_history` 인덱스 생성 (`idx_source_cft_upd_dts`) |
| 002 | `002_trigger_cdc.sql` | root | CDC 트리거 생성 (`bronze_source_change_log` 테이블 + AFTER 트리거 3개, SUPER 권한 필요) |

## 계정별 실행 기준

| 계정 | 대상 DDL | 비고 |
|------|----------|------|
| `emulator` | CREATE TABLE, CREATE INDEX, DML | SUPER 권한 불필요 |
| `root` | CREATE TRIGGER, CREATE FUNCTION, CREATE PROCEDURE | binlog 활성 환경에서 SUPER 권한 필요 — `emulator`로 실행 시 ERROR 1419 발생 |

> binlog(`log_bin`) 활성 상태의 MySQL에서 TRIGGER를 생성하려면 `SUPER` 또는 `TRIGGER` + `SUPER` 권한이 필요하다.  
> `emulator` 계정은 일반 DDL/DML 권한만 보유하므로 트리거·함수·프로시저 생성은 반드시 `root`로 실행한다.

## 멱등성 처리

| 구문 | 동작 |
|------|------|
| `CREATE TABLE IF NOT EXISTS` | 테이블 이미 존재하면 무시 — 중복 실행 안전 |
| `CREATE INDEX` (IF NOT EXISTS 미지원) | 중복 실행 시 **ERROR 1061** 발생 → 오류를 무시하거나 먼저 `DROP INDEX <name> ON <table>` 실행 후 재생성 |
| `DROP TRIGGER IF EXISTS` | 트리거 재생성 전 안전 삭제 — 존재하지 않아도 오류 없음 |

### INDEX 중복 처리 예시

```sql
-- 안전 재생성 패턴
DROP INDEX idx_source_cft_upd_dts ON source_cft_problem_history;
CREATE INDEX idx_source_cft_upd_dts ON source_cft_problem_history (upd_dts);
```

또는 `mysql` 클라이언트 호출 시 `--force` 옵션으로 ERROR 1061을 무시할 수 있다.

## 실행 예시 (post-gate)

```bash
# 001: emulator 계정으로 실행 (DDL/INDEX)
docker exec pipeline-emulator-mysql-1 \
  mysql -uemulator -pemulator_pass pipeline_emulator \
  < db/migrations/001_polling_index.sql

# 002: root 계정으로 실행 (TRIGGER — SUPER 권한 필요)
docker exec pipeline-emulator-mysql-1 \
  mysql -uroot -p<root_pass> pipeline_emulator \
  < db/migrations/002_trigger_cdc.sql
```

> `<root_pass>` 는 실행 환경의 MySQL root 비밀번호로 대체한다.  
> `pipeline-emulator-mysql-1` 은 `docker compose ps` 로 확인한 컨테이너명과 일치해야 한다.

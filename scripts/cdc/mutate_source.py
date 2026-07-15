"""
소스 테이블 변경 주입 CLI — CDC 데모/e2e용.

source_cft_problem_history 에 INSERT/UPDATE/DELETE를 주입하여
Debezium이 binlog를 통해 Valkey Stream으로 변경 이벤트를 발행하도록 한다.

환경변수:
  MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, MYSQL_PORT

사용법:
  python -m scripts.cdc.mutate_source --op insert [--problem-no AP100000001] [--seq 1]
  python -m scripts.cdc.mutate_source --op update --problem-no AP100000001 --seq 1
  python -m scripts.cdc.mutate_source --op delete --problem-no AP100000001 --seq 1
"""

import argparse
import hashlib
import logging
import sys
from datetime import datetime

from scripts.ingest import get_mysql_connection

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

SOURCE_TABLE = "source_cft_problem_history"


# ── 순수 헬퍼 ─────────────────────────────────────────────────────────────────

def _row_hash(pilot_problem_no: str, reform_numseq: int) -> str:
    """MD5(pilot_problem_no||reform_numseq) — generate.py 계약과 동일."""
    return hashlib.md5(f"{pilot_problem_no}||{reform_numseq}".encode("utf-8")).hexdigest()


def _default_row(pilot_problem_no: str, reform_numseq: int) -> dict:
    """INSERT 시 사용할 기본 레코드 (스키마 계약: source_cft_problem_history)."""
    now = datetime.now().isoformat(sep=" ", timespec="seconds")
    return {
        "pilot_problem_no": pilot_problem_no,
        "reform_numseq": reform_numseq,
        "pilot_project_no": f"PROJ-CDC-{pilot_problem_no[-4:]}",
        "pilot_vhclmodel_no": "NX01",
        "pilot_step_typecd": "D",
        "pilot_problem_importnrate_typecd": "A",
        "problem_content": f"[CDC-INSERT] {pilot_problem_no} rev{reform_numseq} 문제 내용",
        "cntmeasure_content": f"[CDC-INSERT] 대책 내용 — {now}",
        "display_content": f"[CDC-INSERT] 표시용 내용 — {now}",
        "dept_name": "CDC 테스트팀",
        "reg_empno": "EMP0001",
        "upd_empno": "EMP0001",
        "reg_dts": now,
        "upd_dts": now,
        "row_hash": _row_hash(pilot_problem_no, reform_numseq),
    }


# ── DB 작업 함수 ──────────────────────────────────────────────────────────────

def do_insert(conn, pilot_problem_no: str, reform_numseq: int) -> None:
    """source_cft_problem_history 에 새 행을 INSERT (IGNORE 중복)."""
    row = _default_row(pilot_problem_no, reform_numseq)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT IGNORE INTO source_cft_problem_history (
              pilot_problem_no, reform_numseq, pilot_project_no,
              pilot_vhclmodel_no, pilot_step_typecd, pilot_problem_importnrate_typecd,
              problem_content, cntmeasure_content, display_content,
              dept_name, reg_empno, upd_empno, reg_dts, upd_dts, row_hash
            ) VALUES (
              %(pilot_problem_no)s, %(reform_numseq)s, %(pilot_project_no)s,
              %(pilot_vhclmodel_no)s, %(pilot_step_typecd)s, %(pilot_problem_importnrate_typecd)s,
              %(problem_content)s, %(cntmeasure_content)s, %(display_content)s,
              %(dept_name)s, %(reg_empno)s, %(upd_empno)s, %(reg_dts)s, %(upd_dts)s, %(row_hash)s
            )
            """,
            row,
        )
    conn.commit()
    logger.info("INSERT: %s rev%d", pilot_problem_no, reform_numseq)


def do_update(conn, pilot_problem_no: str, reform_numseq: int) -> None:
    """problem_content·upd_dts 를 타임스탬프로 갱신 (UPDATE 이벤트 트리거)."""
    now = datetime.now().isoformat(sep=" ", timespec="seconds")
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE source_cft_problem_history
            SET problem_content = %s, upd_dts = %s, upd_empno = 'EMP-CDC'
            WHERE pilot_problem_no = %s AND reform_numseq = %s
            """,
            (
                f"[CDC-UPDATE] {pilot_problem_no} rev{reform_numseq} — {now}",
                now,
                pilot_problem_no,
                reform_numseq,
            ),
        )
        affected = cur.rowcount
    conn.commit()
    if affected == 0:
        logger.warning("UPDATE: 대상 행 없음 (%s rev%d) — 먼저 insert를 실행하세요", pilot_problem_no, reform_numseq)
    else:
        logger.info("UPDATE: %s rev%d (affected=%d)", pilot_problem_no, reform_numseq, affected)


def do_delete(conn, pilot_problem_no: str, reform_numseq: int) -> None:
    """해당 행을 DELETE (DELETE 이벤트 트리거)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM source_cft_problem_history
            WHERE pilot_problem_no = %s AND reform_numseq = %s
            """,
            (pilot_problem_no, reform_numseq),
        )
        affected = cur.rowcount
    conn.commit()
    if affected == 0:
        logger.warning("DELETE: 대상 행 없음 (%s rev%d)", pilot_problem_no, reform_numseq)
    else:
        logger.info("DELETE: %s rev%d (affected=%d)", pilot_problem_no, reform_numseq, affected)


# ── CLI 진입점 ────────────────────────────────────────────────────────────────

def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="source_cft_problem_history 변경 주입 — CDC 데모/e2e용"
    )
    parser.add_argument(
        "--op",
        required=True,
        choices=["insert", "update", "delete"],
        help="주입할 변경 타입",
    )
    parser.add_argument(
        "--problem-no",
        default="AP100000001",
        help="pilot_problem_no 값 (기본: AP100000001)",
    )
    parser.add_argument(
        "--seq",
        type=int,
        default=1,
        help="reform_numseq 값 (기본: 1)",
    )
    return parser.parse_args(argv)


def run(op: str, pilot_problem_no: str, reform_numseq: int) -> None:
    """CLI·프로그래매틱 공용 진입점 (테스트에서 직접 호출 가능)."""
    conn = get_mysql_connection()
    try:
        if op == "insert":
            do_insert(conn, pilot_problem_no, reform_numseq)
        elif op == "update":
            do_update(conn, pilot_problem_no, reform_numseq)
        elif op == "delete":
            do_delete(conn, pilot_problem_no, reform_numseq)
        else:
            raise ValueError(f"Unsupported op: {op}")
    finally:
        conn.close()


def main(argv=None) -> None:
    args = parse_args(argv)
    run(args.op, args.problem_no, args.seq)


if __name__ == "__main__":
    main()

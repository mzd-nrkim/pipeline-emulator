"""
샘플 데이터 생성 스크립트
- faker(ko_KR) + SEED=42 고정 (결정적 생성)
- CFT 문제 5건: 문제당 부품 3개 × 단계 2개 (fan-out)
- 중요도 S/A/B/C/D/E 6분류를 5건에 S·A·B·C·D 순으로 배분
- PII 심기: 문제 3건은 패턴형 PII 4건 이상(is_masked=TRUE), 2건은 미만(is_masked=FALSE)
"""

import hashlib
from datetime import date, datetime

from faker import Faker

SEED = 42
fake = Faker("ko_KR")
Faker.seed(SEED)

# 중요도 코드 — 5건에 S·A·B·C·D 순으로 배분
IMPORTANCE_CODES = ["S", "A", "B", "C", "D"]

# pclrty_class 매핑 (gold_5_field_mapping 계약과 동일)
PCLRTY_MAP = {
    "S": "RESTRICTED",
    "A": "INTERNAL",
    "B": "INTERNAL",
    "C": "INTERNAL",
    "D": "PUBLIC",
    "E": "PUBLIC",
}

# 차종 코드 — 다양성 확보
VEHICLE_MODELS = ["NX01", "NX02", "NX03"]

# 단계 코드
STEP_TYPES = ["D", "P"]  # Design, Production

# 패턴형 PII 예시 (정규식 Layer1이 탐지 가능한 형태)
PII_HIGH = [
    "담당자 연락처: 010-1234-5678",
    "주민번호: 901231-1234567",
    "이메일: test@hmc.example",
    "계좌번호: 110-123456-78",
]

PII_LOW = [
    "담당자 연락처: 010-9999-8888",
]


def _md5(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def generate_records(num_problems: int = 5) -> list[dict]:
    """
    CFT 문제 이력 레코드 생성.
    Returns list of dict (원본 PDIS cft_problem_history_b 스키마 기준).
    """
    records = []
    for i in range(num_problems):
        pilot_problem_no = f"AP{str(10000 + i).zfill(8)}"
        reform_numseq = 1
        importance = IMPORTANCE_CODES[i % len(IMPORTANCE_CODES)]
        vehicle_model = VEHICLE_MODELS[i % len(VEHICLE_MODELS)]

        # PII 심기 — 문제 0,1,2(인덱스)는 패턴형 PII 4건 이상, 3·4는 미만
        if i < 3:
            pii_block = "\n".join(PII_HIGH)
            pii_label = "HIGH"
        else:
            pii_block = "\n".join(PII_LOW)
            pii_label = "LOW"

        problem_content = (
            f"[{importance}등급] {vehicle_model} 차종 CFT 문제 {i+1}호.\n"
            f"현상: {fake.sentence(nb_words=8)}\n"
            f"원인: {fake.sentence(nb_words=6)}\n"
            f"{pii_block}"
        )
        cntmeasure_content = (
            f"대책: {fake.sentence(nb_words=10)}\n"
            f"조치 완료 예정: {fake.date_between(start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))}"
        )

        # 부품 리스트 (3개)
        parts = []
        for p_idx in range(3):
            parts.append({
                "part_no": f"PART-{pilot_problem_no}-{p_idx+1:02d}",
                "part_name": fake.word() + " 부품",
                "manfproc_typecd": ["WELD", "ASSY", "PAINT"][p_idx % 3],
            })

        # 단계 리스트 (2개)
        steps = []
        for s_idx, step_cd in enumerate(STEP_TYPES):
            steps.append({
                "pilot_step_typecd": step_cd,
                "step_name": {"D": "설계", "P": "양산"}[step_cd],
                "step_date": str(fake.date_between(start_date=date(2025, 1, 1), end_date=date(2026, 6, 30))),
            })

        row_hash = _md5(f"{pilot_problem_no}||{reform_numseq}")

        record = {
            "pilot_problem_no": pilot_problem_no,
            "reform_numseq": reform_numseq,
            "pilot_project_no": f"PROJ-{str(2000 + i).zfill(6)}",
            "pilot_vhclmodel_no": vehicle_model,
            "pilot_step_typecd": STEP_TYPES[0],
            "problem_content": problem_content,
            "cntmeasure_content": cntmeasure_content,
            "pilot_problem_importnrate_typecd": importance,
            "pclrty_class": PCLRTY_MAP[importance],
            "reg_dts": str(fake.date_between(start_date=date(2025, 1, 1), end_date=date(2026, 1, 1))),
            "upd_dts": str(datetime.now().date()),
            "reg_empno": fake.bothify(text="EMP####"),
            "upd_empno": fake.bothify(text="EMP####"),
            "dept_name": fake.company() + " 품질팀",
            # display 필드 — PII가 여기에 들어감
            "display_content": (
                f"담당부서: {fake.company()} 품질팀\n"
                f"담당자: {fake.name()}\n"
                f"주소: {fake.address()}\n"
                f"{pii_block}"
            ),
            # fan-out 관계 데이터
            "parts": parts,
            "steps": steps,
            # 메타
            "row_hash": row_hash,
            "_pii_label": pii_label,  # 업스트림 표시용 (Parquet 컬럼에 포함되지 않음)
        }
        records.append(record)

    return records


def generate_flat_records(num_problems: int = 5) -> list[dict]:
    """
    Parquet 직렬화용 평탄화 레코드.
    parts/steps를 JSON 문자열로 변환, _pii_label 제거.
    """
    import json

    records = generate_records(num_problems)
    flat = []
    for rec in records:
        r = dict(rec)
        r["parts"] = json.dumps(r["parts"], ensure_ascii=False)
        r["steps"] = json.dumps(r["steps"], ensure_ascii=False)
        r.pop("_pii_label", None)
        flat.append(r)
    return flat


if __name__ == "__main__":
    import json

    records = generate_records()
    for rec in records:
        print(
            f"[{rec['pilot_problem_no']}] importance={rec['pilot_problem_importnrate_typecd']} "
            f"pclrty={rec['pclrty_class']} pii={rec['_pii_label']} hash={rec['row_hash'][:8]}..."
        )

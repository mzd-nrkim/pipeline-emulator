"""
NiFi ExecuteStreamCommand 브릿지 — row_hash 산출 후 stdout JSON 출력.
NiFi가 stdin으로 원천 레코드(JSON)를 전달 → hash 산출 → stdout으로 FlowFile Content 반환.

환경 의존성: boto3, pyarrow (ingest.py 전이 의존)
실행 컨텍스트: NiFi 컨테이너 내 Python 3
"""

import hashlib
import json
import sys

# scripts.hash_utils를 직접 import 불가한 경우를 대비한 폴백 구현
try:
    sys.path.insert(0, "/opt/pipeline-emulator")
    from scripts.hash_utils import compute_hub_hash
except ImportError:
    def compute_hub_hash(source_name: str, primary_key: str) -> str:
        return hashlib.sha256(f"{source_name}||{primary_key}".encode("utf-8")).hexdigest()


def main() -> None:
    raw = sys.stdin.buffer.read()
    try:
        record = json.loads(raw)
    except json.JSONDecodeError:
        json.dump({"error": "invalid JSON input"}, sys.stdout)
        sys.exit(1)

    source_name = record.get("source_name", "unknown")
    primary_key = str(record.get("primary_key", ""))
    row_hash = compute_hub_hash(source_name, primary_key)

    output = {**record, "row_hash": row_hash}
    sys.stdout.write(json.dumps(output))


if __name__ == "__main__":
    main()

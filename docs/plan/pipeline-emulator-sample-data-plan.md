# 파이프라인 에뮬레이터 — 샘플(더미) 데이터 계획서

> 작성일: 2026-07-14 / 상태: 초안 (Week 1 착수 전 확정 목표)
> 관련: [pipeline-emulator-decisions.md](../pipeline-emulator-decisions.md) · [lodestar-reuse-assessment.md](../lodestar-reuse-assessment.md)
> 근거: 원본 `hyundaimotor-lllm` PDIS 파이프라인 스키마 조사 (2026-07-14)

---

## 1. 목표

에뮬레이터가 **Bronze→Silver→Gold**를 end-to-end로 흘릴 수 있도록, **원본 PDIS 스키마와 호환되는 더미 데이터셋**을 정의·생성한다. 현대차 실데이터는 사용 불가하므로, 스키마 구조·필드명·관계는 원본을 따르되 값은 합성한다.

**완료 기준**: 더미 데이터를 투입하면 6개 DAG(Bronze→Silver1→Silver2→Gold청킹→엔리치→필드매핑)가 전부 통과하고, 각 단계 MySQL 테이블에 예상 행 수가 적재되며, MVP PII 마스킹(정규식)이 실제로 동작한다.

---

## 2. 원본 데이터 성격 (조사 요약)

- **원천**: PostgreSQL RDB(PDIS 시스템), 스키마 `pdis`/`pctr`. **PDF가 아니라 정형 RDB 레코드**다.
- **문서 단위**: CFT(Cross-Functional Team) 문제이력 레코드. 핵심 테이블 `cft_problem_history_b`(57컬럼), `_l`(14컬럼), `cft_problem_part_history_r`(41컬럼) 등.
- **키 구조**: 복합 PK. 예 `(pilot_problem_no, reform_numseq)` → `"AP00005928||1"`.
- **관계**: 문제 → 부품 → 차종 → 프로젝트로 fan-out(1:N).
- **수집 방식**: Full Dump(1일~1주 1회). 원본 테이블 전 컬럼 + `row_hash`(MD5) → Parquet.

> 우리 에뮬레이터는 원천 RDB를 별도로 두지 않고, **더미 Parquet를 직접 생성해 SeaweedFS Bronze에 투입**한다(원본의 NiFi/Debezium 수집을 Python 스크립트로 대체하는 결정과 일치).

---

## 3. 설계 원칙

1. **스키마 호환 우선**: 필드명·타입·JSON 구조는 원본 DDL을 그대로 따른다(아래 §4). 값만 합성.
2. **소규모 · fan-out 유지**: 데모에 충분한 최소 볼륨(§5)으로 하되, 1:N 관계는 살려 "단계마다 문서 수가 늘어나는" 그림을 보여준다.
3. **PII 시연 보장**: 마스킹 단계가 실제로 무언가를 가리도록, 더미에 **한국형 PII를 의도적으로 심는다**(§6). 원본 마스킹 정책(PII 4건 이상 → 마스킹)을 만족하는 레코드와 미만 레코드를 섞는다. 단 **MVP 마스킹은 정규식(Presidio Layer 1)만** 수행하므로, 4건 임계는 **패턴형 PII(전화·주민번호·이메일·계좌)만으로 충족**되게 심는다. 이름·주소 등 비패턴 PII는 **Presidio 2-Layer(다음 계획)** 활성 시에만 마스킹된다.
4. **엔리치먼트는 규칙 기반**: 원본 Gold 엔리치먼트는 LLM/고객사 API지만, 에뮬레이터는 Mock API(FastAPI 규칙 기반)로 대체하므로 키워드·요약·개체명을 결정적 규칙으로 생성한다.
5. **ES 범위 밖**: Gold 5 `gold_staged_documents`까지 만들되 `indexing_status`는 `staged`에서 멈춘다(실제 인덱싱 없음). `es_field_info` payload는 "검색계 인수 준비 완료" 증빙으로 채운다.

---

## 4. 단계별 스키마 & 생성 규격

각 단계 목표 테이블·핵심 컬럼(원본 DDL 기준). 상세 DDL 위치는 §참고.

### 4.1 Bronze 입력 (SeaweedFS Parquet)
- 경로 규칙: `bronze/pdis/pcqlty/rdb/cft_problem_history_b/{batch_id}/part-00000.parquet`
- 컬럼: 원본 테이블 전 컬럼 + `row_hash`(MD5)
- 최소 필수: `pilot_problem_no`, `reform_numseq`, `pilot_project_no`, `pilot_vhclmodel_no`, `pilot_step_typecd`, `problem_content`, `cntmeasure_content`, 날짜 필드들, `pilot_problem_importnrate_typecd`(중요도 S/A/B/C/D/E)

### 4.2 Bronze MySQL (메타 등록)
| 테이블 | 행 수 | 핵심 컬럼 |
|--------|------|----------|
| `bronze_document_hub` | 문제 수 N | `document_hub_hash_key`(SHA256(`PDIS||{pk}`)), `source_name`="pdis", `source_primary_key` |
| `bronze_rdb_events` | 배치 수 | `bronze_rdb_event_id`, `table_name`, `batch_id`, `s3_path`, `record_count`, `change_operation`="snapshot" |
| `bronze_document_rdb_link` | N | `rdb_link_hash_key`(SHA256(`{hub}||{event}`)), `document_hub_hash_key` |
| `bronze_document_assembly_sat` | N | `document_type`, `assembly_status`, `retry_count` |

### 4.3 Silver 1 — 구조화 `silver_structured_documents`
- Hub당 1행. `structured_content`(LONGTEXT, JSON) = 원본 표준 스키마:
  - `source`,`doc_type`="cft_problem",`schema_version`
  - `data.prob`(문제 본문·중요도·감사점수), `data.step[]`, `data.part[]`, `data.vehiclefuse`
  - `display`(부서명·담당자명 등 **PII가 여기 들어간다** — 이름 필드 다수)
- `content_format`="json", `structuring_method`="rdb_json_convert", SCD Type2(`is_latest`,`content_hash`,`valid_from/to`)

### 4.4 Silver 2 — PII 마스킹 `silver_masked_documents`
- 입력 `structured_content` → **정규식 마스킹(MVP = Presidio Layer 1)** → `masked_content` *(풀 Presidio 2-Layer는 다음 계획)*
- `pii_detection_count`, `pii_pattern_types`(JSON, 타입별 개수), `is_masked`(count≥4), `masking_method`="regex"(MVP) / "presidio_2layer"(다음 계획)

### 4.5 Gold 3 — 청킹 `gold_chunked_documents`
- masked당 N청크. `chunk_content`, `chunk_sequence`(0-based), `chunk_metadata`(토큰수·오프셋)
- 에뮬레이터: Mock API가 규칙 기반으로 문단 분할(예: 문제/대책/부품 섹션별)

### 4.6 Gold 4 — 엔리치먼트 `gold_enriched_documents`
- chunked와 1:1. `keywords`(JSON 배열), `entities`(NER 배열), `summary`(TEXT), `category`
- `enrichment_metadata`: `bzdvsn_typecd`,`vhclmodel_no`,`step_typecd`,`manfproc_typecd`,`importnrate_typecd`
- 에뮬레이터: 규칙 기반(예: 키워드=명사 빈도 상위, 요약=첫 문장, 개체명=심어둔 이름/차종)

### 4.7 Gold 5 — 필드 매핑 `gold_staged_documents`
- enriched와 1:1. `es_field_info`(JSON: `target_index`,`routing`), `role_ids`(JSON), `metadata_tags`(5차원), `pclrty_class`(중요도→보안분류: S→RESTRICTED / A~C→INTERNAL / D~E→PUBLIC)
- `indexing_status`="staged" 에서 정지(ES 미구현)

---

## 5. 볼륨 설계 (소규모 기준)

데모용 최소셋 — 필요 시 배수로 스케일.

| 단위 | 수량 | 근거 |
|------|------|------|
| CFT 문제 | 5건 | Hub 5행 |
| 문제당 부품 | 3개 | `data.part[]` fan-out |
| 문제당 단계 | 2개 | `data.step[]` |
| 청크/문서 | 3개 | Gold 3에서 5→15행으로 확대 |

**단계별 예상 행 수**: Bronze hub 5 → Silver 5 → Silver 마스킹 5 → Gold 청킹 15 → 엔리치 15 → staged 15. "단계마다 카운트가 변하는" 모니터링 그림 확보.

- **중요도 분포**: S/A/B/C/D/E를 골고루 섞어 `pclrty_class` 3분류가 모두 나오게 한다.
- **차종 코드**: NX01 등 2~3종으로 `role_ids`/`metadata_tags` 다양성 확보.

---

## 6. PII 시드 (마스킹 시연 필수)

`display`/본문에 한국형 PII를 의도적으로 심는다. 원본 Presidio 엔티티 기준:

| 엔티티 | 예시 값 | 마스킹 결과 | MVP 처리 |
|--------|---------|------------|----------|
| KR_NAME | 담당자명 "김철수" | "김*" | ⏳ 다음 계획(Layer2 NER) |
| KR_PHONE | "010-1234-5678" | "010****1234" | ✅ 정규식 |
| KR_RRN(주민번호) | "900101-1234567"(합성·체크섬 유의) | "[주민번호 마스킹]" | ✅ 정규식 |
| KR_EMAIL | "user@hmc.example" | "[이메일 마스킹]" | ✅ 정규식 |
| KR_BANK_ACCOUNT | "123-456789-12" | "[계좌번호 마스킹]" | ✅ 정규식 |
| KR_ADDRESS | "서울시 강남구" | "[주소 마스킹]" | ⏳ 다음 계획(Layer2 NER) |

- **마스킹/비마스킹 레코드 혼합**: PII 4건 이상(is_masked=TRUE) 문서와 4건 미만 문서를 각각 만들어 정책 분기를 시연. MVP에선 **정규식으로 잡히는 4종(전화·주민번호·이메일·계좌)만으로 4건 임계를 채운다**(이름·주소는 데이터에 심되 Presidio 2-Layer 활성 시 마스킹).
- **합성 PII 주의**: 실제 인물·실주민번호와 충돌하지 않도록 명백히 가짜 값 사용.

---

## 7. 생성 방식

- **언어/도구**: Python 스크립트. `faker`(ko_KR) + 고정 시드로 결정적 생성(재현성).
- **산출물**:
  1. 원천 더미 → Parquet(pyarrow) → SeaweedFS 업로드(boto3, S3 호환)
  2. (선택) 시드용 SQL/JSON — 각 단계 기대값 검증 fixture
- **위치**: `scripts/sample_data/`(에뮬레이터 repo, 추후 확정)
- **파라미터화**: 문제 수·청크 수·PII 밀도를 인자로 받아 볼륨 조절.

---

## 8. 검증 기준

- [ ] Parquet 스키마가 원본 컬럼명과 일치(필수 컬럼 누락 0)
- [ ] Bronze 등록 후 `bronze_document_hub` 행 수 = 투입 문제 수
- [ ] Silver 1 `structured_content` JSON이 표준 스키마(data+display) 파싱 통과
- [ ] Silver 2에서 심어둔 **패턴형 PII(전화·주민번호·이메일·계좌)**가 정규식으로 마스킹되고 `pii_pattern_types` 카운트가 기대치와 일치 (이름·주소는 Presidio 2-Layer 활성 시 검증)
- [ ] is_masked=TRUE/FALSE 레코드가 모두 존재(정책 분기 시연)
- [ ] Gold 청킹 후 행 수 = 문서 수 × 청크 수
- [ ] Gold 5 `pclrty_class` 3분류(RESTRICTED/INTERNAL/PUBLIC)가 모두 출현
- [ ] end-to-end: 투입 → Gold staged까지 6개 DAG 전부 성공, 모니터링 UI 단계별 카운트 표시

---

## 9. 열린 항목 (원본 미확인 → 합리적 가정으로 진행)

| 항목 | 상태 | 에뮬레이터 처리 |
|------|------|----------------|
| 청크 크기/방법 | 미확인(고객사 API) | Mock 규칙: 섹션별 분할(문제/대책/부품), ~수백 토큰 가정 |
| 엔리치먼트 모델 | 미확인(LLM/API) | Mock 규칙 기반(빈도 키워드·첫문장 요약) |
| 원본 데이터 볼륨 | 미확인 | 데모용 5문제 소규모로 시작, 인자로 확장 |
| permission/metadata lookup 카탈로그 DDL | 문서 미포함 | role_ids/metadata_tags를 규칙 문자열로 직접 생성 |
| KR_RRN 체크섬 검증 로직 | 부분 확인 | 마스킹이 트리거되는 합성값 사용, 필요시 검증 우회 값 |

---

## 참고 (원본 DDL 위치)

- Bronze DDL: `hyundaimotor-lllm/docs/기술검토확정/05_데이터_모델링/000000.01.브론즈_레이어_DDL.md`
- Silver DDL: `.../000000.02.실버_레이어_DDL.md` (구조화 JSON 스키마 L129~169)
- Gold DDL: `.../000000.03.골드_레이어_DDL.md`
- PII 엔진: `hyundaimotor-lllm/services/airflow/libs/structuring/pii/engine.py`
- Gold5 매핑 DAG: `hyundaimotor-lllm/services/airflow/dags/gold_5_pdis_field_mapping_v0_6.py`

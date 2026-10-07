# 요금제 사용량 한도

결제 연동 없이 요금제·한도·사용량 기록·화면 표시를 먼저 만든 1차 작업이다. 기준 설계는 2026-10-07 「요금제별 사용량 한도 설계」이고,
결정마다 웹 조사 결과와 기존 설계 중 하나를 골랐다(섞지 않음). 모든 회원은 FREE에서 시작하며 결제·구독은 받지 않는다.

## 한도

| 기능 | 로그인 전 | FREE | PLUS(예정) | PREMIUM(예정) |
|---|---|---|---|---|
| AI 대화 검색(검색 실행 기준) | 하루 3회 · 결과 2건 | 하루 10회 | 하루 40회 | 하루 150회 |
| 공고 원문 질문 | 로그인 필요 | 하루 10회 | 하루 50회 | 하루 200회 |
| 신청 문서 초안(공고 하나 = 1건) | 로그인 필요 | 월 1건 | 월 5건 | 월 30건 |
| 중복 지원·수혜 검토 | 로그인 필요 | 월 2회 | 월 20회 | 월 100회 |
| 도우미 자유 질문 | 로그인 필요 | 이용 가능 | 이용 가능 | 이용 가능 |
| 필터 검색·공고 상세·첨부 받기 | 횟수 제한 없음 | 횟수 제한 없음 | 횟수 제한 없음 | 횟수 제한 없음 |

숫자는 Core `planusage/domain/PlanCode.kt`가 원본이고 웹 요금제 화면의 한도표와 같아야 한다. 대화 조건 해석은 AI 검색 횟수로 세지
않고 기존 분당 요청 제한만 받는다. 기업 맞춤 리포트의 내부 검색·원문 답변은 리포트 생성 예산으로만 센다.

## 세는 규칙

- **기간:** 하루는 서울 날짜, 한 달은 서울 달력의 달이다. 기간이 바뀌면 새 기간 키의 행을 쓰므로 초기화 작업이 없다.
- **하루 한도(AI 검색·원문 질문):** 분당 요청 제한을 통과한 요청만, AI를 부르기 전에 `plan_usage_counter` 행을 만들거나 잠근 뒤
  조건부 UPDATE 한 문장(`used_count < limit`)으로 1을 더한다. 동시에 와도 한도를 넘겨 더하지 않는다. 요청이 실패하면 되돌린다.
  검색어가 없는 최신 목록 조회는 AI를 부르지 않아 세지 않는다.
- **로그인 전 체험:** 접속 주소를 SHA-256으로만 넣은 Redis 키에 다음 서울 자정까지 둔다(Lua로 한도 안일 때만 증가).
  DB에는 남기지 않는다. 같은 회사 망·공용 망에서는 한도를 나눠 쓸 수 있고, 로그인하면 계정 한도를 쓴다.
- **월 한도(신청 문서 초안·중복 검토):** 새 작업을 만드는 기존 접수 transaction(계정 행 잠금) 안에서 그 작업까지 센 사용량을
  확인하고, 넘으면 작업을 남기지 않고 되돌린다. 사용량은 각 기능의 작업 표를 원장으로 읽는다.
  - 중복 검토: 이번 달 시작한 실행 중 대기·실행 중·결과 불명·성공. 실패와 만료로 정리된 실행은 별도 해제 없이 빠진다.
  - 신청 문서 초안: 이번 달 사용자가 시작한 양식 분석·문서 생성·문항별 AI 실행 중 실패하지 않은 것과 만든 문서 파일의 공고 수.
    같은 공고의 분석·생성을 다시 해도 늘지 않는다. 작업 표를 쓰지 않는 이전 동기 생성 경로는 실행 전에 그 공고를 더해 확인하고
    만든 파일로 잡힌다.
  - 신청 문서·중복 검토를 지우면 같은 transaction에서 그 달 사용분을 `plan_usage_counter`에 남겨 삭제로 한도가 늘지 않게 한다.
  - 로컬 목업(`demo_seed_key`)은 세지 않는다.
- **응답:** 한도 초과는 `429 PLAN_QUOTA_EXCEEDED`(`feature`·`period`·`plan`·`limit`·`used`·`resetsAt`·`retryAfterSeconds`,
  `Retry-After`는 다음 초기화까지 초). 분당 제한 `SUPPORT_PROGRAM_RATE_LIMITED`와 다른 코드다. 사용량 저장소를 읽거나 쓰지 못하면
  유료 기능을 실행하지 않고 `503 QUOTA_UNAVAILABLE`.
- **조회:** `GET /api/v1/plan-usage`가 현재 요금제와 기능별 `limit`·`used`·`resetsAt`을 돌려준다. 월 한도의 `used`에는 진행 중인
  작업이 들어가 한도를 넘을 수 있어 화면은 한도에서 멈춰 보여 준다.

## 판단 기록

| # | 결정 | 기존 설계 | 웹 조사 | 선택 | 이유 |
|---|---|---|---|---|---|
| D1 | 플랜 단위 | 기업(사업자) 구독, 프리미엄 3좌석, 무료도 사업자번호 기준 | 팀·워크스페이스 플랜은 협업 수요가 생길 때 도입하고 개인·팀 청구를 따로 둔다 | 웹 조사 | 기업이 계정당 하나이고 좌석·초대 기능이 없다. 계정 단위로 시작하고 좌석은 결제 단계에서 다룬다 |
| D2 | 한도 단위 | 기능별 횟수(하루·월) | AI 제품은 크레딧이 늘지만 예측 가능한 결과 단위와 사용량 표시가 핵심 | 기존 설계 | 기능이 넷뿐이라 "오늘 8/10회"가 크레딧 환산보다 이해하기 쉽다 |
| D3 | 로그인 전 AI | 하루 3회·결과 2건, 원문 질문·도우미는 로그인 | 로그아웃 사용자에게 기본 기능만 열고 고급 기능은 로그인(ChatGPT·Perplexity) | 기존 설계 | 결과 2건 제한은 이미 있었고 하루 횟수만 더했다 |
| D3-식별 | 로그인 전 식별 | 접속 주소와 기기 | 익명 한도는 주소·브라우저 식별자로 세며, 브라우저 식별자는 지우면 초기화되고 VPN·모바일망은 오탐이 난다 | 웹 조사 | 기기 식별자는 클라이언트가 바꿀 수 있어 남용을 막지 못하고 수집만 늘린다. 주소만 해시로 하루 보관 |
| D4 | 원본 양식 체험 | 무료도 월 1건 원본 양식까지 | 무료 요금제에서 핵심 가치를 직접 겪게 한다 | 기존 설계 | 방향이 같다 |
| D5 | 가격 표시 | 9,900원·29,000원 유지, 연간 2개월 무료, 부가세 포함 | "2개월 무료"(약 17%)가 가장 흔한 연간 할인, 전자상거래법은 순차 공개 가격을 금지 | 기존 설계 | 부가세 포함가·공급가액·연간 총액을 함께 적고 결제는 아직 없다고 밝힌다 |
| D6 | 앱 결제 | 웹에서만 결제, 앱은 상태만 | App Store 3.1.3(f): 무료 동반 앱은 앱 안 구매와 외부 구매 유도가 없으면 인앱결제가 필요 없다 | 기존 설계 | 앱은 이용량만 보이고 요금제·업그레이드 링크를 두지 않는다 |
| D7 | 결제 대행 | 포트원 + 토스페이먼츠 빌링 | 포트원은 PG를 바꿔도 다시 연동하지 않는다 | 기존 설계 | 이번 범위가 아니다(결제 단계에서 구현) |
| D8 | 첫 범위 | 결제 없이 플랜·한도·원장·화면, 모두 FREE로 시작 | — | 기존 설계 | 요금제 화면의 "플러스 정식 출시 전까지 회원 무료" 문구를 이 결정에 맞게 고쳤다 |
| E1 | 초과 응답 | 429 `PLAN_QUOTA_EXCEEDED` | 쿼터 소진에 402를 쓰자는 문서도 있으나 402는 RFC 9110상 예약된 비표준이고 OpenAI·Google은 쿼터 소진도 429 | 기존 설계 | 결제가 없어 "결제 필요"가 사실이 아니다. 코드와 `Retry-After`(다음 초기화)로 분당 제한과 구분한다 |
| E2 | 저장소 장애 | 503 `QUOTA_UNAVAILABLE`로 막음 | 가용성 우선 API는 fail-open, 비용·보안 민감 경로는 fail-closed | 기존 설계 | 목적이 OpenAI 비용 보호이고 카운터가 Core MySQL과 같은 장애 경계다 |
| E3 | 초기화 | 서울 자정·월초 | 달력 기준은 계획하기 쉽고 롤링 창은 초기화 시점을 예측하기 어렵다 | 기존 설계 | 방향이 같다 |
| E4 | 세는 방식 | AI 전 조건부 UPDATE 예약 → 성공 확정 / 실패 해제, 요청 키 | 원자적 조건부 증가와 예약·확정·해제, 멱등 키로 이중 집계 방지 | 기존 설계 | 월 한도는 기존 요청 키 접수 transaction과 작업 표를 원장으로 써서 재시도·실패·만료를 별도 해제 없이 맞춘다 |
| E5 | 화면 | "오늘 8/10회"·초기화 안내·업그레이드 버튼 | 사용량을 계속 보이고 80%부터 경고·선택지·초기화 날짜를 닫을 수 있게 보인다 | 웹 조사 | 경고 기준(80%)이 설계 시안에 없다. 결제가 없어 웹은 "요금제 보기" 링크, 앱은 링크 없이 표시만 |

구현 세부: 한도 숫자는 설계의 "플랜별 한도 테이블" 대신 코드 상수로 둔다. 관리 화면이 없어 DB 표는 바꾸는 방법(SQL·배포)이 같고
테스트·리뷰만 어려워진다(AGENTS.md 단순성 원칙). 요금제 배정은 `account_plan` 표로 저장한다.

참고: [MDN 402](https://developer.mozilla.org/docs/Web/HTTP/Status/402),
[OpenAI 429·insufficient_quota](https://help.openai.com/en/articles/5955604-troubleshooting-api-rate-limits-and-429-errors),
[쿼터 402 사례](https://api-docs.zutrix.com/rate-limits),
[워크스페이스 청구](https://cipherstash.com/docs/reference/workspace/billing),
[AI 크레딧](https://schematichq.com/blog/why-ai-companies-are-turning-to-credit-based-pricing),
[무료 AI 한도 비교](https://www.scriptbyai.com/ai-chatbot-free-plan-limits/),
[익명 한도 제약](https://duckduckgo.com/duckduckgo-help-pages/duckai/usage-limits),
[연간 할인 관행](https://costbench.com/reports/software-pricing-findings-2026-q3/),
[다크패턴 규제](https://imweb.me/blog?idx=496),
[App Store 3.1.3(f)](https://developer.apple.com/forums/thread/781935),
[포트원 도입](https://blog.portone.io/opi_portone-adoption-guide/),
[fail-open·fail-closed](https://docs.cloud.google.com/service-infrastructure/docs/rate-limiting),
[달력 기준 초기화](https://discourse.shapr3d.com/t/generative-ai-daily-limit-date-day-instead-of-rolling-hours/39840),
[예약 기반 쿼터](https://specs.openstack.org/openstack/neutron-specs/specs/liberty/better-quotas.html),
[사용량 UX](https://www.saasui.design/blog/saas-usage-quota-limits-ux-patterns).

## 운영

- 테스트·제휴 계정 상향: `INSERT INTO account_plan (account_id, plan_code, assigned_at) VALUES (?, 'PREMIUM', NOW(6)) AS assigned
  ON DUPLICATE KEY UPDATE plan_code = assigned.plan_code, assigned_at = assigned.assigned_at`. 행을 지우면 FREE로 돌아간다.
- 오늘 사용량 확인: `SELECT feature, period_key, used_count FROM plan_usage_counter WHERE account_id = ? ORDER BY period_key DESC`.
  월 한도의 실제 사용량은 이 값(지운 작업분)과 작업 표 집계를 더한 `GET /api/v1/plan-usage` 값이다.

## 다음 단계(이번 범위 밖)

관심 공고 개수(30·300·1,000개), 기업 맞춤 리포트 빈도(주 1회·매일), 동시 분석·초안 수(1·3·5건), 파트너 모집글·제안 수,
같은 기업 좌석, 결제·약관·청약철회·해지, 기능별 토큰 원가 기록과 한도 실측 조정, 탈퇴 후 재가입 남용, 리포트 전역 하루 예산,
초안 동시 한도 초과 응답(422)과 다른 기능(429)의 정합은 다음 작업에서 다룬다.

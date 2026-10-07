-- 계정별로 배정한 요금제입니다. 결제 연동 전이라 행이 없으면 FREE이고,
-- 테스트·제휴 계정처럼 다른 요금제가 필요한 계정만 운영자가 직접 배정합니다.
CREATE TABLE account_plan (
    account_id BIGINT UNSIGNED NOT NULL,
    plan_code VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    assigned_at DATETIME(6) NOT NULL,
    PRIMARY KEY (account_id),
    CONSTRAINT fk_account_plan_account FOREIGN KEY (account_id) REFERENCES account (id) ON DELETE CASCADE,
    CONSTRAINT chk_account_plan_code CHECK (plan_code IN ('FREE', 'PLUS', 'PREMIUM'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 계정·기능·기간별 사용 횟수입니다. 기간 키는 서울 날짜(YYYY-MM-DD) 또는 서울 달(YYYY-MM)이며,
-- 기간이 바뀌면 새 행을 쓰므로 따로 초기화하지 않습니다.
-- 하루 한도 기능(AI_SEARCH·EVIDENCE_QUESTION)은 AI를 부르기 전에 한도 안에서만 1을 더하고, 요청이 실패하면 되돌립니다.
-- 월 한도 기능(APPLICATION_DRAFT·COMBINATION_REVIEW)의 사용량은 각 기능의 작업 표에서 실패하지 않은 작업으로 세며,
-- 이 표에는 이번 달에 지운 신청 문서·중복 검토가 이미 쓴 횟수만 더해 두어 삭제로 한도가 다시 늘지 않게 합니다.
CREATE TABLE plan_usage_counter (
    account_id BIGINT UNSIGNED NOT NULL,
    feature VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    period_key VARCHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    used_count INT UNSIGNED NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (account_id, feature, period_key),
    CONSTRAINT fk_plan_usage_counter_account FOREIGN KEY (account_id) REFERENCES account (id) ON DELETE CASCADE,
    CONSTRAINT chk_plan_usage_counter_feature
        CHECK (feature IN ('AI_SEARCH', 'EVIDENCE_QUESTION', 'APPLICATION_DRAFT', 'COMBINATION_REVIEW')),
    CONSTRAINT chk_plan_usage_counter_period
        CHECK (period_key REGEXP '^[0-9]{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12][0-9]|3[01]))?$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

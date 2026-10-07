-- 회원별 시작하기 안내의 상태입니다. 단계 완료는 기존 기능 표(기업·관심 공고·마감 알림·맞춤 리포트·신청 문서·중복 검토)에서
-- 읽을 때마다 계산하므로 여기에는 저장하지 않고, [닫기]를 누른 시각과 처음으로 모든 단계를 마친 시각만 둡니다.
-- closed_at은 [시작하기 다시 보기]를 누르면 비우고, completed_at은 처음 한 번만 기록하고 바꾸지 않습니다.
-- 행동 로그·새 개인정보는 모으지 않습니다. 행이 없으면 닫지도 마치지도 않은 계정입니다.
CREATE TABLE account_getting_started (
    account_id BIGINT UNSIGNED NOT NULL,
    closed_at DATETIME(6) NULL,
    completed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (account_id),
    CONSTRAINT fk_account_getting_started_account FOREIGN KEY (account_id) REFERENCES account (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

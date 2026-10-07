package ai.govbiz.core.planusage.domain

/**
 * 계정 요금제와 기능별 한도입니다. 결제 연동 전이라 모든 회원은 FREE에서 시작하고,
 * 운영자가 `account_plan`에 배정한 계정만 다른 요금제를 씁니다. 숫자는 웹 요금제 화면의 한도표와 같아야 합니다.
 */
enum class PlanCode(
    private val aiSearchPerDay: Int,
    private val evidenceQuestionsPerDay: Int,
    private val applicationDraftsPerMonth: Int,
    private val combinationReviewsPerMonth: Int,
) {
    FREE(aiSearchPerDay = 10, evidenceQuestionsPerDay = 10, applicationDraftsPerMonth = 1, combinationReviewsPerMonth = 2),
    PLUS(aiSearchPerDay = 40, evidenceQuestionsPerDay = 50, applicationDraftsPerMonth = 5, combinationReviewsPerMonth = 20),
    PREMIUM(aiSearchPerDay = 150, evidenceQuestionsPerDay = 200, applicationDraftsPerMonth = 30, combinationReviewsPerMonth = 100),
    ;

    fun limitOf(feature: PlanUsageFeature): Int = when (feature) {
        PlanUsageFeature.AI_SEARCH -> aiSearchPerDay
        PlanUsageFeature.EVIDENCE_QUESTION -> evidenceQuestionsPerDay
        PlanUsageFeature.APPLICATION_DRAFT -> applicationDraftsPerMonth
        PlanUsageFeature.COMBINATION_REVIEW -> combinationReviewsPerMonth
    }

    companion object {
        /** 로그인하지 않은 접속 주소가 하루에 쓸 수 있는 AI 대화 검색 횟수입니다. 다른 AI 기능은 로그인해야 씁니다. */
        const val GUEST_AI_SEARCH_PER_DAY = 3
    }
}

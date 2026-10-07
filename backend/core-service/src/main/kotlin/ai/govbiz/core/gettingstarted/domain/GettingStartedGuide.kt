package ai.govbiz.core.gettingstarted.domain

import ai.govbiz.core.account.domain.AccountType
import java.time.Duration
import java.time.LocalDateTime

/** 시작하기 단계입니다. 선언 순서가 화면에 보이는 순서입니다. */
enum class GettingStartedStepId {
    SIGN_UP,
    COMPANY,
    SAVE_PROGRAM,
    DEADLINE_REMINDER,
    DAILY_REPORT,
    START_PREPARATION,
}

/** 단계 상태입니다. LOCKED는 앞 단계를 마쳐야 할 수 있는 단계(기업이 없을 때의 맞춤 리포트)입니다. */
enum class GettingStartedStepStatus {
    DONE,
    TODO,
    LOCKED,
}

data class GettingStartedStep(val id: GettingStartedStepId, val status: GettingStartedStepStatus)

/**
 * 기존 기능 표에서 읽은 완료 사실과 이 기능이 저장한 닫기·완료 시각입니다. 새로 모으는 행동 기록은 없습니다.
 * 신청 준비는 신청 문서 또는 중복 검토 중 하나라도 있으면 시작한 것이며, 로컬 목업(demo seed)은 세지 않습니다.
 */
data class GettingStartedFacts(
    val companyRegistered: Boolean,
    val programSaved: Boolean,
    val deadlineReminderEnabled: Boolean,
    val dailyReportReady: Boolean,
    val preparationStarted: Boolean,
    /** [닫기]를 누른 시각입니다. [시작하기 다시 보기]를 누르면 비웁니다. */
    val closedAt: LocalDateTime?,
    /** 처음으로 모든 단계를 마친 시각입니다. 한 번 기록하면 바꾸지 않습니다. */
    val completedAt: LocalDateTime?,
)

/** 안내를 보여 줄 계정인지 가르는 값입니다. [signedUpAt]은 서울 시각의 가입 시각입니다. */
data class GettingStartedMember(val accountType: AccountType?, val admin: Boolean, val signedUpAt: LocalDateTime)

/**
 * 시작하기 안내입니다. 가입은 늘 끝난 단계로 두어 처음부터 한 칸이 채워져 보이고, 개인 회원(예비창업자)에게는 기업 등록과
 * 맞춤 리포트를 두지 않습니다(기업 회원: 가입 + 5단계, 개인 회원: 가입 + 3단계).
 *
 * [visible]은 기능이 켜져 있고, 관리자가 아니며, 닫지 않았고, 가입 30일 안이며, 모든 단계를 처음 마친 지 24시간이 지나지 않았을
 * 때만 참입니다. 완료 시각은 한 번만 남으므로 그 뒤 설정을 꺼 단계가 다시 할 일이 되어도 안내가 다시 나타나지 않습니다.
 * [closed]는 닫아서 숨겼고 다시 열면 보이는 상태일 때만 참입니다. 기간이 지났거나 대상이 아니면 둘 다 거짓이라 다시 보기도 두지 않습니다.
 */
data class GettingStartedGuide(
    val steps: List<GettingStartedStep>,
    val closed: Boolean,
    val completedAt: LocalDateTime?,
    val visible: Boolean,
) {
    /** 지금 모든 단계가 끝났는지입니다. 처음 참이 될 때 서비스가 완료 시각을 남깁니다. */
    val complete: Boolean
        get() = steps.all { it.status == GettingStartedStepStatus.DONE }

    companion object {
        /** 가입 뒤 안내를 먼저 보여 주는 기간입니다. */
        val OFFERED_AFTER_SIGN_UP: Duration = Duration.ofDays(30)

        /** 모든 단계를 처음 마친 뒤 안내를 남겨 두는 기간입니다. */
        val SHOWN_AFTER_COMPLETION: Duration = Duration.ofHours(24)

        fun of(member: GettingStartedMember, facts: GettingStartedFacts, enabled: Boolean, now: LocalDateTime): GettingStartedGuide {
            val steps = steps(member.accountType, facts)
            val completedAt = facts.completedAt
            val offered = enabled && !member.admin &&
                now.isBefore(member.signedUpAt.plus(OFFERED_AFTER_SIGN_UP)) &&
                (completedAt == null || now.isBefore(completedAt.plus(SHOWN_AFTER_COMPLETION)))
            val closedByMember = facts.closedAt != null
            return GettingStartedGuide(steps, closed = offered && closedByMember, completedAt = completedAt, visible = offered && !closedByMember)
        }

        /** 회원 유형을 아직 고르지 않았으면 기업 회원과 같은 단계를 씁니다(환영 화면을 마치면 정해집니다). */
        fun steps(accountType: AccountType?, facts: GettingStartedFacts): List<GettingStartedStep> {
            val business = accountType != AccountType.INDIVIDUAL
            return buildList {
                add(GettingStartedStep(GettingStartedStepId.SIGN_UP, GettingStartedStepStatus.DONE))
                if (business) add(GettingStartedStep(GettingStartedStepId.COMPANY, doneOrTodo(facts.companyRegistered)))
                add(GettingStartedStep(GettingStartedStepId.SAVE_PROGRAM, doneOrTodo(facts.programSaved)))
                add(GettingStartedStep(GettingStartedStepId.DEADLINE_REMINDER, doneOrTodo(facts.deadlineReminderEnabled)))
                if (business) add(GettingStartedStep(GettingStartedStepId.DAILY_REPORT, dailyReportStatus(facts)))
                add(GettingStartedStep(GettingStartedStepId.START_PREPARATION, doneOrTodo(facts.preparationStarted)))
            }
        }

        /** 맞춤 리포트는 기업 조건으로 만들므로 기업이 없으면 잠깁니다. 이미 받은 리포트가 있으면 끝난 단계입니다. */
        private fun dailyReportStatus(facts: GettingStartedFacts): GettingStartedStepStatus = when {
            facts.dailyReportReady -> GettingStartedStepStatus.DONE
            !facts.companyRegistered -> GettingStartedStepStatus.LOCKED
            else -> GettingStartedStepStatus.TODO
        }

        private fun doneOrTodo(done: Boolean) = if (done) GettingStartedStepStatus.DONE else GettingStartedStepStatus.TODO
    }
}

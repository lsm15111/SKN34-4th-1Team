package ai.govbiz.core.gettingstarted.repository.mapper

import java.time.LocalDateTime
import org.apache.ibatis.annotations.Mapper
import org.apache.ibatis.annotations.Param

/** MyBatis가 시작하기 완료 사실과 닫기·완료 시각을 한 행으로 읽기 위한 DB 행 값입니다. */
data class GettingStartedDbRow(
    var companyRegistered: Boolean = false,
    var programSaved: Boolean = false,
    var deadlineReminderEnabled: Boolean = false,
    var dailyReportReady: Boolean = false,
    var preparationStarted: Boolean = false,
    var closedAt: LocalDateTime? = null,
    var completedAt: LocalDateTime? = null,
)

/** 시작하기 완료 사실을 기존 기능 표에서 읽고, 닫기·완료 시각(`account_getting_started`)을 쓰는 MyBatis Mapper입니다. */
@Mapper
interface GettingStartedMapper {
    /** 읽기 전용 SELECT 한 문장입니다. 계정 행이 없어도 한 행을 돌려줍니다. */
    fun findFacts(@Param("accountId") accountId: Long): GettingStartedDbRow?

    /** 처음 완료한 시각을 남깁니다. 이미 있으면 바꾸지 않습니다. */
    fun recordCompleted(@Param("accountId") accountId: Long, @Param("now") now: LocalDateTime): Int

    fun findCompletedAt(@Param("accountId") accountId: Long): LocalDateTime?

    /** 닫으면 처음 닫은 시각을 유지하고, 다시 열면 비웁니다. 완료 시각은 건드리지 않습니다. */
    fun saveClosed(
        @Param("accountId") accountId: Long,
        @Param("closed") closed: Boolean,
        @Param("now") now: LocalDateTime,
    ): Int
}

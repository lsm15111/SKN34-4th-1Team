package ai.govbiz.core.gettingstarted.controller.dto

import ai.govbiz.core.gettingstarted.domain.GettingStartedGuide
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * 시작하기 안내입니다. `visible`이면 화면에 보이고, `closed`이면 닫아서 숨긴 상태라 다시 열 수 있습니다. 둘 다 거짓이면 기능이 꺼졌거나
 * 기간이 지났거나 대상이 아닙니다. `steps`는 화면 순서이며 `completedAt`은 처음 모두 마친 서울 시각(+09:00)입니다.
 */
data class GettingStartedResponse(
    val visible: Boolean,
    val closed: Boolean,
    val completedAt: String?,
    val steps: List<GettingStartedStepResponse>,
) {
    companion object {
        private val SEOUL: ZoneId = ZoneId.of("Asia/Seoul")

        fun from(guide: GettingStartedGuide) = GettingStartedResponse(
            visible = guide.visible,
            closed = guide.closed,
            completedAt = guide.completedAt?.atZone(SEOUL)?.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
            steps = guide.steps.map { GettingStartedStepResponse(it.id.name, it.status.name) },
        )
    }
}

/** 단계 하나입니다. `status`는 DONE·TODO·LOCKED입니다. */
data class GettingStartedStepResponse(val id: String, val status: String)

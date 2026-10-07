package ai.govbiz.core.gettingstarted.controller.dto

import com.fasterxml.jackson.annotation.JsonProperty
import com.fasterxml.jackson.annotation.JsonSetter
import com.fasterxml.jackson.annotation.Nulls

/** [닫기](`true`)와 [시작하기 다시 보기](`false`)입니다. `closed`가 빠졌거나 null·불리언이 아니면 400입니다. */
data class GettingStartedRequest(
    @param:JsonProperty(required = true)
    @field:JsonSetter(nulls = Nulls.FAIL)
    val closed: Boolean,
)

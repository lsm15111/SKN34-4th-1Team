package ai.govbiz.catalog.supportprogram.service.sync.config

import ai.govbiz.catalog._common.helper.validatePositiveDuration
import java.time.Duration
import org.springframework.boot.context.properties.ConfigurationProperties

/** [retryDelay]는 실패 뒤 첫 재시도 간격이며 연속 실패마다 두 배로 늘어나되 [fixedDelay]를 넘지 않습니다. */
@ConfigurationProperties(prefix = "app.msit.sync")
data class MsitSupportProgramCatalogSyncProperties(
    val enabled: Boolean = false,
    val initialDelay: Duration = Duration.ofSeconds(15),
    val fixedDelay: Duration = Duration.ofHours(6),
    val retryDelay: Duration = Duration.ofMinutes(5),
) {
    init {
        require(!initialDelay.isNegative) { "app.msit.sync.initial-delay must not be negative" }
        validatePositiveDuration(fixedDelay, "app.msit.sync.fixed-delay")
        validatePositiveDuration(retryDelay, "app.msit.sync.retry-delay")
    }
}

package ai.govbiz.catalog.supportprogram.service.sync.config

import ai.govbiz.catalog._common.helper.validatePositiveDuration
import java.time.Duration
import org.springframework.boot.context.properties.ConfigurationProperties

/** [retryDelay]는 실패 뒤 첫 재시도 간격이며 연속 실패마다 두 배로 늘어나되 [fixedDelay]를 넘지 않습니다. */
@ConfigurationProperties(prefix = "app.bizinfo.sync")
data class BizInfoSupportProgramCatalogSyncProperties(
    val enabled: Boolean,
    val initialDelay: Duration,
    val fixedDelay: Duration,
    val retryDelay: Duration = Duration.ofMinutes(5),
) {

    init {
        if (initialDelay.isNegative) {
            throw IllegalArgumentException("app.bizinfo.sync.initial-delay must not be negative")
        }
        validatePositiveDuration(fixedDelay, "app.bizinfo.sync.fixed-delay")
        validatePositiveDuration(retryDelay, "app.bizinfo.sync.retry-delay")
    }
}

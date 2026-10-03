package ai.govbiz.catalog.supportprogram.service.sync.config

import ai.govbiz.catalog.supportprogram.service.sync.CnTradeNoticeSupportProgramCatalogSyncScheduler
import ai.govbiz.catalog.supportprogram.service.sync.CnTradeNoticeSupportProgramCatalogSyncService
import java.time.Duration
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.springframework.boot.test.context.runner.ApplicationContextRunner

class CnTradeNoticeSupportProgramCatalogSyncPropertiesTest {
    private val context = ApplicationContextRunner()
        .withBean(CnTradeNoticeSupportProgramCatalogSyncService::class.java, { mock(CnTradeNoticeSupportProgramCatalogSyncService::class.java) })
        .withUserConfiguration(CnTradeNoticeSupportProgramCatalogSyncConfig::class.java, CnTradeNoticeSupportProgramCatalogSyncScheduler::class.java)
        .withPropertyValues("app.cntrade-notice.sync.initial-delay=1h")

    @Test
    fun isDisabledByDefaultAndDoesNotScheduleExternalCallsWithoutAnExplicitOptIn() {
        assertFalse(CnTradeNoticeSupportProgramCatalogSyncProperties().enabled)
        context.run { assertThat(it).doesNotHaveBean(CnTradeNoticeSupportProgramCatalogSyncScheduler::class.java) }
        context.withPropertyValues("app.cntrade-notice.sync.enabled=false")
            .run { assertThat(it).doesNotHaveBean(CnTradeNoticeSupportProgramCatalogSyncScheduler::class.java) }
    }

    @Test
    fun registersTheSchedulerOnlyWhenExplicitlyEnabled() {
        context.withPropertyValues("app.cntrade-notice.sync.enabled=true")
            .run { assertThat(it).hasSingleBean(CnTradeNoticeSupportProgramCatalogSyncScheduler::class.java) }
    }

    @Test
    fun bindsTheRetryDelayWithAFiveMinuteDefault() {
        assertEquals(Duration.ofMinutes(5), CnTradeNoticeSupportProgramCatalogSyncProperties().retryDelay)
        context.withPropertyValues("app.cntrade-notice.sync.retry-delay=PT1M")
            .run { assertEquals(Duration.ofMinutes(1), it.getBean(CnTradeNoticeSupportProgramCatalogSyncProperties::class.java).retryDelay) }
    }

    @Test
    fun rejectsNonpositiveIntervalsAndNegativeInitialDelays() {
        assertThrows(IllegalArgumentException::class.java) {
            CnTradeNoticeSupportProgramCatalogSyncProperties(initialDelay = Duration.ofSeconds(-1))
        }
        assertThrows(IllegalArgumentException::class.java) {
            CnTradeNoticeSupportProgramCatalogSyncProperties(fixedDelay = Duration.ZERO)
        }
        CnTradeNoticeSupportProgramCatalogSyncProperties(initialDelay = Duration.ZERO)
    }
}

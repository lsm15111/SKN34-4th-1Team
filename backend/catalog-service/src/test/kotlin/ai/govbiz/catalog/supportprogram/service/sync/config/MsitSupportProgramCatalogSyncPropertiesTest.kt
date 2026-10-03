package ai.govbiz.catalog.supportprogram.service.sync.config

import ai.govbiz.catalog.supportprogram.service.sync.MsitSupportProgramCatalogSyncScheduler
import ai.govbiz.catalog.supportprogram.service.sync.MsitSupportProgramCatalogSyncService
import java.time.Duration
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito.doAnswer
import org.mockito.Mockito.mock
import org.springframework.boot.test.context.runner.ApplicationContextRunner
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler

class MsitSupportProgramCatalogSyncPropertiesTest {
    private val context = ApplicationContextRunner()
        .withBean(MsitSupportProgramCatalogSyncService::class.java, { mock(MsitSupportProgramCatalogSyncService::class.java) })
        .withUserConfiguration(MsitSupportProgramCatalogSyncConfig::class.java, MsitSupportProgramCatalogSyncScheduler::class.java)
        .withPropertyValues("app.msit.sync.initial-delay=1h")

    @Test
    fun isDisabledByDefaultAndDoesNotScheduleExternalCallsWithoutAnExplicitOptIn() {
        assertFalse(MsitSupportProgramCatalogSyncProperties().enabled)
        context.run { assertThat(it).doesNotHaveBean(MsitSupportProgramCatalogSyncScheduler::class.java) }
        context.withPropertyValues("app.msit.sync.enabled=false")
            .run { assertThat(it).doesNotHaveBean(MsitSupportProgramCatalogSyncScheduler::class.java) }
    }

    @Test
    fun registersTheSchedulerOnlyWhenExplicitlyEnabled() {
        context.withPropertyValues("app.msit.sync.enabled=true")
            .run { assertThat(it).hasSingleBean(MsitSupportProgramCatalogSyncScheduler::class.java) }
    }

    @Test
    fun runsTheLongRunningCollectionOnItsOwnOptInSingleThreadScheduler() {
        context.run { assertThat(it).doesNotHaveBean("msitCatalogTaskScheduler") }
        val service = mock(MsitSupportProgramCatalogSyncService::class.java)
        val syncThread = CompletableFuture<String>()
        doAnswer {
            syncThread.complete(Thread.currentThread().name)
            0
        }.`when`(service).sync()

        ApplicationContextRunner()
            .withBean(MsitSupportProgramCatalogSyncService::class.java, { service })
            .withUserConfiguration(MsitSupportProgramCatalogSyncConfig::class.java, MsitSupportProgramCatalogSyncScheduler::class.java)
            .withPropertyValues("app.msit.sync.enabled=true", "app.msit.sync.initial-delay=0s", "app.msit.sync.retry-delay=PT1M")
            .run {
                assertEquals(1, it.getBean("msitCatalogTaskScheduler", ThreadPoolTaskScheduler::class.java).poolSize)
                assertEquals(Duration.ofMinutes(1), it.getBean(MsitSupportProgramCatalogSyncProperties::class.java).retryDelay)
                assertThat(syncThread.get(5, TimeUnit.SECONDS)).startsWith("msit-catalog-sync-")
            }
    }

    @Test
    fun rejectsNonpositiveIntervalsAndNegativeInitialDelays() {
        assertThrows(IllegalArgumentException::class.java) {
            MsitSupportProgramCatalogSyncProperties(initialDelay = Duration.ofSeconds(-1))
        }
        assertThrows(IllegalArgumentException::class.java) {
            MsitSupportProgramCatalogSyncProperties(fixedDelay = Duration.ZERO)
        }
        MsitSupportProgramCatalogSyncProperties(initialDelay = Duration.ZERO)
    }
}

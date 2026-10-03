package ai.govbiz.catalog.supportprogram.service.sync

import ai.govbiz.catalog.supportprogram.service.sync.config.BizInfoSupportProgramCatalogSyncConfig
import ai.govbiz.catalog.supportprogram.service.sync.config.BizInfoSupportProgramCatalogSyncProperties
import ai.govbiz.catalog.supportprogram.service.sync.config.SupportProgramIndexSyncConfig
import java.time.Duration
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.Mockito.doAnswer
import org.mockito.Mockito.doReturn
import org.mockito.Mockito.doThrow
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.boot.test.context.runner.ApplicationContextRunner

@ExtendWith(MockitoExtension::class)
class BizInfoSupportProgramCatalogSyncSchedulerTest {

    @Mock
    private lateinit var syncService: BizInfoSupportProgramCatalogSyncService

    @Test
    fun invokesTheSyncService() {
        doReturn(3).`when`(syncService).sync()

        scheduler().synchronize()

        verify(syncService).sync()
    }

    @Test
    fun acceptsASupersededSyncWithoutTreatingItAsAFailure() {
        doReturn(null).`when`(syncService).sync()

        scheduler().synchronize()

        verify(syncService).sync()
    }

    @Test
    fun continuesWithTheNextScheduledRunAfterASyncFailure() {
        doThrow(IllegalStateException("sync failed"))
            .doReturn(2)
            .`when`(syncService)
            .sync()

        val scheduler = scheduler()
        scheduler.synchronize()
        scheduler.synchronize()

        verify(syncService, times(2)).sync()
    }

    @Test
    fun runsOnTheSharedCatalogSyncSchedulerAmongSeveralTaskSchedulers() {
        val syncThread = CompletableFuture<String>()
        doAnswer {
            syncThread.complete(Thread.currentThread().name)
            1
        }.`when`(syncService).sync()

        // 운영과 같이 색인 복구용 scheduler와 기본 수집 scheduler가 함께 있을 때 기본 수집 스레드를 사용합니다.
        ApplicationContextRunner()
            .withBean(BizInfoSupportProgramCatalogSyncService::class.java, { syncService })
            .withUserConfiguration(
                SupportProgramIndexSyncConfig::class.java,
                BizInfoSupportProgramCatalogSyncConfig::class.java,
                BizInfoSupportProgramCatalogSyncScheduler::class.java,
            )
            .withPropertyValues(
                "app.bizinfo.sync.enabled=true",
                "app.bizinfo.sync.initial-delay=0s",
                "app.bizinfo.sync.fixed-delay=6h",
                "app.support-program-index.enabled=false",
                "app.support-program-index.initial-delay=0s",
                "app.support-program-index.fixed-delay=1m",
            )
            .run { assertThat(syncThread.get(5, TimeUnit.SECONDS)).startsWith("catalog-sync-") }
    }

    private fun scheduler() = BizInfoSupportProgramCatalogSyncScheduler(
        syncService,
        BizInfoSupportProgramCatalogSyncProperties(true, Duration.ZERO, Duration.ofHours(6)),
    )
}

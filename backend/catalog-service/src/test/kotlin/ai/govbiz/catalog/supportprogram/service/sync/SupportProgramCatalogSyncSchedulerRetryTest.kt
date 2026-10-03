package ai.govbiz.catalog.supportprogram.service.sync

import ai.govbiz.catalog._common.exception.AiServiceCallException
import ai.govbiz.catalog.supportprogram.facade.exception.SupportProgramCatalogFacadeException
import ai.govbiz.catalog.supportprogram.service.sync.config.BizInfoSupportProgramCatalogSyncProperties
import ai.govbiz.catalog.supportprogram.service.sync.config.CnTradeNoticeSupportProgramCatalogSyncProperties
import ai.govbiz.catalog.supportprogram.service.sync.config.KStartupSupportProgramCatalogSyncProperties
import ai.govbiz.catalog.supportprogram.service.sync.config.MsitSupportProgramCatalogSyncProperties
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.MethodSource
import org.mockito.Mockito.doReturn
import org.mockito.Mockito.doThrow
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.stubbing.Stubber
import org.springframework.scheduling.SchedulingAwareRunnable
import org.springframework.scheduling.annotation.SchedulingConfigurer
import org.springframework.scheduling.config.ScheduledTaskRegistrar
import org.springframework.scheduling.config.TriggerTask
import org.springframework.scheduling.support.SimpleTriggerContext

/** 모든 제공처 scheduler가 실패 뒤에는 짧게 재시도하고 성공 뒤에는 정상 간격을 유지하는지 확인합니다. */
class SupportProgramCatalogSyncSchedulerRetryTest {

    @ParameterizedTest(name = "{displayName} [{0}]")
    @MethodSource("providers")
    fun registersOneTaskOnTheProviderSchedulerThatStartsAfterTheInitialDelay(provider: Provider) {
        val task = provider.registeredTask()

        assertEquals(provider.qualifier, (task.runnable as SchedulingAwareRunnable).qualifier)
        assertEquals(
            COMPLETED_AT.plus(INITIAL_DELAY),
            task.trigger.nextExecution(SimpleTriggerContext(Clock.fixed(COMPLETED_AT, ZoneOffset.UTC))),
        )
    }

    @ParameterizedTest(name = "{displayName} [{0}]")
    @MethodSource("providers")
    fun retriesSoonAfterTheAiServiceRejectsIndexing(provider: Provider) {
        provider.stubSync(doThrow(AiServiceCallException.upstreamError("AI Service returned HTTP 503", null)))
        val task = provider.registeredTask()

        task.runnable.run()

        assertEquals(COMPLETED_AT.plus(RETRY_DELAY), task.nextAfterCompletion())
        provider.verifySyncCalls(1)
    }

    @ParameterizedTest(name = "{displayName} [{0}]")
    @MethodSource("providers")
    fun retriesSoonAfterASourceCollectionFailure(provider: Provider) {
        provider.stubSync(
            doThrow(
                SupportProgramCatalogFacadeException.fromClient(
                    SupportProgramCatalogFacadeException.Failure.UNAVAILABLE,
                    "source unavailable",
                    IllegalStateException("source unavailable"),
                ),
            ),
        )
        val task = provider.registeredTask()

        task.runnable.run()

        assertEquals(COMPLETED_AT.plus(RETRY_DELAY), task.nextAfterCompletion())
    }

    @ParameterizedTest(name = "{displayName} [{0}]")
    @MethodSource("providers")
    fun keepsTheNormalIntervalAfterASuccessfulOrSupersededSync(provider: Provider) {
        provider.stubSync(doReturn(3).doReturn(null))
        val task = provider.registeredTask()

        task.runnable.run()
        assertEquals(COMPLETED_AT.plus(FIXED_DELAY), task.nextAfterCompletion())
        task.runnable.run()
        assertEquals(COMPLETED_AT.plus(FIXED_DELAY), task.nextAfterCompletion())
        provider.verifySyncCalls(2)
    }

    @ParameterizedTest(name = "{displayName} [{0}]")
    @MethodSource("providers")
    fun backsOffWhileFailuresContinueAndRestartsTheBackoffAfterRecovery(provider: Provider) {
        val failure = IllegalStateException("index not ready")
        provider.stubSync(doThrow(failure).doThrow(failure).doThrow(failure).doReturn(2).doThrow(failure))
        val task = provider.registeredTask()

        val delays = List(5) {
            task.runnable.run()
            Duration.between(COMPLETED_AT, task.nextAfterCompletion())
        }

        assertEquals(listOf<Long>(5, 10, 20, 360, 5).map(Duration::ofMinutes), delays)
        provider.verifySyncCalls(5)
    }

    @Test
    fun everyProviderRejectsANonpositiveRetryDelay() {
        for (retryDelay in listOf(Duration.ZERO, Duration.ofMinutes(-5))) {
            assertThrows(IllegalArgumentException::class.java) {
                BizInfoSupportProgramCatalogSyncProperties(true, INITIAL_DELAY, FIXED_DELAY, retryDelay)
            }
            assertThrows(IllegalArgumentException::class.java) { KStartupSupportProgramCatalogSyncProperties(retryDelay = retryDelay) }
            assertThrows(IllegalArgumentException::class.java) { MsitSupportProgramCatalogSyncProperties(retryDelay = retryDelay) }
            assertThrows(IllegalArgumentException::class.java) { CnTradeNoticeSupportProgramCatalogSyncProperties(retryDelay = retryDelay) }
        }
    }

    class Provider(
        private val name: String,
        val qualifier: String?,
        private val scheduler: SchedulingConfigurer,
        val stubSync: (Stubber) -> Unit,
        val verifySyncCalls: (Int) -> Unit,
    ) {
        fun registeredTask(): TriggerTask {
            val registrar = ScheduledTaskRegistrar()
            scheduler.configureTasks(registrar)
            return registrar.triggerTaskList.single()
        }

        override fun toString() = name
    }

    companion object {
        private val COMPLETED_AT: Instant = Instant.parse("2026-10-04T00:00:00Z")
        private val INITIAL_DELAY: Duration = Duration.ofSeconds(15)
        private val FIXED_DELAY: Duration = Duration.ofHours(6)
        private val RETRY_DELAY: Duration = Duration.ofMinutes(5)

        @JvmStatic
        fun providers(): List<Provider> {
            val bizInfo = mock(BizInfoSupportProgramCatalogSyncService::class.java)
            val kStartup = mock(KStartupSupportProgramCatalogSyncService::class.java)
            val msit = mock(MsitSupportProgramCatalogSyncService::class.java)
            val cnTrade = mock(CnTradeNoticeSupportProgramCatalogSyncService::class.java)
            return listOf(
                Provider(
                    "BIZINFO",
                    null,
                    BizInfoSupportProgramCatalogSyncScheduler(
                        bizInfo,
                        BizInfoSupportProgramCatalogSyncProperties(true, INITIAL_DELAY, FIXED_DELAY, RETRY_DELAY),
                    ),
                    { it.`when`(bizInfo).sync() },
                    { verify(bizInfo, times(it)).sync() },
                ),
                Provider(
                    "KSTARTUP",
                    null,
                    KStartupSupportProgramCatalogSyncScheduler(
                        kStartup,
                        KStartupSupportProgramCatalogSyncProperties(true, INITIAL_DELAY, FIXED_DELAY, RETRY_DELAY),
                    ),
                    { it.`when`(kStartup).sync() },
                    { verify(kStartup, times(it)).sync() },
                ),
                Provider(
                    "MSIT",
                    "msitCatalogTaskScheduler",
                    MsitSupportProgramCatalogSyncScheduler(
                        msit,
                        MsitSupportProgramCatalogSyncProperties(true, INITIAL_DELAY, FIXED_DELAY, RETRY_DELAY),
                    ),
                    { it.`when`(msit).sync() },
                    { verify(msit, times(it)).sync() },
                ),
                Provider(
                    "CNTRADE_NOTICE",
                    null,
                    CnTradeNoticeSupportProgramCatalogSyncScheduler(
                        cnTrade,
                        CnTradeNoticeSupportProgramCatalogSyncProperties(true, INITIAL_DELAY, FIXED_DELAY, RETRY_DELAY),
                    ),
                    { it.`when`(cnTrade).sync() },
                    { verify(cnTrade, times(it)).sync() },
                ),
            )
        }

        private fun TriggerTask.nextAfterCompletion(): Instant? =
            trigger.nextExecution(
                SimpleTriggerContext(COMPLETED_AT.minusSeconds(30), COMPLETED_AT.minusSeconds(30), COMPLETED_AT),
            )
    }
}

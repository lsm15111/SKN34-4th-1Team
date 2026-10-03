package ai.govbiz.catalog.supportprogram.service.sync

import ai.govbiz.catalog.supportprogram.facade.exception.SupportProgramCatalogFacadeException
import ai.govbiz.catalog.supportprogram.service.sync.config.MsitSupportProgramCatalogSyncProperties
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.scheduling.SchedulingAwareRunnable
import org.springframework.scheduling.annotation.SchedulingConfigurer
import org.springframework.scheduling.config.ScheduledTaskRegistrar
import org.springframework.stereotype.Component

@Component
@ConditionalOnProperty(prefix = "app.msit.sync", name = ["enabled"], havingValue = "true", matchIfMissing = false)
class MsitSupportProgramCatalogSyncScheduler(
    private val syncService: MsitSupportProgramCatalogSyncService,
    properties: MsitSupportProgramCatalogSyncProperties,
) : SchedulingConfigurer {
    private val trigger = SupportProgramCatalogSyncTrigger(properties.initialDelay, properties.fixedDelay, properties.retryDelay)

    /** Spring의 scheduler 라우터가 qualifier를 보고 MSIT 전용 실행 스레드로 보냅니다. */
    override fun configureTasks(taskRegistrar: ScheduledTaskRegistrar) {
        taskRegistrar.addTriggerTask(object : SchedulingAwareRunnable {
            override fun run() = synchronize()
            override fun getQualifier() = TASK_SCHEDULER
        }, trigger)
    }

    fun synchronize() {
        try {
            val count = syncService.sync()
            trigger.recordSuccess()
            if (count == null) logger.info("더 최근 MSIT 동기화가 있어 스냅샷 공개를 건너뜁니다.")
            else logger.info("MSIT 사업공고 {}건을 MySQL과 검색 색인에 동기화했습니다.", count)
        } catch (exception: SupportProgramCatalogFacadeException) {
            logger.error("MSIT 공고 수집에 실패했습니다. 실패 유형: {}. 기존 공개 공고는 유지하고 {} 뒤 다시 시도합니다.", exception.failure, trigger.recordFailure())
        } catch (exception: RuntimeException) {
            logger.error("MSIT 공고 동기화에 실패했습니다. 오류 유형: {}. 기존 공개 공고는 유지하고 {} 뒤 다시 시도합니다.", exception.javaClass.simpleName, trigger.recordFailure())
        }
    }

    private companion object {
        /** `MsitSupportProgramCatalogSyncConfig`가 등록하는 전용 scheduler bean 이름입니다. */
        const val TASK_SCHEDULER = "msitCatalogTaskScheduler"
        val logger = LoggerFactory.getLogger(MsitSupportProgramCatalogSyncScheduler::class.java)
    }
}

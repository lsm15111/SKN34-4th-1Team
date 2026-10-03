package ai.govbiz.catalog.supportprogram.service.sync

import ai.govbiz.catalog.supportprogram.facade.exception.SupportProgramCatalogFacadeException
import ai.govbiz.catalog.supportprogram.service.sync.config.CnTradeNoticeSupportProgramCatalogSyncProperties
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.scheduling.annotation.SchedulingConfigurer
import org.springframework.scheduling.config.ScheduledTaskRegistrar
import org.springframework.stereotype.Component

@Component
@ConditionalOnProperty(prefix = "app.cntrade-notice.sync", name = ["enabled"], havingValue = "true", matchIfMissing = false)
class CnTradeNoticeSupportProgramCatalogSyncScheduler(
    private val syncService: CnTradeNoticeSupportProgramCatalogSyncService,
    properties: CnTradeNoticeSupportProgramCatalogSyncProperties,
) : SchedulingConfigurer {
    private val trigger = SupportProgramCatalogSyncTrigger(properties.initialDelay, properties.fixedDelay, properties.retryDelay)

    override fun configureTasks(taskRegistrar: ScheduledTaskRegistrar) {
        taskRegistrar.addTriggerTask(::synchronize, trigger)
    }

    fun synchronize() {
        try {
            val count = syncService.sync()
            trigger.recordSuccess()
            if (count == null) logger.info("더 최근 충청남도 온라인수출지원시스템 동기화가 있어 스냅샷 공개를 건너뜁니다.")
            else logger.info("충청남도 온라인수출지원시스템 지원사업 {}건을 MySQL과 검색 색인에 동기화했습니다.", count)
        } catch (exception: SupportProgramCatalogFacadeException) {
            logger.error("충청남도 온라인수출지원시스템 공고 수집에 실패했습니다. 실패 유형: {}. 기존 공개 공고는 유지하고 {} 뒤 다시 시도합니다.", exception.failure, trigger.recordFailure())
        } catch (exception: RuntimeException) {
            logger.error("충청남도 온라인수출지원시스템 공고 동기화에 실패했습니다. 오류 유형: {}. 기존 공개 공고는 유지하고 {} 뒤 다시 시도합니다.", exception.javaClass.simpleName, trigger.recordFailure())
        }
    }

    private companion object {
        val logger = LoggerFactory.getLogger(CnTradeNoticeSupportProgramCatalogSyncScheduler::class.java)
    }
}

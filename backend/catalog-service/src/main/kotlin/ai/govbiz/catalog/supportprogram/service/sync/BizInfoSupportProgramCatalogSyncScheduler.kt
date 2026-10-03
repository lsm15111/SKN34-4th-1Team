package ai.govbiz.catalog.supportprogram.service.sync

import ai.govbiz.catalog.supportprogram.facade.exception.SupportProgramCatalogFacadeException
import ai.govbiz.catalog.supportprogram.service.sync.config.BizInfoSupportProgramCatalogSyncProperties
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.scheduling.annotation.SchedulingConfigurer
import org.springframework.scheduling.config.ScheduledTaskRegistrar
import org.springframework.stereotype.Component

/** 앱 시작 직후와 이후 정해진 간격으로 기업마당 공고를 MySQL에 동기화하고, 실패하면 짧은 간격으로 다시 시도합니다. */
@Component
@ConditionalOnProperty(
    prefix = "app.bizinfo.sync",
    name = ["enabled"],
    havingValue = "true",
    matchIfMissing = true,
)
class BizInfoSupportProgramCatalogSyncScheduler(
    private val syncService: BizInfoSupportProgramCatalogSyncService,
    properties: BizInfoSupportProgramCatalogSyncProperties,
) : SchedulingConfigurer {

    private val trigger = SupportProgramCatalogSyncTrigger(
        initialDelay = properties.initialDelay,
        fixedDelay = properties.fixedDelay,
        retryDelay = properties.retryDelay,
    )

    override fun configureTasks(taskRegistrar: ScheduledTaskRegistrar) {
        taskRegistrar.addTriggerTask(::synchronize, trigger)
    }

    fun synchronize() {
        try {
            val synchronizedCount = syncService.sync()
            trigger.recordSuccess()
            if (synchronizedCount == null) {
                logger.info("더 최근에 시작된 기업마당 동기화가 있어 이번 스냅샷 공개를 건너뜁니다.")
            } else {
                logger.info("기업마당 지원사업 공고 {}건을 MySQL과 검색 색인에 동기화했습니다.", synchronizedCount)
            }
        } catch (exception: SupportProgramCatalogFacadeException) {
            logger.error(
                "기업마당 지원사업 공고 동기화에 실패했습니다. 실패 유형: {}. 기존 공개 공고는 유지하고 {} 뒤 다시 시도합니다.",
                exception.failure,
                trigger.recordFailure(),
            )
        } catch (exception: RuntimeException) {
            logger.error(
                "기업마당 지원사업 공고 동기화 중 내부 오류가 발생했습니다. 오류 유형: {}. 기존 공개 공고는 유지하고 {} 뒤 다시 시도합니다.",
                exception.javaClass.simpleName,
                trigger.recordFailure(),
            )
        }
    }

    private companion object {
        val logger = LoggerFactory.getLogger(BizInfoSupportProgramCatalogSyncScheduler::class.java)
    }
}

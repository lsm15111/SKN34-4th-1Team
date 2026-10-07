package ai.govbiz.core.supportprogram.service.saved

import ai.govbiz.core.planusage.domain.PlanUsageFeature
import ai.govbiz.core.planusage.service.PlanUsageService
import ai.govbiz.core.supportprogram.domain.SavedSupportProgram
import ai.govbiz.core.supportprogram.repository.SavedSupportProgramRepository
import ai.govbiz.core.supportprogram.repository.SupportProgramRepository
import ai.govbiz.core.supportprogram.service.detail.exception.SupportProgramNotFoundException
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate

/**
 * 관심 공고함입니다. 회원이 공고를 담고 빼고 목록을 읽습니다. 담기는 같은 공고를 다시 담아도 한 번만 남고,
 * 빼기는 담기지 않은 공고를 빼도 오류가 아닙니다. 노출되지 않는 공고는 담을 수 없고, 새로 담는 공고는 요금제의 관심 공고 개수 한도 안이어야 합니다.
 */
@Service
class SavedSupportProgramService(
    private val savedSupportProgramRepository: SavedSupportProgramRepository,
    private val supportProgramRepository: SupportProgramRepository,
    private val planUsage: PlanUsageService,
    transactionManager: PlatformTransactionManager,
) {
    private val transactions = TransactionTemplate(transactionManager)

    fun list(accountId: Long): List<SavedSupportProgram> =
        savedSupportProgramRepository.findByAccountId(accountId)

    fun isSaved(accountId: Long, sourceCode: String, sourceProgramId: String): Boolean =
        savedSupportProgramRepository.findByIdentity(accountId, sourceCode, sourceProgramId) != null

    /**
     * 현재 노출 중인 공고만 담고, 담긴 결과를 현재 공고 내용과 함께 돌려줍니다. 없거나 숨겨진 공고는 404입니다.
     * 새로 담았을 때만 담은 뒤의 개수가 요금제 한도 안인지 같은 transaction에서 확인하고, 넘으면 담지 않고 429입니다.
     * 이미 담긴 공고를 다시 담으면 개수가 늘지 않으므로 한도에 닿아 있어도 같은 응답을 줍니다.
     */
    fun save(accountId: Long, sourceCode: String, sourceProgramId: String): SavedSupportProgram {
        supportProgramRepository.findPresentBySourceAndProgramId(sourceCode, sourceProgramId)
            ?: throw SupportProgramNotFoundException()
        transactions.executeWithoutResult {
            if (savedSupportProgramRepository.saveIfPresent(accountId, sourceCode, sourceProgramId)) {
                planUsage.requireHeldCapacity(accountId, PlanUsageFeature.SAVED_PROGRAM)
            }
        }
        return savedSupportProgramRepository.findByIdentity(accountId, sourceCode, sourceProgramId)
            ?: throw SupportProgramNotFoundException()
    }

    fun remove(accountId: Long, sourceCode: String, sourceProgramId: String) {
        savedSupportProgramRepository.delete(accountId, sourceCode, sourceProgramId)
    }
}

package ai.govbiz.core.account.service

import ai.govbiz.core.account.domain.Account
import ai.govbiz.core.account.domain.AccountType
import ai.govbiz.core.account.domain.OnboardingPurpose
import ai.govbiz.core.account.repository.AccountRepository
import java.time.Clock
import java.time.LocalDateTime
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 최초 로그인 환영 화면의 답(회원 유형·이용 목적)을 계정에 저장합니다.
 * 유형에 맞지 않는 목적은 받지 않고, 다시 부르면 덮어써서 프로필에서 바꿀 수 있게 합니다.
 */
@Service
class AccountOnboardingService(
    private val accountRepository: AccountRepository,
    @param:Qualifier("seoulClock") private val clock: Clock,
) {

    @Transactional
    fun complete(account: Account, type: AccountType, purpose: OnboardingPurpose?): Account {
        require(purpose == null || purpose.isAllowedFor(type)) { "onboarding purpose $purpose is not allowed for $type" }
        return accountRepository.completeOnboarding(account.id, type, purpose, LocalDateTime.now(clock))
    }
}

package ai.govbiz.core.account.service

import ai.govbiz.core.account.domain.AccountType
import ai.govbiz.core.account.domain.OnboardingPurpose
import ai.govbiz.core.account.helper.AccountTestHelper
import ai.govbiz.core.account.helper.AccountTestHelper.NOW
import ai.govbiz.core.account.repository.AccountRepository
import java.time.Clock
import java.time.ZoneId
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.Mockito.verifyNoInteractions
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension

@ExtendWith(MockitoExtension::class)
class AccountOnboardingServiceTest {

    @Mock
    private lateinit var accountRepository: AccountRepository

    private val clock: Clock = Clock.fixed(NOW.atZone(ZoneId.of("Asia/Seoul")).toInstant(), ZoneId.of("Asia/Seoul"))

    @Test
    fun savesTheTypeAndPurposeWithTheCurrentTime() {
        val account = AccountTestHelper.account()
        val saved = account.copy(accountType = AccountType.BUSINESS, onboardingPurpose = OnboardingPurpose.FIND_PARTNERS, onboardedAt = NOW)
        `when`(accountRepository.completeOnboarding(account.id, AccountType.BUSINESS, OnboardingPurpose.FIND_PARTNERS, NOW)).thenReturn(saved)

        val result = AccountOnboardingService(accountRepository, clock).complete(account, AccountType.BUSINESS, OnboardingPurpose.FIND_PARTNERS)

        assertEquals(saved, result)
        assertEquals(true, result.isOnboarded)
    }

    @Test
    fun rejectsAPurposeThatTheTypeDoesNotAllowWithoutTouchingTheRepository() {
        val account = AccountTestHelper.account()

        assertThrows(IllegalArgumentException::class.java) {
            AccountOnboardingService(accountRepository, clock).complete(account, AccountType.INDIVIDUAL, OnboardingPurpose.FIND_PARTNERS)
        }
        verifyNoInteractions(accountRepository)
    }

    @Test
    fun skippingThePurposeStoresOnlyTheType() {
        val account = AccountTestHelper.account()
        val saved = account.copy(accountType = AccountType.INDIVIDUAL, onboardedAt = NOW)
        `when`(accountRepository.completeOnboarding(account.id, AccountType.INDIVIDUAL, null, NOW)).thenReturn(saved)

        assertEquals(saved, AccountOnboardingService(accountRepository, clock).complete(account, AccountType.INDIVIDUAL, null))
    }
}

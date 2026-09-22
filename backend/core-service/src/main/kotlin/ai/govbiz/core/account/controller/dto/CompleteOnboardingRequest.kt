package ai.govbiz.core.account.controller.dto

import ai.govbiz.core.account.domain.AccountType
import ai.govbiz.core.account.domain.OnboardingPurpose
import jakarta.validation.constraints.AssertTrue
import jakarta.validation.constraints.NotNull

/** 환영 화면의 답입니다. 유형은 필수, 목적은 건너뛸 수 있으며 유형에 허용된 값만 받습니다. */
data class CompleteOnboardingRequest(
    @field:NotNull
    val accountType: AccountType?,
    val purpose: OnboardingPurpose? = null,
) {
    @get:AssertTrue(message = "purpose is not allowed for the account type")
    val isPurposeAllowed: Boolean
        get() = purpose == null || accountType == null || purpose.isAllowedFor(accountType)
}

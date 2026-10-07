package ai.govbiz.core.gettingstarted.service

import ai.govbiz.core.account.domain.Account
import ai.govbiz.core.gettingstarted.config.GettingStartedProperties
import ai.govbiz.core.gettingstarted.domain.GettingStartedGuide
import ai.govbiz.core.gettingstarted.domain.GettingStartedMember
import ai.govbiz.core.gettingstarted.repository.GettingStartedRepository
import java.time.Clock
import java.time.LocalDateTime
import java.time.temporal.ChronoUnit
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service

/**
 * 로그인 회원 본인의 시작하기 안내를 계산합니다. 완료 여부는 이미 있는 데이터에서만 읽고(모델 호출·행동 기록 없음),
 * 모든 단계를 처음 마친 것을 확인한 요청에서 완료 시각을 한 번 남깁니다. [닫기]·[다시 보기]는 닫은 시각만 바꿉니다.
 */
@Service
class GettingStartedService(
    private val repository: GettingStartedRepository,
    private val properties: GettingStartedProperties,
    @param:Qualifier("seoulClock") private val clock: Clock,
) {
    fun guide(account: Account): GettingStartedGuide {
        val now = now()
        val member = GettingStartedMember(account.accountType, account.isAdmin, account.createdAt)
        val facts = repository.facts(account.id)
        val guide = GettingStartedGuide.of(member, facts, properties.enabled, now)
        if (!guide.complete || facts.completedAt != null) return guide
        // 처음 모두 마친 것을 본 요청입니다. 동시에 와도 먼저 남긴 시각 하나만 유지됩니다.
        val completedAt = repository.recordCompleted(account.id, now)
        return GettingStartedGuide.of(member, facts.copy(completedAt = completedAt), properties.enabled, now)
    }

    fun setClosed(account: Account, closed: Boolean): GettingStartedGuide {
        repository.saveClosed(account.id, closed, now())
        return guide(account)
    }

    private fun now(): LocalDateTime = LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS)
}

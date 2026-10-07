package ai.govbiz.core.partner.service

import ai.govbiz.core.account.domain.Account
import ai.govbiz.core.partner.domain.NewPartnerProposal
import ai.govbiz.core.partner.domain.PartnerProposal
import ai.govbiz.core.partner.domain.PartnerProposalBox
import ai.govbiz.core.partner.domain.PartnerProposalDecision
import ai.govbiz.core.partner.domain.PartnerProposalInput
import ai.govbiz.core.partner.domain.PartnerProposalStatus
import ai.govbiz.core.partner.domain.PartnerProposalView
import ai.govbiz.core.partner.domain.PartnerRecruitmentStatus
import ai.govbiz.core.partner.repository.PartnerProposalRepository
import ai.govbiz.core.partner.repository.PartnerRecruitmentRepository
import ai.govbiz.core.partner.service.exception.ActiveBusinessRequiredException
import ai.govbiz.core.partner.service.exception.CompanyRequiredException
import ai.govbiz.core.partner.service.exception.ProposalActionForbiddenException
import ai.govbiz.core.partner.service.exception.ProposalAlreadySentException
import ai.govbiz.core.partner.service.exception.ProposalNotFoundException
import ai.govbiz.core.partner.service.exception.ProposalNotPendingException
import ai.govbiz.core.partner.service.exception.ProposalToOwnRecruitmentException
import ai.govbiz.core.partner.service.exception.RecruitmentClosedException
import ai.govbiz.core.partner.service.exception.RecruitmentNotFoundException
import ai.govbiz.core.planusage.domain.PlanUsageJob
import ai.govbiz.core.planusage.service.PlanUsageService
import java.time.Clock
import java.time.LocalDateTime
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.dao.DuplicateKeyException
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate

/**
 * 파트너 제안 보내기·수락·거절·철회입니다. 제안은 기업을 등록한 회원만 모집 중인 남의 모집글에 한 번 보낼 수 있고,
 * 수락·거절은 모집글 작성자가, 철회는 제안자가 대기 중일 때만 합니다. 이메일 인증 조건은 인증 기능이 생길 때 더합니다.
 * 한 달에 보낼 수 있는 제안 수는 요금제 한도 안이어야 하며, 철회·거절된 제안도 보낸 달의 횟수에 남습니다.
 */
@Service
class PartnerProposalService(
    private val proposalRepository: PartnerProposalRepository,
    private val recruitmentRepository: PartnerRecruitmentRepository,
    private val planUsage: PlanUsageService,
    transactionManager: PlatformTransactionManager,
    @param:Qualifier("seoulClock") private val clock: Clock,
) {
    private val transactions = TransactionTemplate(transactionManager)

    fun send(account: Account, recruitmentId: Long, content: PartnerProposalInput): PartnerProposalView {
        val company = account.company ?: throw CompanyRequiredException()
        // 제안은 계속사업자만 보냅니다. 휴업 기업은 받은 제안을 읽고 수락·거절하는 것만 됩니다.
        if (!company.isActiveBusiness) throw ActiveBusinessRequiredException()
        val recruitment = recruitmentRepository.findById(recruitmentId) ?: throw RecruitmentNotFoundException()
        if (recruitment.isOwnedBy(account.id)) throw ProposalToOwnRecruitmentException()
        if (recruitment.status(LocalDateTime.now(clock).toLocalDate()) == PartnerRecruitmentStatus.CLOSED) {
            throw RecruitmentClosedException()
        }

        val proposal = try {
            // 보내기와 이번 달 제안 수 확인을 한 transaction으로 묶어 한도를 넘는 제안은 남기지 않는다.
            requireNotNull(transactions.execute { _ ->
                proposalRepository.create(
                    NewPartnerProposal(
                        recruitmentId = recruitment.id,
                        proposerAccountId = account.id,
                        proposerCompanyId = company.id,
                        content = content,
                    ),
                ).also { planUsage.requireMonthlyCapacity(account.id, PlanUsageJob.PartnerProposal(it.id)) }
            })
        } catch (exception: DuplicateKeyException) {
            throw ProposalAlreadySentException()
        }
        return toView(proposal)
    }

    /** 당사자(제안자 또는 모집글 작성자)만 읽을 수 있습니다. 남의 제안은 없는 것처럼 404입니다. */
    fun find(account: Account, proposalId: Long): PartnerProposal {
        val proposal = proposalRepository.findById(proposalId) ?: throw ProposalNotFoundException()
        if (!proposal.isProposedBy(account.id) && !proposal.isOwnedBy(account.id)) throw ProposalNotFoundException()
        return proposal
    }

    fun findView(account: Account, proposalId: Long): PartnerProposalView = toView(find(account, proposalId))

    /** 받은 제안은 내 모집글로 온 것, 보낸 제안은 내가 보낸 것입니다. 기업이 없는 회원은 둘 다 비어 있습니다. */
    fun findBox(account: Account, box: PartnerProposalBox): List<PartnerProposalView> {
        val proposals = when (box) {
            PartnerProposalBox.RECEIVED -> proposalRepository.findReceivedBy(account.id)
            PartnerProposalBox.SENT -> proposalRepository.findSentBy(account.id)
        }
        val now = LocalDateTime.now(clock)
        return proposals.map { toView(it, now) }
    }

    fun accept(account: Account, proposalId: Long): PartnerProposalView = decide(account, proposalId, PartnerProposalDecision.ACCEPTED)

    fun decline(account: Account, proposalId: Long): PartnerProposalView = decide(account, proposalId, PartnerProposalDecision.DECLINED)

    fun withdraw(account: Account, proposalId: Long): PartnerProposalView {
        val proposal = find(account, proposalId)
        if (!proposal.isProposedBy(account.id)) throw ProposalActionForbiddenException()
        requirePending(proposal)
        return toView(proposalRepository.withdraw(proposal.id) ?: throw ProposalNotPendingException())
    }

    private fun decide(account: Account, proposalId: Long, decision: PartnerProposalDecision): PartnerProposalView {
        val proposal = find(account, proposalId)
        if (!proposal.isOwnedBy(account.id)) throw ProposalActionForbiddenException()
        requirePending(proposal)
        return toView(proposalRepository.decide(proposal.id, decision) ?: throw ProposalNotPendingException())
    }

    /** 만료·마감된 제안은 DB에 결정이 없어도 대기가 아니므로 먼저 계산해 막습니다. */
    private fun requirePending(proposal: PartnerProposal) {
        if (proposal.status(LocalDateTime.now(clock)) != PartnerProposalStatus.PENDING) throw ProposalNotPendingException()
    }

    /** 응답이 쓰는 상태·모집 상태·연락처 공개 여부를 서울 기준 현재 시각으로 한 번에 계산합니다. */
    private fun toView(proposal: PartnerProposal, now: LocalDateTime = LocalDateTime.now(clock)): PartnerProposalView =
        PartnerProposalView(
            proposal = proposal,
            status = proposal.status(now),
            recruitmentStatus = proposal.recruitment.status(now.toLocalDate()),
            revealsContacts = proposal.revealsContacts(now),
        )
}

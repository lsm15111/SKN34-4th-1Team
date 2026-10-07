package ai.govbiz.core.planusage.repository

import ai.govbiz.core._common.test.MySqlTestContainerConfig
import ai.govbiz.core.account.domain.NewAccount
import ai.govbiz.core.account.repository.AccountRepository
import ai.govbiz.core.applicationpreparation.domain.ApplicationServiceField
import ai.govbiz.core.applicationpreparation.domain.NewApplicationPreparation
import ai.govbiz.core.applicationpreparation.repository.ApplicationDocumentGenerationJobRepository
import ai.govbiz.core.applicationpreparation.repository.ApplicationPreparationRepository
import ai.govbiz.core.planusage.domain.PlanCode
import ai.govbiz.core.planusage.domain.PlanUsageFeature
import ai.govbiz.core.planusage.domain.PlanUsageJob
import ai.govbiz.core.planusage.domain.PlanUsagePeriod
import ai.govbiz.core.planusage.domain.PlanUsageWindow
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.UUID
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.dao.DataAccessException
import org.springframework.jdbc.core.JdbcTemplate

/** 실제 MySQL 8.4에서 사용량의 조건부 증가·되돌리기·삭제 보존과 월 한도 작업 집계, 개수 한도 집계 SQL을 확인합니다. */
@SpringBootTest(properties = [
    "app.account.jwt-secret=test-jwt-secret-0123456789abcdef0123456789",
    "app.ai-service.base-url=http://127.0.0.1:1",
    "app.bizinfo.sync.enabled=false",
    "app.support-program-index.enabled=false",
    "app.application-document.jobs.enabled=false",
])
@Import(MySqlTestContainerConfig::class)
class PlanUsageRepositoryIntegrationTest {
    @Autowired private lateinit var repository: PlanUsageRepository
    @Autowired private lateinit var accounts: AccountRepository
    @Autowired private lateinit var preparations: ApplicationPreparationRepository
    @Autowired private lateinit var generationJobs: ApplicationDocumentGenerationJobRepository
    @Autowired private lateinit var jdbc: JdbcTemplate
    private val seoul = ZoneId.of("Asia/Seoul")
    private lateinit var month: PlanUsageWindow
    private var ownerId = 0L

    @BeforeEach
    fun prepare() {
        month = PlanUsageWindow.current(PlanUsagePeriod.MONTH, ZonedDateTime.now(seoul))
        ownerId = accounts.createAccount(
            NewAccount("plan-usage-${UUID.randomUUID()}@example.test", "test-password-hash", LocalDateTime.of(2026, 10, 1, 0, 0)),
        ).id
    }

    @Test
    fun reservesOnlyWithinTheLimitWhenFirstUsesRaceAndReleasesWithoutGoingBelowZero() {
        val pool = Executors.newFixedThreadPool(8)
        val accepted = try {
            (1..12).map { pool.submit(Callable { repository.reserve(ownerId, PlanUsageFeature.AI_SEARCH, "2026-10-08", 5) }) }
                .count { it.get(20, TimeUnit.SECONDS) }
        } finally {
            pool.shutdownNow()
        }

        assertEquals(5, accepted)
        assertEquals(5, used(PlanUsageFeature.AI_SEARCH, "2026-10-08"))
        repository.release(ownerId, PlanUsageFeature.AI_SEARCH, "2026-10-08")
        assertEquals(4, used(PlanUsageFeature.AI_SEARCH, "2026-10-08"))
        assertEquals(true, repository.reserve(ownerId, PlanUsageFeature.AI_SEARCH, "2026-10-08", 5))
        assertEquals(false, repository.reserve(ownerId, PlanUsageFeature.AI_SEARCH, "2026-10-08", 5))
        // 다른 날·다른 기능은 따로 셉니다.
        assertEquals(true, repository.reserve(ownerId, PlanUsageFeature.AI_SEARCH, "2026-10-09", 5))
        assertEquals(true, repository.reserve(ownerId, PlanUsageFeature.EVIDENCE_QUESTION, "2026-10-08", 1))
        repeat(3) { repository.release(ownerId, PlanUsageFeature.EVIDENCE_QUESTION, "2026-10-08") }
        assertEquals(0, used(PlanUsageFeature.EVIDENCE_QUESTION, "2026-10-08"))
    }

    @Test
    fun readsTheAssignedPlanAndKeepsDeletedUsageAsACountInTheSameMonth() {
        assertEquals(PlanCode.FREE, repository.findPlan(ownerId))
        jdbc.update("INSERT INTO account_plan (account_id, plan_code, assigned_at) VALUES (?, 'PREMIUM', NOW(6))", ownerId)
        assertEquals(PlanCode.PREMIUM, repository.findPlan(ownerId))

        repository.addCount(ownerId, PlanUsageFeature.COMBINATION_REVIEW, month.key, 2)
        repository.addCount(ownerId, PlanUsageFeature.COMBINATION_REVIEW, month.key, 1)
        assertEquals(mapOf((PlanUsageFeature.COMBINATION_REVIEW to month.key) to 3), repository.findCounts(ownerId, listOf(month.key, month.key)))
    }

    @Test
    fun theDatabaseRejectsUnknownFeaturesPlansAndPeriodKeys() {
        assertThrows(DataAccessException::class.java) {
            jdbc.update("INSERT INTO plan_usage_counter VALUES (?, 'AI_SEARCH', '2026-13-01', 0, NOW(6))", ownerId)
        }
        assertThrows(DataAccessException::class.java) {
            jdbc.update("INSERT INTO plan_usage_counter VALUES (?, 'AI_SEARCH', 'today', 0, NOW(6))", ownerId)
        }
        assertThrows(DataAccessException::class.java) {
            jdbc.update("INSERT INTO plan_usage_counter VALUES (?, 'ASSISTANT', '2026-10', 0, NOW(6))", ownerId)
        }
        assertThrows(DataAccessException::class.java) {
            jdbc.update("INSERT INTO account_plan (account_id, plan_code, assigned_at) VALUES (?, 'GOLD', NOW(6))", ownerId)
        }
        jdbc.update("INSERT INTO plan_usage_counter VALUES (?, 'APPLICATION_DRAFT', '2026-10', 0, NOW(6))", ownerId)
        jdbc.update("INSERT INTO plan_usage_counter VALUES (?, 'AI_SEARCH', '2026-10-31', 0, NOW(6))", ownerId)
    }

    @Test
    fun countsReviewRunsThatDidNotFailThisMonthExcludingDemoSeedsAndTheGivenRun() {
        val review = review()
        val now = LocalDateTime.now(seoul)
        run(review, "SUCCEEDED", now)
        val failed = review()
        run(failed, "FAILED", now)
        val unknown = review()
        val unknownRun = run(unknown, "UNKNOWN", now)
        val queued = review()
        val queuedRun = run(queued, "QUEUED", now)
        run(review(), "SUCCEEDED", month.startsAt.toLocalDateTime().minusSeconds(1))
        run(review(demoSeed = "combination-review-completed-v1"), "SUCCEEDED", now)

        val window = month
        assertEquals(3, repository.countJobs(ownerId, PlanUsageFeature.COMBINATION_REVIEW, window))
        assertEquals(2, repository.countJobs(ownerId, PlanUsageFeature.COMBINATION_REVIEW, window, PlanUsageJob.ReviewRun(queuedRun)))
        // 결과 불명이 만료돼 실패로 정리되면 별도 처리 없이 사용량에서 빠집니다.
        jdbc.update("UPDATE combination_review_run SET status = 'FAILED', failure_code = 'RUN_OUTCOME_UNKNOWN_EXPIRED' WHERE id = ?", unknownRun)
        assertEquals(2, repository.countJobs(ownerId, PlanUsageFeature.COMBINATION_REVIEW, window))
    }

    @Test
    fun countsDraftProgramsOnceAcrossAnalysisGenerationFilesAndSectionRuns() {
        val now = LocalDateTime.now(seoul)
        val preparation = preparations.create(ownerId, draft()).id
        val job = requireNotNull(generationJobs.reserve(ownerId, UUID.randomUUID().toString(), preparation, 1, 3).job)
        discovery("PBLN_000000000118979", "SUCCEEDED", now)
        discovery("PBLN_DISCOVERED", "SUCCEEDED", now)
        discovery("PBLN_FAILED", "FAILED", now)
        discovery("PBLN_LAST_MONTH", "SUCCEEDED", month.startsAt.toLocalDateTime().minusSeconds(1))
        val window = month

        // 같은 공고의 분석과 생성은 한 건이며, 실패한 분석과 지난달 분석은 세지 않습니다.
        assertEquals(2, repository.countJobs(ownerId, PlanUsageFeature.APPLICATION_DRAFT, window))
        assertEquals(2, repository.countJobs(ownerId, PlanUsageFeature.APPLICATION_DRAFT, window, PlanUsageJob.DocumentGeneration(job.id)))
        assertEquals(3, repository.countJobs(ownerId, PlanUsageFeature.APPLICATION_DRAFT, window,
            including = PlanUsageJob.DraftProgram("BIZINFO", "PBLN_NEW")))
        assertEquals(2, repository.countJobs(ownerId, PlanUsageFeature.APPLICATION_DRAFT, window,
            including = PlanUsageJob.DraftProgram("BIZINFO", "PBLN_DISCOVERED")))

        // 생성 작업이 실패해도 그 달에 만든 문서 파일과 문항별 AI 실행이 있으면 그 공고는 쓴 것입니다.
        val other = preparations.create(ownerId, draft()).id
        jdbc.update("UPDATE application_preparation SET source_program_id = 'PBLN_FILE_ONLY' WHERE id = ?", other)
        jdbc.update("""INSERT INTO application_document_file
            (preparation_id, input_revision, file_name, media_type, file_bytes, source_sha256, placements_json, created_at)
            VALUES (?, 1, 'draft.hwpx', 'application/octet-stream', X'00', ?, JSON_ARRAY(), ?)""", other, "a".repeat(64), now)
        val section = preparations.create(ownerId, draft()).id
        jdbc.update("UPDATE application_preparation SET source_program_id = 'PBLN_SECTION_ONLY' WHERE id = ?", section)
        jdbc.update("""INSERT INTO application_preparation_interpretation_run
            (preparation_id, section_key, input_revision, request_key, request_hash, run_status, input_json, started_at)
            VALUES (?, 'company-overview', 1, ?, ?, 'SUCCEEDED', JSON_OBJECT(), ?)""", section, UUID.randomUUID().toString(), "b".repeat(64), now)
        jdbc.update("""INSERT INTO application_preparation_draft_run
            (preparation_id, section_key, input_revision, request_key, run_status, input_json, started_at)
            VALUES (?, 'company-overview', 1, ?, 'FAILED', JSON_OBJECT(), ?)""", other, UUID.randomUUID().toString(), now)
        val demo = preparations.create(ownerId, draft()).id
        jdbc.update("UPDATE application_preparation SET source_program_id = 'PBLN_DEMO', demo_seed_key = 'demo-v1' WHERE id = ?", demo)
        jdbc.update("""INSERT INTO application_document_file
            (preparation_id, input_revision, file_name, media_type, file_bytes, source_sha256, placements_json, created_at)
            VALUES (?, 1, 'demo.hwpx', 'application/octet-stream', X'00', ?, JSON_ARRAY(), ?)""", demo, "c".repeat(64), now)

        assertEquals(4, repository.countJobs(ownerId, PlanUsageFeature.APPLICATION_DRAFT, window))
    }

    @Test
    fun countsVisibleSavedProgramsOpenRecruitmentsAndEveryProposalSentThisMonth() {
        val today = LocalDate.now(seoul)
        val tag = UUID.randomUUID().toString().take(8)
        try {
            val open = program("$tag-open", "${today.minusDays(1)} ~ ${today.plusDays(30)}", today.minusDays(1), today.plusDays(30))
            val rolling = program("$tag-rolling", "예산 소진 시까지", null, null)
            val ended = program("$tag-ended", "모집 종료", null, null)
            val hidden = program("$tag-hidden", "${today} ~ ${today.plusDays(30)}", today, today.plusDays(30), present = false)
            val last = program("$tag-last", "${today.minusDays(30)} ~ ${today.plusDays(30)}", today.minusDays(30), today.plusDays(30))

            // 관심 공고는 목록에 보이는(노출 중인) 공고만 셉니다.
            listOf(open, rolling, hidden).forEach { saved(it) }
            assertEquals(2, repository.countHeld(ownerId, PlanUsageFeature.SAVED_PROGRAM, today))

            // 모집글은 모집 중인 글만 셉니다. 수동 마감, 모집 마감일 경과, 신청 기간 원문의 접수 종료는 빠집니다.
            val company = company()
            val openRecruitment = recruitment(company, open, today.plusDays(5))
            val closingToday = recruitment(company, rolling, today)
            recruitment(company, ended, today.plusDays(5))
            recruitment(company, hidden, today.plusDays(5), closedAt = LocalDateTime.now(seoul))
            val expired = recruitment(company, last, today.minusDays(1))
            assertEquals(2, repository.countHeld(ownerId, PlanUsageFeature.PARTNER_RECRUITMENT, today))

            // 제안은 이번 달 보낸 것을 철회·거절과 관계없이 모두 셉니다. 지난달에 보낸 제안은 빠집니다.
            val now = LocalDateTime.now(seoul)
            val sent = proposal(openRecruitment, company, now, withdrawnAt = now)
            proposal(closingToday, company, now)
            proposal(expired, company, month.startsAt.toLocalDateTime().minusSeconds(1))
            assertEquals(2, repository.countJobs(ownerId, PlanUsageFeature.PARTNER_PROPOSAL, month))
            assertEquals(1, repository.countJobs(ownerId, PlanUsageFeature.PARTNER_PROPOSAL, month, PlanUsageJob.PartnerProposal(sent)))
            assertThrows(IllegalArgumentException::class.java) { repository.countJobs(ownerId, PlanUsageFeature.SAVED_PROGRAM, month) }
            assertThrows(IllegalArgumentException::class.java) { repository.countHeld(ownerId, PlanUsageFeature.PARTNER_PROPOSAL, today) }
        } finally {
            jdbc.update("DELETE FROM partner_recruitment WHERE account_id = ?", ownerId)
            jdbc.update("DELETE FROM saved_support_program WHERE account_id = ?", ownerId)
            jdbc.update("DELETE FROM support_program WHERE source_code = 'TESTSRC' AND source_program_id LIKE ?", "$tag-%")
        }
    }

    private fun used(feature: PlanUsageFeature, periodKey: String): Int =
        repository.findCounts(ownerId, listOf(periodKey))[feature to periodKey] ?: 0

    // 연결 풀에서는 LAST_INSERT_ID()가 다른 연결을 볼 수 있어 고유한 값으로 다시 찾습니다.
    private fun review(demoSeed: String? = null): Long {
        val title = "중복 검토 ${UUID.randomUUID()}"
        jdbc.update("""INSERT INTO combination_review (owner_account_id, demo_seed_key, title, created_at, updated_at)
            VALUES (?, ?, ?, NOW(6), NOW(6))""", ownerId, demoSeed, title)
        return requireNotNull(jdbc.queryForObject("SELECT id FROM combination_review WHERE title = ?", Long::class.java, title))
    }

    private fun run(reviewId: Long, status: String, startedAt: LocalDateTime): Long {
        val finished = status !in setOf("QUEUED", "RUNNING")
        val succeeded = status == "SUCCEEDED"
        val requestKey = UUID.randomUUID().toString()
        jdbc.update("""INSERT INTO combination_review_run
            (review_id, input_revision, request_key, request_hash, status, input_json, evidence_json, configuration_json,
             analysis_json, failure_code, runner_instance_id, started_at, finished_at)
            VALUES (?, 1, ?, ?, ?, JSON_OBJECT(), ?, ?, ?, ?, ?, ?, ?)""",
            reviewId, requestKey, "d".repeat(64), status,
            if (succeeded) "{}" else null, if (succeeded) "{}" else null, if (succeeded) "{}" else null,
            if (finished && !succeeded) "RUN_FAILED" else null, UUID.randomUUID().toString(), startedAt,
            if (finished) startedAt else null)
        return requireNotNull(jdbc.queryForObject(
            "SELECT id FROM combination_review_run WHERE review_id = ? AND request_key = ?", Long::class.java, reviewId, requestKey,
        ))
    }

    private fun discovery(programId: String, status: String, createdAt: LocalDateTime) {
        jdbc.update("""INSERT INTO application_form_discovery_job
            (owner_account_id, request_key, source_code, source_program_id, status, result_json, failure_code,
             created_at, started_at, finished_at, next_publish_at)
            VALUES (?, ?, 'BIZINFO', ?, ?, ?, ?, ?, ?, ?, ?)""",
            ownerId, UUID.randomUUID().toString(), programId, status,
            if (status == "SUCCEEDED") "{}" else null, if (status == "FAILED") "SOURCE_UNAVAILABLE" else null,
            createdAt, createdAt, createdAt, createdAt)
    }

    private fun draft() = NewApplicationPreparation("BIZINFO", "PBLN_000000000118979",
        "bizinfo-pbln-000000000118979-innovation-voucher-2026-v1", ApplicationServiceField.TECHNICAL_SUPPORT)

    private fun program(programId: String, period: String, start: LocalDate?, end: LocalDate?, present: Boolean = true): Long {
        jdbc.update("""INSERT INTO support_program (source_code, source_program_id, title, organization, summary, categories, regions,
            target_description, application_period_raw, application_start_date, application_end_date, source_url, is_source_present)
            VALUES ('TESTSRC', ?, '요금제 한도 공고 · 특수문자 & 🧪', '기관', '요약', '["기술"]', '["서울"]', '대상', ?, ?, ?,
            'https://www.bizinfo.go.kr', ?)""", programId, period, start, end, present)
        return requireNotNull(jdbc.queryForObject(
            "SELECT id FROM support_program WHERE source_code = 'TESTSRC' AND source_program_id = ?", Long::class.java, programId,
        ))
    }

    private fun saved(programId: Long) {
        jdbc.update("INSERT INTO saved_support_program (account_id, support_program_id, saved_at) VALUES (?, ?, NOW(6))", ownerId, programId)
    }

    private fun company(): Long {
        jdbc.update("""INSERT INTO company (account_id, business_number, company_name, business_status, business_status_code, region,
            industry, founded_year, business_verified_at, created_at, updated_at)
            VALUES (?, ?, '요금제 테스트 기업', '계속사업자', '01', '서울특별시', '정보통신업', 2020, NOW(6), NOW(6), NOW(6))""",
            ownerId, "%010d".format(ownerId % 10_000_000_000L))
        return requireNotNull(jdbc.queryForObject("SELECT id FROM company WHERE account_id = ?", Long::class.java, ownerId))
    }

    private fun recruitment(companyId: Long, programId: Long, deadline: LocalDate, closedAt: LocalDateTime? = null): Long {
        jdbc.update("""INSERT INTO partner_recruitment (account_id, company_id, support_program_id, title, body, own_role, seeking_role,
            seeking_count, region, capabilities, recruitment_deadline, closed_at, created_at, updated_at)
            VALUES (?, ?, ?, '모집', '본문', 'LEAD', 'PARTICIPANT', 1, '서울', JSON_ARRAY(), ?, ?, NOW(6), NOW(6))""",
            ownerId, companyId, programId, deadline, closedAt)
        return requireNotNull(jdbc.queryForObject(
            "SELECT id FROM partner_recruitment WHERE account_id = ? AND support_program_id = ?", Long::class.java, ownerId, programId,
        ))
    }

    private fun proposal(recruitmentId: Long, companyId: Long, createdAt: LocalDateTime, withdrawnAt: LocalDateTime? = null): Long {
        jdbc.update("""INSERT INTO partner_proposal (recruitment_id, proposer_account_id, proposer_company_id, message, share_profile,
            withdrawn_at, created_at, updated_at) VALUES (?, ?, ?, '제안', TRUE, ?, ?, ?)""",
            recruitmentId, ownerId, companyId, withdrawnAt, createdAt, createdAt)
        return requireNotNull(jdbc.queryForObject(
            "SELECT id FROM partner_proposal WHERE recruitment_id = ? AND proposer_account_id = ?", Long::class.java, recruitmentId, ownerId,
        ))
    }
}

package ai.govbiz.core.gettingstarted.repository

import ai.govbiz.core._common.test.MySqlTestContainerConfig
import ai.govbiz.core.account.domain.NewAccount
import ai.govbiz.core.account.repository.AccountRepository
import ai.govbiz.core.applicationpreparation.domain.ApplicationServiceField
import ai.govbiz.core.applicationpreparation.domain.NewApplicationPreparation
import ai.govbiz.core.applicationpreparation.repository.ApplicationPreparationRepository
import ai.govbiz.core.gettingstarted.domain.GettingStartedFacts
import ai.govbiz.core.notification.domain.DeadlineReminderSetting
import ai.govbiz.core.notification.repository.NotificationSettingsRepository
import ai.govbiz.core.supportprogram.repository.SavedSupportProgramRepository
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.UUID
import kotlin.random.Random
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.dao.DataAccessException
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate

/**
 * 실제 MySQL 8.4에서 시작하기 완료 사실을 읽는 SELECT(표마다 EXISTS, 다른 계정·목업·준비 안 된 리포트 제외)와
 * 완료 시각 한 번 기록, 닫기·다시 보기, 계정 삭제 시 함께 삭제를 확인합니다.
 */
@SpringBootTest(properties = [
    "app.account.jwt-secret=test-jwt-secret-0123456789abcdef0123456789",
    "app.ai-service.base-url=http://127.0.0.1:1",
    "app.bizinfo.sync.enabled=false",
    "app.support-program-index.enabled=false",
    "app.application-document.jobs.enabled=false",
    "app.daily-report.enabled=false",
    "app.deadline-reminder.enabled=false",
])
@Import(MySqlTestContainerConfig::class)
class GettingStartedRepositoryIntegrationTest {
    @Autowired private lateinit var repository: GettingStartedRepository
    @Autowired private lateinit var accounts: AccountRepository
    @Autowired private lateinit var savedPrograms: SavedSupportProgramRepository
    @Autowired private lateinit var notificationSettings: NotificationSettingsRepository
    @Autowired private lateinit var preparations: ApplicationPreparationRepository
    @Autowired private lateinit var jdbc: JdbcTemplate
    @Autowired private lateinit var transactions: PlatformTransactionManager
    private val seoul = ZoneId.of("Asia/Seoul")
    private val nothing = GettingStartedFacts(false, false, false, false, false, null, null)
    private val programId = "공고-한글&특수/1 🧪"

    @BeforeEach
    fun clean() {
        jdbc.update("DELETE FROM support_program WHERE source_code = 'STARTTEST'")
        jdbc.update(
            """
            INSERT INTO support_program (
                source_code, source_program_id, title, organization, summary, categories, regions,
                target_description, application_period_raw, application_start_date, application_end_date, source_url
            ) VALUES ('STARTTEST', ?, 'AI 바우처 & 실증 지원사업', '정보통신산업진흥원', '실증 과제를 지원합니다.', '["기술"]', '["서울"]',
                '중소기업', '상시 접수', NULL, NULL, 'https://www.bizinfo.go.kr')
            """.trimIndent(),
            programId,
        )
    }

    @Test
    fun eachStepIsReadFromItsOwnTableAndOnlyForThisAccount() {
        val owner = account("owner")
        val other = account("other")
        assertEquals(nothing, repository.facts(owner.id))

        // 다른 계정의 기록은 이 계정의 단계를 끝내지 않습니다.
        company(other.id)
        assertTrue(savedPrograms.saveIfPresent(other.id, "STARTTEST", programId))
        notificationSettings.saveDeadlineReminder(other.id, DeadlineReminderSetting(enabled = true, email = false, push = true))
        report(other.id, "READY", LocalDate.now(seoul))
        review(other.id, demoSeed = null)
        assertEquals(nothing, repository.facts(owner.id))

        company(owner.id)
        assertEquals(nothing.copy(companyRegistered = true), repository.facts(owner.id))

        assertTrue(savedPrograms.saveIfPresent(owner.id, "STARTTEST", programId))
        // 담은 공고가 원문에서 내려가 목록에서 숨겨져도 담은 일은 한 것으로 봅니다.
        jdbc.update("UPDATE support_program SET is_source_present = FALSE WHERE source_code = 'STARTTEST'")
        assertEquals(nothing.copy(companyRegistered = true, programSaved = true), repository.facts(owner.id))

        // 저장만 하고 끈 알림은 완료가 아닙니다.
        notificationSettings.saveDeadlineReminder(owner.id, DeadlineReminderSetting(enabled = false, email = false, push = true))
        assertEquals(false, repository.facts(owner.id).deadlineReminderEnabled)
        notificationSettings.saveDeadlineReminder(owner.id, DeadlineReminderSetting(enabled = true, email = false, push = true))
        assertEquals(true, repository.facts(owner.id).deadlineReminderEnabled)
    }

    @Test
    fun onlyReadyReportsAndPreparationsOrReviewsThatAreNotDemoSeedsCount() {
        val owner = account("work")
        val today = LocalDate.now(seoul)
        report(owner.id, "GENERATING", today)
        report(owner.id, "FAILED", today.minusDays(1))
        assertEquals(false, repository.facts(owner.id).dailyReportReady)
        report(owner.id, "READY", today.minusDays(2))
        assertEquals(true, repository.facts(owner.id).dailyReportReady)

        val demoPreparation = preparations.create(owner.id, draft()).id
        jdbc.update("UPDATE application_preparation SET demo_seed_key = 'demo-v1' WHERE id = ?", demoPreparation)
        review(owner.id, demoSeed = "combination-review-completed-v1")
        assertEquals(false, repository.facts(owner.id).preparationStarted)

        review(owner.id, demoSeed = null)
        assertEquals(true, repository.facts(owner.id).preparationStarted)

        // 신청 문서만 있는 계정도 신청 준비를 시작한 것입니다.
        val writer = account("writer")
        preparations.create(writer.id, draft())
        assertEquals(nothing.copy(preparationStarted = true), repository.facts(writer.id))
    }

    @Test
    fun completionIsRecordedOnceAndClosingKeepsTheFirstCloseTimeUntilReopened() {
        val owner = account("state")
        val completedAt = LocalDateTime.of(2026, 10, 8, 21, 0, 0, 123_456_000)
        assertEquals(completedAt, repository.recordCompleted(owner.id, completedAt))
        val updatedAt = updatedAt(owner.id)
        assertEquals(completedAt, repository.recordCompleted(owner.id, completedAt.plusHours(1)))
        assertEquals(updatedAt, updatedAt(owner.id), "이미 완료한 계정은 다시 기록해도 바뀌지 않습니다")
        assertEquals(nothing.copy(completedAt = completedAt), repository.facts(owner.id))

        val closedAt = completedAt.plusMinutes(5)
        repository.saveClosed(owner.id, true, closedAt)
        repository.saveClosed(owner.id, true, closedAt.plusMinutes(5))
        assertEquals(nothing.copy(closedAt = closedAt, completedAt = completedAt), repository.facts(owner.id))

        repository.saveClosed(owner.id, false, closedAt.plusMinutes(10))
        assertEquals(nothing.copy(completedAt = completedAt), repository.facts(owner.id))

        // 행이 없는 계정도 닫을 수 있고, 닫기는 완료 시각을 만들지 않습니다.
        val fresh = account("fresh")
        repository.saveClosed(fresh.id, true, closedAt)
        assertEquals(closedAt, repository.facts(fresh.id).closedAt)
        assertNull(repository.facts(fresh.id).completedAt)
    }

    @Test
    fun theRowBelongsToAnExistingAccountRollsBackWithItsTransactionAndIsDeletedWithTheAccount() {
        assertThrows(DataAccessException::class.java) {
            jdbc.update(
                "INSERT INTO account_getting_started (account_id, created_at, updated_at) VALUES (?, NOW(6), NOW(6))",
                Long.MAX_VALUE / 2,
            )
        }
        val owner = account("cascade")
        assertThrows(IllegalStateException::class.java) {
            TransactionTemplate(transactions).executeWithoutResult {
                repository.saveClosed(owner.id, true, LocalDateTime.now(seoul))
                repository.recordCompleted(owner.id, LocalDateTime.now(seoul))
                error("rollback")
            }
        }
        assertEquals(0, rows(owner.id))

        repository.saveClosed(owner.id, true, LocalDateTime.now(seoul))
        assertEquals(1, rows(owner.id))
        jdbc.update("DELETE FROM account WHERE id = ?", owner.id)
        assertEquals(0, rows(owner.id))
    }

    private fun account(label: String) =
        accounts.createAccount(NewAccount("$label-${UUID.randomUUID()}@getting-started.test", "hash", LocalDateTime.now(seoul)))

    private fun company(accountId: Long) {
        jdbc.update(
            """
            INSERT INTO company (account_id, business_number, company_name, business_status, business_status_code,
                region, industry, founded_year, homepage_url, business_verified_at, created_at, updated_at)
            VALUES (?, ?, '넥스트웨이브 (주) & 파트너스', '계속사업자', '01', '서울특별시', '정보통신업', 2020, NULL, NOW(6), NOW(6), NOW(6))
            """.trimIndent(),
            accountId, Random.nextLong(1_000_000_000L, 10_000_000_000L).toString(),
        )
    }

    private fun report(accountId: Long, status: String, date: LocalDate) {
        val ready = status == "READY"
        jdbc.update(
            """
            INSERT INTO daily_report (account_id, report_date, status, input_json, content_json, error_message, generation_key,
                started_at, generated_at)
            VALUES (?, ?, ?, JSON_OBJECT(), ?, ?, ?, NOW(6), ?)
            """.trimIndent(),
            accountId, date, status, if (ready) "{}" else null, if (status == "FAILED") "생성 실패" else null,
            UUID.randomUUID().toString(), if (ready) LocalDateTime.now(seoul) else null,
        )
    }

    private fun review(accountId: Long, demoSeed: String?) {
        jdbc.update(
            "INSERT INTO combination_review (owner_account_id, demo_seed_key, title, created_at, updated_at) VALUES (?, ?, ?, NOW(6), NOW(6))",
            accountId, demoSeed, "중복 검토 ${UUID.randomUUID()}",
        )
    }

    private fun draft() = NewApplicationPreparation("BIZINFO", "PBLN_000000000118979",
        "bizinfo-pbln-000000000118979-innovation-voucher-2026-v1", ApplicationServiceField.TECHNICAL_SUPPORT)

    private fun updatedAt(accountId: Long): LocalDateTime? = jdbc.queryForObject(
        "SELECT updated_at FROM account_getting_started WHERE account_id = ?", LocalDateTime::class.java, accountId)

    private fun rows(accountId: Long): Int = requireNotNull(jdbc.queryForObject(
        "SELECT COUNT(*) FROM account_getting_started WHERE account_id = ?", Int::class.java, accountId))
}

package ai.govbiz.core.gettingstarted.controller

import ai.govbiz.core._common.exception.ApiExceptionHandler
import ai.govbiz.core.account.domain.Account
import ai.govbiz.core.account.domain.AccountRole
import ai.govbiz.core.account.domain.AccountType
import ai.govbiz.core.account.helper.SessionCookieHelper
import ai.govbiz.core.account.service.AccountSessionService
import ai.govbiz.core.account.service.exception.AuthenticationRequiredException
import ai.govbiz.core.account.web.AuthenticatedAccountArgumentResolver
import ai.govbiz.core.account.web.SessionOriginInterceptor
import ai.govbiz.core.gettingstarted.config.GettingStartedProperties
import ai.govbiz.core.gettingstarted.domain.GettingStartedFacts
import ai.govbiz.core.gettingstarted.repository.GettingStartedRepository
import ai.govbiz.core.gettingstarted.service.GettingStartedService
import jakarta.servlet.http.Cookie
import java.time.Clock
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import org.hamcrest.Matchers.nullValue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito.doReturn
import org.mockito.Mockito.doThrow
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders

class GettingStartedControllerTest {
    // 서울 2026-10-08 21:00
    private val clock = Clock.fixed(Instant.parse("2026-10-08T12:00:00Z"), ZoneId.of("Asia/Seoul"))
    private val now = LocalDateTime.of(2026, 10, 8, 21, 0)
    private val repository = mock(GettingStartedRepository::class.java)
    private val sessions = mock(AccountSessionService::class.java)
    private val cookie = Cookie(SessionCookieHelper.COOKIE_NAME, "session-token")
    private val member = Account(
        7, "member@example.test", AccountRole.USER, null, null, LocalDateTime.of(2026, 10, 1, 9, 0),
        accountType = AccountType.BUSINESS, onboardedAt = LocalDateTime.of(2026, 10, 1, 9, 5),
    )
    private val nothing = GettingStartedFacts(false, false, false, false, false, null, null)
    private lateinit var mvc: MockMvc

    @BeforeEach
    fun setUp() {
        mvc = MockMvcBuilders.standaloneSetup(
            GettingStartedController(GettingStartedService(repository, GettingStartedProperties(enabled = true), clock)),
        )
            .setCustomArgumentResolvers(AuthenticatedAccountArgumentResolver(sessions))
            .addInterceptors(SessionOriginInterceptor(listOf("http://localhost:5173")))
            .setControllerAdvice(ApiExceptionHandler()).build()
    }

    @Test
    fun guestsGet401AndNothingIsRead() {
        doThrow(AuthenticationRequiredException()).`when`(sessions).requireAccount(null)

        mvc.perform(get("/api/v1/me/getting-started")).andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"))
        mvc.perform(put("/api/v1/me/getting-started").contentType(MediaType.APPLICATION_JSON).content("""{"closed":true}"""))
            .andExpect(status().isUnauthorized())
        verifyNoInteractions(repository)
    }

    @Test
    fun membersGetTheirStepsInOrderAndTheResponseIsNeverCached() {
        doReturn(member).`when`(sessions).requireAccount("session-token")
        doReturn(nothing.copy(companyRegistered = true, programSaved = true)).`when`(repository).facts(7)

        mvc.perform(get("/api/v1/me/getting-started").cookie(cookie))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.visible").value(true))
            .andExpect(jsonPath("$.closed").value(false))
            .andExpect(jsonPath("$.completedAt").value(nullValue()))
            .andExpect(jsonPath("$.steps.length()").value(6))
            .andExpect(jsonPath("$.steps[0].id").value("SIGN_UP")).andExpect(jsonPath("$.steps[0].status").value("DONE"))
            .andExpect(jsonPath("$.steps[1].id").value("COMPANY")).andExpect(jsonPath("$.steps[1].status").value("DONE"))
            .andExpect(jsonPath("$.steps[2].id").value("SAVE_PROGRAM")).andExpect(jsonPath("$.steps[2].status").value("DONE"))
            .andExpect(jsonPath("$.steps[3].id").value("DEADLINE_REMINDER")).andExpect(jsonPath("$.steps[3].status").value("TODO"))
            .andExpect(jsonPath("$.steps[4].id").value("DAILY_REPORT")).andExpect(jsonPath("$.steps[4].status").value("TODO"))
            .andExpect(jsonPath("$.steps[5].id").value("START_PREPARATION")).andExpect(jsonPath("$.steps[5].status").value("TODO"))
    }

    @Test
    fun completionTimeIsTheSeoulOffsetTime() {
        doReturn(member).`when`(sessions).requireAccount("session-token")
        doReturn(nothing.copy(true, true, true, true, true, completedAt = LocalDateTime.of(2026, 10, 8, 20, 30)))
            .`when`(repository).facts(7)

        mvc.perform(get("/api/v1/me/getting-started").header("Authorization", "Bearer session-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.visible").value(true))
            .andExpect(jsonPath("$.completedAt").value("2026-10-08T20:30:00+09:00"))
    }

    @Test
    fun closingAndReopeningFromTheAllowedOriginReturnTheSameBody() {
        doReturn(member).`when`(sessions).requireAccount("session-token")
        doReturn(nothing.copy(closedAt = now)).`when`(repository).facts(7)

        mvc.perform(put("/api/v1/me/getting-started").cookie(cookie).header("Origin", "http://localhost:5173")
            .contentType(MediaType.APPLICATION_JSON).content("""{"closed":true}"""))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.visible").value(false))
            .andExpect(jsonPath("$.closed").value(true))
            .andExpect(jsonPath("$.steps.length()").value(6))
        verify(repository).saveClosed(7, true, now)

        doReturn(nothing).`when`(repository).facts(7)
        mvc.perform(put("/api/v1/me/getting-started").header("Authorization", "Bearer session-token")
            .contentType(MediaType.APPLICATION_JSON).content("""{"closed":false}"""))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.visible").value(true))
            .andExpect(jsonPath("$.closed").value(false))
        verify(repository).saveClosed(7, false, now)
    }

    @Test
    fun missingNullOrNonBooleanClosedIsRejectedBeforeAnythingIsSaved() {
        doReturn(member).`when`(sessions).requireAccount("session-token")
        for (body in listOf("""{}""", """{"closed":null}""", """{"closed":"maybe"}""", """{"closed":[true]}""", "not json")) {
            mvc.perform(put("/api/v1/me/getting-started").cookie(cookie).header("Origin", "http://localhost:5173")
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("REQUEST_VALIDATION_FAILED"))
        }
        verifyNoInteractions(repository)
    }

    @Test
    fun cookieUpdateFromAnotherOriginIsRejectedBeforeTheSession() {
        mvc.perform(put("/api/v1/me/getting-started").cookie(cookie).header("Origin", "https://attacker.example")
            .contentType(MediaType.APPLICATION_JSON).content("""{"closed":true}"""))
            .andExpect(status().isForbidden())
        verifyNoInteractions(repository, sessions)
    }
}

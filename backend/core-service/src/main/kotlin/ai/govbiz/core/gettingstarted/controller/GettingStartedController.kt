package ai.govbiz.core.gettingstarted.controller

import ai.govbiz.core.account.domain.Account
import ai.govbiz.core.gettingstarted.controller.dto.GettingStartedRequest
import ai.govbiz.core.gettingstarted.controller.dto.GettingStartedResponse
import ai.govbiz.core.gettingstarted.service.GettingStartedService
import jakarta.validation.Valid
import org.springframework.http.CacheControl
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 로그인 회원 본인의 시작하기 안내입니다. 세션이 없으면 401이고, 쿠키가 붙은 변경 요청은 기존 Origin 검사를 거칩니다.
 * 응답은 사람마다 다르고 자주 바뀌므로 캐시하지 않습니다.
 */
@RestController
@RequestMapping("/api/v1/me/getting-started")
class GettingStartedController(private val service: GettingStartedService) {
    @GetMapping
    fun guide(account: Account): ResponseEntity<GettingStartedResponse> =
        ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(GettingStartedResponse.from(service.guide(account)))

    @PutMapping
    fun update(account: Account, @RequestBody @Valid request: GettingStartedRequest): ResponseEntity<GettingStartedResponse> =
        ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(GettingStartedResponse.from(service.setClosed(account, request.closed)))
}

package ai.govbiz.core.gettingstarted.config

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * 시작하기 안내 설정입니다. 꺼져 있으면 단계는 그대로 계산하되 `visible`·`closed`가 항상 거짓이라 화면에 아무것도 보이지 않습니다.
 * 운영 기본값은 꺼짐(`GETTING_STARTED_ENABLED`)이고 로컬 Compose만 켜 둡니다.
 */
@ConfigurationProperties(prefix = "app.getting-started")
class GettingStartedProperties(
    val enabled: Boolean = false,
)

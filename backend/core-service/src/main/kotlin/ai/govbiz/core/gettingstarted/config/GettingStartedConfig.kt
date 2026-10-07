package ai.govbiz.core.gettingstarted.config

import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Configuration

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(GettingStartedProperties::class)
class GettingStartedConfig

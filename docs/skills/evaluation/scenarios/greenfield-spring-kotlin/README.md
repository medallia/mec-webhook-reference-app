# Scenario 1: Greenfield — Spring Boot + Kotlin Android

## Integrator Profile

- **Backend**: Spring Boot 3.x (Kotlin), PostgreSQL, RabbitMQ
- **Mobile**: Kotlin Android (native), Firebase Cloud Messaging
- **Auth**: Spring Security (Basic Auth capable)
- **Deployment**: Kubernetes on GCP
- **Existing webhook**: None
- **Existing push service**: None

## Stub File Layout

```
my-app/
  build.gradle.kts
  src/main/kotlin/com/example/myapp/
    MyAppApplication.kt
    config/
      SecurityConfig.kt
      RabbitConfig.kt
    controller/
      HealthController.kt
    service/
      UserService.kt
    repository/
      UserRepository.kt
    model/
      User.kt
  src/main/resources/
    application.yml
  android/
    app/src/main/java/com/example/myapp/
      MainActivity.kt
      ui/HomeScreen.kt
    app/src/main/AndroidManifest.xml
    app/build.gradle.kts
```

## Prompt

> "I have a Spring Boot backend (Kotlin) with PostgreSQL and RabbitMQ, and
> a native Kotlin Android app. I need to integrate with Medallia's
> Distribution Webhook to deliver survey invitations via push notifications.
> Using the reference implementation in the other workspace folder, create
> a full integration plan for my stack."

## Answer Key

### Expected Stack Profile

| Concern | Expected Mapping |
|---------|-----------------|
| Server Framework | Spring Boot (Kotlin) — new `@RestController` for `/distribute` |
| Queue | RabbitMQ — new exchange/queue for invitation processing |
| Database | PostgreSQL — new tables for devices and messages |
| Push Provider | Firebase Cloud Messaging — new FCM service |
| Mobile | Kotlin Android — new `FirebaseMessagingService`, survey activity |
| Auth (Inbound) | Spring Security Basic Auth filter |
| Auth (Outbound) | Spring `RestTemplate`/`WebClient` with OAuth client-credentials |

### Expected Obligation Mappings

| ID | Expected Integrator Component |
|----|------------------------------|
| O1 | New `DistributeController` with `@PostMapping("/distribute")` |
| O2 | Spring Security `BasicAuthenticationFilter` or `httpBasic()` config |
| O3 | Controller branch on CloudEvent `type` field |
| O4 | Request validation (Jakarta Bean Validation or manual checks) |
| O5 | PostgreSQL `INSERT ... ON CONFLICT DO NOTHING` on `message_id` |
| O6 | RabbitMQ `RabbitTemplate.convertAndSend()`, return 202 |
| O7 | `@RabbitListener` consumer class |
| O8 | `DeviceRepository.findByContactId()` (JPA/Spring Data) |
| O9 | Locale resolution service (port of `resolveInvitationMessage` logic) |
| O10 | `StatusCallbackService` using `WebClient` + OAuth |
| O11 | New `DeviceController` for registration |
| O12 | New delivery-ack endpoint + `delivery.delivered` callback |
| O13 | Expiration check in controller or worker |
| O14 | OAuth 2.0 client-credentials via Spring Security OAuth2 client |

### Expected Gaps (All Missing — Greenfield)

All O1–O14 should be marked **Missing** since there is no existing webhook.

### Anti-Pattern Checks

- Must NOT recommend Lambda/SQS/DynamoDB
- Must use RabbitMQ, not SQS
- Must use PostgreSQL, not DynamoDB
- Must map to Kotlin Android patterns, not React Native/Expo

### Minimum Passing Score

- Contract: 28/30 (all obligations addressed)
- Stack Adaptation: 25/25 (correct stack throughout)
- File Mapping: 15/20 (plausible file names)
- Gap Analysis: 12/15 (all missing, no false positives)
- Testing: 8/10 (core test cases)
- **Total: >= 80/100**

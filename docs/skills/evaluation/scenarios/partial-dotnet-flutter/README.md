# Scenario 2: Partial — .NET + Flutter

## Integrator Profile

- **Backend**: ASP.NET Core 8 (C#), SQL Server, Azure Service Bus
- **Mobile**: Flutter (Dart), Firebase Cloud Messaging
- **Auth**: ASP.NET Identity + JWT (can add Basic Auth)
- **Deployment**: Azure App Service
- **Existing webhook**: Generic webhook controller at `/api/webhooks` that accepts JSON POST requests and logs them. No CloudEvents parsing, no Medallia-specific handling.
- **Existing push service**: `PushNotificationService` that sends FCM notifications given a device token and payload.

## Stub File Layout

```
my-dotnet-app/
  MyApp.sln
  src/MyApp.Api/
    Program.cs
    Controllers/
      WebhooksController.cs       ← existing generic webhook
      DevicesController.cs        ← existing device CRUD
    Services/
      PushNotificationService.cs  ← existing FCM sender
      UserService.cs
    Models/
      Device.cs
      WebhookPayload.cs
    Data/
      AppDbContext.cs
      Migrations/
    appsettings.json
  src/MyApp.Api/MyApp.Api.csproj
  flutter_app/
    lib/
      main.dart
      screens/
        home_screen.dart
      services/
        api_service.dart
        push_service.dart          ← existing FCM handler
      models/
        device.dart
    pubspec.yaml
    android/app/src/main/AndroidManifest.xml
    ios/Runner/Info.plist
```

## Prompt

> "I have an ASP.NET Core backend with a generic webhook controller and
> an existing push notification service. My mobile app is Flutter with
> Firebase. I need to add Medallia Distribution Webhook support. Using
> the reference implementation, create an integration plan that reuses
> my existing infrastructure where possible."

## Answer Key

### Expected Stack Profile

| Concern | Expected Mapping |
|---------|-----------------|
| Server Framework | ASP.NET Core 8 — modify `WebhooksController` or add new controller |
| Queue | Azure Service Bus — new queue for invitation processing |
| Database | SQL Server — new tables (messages for idempotency, extend devices) |
| Push Provider | Existing `PushNotificationService` (FCM) |
| Mobile | Flutter — extend existing `push_service.dart` |
| Auth (Inbound) | Add Basic Auth middleware/policy |
| Auth (Outbound) | `HttpClient` with OAuth client-credentials |

### Expected Obligation Mappings

| ID | Expected Integrator Component |
|----|------------------------------|
| O1 | Extend `WebhooksController` with `/distribute` action, or new `DistributeController` |
| O2 | ASP.NET Basic Auth handler (middleware or `[Authorize]` policy) |
| O3 | Branch on `type` in the controller action |
| O4 | Model validation (`[Required]` attributes or FluentValidation) |
| O5 | SQL Server `MERGE` / `INSERT ... WHERE NOT EXISTS` on `MessageId` |
| O6 | Azure Service Bus `ServiceBusSender.SendMessageAsync()`, return 202 |
| O7 | Azure Service Bus processor (`ServiceBusProcessor`) or background hosted service |
| O8 | Existing `DevicesController` / `AppDbContext` — reuse device lookup |
| O9 | New locale resolution service (port logic from reference) |
| O10 | New `StatusCallbackService` using `HttpClient` |
| O11 | **Partial** — existing `DevicesController` may need `contactId` + FCM token fields |
| O12 | New delivery-ack endpoint in `DevicesController` |
| O13 | Expiration check in controller or worker |
| O14 | `HttpClient` with `DelegatingHandler` for OAuth token |

### Expected Gaps

| ID | Status | Reason |
|----|--------|--------|
| O1 | Partial | Webhook exists but no CloudEvents parsing |
| O2 | Missing | JWT auth exists but Basic Auth not configured |
| O3 | Missing | No auth-check handling |
| O4 | Partial | Generic validation, not CloudEvents-specific |
| O5 | Missing | No idempotency |
| O6 | Missing | Current webhook is synchronous |
| O7 | Missing | No async worker |
| O8 | Partial | Device lookup exists but may not key by contactId |
| O9 | Missing | No locale resolution |
| O10 | Missing | No status callbacks |
| O11 | Partial | Device registration exists, may need schema changes |
| O12 | Missing | No delivery ack |
| O13 | Missing | No expiration check |
| O14 | Missing | No outbound OAuth |

### Anti-Pattern Checks

- Must NOT recommend SQS (use Azure Service Bus)
- Must NOT recommend DynamoDB (use SQL Server)
- Must NOT recommend Expo/React Native (use Flutter)
- Must reuse existing `PushNotificationService`
- Must note existing webhook as a starting point, not replace it

### Minimum Passing Score

- Contract: 26/30 (partial items acknowledged)
- Stack Adaptation: 25/25 (Azure + .NET + Flutter throughout)
- File Mapping: 16/20 (existing files referenced correctly)
- Gap Analysis: 13/15 (partial vs missing distinguished)
- Testing: 8/10 (core test cases)
- **Total: >= 80/100**

# Requirements Document

## Introduction

This feature updates the Paydunya payment provider to support the new Orange Money Senegal API endpoint with both payment flows. Paydunya has migrated from `/v1/softpay/orange-money-senegal` to `/v1/softpay/new-orange-money-senegal` and introduced a new `api_type` field that enables two payment flows: `OTPCODE` (authorization code-based) and `QRCODE` (QR code-based). The implementation will support both flows, automatically selecting `OTPCODE` when an authorization code is provided, and `QRCODE` when it's not. This update ensures backward compatibility while adding new QR code payment capabilities.

## Requirements

### Requirement 1

**User Story:** As a developer using the Africa Payment SDK, I want the Orange Money Senegal integration to use the updated API endpoint, so that my application continues to work with Paydunya's latest infrastructure.

#### Acceptance Criteria

1. WHEN the checkout method is called with Orange Money Senegal payment method THEN the system SHALL use the `/v1/softpay/new-orange-money-senegal` endpoint instead of `/v1/softpay/orange-money-senegal`
2. WHEN making a payment request to the new endpoint THEN the system SHALL include the `api_type` field in the request payload
3. WHEN using authorization code flow THEN the system SHALL set `api_type` to `OTPCODE`
4. WHEN the API request is successful THEN the system SHALL handle the response in the same format as the previous implementation

### Requirement 2

**User Story:** As a developer, I want the existing authorization code payment flow to continue working seamlessly, so that I don't need to modify my application code after the SDK update.

#### Acceptance Criteria

1. WHEN an authorization code is provided in `MobileMoneyCheckoutOptions` THEN the system SHALL use the `OTPCODE` api_type
2. WHEN the authorization code is invalid or expired THEN the system SHALL throw a PaymentError with type `INVALID_AUTHORIZATION_CODE`
3. WHEN the payment is successful THEN the system SHALL return a CheckoutResult with the same structure as before
4. WHEN the payment fails THEN the system SHALL emit appropriate payment events (PAYMENT_FAILED or PAYMENT_CANCELLED)

### Requirement 3

**User Story:** As a developer, I want the SDK to maintain backward compatibility with existing code, so that upgrading to the new version doesn't break my application.

#### Acceptance Criteria

1. WHEN existing code calls `checkoutMobileMoney` with Orange Money payment method THEN the system SHALL process the payment without requiring code changes
2. WHEN the payment provider configuration is unchanged THEN the system SHALL work with the new API endpoint
3. WHEN webhook handling is triggered THEN the system SHALL continue to process Orange Money webhooks correctly
4. WHEN error handling is invoked THEN the system SHALL maintain the same error types and messages

### Requirement 4

**User Story:** As a developer, I want clear TypeScript types for the new API request and response, so that I have type safety and autocomplete support in my IDE.

#### Acceptance Criteria

1. WHEN defining the Orange Money request payload THEN the system SHALL include a TypeScript type with the `api_type` field
2. WHEN the `api_type` field is defined THEN it SHALL be typed as a union of `"OTPCODE"` and `"QRCODE"` literal types
3. WHEN the response is received THEN the system SHALL use the existing `PaydunyaOrangeMoneyPaymentSuccessResponse` type if the structure is unchanged
4. IF the response structure changes THEN the system SHALL define a new response type that accurately reflects the API response

### Requirement 5

**User Story:** As a developer, I want to use QR code-based Orange Money payments when no authorization code is provided, so that I can offer customers an alternative payment flow.

#### Acceptance Criteria

1. WHEN `checkoutMobileMoney` is called with Orange Money payment method AND no authorization code is provided THEN the system SHALL use `api_type` set to `QRCODE`
2. WHEN using QR code flow THEN the system SHALL send a request to `/v1/softpay/new-orange-money-senegal` with `api_type: "QRCODE"`
3. WHEN the QR code payment request is successful THEN the system SHALL return a CheckoutResult with a `redirectUrl` if provided by the API
4. WHEN the QR code payment response is received THEN the system SHALL handle it appropriately based on the API response structure

### Requirement 6

**User Story:** As a developer, I want the SDK to automatically choose the correct payment flow based on whether an authorization code is provided, so that I don't need to manually specify the flow type.

#### Acceptance Criteria

1. WHEN authorization code is present in `MobileMoneyCheckoutOptions` THEN the system SHALL automatically use `OTPCODE` flow
2. WHEN authorization code is absent or undefined in `MobileMoneyCheckoutOptions` THEN the system SHALL automatically use `QRCODE` flow
3. WHEN the flow is selected THEN the system SHALL construct the appropriate request payload for that flow
4. WHEN either flow completes THEN the system SHALL return a consistent CheckoutResult structure
